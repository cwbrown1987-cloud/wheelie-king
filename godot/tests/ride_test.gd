extends Node
## Headless ride tests: godot --headless --path . res://tests/ride_test.tscn [-- preset=Arcade bike=E-MTB scenario=all]
## Drives BikeInput directly (scripted) and prints JSON results; exits 1 if any check fails.
var main
var bike: Bike
var inp: BikeInput
var ter: TrailTerrain
var results := []
var failed := false
var args := {}

func _ready():
	for a in OS.get_cmdline_user_args():
		var kv = a.split("=")
		if kv.size() == 2: args[kv[0]] = kv[1]
	Tune.reset_defaults()
	if args.has("preset"): Tune.apply_preset(args.preset)
	if args.get("original", "0") == "1": Tune.mode_original = true
	for k in args:
		if k.begins_with("tune."): Tune.values[k.substr(5)] = float(args[k])
	if args.has("hz"): Engine.physics_ticks_per_second = int(args.hz)
	main = load("res://main.tscn").instantiate()
	main.bike_name = args.get("bike", "E-MTB")
	add_child(main)
	await get_tree().physics_frame
	bike = main.bike; inp = main.input; ter = main.terrain
	inp.scripted = true
	var which: String = args.get("scenario", "all")
	if which in ["all", "straight"]: await straight()
	if which in ["all", "turn"]: await turn()
	if which in ["all", "wheelie"]: await wheelie()
	if which in ["all", "trail"]: await trail()
	if which in ["all", "jumps"]:
		args["noise"] = "0.25"; args["v"] = "11"
		var before = results.size()
		await trail()
		results[before]["name"] = "jumps: faster, with a wandering thumb, no flips"
		args.erase("noise"); args.erase("v")
	if which in ["all", "touch"]: await touch()
	if which in ["all", "crash"]: await crash()
	if which == "shot":
		await respawn()
		if args.has("cam"): main.cam.mode = int(args.cam)
		if args.has("hide"):
			for nm in args.hide.split(","):
				for c in main.find_children(nm, "", true, false): c.visible = false
		if args.has("side"): main.cam.side_dist = float(args.side)
		var shots = args.get("shots", "3,8")
		var t0 = 0.0
		for tt in shots.split(","):
			var target_t = float(tt)
			await run(target_t - t0, func(_t):
				inp.steer = autopilot_steer(); var e = 9.5 - bike.speed
				inp.throttle = clamp(e * 0.5, 0.0, 1.0))
			t0 = target_t
			if args.has("crash"):
				bike._crash(null, "shot"); await run(float(args.crash), func(_t): zero()); t0 += float(args.crash)
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png(args.get("out", "/tmp") + "/shot_%s.png" % tt)
			print("SHOT ", tt)
			print("PERF prims=", RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME), " draws=", RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME), " objs=", RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME), " vram=", RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_VIDEO_MEM_USED) / 1048576)
	if which == "profile":
		var out = []
		for s in range(96, 150, 2):
			var a = ter.trail_at(s); out.append([s, snapped(a.h, 0.01), snapped(ter.height(a.x, a.z), 0.01)])
		print("PROFILE ", out)
	print("RESULTS ", JSON.stringify({"bike": main.bike_name, "preset": Tune.preset, "original": Tune.mode_original, "results": results}))
	get_tree().quit(1 if failed else 0)

func check(name: String, ok: bool, data: Dictionary):
	data["name"] = name; data["ok"] = ok; results.append(data)
	if not ok: failed = true
	print(("PASS " if ok else "FAIL ") + name + " " + JSON.stringify(data))

func zero():
	inp.throttle = 0; inp.brake = 0; inp.steer = 0; inp.lean = 0; inp.trick_roll = 0; inp.hop = false

func respawn():
	zero(); bike.reset_to(ter.start_transform())
	for n in 60: await get_tree().physics_frame

func run(seconds: float, f: Callable) -> Dictionary:
	var stats = {"crash": "", "max_lean": 0.0, "max_speed": 0.0, "max_pitch": 0.0, "air": 0.0, "wheelie_t": 0.0}
	var dt = 1.0 / Engine.physics_ticks_per_second
	var t = 0.0
	while t < seconds:
		if f.call(t) == true: break
		await get_tree().physics_frame
		t += dt
		if bike.state == Bike.State.CRASH and stats.crash == "": stats.crash = bike.crash_reason
		stats.max_lean = max(stats.max_lean, abs(bike.lean)); stats.max_speed = max(stats.max_speed, bike.speed)
		stats.max_pitch = max(stats.max_pitch, bike.pitch)
		if bike.state == Bike.State.AIRBORNE: stats.air += dt
		if bike.wheelie: stats.wheelie_t += dt
	return stats

func straight():
	await respawn()
	var p0 = bike.global_position
	var s = await run(6.0, func(_t): inp.throttle = 1.0; inp.steer = autopilot_steer())
	s["dist"] = bike.global_position.distance_to(p0); s["speed"] = bike.speed
	check("straight: accelerates and stays up", s.crash == "" and s.speed > 6.0 and s.max_lean < 0.5, s)

func turn():
	await respawn()
	await run(3.0, func(_t): inp.throttle = 1.0; inp.steer = autopilot_steer())
	var yaw0 = bike.global_transform.basis.get_euler().y
	var v0 = bike.speed
	var s = await run(1.5, func(_t): inp.throttle = 0.5; inp.steer = 0.7)
	s["v0"] = v0; s["yaw_change_deg"] = rad_to_deg(wrapf(bike.global_transform.basis.get_euler().y - yaw0, -PI, PI))
	s["lean_end"] = rad_to_deg(bike.lean)
	# steering right must turn right (yaw decreases in Godot) and lean right (+)
	check("turn: steer right turns and leans right", s.crash == "" and s.yaw_change_deg < -15.0 and s.lean_end > 5.0, s)

func wheelie():
	await respawn()
	await run(2.0, func(_t): inp.throttle = 0.6; inp.steer = autopilot_steer())
	var s = await run(4.0, func(t):
		inp.steer = autopilot_steer()
		# a rider's control loop: lean back to lift, ease off / tap brake when pitch gets high
		var target = 0.35
		var e = target - bike.pitch
		inp.lean = clamp(e * 4.0 + 0.3, -1.0, 1.0); inp.throttle = clamp(0.5 + e * 2.0, 0.0, 1.0)
		inp.brake = 1.0 if bike.pitch > 0.7 else 0.0)
	check("wheelie: can lift and hold the front", s.wheelie_t > 1.0 and s.crash == "", s)

func autopilot_steer() -> float:
	var p = bike.global_position
	var best = 0; var bd = 1e9
	for k in range(0, ter.trail_pts.size(), 2):
		var q = ter.trail_pts[k]; var d = Vector2(q.x - p.x, q.z - p.z).length_squared()
		if d < bd: bd = d; best = k
	var ahead = ter.trail_pts[min(best + 18 + int(max(0.0, bike.speed) * 1.2), ter.trail_pts.size() - 1)]
	var fwd = -bike.global_transform.basis.z; fwd.y = 0; fwd = fwd.normalized()
	var to = Vector3(ahead.x - p.x, 0, ahead.z - p.z).normalized()
	var ang = fwd.signed_angle_to(to, Vector3.UP)   # + = target to the left
	return clamp(-ang * 2.5, -1.0, 1.0)

func trail_progress() -> float:
	var p = bike.global_position; var best = 0; var bd = 1e9
	for k in ter.trail_pts.size():
		var q = ter.trail_pts[k]; var d = Vector2(q.x - p.x, q.z - p.z).length_squared()
		if d < bd: bd = d; best = k
	return ter.trail_s[best]

func trail():
	await respawn()
	var crashes = []; var landings = []
	var c1 = func(why): crashes.append([snapped(trail_progress(), 1), why])
	var c2 = func(info): landings.append([snapped(trail_progress(), 1), snapped(info.impact, 0.1), snapped(rad_to_deg(info.error), 1), snapped(info.air, 0.01)])
	bike.crashed.connect(c1); bike.landed.connect(c2)
	var target_v = float(args.get("v", "9.5"))
	var hmax = {}
	var s = await run(float(args.get("t", "75")), func(_t):
		var prog = trail_progress()
		if args.has("trace") and prog > float(args.trace) - 15.0 and prog < float(args.trace) + 5.0 and int(_t * 120) % 6 == 0:
			print("TR s=%.1f st=%d v=%.1f vy=%.1f pitch=%.0f lean=%.0f wpitch=%.2f hag=%.2f c=%s lean_in=%.2f" % [prog, bike.state, bike.speed, bike.linear_velocity.y, rad_to_deg(bike.pitch), rad_to_deg(bike.lean), bike.angular_velocity.dot(bike.global_transform.basis.x), bike.global_position.y - ter.height(bike.global_position.x, bike.global_position.z), str(bike.contact), inp.lean])
		var pr = int(prog / 10.0) * 10
		var hag = bike.global_position.y - ter.height(bike.global_position.x, bike.global_position.z)
		hmax[pr] = [max(hmax.get(pr, [0.0])[0], snapped(hag, 0.01)), snapped(bike.speed, 0.1), bike.state]
		inp.steer = autopilot_steer()
		if args.has("noise"): inp.lean = clamp(inp.lean + randf_range(-0.08, 0.08), -float(args.noise), float(args.noise))   # a wandering thumb
		var e = target_v - bike.speed
		inp.throttle = clamp(e * 0.5, 0.0, 1.0); inp.brake = clamp(-e * 0.3, 0.0, 1.0)
		return prog > ter.trail_s[-1] - 4.0)
	bike.crashed.disconnect(c1); bike.landed.disconnect(c2)
	s["progress_m"] = trail_progress(); s["height_above_ground_by_10m"] = hmax; s["trail_len"] = ter.trail_s[-1]
	s["crashes"] = crashes; s["landings"] = landings.filter(func(l): return l[3] > 0.25)
	check("trail: rides the hillside", crashes.size() <= 1 and s.progress_m > 250.0, s)


func touch():
	# real touch events through the on-screen controls: thumb down on the left and drag right = steer right
	await respawn()
	inp.scripted = false
	var tc = main.touch
	var vp = get_viewport().get_visible_rect().size
	var start = Vector2(vp.x * 0.2, vp.y * 0.7)
	var W = get_viewport().get_final_transform()   # events arrive in window pixels; the viewport maps them to canvas
	start = W * start
	var ev = InputEventScreenTouch.new(); ev.index = 0; ev.position = start; ev.pressed = true; Input.parse_input_event(ev)
	var gas = InputEventScreenTouch.new(); gas.index = 1; gas.position = W * tc._buttons.gas.get_center(); gas.pressed = true; Input.parse_input_event(gas)
	await run(2.0, func(_t): pass)
	var dr = InputEventScreenDrag.new(); dr.index = 0; dr.position = start + W.basis_xform(Vector2(70, 0)); Input.parse_input_event(dr)
	var s = await run(0.6, func(_t): pass)
	s["touch_steer"] = inp.touch_steer; s["steer"] = inp.steer; s["throttle"] = inp.throttle; s["bike_steer_deg"] = rad_to_deg(bike.steer)
	var up = InputEventScreenTouch.new(); up.index = 0; up.position = start; up.pressed = false; Input.parse_input_event(up)
	var up2 = InputEventScreenTouch.new(); up2.index = 1; up2.pressed = false; Input.parse_input_event(up2)
	await get_tree().physics_frame
	s["released_steer"] = inp.touch_steer
	inp.scripted = true
	check("touch: stick steers, gas drives", s.touch_steer > 0.3 and s.throttle > 0.9 and s.bike_steer_deg > 3.0 and s.released_steer == 0.0, s)


func crash():
	# 1) a crash throws the rider off as a ragdoll, which lands on the ground and is cleared on respawn
	await respawn()
	await run(2.5, func(_t): inp.throttle = 1.0; inp.steer = autopilot_steer())
	bike._crash(null, "test")
	await get_tree().physics_frame
	var rider = main.visual.rider_ik
	var n0 = rider._rag.size()
	var pel: RigidBody3D = rider._rag["pelvis"].body if rider._rag.has("pelvis") else null
	var p0 = pel.global_position if pel else Vector3.ZERO
	await run(1.8, func(_t): zero())
	var p1 = pel.global_position if is_instance_valid(pel) else Vector3.ZERO
	var hag = p1.y - ter.height(p1.x, p1.z)
	var head = rider._rag["head"].body.global_position if rider._rag.has("head") else Vector3.ZERO
	var sep = p1.distance_to(bike.global_position)
	await run(1.6, func(_t): zero())   # bike recovers after 3 s
	var cleared = rider._rag.is_empty() and bike.state != Bike.State.CRASH
	var d = {"segments": n0, "pelvis_moved": p0.distance_to(p1), "pelvis_above_ground": hag, "rider_bike_gap": sep, "head_ok": head.is_finite(), "cleared_after_respawn": cleared, "mass_back": bike.mass}
	check("crash: rider ragdolls off, lands, clears on respawn", n0 >= 10 and hag < 0.6 and hag > -0.3 and head.is_finite() and cleared and abs(bike.mass - bike.spec.mass()) < 0.1, d)
	# 2) riding into a tree trunk is a crash
	await respawn()
	var trunks = main.get_node("Scenery/Trunks")
	var best = null; var bd = 1e9
	for cs in trunks.get_children():
		var tp: Vector3 = cs.position
		var dd = tp.distance_to(bike.global_position)
		if dd < bd and dd > 10.0: bd = dd; best = cs
	var tp2: Vector3 = best.position
	var nrm = ter.normal(tp2.x, tp2.z); var uphill = Vector3(-nrm.x, 0, -nrm.z)
	uphill = uphill.normalized() if uphill.length() > 0.01 else Vector3.RIGHT
	var from = tp2 + uphill * 9.0   # start uphill so it's a downhill run into the tree
	var t = Transform3D.IDENTITY.looking_at(-uphill, Vector3.UP); t.origin = from
	bike.reset_to(t)
	for n in 30: await get_tree().physics_frame
	var reason = [""]
	var c = func(why): reason[0] = why
	bike.crashed.connect(c)
	await run(5.0, func(_t):
		inp.throttle = 1.0
		var to = (tp2 - bike.global_position); to.y = 0
		var fwd = -bike.global_transform.basis.z; fwd.y = 0
		inp.steer = clamp(-fwd.normalized().signed_angle_to(to.normalized(), Vector3.UP) * 2.0, -1.0, 1.0)
		if args.has("dbg") and int(_t * 60) % 30 == 0: print("DBG t=%.1f d=%.2f v=%.2f st=%d c=%s" % [_t, to.length(), bike.speed, bike.state, str(bike.contact)])
		return reason[0] != "")
	bike.crashed.disconnect(c)
	check("crash: riding into a tree trunk crashes", reason[0] != "", {"reason": reason[0], "dist_to_trunk": Vector2(bike.global_position.x - tp2.x, bike.global_position.z - tp2.z).length()})
