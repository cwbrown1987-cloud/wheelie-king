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

func build(t: TrailTerrain, density := 1.0):
	terrain = t
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
	var mm = MultiMesh.new(); mm.transform_format = MultiMesh.TRANSFORM_3D; mm.mesh = mi.mesh
	mm.instance_count = pts.size()
	var base = mi.transform
	for n in pts.size():
		var p: Vector2 = pts[n]
		var s = rng.randf_range(def[1], def[2])
		var y = terrain.height(p.x, p.y) - 0.05
		var b = Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * s)
		if kind.begins_with("rock"): b = b * Basis(Vector3(rng.randf(), 0, rng.randf()).normalized(), rng.randf() * 0.4)
		mm.set_instance_transform(n, Transform3D(b, Vector3(p.x, y, p.y)) * base)
	var mmi = MultiMeshInstance3D.new(); mmi.multimesh = mm; mmi.name = kind
	var small = kind.begins_with("grass") or kind.begins_with("flower") or kind == "fern"
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if small else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	if small: mmi.visibility_range_end = 70.0; mmi.visibility_range_end_margin = 10.0; mmi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
	add_child(mmi)
	inst.free()
