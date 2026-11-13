class_name BikeInput extends Node
## Player intent only (no physics here). Keyboard + touch write into these; the bike reads them.
var throttle = 0.0   # 0..1
var brake = 0.0      # 0..1
var steer = 0.0      # -1 (left) .. 1 (right)
var lean = 0.0       # -1 (forward) .. 1 (back): rider weight shift / air pitch
var trick_roll = 0.0 # -1..1 air roll (whips)
var hop = false
var touch_steer = 0.0
var touch_lean = 0.0
var touch_throttle = 0.0
var touch_brake = 0.0
var touch_hop = false
var scripted = false  # tests drive the fields directly

func _physics_process(_dt):
	if scripted: return
	var ks = Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left")
	if Input.is_key_pressed(KEY_D): ks += 1.0
	if Input.is_key_pressed(KEY_A): ks -= 1.0
	var kl = 0.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN): kl += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP): kl -= 1.0
	steer = clamp(ks + touch_steer, -1.0, 1.0)
	lean = clamp(kl + touch_lean, -1.0, 1.0)
	throttle = max(1.0 if Input.is_key_pressed(KEY_SHIFT) or Input.is_key_pressed(KEY_J) else 0.0, touch_throttle)
	brake = max(1.0 if Input.is_key_pressed(KEY_CTRL) or Input.is_key_pressed(KEY_K) else 0.0, touch_brake)
	hop = Input.is_key_pressed(KEY_SPACE) or touch_hop
	trick_roll = (1.0 if Input.is_key_pressed(KEY_E) else 0.0) - (1.0 if Input.is_key_pressed(KEY_Q) else 0.0)
