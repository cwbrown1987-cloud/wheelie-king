extends Node
## WHEELIE KING PHYSICS LAB — the one place every gameplay tuning value lives.
## Systems read Tune.v("key") each physics step, so slider changes apply live.
## Units: metres, seconds, radians, newtons; "x" = a multiplier, "0..1" = an assist strength.

signal changed(key: String)

# key: [default (Balanced), min, max, group, label, help]
const SCHEMA := {
	# steering
	"steer_sensitivity": [1.0, 0.3, 2.0, "Steering", "Steering sensitivity", "x on the bar input"],
	"steer_max_low": [0.62, 0.2, 0.9, "Steering", "Max steer, slow (rad)", "bar angle at walking pace"],
	"steer_max_high": [0.09, 0.02, 0.3, "Steering", "Max steer, fast (rad)", "bar angle at top speed"],
	"steer_rate": [5.0, 1.0, 14.0, "Steering", "Steering speed (rad/s)", "how fast the bars turn"],
	"countersteer": [0.6, 0.0, 1.0, "Steering", "Countersteer assist", "lean the bike into a turn before it turns"],
	"yaw_assist": [0.55, 0.0, 1.0, "Steering", "Turn assist", "help the bike follow its steering geometry"],
	# balance
	"lean_assist": [0.85, 0.0, 1.0, "Balance", "Lean assist", "lean to the angle the turn needs"],
	"lean_stiffness": [42.0, 5.0, 120.0, "Balance", "Lean stiffness", "how hard it holds the lean target"],
	"lean_damping": [9.0, 1.0, 30.0, "Balance", "Lean damping", "stops roll wobble"],
	"low_speed_balance": [1.0, 0.0, 1.0, "Balance", "Low-speed balance", "keeps it upright when slow"],
	"lean_max": [0.95, 0.4, 1.2, "Balance", "Max lean (rad)", "about 54 degrees"],
	"angular_damping": [0.6, 0.0, 3.0, "Balance", "Angular damping", "general calm"],
	# wheelies
	"weight_shift": [1.0, 0.0, 2.0, "Wheelies", "Rider weight shift", "x on lean back/forward torque"],
	"wheelie_damping": [0.35, 0.0, 1.0, "Wheelies", "Wheelie balance damping", "smooths tiny pitch wobbles (never holds it for you)"],
	"rear_brake_pitch": [1.0, 0.0, 2.0, "Wheelies", "Rear brake correction", "brake drops the front in a wheelie"],
	# tyres
	"grip": [1.0, 0.4, 1.6, "Tyres", "Grip", "x on tyre friction"],
	"slide_falloff": [0.75, 0.3, 1.0, "Tyres", "Slide grip", "grip left once sliding (progressive)"],
	"drift_assist": [0.5, 0.0, 1.0, "Tyres", "Drift assist", "holds and recovers rear slides"],
	"cornering_stiffness": [11.0, 3.0, 25.0, "Tyres", "Tyre stiffness", "how quickly a tyre bites sideways"],
	# air
	"air_pitch": [5.5, 0.0, 12.0, "Air", "Air pitch rate (rad/s)", "flip speed"],
	"air_yaw": [5.0, 0.0, 12.0, "Air", "Air spin rate (rad/s)", "spin speed"],
	"air_roll": [3.5, 0.0, 10.0, "Air", "Air roll rate (rad/s)", "whip/tilt speed"],
	"air_response": [6.0, 1.0, 20.0, "Air", "Air response", "how fast it reaches that rate"],
	"air_damping": [0.4, 0.0, 3.0, "Air", "Air damping", "slows rotation with no input"],
	# landings
	"landing_assist": [0.6, 0.0, 1.0, "Landings", "Landing correction", "lines the bike up with the slope"],
	"landing_lookahead": [1.2, 0.2, 3.0, "Landings", "Prediction range (s)", "how far ahead to look for the ground"],
	"landing_forgiveness": [0.55, 0.2, 1.2, "Landings", "Landing forgiveness (rad)", "how crooked a landing still rides away"],
	"crash_impact": [16.0, 6.0, 40.0, "Landings", "Crash impact (m/s)", "touchdown speed into the ground that crashes"],
	# suspension
	"sag": [0.3, 0.1, 0.5, "Suspension", "Sag", "spring sits this much into its travel"],
	"damping_ratio": [0.55, 0.1, 1.2, "Suspension", "Damping", "1 = no bounce"],
	"bump_stop": [3.0, 1.0, 8.0, "Suspension", "Bump stop", "end of travel stiffness"],
	# camera
	"cam_distance": [4.6, 2.0, 9.0, "Camera", "Follow distance", "metres behind"],
	"cam_height": [1.7, 0.5, 4.0, "Camera", "Follow height", "metres up"],
	"cam_pos_smooth": [7.0, 1.0, 20.0, "Camera", "Position smoothing", "higher = tighter"],
	"cam_rot_smooth": [6.0, 1.0, 20.0, "Camera", "Rotation smoothing", "higher = tighter"],
	"cam_fov": [62.0, 45.0, 80.0, "Camera", "FOV", "degrees at rest"],
	"cam_speed_fov": [14.0, 0.0, 30.0, "Camera", "Speed FOV", "extra degrees at top speed"],
	"cam_jump_zoom": [1.4, 0.0, 4.0, "Camera", "Jump pull-back", "metres back while airborne"],
	"cam_shake": [0.6, 0.0, 2.0, "Camera", "Landing shake", "x on impact shake"],
}

const PRESETS := {
	"Simulation": {"countersteer": 0.25, "yaw_assist": 0.15, "lean_assist": 0.6, "low_speed_balance": 0.6, "wheelie_damping": 0.1, "drift_assist": 0.15, "landing_assist": 0.15, "landing_forgiveness": 0.35, "air_pitch": 3.5, "air_yaw": 3.0, "air_roll": 2.0, "slide_falloff": 0.6},
	"Balanced": {},
	"Arcade": {"countersteer": 0.85, "yaw_assist": 0.85, "lean_assist": 1.0, "wheelie_damping": 0.55, "drift_assist": 0.8, "landing_assist": 0.9, "landing_forgiveness": 0.85, "air_pitch": 7.5, "air_yaw": 7.0, "air_roll": 5.0, "grip": 1.15, "crash_impact": 22.0},
}

var values = {}
var preset = "Balanced"
var mode_original = false  # "Original" handling: assists off, raw physics

func _ready():
	reset_defaults()
	load_user()

func v(key: String) -> float:
	var x: float = values.get(key, SCHEMA[key][0])
	if mode_original and ["countersteer", "yaw_assist", "drift_assist", "landing_assist", "wheelie_damping"].has(key):
		return 0.0
	return x

func set_value(key: String, x: float):
	values[key] = clamp(x, SCHEMA[key][1], SCHEMA[key][2]); preset = "Custom"; changed.emit(key)

func reset_defaults():
	values.clear()
	for k in SCHEMA: values[k] = SCHEMA[k][0]
	preset = "Balanced"; changed.emit("*")

func apply_preset(name: String):
	reset_defaults()
	for k in PRESETS.get(name, {}): values[k] = PRESETS[name][k]
	preset = name; changed.emit("*")

func to_json() -> String:
	return JSON.stringify({"preset": preset, "original": mode_original, "values": values}, "  ")

func from_json(text: String) -> bool:
	var d = JSON.parse_string(text)
	if typeof(d) != TYPE_DICTIONARY: return false
	for k in d.get("values", {}):
		if SCHEMA.has(k): values[k] = float(d.values[k])
	preset = d.get("preset", "Custom"); mode_original = bool(d.get("original", false)); changed.emit("*"); return true

func save_user():
	var f = FileAccess.open("user://physics_lab.json", FileAccess.WRITE)
	if f: f.store_string(to_json())

func load_user():
	if FileAccess.file_exists("user://physics_lab.json"):
		from_json(FileAccess.get_file_as_string("user://physics_lab.json"))
