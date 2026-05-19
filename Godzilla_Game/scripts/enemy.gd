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
	
	var pivot = cargar_glb_runtime("res://models/jaguar_anim.glb")
	if not pivot: pivot = Node3D.new()
	pivot.scale = Vector3(0.5, 0.5, 0.5) # Escala ajustada
	add_child(pivot)
	
	# Guardar referencia al AnimationPlayer para cambiar estados
	animation_player = buscar_animation_player(pivot)
	if animation_player:
		var anims = animation_player.get_animation_list()
		if anims.size() > 0:
			animation_player.play(anims[0])
	
	if is_boss:
		scale = Vector3(1.5, 1.5, 1.5) # Jefe escalado proporcionalmente
		hp = 20
		SPEED = 6.0
		# Cambiar color a obsidiana negra usando el helper recursivo
		var mat_obsidiana = StandardMaterial3D.new()
		mat_obsidiana.albedo_color = Color(0.05, 0.05, 0.05) # Negro puro
		mat_obsidiana.metallic = 1.0
		mat_obsidiana.roughness = 0.2
		mat_obsidiana.emission_enabled = true
		mat_obsidiana.emission = Color(0.8, 0.1, 0.0) # Ojos/Grietas rojas
		mat_obsidiana.emission_energy_multiplier = 0.5
		aplicar_color_recursivo(pivot, mat_obsidiana)
	else:
		# Jaguar normal también es de piedra mágica pero grisácea
		var mat_piedra = StandardMaterial3D.new()
		mat_piedra.albedo_color = Color(0.3, 0.3, 0.3)
		mat_piedra.metallic = 0.5
		mat_piedra.roughness = 0.7
		aplicar_color_recursivo(pivot, mat_piedra)
		# Grito inicial
		var real_hud = get_tree().get_root().find_child("HUD", true, false)
		if real_hud and real_hud.has_method("mostrar_notificacion"):
			real_hud.mostrar_notificacion("🔥 Tezcatlipoca: ¿Un pedazo de cartón pintado en mi dominio? ¡Voy a romperte!")
			
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
