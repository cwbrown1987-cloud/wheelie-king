class_name BikeSpec extends Resource
## The bike's real numbers, from its installed parts (same fields as the web game's bikeParams/stats).
## Everything the physics needs is derived here, so a BMX, an e-MTB and an e-moto stay genuinely different.

@export var name = "Bike"
@export var bike_kg = 25.0       # frame + parts + battery
@export var rider_kg = 75.0
@export var power_w = 750.0      # motor (pedal bikes: rider sprint power)
@export var torque_nm = 85.0     # at the wheel after gearing, low speed
@export var pedal = false
@export var wheelbase = 1.2
@export var wheel_r = 0.36
@export var travel_f = 0.15      # fork travel (m)
@export var travel_r = 0.14      # shock travel (m)
@export var damp = 0.5           # damper quality 0..1
@export var tyre_grip = 1.0      # tyre compound/tread
@export var brake = 1.0          # brake strength x
@export var com_height = 0.95    # bike+rider centre of mass above ground
@export var com_back = 0.45      # fraction of wheelbase behind the COM to the rear axle
@export var battery_wh = 500.0
@export var model = ""          # res://assets/bikes/<model>.glb (exported from the web garage)
@export var cda = 0.55          # drag area (m^2): rider + bike

func mass() -> float: return bike_kg + rider_kg
func vmax() -> float: return 8.5 if pedal else min(22.0, 6.0 + sqrt(power_w) * 0.35)
func drive_force(v: float) -> float:
	# traction-limited at low speed (torque), power-limited above, fading to zero at vmax
	var f_t = torque_nm / wheel_r
	var f_p = power_w / max(v, 0.5)
	var fade: float = clamp((vmax() - v) / (vmax() * 0.12), 0.0, 1.0)
	return min(f_t, f_p) * fade
func pitch_inertia() -> float: return mass() * (0.25 * wheelbase * wheelbase + 0.35 * com_height * com_height) * 0.55
func roll_inertia() -> float: return mass() * com_height * com_height * 0.45
func yaw_inertia() -> float: return mass() * wheelbase * wheelbase * 0.18

static func from_dict(d: Dictionary) -> BikeSpec:
	var s = BikeSpec.new()
	for k in d: if k in s: s.set(k, d[k])
	return s

static func presets() -> Dictionary:
	# Representative garage builds (BMX, e-MTB, Outback 125-class e-moto). Replace with exported garage builds.
	return {
		"BMX": from_dict({"name": "BMX", "model": "bmx", "bike_kg": 11.0, "power_w": 600.0, "torque_nm": 45.0, "pedal": true, "wheelbase": 1.0, "wheel_r": 0.254, "travel_f": 0.02, "travel_r": 0.01, "damp": 0.2, "tyre_grip": 1.0, "com_height": 0.9, "com_back": 0.42, "battery_wh": 0.0}),
		"E-MTB": from_dict({"name": "E-MTB", "bike_kg": 25.0, "power_w": 1500.0, "torque_nm": 150.0, "wheelbase": 1.21, "wheel_r": 0.355, "model": "mtb_fs", "travel_f": 0.16, "travel_r": 0.15, "damp": 0.6, "tyre_grip": 1.05, "com_height": 0.98, "com_back": 0.46, "battery_wh": 625.0}),
		"E-Moto": from_dict({"name": "E-Moto", "model": "trax_lime", "bike_kg": 68.0, "power_w": 7500.0, "torque_nm": 300.0, "wheelbase": 1.25, "wheel_r": 0.36, "travel_f": 0.2, "travel_r": 0.18, "damp": 0.7, "tyre_grip": 1.15, "brake": 1.3, "com_height": 0.92, "com_back": 0.47, "battery_wh": 2000.0}),
	}
