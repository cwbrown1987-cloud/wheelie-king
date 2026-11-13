class_name Bike extends RigidBody3D
## Wheelie King bike: Jolt rigid body + raycast suspension + tyre model + arcade assists.
## Responsibility boundaries (one owner each):
##   * this script is the ONLY thing that applies forces/torques to the bike body;
##   * BikeInput provides the player's intent (throttle, brake, steer, lean, hop, trick);
##   * Tune provides every tuning value (live);
##   * BikeSpec provides the bike's real numbers from its parts;
##   * the visuals, rider, camera and scoring only READ this script's state.
## Axes: forward = -Z, up = +Y, right = +X (Godot). Units: m, s, kg, N, rad.

enum State { GROUNDED, AIRBORNE, LANDING, CRASH, RECOVERY }

@export var spec: BikeSpec
var input: BikeInput

# ---- readable state (visuals, camera, HUD, tests)
var state: int = State.GROUNDED
var steer = 0.0                     # current bar angle (rad)
var compression = [0.0, 0.0]        # rear, front (m into travel)
var contact = [false, false]
var contact_point = [Vector3.ZERO, Vector3.ZERO]
var contact_normal = [Vector3.UP, Vector3.UP]
var slip = [0.0, 0.0]               # lateral slip angle per wheel
var wheel_spin = [0.0, 0.0]         # wheel rotation (rad) for visuals
var speed = 0.0                     # forward speed (m/s)
var lean = 0.0                      # roll angle (rad, + = leaning right)
var pitch = 0.0                     # nose up (+)
var air_time = 0.0
var air_rotation = Vector3.ZERO     # accumulated rotation while airborne (pitch, yaw, roll) rad
var last_landing = {}               # {"impact":, "error":, "air":, "clean":}
var crash_reason = ""
var predicted_landing = {}          # {"t":, "point":, "normal":}
var drifting = false
var wheelie = false
var stoppie = false
var last_safe = Transform3D.IDENTITY

signal landed(info: Dictionary)
signal crashed(reason: String)
signal recovered()
var crash_focus: Node3D = null       # the thrown rider (the camera watches it during a crash)
signal took_off()

var _prev_comp = [0.0, 0.0]
var _k = [0.0, 0.0]
var _c = [0.0, 0.0]
var _travel = [0.1, 0.1]
var _mount = [Vector3.ZERO, Vector3.ZERO]
var _crash_t = 0.0
var _ground_t = 0.0
var _hop_cool = 0.0
var _air_hold = 0.0
var _pred_tick = 0
var _terrain = null
var surface_name = ["", ""]
const G := 9.81

func _ready():
	if spec == null: spec = BikeSpec.presets()["E-MTB"]
	configure(spec)
	contact_monitor = true; max_contacts_reported = 6; can_sleep = false
	collision_layer = 2; collision_mask = 1   # layer 1 = world (ground, trunks), 2 = bike, 4 = ragdoll rider
	last_safe = global_transform
	_terrain = get_tree().get_first_node_in_group("terrain")

func configure(s: BikeSpec):
	spec = s
	mass = s.mass()
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM; center_of_mass = Vector3.ZERO  # origin = centre of mass
	inertia = Vector3(s.pitch_inertia(), s.yaw_inertia(), s.roll_inertia())   # x = pitch axis, y = yaw, z = roll
	var sag: float = Tune.v("sag")
	for w in 2:
		_travel[w] = max(0.06, s.travel_r if w == 0 else s.travel_f)        # tyres give a little even on rigid bikes
		var load: float = (1.0 - s.com_back) if w == 0 else s.com_back           # static weight share
		_k[w] = load * mass * G / (sag * _travel[w])
		_c[w] = 2.0 * Tune.v("damping_ratio") * (0.6 + 0.4 * s.damp) * sqrt(_k[w] * load * mass)
		var z: float = s.wheelbase * s.com_back if w == 0 else -s.wheelbase * (1.0 - s.com_back)
		var top_y: float = (s.wheel_r - s.com_height) - sag * _travel[w] + _travel[w]   # wheel centre at full compression
		_mount[w] = Vector3(0, top_y, z)
	_build_collision()

func _build_collision():
	for c in get_children(): if c is CollisionShape3D: c.queue_free()
	var body = CollisionShape3D.new(); var cap = CapsuleShape3D.new(); cap.radius = 0.22; cap.height = spec.wheelbase * 0.9
	body.shape = cap; body.rotation.x = PI / 2.0; body.position = Vector3(0, 0.05, 0); body.name = "Body"; add_child(body)
	for w in 2:  # wheel bump spheres: only touch when the suspension bottoms out or the tyre hits a ledge
		var ws = CollisionShape3D.new(); var sp = SphereShape3D.new(); sp.radius = spec.wheel_r * 0.72
		ws.shape = sp; ws.position = _mount[w] + Vector3(0, -_travel[w] * 0.15, 0); ws.name = "Wheel%d" % w; add_child(ws)
	var pm = PhysicsMaterial.new(); pm.friction = 0.15; pm.bounce = 0.0; physics_material_override = pm

func steer_limit(v: float) -> float:
	var t: float = clamp(v / (spec.vmax() * 0.65), 0.0, 1.0)
	return lerp(Tune.v("steer_max_low"), Tune.v("steer_max_high"), t * t * (3.0 - 2.0 * t))

func _integrate_forces(st: PhysicsDirectBodyState3D):
	var dt = st.step
	var b = st.transform.basis
	var fwd = -b.z; var up = b.y; var right = b.x
	var v = st.linear_velocity; var w = st.angular_velocity
	var i = input if input else BikeInput.new()
	speed = v.dot(fwd)
	var v_flat = Vector2(v.x, v.z).length()
	# orientation measures (relative to gravity)
	var flat_fwd = Vector3(fwd.x, 0, fwd.z).normalized()
	pitch = asin(clamp(fwd.y, -1.0, 1.0))
	var flat_right = flat_fwd.cross(Vector3.UP)
	lean = asin(clamp(-right.y, -1.0, 1.0))
	_hop_cool = max(0.0, _hop_cool - dt)

	if state == State.CRASH:
		_crash_t += dt
		st.angular_velocity *= 0.995
		if _crash_t > 3.0: _recover(st)
		return

	# ---------------- steering: progressive, speed-limited, smoothed
	var target = clamp(i.steer * Tune.v("steer_sensitivity"), -1.0, 1.0) * steer_limit(abs(speed))
	steer = move_toward(steer, target, Tune.v("steer_rate") * dt)

	# ---------------- suspension + tyres, per wheel (0 = rear, 1 = front)
	var space = st.get_space_state()
	var grounded = 0
	var mu_base: float = spec.tyre_grip * Tune.v("grip")
	var drive: float = spec.drive_force(abs(speed)) * i.throttle * Tune.v("power")
	# anti-wheelie (assist): if the front lifts and the rider isn't leaning back for it, ease the drive
	var aw: float = Tune.v("anti_wheelie")
	if aw > 0.0 and pitch > 0.08 and i.lean < 0.25 and not contact[1]:
		drive *= 1.0 - clamp(aw * 1.7 * clamp((pitch - 0.08) / 0.25, 0.0, 1.0), 0.0, 1.0)
	var brake_total: float = i.brake * spec.brake
	for wi in 2:
		var origin = st.transform * _mount[wi]
		var ray_len: float = _travel[wi] + spec.wheel_r
		var q = PhysicsRayQueryParameters3D.create(origin, origin - up * ray_len)
		q.exclude = [get_rid()]; q.collision_mask = 1
		var hit = space.intersect_ray(q)
		contact[wi] = not hit.is_empty()
		if not contact[wi]:
			compression[wi] = 0.0; _prev_comp[wi] = 0.0; slip[wi] = 0.0
			continue
		grounded += 1
		var p: Vector3 = hit.position; var n: Vector3 = hit.normal
		if _terrain and hit.collider is StaticBody3D and hit.collider.get_parent() == _terrain: n = _terrain.normal(p.x, p.z)
		contact_point[wi] = p; contact_normal[wi] = n
		var d = origin.distance_to(p)
		var x: float = clamp(_travel[wi] - (d - spec.wheel_r), 0.0, _travel[wi])
		var xdot = (x - _prev_comp[wi]) / dt
		_prev_comp[wi] = x; compression[wi] = x
		var over: float = max(0.0, x - _travel[wi] * 0.85) / (_travel[wi] * 0.15)
		var fs: float = _k[wi] * x * (1.0 + Tune.v("bump_stop") * over * over) + _c[wi] * xdot
		fs = max(0.0, fs) * max(0.0, n.dot(up))
		var rel = p - st.transform.origin
		st.apply_force(n * fs, rel)
		var N = fs
		# wheel frame on the ground plane
		var wf = fwd if wi == 0 else fwd.rotated(up, -steer)
		var f = (wf - n * wf.dot(n)).normalized()
		var s = f.cross(n).normalized()
		var vp = v + w.cross(rel)
		var vl = vp.dot(f); var vs = vp.dot(s)
		var srf = _terrain.surface_at(p.x, p.z) if _terrain else {"lat": 1.0, "lon": 1.0, "roll": 0.015}
		var mu = mu_base * srf.lat; var mu_lon = mu_base * srf.lon
		surface_name[wi] = srf.get("name", "")
		# longitudinal
		var fl = 0.0
		if wi == 0: fl += drive
		var bshare = 0.4 if wi == 0 else 0.6
		if brake_total > 0.0 and abs(vl) > 0.05: fl -= sign(vl) * brake_total * bshare * mu_lon * N * 1.1
		elif brake_total > 0.0: fl -= vl * mass * 0.5
		fl -= clamp(vl * 4.0, -1.0, 1.0) * srf.roll * N   # rolling resistance (Coulomb, smoothed near 0)
		# lateral: slip angle -> saturating force, progressive falloff when sliding
		var alpha = atan2(vs, abs(vl) + 0.6)
		slip[wi] = alpha
		var cs: float = Tune.v("cornering_stiffness")
		var x_s = cs * alpha
		var sat = x_s / sqrt(1.0 + x_s * x_s)
		var sliding: float = clamp(abs(x_s) - 1.0, 0.0, 1.0)
		var fy = -mu * N * sat * lerp(1.0, Tune.v("slide_falloff"), sliding)
		if wi == 0 and drifting: fy *= lerp(0.55, 0.85, Tune.v("drift_assist"))
		# friction circle
		var lim = max(mu, mu_lon) * N * 1.05
		var mag = sqrt(fl * fl + fy * fy)
		if mag > lim: fl *= lim / mag; fy *= lim / mag
		st.apply_force(f * fl + s * fy, rel)
		wheel_spin[wi] += vl / spec.wheel_r * dt
	if v.length() > 0.5: st.apply_central_force(-v * v.length() * 0.5 * 1.2 * spec.cda)   # air drag
	drifting = contact[0] and abs(slip[0]) > 0.22 and abs(speed) > 4.0

	# ---------------- state machine
	var was = state
	if grounded > 0:
		if state == State.AIRBORNE: _on_landing(st, up)
		state = State.GROUNDED; _ground_t += dt
		if _ground_t > 0.5 and abs(lean) < 0.35 and up.y > 0.85 and abs(speed) > 2.0: last_safe = st.transform
	else:
		_ground_t = 0.0
		if state == State.GROUNDED and air_time == 0.0: air_rotation = Vector3.ZERO
		air_time += dt
		if air_time > 0.06 and state != State.AIRBORNE:
			state = State.AIRBORNE; took_off.emit(); _air_hold = 0.0
			if abs(i.lean) < 0.3:   # unloading the rear shock on the lip kicks the nose; take most of that out
				var pr = w.dot(right)
				st.angular_velocity -= right * pr * 0.6 * Tune.v("takeoff_assist")
	if grounded > 0: air_time = 0.0
	wheelie = contact[0] and not contact[1] and pitch > 0.12
	stoppie = contact[1] and not contact[0] and pitch < -0.1

	var I = inertia
	if state == State.GROUNDED:
		# ---- lean: physics-derived target, applied by a damped, torque-limited controller
		var yaw_rate = -w.dot(up)   # + = turning right
		var w_geom = speed * tan(steer) / spec.wheelbase
		var w_target = lerp(yaw_rate, w_geom, Tune.v("countersteer"))
		var lean_t = clamp(atan(speed * w_target / G), -Tune.v("lean_max"), Tune.v("lean_max"))
		if wheelie or stoppie: lean_t *= 0.3
		var slow: float = 1.0 - clamp(abs(speed) / 4.0, 0.0, 1.0)
		var assist: float = Tune.v("lean_assist") * (1.0 + slow * Tune.v("low_speed_balance") * 1.5)
		var roll_rate = w.dot(fwd)
		var tq_roll = I.z * (Tune.v("lean_stiffness") * (lean_t - lean) - Tune.v("lean_damping") * roll_rate) * assist
		# past the max lean the tyres would wash out: push back hard (a rider sticks a leg out / stands it up)
		var over_lean = abs(lean) - Tune.v("lean_max")
		if over_lean > 0.0: tq_roll -= sign(lean) * I.z * 160.0 * over_lean * (0.4 + assist)
		tq_roll = clamp(tq_roll, -mass * G * 2.5, mass * G * 2.5)
		st.apply_torque(fwd * tq_roll)   # + about forward = lean right
		# ---- turn assist: help yaw follow the steering geometry (weak when drifting so slides stay alive)
		var ya: float = Tune.v("yaw_assist") * (0.35 if drifting else 1.0) * clamp(abs(speed) / 2.0, 0.0, 1.0)
		st.apply_torque(-up * (w_geom - yaw_rate) * I.y * 8.0 * ya)
		# ---- drift: firm rear brake + hard steer at speed loosens the rear; drift assist holds the angle
		if drifting and Tune.v("drift_assist") > 0.0:
			var lat_v = v.dot(right)
			st.apply_force(-right * lat_v * mass * 0.6 * Tune.v("drift_assist"))
	# ---- rider weight shift (ONE authoritative pitch input from the rider), grounded and airborne
	var shift: float = i.lean * Tune.v("weight_shift") * spec.rider_kg * G * 0.6
	if state == State.GROUNDED:
		st.apply_torque(right * shift)
		var pitch_rate = w.dot(right)
		if wheelie or stoppie:
			st.apply_torque(right * -pitch_rate * I.x * 6.0 * Tune.v("wheelie_damping"))
			if wheelie and i.brake > 0.05: st.apply_torque(right * -i.brake * Tune.v("rear_brake_pitch") * mass * G * 0.5)
		# hop: a preload-and-pop from the suspension
		if i.hop and _hop_cool <= 0.0 and grounded == 2:
			st.apply_central_impulse(up * mass * 3.0); st.apply_torque_impulse(right * I.x * 1.2); _hop_cool = 0.6
	elif state == State.AIRBORNE:
		_air_control(st, i, fwd, up, right)
	st.angular_velocity *= 1.0 - Tune.v("angular_damping") * 0.02 * dt * 60.0 * (0.3 if state == State.AIRBORNE else 1.0)

	# crash: body hit the ground hard, or lying on its side/upside down
	for ci in st.get_contact_count():
		var sh = st.get_contact_local_shape(ci)
		var imp = st.get_contact_impulse(ci).length()
		var other = st.get_contact_collider_object(ci)
		var is_ground = other is StaticBody3D and other.name == "Ground"
		if sh == 0 and imp > mass * 2.2: _crash(st, "Body hit the ground" if is_ground else "Hit a tree")
		elif not is_ground and imp > mass * 1.6 and sh != 0: _crash(st, "Hit a tree")   # wheel into a trunk
	if grounded == 0 and st.get_contact_count() > 0 and up.y < 0.2: _crash(st, "Landed upside down")
	if abs(lean) > 1.35 and grounded > 0: _crash(st, "Fell over")

func _air_control(st: PhysicsDirectBodyState3D, i: BikeInput, fwd: Vector3, up: Vector3, right: Vector3):
	var w = st.angular_velocity; var I = inertia; var dt = st.step
	# deliberate input only: a deadzone, then the rotation rate builds up over ~0.3 s instead of snapping to full
	var lp = _dz(i.lean, 0.3); var ly = _dz(i.steer, 0.25); var lr = _dz(i.trick_roll, 0.2)
	_air_hold = min(1.0, _air_hold + dt / 0.3) if (abs(lp) + abs(ly) + abs(lr)) > 0.0 else 0.0
	var ramp = _air_hold * _air_hold * (3.0 - 2.0 * _air_hold)
	var target = Vector3(lp * Tune.v("air_pitch"), -ly * Tune.v("air_yaw"), lr * Tune.v("air_roll")) * ramp  # lean back = nose up (backflip)
	var cur = Vector3(w.dot(right), w.dot(up), w.dot(-fwd))
	# take-off stabiliser: a lip, rebounding rear shock or a twitch of the stick shouldn't throw the bike over.
	# For the first part of the jump the nose follows the arc of the flight path unless you're clearly asking for a flip.
	var vlen = st.linear_velocity.length()
	if vlen > 2.0 and air_time < 0.55 and abs(lp) < 0.01:
		var gamma = asin(clamp(st.linear_velocity.y / vlen, -1.0, 1.0))
		# keep the nose pointing along the flight path: follow the arc's rotation, and steer back toward it if the
		# bike is already nose-high or nose-low (so repeated little hops down a steep landing can't add up to a flip)
		var w_path = -G * cos(gamma) / vlen + 5.0 * (gamma - pitch)
		var fade = 1.0 - clamp((air_time - 0.25) / 0.3, 0.0, 1.0)
		target.x = lerp(target.x, w_path, Tune.v("takeoff_assist") * fade)
		var k = Tune.v("takeoff_assist") * fade * 10.0
		st.apply_torque(right * (w_path - cur.x) * I.x * k)
	var resp: float = Tune.v("air_response")
	var tq = Vector3.ZERO
	for a in 3:
		var has_input: bool = abs(target[a]) > 0.01 or (a == 0 and air_time < 0.55)
		var want: float = target[a] if has_input else cur[a] * (1.0 - Tune.v("air_damping") * dt * 4.0)
		tq[a] = (want - cur[a]) * resp
	st.apply_torque(right * tq.x * I.x + up * tq.y * I.y + (-fwd) * tq.z * I.z)
	air_rotation += cur * dt
	# landing prediction + assist
	_pred_tick += 1
	if _pred_tick % 3 == 0 or predicted_landing.is_empty(): predicted_landing = predict_landing(st)
	elif not predicted_landing.is_empty(): predicted_landing.t = max(0.0, predicted_landing.t - dt)
	if not predicted_landing.is_empty() and Tune.v("landing_assist") > 0.0:
		var n: Vector3 = predicted_landing.normal; var t: float = predicted_landing.t
		var vel_dir = st.linear_velocity; vel_dir = (vel_dir - n * vel_dir.dot(n)).normalized()
		var want_up = n
		var err = up.cross(want_up)                      # axis*sin(angle) to rotate up -> slope normal
		var ang = up.angle_to(want_up)
		var player_pitching: bool = abs(lp) > 0.0
		if ang < Tune.v("landing_forgiveness") * 1.8 and not player_pitching:
			var urgency: float = clamp(1.0 - t / Tune.v("landing_lookahead"), 0.0, 1.0)
			var k: float = Tune.v("landing_assist") * urgency * 9.0
			var ia = (I.x + I.z) * 0.5
			st.apply_torque(err * ia * k - w * 2.0 * urgency * Tune.v("landing_assist") * ia)

func predict_landing(st: PhysicsDirectBodyState3D) -> Dictionary:
	var space = st.get_space_state()
	var p = st.transform.origin; var v = st.linear_velocity; var t = 0.0; var h = 0.05
	var horizon: float = Tune.v("landing_lookahead")
	while t < horizon:
		var np = p + v * h + Vector3(0, -G, 0) * h * h * 0.5
		var q = PhysicsRayQueryParameters3D.create(p, np + (np - p).normalized() * spec.com_height); q.exclude = [get_rid()]; q.collision_mask = 1
		var hit = space.intersect_ray(q)
		if not hit.is_empty(): return {"t": t, "point": hit.position, "normal": hit.normal, "speed": v.length()}
		v += Vector3(0, -G, 0) * h; p = np; t += h
	return {}

func _on_landing(st: PhysicsDirectBodyState3D, up: Vector3):
	var n: Vector3 = (contact_normal[0] if contact[0] else contact_normal[1])
	var err = up.angle_to(n)
	var impact = -st.linear_velocity.dot(n)
	last_landing = {"impact": impact, "error": err, "air": air_time, "rotation": air_rotation, "clean": err < Tune.v("landing_forgiveness") * 0.6}
	if impact > Tune.v("crash_impact") or err > Tune.v("landing_forgiveness") * 2.0:
		_crash(st, "Bad landing" if err > Tune.v("landing_forgiveness") * 2.0 else "Landed too hard"); return
	landed.emit(last_landing)

func _crash(st: PhysicsDirectBodyState3D, why: String):
	if state == State.CRASH: return
	state = State.CRASH; crash_reason = why; _crash_t = 0.0
	set_deferred("mass", spec.bike_kg)    # the rider's gone: the bike tumbles on its own
	crashed.emit(why)

func _upright(t: Transform3D) -> Transform3D:
	# keep only the heading: a respawn mid-corner shouldn't start leaned over
	var f = -t.basis.z; f.y = 0.0
	if f.length() < 0.1: f = Vector3.FORWARD
	var u = Transform3D.IDENTITY.looking_at(f.normalized(), Vector3.UP); u.origin = t.origin + Vector3(0, 0.25, 0)
	return u

func _recover(st: PhysicsDirectBodyState3D):
	st.transform = _upright(last_safe); st.linear_velocity = Vector3.ZERO; st.angular_velocity = Vector3.ZERO
	state = State.GROUNDED; crash_reason = ""; air_time = 0.0; steer = 0.0
	set_deferred("mass", spec.mass()); recovered.emit.call_deferred()

func reset_to(t: Transform3D):
	if state == State.CRASH: mass = spec.mass(); recovered.emit.call_deferred()
	if _terrain == null and is_inside_tree(): _terrain = get_tree().get_first_node_in_group("terrain")
	if _terrain: t.origin.y = _terrain.height(t.origin.x, t.origin.z) + spec.com_height + 0.08   # wheels just touching
	last_safe = t; global_transform = t; linear_velocity = Vector3.ZERO; angular_velocity = Vector3.ZERO; state = State.GROUNDED

static func _dz(x: float, d: float) -> float:
	return 0.0 if abs(x) <= d else sign(x) * (abs(x) - d) / (1.0 - d)
