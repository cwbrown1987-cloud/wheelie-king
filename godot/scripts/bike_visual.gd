class_name BikeVisual extends Node3D
## Draws the bike from its spec and READS the physics state (never changes it):
## wheels sit at the real suspension compression, the front wheel and bars turn by the real steer angle.
var bike: Bike
var wheels = [Node3D.new(), Node3D.new()]
var fork = Node3D.new()
var rider: RiderPose

func setup(b: Bike):
	bike = b
	var s = b.spec
	var frame_mat = StandardMaterial3D.new(); frame_mat.albedo_color = Color(0.1, 0.75, 0.25); frame_mat.metallic = 0.6; frame_mat.roughness = 0.35
	var dark = StandardMaterial3D.new(); dark.albedo_color = Color(0.08, 0.08, 0.09); dark.roughness = 0.6
	var tyre = StandardMaterial3D.new(); tyre.albedo_color = Color(0.05, 0.05, 0.05); tyre.roughness = 0.95
	var rim = StandardMaterial3D.new(); rim.albedo_color = Color(0.85, 0.85, 0.9); rim.metallic = 0.9; rim.roughness = 0.25
	for w in 2:
		var wn: Node3D = wheels[w]; add_child(wn)
		var t = MeshInstance3D.new(); var tm = TorusMesh.new(); tm.inner_radius = s.wheel_r * 0.78; tm.outer_radius = s.wheel_r; tm.rings = 32; tm.ring_segments = 10
		t.mesh = tm; t.material_override = tyre; t.rotation.z = PI / 2.0; wn.add_child(t)
		var r = MeshInstance3D.new(); var rm = CylinderMesh.new(); rm.top_radius = s.wheel_r * 0.8; rm.bottom_radius = s.wheel_r * 0.8; rm.height = 0.03; rm.radial_segments = 24
		r.mesh = rm; r.material_override = rim; r.rotation.z = PI / 2.0; r.transparency = 0.55; wn.add_child(r)
		var hub = MeshInstance3D.new(); var hm = CylinderMesh.new(); hm.top_radius = 0.05 if not s.pedal else 0.03; hm.bottom_radius = hm.top_radius; hm.height = 0.12; hub.mesh = hm; hub.material_override = dark; hub.rotation.z = PI / 2.0; wn.add_child(hub)
	add_child(fork)
	# frame: simple tubes between key points (relative to COM)
	var rear_ax = Vector3(0, s.wheel_r - s.com_height, s.wheelbase * s.com_back)
	var front_ax = Vector3(0, s.wheel_r - s.com_height, -s.wheelbase * (1.0 - s.com_back))
	var bb = Vector3(0, rear_ax.y + 0.05, rear_ax.z - s.wheelbase * 0.38)
	var seat = Vector3(0, rear_ax.y + s.wheel_r + 0.45, rear_ax.z - s.wheelbase * 0.3)
	var head = Vector3(0, front_ax.y + s.wheel_r + 0.35, front_ax.z + 0.18)
	for pair in [[rear_ax, bb], [bb, seat], [seat, head], [bb, head], [rear_ax, seat]]:
		_tube(pair[0], pair[1], 0.03 if s.pedal else 0.045, frame_mat, self)
	if not s.pedal:  # motor + battery block
		var blk = MeshInstance3D.new(); var bm = BoxMesh.new(); bm.size = Vector3(0.22, 0.3, 0.45); blk.mesh = bm; blk.material_override = dark; blk.position = (bb + head) * 0.5 + Vector3(0, -0.05, 0); add_child(blk)
	var sm = MeshInstance3D.new(); var sbm = BoxMesh.new(); sbm.size = Vector3(0.14, 0.05, 0.28); sm.mesh = sbm; sm.material_override = dark; sm.position = seat + Vector3(0, 0.03, 0); add_child(sm)
	fork.position = head
	_tube(Vector3.ZERO, front_ax - head, 0.025, rim, fork)
	var bar = MeshInstance3D.new(); var cb = CylinderMesh.new(); cb.top_radius = 0.016; cb.bottom_radius = 0.016; cb.height = 0.7 if not s.pedal else 0.6; bar.mesh = cb; bar.material_override = dark; bar.rotation.z = PI / 2.0; bar.position = Vector3(0, 0.12, 0.05); fork.add_child(bar)
	rider = RiderPose.new(); add_child(rider); rider.setup(b, seat, head + Vector3(0, 0.12, 0.05), bb)

func _tube(a: Vector3, b: Vector3, r: float, m: Material, parent: Node3D):
	var mi = MeshInstance3D.new(); var cm = CylinderMesh.new(); cm.top_radius = r; cm.bottom_radius = r; cm.height = a.distance_to(b); cm.radial_segments = 10
	mi.mesh = cm; mi.material_override = m; parent.add_child(mi)
	mi.position = (a + b) * 0.5
	var dir = (b - a).normalized()
	if abs(dir.dot(Vector3.UP)) < 0.999: mi.basis = Basis(Quaternion(Vector3.UP, dir))

func _process(_dt):
	if bike == null: return
	var s = bike.spec
	for w in 2:
		var top: Vector3 = bike._mount[w]
		var y: float = top.y - (bike._travel[w] - bike.compression[w])
		var wn: Node3D = wheels[w]
		wn.position = Vector3(0, y, top.z)
		# steer about Y first, then spin about the wheel's own axle
		wn.basis = Basis(Vector3.UP, -bike.steer if w == 1 else 0.0) * Basis(Vector3.RIGHT, -bike.wheel_spin[w])
	fork.rotation.y = -bike.steer
