extends CharacterBody3D

# ==========================================
# ÁRBOL DE DECISIONES DE INTELIGENCIA ARTIFICIAL
# Arquitectura basada en Estados (Behavior Tree simplificado)
# ==========================================

enum NodeState {
	PATRULLANDO, # Nodo: Caminar en círculos
	PERSIGUIENDO, # Nodo: Ir hacia el jugador
	ATACANDO,     # Nodo: Embestir
	CONFUNDIDO,   # Nodo: Comportamiento gracioso (Cultura Mexicana)
	ATURDIDO       # Nodo: Aturdido
}

@export var is_boss: bool = false
var current_node = NodeState.PATRULLANDO
var target_player: Node3D = null

var hp = 3
var SPEED = 4.0
var detect_radius = 15.0
var attack_radius = 2.5

# Variables de navegación interna del árbol
var patrol_center: Vector3
var random_target: Vector3
var timer = 0.0
var attack_timer = 0.0

func _ready():
	add_to_group("enemies")
	patrol_center = global_position
	generar_random_target()
	
	# === ENSAMBLAJE PROCEDURAL: GUERRERO JAGUAR AZTECA ===
	var pivot = Node3D.new()
	pivot.scale = Vector3(1.2, 1.2, 1.2)
	add_child(pivot)
	
	# Materiales por partes (Hiperrealismo)
	var mat_piel = StandardMaterial3D.new(); mat_piel.albedo_color = Color(0.25, 0.15, 0.1); mat_piel.roughness = 0.6
	var mat_tela = StandardMaterial3D.new(); mat_tela.albedo_color = Color(0.6, 0.1, 0.1); mat_tela.roughness = 0.9 # Taparrabos Rojo
	var mat_oro = StandardMaterial3D.new(); mat_oro.albedo_color = Color(0.8, 0.6, 0.1); mat_oro.metallic = 1.0; mat_oro.roughness = 0.2
	var mat_obsidiana = StandardMaterial3D.new(); mat_obsidiana.albedo_color = Color(0.05, 0.05, 0.05); mat_obsidiana.metallic = 0.8; mat_obsidiana.roughness = 0.3
	
	# Torso (Piel)
	var torso = MeshInstance3D.new(); var t_mesh = CapsuleMesh.new(); t_mesh.radius = 0.3; t_mesh.height = 0.8
	torso.mesh = t_mesh; torso.material_override = mat_piel; torso.position.y = 1.0
	pivot.add_child(torso)
	
	# Pechera de Oro (Armadura)
	var pechera = MeshInstance3D.new(); var p_mesh = CylinderMesh.new(); p_mesh.top_radius = 0.32; p_mesh.bottom_radius = 0.35; p_mesh.height = 0.3
	pechera.mesh = p_mesh; pechera.material_override = mat_oro; pechera.position.y = 0.2
	torso.add_child(pechera)
	
	# Máscara de Jaguar (Cabeza)
	var cabeza = MeshInstance3D.new(); var c_mesh = SphereMesh.new(); c_mesh.radius = 0.25; c_mesh.height = 0.5
	cabeza.mesh = c_mesh; cabeza.material_override = mat_obsidiana; cabeza.position = Vector3(0, 0.5, 0)
	torso.add_child(cabeza)
	
	# Taparrabos (Tela)
	var taparrabos = MeshInstance3D.new(); var tap_mesh = PrismMesh.new(); tap_mesh.size = Vector3(0.4, 0.5, 0.1)
	taparrabos.mesh = tap_mesh; taparrabos.material_override = mat_tela; taparrabos.position = Vector3(0, -0.4, 0.25)
	taparrabos.rotation_degrees.x = -15
	torso.add_child(taparrabos)
	
	# Brazos y Lanza de Obsidiana
	for i in [-1, 1]:
		var brazo = MeshInstance3D.new(); var b_mesh = CapsuleMesh.new(); b_mesh.radius = 0.1; b_mesh.height = 0.6
		brazo.mesh = b_mesh; brazo.material_override = mat_piel; brazo.position = Vector3(0.4 * i, 0.1, 0); brazo.rotation_degrees.z = 20 * i
		torso.add_child(brazo)
		if i == 1: # Lanza en la mano derecha
			var lanza = MeshInstance3D.new(); var l_mesh = CylinderMesh.new(); l_mesh.top_radius = 0.02; l_mesh.bottom_radius = 0.02; l_mesh.height = 1.5
			var mat_madera = StandardMaterial3D.new(); mat_madera.albedo_color = Color(0.3, 0.15, 0.05)
			lanza.mesh = l_mesh; lanza.material_override = mat_madera; lanza.position = Vector3(0, -0.2, -0.4); lanza.rotation_degrees.x = -45
			brazo.add_child(lanza)
			# Punta de Obsidiana
			var punta = MeshInstance3D.new(); var pu_mesh = PrismMesh.new(); pu_mesh.size = Vector3(0.05, 0.2, 0.05)
			punta.mesh = pu_mesh; punta.material_override = mat_obsidiana; punta.position.y = 0.85
			lanza.add_child(punta)
			
	# Piernas
	for i in [-1, 1]:
		var pierna = MeshInstance3D.new(); var pi_mesh = CapsuleMesh.new(); pi_mesh.radius = 0.12; pi_mesh.height = 0.6
		pierna.mesh = pi_mesh; pierna.material_override = mat_piel; pierna.position = Vector3(0.15 * i, -0.5, 0)
		torso.add_child(pierna)
	
	if is_boss:
		scale = Vector3(1.5, 1.5, 1.5) # Jefe escalado
		hp = 20
		SPEED = 6.0
		# Modificadores visuales del jefe
		mat_piel.albedo_color = Color(0.1, 0.05, 0.05) # Piel más oscura
		mat_obsidiana.emission_enabled = true; mat_obsidiana.emission = Color(1, 0, 0); mat_obsidiana.emission_energy_multiplier = 0.5
	else:
		hp = 3
		var real_hud = get_tree().get_root().find_child("HUD", true, false)
		if real_hud and real_hud.has_method("mostrar_notificacion"):
			real_hud.mostrar_notificacion("Guerrero Jaguar: ¡Intruso en el Mictlán!")
			
	var col = CollisionShape3D.new()
	var shape = CapsuleShape3D.new(); shape.radius = 0.5; shape.height = 1.6
	col.shape = shape
	col.position.y = 0.8
	add_child(col)

func _physics_process(delta):
	if not is_on_floor():
		velocity.y -= 20.0 * delta
		
	# ----------------------------------------------------
	# EVALUACIÓN DEL ÁRBOL DE DECISIONES (Cerebro del Enemigo)
	# ----------------------------------------------------
	encontrar_jugador()
	
	match current_node:
		NodeState.PATRULLANDO:
			ejecutar_nodo_patrullaje()
		NodeState.PERSIGUIENDO:
			ejecutar_nodo_persecucion()
		NodeState.ATACANDO:
			ejecutar_nodo_ataque(delta)
		NodeState.CONFUNDIDO:
			ejecutar_nodo_confusion(delta)
		NodeState.ATURDIDO:
			ejecutar_nodo_stunned(delta)
			
	move_and_slide()

# ==========================================
# LÓGICA DE LOS NODOS DEL ÁRBOL
# ==========================================

func encontrar_jugador():
	if not target_player:
		var players = get_tree().get_nodes_in_group("player")
		if players.size() > 0:
			target_player = players[0]
			
	if target_player:
		var dist = global_position.distance_to(target_player.global_position)
		
		# Rama de Decisión: Transiciones de Estado
		if current_node == NodeState.PATRULLANDO and dist < detect_radius:
			current_node = NodeState.PERSIGUIENDO # ¡Lo vio!
		elif current_node == NodeState.PERSIGUIENDO and dist < attack_radius:
			current_node = NodeState.ATACANDO # ¡Está muy cerca!
		elif current_node == NodeState.PERSIGUIENDO and dist > detect_radius * 1.5:
			current_node = NodeState.CONFUNDIDO # ¡Se escapó!

func ejecutar_nodo_patrullaje():
	var dist = global_position.distance_to(random_target)
	if dist < 1.0:
		generar_random_target()
	mover_hacia(random_target, SPEED * 0.5)

func ejecutar_nodo_persecucion():
	if target_player:
		mover_hacia(target_player.global_position, SPEED)

func ejecutar_nodo_ataque(delta):
	# Si se aleja, volver a perseguir
	if global_position.distance_to(target_player.global_position) > attack_radius:
		current_node = NodeState.PERSIGUIENDO
		return
		
	# Lógica de ataque: Preparar un "Golpe de Macuahuitl"
	velocity.x = 0; velocity.z = 0
	rotation.y += 15.0 * delta # Gira como preparándose
	
	if attack_timer > 0:
		attack_timer -= delta
	else:
		attack_timer = 1.5 # Cada 1.5 segundos ataca
		if target_player and target_player.has_method("recibir_dano"):
			target_player.recibir_dano(1)

func ejecutar_nodo_confusion(delta):
	velocity.x = 0; velocity.z = 0
	timer += delta
	# Mira a los lados confundido
	rotation.y += sin(timer * 10.0) * 0.05
	if timer > 3.0:
		timer = 0.0
		current_node = NodeState.PATRULLANDO # Regresa a su rutina base

func ejecutar_nodo_stunned(delta):
	velocity.x = 0; velocity.z = 0
	timer += delta
	# Da vueltas mareado
	rotation.y -= 25.0 * delta
	if timer > 2.0:
		timer = 0.0
		current_node = NodeState.PERSIGUIENDO

# ==========================================
# UTILIDADES Y SISTEMA DE DAÑO (Sin Sangre)
# ==========================================

func mover_hacia(target: Vector3, vel: float):
	var dir = (target - global_position).normalized()
	dir.y = 0
	velocity.x = dir.x * vel
	velocity.z = dir.z * vel
	if dir.length() > 0.1:
		rotation.y = lerp_angle(rotation.y, atan2(velocity.x, velocity.z), 0.1)

func recibir_dano():
	hp -= 1
	if is_boss and hp > 0 and hp % 3 == 0:
		var hud = get_tree().get_root().find_child("HUD", true, false)
		if hud: hud.mostrar_notificacion("🔥 Tezcatlipoca: ¡Demasiado lento! ¡Hasta los sacrificios peleaban mejor!")
		
	if hp <= 0:
		estallar_en_confeti()
	else:
		current_node = NodeState.ATURDIDO
		timer = 0.0
		if is_boss:
			var hud = get_tree().get_root().find_child("HUD", true, false)
			if hud: hud.mostrar_notificacion("🔥 Tezcatlipoca: ¡Argh! ¡Maldito trompo de madera! ¡Me mareaste!")

func estallar_en_confeti():
	# En lugar de sangre, es una piñata de papel maché
	for i in range(10):
		var confeti = RigidBody3D.new()
		var mesh = MeshInstance3D.new()
		var box = BoxMesh.new(); box.size = Vector3(0.2, 0.2, 0.2)
		var mat = StandardMaterial3D.new()
		mat.albedo_color = Color(randf(), randf(), randf()) # Colores aleatorios vivos
		box.material = mat
		mesh.mesh = box
		
		var col = CollisionShape3D.new(); var col_box = BoxShape3D.new(); col_box.size = box.size
		col.shape = col_box
		
		confeti.add_child(mesh); confeti.add_child(col)
		get_parent().add_child(confeti)
		confeti.global_position = global_position + Vector3(0, 1, 0)
		confeti.apply_central_impulse(Vector3(randf_range(-4,4), randf_range(5,10), randf_range(-4,4)))
		
		# Autodestrucción del confeti
		get_tree().create_timer(4.0).timeout.connect(confeti.queue_free)
		
	if is_boss:
		var hud = get_tree().get_root().find_child("HUD", true, false)
		if hud: hud.mostrar_notificacion("🔥 Tezcatlipoca: ¡No... mi reflejo se quiebra! ¡La cima te volverá cenizas...!")
		
	queue_free() # Destruir enemigo

func generar_random_target():
	random_target = patrol_center + Vector3(randf_range(-10, 10), 0, randf_range(-10, 10))

# --- HELPERS PARA MODELOS RIGGED ---
var animation_player: AnimationPlayer

func cargar_glb_runtime(path: String) -> Node3D:
	var gltf = GLTFDocument.new()
	var state = GLTFState.new()
	var real_path = ProjectSettings.globalize_path(path)
	if FileAccess.file_exists(real_path):
		var err = gltf.append_from_file(real_path, state)
		if err == OK: return gltf.generate_scene(state)
	return null

func buscar_animation_player(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer: return node
	for child in node.get_children():
		var res = buscar_animation_player(child)
		if res: return res
	return null

func aplicar_color_recursivo(nodo: Node, mat: Material):
	if nodo is MeshInstance3D:
		nodo.material_override = mat
	for hijo in nodo.get_children():
		aplicar_color_recursivo(hijo, mat)
