extends CharacterBody3D

const SPEED = 6.0
const SEGMENTS = 8
var player: Node3D
var body_nodes = []
var time_alive = 0.0

func _ready():
	add_to_group("enemies")
	
	# Buscar al jugador
	player = get_tree().get_nodes_in_group("player")[0] if get_tree().get_nodes_in_group("player").size() > 0 else null
	
	# Crear cuerpo procedimental (Cadenas de nodos)
	var mat_snake = StandardMaterial3D.new()
	mat_snake.albedo_color = Color(0.1, 0.5, 0.2) # Verde oscuro
	mat_snake.roughness = 0.3
	mat_snake.metallic = 0.2
	
	for i in range(SEGMENTS):
		var mesh_inst = MeshInstance3D.new()
		var esfe = SphereMesh.new()
		esfe.radial_segments = 12
		esfe.rings = 6
		var s = 0.6 if i == 0 else 0.4 * (1.0 - (float(i) / SEGMENTS))
		esfe.radius = s / 2.0
		esfe.height = s
		mesh_inst.mesh = esfe
		mesh_inst.material_override = mat_snake
		add_child(mesh_inst)
		body_nodes.append(mesh_inst)
		
		# Ojos a la cabeza
		if i == 0:
			var mat_ojo = StandardMaterial3D.new()
			mat_ojo.albedo_color = Color(1.0, 0.0, 0.0); mat_ojo.emission_enabled = true; mat_ojo.emission = Color(1.0, 0, 0)
			for x in [-0.2, 0.2]:
				var ojo = MeshInstance3D.new()
				var o_mesh = SphereMesh.new(); o_mesh.radius = 0.1; o_mesh.height = 0.2
				ojo.mesh = o_mesh; ojo.material_override = mat_ojo
				ojo.position = Vector3(x, 0.2, -0.3)
				mesh_inst.add_child(ojo)

	# Colisión
	var col = CollisionShape3D.new()
	var shape = SphereShape3D.new()
	shape.radius = 0.5
	col.shape = shape
	add_child(col)

func _physics_process(delta):
	time_alive += delta
	if not player: return
	
	# Movimiento hacia el jugador (solo en el agua, Y = -5.5)
	var dir = (player.global_position - global_position)
	dir.y = 0
	if dir.length() > 0.5:
		dir = dir.normalized()
		velocity = dir * SPEED
		rotation.y = lerp_angle(rotation.y, atan2(velocity.x, velocity.z), 10.0 * delta)
	else:
		velocity = Vector3.ZERO
		# Ataque
		if player.has_method("recibir_dano") and randf() < 0.05:
			player.recibir_dano(1)
	
	move_and_slide()
	global_position.y = -5.5 # Mantenerse en la superficie del agua
	
	# Animación procedimental de nado en zig-zag (Onda sinusoidal)
	for i in range(SEGMENTS):
		var offset = float(i) * 0.5
		var angle = sin(time_alive * 10.0 - offset) * 0.8
		body_nodes[i].position = Vector3(sin(angle) * 0.5, 0, float(i) * 0.4)
		body_nodes[i].rotation.y = angle

func recibir_dano():
	queue_free()
