extends CharacterBody3D

const SPEED = 5.0
const JUMP_VELOCITY = 5.0
var jump_count = 0
var MAX_JUMPS = 1 # Se puede subir a 2 comprando alas
var mouse_sensitivity = 0.003

var unlocked_fire = false
var unlocked_wings = false
var fire_time_left = 0.0
var zarpazo_time_left = 0.0

var gravity = 20.0 # Gravedad más fuerte para quitar lo flotante
var spring_arm : SpringArm3D
var camera: Camera3D
var is_aiming = false
var default_spring_length = 4.0
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

var time_in_water = 0.0
var snake_spawn_timer = 3.0

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
		
		# Posicionamiento inicial al hombro (Offset a la derecha y arriba)
		spring_arm.position = Vector3(0.8, 1.6, 0) # Subimos la base de la cámara para no ver el suelo
		default_spring_length = spring_arm.spring_length
		spring_arm.margin = 0.3 # Margen de colisión para no atravesar paredes
		
		# Evitar que el SpringArm colisione con el propio jugador
		spring_arm.add_excluded_object(get_rid())
		
		# ¡CRÍTICO! Al reparentar, la cámara pierde su estado "current" en Godot, 
		# lo que causaba la "Pantalla Gris" de la muerte. Hay que reactivarla:
		for child in spring_arm.get_children():
			if child is Camera3D:
				child.make_current()
				camera = child

func _unhandled_input(event):
	if event is InputEventMouseMotion and camera_pivot and spring_arm:
		camera_pivot.rotate_y(-event.relative.x * mouse_sensitivity)
		spring_arm.rotate_x(-event.relative.y * mouse_sensitivity)
		# Permitir ver más hacia arriba y más hacia abajo sin romper el cuello
		spring_arm.rotation.x = clamp(spring_arm.rotation.x, -PI/2.2, PI/2.5)
		
	if event.is_action_pressed("ui_cancel"):
		if Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
			Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
		else:
			Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)

func _process(delta):
	# Movimiento de cámara con Mando (Stick Derecho)
	if camera_pivot and spring_arm:
		var joy_x = Input.get_joy_axis(0, JOY_AXIS_RIGHT_X)
		var joy_y = Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y)
		if abs(joy_x) > 0.1 or abs(joy_y) > 0.1:
			camera_pivot.rotate_y(-joy_x * 2.0 * delta)
			spring_arm.rotate_x(-joy_y * 2.0 * delta)
			spring_arm.rotation.x = clamp(spring_arm.rotation.x, -PI/2.2, PI/2.5)

func _physics_process(delta):
	if dash_cooldown > 0: dash_cooldown -= delta
	if dash_time_left > 0: dash_time_left -= delta
	
	is_aiming = Input.is_action_pressed("aim") and is_on_floor()
	var hud = get_tree().get_root().find_child("HUD", true, false)
	
	# Lógica de la Cámara y Apuntado (Estilo RE4)
	if camera and spring_arm:
		if is_aiming:
			# Al apuntar: acercamos la cámara, la hacemos más a la derecha y un poco hacia arriba para despejar la vista
			spring_arm.spring_length = lerp(spring_arm.spring_length, 1.2, 10.0 * delta)
			spring_arm.position.x = lerp(spring_arm.position.x, 1.5, 10.0 * delta)
			spring_arm.position.y = lerp(spring_arm.position.y, 2.0, 10.0 * delta)
			camera.fov = lerp(camera.fov, 50.0, 10.0 * delta)
			if hud and hud.has_method("set_crosshair"): hud.set_crosshair(true)
			
			if Input.is_action_just_pressed("shoot"):
				if cacao_score >= 1:
					cacao_score -= 1
					if hud: hud.actualizar_cacao(cacao_score)
					
					# Instanciar Proyectil
					if ResourceLoader.exists("res://scripts/proyectil.gd"):
						var p = load("res://scripts/proyectil.gd").new()
						p.position = camera.global_position - camera.global_transform.basis.z * 1.0 + camera.global_transform.basis.y * 0.2
						p.direction = -camera.global_transform.basis.z
						get_parent().add_child(p)
				else:
					if hud: hud.mostrar_notificacion("¡No tienes semillas de cacao!")
		else:
			# Cámara normal
			spring_arm.spring_length = lerp(spring_arm.spring_length, default_spring_length, 10.0 * delta)
			spring_arm.position.x = lerp(spring_arm.position.x, 0.8, 10.0 * delta)
			spring_arm.position.y = lerp(spring_arm.position.y, 1.6, 10.0 * delta)
			camera.fov = lerp(camera.fov, 75.0, 10.0 * delta)
			if hud and hud.has_method("set_crosshair"): hud.set_crosshair(false)
			
			# ZARPAZO (Solo si NO está apuntando)
			if Input.is_action_just_pressed("attack_basic") and zarpazo_time_left <= 0:
				zarpazo_time_left = 0.3
				var fwd = -global_transform.basis.z
				if camera_pivot: fwd = -camera_pivot.global_transform.basis.z
				
				# Daño frontal
				var enemies = get_tree().get_nodes_in_group("enemies")
				for e in enemies:
					if global_position.distance_to(e.global_position) < 3.0:
						var to_e = (e.global_position - global_position).normalized()
						if fwd.dot(to_e) > 0.5: # En el frente
							if e.has_method("recibir_dano"): e.recibir_dano()

	if zarpazo_time_left > 0:
		zarpazo_time_left -= delta
	
	if invincibility_time > 0:
		invincibility_time -= delta
		visible = int(invincibility_time * 10) % 2 == 0
	else:
		visible = true
		
	# --- MECÁNICA DEL PANTANO (RALENTIZAR Y SERPIENTES) ---
	var in_water = global_position.y < -4.8 and global_position.y > -10.0
	var current_speed = SPEED * 0.4 if in_water else SPEED
	
	if in_water:
		time_in_water += delta
		if time_in_water > snake_spawn_timer:
			time_in_water = 0.0
			if hud: hud.mostrar_notificacion("¡Una serpiente acecha en el agua!")
			
			if ResourceLoader.exists("res://scripts/snake.gd"):
				var snake = load("res://scripts/snake.gd").new()
				var offset = Vector3(randf_range(-6, 6), 0, randf_range(-6, 6))
				# Evitar spawnear exactamente encima del jugador
				if offset.length() < 3: offset = offset.normalized() * 3.0
				snake.position = global_position + offset
				snake.position.y = -5.5
				get_parent().add_child(snake)
	else:
		time_in_water = max(0.0, time_in_water - delta * 2.0)
	
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
	if global_position.y < -15.0:
		print("¡Caíste al vacío! Reapareciendo...")
		global_position = spawn_point
		velocity = Vector3.ZERO
	# --------------------------------
	
	# --------------------------------
	
	MAX_JUMPS = 1 # Físicas realistas: No hay doble salto
	if Input.is_action_just_pressed("jump") and jump_count < MAX_JUMPS:
		velocity.y = JUMP_VELOCITY
		jump_count += 1
		current_scale = Vector3(0.4, 1.7, 0.4) # Stretch estirado al saltar
		
	# --- ALIENTO DE FUEGO ---
	if unlocked_fire and Input.is_action_pressed("attack_fire"):
		fire_time_left = 0.1
		# (Aquí instanciarías partículas de fuego hacia adelante y aplicarías daño en cono)
		var fwd = -global_transform.basis.z
		if camera_pivot: fwd = -camera_pivot.global_transform.basis.z
		var enemies = get_tree().get_nodes_in_group("enemies")
		for e in enemies:
			if global_position.distance_to(e.global_position) < 4.0:
				var to_e = (e.global_position - global_position).normalized()
				if fwd.dot(to_e) > 0.7:
					if e.has_method("recibir_dano"): e.recibir_dano()
	
	if fire_time_left > 0: fire_time_left -= delta

	# --- MOVIMIENTO RELATIVO A LA CÁMARA ---
	var x_mov = Input.get_action_strength("move_right") - Input.get_action_strength("move_left")
	var y_mov = Input.get_action_strength("move_back") - Input.get_action_strength("move_forward")
	var input_dir = Vector2(x_mov, y_mov).clamp(Vector2(-1, -1), Vector2(1, 1))
	
	if input_dir.length() > 0:
		# Obtener la dirección hacia donde mira la cámara
		var cam_y_rot = 0.0
		if spring_arm:
			cam_y_rot = spring_arm.global_rotation.y
		
		# Calcular la dirección de movimiento relativa a la cámara
		var direction = Vector3(input_dir.x, 0, input_dir.y).rotated(Vector3.UP, cam_y_rot).normalized()
		
		# --- DASH MECHANIC ---
		if Input.is_action_pressed("dash") and dash_cooldown <= 0 and is_on_floor() and not is_aiming:
			dash_time_left = 0.25
			dash_cooldown = 1.0
			current_scale = Vector3(1.4, 0.6, 1.4) # Aplastamiento horizontal de velocidad
			
		if euphoria_time_left > 0:
			euphoria_time_left -= delta
			
		var speed_mult = 3.5 if dash_time_left > 0 else 1.0
		if is_aiming: speed_mult = 0.3 # Caminar lento apuntando
		if euphoria_time_left > 0:
			speed_mult *= 1.5 # 50% extra de velocidad eufórica constante
		
		velocity.x = direction.x * current_speed * speed_mult
		velocity.z = direction.z * current_speed * speed_mult
	else:
		velocity.x = move_toward(velocity.x, 0, current_speed)
		velocity.z = move_toward(velocity.z, 0, current_speed)
		
	var target_angle = 0.0
	var root_mesh = get_node_or_null("alebrije_tijuana")
	if root_mesh: target_angle = root_mesh.rotation.y
	
	if velocity.length_squared() > 0.01:
		target_angle = atan2(velocity.x, velocity.z) + PI
		
	if is_aiming: target_angle = camera_pivot.global_rotation.y
	
	animar_alebrije(delta, velocity.length() / SPEED, target_angle)

	move_and_slide()
	
	# Romper cajas (Mecánica tipo RE4/Crash)
	if zarpazo_time_left > 0 or velocity.y < -15.0:
		for i in get_slide_collision_count():
			var col = get_slide_collision(i)
			var collider = col.get_collider()
			if collider and collider.has_method("break_crate"):
				collider.break_crate()
				if velocity.y < -5.0:
					velocity.y = 12.0 # Mini rebote al romper caja con ground pound
					
			# Atacar a enemigos colisionados con zarpazo
			if collider and collider.has_method("recibir_dano") and zarpazo_time_left > 0:
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


var euphoria_time_left = 0.0

func recuperar_vida(cantidad: int):
	var hud = get_tree().get_root().find_child("HUD", true, false)
	if hud and hud.has_method("actualizar_vida"):
		hud.actualizar_vida(min(3, hud.vida + cantidad))

func activar_euforia(duracion: float):
	euphoria_time_left = duracion

func animar_alebrije(delta: float, speed_ratio: float, target_angle: float):
	var root = get_node_or_null("alebrije_tijuana")
	if not root: return
	
	root.rotation.y = lerp_angle(root.rotation.y, target_angle, 10.0 * delta)
	
	var torso = root.get_node_or_null("torso")
	var pecho = root.get_node_or_null("torso/pecho")
	var abdomen = root.get_node_or_null("torso/abdomen")
	
	var brazo_l = root.get_node_or_null("torso/pecho/brazo_l")
	var brazo_r = root.get_node_or_null("torso/pecho/brazo_r")
	var pierna_l = root.get_node_or_null("torso/abdomen/pierna_l")
	var pierna_r = root.get_node_or_null("torso/abdomen/pierna_r")
	var cola_root = root.get_node_or_null("torso/abdomen/cola")
	
	var t = Time.get_ticks_msec() / 1000.0
	
	if speed_ratio > 0.1:
		# Caminar
		if torso:
			torso.position.y = lerp(torso.position.y, 1.4 + abs(sin(t * 15.0)) * 0.15, 10.0 * delta)
			torso.rotation.z = lerp_angle(torso.rotation.z, sin(t * 7.5) * 0.05, 10.0 * delta)
			torso.rotation.x = lerp_angle(torso.rotation.x, 0.15, 10.0 * delta)
		if pecho and abdomen:
			pecho.rotation.z = sin(t * 15.0) * 0.05
			abdomen.rotation.z = -sin(t * 15.0) * 0.05
			
		if brazo_l and brazo_r and not is_aiming:
			brazo_l.rotation.x = sin(t * 15.0) * 0.6
			brazo_r.rotation.x = -sin(t * 15.0) * 0.6
			var codo_l = brazo_l.find_child("codo", true, false)
			if codo_l: codo_l.rotation.x = abs(sin(t * 15.0 - 0.5)) * 0.5
			var codo_r = brazo_r.find_child("codo", true, false)
			if codo_r: codo_r.rotation.x = abs(sin(-t * 15.0 - 0.5)) * 0.5
			
		if pierna_l and pierna_r:
			pierna_l.rotation.x = -sin(t * 15.0) * 0.6
			pierna_r.rotation.x = sin(t * 15.0) * 0.6
			var rodilla_l = pierna_l.find_child("rodilla", true, false)
			if rodilla_l: rodilla_l.rotation.x = -abs(sin(-t * 15.0 - 0.5)) * 0.5
			var rodilla_r = pierna_r.find_child("rodilla", true, false)
			if rodilla_r: rodilla_r.rotation.x = -abs(sin(t * 15.0 - 0.5)) * 0.5
	else:
		# Idle respiración
		if torso:
			torso.position.y = lerp(torso.position.y, 1.4 + sin(t * 3.0) * 0.05, 5.0 * delta)
			torso.rotation.z = lerp_angle(torso.rotation.z, 0.0, 5.0 * delta)
			torso.rotation.x = lerp_angle(torso.rotation.x, 0.0, 5.0 * delta)
		if pecho and abdomen:
			pecho.rotation.z = lerp_angle(pecho.rotation.z, 0.0, 5.0 * delta)
			abdomen.rotation.z = lerp_angle(abdomen.rotation.z, 0.0, 5.0 * delta)
			# Expansión del pecho
			var breath = 1.0 + sin(t * 3.0) * 0.03
			pecho.scale = Vector3(breath, 1.0, breath)
			
		if pierna_l and pierna_r:
			pierna_l.rotation.x = lerp_angle(pierna_l.rotation.x, 0.0, 10.0 * delta)
			pierna_r.rotation.x = lerp_angle(pierna_r.rotation.x, 0.0, 10.0 * delta)
			var r_l = pierna_l.find_child("rodilla", true, false); if r_l: r_l.rotation.x = lerp_angle(r_l.rotation.x, 0.0, 10.0 * delta)
			var r_r = pierna_r.find_child("rodilla", true, false); if r_r: r_r.rotation.x = lerp_angle(r_r.rotation.x, 0.0, 10.0 * delta)
			
		if brazo_l and brazo_r and not is_aiming:
			brazo_l.rotation.x = lerp_angle(brazo_l.rotation.x, 0.0, 10.0 * delta)
			brazo_r.rotation.x = lerp_angle(brazo_r.rotation.x, 0.0, 10.0 * delta)
			var c_l = brazo_l.find_child("codo", true, false); if c_l: c_l.rotation.x = lerp_angle(c_l.rotation.x, 0.0, 10.0 * delta)
			var c_r = brazo_r.find_child("codo", true, false); if c_r: c_r.rotation.x = lerp_angle(c_r.rotation.x, 0.0, 10.0 * delta)
			
	# Ataque
	if zarpazo_time_left > 0 and not is_aiming:
		if brazo_r and brazo_l:
			brazo_r.rotation.x = lerp_angle(brazo_r.rotation.x, -PI/2, 20.0 * delta)
			brazo_l.rotation.x = lerp_angle(brazo_l.rotation.x, -PI/2, 20.0 * delta)
			var c_l = brazo_l.find_child("codo", true, false); if c_l: c_l.rotation.x = lerp_angle(c_l.rotation.x, -PI/4, 20.0 * delta)
			var c_r = brazo_r.find_child("codo", true, false); if c_r: c_r.rotation.x = lerp_angle(c_r.rotation.x, -PI/4, 20.0 * delta)
	
	# Apuntar (Arma)
	if is_aiming and brazo_r:
		brazo_r.rotation.x = lerp_angle(brazo_r.rotation.x, deg_to_rad(80.0), 15.0 * delta)
		brazo_r.rotation.z = lerp_angle(brazo_r.rotation.z, deg_to_rad(20.0), 15.0 * delta)
		var c_r = brazo_r.find_child("codo", true, false); if c_r: c_r.rotation.x = lerp_angle(c_r.rotation.x, 0.0, 15.0 * delta)
	elif brazo_r and zarpazo_time_left <= 0 and speed_ratio <= 0.1:
		brazo_r.rotation.z = lerp_angle(brazo_r.rotation.z, 0.0, 10.0 * delta)
		
	# Curva Matemática de Nivel para la Cola (Ondulación desfasada)
	if cola_root:
		for i in range(5):
			var seg = cola_root.find_child("seg_" + str(i), true, false)
			if seg:
				var offset = i * 0.5
				var freq = 5.0
				var amplitude = 0.2
				if speed_ratio > 0.1:
					freq = 15.0
					amplitude = 0.4
				seg.rotation.y = sin(t * freq - offset) * amplitude
				seg.rotation.x = cos(t * freq * 0.5 - offset) * (amplitude * 0.5)
