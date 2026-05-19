extends Area3D

var float_offset = 0.0

func _ready():
	body_entered.connect(_on_body_entered)

func _process(delta):
	rotation_degrees.y += 90 * delta
	float_offset += delta * 2.0
	# Rebote flotante suave
	position.y += sin(float_offset) * 0.01

func _on_body_entered(body):
	if body.is_in_group("player"):
		var tipo = get_meta("tipo")
		var hud = get_tree().get_root().find_child("HUD", true, false)
		
		if tipo == "bebida":
			if body.has_method("recuperar_vida"):
				body.recuperar_vida(3)
			if body.has_method("activar_euforia"):
				body.activar_euforia(3.0)
			if hud:
				hud.mostrar_notificacion("¡Te echaste un buen chorro de leche... de cacao! (Salud Máx + Euforia)")
		elif tipo == "trozo":
			if body.has_method("recuperar_vida"):
				body.recuperar_vida(1)
			if hud:
				hud.mostrar_notificacion("¡Te comiste el trozo entero! (+1 Salud)")
		
		queue_free()
