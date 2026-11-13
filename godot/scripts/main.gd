extends Node3D
## Wheelie King (Godot remake) — test hillside. Builds the world, bike, camera and UI in code so the scene file stays tiny.
var terrain: TrailTerrain
var bike: Bike
var input: BikeInput
var visual: BikeVisual
var cam: ChaseCam
var lab: PhysicsLab
var touch: TouchControls
var hud: Label
var popup: Label
var _popup_t = 0.0
var bike_name = "E-MTB"
var renderer = ""

func _ready():
	renderer = str(RenderingServer.get_current_rendering_method())
	if renderer != "forward_plus":
		get_viewport().scaling_3d_scale = 0.85   # phones/tablets: render 3D a touch lower, UI stays sharp
	_environment()
	terrain = TrailTerrain.new(); terrain.name = "Terrain"; terrain.add_to_group("terrain"); add_child(terrain)
	var sc = Scenery.new(); sc.name = "Scenery"; add_child(sc); sc.build(terrain, 1.0 if renderer == "forward_plus" else 0.6)
	_trail_props()
	input = BikeInput.new(); input.name = "Input"; add_child(input)
	_spawn_bike(bike_name)
	cam = ChaseCam.new(); cam.name = "Cam"; add_child(cam); cam.current = true; cam.far = 900.0; cam.attach(bike)
	_ui()

func _spawn_bike(n: String):
	var t = terrain.start_transform()
	if bike: t = bike.last_safe; bike.queue_free(); remove_child(bike)
	bike_name = n
	bike = Bike.new(); bike.name = "Bike"; bike.spec = BikeSpec.presets()[n]; bike.input = input
	bike.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_ON
	add_child(bike); bike.reset_to(t)
	visual = BikeVisual.new(); bike.add_child(visual); visual.setup(bike)
	bike.landed.connect(_on_landed); bike.crashed.connect(func(why): _show(why.to_upper(), Color(1, 0.4, 0.3)))
	if cam: cam.attach(bike)
	if lab: lab.bike = bike; lab.select_bike(n)

func _environment():
	var env = Environment.new()
	var sky = Sky.new(); var sm = ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.32, 0.5, 0.82); sm.sky_horizon_color = Color(1.0, 0.72, 0.48); sm.sky_curve = 0.12
	sm.ground_horizon_color = Color(0.85, 0.65, 0.5); sm.ground_bottom_color = Color(0.2, 0.22, 0.2)
	sm.sun_angle_max = 18.0; sm.sun_curve = 0.08
	sky.sky_material = sm; env.sky = sky; env.background_mode = Environment.BG_SKY
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY; env.ambient_light_energy = 0.9
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES; env.tonemap_exposure = 1.05; env.tonemap_white = 6.0
	env.glow_enabled = true; env.glow_intensity = 0.6; env.glow_bloom = 0.08; env.glow_hdr_threshold = 1.1
	env.fog_enabled = true; env.fog_light_color = Color(1.0, 0.78, 0.6); env.fog_density = 0.0035; env.fog_sky_affect = 0.25
	env.fog_aerial_perspective = 0.35
	env.adjustment_enabled = true; env.adjustment_saturation = 1.12; env.adjustment_contrast = 1.06
	if renderer == "forward_plus":
		env.ssao_enabled = true; env.ssao_radius = 1.2; env.ssao_intensity = 1.6
		env.sdfgi_enabled = true; env.sdfgi_use_occlusion = true; env.sdfgi_energy = 0.9
		env.volumetric_fog_enabled = true; env.volumetric_fog_density = 0.006; env.volumetric_fog_albedo = Color(1.0, 0.85, 0.7); env.volumetric_fog_anisotropy = 0.6
	var we = WorldEnvironment.new(); we.environment = env; add_child(we)
	var sun = DirectionalLight3D.new(); sun.name = "Sun"
	sun.rotation = Vector3(deg_to_rad(-16), deg_to_rad(205), 0)   # low evening sun, from up the hill so the trail is side-lit
	sun.light_color = Color(1.0, 0.82, 0.62); sun.light_energy = 1.6; sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 120.0 if renderer != "gl_compatibility" else 60.0
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS if renderer == "forward_plus" else DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	add_child(sun)

func _trail_props():
	# timber edges on the jumps so the take-offs read clearly, and start/finish arches
	var wood = StandardMaterial3D.new(); wood.albedo_color = Color(0.55, 0.36, 0.2); wood.roughness = 0.85
	for f in terrain.features:
		if f.kind != "kicker": continue
		for side in [-1.0, 1.0]:
			var a: Dictionary = terrain.trail_at(f.s0 + 5.5)
			var right = Vector3(-a.dir.y, 0, a.dir.x) * side
			var p = Vector3(a.x, terrain.height(a.x, a.z), a.z) + right * (terrain.trail_width * 0.5 + 0.3)
			var post = MeshInstance3D.new(); var bm = BoxMesh.new(); bm.size = Vector3(0.18, 1.4, 0.18); post.mesh = bm; post.material_override = wood
			post.position = p + Vector3(0, 0.5, 0); add_child(post)
			var flag = MeshInstance3D.new(); var fm = BoxMesh.new(); fm.size = Vector3(0.05, 0.35, 0.5); flag.mesh = fm
			var fmat = StandardMaterial3D.new(); fmat.albedo_color = Color(1.0, 0.55, 0.1); fmat.emission_enabled = true; fmat.emission = Color(1.0, 0.45, 0.05); fmat.emission_energy_multiplier = 0.4
			flag.material_override = fmat; flag.position = p + Vector3(0, 1.1, 0) - Vector3(a.dir.x, 0, a.dir.y) * 0.25; add_child(flag)

func _ui():
	var layer = CanvasLayer.new(); add_child(layer)
	touch = TouchControls.new(); touch.input = input; layer.add_child(touch)
	hud = Label.new(); hud.position = Vector2(18, 14); hud.add_theme_font_size_override("font_size", 26)
	hud.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8)); hud.add_theme_constant_override("outline_size", 6); layer.add_child(hud)
	popup = Label.new(); popup.set_anchors_preset(Control.PRESET_CENTER_TOP); popup.position.y = 70; popup.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	popup.add_theme_font_size_override("font_size", 40); popup.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85)); popup.add_theme_constant_override("outline_size", 8)
	popup.grow_horizontal = Control.GROW_DIRECTION_BOTH; layer.add_child(popup)
	var bar = HBoxContainer.new(); bar.set_anchors_preset(Control.PRESET_TOP_RIGHT); bar.position = Vector2(-300, 12); bar.grow_horizontal = Control.GROW_DIRECTION_BEGIN; layer.add_child(bar)
	for b in [["CAM", func(): cam.mode = (cam.mode + 1) % 4], ["RESET", func(): _respawn()], ["LAB", func(): lab.visible = not lab.visible]]:
		var bt = Button.new(); bt.text = b[0]; bt.focus_mode = Control.FOCUS_NONE; bt.custom_minimum_size = Vector2(86, 52); bt.add_theme_font_size_override("font_size", 20); bt.pressed.connect(b[1]); bar.add_child(bt)
	lab = PhysicsLab.new(); lab.visible = false; lab.bike = bike
	lab.set_anchors_preset(Control.PRESET_LEFT_WIDE); lab.offset_top = 70; lab.offset_bottom = -20; lab.offset_left = 12; lab.offset_right = 400
	lab.bike_chosen.connect(func(n): _spawn_bike(n)); lab.respawn.connect(_respawn)
	layer.add_child(lab); lab.select_bike(bike_name)

func _respawn():
	bike.reset_to(terrain.start_transform())

func _show(text: String, col := Color(1, 0.9, 0.3)):
	popup.text = text; popup.add_theme_color_override("font_color", col); _popup_t = 1.8

func _on_landed(info: Dictionary):
	var r: Vector3 = info.rotation
	var flips = int(round(abs(r.x) / TAU)); var spin = int(round(abs(r.y) / PI)) * 180
	var parts = []
	if flips > 0: parts.append(("%dx " % flips if flips > 1 else "") + ("BACKFLIP" if r.x > 0 else "FRONTFLIP"))
	if spin >= 180: parts.append("%d" % spin)
	if abs(r.z) > 0.6: parts.append("WHIP")
	if info.air > 0.7 and parts.is_empty(): parts.append("BIG AIR %.1fs" % info.air)
	if parts.is_empty(): return
	_show(" + ".join(parts) + ("  CLEAN!" if info.clean else ""), Color(0.5, 1, 0.6) if info.clean else Color(1, 0.9, 0.3))

func _unhandled_key_input(e):
	if e.pressed and not e.echo:
		match e.keycode:
			KEY_C: cam.mode = (cam.mode + 1) % 4
			KEY_R: _respawn()
			KEY_TAB, KEY_L: lab.visible = not lab.visible

var _finish_t = -1.0
func _check_finish(dt):
	var endp = terrain.trail_pts[-1]
	if _finish_t < 0.0 and Vector2(bike.global_position.x - endp.x, bike.global_position.z - endp.z).length() < 6.0:
		_finish_t = 2.0; _show("FINISH!", Color(0.5, 1, 0.6))
	if _finish_t >= 0.0:
		_finish_t -= dt
		if _finish_t < 0.0: _respawn()

func _process(dt):
	if bike and terrain: _check_finish(dt)
	_popup_t -= dt
	popup.modulate.a = clamp(_popup_t * 2.0, 0.0, 1.0)
	if bike: hud.text = "%d km/h   %s   %d fps" % [int(abs(bike.speed) * 3.6), bike_name, Engine.get_frames_per_second()]
