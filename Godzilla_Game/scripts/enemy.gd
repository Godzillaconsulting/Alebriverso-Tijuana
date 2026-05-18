extends CharacterBody3D

# ==========================================
# ÁRBOL DE DECISIONES DE INTELIGENCIA ARTIFICIAL
# Arquitectura basada en Estados (Behavior Tree simplificado)
# ==========================================

enum NodeState {
	PATRULLANDO, # Nodo: Caminar en círculos
	PERSIGUIENDO, # Nodo: Ir hacia el jugador
	ATACANDO,     # Nodo: Embestir
	CONFUNDIDO    # Nodo: Comportamiento gracioso (Cultura Mexicana)
}

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
	
	# Geometría Procedural: GUERRERO JAGUAR
	var pivot = Node3D.new()
	var mat_piel = StandardMaterial3D.new()
	mat_piel.albedo_color = Color(0.6, 0.4, 0.2) # Cobre / Morena
	
	# Torso
	var torso = MeshInstance3D.new()
	var torso_mesh = CapsuleMesh.new(); torso_mesh.radius = 0.45; torso_mesh.height = 1.3
	torso.mesh = torso_mesh; torso.material_override = mat_piel
	torso.position.y = 1.0
	pivot.add_child(torso)
	
	# Cabeza de Jaguar (Yelmo)
	var cabeza = MeshInstance3D.new()
	var cabeza_mesh = SphereMesh.new(); cabeza_mesh.radius = 0.35; cabeza_mesh.height = 0.7
	var mat_jaguar = StandardMaterial3D.new()
	mat_jaguar.albedo_color = Color(0.9, 0.7, 0.1) # Amarillo Jaguar
	cabeza.mesh = cabeza_mesh; cabeza.material_override = mat_jaguar
	cabeza.position.y = 0.8
	cabeza.position.z = -0.1
	torso.add_child(cabeza)
	
	# Arma (Macuahuitl)
	var arma = MeshInstance3D.new()
	var arma_mesh = BoxMesh.new(); arma_mesh.size = Vector3(0.1, 1.2, 0.3)
	var mat_obsidiana = StandardMaterial3D.new(); mat_obsidiana.albedo_color = Color(0.1, 0.1, 0.1)
	arma.mesh = arma_mesh; arma.material_override = mat_obsidiana
	arma.position = Vector3(0.6, 0.2, -0.4)
	arma.rotation_degrees.x = -45
	torso.add_child(arma)
	
	add_child(pivot)
	
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
	if hp <= 0:
		estallar_en_confeti()

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
		
	queue_free() # Destruir enemigo

func generar_random_target():
	random_target = patrol_center + Vector3(randf_range(-10, 10), 0, randf_range(-10, 10))
