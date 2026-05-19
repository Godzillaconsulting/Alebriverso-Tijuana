extends CanvasLayer

var top_bar: ColorRect
var bottom_bar: ColorRect
var subtitle_label: Label
var tween: Tween

func _ready():
	layer = 100 # Por encima de todo, incluido el HUD normal
	
	# Barra Superior
	top_bar = ColorRect.new()
	top_bar.color = Color(0, 0, 0, 1)
	top_bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	# Inicia colapsada usando anchors
	top_bar.anchor_top = 0.0
	top_bar.anchor_bottom = 0.0
	add_child(top_bar)
	
	# Barra Inferior
	bottom_bar = ColorRect.new()
	bottom_bar.color = Color(0, 0, 0, 1)
	bottom_bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	# Inicia colapsada usando anchors
	bottom_bar.anchor_top = 1.0
	bottom_bar.anchor_bottom = 1.0
	add_child(bottom_bar)
	
	# Subtítulos
	subtitle_label = Label.new()
	subtitle_label.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	subtitle_label.position.y = -80
	subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle_label.add_theme_font_size_override("font_size", 24)
	subtitle_label.add_theme_color_override("font_color", Color(1, 1, 1, 1))
	subtitle_label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 1))
	subtitle_label.add_theme_constant_override("shadow_outline_size", 2)
	subtitle_label.autowrap_mode = TextServer.AUTOWRAP_WORD
	subtitle_label.text = ""
	add_child(subtitle_label)

func show_bars(duration: float = 1.0):
	if tween: tween.kill()
	tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_SINE)
	
	# Usar anchors de forma correcta para animar (0.0 a 0.15 para abarcar el 15% de la pantalla)
	tween.tween_property(top_bar, "anchor_bottom", 0.15, duration)
	tween.tween_property(bottom_bar, "anchor_top", 0.85, duration)

func hide_bars(duration: float = 1.0):
	if tween: tween.kill()
	tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_SINE)
	subtitle_label.text = ""
	
	tween.tween_property(top_bar, "anchor_bottom", 0.0, duration)
	tween.tween_property(bottom_bar, "anchor_top", 1.0, duration)

func set_subtitle(text: String):
	subtitle_label.text = text
	# Pequeño efecto de parpadeo suave al cambiar texto
	subtitle_label.modulate.a = 0.0
	var text_tween = create_tween()
	text_tween.tween_property(subtitle_label, "modulate:a", 1.0, 0.3)
