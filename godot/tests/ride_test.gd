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
	if which == "shot":
		await respawn()
		var shots = args.get("shots", "3,8")
		var t0 = 0.0
		for tt in shots.split(","):
			var target_t = float(tt)
			await run(target_t - t0, func(_t):
				inp.steer = autopilot_steer(); var e = 9.5 - bike.speed
				inp.throttle = clamp(e * 0.5, 0.0, 1.0))
			t0 = target_t
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png(args.get("out", "/tmp") + "/shot_%s.png" % tt)
			print("SHOT ", tt)
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
		f.call(t)
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
		var pr = int(trail_progress() / 10.0) * 10
		var hag = bike.global_position.y - ter.height(bike.global_position.x, bike.global_position.z)
		hmax[pr] = [max(hmax.get(pr, [0.0])[0], snapped(hag, 0.01)), snapped(bike.speed, 0.1), bike.state]
		inp.steer = autopilot_steer()
		var e = target_v - bike.speed
		inp.throttle = clamp(e * 0.5, 0.0, 1.0); inp.brake = clamp(-e * 0.3, 0.0, 1.0))
	bike.crashed.disconnect(c1); bike.landed.disconnect(c2)
	s["progress_m"] = trail_progress(); s["height_above_ground_by_10m"] = hmax; s["trail_len"] = ter.trail_s[-1]
	s["crashes"] = crashes; s["landings"] = landings.filter(func(l): return l[3] > 0.25)
	check("trail: rides the hillside", crashes.size() <= 1 and s.progress_m > 250.0, s)
