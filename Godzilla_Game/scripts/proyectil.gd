extends Area3D

var speed = 40.0
var direction = Vector3.ZERO
var lifetime = 2.0

func _ready():
	# Crear malla visual (Semilla de cacao gigante)
	var mesh = MeshInstance3D.new()
	var sphere = SphereMesh.new()
	sphere.radius = 0.2; sphere.height = 0.4
	mesh.mesh = sphere
	
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.3, 0.15, 0.05) # Café oscuro
	mat.roughness = 0.8
	mesh.material_override = mat
	add_child(mesh)
	
	# Colisión
	var col = CollisionShape3D.new()
	var shape = SphereShape3D.new()
	shape.radius = 0.25
	col.shape = shape
	add_child(col)
	
	# Señales
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)
	
	# Auto-destrucción
	get_tree().create_timer(lifetime).timeout.connect(queue_free)

func _physics_process(delta):
	position += direction * speed * delta

func _on_body_entered(body):
	if body.is_in_group("player"): return # Ignorar al jugador
	
	if body.has_method("recibir_dano"):
		body.recibir_dano()
	elif body.has_method("break_crate"):
		body.break_crate()
		
	crear_impacto()
	queue_free()

func _on_area_entered(area):
	if area.has_method("recibir_dano"):
		area.recibir_dano()
		crear_impacto()
		queue_free()

func crear_impacto():
	# Partículas de polvo de cacao al golpear
	var p = GPUParticles3D.new()
	var mat_p = ParticleProcessMaterial.new()
	mat_p.direction = -direction
	mat_p.spread = 45.0
	mat_p.initial_velocity_min = 2.0
	mat_p.initial_velocity_max = 5.0
	mat_p.scale_min = 0.5
	mat_p.scale_max = 1.0
	
	p.process_material = mat_p
	var m = BoxMesh.new()
	m.size = Vector3(0.1, 0.1, 0.1)
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(0.4, 0.2, 0.1)
	m.material_override = mat
	
	p.draw_pass_1 = m
	p.amount = 10
	p.explosiveness = 1.0
	p.one_shot = true
	p.lifetime = 0.5
	
	p.global_position = global_position
	get_parent().add_child(p)
	
	# Destruir partículas después de terminar
	get_tree().create_timer(0.6).timeout.connect(p.queue_free)
