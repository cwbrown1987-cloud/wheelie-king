class_name Scenery extends Node3D
## Stylised nature from ONE consistent pack (Quaternius Stylized Nature, CC0) so everything flows together.
## Placed with MultiMesh (one draw call per model) off the trail, denser along its edges, never on the riding line.
const MODELS := {
	"pine_a": ["res://assets/nature/Pine_1.gltf", 1.6, 2.6], "pine_b": ["res://assets/nature/Pine_5.gltf", 1.5, 2.4],
	"tree_a": ["res://assets/nature/CommonTree_3.gltf", 1.2, 1.9], "tree_b": ["res://assets/nature/CommonTree_5.gltf", 1.2, 1.9],
	"bush": ["res://assets/nature/Bush_Common.gltf", 0.9, 1.6], "fern": ["res://assets/nature/Fern_1.gltf", 0.8, 1.4],
	"grass_a": ["res://assets/nature/Grass_Common_Tall.gltf", 0.9, 1.5], "grass_b": ["res://assets/nature/Grass_Wispy_Tall.gltf", 0.9, 1.5],
	"flower_a": ["res://assets/nature/Flower_3_Group.gltf", 0.9, 1.4], "flower_b": ["res://assets/nature/Flower_4_Group.gltf", 0.9, 1.4],
	"rock_a": ["res://assets/nature/Rock_Medium_1.gltf", 0.8, 2.2], "rock_b": ["res://assets/nature/Rock_Medium_2.gltf", 0.8, 2.2],
	"rock_c": ["res://assets/nature/Rock_Medium_3.gltf", 0.8, 2.2], "dead": ["res://assets/nature/DeadTree_1.gltf", 1.0, 1.6],
}
var terrain: TrailTerrain
var _near = PackedFloat32Array()   # coarse distance-to-trail grid (4 m cells)
const CELL := 4.0
var _cn = 0

var tree_range = 220.0     # trees fade out past this
var tree_detail = 90.0     # full trees up to here, then a few-dozen-triangle stand-in (the real ones are ~3000 each)
var small_range = 70.0     # grass/ferns/flowers
var rock_range = 140.0
const CHUNK := 40.0        # MultiMeshes are split into 40 m tiles so distant tiles cull and drop to low-detail LODs
var trunks: StaticBody3D   # solid trunks for trees near the trail (you can hit them)

func build(t: TrailTerrain, density := 1.0, q := {}):
	terrain = t
	tree_range = q.get("tree_range", tree_range); tree_detail = q.get("tree_detail", tree_detail); small_range = q.get("small_range", small_range); rock_range = q.get("rock_range", rock_range)
	trunks = StaticBody3D.new(); trunks.name = "Trunks"; add_child(trunks)
	_build_near()
	var rng = RandomNumberGenerator.new(); rng.seed = 1234
	var put = {}
	for k in MODELS: put[k] = []
	var half = TrailTerrain.SIZE * 0.5 - 4.0
	# trees: everywhere except the trail corridor, clustered by noise into forest patches
	var nz = FastNoiseLite.new(); nz.seed = 5; nz.frequency = 0.02
	for n in int(2600 * density):
		var x = rng.randf_range(-half, half); var z = rng.randf_range(-half, half)
		var d = near(x, z)
		if d < 6.5: continue
		var forest = nz.get_noise_2d(x, z) * 0.5 + 0.5
		if rng.randf() > forest * 1.3 + (0.25 if d < 14.0 else 0.0): continue
		if terrain.normal(x, z).y < 0.72: continue
		var kind: String = ["pine_a", "pine_b", "pine_a", "pine_b", "tree_a", "tree_b"][rng.randi() % 6] if rng.randf() < 0.97 else "dead"
		put[kind].append(Vector2(x, z))
	# undergrowth: dense near the trail edges (frames the line), sparse further out
	for n in int(9000 * density):
		var x = rng.randf_range(-half, half); var z = rng.randf_range(-half, half)
		var d = near(x, z)
		if d < 3.2: continue
		if d > 30.0 and rng.randf() < 0.75: continue
		var kind: String = ["grass_a", "grass_b", "grass_a", "fern", "bush", "flower_a", "flower_b", "grass_b"][rng.randi() % 8]
		put[kind].append(Vector2(x, z))
	for n in int(400 * density):
		var x = rng.randf_range(-half, half); var z = rng.randf_range(-half, half)
		if near(x, z) < 4.5: continue
		put[["rock_a", "rock_b", "rock_c"][rng.randi() % 3]].append(Vector2(x, z))
	for k in put:
		if put[k].is_empty(): continue
		_multimesh(k, put[k], rng)

func _build_near():
	_cn = int(TrailTerrain.SIZE / CELL) + 1
	_near.resize(_cn * _cn); _near.fill(1e6)
	var o = terrain.origin
	for p in terrain.trail_pts:
		var ci = int((p.x - o.x) / CELL); var cj = int((p.z - o.y) / CELL)
		for j in range(cj - 10, cj + 11):
			for i in range(ci - 10, ci + 11):
				if i < 0 or j < 0 or i >= _cn or j >= _cn: continue
				var d = Vector2(o.x + i * CELL - p.x, o.y + j * CELL - p.z).length()
				if d < _near[j * _cn + i]: _near[j * _cn + i] = d

func near(x: float, z: float) -> float:
	var o = terrain.origin
	var fx: float = clamp((x - o.x) / CELL, 0.0, _cn - 1.001); var fz: float = clamp((z - o.y) / CELL, 0.0, _cn - 1.001)
	var i = int(fx); var j = int(fz); var u = fx - i; var v = fz - j
	return lerp(lerp(_near[j * _cn + i], _near[j * _cn + i + 1], u), lerp(_near[(j + 1) * _cn + i], _near[(j + 1) * _cn + i + 1], u), v)

func _first_mesh(n: Node) -> MeshInstance3D:
	if n is MeshInstance3D: return n
	for c in n.get_children():
		var m = _first_mesh(c)
		if m: return m
	return null

func _multimesh(kind: String, pts: Array, rng: RandomNumberGenerator):
	var def: Array = MODELS[kind]
	var ps: PackedScene = load(def[0])
	if ps == null: return
	var inst = ps.instantiate(); var mi = _first_mesh(inst)
	if mi == null: inst.free(); return
	var base = mi.transform
	var tree = kind.begins_with("pine") or kind.begins_with("tree") or kind == "dead"
	var small = kind.begins_with("grass") or kind.begins_with("flower") or kind == "fern"
	var buckets = {}
	for n in pts.size():
		var p: Vector2 = pts[n]
		var sc = rng.randf_range(def[1], def[2])
		var y = terrain.height(p.x, p.y) - 0.05
		var b = Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * sc)
		if kind.begins_with("rock"): b = b * Basis(Vector3(rng.randf(), 0, rng.randf()).normalized(), rng.randf() * 0.4)
		var key = Vector2i(int(floor(p.x / CHUNK)), int(floor(p.y / CHUNK)))
		if not buckets.has(key): buckets[key] = []
		buckets[key].append(Transform3D(b, Vector3(p.x, y, p.y)) * base)
		if tree and near(p.x, p.y) < 26.0: _trunk(p, y, sc, kind)
	for key in buckets:
		var list: Array = buckets[key]
		var mm = MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D; mm.mesh = mi.mesh
		mm.instance_count = list.size()
		for n in list.size(): mm.set_instance_transform(n, list[n])
		var mmi = MultiMeshInstance3D.new(); mmi.multimesh = mm; mmi.name = "%s_%d_%d" % [kind, key.x, key.y]
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if small else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		var r = small_range if small else (tree_detail if tree else rock_range)
		mmi.visibility_range_end = r; mmi.visibility_range_end_margin = r * 0.12
		mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		add_child(mmi)
		if tree:
			var pm = MultiMesh.new(); pm.transform_format = MultiMesh.TRANSFORM_3D; pm.mesh = _proxy(kind, mi.mesh.get_aabb())
			pm.instance_count = list.size()
			for n in list.size(): pm.set_instance_transform(n, list[n])
			var pmi = MultiMeshInstance3D.new(); pmi.multimesh = pm; pmi.name = mmi.name + "_far"
			pmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			pmi.visibility_range_begin = tree_detail; pmi.visibility_range_begin_margin = tree_detail * 0.12
			pmi.visibility_range_end = tree_range; pmi.visibility_range_end_margin = tree_range * 0.1
			pmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			add_child(pmi)
	inst.free()

var _proxies = {}
func _proxy(kind: String, box: AABB) -> Mesh:
	# far-away stand-in: trunk + a cone (pines) or a lumpy ball (broadleaf), coloured like the real foliage
	if _proxies.has(kind): return _proxies[kind]
	var st = SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var c = box.get_center(); var h = box.size.y; var r = max(box.size.x, box.size.z) * 0.5
	var y0 = box.position.y
	var pine = kind.begins_with("pine")
	var dead = kind == "dead"
	var leaf = Color(0.16, 0.3, 0.13) if pine else Color(0.3, 0.45, 0.16)
	var bark = Color(0.3, 0.2, 0.13)
	var seg = 8
	# trunk
	var tr = r * 0.08; var th = h * (0.35 if not dead else 0.9)
	for k in seg:
		var a0 = TAU * k / seg; var a1 = TAU * (k + 1) / seg
		var p0 = Vector3(c.x + cos(a0) * tr, y0, c.z + sin(a0) * tr); var p1 = Vector3(c.x + cos(a1) * tr, y0, c.z + sin(a1) * tr)
		var q0 = p0 + Vector3(0, th, 0); var q1 = p1 + Vector3(0, th, 0)
		for v in [p0, q0, p1, p1, q0, q1]: st.set_color(bark); st.add_vertex(v)
	if not dead:
		if pine:
			var base_y = y0 + h * 0.18; var top = Vector3(c.x, y0 + h, c.z)
			for k in seg:
				var a0 = TAU * k / seg; var a1 = TAU * (k + 1) / seg
				var p0 = Vector3(c.x + cos(a0) * r * 0.9, base_y, c.z + sin(a0) * r * 0.9); var p1 = Vector3(c.x + cos(a1) * r * 0.9, base_y, c.z + sin(a1) * r * 0.9)
				for v in [p0, top, p1]: st.set_color(leaf); st.add_vertex(v)
				for v in [p1, Vector3(c.x, base_y, c.z), p0]: st.set_color(leaf * 0.7); st.add_vertex(v)
		else:
			var cen = Vector3(c.x, y0 + h * 0.62, c.z); var rr = Vector3(r * 0.85, h * 0.36, r * 0.85)
			var rings = 4
			for i in rings:
				var t0 = PI * i / rings; var t1 = PI * (i + 1) / rings
				for k in seg:
					var a0 = TAU * k / seg; var a1 = TAU * (k + 1) / seg
					var pts = []
					for tp in [[t0, a0], [t1, a0], [t1, a1], [t0, a1]]:
						pts.append(cen + Vector3(sin(tp[0]) * cos(tp[1]) * rr.x, cos(tp[0]) * rr.y, sin(tp[0]) * sin(tp[1]) * rr.z))
					for v in [pts[0], pts[1], pts[2], pts[0], pts[2], pts[3]]: st.set_color(leaf); st.add_vertex(v)
	st.generate_normals()
	var m = StandardMaterial3D.new(); m.vertex_color_use_as_albedo = true; m.vertex_color_is_srgb = true; m.roughness = 0.95; m.cull_mode = BaseMaterial3D.CULL_DISABLED
	var mesh = st.commit(); mesh.surface_set_material(0, m)
	_proxies[kind] = mesh
	return mesh

func _trunk(p: Vector2, y: float, sc: float, kind: String):
	var cs = CollisionShape3D.new(); var cyl = CylinderShape3D.new()
	cyl.radius = (0.16 if kind.begins_with("pine") else 0.2) * sc; cyl.height = 3.0 * sc
	cs.shape = cyl; cs.position = Vector3(p.x, y + cyl.height * 0.5, p.y)
	trunks.add_child(cs)
