class_name TrailTerrain extends Node3D
## Test hillside (Milestone 5): one height grid feeds the visible mesh, the Jolt HeightMapShape3D collision,
## height/normal/surface queries and landing prediction, so what you see is what you ride.
## The trail is a spline carved INTO the ground: graded profile, banked berms sized for the expected speed,
## designed jumps (roller, kicker + landing, tabletop), shoulders blended into the hill.

const SIZE := 360            # metres per side
const STEP := 1.0            # grid spacing (m)
var N = int(SIZE / STEP) + 1
var heights = PackedFloat32Array()
var surface = PackedByteArray()   # 0 grass, 1 packed dirt, 2 loose dirt, 3 rock, 4 gravel
var origin = Vector2(-SIZE / 2.0, -SIZE / 2.0)
var trail_pts: Array[Vector3] = []  # sampled centre line, every 0.5 m (x, height, z)
var trail_s = PackedFloat64Array()
var trail_width = 4.0
var features = []                  # [{"kind","s0","s1"}] for the route validator/tests
var seed = 7

const SURF := {
	0: {"name": "grass", "lat": 0.82, "lon": 0.85, "roll": 0.035},
	1: {"name": "packed dirt", "lat": 1.0, "lon": 1.0, "roll": 0.015},
	2: {"name": "loose dirt", "lat": 0.8, "lon": 0.85, "roll": 0.03},
	3: {"name": "rock", "lat": 0.95, "lon": 0.95, "roll": 0.012},
	4: {"name": "gravel", "lat": 0.75, "lon": 0.8, "roll": 0.025},
}

var _noise = FastNoiseLite.new()

func _ready():
	generate()
	build_visual(); build_collision()

func idx(i: int, j: int) -> int: return j * N + i

func base_height(x: float, z: float) -> float:
	# a long hillside falling toward +z, with ridges and a valley the trail follows
	var h = -z * 0.14
	h += _noise.get_noise_2d(x * 0.5, z * 0.5) * 9.0
	h += abs(_noise.get_noise_2d(x * 0.15 + 100.0, z * 0.15)) * 14.0 * clamp(abs(x) / 90.0, 0.0, 1.0)  # ridges at the sides
	return h

func generate():
	_noise.seed = seed; _noise.frequency = 0.012; _noise.fractal_octaves = 4
	heights.resize(N * N); surface.resize(N * N)
	for j in N:
		for i in N:
			heights[idx(i, j)] = base_height(origin.x + i * STEP, origin.y + j * STEP)
			surface[idx(i, j)] = 0
	_build_trail()
	_carve_trail()
	_classify_surfaces()

func _build_trail():
	# switchback route down the hill (control points x, z)
	var ctrl = [Vector2(0, -160), Vector2(10, -120), Vector2(-25, -85), Vector2(-40, -50), Vector2(-5, -25), Vector2(35, 5), Vector2(40, 40), Vector2(5, 70), Vector2(-30, 95), Vector2(-20, 130), Vector2(10, 160)]
	var curve = Curve2D.new()
	for k in ctrl.size():
		var p: Vector2 = ctrl[k]
		var prev: Vector2 = ctrl[max(0, k - 1)]; var nxt: Vector2 = ctrl[min(ctrl.size() - 1, k + 1)]
		var tan: Vector2 = (nxt - prev) * 0.25
		curve.add_point(p, -tan, tan)
	curve.bake_interval = 0.5
	var baked = curve.get_baked_points()
	# graded profile: smoothed natural ground, never steeper than ~14%
	var raw: Array[float] = []
	for p in baked: raw.append(base_height(p.x, p.y) - 0.6)
	var smooth: Array[float] = raw.duplicate()
	for pass_i in 6:
		for k in range(1, smooth.size() - 1): smooth[k] = (smooth[k - 1] + smooth[k] * 2.0 + smooth[k + 1]) / 4.0
	var s = 0.0
	trail_pts.clear(); trail_s.clear()
	for k in baked.size():
		if k > 0: s += baked[k].distance_to(baked[k - 1])
		trail_s.append(s); trail_pts.append(Vector3(baked[k].x, smooth[k], baked[k].y))
	# features along the trail (designed around ~9-12 m/s on the descent)
	features = [
		{"kind": "roller", "s0": 40.0, "s1": 52.0, "h": 0.8},
		{"kind": "kicker", "s0": 110.0, "s1": 116.0, "h": 1.4, "land0": 124.0, "land1": 136.0},
		{"kind": "tabletop", "s0": 205.0, "s1": 228.0, "h": 1.6},
		{"kind": "roller", "s0": 270.0, "s1": 282.0, "h": 0.7},
		{"kind": "kicker", "s0": 330.0, "s1": 336.5, "h": 1.7, "land0": 346.0, "land1": 360.0},
	]

func feature_height(s: float) -> float:
	var h = 0.0
	for f in features:
		match f.kind:
			"roller":
				if s > f.s0 and s < f.s1: h += f.h * 0.5 * (1.0 - cos(TAU * (s - f.s0) / (f.s1 - f.s0)))
			"kicker":
				if s > f.s0 and s <= f.s1: var t: float = (s - f.s0) / (f.s1 - f.s0); h += f.h * (1.0 - cos(PI / 2.0 * t))  # curved face
				elif s > f.s1 and s < f.land0: h += f.h * 0.9  # table deck: a short landing is a soft case, not a wall
				elif s >= f.land0 and s < f.land1: var t2: float = (s - f.land0) / (f.land1 - f.land0); h += f.h * 0.9 * (1.0 - t2) * (1.0 - t2 * 0.2)  # landing ramp down
			"tabletop":
				var a: float = f.s0; var b: float = f.s1; var up_len = 5.0; var down_len = 7.0
				if s > a and s < a + up_len: h += f.h * (1.0 - cos(PI / 2.0 * (s - a) / up_len))
				elif s >= a + up_len and s <= b - down_len: h += f.h
				elif s > b - down_len and s < b: h += f.h * (0.5 + 0.5 * cos(PI * (s - (b - down_len)) / down_len))
	return h

func trail_at(s: float) -> Dictionary:
	var k = clampi(trail_s.bsearch(s) - 1, 0, trail_pts.size() - 2)   # baked spacing isn't exactly 0.5 m
	var a = trail_pts[k]; var b = trail_pts[k + 1]
	var dir = Vector2(b.x - a.x, b.z - a.z).normalized()
	return {"x": a.x, "z": a.z, "h": a.y + feature_height(s), "dir": dir, "k": k}

func curvature_at(k: int) -> float:
	var a = trail_pts[max(0, k - 8)]; var b = trail_pts[k]; var c = trail_pts[min(trail_pts.size() - 1, k + 8)]
	var d1 = Vector2(b.x - a.x, b.z - a.z).normalized(); var d2 = Vector2(c.x - b.x, c.z - b.z).normalized()
	return d1.angle_to(d2) / max(0.1, Vector2(c.x - a.x, c.z - a.z).length() * 0.5)

func bank_at(k: int) -> float:
	# berm: bank angle for the expected speed and radius, tan(b) = v^2 * kappa / g (capped)
	var kap = curvature_at(k); var v = 9.0
	return clamp(atan(v * v * kap / 9.81), -0.55, 0.55) * clamp(abs(kap) * 25.0 - 0.3, 0.0, 1.0)

func _carve_trail():
	var best = PackedFloat32Array(); best.resize(N * N); best.fill(1e9)
	var target = PackedFloat32Array(); target.resize(N * N)
	var w = trail_width * 0.5; var shoulder = 5.0; var r = w + shoulder
	for k in trail_pts.size():
		var p = trail_pts[k]; var s = trail_s[k]; var dir = Vector2(trail_pts[min(k + 1, trail_pts.size() - 1)].x - p.x, trail_pts[min(k + 1, trail_pts.size() - 1)].z - p.z).normalized()
		var right = Vector2(-dir.y, dir.x); var bank = bank_at(k); var ch = p.y + feature_height(s)
		var i0 = int((p.x - r - origin.x) / STEP); var i1 = int((p.x + r - origin.x) / STEP) + 1
		var j0 = int((p.z - r - origin.y) / STEP); var j1 = int((p.z + r - origin.y) / STEP) + 1
		for j in range(max(0, j0), min(N, j1 + 1)):
			for i in range(max(0, i0), min(N, i1 + 1)):
				var x = origin.x + i * STEP; var z = origin.y + j * STEP
				var d = Vector2(x - p.x, z - p.z); var lat = d.dot(right); var dist = d.length()
				if dist < best[idx(i, j)]:
					best[idx(i, j)] = dist
					# berm: the OUTSIDE of the turn is the high side (lat > 0 is the inside of a right turn)
					target[idx(i, j)] = ch - lat * tan(bank) * (1.0 if abs(lat) <= w else w / abs(lat))
	for n in N * N:
		var dist = best[n]
		if dist > r: continue
		var blend = 1.0 if dist <= w else 1.0 - smoothstep(w, r, dist)
		heights[n] = lerp(heights[n], target[n], blend)
		if dist <= w + 0.3: surface[n] = 1

func _classify_surfaces():
	for j in range(1, N - 1):
		for i in range(1, N - 1):
			var n = idx(i, j)
			if surface[n] == 1: continue
			var gx = (heights[idx(i + 1, j)] - heights[idx(i - 1, j)]) / (2.0 * STEP); var gz = (heights[idx(i, j + 1)] - heights[idx(i, j - 1)]) / (2.0 * STEP)
			var sl = sqrt(gx * gx + gz * gz)
			if sl > 0.75: surface[n] = 3
			elif sl > 0.5: surface[n] = 4

# ---------------------------------------------------------------- queries (same data as mesh + collision)
func height(x: float, z: float) -> float:
	var fx: float = clamp((x - origin.x) / STEP, 0.0, N - 1.001); var fz: float = clamp((z - origin.y) / STEP, 0.0, N - 1.001)
	var i = int(fx); var j = int(fz); var u = fx - i; var v = fz - j
	return lerp(lerp(heights[idx(i, j)], heights[idx(i + 1, j)], u), lerp(heights[idx(i, j + 1)], heights[idx(i + 1, j + 1)], u), v)

func normal(x: float, z: float) -> Vector3:
	var e = 0.5
	return Vector3(height(x - e, z) - height(x + e, z), 2.0 * e, height(x, z - e) - height(x, z + e)).normalized()

func surface_at(x: float, z: float) -> Dictionary:
	var i = clampi(int(round((x - origin.x) / STEP)), 0, N - 1); var j = clampi(int(round((z - origin.y) / STEP)), 0, N - 1)
	return SURF[surface[idx(i, j)]]

func start_transform() -> Transform3D:
	var a = trail_at(3.0); var b = trail_at(6.0)
	var p = Vector3(a.x, a.h, a.z); var q = Vector3(b.x, b.h, b.z)
	var t = Transform3D.IDENTITY.looking_at(q - p, Vector3.UP)
	t.origin = p + Vector3(0, 1.2, 0)
	return t

# ---------------------------------------------------------------- mesh + collision
func build_collision():
	var body = StaticBody3D.new(); body.name = "Ground"; add_child(body)
	var cs = CollisionShape3D.new(); var hm = HeightMapShape3D.new()
	hm.map_width = N; hm.map_depth = N; hm.map_data = heights
	cs.shape = hm; cs.scale = Vector3(STEP, 1, STEP); cs.position = Vector3(origin.x + (N - 1) * STEP / 2.0, 0, origin.y + (N - 1) * STEP / 2.0)
	body.add_child(cs)

func build_visual():
	var st = SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for j in N:
		for i in N:
			var n = idx(i, j); var srf = surface[n]
			st.set_color(Color(1.0 if srf == 1 else 0.0, 1.0 if srf == 3 else 0.0, 1.0 if srf == 4 else 0.0, 1.0))
			st.add_vertex(Vector3(origin.x + i * STEP, heights[n], origin.y + j * STEP))
	for j in N - 1:
		for i in N - 1:
			var a = idx(i, j); var b = a + 1; var c = a + N; var d = c + 1
			st.add_index(a); st.add_index(b); st.add_index(c); st.add_index(b); st.add_index(d); st.add_index(c)
	st.generate_normals()
	var mi = MeshInstance3D.new(); mi.mesh = st.commit(); mi.name = "GroundMesh"; mi.material_override = load("res://scripts/ground_material.tres") if ResourceLoader.exists("res://scripts/ground_material.tres") else _ground_material()
	add_child(mi)

func _ground_material() -> ShaderMaterial:
	var sh = Shader.new()
	sh.code = """
shader_type spatial;
uniform sampler2D grass_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D dirt_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rock_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D dirt_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
varying vec3 wp; varying vec3 wn;
void vertex(){ wp=(MODEL_MATRIX*vec4(VERTEX,1.)).xyz; wn=normalize((MODEL_MATRIX*vec4(NORMAL,0.)).xyz); }
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+vec2(1,1)),f.x),f.y);}
void fragment(){
  float n=nz(wp.xz*.05)*.6+nz(wp.xz*.3)*.4;
  vec3 g=texture(grass_tex,wp.xz*.25).rgb*mix(vec3(.85,1.05,.6),vec3(1.1,1.05,.55),n);
  vec3 d=texture(dirt_tex,wp.xz*.35).rgb*vec3(1.2,.85,.6);
  vec3 r=texture(rock_tex,wp.xz*.12+wp.y*.08).rgb;
  float slope=1.-clamp(wn.y,0.,1.);
  float rock=max(COLOR.g,smoothstep(.4,.65,slope));
  vec3 c=mix(g,d,COLOR.r); c=mix(c,d*vec3(.9,.9,.95),COLOR.b); c=mix(c,r,rock);
  ALBEDO=c; ROUGHNESS=.92; NORMAL_MAP=texture(dirt_n,wp.xz*.35).rgb; NORMAL_MAP_DEPTH=mix(.3,1.,COLOR.r);
}
"""
	var m = ShaderMaterial.new(); m.shader = sh
	m.set_shader_parameter("grass_tex", load("res://assets/tex/Grass004_Color.jpg"))
	m.set_shader_parameter("dirt_tex", load("res://assets/tex/Ground054_2K_Color.jpg"))
	m.set_shader_parameter("rock_tex", load("res://assets/tex/Rock051_2K_Color.jpg"))
	m.set_shader_parameter("dirt_n", load("res://assets/tex/Ground054_2K_NormalGL.jpg"))
	return m
