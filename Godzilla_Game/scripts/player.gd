extends CharacterBody3D

const SPEED = 8.0
const JUMP_VELOCITY = 7.0
var jump_count = 0
const MAX_JUMPS = 2
var mouse_sensitivity = 0.003

var gravity = ProjectSettings.get_setting("physics/3d/default_gravity")
var spring_arm : Node3D
var spawn_point = Vector3(0, 3, 0)

# Variables para mecánicas de Crash Bandicoot
var spin_time_left = 0.0
var spin_angle = 0.0
var camera_pivot : Node3D
var cacao_score = 0

# Variables para mecánicas avanzadas (Jugabilidad 3D)
var dash_time_left = 0.0
var dash_cooldown = 0.0
var current_scale = Vector3(1, 1, 1)
var was_on_floor = true
var invincibility_time = 0.0

func _ready():
	add_to_group("player")
	Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	call_deferred("get_spring_arm")
	
	# --- PARTÍCULAS AMBIENTALES (Mosquitos / Luciérnagas del Mictlán) ---
	var particles = GPUParticles3D.new()
	var mat_p = StandardMaterial3D.new()
	mat_p.albedo_color = Color(1.0, 0.8, 0.0)
	mat_p.emission_enabled = true
	mat_p.emission = Color(1.0, 0.8, 0.0)
	mat_p.emission_energy_multiplier = 2.0
	
	var pm = ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	pm.emission_sphere_radius = 25.0
	pm.gravity = Vector3(0, 0.2, 0)
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 180.0
	pm.initial_velocity_min = 0.2
	pm.initial_velocity_max = 0.8
	
	var mesh = QuadMesh.new() # De SphereMesh a QuadMesh (-99% polígonos)
	mesh.size = Vector2(0.1, 0.1)
	mat_p.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES # Clave para que el Quad mire a la cámara
	particles.draw_pass_1 = mesh
	particles.material_override = mat_p
	particles.process_material = pm
	particles.amount = 150 # Reducido de 400 a 150 para máximo FPS
	particles.lifetime = 4.0
	add_child(particles)

func sumar_cacao(cantidad: int):
	cacao_score += cantidad
	var real_hud = get_tree().get_root().find_child("HUD", true, false)
	if real_hud and real_hud.has_method("actualizar_cacao"):
		real_hud.actualizar_cacao(cacao_score)

func get_spring_arm():
	spring_arm = get_node_or_null("SpringArm")
	if spring_arm:
		# Desacoplar la cámara del cuerpo físico
		camera_pivot = Node3D.new()
		add_child(camera_pivot)
		spring_arm.reparent(camera_pivot)
		
		# ¡CRÍTICO! Al reparentar, la cámara pierde su estado "current" en Godot, 
		# lo que causaba la "Pantalla Gris" de la muerte. Hay que reactivarla:
		for child in spring_arm.get_children():
			if child is Camera3D:
				child.make_current()

func _unhandled_input(event):
	if event is InputEventMouseMotion and camera_pivot and spring_arm:
		camera_pivot.rotate_y(-event.relative.x * mouse_sensitivity)
		spring_arm.rotate_x(-event.relative.y * mouse_sensitivity)
		spring_arm.rotation.x = clamp(spring_arm.rotation.x, -PI/3, PI/4)
		
	if event.is_action_pressed("ui_cancel"):
		if Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
			Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
		else:
			Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

func _physics_process(delta):
	if dash_cooldown > 0: dash_cooldown -= delta
	if dash_time_left > 0: dash_time_left -= delta
	
	if invincibility_time > 0:
		invincibility_time -= delta
		visible = int(invincibility_time * 10) % 2 == 0
	else:
		visible = true
	
	# --- SQUASH & STRETCH (Aterrizaje) ---
	if is_on_floor() and not was_on_floor:
		current_scale = Vector3(1.6, 0.4, 1.6) # Squash dramático al caer
	was_on_floor = is_on_floor()
	current_scale = current_scale.lerp(Vector3(1, 1, 1), 12.0 * delta)

	if not is_on_floor():
		velocity.y -= gravity * delta
		# --- GROUND POUND (Caída Fuerte) ---
		if Input.is_key_pressed(KEY_CTRL) and velocity.y > -20.0:
			velocity.y = -40.0 # Aplastón rápido hacia abajo
			current_scale = Vector3(0.5, 2.0, 0.5)
	else:
		jump_count = 0

	# --- ZONA DE MUERTE Y RESPAWN ---
	if global_position.y < -3.0:
		print("¡Caíste al vacío! Reapareciendo...")
		global_position = spawn_point
		velocity = Vector3.ZERO
	# --------------------------------
	
	# --------------------------------
	
	if Input.is_action_just_pressed("ui_accept") and jump_count < MAX_JUMPS:
		velocity.y = JUMP_VELOCITY
		jump_count += 1
		current_scale = Vector3(0.4, 1.7, 0.4) # Stretch estirado al saltar

	# --- EL GIRO DE CRASH BANDICOOT (Spin Attack) ---
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and spin_time_left <= 0:
		spin_time_left = 0.5 

	if spin_time_left > 0:
		spin_time_left -= delta
		spin_angle += 40.0 * delta 
		var crates = get_tree().get_nodes_in_group("crates")
		for crate in crates:
			if global_position.distance_to(crate.global_position) < 2.5:
				if crate.has_method("break_crate"):
					crate.break_crate()
	else:
		spin_angle = 0.0

	# --- MOVIMIENTO RELATIVO A LA CÁMARA (Estilo Mario 64 / Zelda) ---
	var x_mov = int(Input.is_key_pressed(KEY_D)) - int(Input.is_key_pressed(KEY_A)) + Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left")
	var y_mov = int(Input.is_key_pressed(KEY_S)) - int(Input.is_key_pressed(KEY_W)) + Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
	var input_dir = Vector2(x_mov, y_mov).clamp(Vector2(-1, -1), Vector2(1, 1))
	
	if input_dir.length() > 0:
		# Obtener la dirección hacia donde mira la cámara
		var cam_y_rot = 0.0
		if spring_arm:
			cam_y_rot = spring_arm.global_rotation.y
		
		# Calcular la dirección de movimiento relativa a la cámara
		var direction = Vector3(input_dir.x, 0, input_dir.y).rotated(Vector3.UP, cam_y_rot).normalized()
		
		# --- DASH MECHANIC ---
		if Input.is_key_pressed(KEY_SHIFT) and dash_cooldown <= 0 and is_on_floor():
			dash_time_left = 0.25
			dash_cooldown = 1.0
			current_scale = Vector3(1.4, 0.6, 1.4) # Aplastamiento horizontal de velocidad
			
		var speed_mult = 3.5 if dash_time_left > 0 else 1.0
		
		velocity.x = direction.x * SPEED * speed_mult
		velocity.z = direction.z * SPEED * speed_mult
		
		# Rotar el modelo del jugador para que mire hacia donde camina (El frente es -Z, por lo que sumamos PI)
		var target_angle = atan2(velocity.x, velocity.z) + PI
		
		for child in get_children():
			if child is MeshInstance3D or child.name.contains("alebrije"):
				# Aplicar Squash & Stretch visual
				var original_scale = Vector3(0.8, 0.8, 0.8) if child.name.contains("alebrije") else Vector3(1, 1, 1)
				child.scale = current_scale * original_scale
				
				# Si está haciendo spin attack, gira rápido, si no, rota suavemente hacia la dirección
				if spin_time_left > 0:
					child.rotation.y = spin_angle
				else:
					child.rotation.y = lerp_angle(child.rotation.y, target_angle, 10.0 * delta)
				
				# Animación Procedimental HUMANOIDE (Lagartija en 2 patas)
				var t = Time.get_ticks_msec() / 1000.0
				# Inclinación lateral del torso paso a paso
				child.rotation.z = lerp(child.rotation.z, sin(t * 12.0) * 0.15, 10.0 * delta)
				# Giro sutil de hombros
				var rot_offset = sin(t * 6.0) * 0.1
				if spin_time_left <= 0: child.rotation.y += rot_offset
				# Rebote orgánico (pasos)
				child.position.y = lerp(child.position.y, abs(sin(t * 12.0)) * 0.1, 10.0 * delta)
	else:
		velocity.x = move_toward(velocity.x, 0, SPEED)
		velocity.z = move_toward(velocity.z, 0, SPEED)
		
		# Mantener el spin attack visual aunque no se mueva
		for child in get_children():
			if child is MeshInstance3D or child.name.contains("alebrije"):
				# Aplicar Squash & Stretch en reposo también
				var original_scale = Vector3(0.8, 0.8, 0.8) if child.name.contains("alebrije") else Vector3(1, 1, 1)
				child.scale = current_scale * original_scale
				
				# Animación Procedimental (Respiración en Idle)
				var t = Time.get_ticks_msec() / 1000.0
				child.position.y = lerp(child.position.y, sin(t * 3.0) * 0.05, 10.0 * delta)
				child.rotation.z = lerp(child.rotation.z, 0.0, 10.0 * delta)
				
				if spin_time_left > 0:
					child.rotation.y = spin_angle

	move_and_slide()
	
	# Romper cajas al girar o aplastar (Mecánica tipo RE4/Crash)
	if spin_time_left > 0 or velocity.y < -15.0:
		for i in get_slide_collision_count():
			var col = get_slide_collision(i)
			var collider = col.get_collider()
			if collider and collider.has_method("break_crate"):
				collider.break_crate()
				if velocity.y < -5.0:
					velocity.y = 12.0 # Mini rebote al romper caja con ground pound
					
			# Atacar a enemigos con Piñata Spin Attack
			if collider and collider.has_method("recibir_dano") and spin_time_left > 0:
				collider.recibir_dano()
				velocity.y = 5.0 # Pequeño rebote al atinar un golpe
				
				# Efecto de rebote lateral (Knockback)
				var dir = (global_position - collider.global_position).normalized()
				velocity.x = dir.x * 10.0
				velocity.z = dir.z * 10.0

func recibir_dano(cantidad: int = 1):
	if invincibility_time > 0: return
	
	var real_hud = get_tree().get_root().find_child("HUD", true, false)
	if real_hud and real_hud.has_method("actualizar_vida"):
		real_hud.actualizar_vida(real_hud.vida - cantidad)
		real_hud.mostrar_notificacion("¡Ay! (-1 Vida)")
		
		# Knockback
		velocity.y = 10.0
		var cam_dir = -global_transform.basis.z # Hacia atrás
		if spring_arm: cam_dir = -spring_arm.global_transform.basis.z
		velocity.x = cam_dir.x * 15.0
		velocity.z = cam_dir.z * 15.0
		
		invincibility_time = 1.5
		
		# Muerte
		if real_hud.vida <= 0:
			global_position = spawn_point
			real_hud.actualizar_vida(3)
			real_hud.mostrar_notificacion("¡Reviviste en el Checkpoint!")
			velocity = Vector3.ZERO
