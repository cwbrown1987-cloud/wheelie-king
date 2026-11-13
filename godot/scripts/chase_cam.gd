class_name ChaseCam extends Camera3D
## Cinematic chase camera (Milestone 4). Reads the interpolated bike transform (physics interpolation is on),
## smooths position and rotation separately, looks ahead along velocity, widens FOV with speed, pulls back in the
## air while keeping the predicted landing in frame, dips and shakes a little on landings (scaled by impact).
var bike: Bike
var mode = 0       # 0 chase, 1 close chase, 2 side-on, 3 handlebar
var side_dist = 8.5
var _pos = Vector3.ZERO
var _look = Vector3.ZERO
var _shake = 0.0
var _dip = 0.0
var _yaw_dir = Vector3.FORWARD

func attach(b: Bike):
	bike = b
	b.landed.connect(func(info): _shake = clamp(info.impact / 10.0, 0.0, 1.0) * Tune.v("cam_shake"); _dip = clamp(info.impact / 12.0, 0.0, 0.5))
	_pos = b.global_position + Vector3(0, 2, 4); _look = b.global_position

func _process(dt):
	if bike == null: return
	var t = bike.get_global_transform_interpolated()
	var p = t.origin
	var v = bike.linear_velocity
	var flat_v = Vector3(v.x, 0, v.z)
	var fwd = -t.basis.z; fwd.y = 0; fwd = fwd.normalized()
	# heading follows velocity when moving, the bike when slow (so it doesn't swing around at standstill)
	var vel_dir = flat_v.normalized() if flat_v.length() > 2.0 else fwd
	_yaw_dir = _yaw_dir.slerp(vel_dir.lerp(fwd, 0.35).normalized(), clamp(dt * Tune.v("cam_rot_smooth") * 0.5, 0.0, 1.0)).normalized()
	var spd: float = flat_v.length(); var vm: float = bike.spec.vmax()
	var air: bool = bike.state == Bike.State.AIRBORNE
	var dist: float = Tune.v("cam_distance") + spd / vm * 1.2 + (Tune.v("cam_jump_zoom") if air else 0.0)
	var hgt: float = Tune.v("cam_height") + (0.6 if air else 0.0)
	var desired: Vector3; var look: Vector3
	match mode:
		1: dist *= 0.6; hgt *= 0.75; desired = p - _yaw_dir * dist + Vector3.UP * hgt; look = p + _yaw_dir * 3.0 + Vector3.UP * 0.6
		2:
			var side = _yaw_dir.cross(Vector3.UP).normalized()
			desired = p + side * side_dist + Vector3.UP * (side_dist * 0.19) + _yaw_dir * (side_dist * 0.18); look = p + _yaw_dir * (side_dist * 0.18) + Vector3.UP * 0.1
		3: desired = t * Vector3(0, 0.75, -0.25); look = t * Vector3(0, 0.6, -8.0)
		_:
			desired = p - _yaw_dir * dist + Vector3.UP * hgt
			look = p + _yaw_dir * (2.5 + spd * 0.25) + Vector3.UP * 0.7
			if air and not bike.predicted_landing.is_empty(): look = look.lerp(bike.predicted_landing.point, 0.25)
	# don't go under the ground
	var ter = get_tree().get_first_node_in_group("terrain")
	if ter: desired.y = max(desired.y, ter.height(desired.x, desired.z) + 0.6)
	var k: float = 1.0 - exp(-Tune.v("cam_pos_smooth") * dt)
	_pos = desired if mode == 3 else _pos.lerp(desired, k)
	_look = look if mode == 3 else _look.lerp(look, 1.0 - exp(-Tune.v("cam_rot_smooth") * dt))
	_dip = move_toward(_dip, 0.0, dt * 1.5); _shake = move_toward(_shake, 0.0, dt * 3.0)
	var jitter = Vector3(randf() - 0.5, randf() - 0.5, 0) * _shake * 0.12
	global_position = _pos + Vector3(0, -_dip, 0) + jitter
	if global_position.distance_to(_look) > 0.01: look_at(_look, Vector3.UP)
	fov = lerp(fov, Tune.v("cam_fov") + Tune.v("cam_speed_fov") * clamp(spd / vm, 0.0, 1.0), clamp(dt * 3.0, 0.0, 1.0))
