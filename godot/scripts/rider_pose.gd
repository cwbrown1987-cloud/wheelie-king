class_name RiderPose extends Node3D
## Procedural rider (Milestone 2 placeholder body until the UBC rig is wired in): hips on the seat, hands on the
## bars, feet on the pegs, torso leaning into corners, crouching on landings and leaning back in wheelies.
## Reads bike state only; the rider's weight shift that affects physics comes from BikeInput.lean in Bike.
var bike: Bike
var seat = Vector3.ZERO; var bars = Vector3.ZERO; var pegs = Vector3.ZERO
var parts = {}
var crouch = 0.0
var _land_kick = 0.0

func setup(b: Bike, seat_p: Vector3, bar_p: Vector3, bb: Vector3):
	bike = b; seat = seat_p; bars = bar_p; pegs = bb + Vector3(0, 0.02, 0)
	var kit = StandardMaterial3D.new(); kit.albedo_color = Color(0.1, 0.45, 0.95); kit.roughness = 0.7
	var pants = StandardMaterial3D.new(); pants.albedo_color = Color(0.12, 0.13, 0.17); pants.roughness = 0.8
	var helmet = StandardMaterial3D.new(); helmet.albedo_color = Color(0.45, 0.95, 0.15); helmet.metallic = 0.3; helmet.roughness = 0.35
	for k in ["torso", "head", "arm_l", "arm_r", "leg_l", "leg_r"]:
		var mi = MeshInstance3D.new(); var cap = CapsuleMesh.new()
		match k:
			"torso": cap.radius = 0.17; cap.height = 0.62; mi.material_override = kit
			"head": var sp = SphereMesh.new(); sp.radius = 0.15; sp.height = 0.3; mi.mesh = sp; mi.material_override = helmet; add_child(mi); parts[k] = mi; continue
			"arm_l", "arm_r": cap.radius = 0.055; cap.height = 0.62; mi.material_override = kit
			_: cap.radius = 0.075; cap.height = 0.86; mi.material_override = pants
		mi.mesh = cap; add_child(mi); parts[k] = mi
	b.landed.connect(func(info): _land_kick = clamp(info.impact / 8.0, 0.2, 1.0))

func _place(mi: Node3D, a: Vector3, c: Vector3):
	mi.position = (a + c) * 0.5
	var dir = (c - a).normalized()
	if abs(dir.dot(Vector3.UP)) < 0.999: mi.basis = Basis(Quaternion(Vector3.UP, dir))
	else: mi.basis = Basis.IDENTITY
	var cap = mi.mesh
	if cap is CapsuleMesh: mi.scale = Vector3(1, max(0.3, a.distance_to(c) / max(0.01, cap.height)), 1)

func _process(dt):
	if bike == null: return
	_land_kick = move_toward(_land_kick, 0.0, dt * 2.5)
	var lean_in: float = bike.input.lean if bike.input else 0.0
	var standing = 0.25 if bike.state == Bike.State.AIRBORNE else (0.15 if bike.spec.pedal else 0.0)
	crouch = lerp(crouch, clamp(_land_kick + (0.3 if bike.state == Bike.State.AIRBORNE else 0.0), 0.0, 1.0), dt * 8.0)
	var hip = seat + Vector3(0, 0.08 + standing * 0.25 - crouch * 0.12, 0.06 + lean_in * 0.22)
	var corner: float = clamp(bike.lean * 0.35, -0.35, 0.35)  # rider hangs a little further into the turn
	hip.x += corner * 0.25
	var shoulder = hip + Vector3(corner * 0.3, 0.5 - crouch * 0.08, -0.32 - 0.12 * (1.0 - lean_in) + lean_in * 0.22)
	shoulder.y -= 0.12 * crouch
	var head = shoulder + Vector3(corner * 0.1, 0.22, -0.06)
	_place(parts.torso, hip, shoulder)
	parts.head.position = head
	for side in [-1.0, 1.0]:
		var hand = bars + Vector3(side * 0.3, 0, 0); var sh = shoulder + Vector3(side * 0.18, -0.04, 0)
		var elbow = (sh + hand) * 0.5 + Vector3(side * 0.08, -0.08 - crouch * 0.05, 0.05)
		_place(parts["arm_l" if side < 0 else "arm_r"], sh, hand)
		var foot = pegs + Vector3(side * 0.16, 0, 0); var hp = hip + Vector3(side * 0.11, -0.05, 0)
		_place(parts["leg_l" if side < 0 else "leg_r"], hp, foot)
