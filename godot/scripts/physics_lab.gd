class_name PhysicsLab extends PanelContainer
## WHEELIE KING PHYSICS LAB (Milestone 1 tool): every value in Tune.SCHEMA becomes a live slider, grouped.
## Presets (Simulation / Balanced / Arcade), Original handling toggle, bike picker, live telemetry,
## save (user://physics_lab.json), reset, export/import JSON via the clipboard.
signal bike_chosen(name: String)
signal respawn()
var bike: Bike
var _rows = {}          # key -> [HSlider, Label]
var _preset: OptionButton
var _original: CheckButton
var _bike_pick: OptionButton
var _telemetry: Label
var _quiet = false

func _ready():
	custom_minimum_size = Vector2(380, 0)
	var sb = StyleBoxFlat.new(); sb.bg_color = Color(0.06, 0.07, 0.09, 0.9); sb.set_corner_radius_all(14); sb.set_content_margin_all(12)
	add_theme_stylebox_override("panel", sb)
	var root = VBoxContainer.new(); root.add_theme_constant_override("separation", 6); add_child(root)
	var title = Label.new(); title.text = "PHYSICS LAB"; title.add_theme_font_size_override("font_size", 22); root.add_child(title)
	var top = HBoxContainer.new(); root.add_child(top)
	_bike_pick = OptionButton.new(); for n in BikeSpec.presets(): _bike_pick.add_item(n)
	_bike_pick.item_selected.connect(func(i): bike_chosen.emit(_bike_pick.get_item_text(i)))
	top.add_child(_bike_pick)
	_preset = OptionButton.new(); for n in ["Simulation", "Balanced", "Arcade", "Custom"]: _preset.add_item(n)
	_preset.item_selected.connect(func(i):
		var n = _preset.get_item_text(i)
		if n != "Custom": Tune.apply_preset(n))
	top.add_child(_preset)
	_original = CheckButton.new(); _original.text = "Original handling"; _original.tooltip_text = "assists off: raw tyre + suspension physics"
	_original.toggled.connect(func(on): Tune.mode_original = on; Tune.changed.emit("*"))
	root.add_child(_original)
	_telemetry = Label.new(); _telemetry.add_theme_font_size_override("font_size", 13); _telemetry.add_theme_color_override("font_color", Color(0.6, 1.0, 0.7)); root.add_child(_telemetry)
	var scroll = ScrollContainer.new(); scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL; scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root.add_child(scroll)
	var list = VBoxContainer.new(); list.size_flags_horizontal = Control.SIZE_EXPAND_FILL; scroll.add_child(list)
	var group = ""
	for k in Tune.SCHEMA:
		var d: Array = Tune.SCHEMA[k]
		if d[3] != group:
			group = d[3]
			var gl = Label.new(); gl.text = group.to_upper(); gl.add_theme_color_override("font_color", Color(1.0, 0.8, 0.3)); gl.add_theme_font_size_override("font_size", 15); list.add_child(gl)
		var row = VBoxContainer.new(); row.tooltip_text = d[5]; list.add_child(row)
		var head = HBoxContainer.new(); row.add_child(head)
		var name = Label.new(); name.text = d[4]; name.size_flags_horizontal = Control.SIZE_EXPAND_FILL; name.add_theme_font_size_override("font_size", 13); head.add_child(name)
		var val = Label.new(); val.add_theme_font_size_override("font_size", 13); head.add_child(val)
		var sl = HSlider.new(); sl.min_value = d[1]; sl.max_value = d[2]; sl.step = (d[2] - d[1]) / 200.0; sl.custom_minimum_size = Vector2(0, 26)
		sl.value_changed.connect(func(x): if not _quiet: Tune.set_value(k, x))
		row.add_child(sl)
		_rows[k] = [sl, val]
	var btns = HBoxContainer.new(); root.add_child(btns)
	for b in [["Save", func(): Tune.save_user()], ["Reset", func(): Tune.reset_defaults()], ["Export", func(): DisplayServer.clipboard_set(Tune.to_json())],
			["Import", func(): Tune.from_json(DisplayServer.clipboard_get())], ["Respawn", func(): respawn.emit()]]:
		var bt = Button.new(); bt.text = b[0]; bt.pressed.connect(b[1]); bt.focus_mode = Control.FOCUS_NONE; btns.add_child(bt)
	Tune.changed.connect(func(_k): _refresh())
	_refresh()

func select_bike(n: String):
	for i in _bike_pick.item_count: if _bike_pick.get_item_text(i) == n: _bike_pick.select(i)

func _refresh():
	_quiet = true
	for k in _rows:
		var x: float = Tune.values.get(k, Tune.SCHEMA[k][0])
		_rows[k][0].value = x; _rows[k][1].text = ("%.2f" % x)
	for i in _preset.item_count: if _preset.get_item_text(i) == Tune.preset: _preset.select(i)
	_original.set_pressed_no_signal(Tune.mode_original)
	_quiet = false

func _process(_dt):
	if bike == null or not visible: return
	var st: String = ["GROUNDED", "AIRBORNE", "LANDING", "CRASH", "RECOVERY"][bike.state]
	var t = "%s  %.1f km/h  lean %+.0f°  pitch %+.0f°\nsteer %+.0f°  slip R %+.0f° F %+.0f°  susp R %.0f%% F %.0f%%" % [st, bike.speed * 3.6, rad_to_deg(bike.lean), rad_to_deg(bike.pitch),
		rad_to_deg(bike.steer), rad_to_deg(bike.slip[0]), rad_to_deg(bike.slip[1]), bike.compression[0] / bike._travel[0] * 100.0, bike.compression[1] / bike._travel[1] * 100.0]
	if bike.drifting: t += "  DRIFT"
	if bike.wheelie: t += "  WHEELIE"
	if not bike.last_landing.is_empty(): t += "\nlast landing: %.1f m/s, %.0f° off%s" % [bike.last_landing.impact, rad_to_deg(bike.last_landing.error), " CLEAN" if bike.last_landing.clean else ""]
	_telemetry.text = t
