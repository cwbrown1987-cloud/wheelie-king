class_name BikeModel extends Node3D
## The real Wheelie King garage bike (exported from the web game's builder as GLB) rigged to the physics:
##   * whole model sits at the static-sag pose, rear axle on the physics rear axle;
##   * wheels spin at the real wheel speed and move with real suspension compression;
##   * the swingarm (rear frame) pivots so the rear wheel stays attached;
##   * fork, bars, stem and front wheel turn about the real head-tube axis by the real steer angle.
## Reads Bike state only.
var bike: Bike
var model: Node3D
var wheel_grp = [null, null]        # model wheel groups (rear, front)
var wheel_rest = [Vector3.ZERO, Vector3.ZERO]
var steer_pivot: Node3D
var steer_axis = Vector3.UP         # in model space
var swing: Node3D
var swing_pivot = Vector3.ZERO
var swing_rest = Transform3D.IDENTITY
var swing_len = 0.4
var scale_k = 1.0
var seat_pt = Vector3.ZERO; var bar_pt = Vector3.ZERO; var bb_pt = Vector3.ZERO   # in bike space for the rider
var bar_half = 0.3

static func available(s: BikeSpec) -> bool:
	return s.model != "" and ResourceLoader.exists("res://assets/bikes/%s.glb" % s.model)

func setup(b: Bike):
	bike = b
	var s = b.spec
	model = (load("res://assets/bikes/%s.glb" % s.model) as PackedScene).instantiate()
	add_child(model)
	var tyres = _find(model, "wk:tyres")
	if tyres and tyres.get_child_count() >= 2:
		wheel_grp = [tyres.get_child(0), tyres.get_child(1)]
		if wheel_grp[0].position.x > wheel_grp[1].position.x: wheel_grp = [wheel_grp[1], wheel_grp[0]]
	var rear_x: float = wheel_grp[0].position.x; var front_x: float = wheel_grp[1].position.x; var R: float = wheel_grp[0].position.y
	scale_k = s.wheelbase / max(0.3, front_x - rear_x)
	# model space: +X forward, +Y up, ground at y=0.  Bike space: -Z forward, origin at the centre of mass.
	model.basis = Basis(Vector3.UP, PI / 2.0).scaled(Vector3.ONE * scale_k)
	var rear_axle_bike = Vector3(0, s.wheel_r - s.com_height, s.wheelbase * s.com_back)
	model.position = rear_axle_bike - model.basis * Vector3(rear_x, R, 0)
	for w in 2: wheel_rest[w] = wheel_grp[w].position
	_rig_steering(front_x, R)
	_rig_swingarm()
	_rider_points()
	for mi in _meshes(model):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

func _find(n: Node, name: String) -> Node:
	# Godot turns ':' in imported node names into '_'
	if n.name == name or String(n.name) == name.replace(":", "_"): return n
	for c in n.get_children():
		var r = _find(c, name)
		if r: return r
	return null

func _meshes(n: Node, out := []) -> Array:
	if n is MeshInstance3D: out.append(n)
	for c in n.get_children(): _meshes(c, out)
	return out

func _model_aabb(n: Node) -> AABB:
	# AABB of a subtree in MODEL space
	var box = AABB(); var first = true
	for mi in _meshes(n):
		var t: Transform3D = _model_xform(mi)
		var a: AABB = t * mi.get_aabb()
		box = a if first else box.merge(a); first = false
	return box

func _model_xform(n: Node3D) -> Transform3D:
	var t = n.transform; var p = n.get_parent()
	while p and p != model:
		t = p.transform * t; p = p.get_parent()
	return t

func _rig_steering(front_x: float, R: float):
	var steerer = _find(model, "fork:steerer") as Node3D
	var front_pt = Vector3(front_x, R, 0)
	var top = Vector3(front_x - 0.12, R + 0.55, 0)
	if steerer:
		var t = _model_xform(steerer)
		steer_axis = t.basis.y.normalized()
		if steer_axis.y < 0: steer_axis = -steer_axis
		top = t.origin
	else:
		steer_axis = Vector3(-sin(deg_to_rad(24)), cos(deg_to_rad(24)), 0)
	steer_pivot = Node3D.new(); steer_pivot.name = "SteerPivot"; model.add_child(steer_pivot)
	steer_pivot.position = top
	# everything that turns with the bars
	var movers = []
	for nm in ["wk:model:fork", "wk:model:bars", "wk:model:stem", "wk:part:stem", "wk:cockpit", "wk:throttle", "grips:L", "grips:R"]:
		var n = _find(model, nm)
		if n and not movers.has(n) and not _has_ancestor_in(n, movers): movers.append(n)
	movers.append(wheel_grp[1])
	for n in movers:
		var xf = _model_xform(n)
		n.get_parent().remove_child(n); steer_pivot.add_child(n)
		n.transform = Transform3D(Basis.IDENTITY, -top) * xf
	wheel_rest[1] = wheel_grp[1].position

func _has_ancestor_in(n: Node, list: Array) -> bool:
	var p = n.get_parent()
	while p:
		if list.has(p): return true
		p = p.get_parent()
	return false

func _rig_swingarm():
	swing = _find(model, "wk:model:rearFrame") as Node3D
	if swing == null: return
	var piv = _find(swing, "rearFrame:pivot") as Node3D
	swing_pivot = _model_xform(piv).origin if piv else _model_xform(swing).origin
	swing_rest = swing.transform
	swing_len = max(0.15, swing_pivot.x - wheel_rest[0].x)

func _rider_points():
	var to_bike = model.transform
	var seat = _find(model, "wk:seat"); var bars = _find(model, "wk:model:bars"); var cr = _find(model, "cranks:rotor") as Node3D
	if seat:
		var a = _model_aabb(seat); seat_pt = to_bike * Vector3(a.get_center().x, a.end.y, 0)
	if bars:
		var a2 = _model_aabb(bars); bar_pt = to_bike * Vector3(a2.get_center().x, a2.get_center().y, 0)
		bar_half = a2.size.z * 0.5 * scale_k
	if cr: bb_pt = to_bike * _model_xform(cr).origin

func _process(_dt):
	if bike == null or model == null: return
	var s = bike.spec
	var inv = 1.0 / scale_k
	for w in 2:
		var g: Node3D = wheel_grp[w]
		if g == null: continue
		var delta: float = (bike.compression[w] - Tune.v("sag") * bike._travel[w]) * inv   # + = wheel pushed up
		g.basis = Basis(Vector3(0, 0, 1), -bike.wheel_spin[w])
		if w == 0:
			g.position = wheel_rest[0] + Vector3(0, delta, 0)
			if swing:
				var ang = atan2(delta, swing_len)
				var rot = Transform3D(Basis(Vector3(0, 0, 1), -ang), Vector3.ZERO)
				swing.transform = Transform3D(Basis.IDENTITY, swing_pivot) * rot * Transform3D(Basis.IDENTITY, -swing_pivot) * swing_rest
		else:
			g.position = wheel_rest[1] + Vector3(0, delta, 0)
	steer_pivot.basis = Basis(steer_axis, -bike.steer)
