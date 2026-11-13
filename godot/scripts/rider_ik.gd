class_name RiderIK extends Node3D
## The Wheelie King rider (Quaternius UBC body, dressed in the shop kit + Full Send MX helmet, exported from the
## web game) posed every frame by analytic two-bone IK onto the bike: feet on the pedals, hands on the grips,
## hips in the attack position. Weight shift, cornering, landings and air time change the targets; the IK does
## the rest, so any bike with seat/bar/bottom-bracket points is ridden correctly. Reads Bike state only.
var bike: Bike
var model: Node3D
var skel: Skeleton3D
var seat = Vector3.ZERO; var bars = Vector3.ZERO; var bb = Vector3.ZERO
var grip_w = 0.3
var B = {}            # bone name -> index
var crouch = 0.0
var _land = 0.0
var _lean_s = 0.0
var _corner_s = 0.0
var _crank = 0.0
const HEIGHT := 1.74

const KIT := {   # region palette: skin, top, sleeve, pants, glove, boot, knee, collar
	"top": Color("#1676d8"), "pants": Color("#202632"), "gloves": Color("#202632"), "boots": Color("#15181d"), "accent": Color("#71ff9a")}

static func available() -> bool:
	return ResourceLoader.exists("res://assets/bikes/rider.glb")

func setup(b: Bike, seat_p: Vector3, bar_p: Vector3, bb_p: Vector3, bar_half_width := 0.3):
	bike = b; seat = seat_p; bars = bar_p; bb = bb_p; grip_w = clamp(bar_half_width - 0.04, 0.2, 0.4)
	model = (load("res://assets/bikes/rider.glb") as PackedScene).instantiate()
	add_child(model)
	skel = _find_skel(model)
	for i in skel.get_bone_count(): B[skel.get_bone_name(i)] = i
	# model faces +Z; the bike faces -Z
	model.rotation.y = PI
	var head_y = (skel.get_bone_global_rest(B["Head"]).origin.y if B.has("Head") else 1.6)
	var k = HEIGHT / max(0.5, head_y + 0.12)
	model.scale = Vector3.ONE * k
	_dress(model)
	for mi in _meshes(model):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		mi.extra_cull_margin = 2.0
	b.landed.connect(func(info): _land = clamp(info.impact / 7.0, 0.25, 1.0))

func _find_skel(n: Node) -> Skeleton3D:
	if n is Skeleton3D: return n
	for c in n.get_children():
		var r = _find_skel(c)
		if r: return r
	return null

func _meshes(n: Node, out := []) -> Array:
	if n is MeshInstance3D: out.append(n)
	for c in n.get_children(): _meshes(c, out)
	return out

func _dress(root: Node):
	var sh = Shader.new()
	sh.code = """
shader_type spatial;
uniform sampler2D tex : source_color, filter_linear_mipmap;
uniform vec3 pal[8];
uniform float skin[8];
uniform vec3 accent;
varying float reg; varying vec3 lp;
void vertex(){ reg = COLOR.r * 8.0; lp = VERTEX; }
void fragment(){
  vec3 base = texture(tex, UV).rgb;
  int r = clamp(int(floor(reg + 0.5)), 0, 7);
  if (skin[r] > 0.5) { ALBEDO = base; ROUGHNESS = 0.6; }
  else {
    float shade = clamp(dot(base, vec3(.299, .587, .114)) * 1.6, .45, 1.15);
    vec3 c = pal[r] * mix(1.0, shade, .55);
    if (r == 5) c = mix(c, accent, step(.5, fract(lp.y * 14.0)) * .6);
    ALBEDO = c; ROUGHNESS = .82;
  }
}
"""
	var lin = func(c: Color) -> Vector3: var l = c.srgb_to_linear(); return Vector3(l.r, l.g, l.b)
	var top: Color = KIT.top; var pants: Color = KIT.pants
	var pal = [Vector3.ONE, lin.call(top), lin.call(top * 0.9), lin.call(pants), lin.call(KIT.gloves), lin.call(KIT.boots), lin.call(pants.lerp(Color("#8a93a3"), 0.22)), lin.call(top)]
	for mi in _meshes(root):
		if not String(mi.name).begins_with("SuperHero"): continue
		var old = mi.get_active_material(0)
		var m = ShaderMaterial.new(); m.shader = sh
		if old is BaseMaterial3D: m.set_shader_parameter("tex", old.albedo_texture)
		m.set_shader_parameter("pal", pal)
		m.set_shader_parameter("skin", PackedFloat32Array([1, 0, 0, 0, 0, 0, 0, 1]))
		m.set_shader_parameter("accent", lin.call(KIT.accent))
		mi.material_override = m

# ------------------------------------------------------------------ IK helpers (skeleton space)
func _to_skel(p_rider: Vector3) -> Vector3:
	return (skel.global_transform.affine_inverse() * global_transform) * p_rider

func _gpos(i: int) -> Vector3: return skel.get_bone_global_pose(i).origin

func _rotate_global(i: int, delta: Quaternion):
	var parent = skel.get_bone_parent(i)
	var g = skel.get_bone_global_pose(i)
	var new_basis = Basis(delta) * g.basis
	var pb = skel.get_bone_global_pose(parent).basis if parent >= 0 else Basis.IDENTITY
	skel.set_bone_pose_rotation(i, (pb.inverse() * new_basis).get_rotation_quaternion())

func _aim(i: int, child: int, target: Vector3):
	var a = _gpos(i); var from = _gpos(child) - a; var to = target - a
	if from.length_squared() < 1e-10 or to.length_squared() < 1e-10: return
	_rotate_global(i, Quaternion(from.normalized(), to.normalized()))

func _two_bone(upper: int, lower: int, end: int, target: Vector3, pole: Vector3):
	var a = _gpos(upper); var m = _gpos(lower); var e = _gpos(end)
	var l1 = a.distance_to(m); var l2 = m.distance_to(e)
	var n = target - a; var d = n.length()
	if d < 1e-4: return
	n /= d; d = clamp(d, abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999)
	var p = pole - a; p -= n * p.dot(n)
	if p.length_squared() < 1e-8: p = Vector3.UP
	p = p.normalized()
	var x = (l1 * l1 - l2 * l2 + d * d) / (2.0 * d); var h = sqrt(max(0.0, l1 * l1 - x * x))
	_aim(upper, lower, a + n * x + p * h)
	_aim(lower, end, a + n * d)

# ------------------------------------------------------------------ pose
func _process(dt):
	if bike == null or skel == null: return
	var st = bike.state
	var air = st == Bike.State.AIRBORNE
	_land = move_toward(_land, 0.0, dt * 2.2)
	var lean_in: float = bike.input.lean if bike.input else 0.0
	_lean_s = lerp(_lean_s, lean_in, clamp(dt * 8.0, 0.0, 1.0))
	_corner_s = lerp(_corner_s, clamp(bike.lean, -0.9, 0.9), clamp(dt * 6.0, 0.0, 1.0))
	crouch = lerp(crouch, clamp(_land + (0.35 if air else 0.0), 0.0, 1.0), clamp(dt * 9.0, 0.0, 1.0))
	if bike.spec.pedal or bike.input == null or bike.input.throttle > 0.05: _crank += bike.speed * dt * 1.6 if bike.spec.pedal else 0.0

	skel.reset_bone_poses()
	# ---- targets in rider (= bike) space; bike right = +X, back = +Z, up = +Y
	var standing = 0.0 if not bike.spec.pedal else 0.12
	var hip = seat + Vector3(0, 0.1 + standing - crouch * 0.16 - abs(_lean_s) * 0.05, 0.07 + _lean_s * 0.24)
	hip.x += -_corner_s * 0.12             # hang the hips off the inside a little
	var grip_l = bars + Vector3(-grip_w, 0, 0); var grip_r = bars + Vector3(grip_w, 0, 0)
	var ped = bb_offsets()
	var foot_l: Vector3 = ped[0]; var foot_r: Vector3 = ped[1]
	# ---- place the pelvis: move the whole model so the pelvis bone sits on the hip target
	if B.has("pelvis"):
		var pel_now = (global_transform.affine_inverse() * skel.global_transform) * _gpos(B["pelvis"])
		model.position += hip - pel_now
	# ---- torso: lean towards the bars, more when leaning forward, upright when leaning back
	if B.has("spine_01") and B.has("neck_01"):
		var chest = (grip_l + grip_r) * 0.5 + Vector3(-_corner_s * 0.18, 0.6 + _lean_s * 0.08 - crouch * 0.14, 0.2 + _lean_s * 0.16)
		_aim(B["spine_01"], B["neck_01"], _to_skel(chest))
	# ---- arms: elbows out and back, legs: knees forward and a touch out
	var sides = [["l", grip_l, foot_l, -1.0], ["r", grip_r, foot_r, 1.0]]
	for sd in sides:
		var s: String = sd[0]; var side: float = sd[3]
		if B.has("upperarm_" + s):
			var g: Vector3 = sd[1]
			var elbow_pole = g + Vector3(side * 0.35, -0.25, 0.45)
			_two_bone(B["upperarm_" + s], B["lowerarm_" + s], B["hand_" + s], _to_skel(g), _to_skel(elbow_pole))
		if B.has("thigh_" + s):
			var f: Vector3 = sd[2]
			var knee_pole = f + Vector3(side * 0.12, 0.4, -0.7)
			_two_bone(B["thigh_" + s], B["calf_" + s], B["foot_" + s], _to_skel(f + Vector3(0, 0.06, 0)), _to_skel(knee_pole))
	# ---- head: keep looking up the trail
	if B.has("Head") and B.has("neck_01"):
		var look = (grip_l + grip_r) * 0.5 + Vector3(0, 1.4, -4.0)
		_aim(B["neck_01"], B["Head"], _to_skel(look))

func bb_offsets() -> Array:
	# pedals: level in the attack position, turning when pedalling a pedal bike
	var r = 0.17 if bike.spec.pedal else 0.0
	var a = _crank if bike.spec.pedal and abs(bike.speed) > 0.5 and bike.input and bike.input.throttle > 0.05 else 0.0
	var l = bb + Vector3(-0.15, sin(a + PI) * r * 0.6, cos(a + PI) * r)
	var rr = bb + Vector3(0.15, sin(a) * r * 0.6, cos(a) * r)
	if a == 0.0: l = bb + Vector3(-0.15, 0, r); rr = bb + Vector3(0.15, 0, -r)   # level pedals, left foot back
	return [l, rr]
