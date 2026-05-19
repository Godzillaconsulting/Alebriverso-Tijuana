extends Node3D

var player_ref

# --- MATERIALES DEL MICTLÁN ---
var mat_obsidiana = StandardMaterial3D.new()
var mat_cempasuchil = StandardMaterial3D.new()
var mat_portal = StandardMaterial3D.new()
var mat_madera = StandardMaterial3D.new()
var mat_tronco = StandardMaterial3D.new()
var mat_craneo = StandardMaterial3D.new()
var mat_arbol_muerto = StandardMaterial3D.new()
var mat_pared_caliza = StandardMaterial3D.new()
var mat_suelo_tierra = StandardMaterial3D.new()
var mat_agua = StandardMaterial3D.new()

func load_tex(file_name: String) -> Texture2D:
	var path = ProjectSettings.globalize_path("res://textures/" + file_name)
	if FileAccess.file_exists(path):
		var img = Image.load_from_file(path)
		if img: return ImageTexture.create_from_image(img)
	return null

func configurar_controles():
	var acciones = ["move_forward", "move_back", "move_left", "move_right", "attack_basic", "attack_fire", "jump", "dash", "interact", "aim", "shoot"]
	for a in acciones:
		if not InputMap.has_action(a):
			InputMap.add_action(a)
	
	var k_w = InputEventKey.new(); k_w.keycode = KEY_W; InputMap.action_add_event("move_forward", k_w)
	var j_up = InputEventJoypadMotion.new(); j_up.axis = JOY_AXIS_LEFT_Y; j_up.axis_value = -1.0; InputMap.action_add_event("move_forward", j_up)
	
	var k_s = InputEventKey.new(); k_s.keycode = KEY_S; InputMap.action_add_event("move_back", k_s)
	var j_down = InputEventJoypadMotion.new(); j_down.axis = JOY_AXIS_LEFT_Y; j_down.axis_value = 1.0; InputMap.action_add_event("move_back", j_down)
	
	var k_a = InputEventKey.new(); k_a.keycode = KEY_A; InputMap.action_add_event("move_left", k_a)
	var j_left = InputEventJoypadMotion.new(); j_left.axis = JOY_AXIS_LEFT_X; j_left.axis_value = -1.0; InputMap.action_add_event("move_left", j_left)
	
	var k_d = InputEventKey.new(); k_d.keycode = KEY_D; InputMap.action_add_event("move_right", k_d)
	var j_right = InputEventJoypadMotion.new(); j_right.axis = JOY_AXIS_LEFT_X; j_right.axis_value = 1.0; InputMap.action_add_event("move_right", j_right)
	
	var m_l = InputEventMouseButton.new(); m_l.button_index = MOUSE_BUTTON_LEFT; InputMap.action_add_event("attack_basic", m_l)
	var j_x = InputEventJoypadButton.new(); j_x.button_index = JOY_BUTTON_X; InputMap.action_add_event("attack_basic", j_x)
	
	var k_r = InputEventKey.new(); k_r.keycode = KEY_R; InputMap.action_add_event("attack_fire", k_r)
	var j_y = InputEventJoypadButton.new(); j_y.button_index = JOY_BUTTON_Y; InputMap.action_add_event("attack_fire", j_y)
	
	var k_sp = InputEventKey.new(); k_sp.keycode = KEY_SPACE; InputMap.action_add_event("jump", k_sp)
	var j_a = InputEventJoypadButton.new(); j_a.button_index = JOY_BUTTON_A; InputMap.action_add_event("jump", j_a)
	
	var k_sh = InputEventKey.new(); k_sh.keycode = KEY_SHIFT; InputMap.action_add_event("dash", k_sh)
	var j_b = InputEventJoypadButton.new(); j_b.button_index = JOY_BUTTON_B; InputMap.action_add_event("dash", j_b)
	
	var k_e = InputEventKey.new(); k_e.keycode = KEY_E; InputMap.action_add_event("interact", k_e)
	var j_rb = InputEventJoypadButton.new(); j_rb.button_index = JOY_BUTTON_RIGHT_SHOULDER; InputMap.action_add_event("interact", j_rb)
	
	# Apuntar (Click Derecho / LT)
	var m_r = InputEventMouseButton.new(); m_r.button_index = MOUSE_BUTTON_RIGHT; InputMap.action_add_event("aim", m_r)
	var j_lt = InputEventJoypadMotion.new(); j_lt.axis = JOY_AXIS_TRIGGER_LEFT; j_lt.axis_value = 1.0; InputMap.action_add_event("aim", j_lt)
	
	# Disparar (Click Izquierdo / RT)
	# MOUSE_BUTTON_LEFT ya está en attack_basic, pero se puede reusar, la lógica del jugador diferenciará si está apuntando
	var m_l2 = InputEventMouseButton.new(); m_l2.button_index = MOUSE_BUTTON_LEFT; InputMap.action_add_event("shoot", m_l2)
	var j_rt = InputEventJoypadMotion.new(); j_rt.axis = JOY_AXIS_TRIGGER_RIGHT; j_rt.axis_value = 1.0; InputMap.action_add_event("shoot", j_rt)

func _init():
	var tex_obsidiana = load_tex("obsidian_texture_1779131930589.jpg")
	var tex_madera = load_tex("wood_crate_1779131943519.jpg")
	var tex_pasto = load_tex("grass_texture_1779131919859.jpg")
	var tex_caliza = load_tex("limestone_mossy.png") # Fotorrealista generado
	
	# Normal map procedimental (para que reaccione a la luz 3D)
	var noise_normal = FastNoiseLite.new()
	noise_normal.noise_type = FastNoiseLite.TYPE_CELLULAR
	noise_normal.frequency = 0.05
	var normal_tex = NoiseTexture2D.new()
	normal_tex.noise = noise_normal
	normal_tex.as_normal_map = true
	normal_tex.bump_strength = 2.5
	
	# MATERIAL OBSIDIANA (Ruinas Mictlán realistas)
	var mat_shader_fallback = StandardMaterial3D.new()
	if tex_obsidiana:
		mat_shader_fallback.albedo_texture = tex_obsidiana
		mat_shader_fallback.uv1_triplanar = true
		mat_shader_fallback.uv1_scale = Vector3(1.0, 1.0, 1.0)
	else:
		mat_shader_fallback.albedo_color = Color(0.3, 0.3, 0.3)
	mat_shader_fallback.roughness = 0.4 # Más brillante
	mat_shader_fallback.metallic = 0.8
	mat_shader_fallback.normal_enabled = true
	mat_shader_fallback.normal_texture = normal_tex
	
	# MATERIAL ÁRBOLES MUERTOS
	mat_arbol_muerto.albedo_color = Color(0.2, 0.18, 0.15)
	mat_arbol_muerto.roughness = 0.9
	
	mat_obsidiana = mat_shader_fallback

	# MATERIAL PAREDES CALIZA (CUEVA GRABADA FOTORREALISTA)
	if tex_caliza:
		mat_pared_caliza.albedo_texture = tex_caliza
		mat_pared_caliza.uv1_triplanar = true
		mat_pared_caliza.uv1_scale = Vector3(0.5, 0.5, 0.5)
	else:
		mat_pared_caliza.albedo_color = Color(0.1, 0.1, 0.1)
	mat_pared_caliza.normal_enabled = true
	mat_pared_caliza.normal_texture = normal_tex
	mat_pared_caliza.roughness = 1.0 # Roca completamente mate (no brillosa)
	mat_pared_caliza.metallic = 0.0
	mat_pared_caliza.specular = 0.1 # Reducir brillo plastico
	
	# MATERIAL LAGO DE TEXCOCO (Agua)
	mat_agua.albedo_color = Color(0.3, 0.35, 0.4, 0.85)
	mat_agua.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat_agua.roughness = 0.1
	mat_agua.metallic = 0.6
	mat_agua.refraction_enabled = true
	mat_agua.refraction_scale = 0.02

	# MATERIAL CAJAS
	if tex_madera:
		mat_madera.albedo_texture = tex_madera
		mat_madera.uv1_triplanar = true
	else:
		mat_madera.albedo_color = Color(0.5, 0.35, 0.2)
	mat_madera.roughness = 0.9

	# MATERIAL SUELO DE TIERRA/
	var tex_lodo = load_tex("mud_ground.png")
	if tex_lodo:
		mat_suelo_tierra.albedo_texture = tex_lodo
		mat_suelo_tierra.uv1_triplanar = true
		mat_suelo_tierra.uv1_scale = Vector3(0.5, 0.5, 0.5)
	else:
		mat_suelo_tierra.albedo_color = Color(0.2, 0.15, 0.1) # Tierra oscura húmeda
	
	mat_suelo_tierra.normal_enabled = true
	mat_suelo_tierra.normal_texture = normal_tex # Reusamos el de las rocas para darle volumen
	mat_suelo_tierra.roughness = 1.0 # Tierra seca completamente mate
	mat_suelo_tierra.metallic = 0.0
	
	# MATERIAL FLORES CEMPASÚCHIL
	if tex_pasto:
		mat_cempasuchil.albedo_texture = tex_pasto
		mat_cempasuchil.uv1_triplanar = true
		mat_cempasuchil.uv1_scale = Vector3(0.1, 0.1, 0.1)
	
	mat_cempasuchil.albedo_color = Color(1.0, 0.6, 0.0)
	mat_cempasuchil.emission_enabled = true
	mat_cempasuchil.emission = Color(1.0, 0.5, 0.0)
	mat_cempasuchil.emission_energy_multiplier = 0.8
	
	mat_portal.albedo_color = Color(0.0, 1.0, 0.8)
	mat_portal.emission_enabled = true
	mat_portal.emission = Color(0.0, 1.0, 0.8)
	mat_portal.emission_energy_multiplier = 1.0
	
	# Árboles (Estilo RE4 2005: Madera muerta, oscura y lúgubre)
	mat_tronco.albedo_color = Color(0.4, 0.35, 0.3)
	mat_tronco.emission_enabled = false

func _ready():
	print("Inicializando Nivel 1: El Umbral del Mictlán...")
	
	# 0. HUD MINIMALISTA (script externo hud.gd)
	var hud_node = load("res://scripts/hud.gd").new()
	hud_node.name = "HUD"
	add_child(hud_node)
	
	# 0.5 DIRECTOR DE CINEMÁTICAS
	var cine_manager = load("res://scripts/cinematic_manager.gd").new()
	cine_manager.name = "CinematicManager"
	add_child(cine_manager)

	# 1. ATMÓSFERA MICTLÁN AUTÉNTICA (Skybox HDR)
	var env = WorldEnvironment.new()
	var sky_env = Environment.new()
	
	sky_env.background_mode = Environment.BG_COLOR
	sky_env.background_color = Color(0.45, 0.5, 0.55) # Cielo nublado clásico
		
	sky_env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	sky_env.ambient_light_color = Color(0.65, 0.65, 0.7) # Mucho más brillante para visibilidad perfecta
	sky_env.fog_enabled = true
	sky_env.fog_light_color = Color(0.45, 0.5, 0.55) # Niebla gris clara
	sky_env.fog_density = 0.005 # Niebla un poco más densa para ocultar el fondo
	sky_env.glow_enabled = true
	sky_env.glow_intensity = 0.4
	sky_env.glow_bloom = 0.05
	sky_env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	
	# Filtro Cinemático RE4 2005 (Desaturado y Alto Contraste)
	sky_env.tonemap_mode = 3 # ACES Tonemap
	sky_env.adjustment_enabled = true
	sky_env.adjustment_saturation = 0.75 # Un poco más de color
	sky_env.adjustment_contrast = 1.1 # Contraste suave
	env.environment = sky_env
	add_child(env)
	
	var sol = DirectionalLight3D.new()
	sol.rotation_degrees = Vector3(-45, 150, 0)
	sol.light_color = Color(0.9, 0.9, 0.9) # Luz casi blanca para no teñir todo de azul
	sol.light_energy = 1.2
	sol.shadow_enabled = true
	add_child(sol)

	# 2. JUGADOR
	var player = CharacterBody3D.new()
	player_ref = player
	player.set_script(load("res://scripts/player.gd"))
	add_child(player)
	player.position = Vector3(0, -4.5, 0) # Spawn al inicio del camino lineal

	var tijuana_mesh = crear_modelo_tijuana()
	tijuana_mesh.name = "alebrije_tijuana" # Detectado por player.gd para animación
	player.add_child(tijuana_mesh)

	var p_col = CollisionShape3D.new()
	var p_shape = CapsuleShape3D.new()
	p_shape.radius = 0.5; p_shape.height = 2.0
	p_col.shape = p_shape; p_col.position.y = 1.0
	player.add_child(p_col)

	var spring_arm = SpringArm3D.new()
	spring_arm.name = "SpringArm"
	spring_arm.position = Vector3(0.5, 1.5, 0)
	spring_arm.spring_length = 4.5
	spring_arm.margin = 0.5
	var shape = SphereShape3D.new()
	shape.radius = 0.5
	spring_arm.shape = shape
	player.add_child(spring_arm)
	var cam = Camera3D.new()
	cam.rotation_degrees.x = -5
	cam.current = true
	spring_arm.add_child(cam)
	
	# Spawn Combi Portal
	crear_portal_combi(Vector3(0, -5, -190))

	# 3. LAGO DE TEXCOCO (Agua que ralentiza)
	var lago = StaticBody3D.new()
	var l_mesh_inst = MeshInstance3D.new()
	var l_mesh = BoxMesh.new(); l_mesh.size = Vector3(500, 0.5, 500)
	l_mesh_inst.mesh = l_mesh; l_mesh_inst.material_override = mat_agua
	lago.add_child(l_mesh_inst)
	var l_col = CollisionShape3D.new()
	var l_shape = BoxShape3D.new(); l_shape.size = l_mesh.size
	l_col.shape = l_shape
	lago.add_child(l_col)
	lago.position = Vector3(0, -6, 0)
	lago.name = "Lago_Texcoco"
	add_child(lago)
	# EL CAMINO PRINCIPAL (El Embudo Lineal RE4)
	var spawn_plat = StaticBody3D.new()
	var s_mesh_inst = MeshInstance3D.new()
	var s_mesh = BoxMesh.new(); s_mesh.size = Vector3(36, 1, 250)
	s_mesh_inst.mesh = s_mesh; s_mesh_inst.material_override = mat_suelo_tierra
	spawn_plat.add_child(s_mesh_inst)
	var s_col = CollisionShape3D.new()
	var s_shape = BoxShape3D.new(); s_shape.size = s_mesh.size
	s_col.shape = s_shape
	spawn_plat.add_child(s_col)
	spawn_plat.position = Vector3(0, -4.5, -100)
	spawn_plat.name = "Camino_Principal"
	add_child(spawn_plat)
	
	# === PUNTO DE LLEGADA (LA COMBI) ===
	# Barricada detrás del jugador
	for i in range(5):
		var tronco = MeshInstance3D.new()
		var t_mesh = CylinderMesh.new(); t_mesh.radius = 0.5; t_mesh.height = 12
		tronco.mesh = t_mesh; tronco.material_override = mat_arbol_muerto
		tronco.position = Vector3(randf_range(-15, 15), -4.0, 15 + randf_range(-1, 1))
		tronco.rotation_degrees = Vector3(90, randf_range(-10, 10), 0)
		var t_body = StaticBody3D.new(); var t_col = CollisionShape3D.new(); var t_shape = CapsuleShape3D.new(); t_shape.radius = 0.5; t_shape.height = 12
		t_body.add_child(t_col); t_col.shape = t_shape; tronco.add_child(t_body)
		add_child(tronco)
		
	crear_combi_inicio(Vector3(-5, -4.5, 8))
	
	# 4.5 FONDOS Y LORE VISUAL INALCANZABLE (La colisión de las épocas)
	crear_lore_visual()

	# --- BARRERAS NATURALES Y CUEVAS (El Embudo Lineal Orgánico) ---
	var canon_scene = load("res://assets/models/canon_modulo.glb") if ResourceLoader.exists("res://assets/models/canon_modulo.glb") else null
	var cueva_scene = load("res://assets/models/cueva_tunel.glb") if ResourceLoader.exists("res://assets/models/cueva_tunel.glb") else null
	
	# Generar paredes de cañón procedurales para cuando falten los GLB
	for z_canyon in range(0, -210, -20):
		# Pared izquierda
		for height_i in range(3):
			var wall_l = MeshInstance3D.new()
			var wl_mesh = SphereMesh.new(); wl_mesh.radius = randf_range(3.0, 6.0); wl_mesh.height = wl_mesh.radius * 2.2
			wall_l.mesh = wl_mesh; wall_l.material_override = mat_pared_caliza
			wall_l.position = Vector3(-20 + randf_range(-2, 2), -2 + height_i * 4, z_canyon + randf_range(-4, 4))
			var wl_body = StaticBody3D.new(); var wl_col = CollisionShape3D.new(); var wl_shape = SphereShape3D.new(); wl_shape.radius = wl_mesh.radius * 0.9; wl_col.shape = wl_shape; wl_body.add_child(wl_col); wall_l.add_child(wl_body)
			add_child(wall_l)
		# Pared derecha
		for height_i in range(3):
			var wall_r = MeshInstance3D.new()
			var wr_mesh = SphereMesh.new(); wr_mesh.radius = randf_range(3.0, 6.0); wr_mesh.height = wr_mesh.radius * 2.2
			wall_r.mesh = wr_mesh; wall_r.material_override = mat_pared_caliza
			wall_r.position = Vector3(20 + randf_range(-2, 2), -2 + height_i * 4, z_canyon + randf_range(-4, 4))
			var wr_body = StaticBody3D.new(); var wr_col = CollisionShape3D.new(); var wr_shape = SphereShape3D.new(); wr_shape.radius = wr_mesh.radius * 0.9; wr_col.shape = wr_shape; wr_body.add_child(wr_col); wall_r.add_child(wr_body)
			add_child(wall_r)
		# Árbol muerto a los costados
		crear_arbol_caido(Vector3(-10 + randf_range(-3,3), -4.0, z_canyon + randf_range(-5,5)), randf_range(0, 360))
		crear_arbol_caido(Vector3(10 + randf_range(-3,3), -4.0, z_canyon + randf_range(-5,5)), randf_range(0, 360))
	
	for z in range(5, -205, -10):
		var modulo
		# Mitad 1: Cañón Abierto, Mitad 2: Cueva Cerrada
		if z > -100:
			if canon_scene: modulo = canon_scene.instantiate()
		else:
			if cueva_scene: modulo = cueva_scene.instantiate()
			
			# Ambientación de Cueva (Antorchas y Raíces colgantes)
			if z % 20 == 0 or z % 20 == -10: # Cada 10 metros
				var luz = OmniLight3D.new()
				luz.light_color = Color(1.0, 0.4, 0.1) # Fuego naranja/rojo
				luz.light_energy = 3.5
				luz.omni_range = 15.0
				luz.position = Vector3(0, 5, z)
				add_child(luz)
				
				# Raíz colgando del techo (Árbol invertido)
				var raiz = load("res://models/arbol_muerto_re4.glb") if ResourceLoader.exists("res://models/arbol_muerto_re4.glb") else null
				if raiz:
					var r_node = raiz.instantiate()
					r_node.position = Vector3(randf_range(-4, 4), 10, z)
					r_node.rotation_degrees = Vector3(180, randf_range(0, 360), randf_range(-20, 20))
					add_child(r_node)
		
		if modulo:
			modulo.position = Vector3(0, -3, z)
			add_child(modulo)
			
			# Aplicar material realista recursivamente
			aplicar_material_glb(modulo, mat_pared_caliza)
			
			# Generar colisiones recursivamente
			var func_colision = func(nodo: Node, f: Callable):
				if nodo is MeshInstance3D: nodo.create_trimesh_collision()
				for hijo in nodo.get_children(): f.call(hijo, f)
			func_colision.call(modulo, func_colision)
		
		# Decoración en el suelo (Árboles y rocas caídas normales)
		crear_arbol_caido(Vector3(-8 if randi() % 2 == 0 else 8, -4, z + randf_range(-3, 3)), randf_range(0, 360))

	# Vegetación y Lluvia (Atmósfera RE4)
	var rain = GPUParticles3D.new()
	rain.amount = 4000; rain.lifetime = 1.5
	var rain_mat = ParticleProcessMaterial.new()
	rain_mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	rain_mat.emission_box_extents = Vector3(40, 1, 120)
	rain_mat.direction = Vector3(0, -1, 0)
	rain_mat.initial_velocity_min = 20.0; rain_mat.initial_velocity_max = 30.0
	rain.process_material = rain_mat
	var drop_mesh = RibbonTrailMesh.new()
	drop_mesh.size = 0.05; drop_mesh.section_length = 0.8
	var mat_drop = StandardMaterial3D.new(); mat_drop.albedo_color = Color(0.7, 0.8, 0.9, 0.5)
	mat_drop.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; mat_drop.emission_enabled = true; mat_drop.emission = Color(0.5, 0.6, 0.7); mat_drop.emission_energy_multiplier = 0.2
	drop_mesh.material = mat_drop
	rain.draw_pass_1 = drop_mesh
	rain.position = Vector3(0, 20, -100)
	rain.visibility_aabb = AABB(Vector3(-50, -30, -150), Vector3(100, 60, 300))
	add_child(rain)
	
	# Mercader Tianguis (La Tiendita)
	var merchant = load("res://scripts/merchant.gd").new()
	merchant.position = Vector3(12, -4, -40)
	add_child(merchant)
	
	# Trigger de Emboscada (Flujo tipo RE4: Primero explorar, luego pelear)
	var ambush_trigger = Area3D.new()
	var at_col = CollisionShape3D.new()
	var at_shape = BoxShape3D.new(); at_shape.size = Vector3(30, 20, 10)
	at_col.shape = at_shape
	ambush_trigger.add_child(at_col)
	ambush_trigger.position = Vector3(0, 0, -90)
	
	ambush_trigger.body_entered.connect(func(body):
		if body == player_ref and not ambush_trigger.has_meta("triggered"):
			ambush_trigger.set_meta("triggered", true)
			var hud = get_node_or_null("HUD")
			if hud: hud.mostrar_notificacion("¡Te han acorralado! ¡Sobrevive!")
			
			# Spawnear 8 jaguares adelante y atrás (El clásico asalto del pueblo)
			for i in range(8):
				var enemy = load("res://scripts/enemy.gd").new()
				var z_offset = -110 if i % 2 == 0 else -70 # Adelante y atrás
				enemy.position = Vector3(randf_range(-12, 12), -4.0, z_offset + randf_range(-10, 10))
				add_child(enemy)
	)
	add_child(ambush_trigger)
		
	# Zonas de cajas tipo RE4 para lootear antes y después de pelear
	for i in range(3): crear_caja(Vector3(-12, -3.5, -30 - i*2))
	for i in range(4): crear_caja(Vector3(12, -3.5, -120 - i*2))
	
	# Portal de salida del nivel muy al fondo (Destino final: La Combi)
	crear_portal_checkpoint(Vector3(0, -4.5, -190))
	
	configurar_controles()

	# Boss Tezcatlipoca
	var boss = load("res://scripts/enemy.gd").new()
	boss.is_boss = true
	boss.position = Vector3(0, 50.0, -350) # Cima de la pirámide
	add_child(boss)

	# BARRERA DE ROCAS ORGÁNICAS Y CAÍDAS (Cerrando el cañón de forma natural)
	for i in range(12):
		var roca = MeshInstance3D.new()
		var sph_mesh = SphereMesh.new(); sph_mesh.radius = randf_range(4.0, 7.0); sph_mesh.height = sph_mesh.radius * randf_range(1.5, 2.5)
		roca.mesh = sph_mesh; roca.material_override = mat_pared_caliza
		roca.position = Vector3(randf_range(-25, 25), randf_range(-2, 4), -45 + randf_range(-5, 5))
		roca.rotation_degrees = Vector3(randf_range(-30, 30), randf_range(0, 360), randf_range(-30, 30))
		var r_col = CollisionShape3D.new(); var r_shape = SphereShape3D.new(); r_shape.radius = sph_mesh.radius * 0.9
		r_col.shape = r_shape
		var static_body = StaticBody3D.new(); static_body.add_child(r_col); roca.add_child(static_body)
		add_child(roca)
		
	# Zonas de cajas tipo RE4
	for i in range(5): crear_caja(Vector3(-20 + i*2, 1, -150))
	for i in range(5): crear_caja(Vector3(20 - i*2, 1, -150))
	
	# Portal de salida del nivel muy al fondo (Destino final: La Combi)
	crear_portal_checkpoint(Vector3(0, 1, -190))
	
	# === INICIAR CINEMÁTICA INTRODUCTORIA ===
	var c_mgr = get_node_or_null("CinematicManager")
	if c_mgr: c_mgr.play_intro_cutscene(player_ref)

# --- LÓGICA DE PUZZLE (TIPO RE4) ---
var switches_activados = 0
var muro_bloqueo = null

func crear_tzompantli(pos: Vector3, columnas: int):
	pass # Eliminado para quitar esferas feas

func crear_calendario_azteca(pos: Vector3):
	pass # Eliminado para quitar polígonos feos

func crear_npc_xolo(pos: Vector3):
	var npc = Area3D.new()
	var col = CollisionShape3D.new()
	var shape = SphereShape3D.new()
	shape.radius = 3.0 # Rango de conversación
	col.shape = shape
	npc.add_child(col)
	
	# ENSAMBLAJE PROCEDURAL: PERRO XOLOITZCUINTLE (FANTASMAL)
	var xolo_pivot = Node3D.new()
	xolo_pivot.scale = Vector3(0.5, 0.5, 0.5)
	
	var mat_espiritu = StandardMaterial3D.new()
	mat_espiritu.albedo_color = Color(0.1, 0.9, 1.0, 0.6) # Azul/Cian fantasma
	mat_espiritu.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat_espiritu.emission_enabled = true; mat_espiritu.emission = Color(0.0, 1.0, 0.8); mat_espiritu.emission_energy_multiplier = 0.8
	
	var crear_pieza = func(padre, mesh_type, size, pos, rot):
		var mesh_inst = MeshInstance3D.new()
		var m
		if mesh_type == "capsule": m = CapsuleMesh.new(); m.radius = size.x; m.height = size.y; m.radial_segments = 12
		elif mesh_type == "cylinder": m = CylinderMesh.new(); m.top_radius=size.x; m.bottom_radius=size.x; m.height=size.y; m.radial_segments=10
		else: m = BoxMesh.new(); m.size = size
		mesh_inst.mesh = m; mesh_inst.material_override = mat_espiritu
		mesh_inst.position = pos; mesh_inst.rotation_degrees = rot
		padre.add_child(mesh_inst)
		return mesh_inst
		
	# Cuerpo Perro
	var cuerpo = crear_pieza.call(xolo_pivot, "capsule", Vector2(0.4, 1.2), Vector3(0, 0.8, 0), Vector3(90, 0, 0))
	var cuello = crear_pieza.call(cuerpo, "capsule", Vector2(0.25, 0.6), Vector3(0, 0.5, 0.2), Vector3(-45, 0, 0))
	var cabeza = crear_pieza.call(cuello, "capsule", Vector2(0.2, 0.4), Vector3(0, 0.3, 0.1), Vector3(-45, 0, 0))
	var hocico = crear_pieza.call(cabeza, "cylinder", Vector2(0.12, 0.3), Vector3(0, 0.1, 0.2), Vector3(-90, 0, 0))
	
	# Orejas puntiagudas de Xolo
	for i in [-1, 1]:
		var pr = PrismMesh.new(); pr.size = Vector3(0.1, 0.3, 0.05); var oreja = MeshInstance3D.new()
		oreja.mesh = pr; oreja.material_override = mat_espiritu
		oreja.position = Vector3(0.15*i, 0.2, -0.05); oreja.rotation_degrees.z = 20*i
		cabeza.add_child(oreja)
		
	# Patas (4)
	crear_pieza.call(cuerpo, "capsule", Vector2(0.15, 0.8), Vector3(0.25, 0.4, -0.4), Vector3(90, 0, 0)) # Delantera Der
	crear_pieza.call(cuerpo, "capsule", Vector2(0.15, 0.8), Vector3(-0.25, 0.4, -0.4), Vector3(90, 0, 0)) # Delantera Izq
	crear_pieza.call(cuerpo, "capsule", Vector2(0.18, 0.8), Vector3(0.25, -0.4, -0.4), Vector3(90, 0, 0)) # Trasera Der
	crear_pieza.call(cuerpo, "capsule", Vector2(0.18, 0.8), Vector3(-0.25, -0.4, -0.4), Vector3(90, 0, 0)) # Trasera Izq
	
	# Cola
	crear_pieza.call(cuerpo, "cylinder", Vector2(0.08, 0.6), Vector3(0, -0.6, 0.1), Vector3(45, 0, 0))

	
	animar_tijuana(xolo_pivot) # Reproducirá "Trot" o animación default
	
	npc.add_child(xolo_pivot)
	
	npc.set_meta("dialogo_idx", 0)
	var dialogos = [
		"🐾 Xolo: Híjole, otro perdido. A ver, chato, la salida no es por aquí...",
		"🐾 Xolo: ¡Guau! Digo... fíjate bien. El muro grande no se va a abrir si no le sobas los altares.",
		"🐾 Xolo: Uno menos. Ya nomás faltan dos. Uf, qué cansancio, me voy a echar una siestita.",
		"🐾 Xolo: ¡Milagro! Ya se abrió. Pásale, pásale, pero no me pidas que te acompañe allá adentro."
	]
	
	npc.body_entered.connect(func(body):
		if body == player_ref:
			var hud = get_node_or_null("HUD")
			if hud:
				var idx = npc.get_meta("dialogo_idx")
				hud.mostrar_notificacion(dialogos[idx])
				npc.set_meta("dialogo_idx", min(idx + 1, dialogos.size() - 1))
	)
	npc.position = pos
	add_child(npc)

# --- HELPERS DE COLOR ---
func aplicar_material(nodo: Node, mat: Material):
	if nodo is MeshInstance3D:
		nodo.material_override = mat
	for hijo in nodo.get_children():
		aplicar_material(hijo, mat)

func cargar_glb_runtime(path: String) -> Node3D:
	var gltf = GLTFDocument.new()
	var state = GLTFState.new()
	var real_path = ProjectSettings.globalize_path(path)
	if FileAccess.file_exists(real_path):
		var err = gltf.append_from_file(real_path, state)
		if err == OK: return gltf.generate_scene(state)
	return null

# --- CONSTRUCTORES NATIVOS (100% PRECISOS PARA FÍSICAS) ---
func crear_lore_visual():
	# Generar estructuras masivas en los bordes para inmersión
	for x in [-120, 120]:
		for z in [-200, -100, 0, 100]:
			var fondo = Node3D.new()
			fondo.position = Vector3(x + randf_range(-20, 20), -10, z + randf_range(-20, 20))
			
			# Pirámide de fondo
			var pira = MeshInstance3D.new()
			var p_mesh = PrismMesh.new(); p_mesh.size = Vector3(60, 40, 60)
			pira.mesh = p_mesh; pira.material_override = mat_pared_caliza
			pira.position.y = 20
			fondo.add_child(pira)
			
			# Edificio moderno incrustado (Rascacielos roto)
			var rascacielos = MeshInstance3D.new()
			var r_mesh = BoxMesh.new(); r_mesh.size = Vector3(15, 80, 15)
			rascacielos.mesh = r_mesh
			var mat_rasc = StandardMaterial3D.new()
			mat_rasc.albedo_color = Color(0.1, 0.15, 0.2); mat_rasc.metallic = 0.8; mat_rasc.roughness = 0.2
			rascacielos.material_override = mat_rasc
			rascacielos.position = Vector3(randf_range(-15, 15), 40, randf_range(-15, 15))
			rascacielos.rotation_degrees.z = randf_range(-30, 30) # Derruido e inclinado
			fondo.add_child(rascacielos)
			
			# Escombros gigantes (Montañas de asfalto y tierra)
			var montaña = MeshInstance3D.new()
			var m_mesh = SphereMesh.new(); m_mesh.radius = 40; m_mesh.height = 40
			montaña.mesh = m_mesh; montaña.material_override = mat_suelo_tierra
			montaña.position = Vector3(randf_range(-10, 10), 0, randf_range(-10, 10))
			fondo.add_child(montaña)
			
			fondo.rotation_degrees.y = randf_range(0, 360)
			add_child(fondo)

func crear_terreno_organico():
	var terr = cargar_glb_runtime("res://models/terreno_organico.glb")
	if not terr: return
	
	# Textura realista tileada para el relieve (TIERRA OSCURA)
	var mat_terreno = StandardMaterial3D.new()
	mat_terreno.albedo_color = Color(0.35, 0.2, 0.1) # Color tierra más distintivo
	mat_terreno.albedo_texture = mat_suelo_tierra.albedo_texture
	mat_terreno.uv1_scale = Vector3(150, 150, 150)
	aplicar_material_glb(terr, mat_terreno)
	
	# Escalar y posicionar para cubrir toda el área jugable (-200 a 100)
	terr.scale = Vector3(10, 1, 10)
	terr.position = Vector3(0, -4.8, -100)
	
	# Generar colisiones cóncavas orgánicas
	var queue = [terr]
	while queue.size() > 0:
		var curr = queue.pop_front()
		if curr is MeshInstance3D:
			curr.create_trimesh_collision()
		queue.append_array(curr.get_children())
		
	add_child(terr)

func crear_retenedores_agua():
	# Crear palos y maleza en el agua profunda para que no se caigan
	for i in range(150):
		var angulo = randf_range(0, PI * 2)
		var radio = randf_range(60, 200) # Lejos del centro
		var px = cos(angulo) * radio
		var pz = -100 + sin(angulo) * radio
		
		# Solo poner retenedores si el agua es profunda (no estamos en el camino)
		if abs(px) > 25 or pz < -220 or pz > 30:
			var palo = StaticBody3D.new()
			var col = CollisionShape3D.new()
			var shape = CylinderShape3D.new()
			shape.height = randf_range(8, 15)
			shape.radius = randf_range(0.3, 0.8)
			col.shape = shape
			palo.add_child(col)
			
			var mesh_inst = MeshInstance3D.new()
			var cyl = CylinderMesh.new()
			cyl.height = shape.height
			cyl.top_radius = shape.radius
			cyl.bottom_radius = shape.radius
			mesh_inst.mesh = cyl
			mesh_inst.material_override = mat_madera
			palo.add_child(mesh_inst)
			
			palo.position = Vector3(px, -3.0, pz) # Hundidos en el agua
			palo.rotation_degrees.x = randf_range(-20, 20)
			palo.rotation_degrees.z = randf_range(-20, 20)
			add_child(palo)
			
			# Algunos retenedores tienen maleza gigante alrededor
			if randf() > 0.4:
				for j in range(3):
					crear_maleza_bloqueadora(Vector3(px + randf_range(-2, 2), -4.5, pz + randf_range(-2, 2)))

func crear_portal_checkpoint(pos: Vector3):
	var checkpoint = Area3D.new()
	var col = CollisionShape3D.new()
	var shape = BoxShape3D.new()
	shape.size = Vector3(2, 4, 2) # Caseta de Telmex
	col.shape = shape
	checkpoint.add_child(col)
	
	var frame = StaticBody3D.new()
	
	# Techo de la caseta
	var techo_col = CollisionShape3D.new()
	var techo_b = BoxShape3D.new(); techo_b.size = Vector3(2, 0.2, 2)
	techo_col.shape = techo_b; techo_col.position = Vector3(0, 2.1, 0)
	frame.add_child(techo_col)
	
	var techo_mesh = MeshInstance3D.new()
	techo_mesh.mesh = BoxMesh.new(); techo_mesh.mesh.size = Vector3(2, 0.2, 2)
	var mat_telmex = StandardMaterial3D.new()
	mat_telmex.albedo_color = Color(0.1, 0.3, 0.6) # Azul Telmex
	mat_telmex.metallic = 0.8; mat_telmex.roughness = 0.4
	techo_mesh.material_override = mat_telmex
	techo_col.add_child(techo_mesh)
	
	# Postes
	for x in [-0.9, 0.9]:
		for z in [-0.9, 0.9]:
			var poste = MeshInstance3D.new()
			poste.mesh = BoxMesh.new(); poste.mesh.size = Vector3(0.2, 4, 0.2)
			poste.material_override = mat_telmex
			poste.position = Vector3(x, 0, z)
			frame.add_child(poste)
	
	# Teléfono en sí
	var tel = MeshInstance3D.new()
	tel.mesh = BoxMesh.new(); tel.mesh.size = Vector3(0.6, 0.8, 0.3)
	var mat_tel = StandardMaterial3D.new(); mat_tel.albedo_color = Color(0.8, 0.8, 0.8)
	tel.material_override = mat_tel
	tel.position = Vector3(0, 0.5, -0.8)
	frame.add_child(tel)
	
	# Luz Mágica del Checkpoint
	var luz = OmniLight3D.new()
	luz.light_color = Color(0.2, 0.8, 1.0) # Luz celestial
	luz.light_energy = 5.0
	luz.omni_range = 8.0
	frame.add_child(luz)
	
	var col_r = CollisionShape3D.new()
	var b_r = BoxShape3D.new()
	b_r.size = Vector3(1, 4, 1)
	col_r.shape = b_r
	col_r.position = Vector3(1.8, 2, 0)
	frame.add_child(col_r)
	checkpoint.add_child(frame)
	
	var modelo = cargar_glb_runtime("res://models/portal_mictlan.glb")
	if modelo:
		aplicar_material(modelo, mat_portal)
		checkpoint.add_child(modelo)
	checkpoint.body_entered.connect(func(body):
		if body == player_ref: player_ref.spawn_point = pos + Vector3(0, 1, 0)
	)
	checkpoint.position = pos
	add_child(checkpoint)

func aplicar_material_glb(nodo: Node, material: Material):
	if nodo is MeshInstance3D:
		nodo.material_override = material
	for child in nodo.get_children():
		aplicar_material_glb(child, material)

func crear_arbol(pos: Vector3):
	var m_inst = cargar_glb_runtime("res://models/arbol_muerto_re4.glb")
	if not m_inst: m_inst = Node3D.new()
	m_inst.position = pos
	m_inst.rotation_degrees.y = randf_range(0, 360)
	aplicar_material_glb(m_inst, mat_arbol_muerto)
	var sb = StaticBody3D.new()
	var col = CollisionShape3D.new()
	var shape = CylinderShape3D.new(); shape.radius = 0.8; shape.height = 6.0
	col.shape = shape
	sb.add_child(col)
	m_inst.add_child(sb)
	add_child(m_inst)

func crear_caja(pos: Vector3):
	var crate = RigidBody3D.new()
	crate.mass = 2.0
	crate.axis_lock_angular_x = true
	crate.axis_lock_angular_z = true
	crate.set_script(load("res://scripts/crate.gd"))
	crate.add_to_group("crates")
	
	var col = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(0.7, 0.7, 0.7)
	col.shape = box
	crate.add_child(col)
	
	var m_inst = cargar_glb_runtime("res://models/caja_madera_re4.glb")
	if not m_inst: m_inst = Node3D.new()
	m_inst.scale = Vector3(0.7, 0.7, 0.7)
	aplicar_material_glb(m_inst, mat_madera)
	crate.add_child(m_inst)
	crate.position = pos
	add_child(crate)

func crear_monolito_flotante(pos: Vector3):
	var m_inst = cargar_glb_runtime("res://models/monolito_obsidiana.glb")
	if not m_inst: m_inst = Node3D.new()
	m_inst.position = pos
	m_inst.rotation_degrees = Vector3(randf_range(0, 360), randf_range(0, 360), randf_range(0, 360))
	aplicar_material_glb(m_inst, mat_obsidiana)
	add_child(m_inst)

func colorize_tijuana(node: Node):
	var mat = StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.3, 0.8) # Rosa mexicano/Alebrije
	mat.roughness = 0.4
	if node.has_method("set_surface_override_material") or node is MeshInstance3D:
		if node is MeshInstance3D:
			node.material_override = mat
		else:
			node.call("set_surface_override_material", 0, mat)
	for child in node.get_children():
		colorize_tijuana(child)

func animar_tijuana(node: Node):
	if node is AnimationPlayer:
		var anim_list = node.get_animation_list()
		if anim_list.size() > 0:
			var anim = node.get_animation(anim_list[0])
			if anim:
				anim.loop_mode = Animation.LOOP_LINEAR
			node.play(anim_list[0])
	for child in node.get_children():
		animar_tijuana(child)

func crear_modelo_tijuana() -> Node3D:
	var root = Node3D.new()
	root.name = "tijuana_mesh_root"
	
	# Materiales Alebrije con Texturas de Imagen de Alta Resolución
	var tex_skin = load_tex("alebrije_skin.png")
	var tex_wings = load_tex("alebrije_wings.png")
	
	var mat_cuerpo = StandardMaterial3D.new()
	mat_cuerpo.albedo_color = Color(0.3, 0.9, 1.0) # Cian brillante ajustado
	mat_cuerpo.albedo_texture = tex_skin
	mat_cuerpo.uv1_triplanar = true
	mat_cuerpo.uv1_scale = Vector3(5.0, 5.0, 5.0) # Escamas pequeñas realistas de iguana
	mat_cuerpo.roughness = 0.3 # Escamas pulidas
	
	var mat_alas = StandardMaterial3D.new()
	mat_alas.albedo_texture = tex_wings
	mat_alas.emission_enabled = true
	mat_alas.emission_texture = tex_wings
	mat_alas.emission_energy_multiplier = 1.5
	# ENSAMBLAJE PROCEDURAL MODULAR (Retro 3D Fotorrealista pero más curvo)
	var modelo = Node3D.new()
	modelo.name = "tijuana_mesh_root"
	modelo.position.y = 0.5
	root.add_child(modelo)
	
	# Función auxiliar para partes curvas y con más lados (Cápsulas, Cilindros, Esferas)
	var crear_pieza = func(padre, mesh_type, size, pos, rot, mat):
		var mesh_inst = MeshInstance3D.new()
		var m
		if mesh_type == "capsule":
			m = CapsuleMesh.new(); m.radius = size.x; m.height = size.y; m.radial_segments = 16; m.rings = 8
		elif mesh_type == "cylinder":
			m = CylinderMesh.new(); m.top_radius = size.x; m.bottom_radius = size.x; m.height = size.y; m.radial_segments = 12
		elif mesh_type == "sphere":
			m = SphereMesh.new(); m.radius = size.x; m.height = size.y; m.radial_segments = 16; m.rings = 8
		else: # prism / box fallback
			m = BoxMesh.new(); m.size = size
		mesh_inst.mesh = m; mesh_inst.material_override = mat
		mesh_inst.position = pos; mesh_inst.rotation_degrees = rot
		padre.add_child(mesh_inst)
		return mesh_inst
	
	# Torso Central Curvo (Cápsulas)
	var torso = crear_pieza.call(modelo, "capsule", Vector2(0.3, 0.7), Vector3(0, 0.8, 0), Vector3(15, 0, 0), mat_cuerpo)
	torso.name = "torso"
	var pecho = crear_pieza.call(torso, "capsule", Vector2(0.35, 0.6), Vector3(0, 0.35, 0.05), Vector3(0, 0, 0), mat_cuerpo)
	pecho.name = "pecho"
	var abdomen = crear_pieza.call(torso, "sphere", Vector2(0.35, 0.5), Vector3(0, -0.3, 0.05), Vector3(0, 0, 0), mat_cuerpo)
	abdomen.name = "abdomen"
	
	# Cuello y Cabeza (Iguana más orgánica)
	var cuello = crear_pieza.call(pecho, "cylinder", Vector2(0.15, 0.4), Vector3(0, 0.3, 0.1), Vector3(30, 0, 0), mat_cuerpo)
	var cabeza = crear_pieza.call(cuello, "capsule", Vector2(0.2, 0.4), Vector3(0, 0.25, 0.05), Vector3(-15, 0, 0), mat_cuerpo)
	var hocico = crear_pieza.call(cabeza, "cylinder", Vector2(0.12, 0.4), Vector3(0, -0.05, 0.3), Vector3(80, 0, 0), mat_cuerpo) # Hocico redondo largo
	var mandibula = crear_pieza.call(cabeza, "cylinder", Vector2(0.1, 0.35), Vector3(0, -0.15, 0.3), Vector3(85, 0, 0), mat_cuerpo)
	
	# Cresta (Púas - Conos/Cilindros afilados)
	for i in range(5):
		var pua = MeshInstance3D.new(); var pr = CylinderMesh.new(); pr.top_radius = 0.01; pr.bottom_radius = 0.08; pr.height = 0.2; pr.radial_segments = 6
		pua.mesh = pr; pua.material_override = mat_cuerpo
		pua.position = Vector3(0, 0.2 - (i*0.15), -0.25); pua.rotation_degrees.x = -60
		torso.add_child(pua)
		
	# Cola de Iguana Curva (Cono/Cápsulas que se achican)
	var cola_root = Node3D.new(); cola_root.position = Vector3(0, -0.1, -0.2); cola_root.name = "cola"; abdomen.add_child(cola_root)
	var cola_radius = 0.2; var cola_height = 0.35
	var z_offset = 0.0
	for i in range(4):
		var segmento = crear_pieza.call(cola_root, "cylinder", Vector2(cola_radius, cola_height), Vector3(0, -0.1*i, -z_offset - (cola_height/2.0)), Vector3(-75 - (5*i), 0, 0), mat_cuerpo)
		z_offset += cola_height * 0.9
		cola_radius *= 0.6 # Cola se afina
	
	# Brazos y Manos (Articulaciones Redondas)
	for d in [-1, 1]:
		var brazo = crear_pieza.call(pecho, "capsule", Vector2(0.12, 0.45), Vector3(0.4*d, 0.1, 0), Vector3(10, 0, 15*d), mat_cuerpo)
		brazo.name = "brazo_r" if d == 1 else "brazo_l"
		var antebrazo = crear_pieza.call(brazo, "capsule", Vector2(0.1, 0.4), Vector3(0, -0.35, 0.05), Vector3(-15, 0, 0), mat_cuerpo)
		antebrazo.name = "codo"
		var mano = crear_pieza.call(antebrazo, "sphere", Vector2(0.12, 0.15), Vector3(0, -0.25, 0.05), Vector3(0, 0, 0), mat_cuerpo)
		# Dedos mano (Cilindros finos curvados)
		for f in [-1, 0, 1]:
			crear_pieza.call(mano, "cylinder", Vector2(0.02, 0.18), Vector3(f*0.05, 0, 0.15), Vector3(80, 0, f*5), mat_cuerpo)
			
	# Piernas y Pies musculosos
	for d in [-1, 1]:
		var pierna = crear_pieza.call(abdomen, "capsule", Vector2(0.18, 0.5), Vector3(0.25*d, -0.2, 0), Vector3(-15, 0, 10*d), mat_cuerpo)
		pierna.name = "pierna_r" if d == 1 else "pierna_l"
		var espinilla = crear_pieza.call(pierna, "capsule", Vector2(0.14, 0.45), Vector3(0, -0.35, -0.1), Vector3(20, 0, 0), mat_cuerpo)
		espinilla.name = "rodilla"
		var pie = crear_pieza.call(espinilla, "capsule", Vector2(0.12, 0.35), Vector3(0, -0.25, 0.1), Vector3(70, 0, 0), mat_cuerpo)
		# Dedos pie
		for f in [-1, 0, 1]:
			crear_pieza.call(pie, "cylinder", Vector2(0.03, 0.15), Vector3(f*0.06, 0.1, -0.1), Vector3(0, 0, f*10), mat_cuerpo)

	
	# === ACCESORIOS REALISTAS ===
	# 1. Cangurera (Riñonera táctica de cuero oscuro en la cintura)
	var cangurera = MeshInstance3D.new()
	var cang_mesh = CapsuleMesh.new(); cang_mesh.radius = 0.15; cang_mesh.height = 0.6
	var mat_cuero = StandardMaterial3D.new(); mat_cuero.albedo_color = Color(0.15, 0.1, 0.05); mat_cuero.roughness = 0.8
	cangurera.mesh = cang_mesh; cangurera.material_override = mat_cuero
	cangurera.position = Vector3(0, 0.4, 0.4) # Al frente en la cintura
	cangurera.rotation_degrees.z = 90
	modelo.add_child(cangurera)
	
	# Bolsillo de la cangurera
	var bolsillo = MeshInstance3D.new()
	var bol_mesh = BoxMesh.new(); bol_mesh.size = Vector3(0.2, 0.15, 0.2)
	bolsillo.mesh = bol_mesh; bolsillo.material_override = mat_cuero
	bolsillo.position = Vector3(0, 0, 0.15)
	cangurera.add_child(bolsillo)
	
	# 2. GoPro (Cámara deportiva en la cabeza/pecho)
	var gopro_mount = Node3D.new()
	gopro_mount.position = Vector3(0, 1.4, 0.35) # Pecho/Hombro alto
	modelo.add_child(gopro_mount)
	
	var gopro_cuerpo = MeshInstance3D.new()
	var go_mesh = BoxMesh.new(); go_mesh.size = Vector3(0.1, 0.08, 0.05)
	var mat_gopro = StandardMaterial3D.new(); mat_gopro.albedo_color = Color(0.1, 0.1, 0.1); mat_gopro.metallic = 0.5; mat_gopro.roughness = 0.2
	gopro_cuerpo.mesh = go_mesh; gopro_cuerpo.material_override = mat_gopro
	gopro_mount.add_child(gopro_cuerpo)
	
	var gopro_lente = MeshInstance3D.new()
	var l_mesh = CylinderMesh.new(); l_mesh.top_radius = 0.025; l_mesh.bottom_radius = 0.025; l_mesh.height = 0.02
	var mat_lente = StandardMaterial3D.new(); mat_lente.albedo_color = Color(0, 0, 0); mat_lente.metallic = 1.0; mat_lente.roughness = 0.0
	gopro_lente.mesh = l_mesh; gopro_lente.material_override = mat_lente
	gopro_lente.position = Vector3(0, 0, 0.035)
	gopro_lente.rotation_degrees.x = 90
	gopro_cuerpo.add_child(gopro_lente)
	
	var gopro_led = MeshInstance3D.new()
	var led_mesh = SphereMesh.new(); led_mesh.radius = 0.005; led_mesh.height = 0.01
	var mat_led = StandardMaterial3D.new(); mat_led.albedo_color = Color(1, 0, 0); mat_led.emission_enabled = true; mat_led.emission = Color(1, 0, 0); mat_led.emission_energy_multiplier = 2.0
	gopro_led.mesh = led_mesh; gopro_led.material_override = mat_led
	gopro_led.position = Vector3(0.03, 0.02, 0.026)
	gopro_cuerpo.add_child(gopro_led)
	
	# Alas (Espalda)
	for i in [-1, 1]:
		var ala = MeshInstance3D.new()
		var a_mesh = PrismMesh.new(); a_mesh.size = Vector3(1.2, 1.5, 0.1)
		ala.mesh = a_mesh; ala.material_override = mat_alas
		ala.position = Vector3(0.4 * i, 1.0, 0.3)
		ala.rotation_degrees = Vector3(15, 20 * i, 30 * i)
		modelo.add_child(ala)
	
	# Resortera (Equipada al brazo derecho)
	var mano_r = modelo.find_child("brazo_r", true, false)
	if not mano_r: mano_r = modelo # Fallback
	var arma_pivot = Node3D.new(); arma_pivot.position = Vector3(0, -0.6, 0.2); mano_r.add_child(arma_pivot)
	var mat_madera_arma = StandardMaterial3D.new(); mat_madera_arma.albedo_color = Color(0.4, 0.2, 0.1)
	var resortera_base = MeshInstance3D.new(); var rb_m = CylinderMesh.new(); rb_m.top_radius=0.03; rb_m.bottom_radius=0.03; rb_m.height=0.3
	resortera_base.mesh = rb_m; resortera_base.material_override = mat_madera_arma; arma_pivot.add_child(resortera_base)
	
	for j in [-1, 1]:
		var horqueta = MeshInstance3D.new(); var hq_m = CylinderMesh.new(); hq_m.top_radius=0.02; hq_m.bottom_radius=0.02; hq_m.height=0.2
		horqueta.mesh = hq_m; horqueta.material_override = mat_madera_arma
		horqueta.position = Vector3(0.06 * j, 0.2, 0)
		horqueta.rotation_degrees.z = 30 * j
		resortera_base.add_child(horqueta)
		
	# Bolsa de la resortera y 10 Semillas de Cacao
	var liga = Node3D.new(); liga.position = Vector3(0, 0.25, 0.1); resortera_base.add_child(liga)
	var mat_cacao = StandardMaterial3D.new(); mat_cacao.albedo_color = Color(0.2, 0.1, 0.05)
	
	for c in range(10):
		var semilla = MeshInstance3D.new(); var sem_m = CapsuleMesh.new(); sem_m.radius=0.015; sem_m.height=0.04
		semilla.mesh = sem_m; semilla.material_override = mat_cacao
		semilla.position = Vector3(randf_range(-0.04, 0.04), randf_range(-0.02, 0.02), randf_range(-0.02, 0.02))
		liga.add_child(semilla)
	
	return root

func crear_portal_combi(pos: Vector3):
	var m_inst = cargar_glb_runtime("res://models/portal_obsidiana.glb")
	if not m_inst: m_inst = Node3D.new()
	m_inst.position = pos
	aplicar_material_glb(m_inst, mat_obsidiana)
	
	var luz = OmniLight3D.new()
	luz.light_color = Color(0.6, 0.1, 0.9)
	luz.light_energy = 8.0
	luz.omni_range = 10.0
	luz.position = Vector3(0, 1, -2.5)
	m_inst.add_child(luz)
	add_child(m_inst)

func crear_arbol_caido(pos: Vector3, rot_y: float):
	var m_inst = cargar_glb_runtime("res://models/arbol_muerto_re4.glb")
	if not m_inst: m_inst = Node3D.new()
	m_inst.position = pos
	m_inst.rotation_degrees.y = rot_y
	m_inst.rotation_degrees.x = 90
	aplicar_material_glb(m_inst, mat_arbol_muerto)
	add_child(m_inst)

func crear_maleza_bloqueadora(pos: Vector3):
	var m_inst = cargar_glb_runtime("res://models/arbol_muerto_re4.glb")
	if not m_inst: m_inst = Node3D.new()
	m_inst.position = pos
	m_inst.scale = Vector3(0.5, 0.2, 0.5)
	aplicar_material_glb(m_inst, mat_arbol_muerto)
	add_child(m_inst)

func crear_camino(pos_inicial: Vector3, pos_final: Vector3, num_piedras: int):
	for i in range(num_piedras):
		var interp = float(i) / float(num_piedras)
		var p_pos = pos_inicial.lerp(pos_final, interp)
		
		# Variación orgánica
		p_pos.x += randf_range(-1.0, 1.0)
		p_pos.z += randf_range(-1.0, 1.0)
		
		var b_box = BoxMesh.new(); b_box.size = Vector3(randf_range(2,3), 0.2, randf_range(2,3))
		var piedra = MeshInstance3D.new()
		piedra.mesh = b_box; piedra.material_override = mat_pared_caliza
		piedra.position = Vector3(p_pos.x, 0.1, p_pos.z)
		piedra.rotation_degrees.y = randf_range(0, 360)
		
		var sb = StaticBody3D.new()
		var col = CollisionShape3D.new()
		var shape = BoxShape3D.new(); shape.size = b_box.size
		col.shape = shape
		sb.add_child(col)
		piedra.add_child(sb)
		
		add_child(piedra)



func crear_roca_flotante(pos: Vector3, escala: Vector3 = Vector3(1,1,1)):
	var m_inst = cargar_glb_runtime("res://models/monolito_obsidiana.glb")
	if not m_inst: return
	m_inst.position = pos
	m_inst.scale = escala
	
	# Aplanar la parte de arriba si se usa para saltar (evitar que la rotación la haga muy puntiaguda)
	# Solo rotamos en Y para mantener la parte de arriba plana
	m_inst.rotation_degrees.y = randf_range(0, 360)
	aplicar_material_glb(m_inst, mat_obsidiana)
	
	var queue = [m_inst]
	while queue.size() > 0:
		var curr = queue.pop_front()
		if curr is MeshInstance3D:
			curr.create_trimesh_collision()
		queue.append_array(curr.get_children())
		
	add_child(m_inst)

func crear_combi_inicio(pos: Vector3):
	var combi = Node3D.new()
	combi.position = pos
	combi.rotation_degrees.y = 15 # Ligeramente chueca
	combi.rotation_degrees.z = 5  # Hundida de un lado en el lodo
	
	# Materiales de la Combi
	var mat_pintura = StandardMaterial3D.new(); mat_pintura.albedo_color = Color(0.8, 0.9, 0.9); mat_pintura.roughness = 0.8; mat_pintura.metallic = 0.3 # Celeste vieja
	var mat_blanco = StandardMaterial3D.new(); mat_blanco.albedo_color = Color(0.9, 0.9, 0.9); mat_blanco.roughness = 0.9
	var mat_llanta = StandardMaterial3D.new(); mat_llanta.albedo_color = Color(0.1, 0.1, 0.1); mat_llanta.roughness = 1.0
	var mat_vidrio = StandardMaterial3D.new(); mat_vidrio.albedo_color = Color(0.1, 0.1, 0.1); mat_vidrio.roughness = 0.2; mat_vidrio.metallic = 0.9
	var mat_faro_roto = StandardMaterial3D.new(); mat_faro_roto.albedo_color = Color(0.5, 0.5, 0.5); mat_faro_roto.roughness = 0.5; mat_faro_roto.emission_enabled = true; mat_faro_roto.emission = Color(1.0, 0.8, 0.5); mat_faro_roto.emission_energy_multiplier = 0.5 # Luz moribunda
	
	# Chasis inferior (Celeste)
	var chasis = MeshInstance3D.new(); var c_m = BoxMesh.new(); c_m.size = Vector3(2.5, 1.2, 5.0)
	chasis.mesh = c_m; chasis.material_override = mat_pintura; chasis.position.y = 1.0
	combi.add_child(chasis)
	
	# Cabina superior (Blanca)
	var cabina = MeshInstance3D.new(); var cb_m = BoxMesh.new(); cb_m.size = Vector3(2.4, 1.0, 4.8)
	cabina.mesh = cb_m; cabina.material_override = mat_blanco; cabina.position.y = 2.1
	combi.add_child(cabina)
	
	# Llantas
	for x in [-1.1, 1.1]:
		for z in [-1.8, 1.8]:
			var llanta = MeshInstance3D.new(); var ll_m = CylinderMesh.new(); ll_m.radius = 0.45; ll_m.height = 0.3
			llanta.mesh = ll_m; llanta.material_override = mat_llanta
			llanta.position = Vector3(x, 0.45, z)
			llanta.rotation_degrees.z = 90
			combi.add_child(llanta)
			
	# Parabrisas frontal
	var parabrisas = MeshInstance3D.new(); var pb_m = BoxMesh.new(); pb_m.size = Vector3(2.2, 0.8, 0.1)
	parabrisas.mesh = pb_m; parabrisas.material_override = mat_vidrio
	parabrisas.position = Vector3(0, 2.1, -2.45)
	combi.add_child(parabrisas)
	
	# Faros rotos (Frontales)
	for x in [-0.8, 0.8]:
		var faro = MeshInstance3D.new(); var f_m = SphereMesh.new(); f_m.radius = 0.15; f_m.height = 0.1
		faro.mesh = f_m; faro.material_override = mat_faro_roto
		faro.position = Vector3(x, 1.0, -2.5)
		faro.rotation_degrees.x = 90
		combi.add_child(faro)
	
	# Humo y chispas del motor roto
	var humo = GPUParticles3D.new()
	var h_mat = ParticleProcessMaterial.new()
	h_mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	h_mat.emission_sphere_radius = 0.5
	h_mat.direction = Vector3(0, 1, 0)
	h_mat.initial_velocity_min = 2.0; h_mat.initial_velocity_max = 4.0
	h_mat.gravity = Vector3(0, 1, 0)
	h_mat.color = Color(0.3, 0.3, 0.3, 0.5)
	humo.process_material = h_mat
	var h_mesh = SphereMesh.new(); h_mesh.radius = 0.5; h_mesh.height = 1.0
	var h_m_mat = StandardMaterial3D.new(); h_m_mat.albedo_color = Color(0.2, 0.2, 0.2, 0.5); h_m_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA; h_m_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	h_mesh.material = h_m_mat
	humo.draw_pass_1 = h_mesh
	humo.position = Vector3(0, 0.5, -2.5) # Atrás (es escarabajo/combi, motor atrás)
	humo.amount = 32
	combi.add_child(humo)
	
	# Colisión de la combi
	var c_col = CollisionShape3D.new(); var cs_m = BoxShape3D.new(); cs_m.size = Vector3(2.5, 2.2, 5.0)
	c_col.shape = cs_m; c_col.position.y = 1.5
	var body = StaticBody3D.new(); body.add_child(c_col)
	combi.add_child(body)
	
	add_child(combi)
