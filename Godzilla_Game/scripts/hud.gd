extends CanvasLayer

var cacao = 0
var vida = 3
var gemas = 0
var switches = 0

var lbl_cacao: Label
var hbox_vida: HBoxContainer
var lbl_gemas: Label
var lbl_switches: Label
var notif_label: Label
var notif_timer = 0.0

var tex_cacao: Texture2D
var tex_heart: Texture2D
var tex_gem: Texture2D
var tex_altar: Texture2D

func load_external_tex(file_name: String) -> Texture2D:
	var path = "res://textures/" + file_name
	var real_path = ProjectSettings.globalize_path(path)
	if FileAccess.file_exists(real_path):
		var img = Image.load_from_file(real_path)
		if img:
			return ImageTexture.create_from_image(img)
	return null

func _ready():
	tex_cacao = load_external_tex("hud_icon_cacao_1779135541595.jpg")
	tex_heart = load_external_tex("hud_icon_heart_1779135554723.jpg")
	tex_gem = load_external_tex("hud_icon_gem_1779135567623.jpg")
	tex_altar = load_external_tex("hud_icon_altar_1779135579283.jpg")

	var root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE # CRÍTICO: No bloquear el mouse de la cámara
	add_child(root)
	
	# ESTILO PS2: HUD FLOTANTE, LIMPIO Y MINIMALISTA (Sin caja de fondo gigante)
	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 35)
	margin.add_theme_constant_override("margin_top", 35)
	margin.set_anchors_preset(Control.PRESET_TOP_LEFT)
	root.add_child(margin)
	
	var vbox = VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6) # Elementos más agrupados
	margin.add_child(vbox)
	
	# Cacao Row (Tonos oro antiguo)
	lbl_cacao = _make_row(vbox, tex_cacao, " x 0", Color(0.9, 0.75, 0.3))
	
	# Vida Row
	hbox_vida = HBoxContainer.new()
	hbox_vida.add_theme_constant_override("separation", 8)
	_actualizar_corazones_ui()
	vbox.add_child(hbox_vida)
	
	# Pesos Row (Oro/Plata para el camión)
	lbl_gemas = _make_row(vbox, tex_gem, " 0 / 6", Color(0.85, 0.75, 0.2))
	
	# Altares Row (Sangre vieja)
	lbl_switches = _make_row(vbox, tex_altar, " 0 / 3", Color(0.8, 0.3, 0.3))
	
	# Notificación Flotante Estilizada
	notif_label = Label.new()
	notif_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	notif_label.position = Vector2(0, 150)
	notif_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	notif_label.add_theme_font_size_override("font_size", 38)
	notif_label.add_theme_color_override("font_color", Color(0.9, 0.8, 0.5))
	notif_label.add_theme_color_override("font_shadow_color", Color(0,0,0,1))
	notif_label.add_theme_constant_override("shadow_offset_x", 4)
	notif_label.add_theme_constant_override("shadow_offset_y", 4)
	notif_label.add_theme_constant_override("shadow_outline_size", 4)
	notif_label.visible = false
	root.add_child(notif_label)

func _make_row(parent: Node, tex: Texture2D, texto: String, color: Color) -> Label:
	var row = HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_BEGIN
	
	var icon = TextureRect.new()
	if tex:
		icon.texture = tex
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.custom_minimum_size = Vector2(28, 28) # Iconos clásicos más pequeños (PS2 style)
	icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	var mat = CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	icon.material = mat
	row.add_child(icon)
	
	var lbl = Label.new()
	lbl.text = texto
	lbl.add_theme_font_size_override("font_size", 24) # Tipografía sutil
	lbl.add_theme_color_override("font_color", color)
	lbl.add_theme_color_override("font_shadow_color", Color(0,0,0,1))
	lbl.add_theme_constant_override("shadow_offset_x", 2)
	lbl.add_theme_constant_override("shadow_offset_y", 2)
	lbl.add_theme_constant_override("shadow_outline_size", 3)
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	row.add_child(lbl)
	
	parent.add_child(row)
	return lbl

func _actualizar_corazones_ui():
	if not hbox_vida: return
	for c in hbox_vida.get_children():
		c.queue_free()
	
	for i in range(3):
		var icon = TextureRect.new()
		if tex_heart:
			icon.texture = tex_heart
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.custom_minimum_size = Vector2(26, 26) # Corazones pequeños
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		
		var mat = CanvasItemMaterial.new()
		mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		icon.material = mat
		
		# Si está vacío (perdió vida)
		if i >= vida:
			icon.modulate = Color(0.3, 0.3, 0.3, 0.4)
			icon.material = null 
			
		hbox_vida.add_child(icon)

func actualizar_cacao(v: int):
	cacao = v
	if lbl_cacao: lbl_cacao.text = " x %d" % cacao

func actualizar_vida(v: int):
	vida = v
	_actualizar_corazones_ui()

func actualizar_gema():
	gemas += 1
	if lbl_gemas: lbl_gemas.text = " %d / 6" % gemas
	if gemas == 6:
		mostrar_notificacion("¡Tienes para el camión! (+6 Pesos)")
	else:
		mostrar_notificacion("✨ ¡Gema del Mictlán recogida! (%d/6)" % gemas)

func actualizar_switch():
	switches += 1
	if lbl_switches: lbl_switches.text = " %d / 3" % switches
	mostrar_notificacion("🔮 ¡Altar activado! (%d/3)" % switches)
	if switches >= 3:
		mostrar_notificacion("🌀 ¡EL GRAN MURO DE ENERGÍA SE HA ROTO!")

func mostrar_notificacion(texto: String):
	if notif_label:
		notif_label.text = texto
		notif_label.visible = true
		notif_timer = 4.0

func _process(delta):
	if notif_timer > 0 and notif_label:
		notif_timer -= delta
		notif_label.modulate.a = min(1.0, notif_timer)
		if notif_timer <= 0:
			notif_label.visible = false
