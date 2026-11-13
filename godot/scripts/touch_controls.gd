class_name TouchControls extends Control
## Phone/iPad controls, same layout as the web game:
##   left half  : floating stick, appears where the thumb lands (x = steer, y = lean back/forward)
##   right side : GAS (big), BRAKE, HOP buttons
## Writes into BikeInput's touch_* fields only.
var input: BikeInput
var _stick_id = -1
var _stick_origin = Vector2.ZERO
var _stick_pos = Vector2.ZERO
var _buttons = {}      # name -> Rect2
var _pressed = {}      # touch index -> button name
const STICK_R := 90.0

func _ready():
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)   # fill the screen (set_anchors_preset alone left it 0x0)
	resized.connect(_layout)
	get_viewport().size_changed.connect(_layout)
	_layout.call_deferred()

func _layout():
	var s = size if size.x > 10.0 else get_viewport_rect().size
	if size.x < 10.0: size = s
	var u: float = clamp(min(s.x, s.y) / 6.0, 70.0, 140.0)
	_buttons = {
		"gas": Rect2(s.x - u * 1.5 - 24, s.y - u * 1.5 - 24, u * 1.5, u * 1.5),
		"brake": Rect2(s.x - u * 2.8 - 40, s.y - u * 1.05 - 24, u * 1.05, u * 1.05),
		"hop": Rect2(s.x - u * 1.25 - 24, s.y - u * 2.6 - 40, u * 1.0, u * 0.8),
	}
	queue_redraw()

func _btn_at(p: Vector2) -> String:
	for k in _buttons: if _buttons[k].grow(14).has_point(p): return k
	return ""

func _input(e):
	if input == null: return
	if e is InputEventScreenTouch:
		if e.pressed:
			var b = _btn_at(e.position)
			if b != "": _pressed[e.index] = b
			elif e.position.x < get_viewport_rect().size.x * 0.55 and _stick_id == -1:
				_stick_id = e.index; _stick_origin = e.position; _stick_pos = e.position
		else:
			if e.index == _stick_id: _stick_id = -1
			_pressed.erase(e.index)
		_apply(); queue_redraw()
	elif e is InputEventScreenDrag:
		if e.index == _stick_id:
			_stick_pos = e.position
			var d: Vector2 = _stick_pos - _stick_origin
			if d.length() > STICK_R * 1.6: _stick_origin = _stick_pos - d.normalized() * STICK_R * 1.6   # stick follows a drifting thumb
		elif _pressed.has(e.index):
			var b = _btn_at(e.position)   # slide between gas and brake without lifting
			if b != "": _pressed[e.index] = b
		_apply(); queue_redraw()

static func curve(x: float, p: float) -> float:
	return sign(x) * pow(abs(x), p)

func _apply():
	var d = Vector2.ZERO
	if _stick_id != -1: d = ((_stick_pos - _stick_origin) / STICK_R).limit_length(1.0)
	var dz = 0.08
	input.touch_steer = curve(max(0.0, abs(d.x) - dz) / (1.0 - dz) * sign(d.x), 1.55)
	input.touch_lean = curve(max(0.0, abs(d.y) - dz) / (1.0 - dz) * sign(d.y), 1.3)   # drag down = lean back
	var vals = _pressed.values()
	input.touch_throttle = 1.0 if vals.has("gas") else 0.0
	input.touch_brake = 1.0 if vals.has("brake") else 0.0
	input.touch_hop = vals.has("hop")

func _draw():
	var font = get_theme_default_font()
	var vals = _pressed.values()
	for k in _buttons:
		var r: Rect2 = _buttons[k]; var on: bool = vals.has(k)
		var c = Color(0.2, 0.9, 0.35) if k == "gas" else (Color(0.95, 0.3, 0.25) if k == "brake" else Color(0.95, 0.8, 0.2))
		draw_circle(r.get_center(), r.size.x * 0.5, Color(c, 0.55 if on else 0.22))
		draw_arc(r.get_center(), r.size.x * 0.5, 0, TAU, 48, Color(1, 1, 1, 0.6), 3.0, true)
		var label: String = k.to_upper()
		var fs = int(r.size.x * 0.2)
		var w = font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
		draw_string(font, r.get_center() + Vector2(-w * 0.5, fs * 0.35), label, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 1, 1, 0.9))
	if _stick_id == -1:
		# resting stick so you can see where steering lives (it jumps to wherever your thumb lands on the left side)
		var home = Vector2(STICK_R + 50, size.y - STICK_R - 50)
		draw_circle(home, STICK_R, Color(1, 1, 1, 0.10))
		draw_arc(home, STICK_R, 0, TAU, 48, Color(1, 1, 1, 0.45), 3.0, true)
		draw_circle(home, STICK_R * 0.42, Color(1, 1, 1, 0.35))
		for a in [0.0, PI * 0.5, PI, PI * 1.5]:
			var d = Vector2.from_angle(a); var tip = home + d * (STICK_R - 10); var sd = d.orthogonal() * 9
			draw_colored_polygon(PackedVector2Array([tip, tip - d * 14 + sd, tip - d * 14 - sd]), Color(1, 1, 1, 0.55))
		var fs2 = 18; var lab = "STEER  ·  LEAN"
		var lw = font.get_string_size(lab, HORIZONTAL_ALIGNMENT_LEFT, -1, fs2).x
		draw_string(font, home + Vector2(-lw * 0.5, -STICK_R - 14), lab, HORIZONTAL_ALIGNMENT_LEFT, -1, fs2, Color(1, 1, 1, 0.75))
	if _stick_id != -1:
		draw_circle(_stick_origin, STICK_R, Color(1, 1, 1, 0.12))
		draw_arc(_stick_origin, STICK_R, 0, TAU, 48, Color(1, 1, 1, 0.5), 2.0, true)
		var knob = _stick_origin + (_stick_pos - _stick_origin).limit_length(STICK_R)
		draw_circle(knob, STICK_R * 0.42, Color(1, 1, 1, 0.55))
