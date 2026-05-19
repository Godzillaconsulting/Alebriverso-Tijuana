extends CanvasLayer

var cacao = 0
var vida = 3
var gemas = 0
var switches = 0

var hp_bar: ProgressBar
var lbl_items: Label
var lbl_pesos: Label
var notif_label: Label
var notif_timer = 0.0

var map_rect: TextureRect
var crosshair_rect: ColorRect

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
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	
	# CONTENEDOR INFERIOR DERECHO (Clon de Referencia)
	var margin = MarginContainer.new()
	margin.add_theme_constant_override("margin_right", 40)
	margin.add_theme_constant_override("margin_bottom", 40)
	margin.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	root.add_child(margin)
	
	var vbox = VBoxContainer.new()
	vbox.alignment = BoxContainer.ALIGNMENT_END
	margin.add_child(vbox)
	
	# Barra de Vida Minimalista (Verde Ultra Delgada)
	hp_bar = ProgressBar.new()
	hp_bar.max_value = 3
	hp_bar.value = 3
	hp_bar.custom_minimum_size = Vector2(180, 4) # Súper delgada
	hp_bar.show_percentage = false
	
	var bg_style = StyleBoxFlat.new()
	bg_style.bg_color = Color(0.0, 0.0, 0.0, 0.8)
	hp_bar.add_theme_stylebox_override("background", bg_style)
	
	var fill_style = StyleBoxFlat.new()
	fill_style.bg_color = Color(0.4, 0.9, 0.4) # Verde claro/pálido realista
	hp_bar.add_theme_stylebox_override("fill", fill_style)
	vbox.add_child(hp_bar)
	
	# Separador
	var sep = Control.new()
	sep.custom_minimum_size = Vector2(0, 15)
	vbox.add_child(sep)
	
	# Íconos Apilados Verticalmente (Alineados a la derecha)
	var vbox_icons = VBoxContainer.new()
	vbox_icons.alignment = BoxContainer.ALIGNMENT_END
	vbox.add_child(vbox_icons)
	
	# Fila Cacao
	var row_cacao = HBoxContainer.new()
	row_cacao.alignment = BoxContainer.ALIGNMENT_END
	vbox_icons.add_child(row_cacao)
	
	var tex_cacao_rect = TextureRect.new()
	tex_cacao_rect.texture = tex_cacao
	tex_cacao_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tex_cacao_rect.custom_minimum_size = Vector2(32, 32)
	tex_cacao_rect.modulate = Color(1.5, 1.5, 1.5) # Hacerlo blanco brillante/sobreexpuesto
	row_cacao.add_child(tex_cacao_rect)
	
	lbl_items = Label.new()
	lbl_items.text = "0"
	lbl_items.add_theme_font_size_override("font_size", 28)
	lbl_items.add_theme_color_override("font_shadow_color", Color(0,0,0,1))
	row_cacao.add_child(lbl_items)
	
	# Fila Gemas
	var row_gemas = HBoxContainer.new()
	row_gemas.alignment = BoxContainer.ALIGNMENT_END
	vbox_icons.add_child(row_gemas)
	
	var tex_peso_rect = TextureRect.new()
	tex_peso_rect.texture = tex_gem
	tex_peso_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tex_peso_rect.custom_minimum_size = Vector2(32, 32)
	tex_peso_rect.modulate = Color(1.5, 1.5, 1.5)
	row_gemas.add_child(tex_peso_rect)
	
	lbl_pesos = Label.new()
	lbl_pesos.name = "LblPesos"
	lbl_pesos.text = "0/6"
	lbl_pesos.add_theme_font_size_override("font_size", 28)
	lbl_pesos.add_theme_color_override("font_shadow_color", Color(0,0,0,1))
	row_gemas.add_child(lbl_pesos)
	
	# Notificación Flotante
	notif_label = Label.new()
	notif_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	notif_label.position = Vector2(0, -120)
	notif_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	notif_label.add_theme_font_size_override("font_size", 22)
	notif_label.add_theme_color_override("font_color", Color(1.0, 1.0, 1.0, 1.0))
	notif_label.add_theme_color_override("font_shadow_color", Color(0,0,0,1))
	notif_label.visible = false
	root.add_child(notif_label)
	
	# Mira / Crosshair (Centro de pantalla)
	crosshair_rect = ColorRect.new()
	crosshair_rect.custom_minimum_size = Vector2(4, 4)
	crosshair_rect.color = Color(1, 0, 0, 0.8) # Mira roja
	crosshair_rect.set_anchors_preset(Control.PRESET_CENTER)
	crosshair_rect.visible = false
	root.add_child(crosshair_rect)

func actualizar_cacao(v: int):
	cacao = v
	_actualizar_texto()

func actualizar_vida(v: int):
	vida = v
	hp_bar.value = vida
	# Cambiar color según vida (estilo RE4: verde, amarillo, rojo)
	var fill_style = hp_bar.get_theme_stylebox("fill") as StyleBoxFlat
	if vida >= 3:
		fill_style.bg_color = Color(0.3, 0.8, 0.3) # Verde
	elif vida == 2:
		fill_style.bg_color = Color(0.8, 0.8, 0.2) # Amarillo
	else:
		fill_style.bg_color = Color(0.9, 0.2, 0.2) # Rojo Peligro

func actualizar_gema():
	gemas += 1
	_actualizar_texto()
	if gemas == 6:
		mostrar_notificacion("Pesos listos. Encuentra el camión.")
	else:
		mostrar_notificacion("Peso recolectado (%d/6)" % gemas)

func actualizar_switch():
	switches += 1
	if switches >= 3:
		mostrar_notificacion("Muro de energía desbloqueado.")
	else:
		mostrar_notificacion("Altar activado (%d/3)" % switches)

func _actualizar_texto():
	if lbl_items:
		lbl_items.text = "Balas: %d  | " % cacao
	if lbl_pesos:
		lbl_pesos.text = "%d/6" % gemas

func mostrar_notificacion(texto: String):
	if notif_label:
		notif_label.text = texto
		notif_label.visible = true
		notif_timer = 3.0

func _process(delta):
	if notif_timer > 0 and notif_label:
		notif_timer -= delta
		notif_label.modulate.a = min(1.0, notif_timer)
		if notif_timer <= 0:
			notif_label.visible = false

func set_minimap_texture(tex: Texture2D):
	if map_rect:
		map_rect.texture = tex

func set_crosshair(is_visible: bool):
	if crosshair_rect:
		crosshair_rect.visible = is_visible
