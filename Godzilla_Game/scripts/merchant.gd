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
	
	# Calavera Vendedora (Simple representación por ahora)
	var calavera = MeshInstance3D.new()
	var skull = SphereMesh.new()
	skull.radius = 0.5; skull.height = 1.0
	calavera.mesh = skull
	calavera.position = Vector3(0, 1.5, -0.5)
	add_child(calavera)
	
	# Texto flotante (El grito del tianguis)
	label = Label3D.new()
	label.text = "¡Llévele llévele!\n[E] Agua de Jamaica (+1 Vida) - 5 Cacaos\n[F] Bolillo pal susto (Full Vida) - 15 Cacaos"
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
		label.modulate.a = 1.0
		# Lógica de compra
		if Input.is_key_pressed(KEY_E):
			comprar_jamaica()
		elif Input.is_key_pressed(KEY_F):
			comprar_bolillo()
	else:
		label.modulate.a = 0.3 # Lejos, casi transparente
		
func comprar_jamaica():
	if cooldown > 0: return
	cooldown = 1.0 # Evitar spam
	
	if player.cacao_score >= 5:
		var real_hud = get_tree().get_root().find_child("HUD", true, false)
		if real_hud and real_hud.has_method("actualizar_vida"):
			if real_hud.vida < 3:
				player.cacao_score -= 5
				real_hud.actualizar_cacao(player.cacao_score)
				real_hud.actualizar_vida(real_hud.vida + 1)
				real_hud.mostrar_notificacion("¡Agua de Jamaica refrescante! (+1 Vida)")
			else:
				real_hud.mostrar_notificacion("¡Ya estás lleno, jefe!")
	else:
		var real_hud = get_tree().get_root().find_child("HUD", true, false)
		if real_hud and real_hud.has_method("mostrar_notificacion"):
			real_hud.mostrar_notificacion("¡Te faltan cacaos, no fío!")

func comprar_bolillo():
	if cooldown > 0: return
	cooldown = 1.0
	
	if player.cacao_score >= 15:
		var real_hud = get_tree().get_root().find_child("HUD", true, false)
		if real_hud and real_hud.has_method("actualizar_vida"):
			if real_hud.vida < 3:
				player.cacao_score -= 15
				real_hud.actualizar_cacao(player.cacao_score)
				real_hud.actualizar_vida(3) # FULL VIDA
				real_hud.mostrar_notificacion("¡Bolillo pal susto! (Full Vida - Estás pesado)")
				
				# Efecto secundario: Te vuelves lento por 2 segundos
				player.SPEED = 2.0
				get_tree().create_timer(2.0).timeout.connect(func(): player.SPEED = 8.0)
				
			else:
				real_hud.mostrar_notificacion("¡Ya estás lleno, jefe!")
	else:
		var real_hud = get_tree().get_root().find_child("HUD", true, false)
		if real_hud and real_hud.has_method("mostrar_notificacion"):
			real_hud.mostrar_notificacion("¡Trabájale! Cuesta 15 cacaos.")

