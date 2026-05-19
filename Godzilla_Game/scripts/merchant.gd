extends StaticBody3D

var interaction_radius = 5.0
var label: Label3D
var player: Node3D

func _ready():
	add_to_group("merchants")
	
	# Crear el puesto (Mesa de Tianguis)
	var mesa = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = Vector3(3, 1, 2)
	mesa.mesh = box
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.8, 0.2, 0.2) # Mesa roja típica de tianguis
	mesa.material_override = mat
	mesa.position.y = 0.5
	add_child(mesa)
	
	var col = CollisionShape3D.new()
	var col_box = BoxShape3D.new()
	col_box.size = box.size
	col.shape = col_box
	col.position.y = 0.5
	add_child(col)
	
	# ENSAMBLAJE PROCEDURAL: COMERCIANTE POCHTECA
	var vendedor = Node3D.new()
	vendedor.position = Vector3(0, 0.0, -1.0)
	
	var mat_sombra = StandardMaterial3D.new()
	mat_sombra.albedo_color = Color(0.05, 0.0, 0.1, 0.8) # Oscuro semi-transparente
	mat_sombra.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat_sombra.roughness = 1.0
	mat_sombra.emission_enabled = true; mat_sombra.emission = Color(0.2, 0.0, 0.4); mat_sombra.emission_energy_multiplier = 0.5
	
	# Función constructora
	var crear_pieza = func(padre, mesh_type, size, pos, rot, mat):
		var mesh_inst = MeshInstance3D.new()
		var m
		if mesh_type == "capsule":
			m = CapsuleMesh.new(); m.radius = size.x; m.height = size.y; m.radial_segments = 12; m.rings = 6
		elif mesh_type == "cylinder":
			m = CylinderMesh.new(); m.top_radius = size.x; m.bottom_radius = size.x; m.height = size.y; m.radial_segments = 10
		else: # Box
			m = BoxMesh.new(); m.size = size
		mesh_inst.mesh = m; mesh_inst.material_override = mat
		mesh_inst.position = pos; mesh_inst.rotation_degrees = rot
		padre.add_child(mesh_inst)
		return mesh_inst
		
	# Túnica / Cuerpo
	var cuerpo = crear_pieza.call(vendedor, "capsule", Vector2(0.4, 1.2), Vector3(0, 0.8, 0), Vector3(10, 0, 0), mat_sombra)
	# Cabeza oculta en capucha
	var cabeza = crear_pieza.call(cuerpo, "capsule", Vector2(0.25, 0.5), Vector3(0, 0.6, 0.1), Vector3(20, 0, 0), mat_sombra)
	# Mochila (Caja de madera mágica)
	var mochila = crear_pieza.call(cuerpo, "box", Vector3(0.6, 0.8, 0.4), Vector3(0, 0.2, -0.4), Vector3(-15, 0, 0), mat_sombra)
	# Brazos
	var brazo_r = crear_pieza.call(cuerpo, "capsule", Vector2(0.12, 0.6), Vector3(0.45, 0.1, 0.1), Vector3(-30, 0, 15), mat_sombra)
	var brazo_l = crear_pieza.call(cuerpo, "capsule", Vector2(0.12, 0.6), Vector3(-0.45, 0.1, 0.1), Vector3(20, 0, -15), mat_sombra)
	# Bastón
	var baston = crear_pieza.call(brazo_r, "cylinder", Vector2(0.04, 1.8), Vector3(0, -0.3, 0.2), Vector3(30, 0, 0), mat_sombra)
	
	# Efecto de flotación simple
	var t = Time.get_ticks_msec() / 1000.0
	vendedor.position.y += sin(t * 2.0) * 0.1
	add_child(vendedor)
	
	# Texto flotante (El grito del tianguis)
	label = Label3D.new()
	label.text = "¡Pásale! Mutaciones de Alebrije:\n[E / RB] Fuego (15 Cacao)\n[F / LB] Alas (25 Cacao)"
	label.font_size = 50
	label.outline_size = 16
	label.modulate = Color(1, 0.9, 0) # Oro
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.position = Vector3(0, 3.0, 0)
	add_child(label)

var cooldown = 0.0

func _process(delta):
	if cooldown > 0: cooldown -= delta
	
	# Buscar al jugador
	if not player:
		var players = get_tree().get_nodes_in_group("player")
		if players.size() > 0:
			player = players[0]
		return
		
	# Checar distancia
	var dist = global_position.distance_to(player.global_position)
	if dist < interaction_radius:
		if label.modulate.a < 0.5:
			# Greeting
			var real_hud = get_tree().get_root().find_child("HUD", true, false)
			if real_hud and real_hud.has_method("mostrar_notificacion"):
				real_hud.mostrar_notificacion("Tianguista: ¡Pásale, güero! Tengo de todo para que no te me vayas en seco.")
		label.modulate.a = 1.0
		# Lógica de compra
		if Input.is_action_just_pressed("interact") or Input.is_key_pressed(KEY_E):
			comprar_fuego()
		elif Input.is_key_pressed(KEY_F) or Input.is_joy_button_pressed(0, JOY_BUTTON_LEFT_SHOULDER):
			comprar_alas()
	else:
		if label.modulate.a > 0.5:
			# Farewell
			var real_hud = get_tree().get_root().find_child("HUD", true, false)
			if real_hud and real_hud.has_method("mostrar_notificacion"):
				real_hud.mostrar_notificacion("Tianguista: Ahí me avisas cómo te quedó... el inventario. ¡Regresa pronto!")
		label.modulate.a = 0.3 # Lejos, casi transparente
		
func comprar_fuego():
	if cooldown > 0: return
	cooldown = 1.0
	
	if player.cacao_score >= 15:
		var real_hud = get_tree().get_root().find_child("HUD", true, false)
		if not player.unlocked_fire:
			player.cacao_score -= 15
			player.unlocked_fire = true
			if real_hud:
				real_hud.actualizar_cacao(player.cacao_score)
				real_hud.mostrar_notificacion("¡Aliento de Fuego desbloqueado! (Usa Y o R)")
		else:
			if real_hud: real_hud.mostrar_notificacion("Ya tienes pulmones de dragón, jefe.")
	else:
		var real_hud = get_tree().get_root().find_child("HUD", true, false)
		if real_hud: real_hud.mostrar_notificacion("¡Te falta Cacao para esta mutación!")

func comprar_alas():
	if cooldown > 0: return
	cooldown = 1.0
	
	if player.cacao_score >= 25:
		var real_hud = get_tree().get_root().find_child("HUD", true, false)
		if not player.unlocked_wings:
			player.cacao_score -= 25
			player.unlocked_wings = true
			if real_hud:
				real_hud.actualizar_cacao(player.cacao_score)
				real_hud.mostrar_notificacion("¡Alas de Obsidiana! (Doble Salto: A x2 o Espacio x2)")
		else:
			if real_hud: real_hud.mostrar_notificacion("Ya puedes volar, carnal.")
	else:
		var real_hud = get_tree().get_root().find_child("HUD", true, false)
		if real_hud and real_hud.has_method("mostrar_notificacion"):
			real_hud.mostrar_notificacion("¡No joven, de a grapa no hay nada! Enséñame la lana.")

func cargar_glb_runtime(path: String) -> Node3D:
	var gltf = GLTFDocument.new()
	var state = GLTFState.new()
	var real_path = ProjectSettings.globalize_path(path)
	if FileAccess.file_exists(real_path):
		var err = gltf.append_from_file(real_path, state)
		if err == OK: return gltf.generate_scene(state)
	return null

func animar_modelo(node: Node):
	if node is AnimationPlayer:
		var anim_list = node.get_animation_list()
		if anim_list.size() > 0:
			var anim = node.get_animation(anim_list[0])
			if anim:
				anim.loop_mode = Animation.LOOP_LINEAR
			node.play(anim_list[0])
	for child in node.get_children():
		animar_modelo(child)
