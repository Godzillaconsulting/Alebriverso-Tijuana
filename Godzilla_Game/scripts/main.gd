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

func load_tex(file_name: String) -> Texture2D:
	var path = ProjectSettings.globalize_path("res://textures/" + file_name)
	if FileAccess.file_exists(path):
		var img = Image.load_from_file(path)
		if img: return ImageTexture.create_from_image(img)
	return null

func _init():
	var tex_obsidiana = load_tex("obsidian_texture_1779131930589.jpg")
	var tex_madera = load_tex("wood_crate_1779131943519.jpg")
	var tex_pasto = load_tex("grass_texture_1779131919859.jpg")
	var tex_caliza = load_tex("limestone_mossy.webp")

	# MATERIAL OBSIDIANA (Ruinas Mictlán realistas)
	var mat_shader_fallback = StandardMaterial3D.new()
	if tex_obsidiana:
		mat_shader_fallback.albedo_texture = tex_obsidiana
		mat_shader_fallback.uv1_triplanar = true
		mat_shader_fallback.uv1_scale = Vector3(1.0, 1.0, 1.0) # ESCALA ARREGLADA (El piso no se verá vacío ni de bloques gigantes)
	else:
		mat_shader_fallback.albedo_color = Color(0.1, 0.1, 0.1)
	mat_shader_fallback.roughness = 0.85
	mat_shader_fallback.metallic = 0.1
	# MATERIAL ÁRBOLES MUERTOS
	mat_arbol_muerto.albedo_color = Color(0.25, 0.15, 0.2) # Morado/Café oscuro Mictlán
	
	mat_obsidiana = mat_shader_fallback

	# MATERIAL PAREDES CALIZA (Grabados y Moho)
	if tex_caliza:
		mat_pared_caliza.albedo_texture = tex_caliza
		mat_pared_caliza.uv1_triplanar = true
		mat_pared_caliza.uv1_scale = Vector3(0.5, 0.5, 0.5)
	else:
		mat_pared_caliza.albedo_color = Color(0.3, 0.4, 0.25) # Verde musgo
	mat_pared_caliza.roughness = 0.95

	# MATERIAL CAJAS
	if tex_madera:
		mat_madera.albedo_texture = tex_madera
		mat_madera.uv1_triplanar = true
	else:
		mat_madera.albedo_color = Color(0.4, 0.2, 0.1)
	mat_madera.roughness = 0.9

	# MATERIAL PASTO/MUSGO
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
	mat_tronco.albedo_color = Color(0.35, 0.28, 0.22)
	mat_tronco.emission_enabled = false

func _ready():
	print("Inicializando Nivel 1: El Umbral del Mictlán...")
	
	# 0. HUD PROFESIONAL (script externo hud.gd)
	var hud_node = CanvasLayer.new()
	hud_node.set_script(load("res://scripts/hud.gd"))
	hud_node.name = "HUD"
	add_child(hud_node)

	# 1. ATMÓSFERA MICTLÁN AUTÉNTICA (Skybox HDR)
	var env = WorldEnvironment.new()
	var sky_env = Environment.new()
	
	var sky_tex = load_tex("skybox_tenochtitlan.jpg")
	if sky_tex:
		sky_env.background_mode = Environment.BG_SKY
		var panorama = PanoramaSkyMaterial.new()
		panorama.panorama = sky_tex
		var sky = Sky.new()
		sky.sky_material = panorama
		sky_env.sky = sky
	else:
		sky_env.background_mode = Environment.BG_COLOR
		sky_env.background_color = Color(0.0, 0.04, 0.08)
		
	sky_env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	if not sky_tex: sky_env.ambient_light_color = Color(0.3, 0.28, 0.25)
	sky_env.fog_enabled = true
	sky_env.fog_light_color = Color(0.45, 0.42, 0.38) # Niebla gris/marrón densa (RE4)
	sky_env.fog_density = 0.0035
	sky_env.glow_enabled = true
	sky_env.glow_intensity = 0.4
	sky_env.glow_bloom = 0.05
	sky_env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	
	# Filtro Cinemático RE4 2005 (Desaturado y Alto Contraste)
	sky_env.tonemap_mode = 3 # ACES Tonemap
	sky_env.adjustment_enabled = true
	sky_env.adjustment_saturation = 0.65
	sky_env.adjustment_contrast = 1.25
	env.environment = sky_env
	add_child(env)
	
	var sol = DirectionalLight3D.new()
	sol.rotation_degrees = Vector3(-45, 150, 0)
	sol.light_color = Color(0.85, 0.82, 0.75) # Sol pálido y marchito
	sol.light_energy = 1.1
	sol.shadow_enabled = true
	add_child(sol)

	# 2. JUGADOR
	var player = CharacterBody3D.new()
	player_ref = player
	player.set_script(load("res://scripts/player.gd"))
	player.gravity = ProjectSettings.get_setting("physics/3d/default_gravity")
	add_child(player)
	player.position = Vector3(0, 3, 0)

	var tijuana_mesh = crear_modelo_tijuana()
	tijuana_mesh.name = "alebrije_tijuana" # Detectado por player.gd para animación
	player.add_child(tijuana_mesh)

	var p_col = CollisionShape3D.new()
	var p_shape = CapsuleShape3D.new()
	p_shape.radius = 0.8; p_shape.height = 3.0
	p_col.shape = p_shape; p_col.position.y = 1.5
	player.add_child(p_col)

	var spring_arm = Node3D.new()
	spring_arm.name = "SpringArm"
	spring_arm.position = Vector3(1.5, 2.5, 0)
	player.add_child(spring_arm)
	var cam = Camera3D.new()
	cam.position.z = 4.5; cam.rotation_degrees.x = -5; cam.current = true
	spring_arm.add_child(cam)

	# 3. RÍO DEL MICTLÁN (Chicnahuapan) — bajo todos los puentes
	var rio_mat = StandardMaterial3D.new()
	rio_mat.albedo_color = Color(0.0, 0.2, 0.15)
	rio_mat.emission_enabled = true
	rio_mat.emission = Color(0.0, 0.5, 0.3)
	rio_mat.emission_energy_multiplier = 0.4
	rio_mat.roughness = 0.1; rio_mat.metallic = 0.3
	crear_plataforma(Vector3(0, -10, -30), Vector3(200, 0.5, 150), rio_mat)

	# 4. PLAZA CENTRAL / HUB (Tenochtitlán hundida - MASIVA)
	crear_plataforma(Vector3(0, -0.1, 0), Vector3(400, 1, 400), mat_obsidiana) # Z-FIGHTING ARREGLADO (Bajado 0.1 metros)
	crear_portal_checkpoint(Vector3(0, 1, 0))

	# Calendario Azteca (Tonalpohualli) gigante en el centro del Hub
	crear_calendario_azteca(Vector3(0, 0.6, 0))

	# Tzompantli (Muro de cráneos) cerrando la plaza por el norte
	crear_tzompantli(Vector3(0, 0, -35), 20)

	# Vegetación Hub (Optimización Dinámica en RAM via MultiMesh - RE4 2005)
	var mm_flores = MultiMesh.new()
	mm_flores.transform_format = MultiMesh.TRANSFORM_3D
	mm_flores.instance_count = 5000 # ¡5000 flores usando casi 0 RAM!
	var f_mesh = SphereMesh.new(); f_mesh.radius = 0.4; f_mesh.height = 0.2
	f_mesh.radial_segments = 6; f_mesh.rings = 3 # DRÁSTICA REDUCCIÓN DE POLÍGONOS (FPS Fix)
	mm_flores.mesh = f_mesh
	
	for i in range(5000):
		var pos = Vector3(randf_range(-180, 180), 1.0, randf_range(-180, 180))
		var t = Transform3D().translated(pos)
		mm_flores.set_instance_transform(i, t)
		
	var mmi_flores = MultiMeshInstance3D.new()
	mmi_flores.multimesh = mm_flores
	mmi_flores.material_override = mat_cempasuchil
	add_child(mmi_flores)
	for i in range(80):
		crear_arbol(Vector3(randf_range(-150, 150), 0.5, randf_range(-150, 150)))
		
	# Llenando el escenario vacío: Ruinas, Casas y Caminos
	for i in range(40):
		crear_ruina_azteca(Vector3(randf_range(-180, 180), 0.0, randf_range(-180, 180)))
		
	# Casas Mayas/Aztecas (Poblado Mictlán)
	for i in range(25):
		crear_casa_azteca(Vector3(randf_range(-150, 150), 0.0, randf_range(-150, 150)))
		
	# Caminos orgánicos (Red de calzadas)
	for i in range(15):
		var start = Vector3(randf_range(-100, 100), 0.0, randf_range(-100, 100))
		var end = start + Vector3(randf_range(-50, 50), 0.0, randf_range(-50, 50))
		crear_camino(start, end, randi_range(15, 30))
		
	for i in range(80):
		crear_caja(Vector3(randf_range(-150, 150), 2.0, randf_range(-150, 150)))
		
	# Monolitos Flotantes Místicos (Vida y misterio)
	for i in range(25):
		crear_monolito_flotante(Vector3(randf_range(-200, 200), randf_range(20, 80), randf_range(-200, 200)))
	
	# El Perrito NPC (Misión principal)
	crear_npc_xolo(Vector3(-10, 1.0, -10))
	
	# Mercader Tianguis (La Tiendita - Cultura Mexicana)
	var merchant = load("res://scripts/merchant.gd").new()
	merchant.position = Vector3(12, 0, 12)
	add_child(merchant)
	
	# Hordas de Alebrijes de Papel Maché (IA basada en Nodos de Decisión)
	for i in range(30):
		var enemy = load("res://scripts/enemy.gd").new()
		enemy.position = Vector3(randf_range(-100, 100), 1.0, randf_range(-100, 100))
		add_child(enemy)

	# MURO BLOQUEADOR GIGANTE (Aspecto de Fortaleza Antigua)
	muro_bloqueo = StaticBody3D.new()
	var mb_col = CollisionShape3D.new()
	var mb_box = BoxShape3D.new(); mb_box.size = Vector3(60, 25, 8)
	mb_col.shape = mb_box; mb_col.position.y = 12.5
	muro_bloqueo.add_child(mb_col)
	var mb_mesh = MeshInstance3D.new()
	var mb_bmesh = BoxMesh.new(); mb_bmesh.size = mb_box.size
	mb_mesh.mesh = mb_bmesh; mb_mesh.material_override = mat_pared_caliza # Usar caliza
	mb_mesh.position.y = 12.5
	muro_bloqueo.add_child(mb_mesh)
	muro_bloqueo.position = Vector3(0, 12, -45); add_child(muro_bloqueo)

	# 5. RUTA ESTE — Calzada de Saltos Largos
	crear_plataforma(Vector3(50, 0, 0), Vector3(20, 1, 20), mat_obsidiana)
	crear_caja(Vector3(55, 1, 0)); crear_caja(Vector3(45, 1, 0))
	# Plataformas sobre el abismo (mucho más separadas)
	for i in range(8):
		crear_plataforma(Vector3(70 + i*12, i*1.2, randf_range(-5,5)), Vector3(5, 0.5, 5), mat_obsidiana)
	# Altar del Este Épico + Gema oculta
	crear_plataforma(Vector3(180, 10, -5), Vector3(25, 1, 25), mat_obsidiana)
	crear_tzompantli(Vector3(180, 10, -16), 12)
	crear_interruptor(Vector3(180, 11.5, -5))
	# GEM 1: Oculta detrás del Tzompantli Este (hay que rodear por el borde)
	crear_peso_camion(Vector3(180, 11, -22))
	for i in range(5): crear_caja(Vector3(175 + i*2, 11, -3))

	# 6. RUTA OESTE — Gran Laberinto Boscoso de Chapultepec
	crear_plataforma(Vector3(-80, 0, 0), Vector3(80, 1, 80), mat_obsidiana)
	# Muros masivos del laberinto (Usan CALIZA, no obsidiana)
	crear_plataforma(Vector3(-60, 4, 15),  Vector3(4, 8, 50), mat_pared_caliza)
	crear_plataforma(Vector3(-100, 4, -15), Vector3(4, 8, 50), mat_pared_caliza)
	crear_plataforma(Vector3(-80, 4, 30),  Vector3(4, 8, 50), mat_pared_caliza)
	crear_plataforma(Vector3(-80, 4, 35), Vector3(44, 8, 4), mat_pared_caliza)
	# Bosque hiper-denso
	for i in range(70):
		crear_arbol(Vector3(randf_range(-115,-45), 0.5, randf_range(-35,35)))
	for i in range(40):
		crear_flor(Vector3(randf_range(-115,-45), 1.0, randf_range(-35,35)))
	# Altar Oeste (Oculto muy atrás)
	crear_plataforma(Vector3(-130, 0, 20), Vector3(20, 1, 20), mat_obsidiana)
	crear_tzompantli(Vector3(-130, 0, 28), 8)
	crear_interruptor(Vector3(-130, 1.5, 20))
	# Cajas escondidas
	for i in range(6): crear_caja(Vector3(-125, 1, 15 + i*2))
	# GEM 2: Encima del muro más alto (hay que trepar por los árboles)
	crear_peso_camion(Vector3(-100, 12, -15))
	# GEM 3: En un rincón ciego absoluto
	crear_peso_camion(Vector3(-50, 1, 35))

	# 7. RUTA SUR — Templo Mayor GIGANTE (Pirámide Escalonada Real)
	# Base conectora
	crear_plataforma(Vector3(0, 0, 50), Vector3(20, 1, 20), mat_obsidiana)
	
	var py_pos = Vector3(0, 0, 100)
	# Construir 5 niveles sólidos de la pirámide (Usan caliza)
	for i in range(5):
		var py_size = 50 - (i * 8)
		crear_plataforma(py_pos + Vector3(0, i * 3 + 1.5, 0), Vector3(py_size, 3, py_size), mat_pared_caliza)
	
	# Gran Escalera Frontal (para subir fácilmente sin tener que usar doble salto en todo)
	for j in range(15):
		crear_plataforma(Vector3(0, j + 0.5, 75 + j), Vector3(10, 1, 2), mat_obsidiana)
		# Antorchas a los lados de la escalera (Luces cinemáticas)
		if j % 4 == 0:
			for lado in [-6, 6]:
				var luz = OmniLight3D.new()
				luz.light_color = Color(1.0, 0.4, 0.0)
				luz.light_energy = 3.0
				luz.omni_range = 10.0
				luz.position = Vector3(lado, j + 2, 75 + j)
				add_child(luz)
	
	# Cima del Templo Mayor
	crear_plataforma(Vector3(0, 15, 100), Vector3(18, 1, 18), mat_obsidiana)
	crear_pilar(Vector3(-6, 16, 95)); crear_pilar(Vector3(6, 16, 95))
	crear_tzompantli(Vector3(0, 15, 108), 8)
	crear_interruptor(Vector3(0, 16.5, 100))
	
	# GEM 4: Oculta en un hueco detrás de la pirámide (caída libre)
	crear_peso_camion(Vector3(0, 2, 125))
	
	# Cajas de ofrendas
	crear_caja(Vector3(-5, 16, 105)); crear_caja(Vector3(5, 16, 105))

	# 8. RUTA NORTE — Arena de los Dioses (Revelada al caer el muro)
	# Calzada de Cempasúchil kilométrica
	crear_plataforma(Vector3(0, 0, -85), Vector3(10, 0.5, 80), mat_cempasuchil)
	# Arena colosal
	crear_plataforma(Vector3(0, 0, -165), Vector3(60, 1, 60), mat_obsidiana)
	# Altar central del sacrificio enorme
	crear_plataforma(Vector3(0, 2, -165), Vector3(15, 1, 15), mat_obsidiana)
	crear_calendario_azteca(Vector3(0, 2.7, -165))
	# Muros de cráneos de toda la arena
	crear_tzompantli(Vector3(0, 0, -192), 20)
	crear_tzompantli(Vector3(0, 0, -138), 20)
	# Pilares monumentales
	for i in range(12):
		var ang = i * (PI / 6)
		crear_pilar(Vector3(cos(ang)*26, 1, -165 + sin(ang)*26))
	# Zonas de cajas
	for i in range(5): crear_caja(Vector3(-20 + i*2, 1, -150))
	for i in range(5): crear_caja(Vector3(20 - i*2, 1, -150))
	# PESO 5: El trofeo final levitando en el centro del calendario azteca de la arena
	crear_peso_camion(Vector3(0, 4.5, -165))
	
	# Portal de salida del nivel muy al fondo
	crear_portal_checkpoint(Vector3(0, 1, -190))

# --- LÓGICA DE PUZZLE (TIPO RE4) ---
var switches_activados = 0
var muro_bloqueo = null

func crear_interruptor(pos: Vector3):
	var inter = Area3D.new()
	inter.set_meta("activo", false)
	var col = CollisionShape3D.new()
	var shape = BoxShape3D.new()
	shape.size = Vector3(3, 3, 3)
	col.shape = shape
	inter.add_child(col)
	var mesh = MeshInstance3D.new()
	var prism = PrismMesh.new()
	prism.size = Vector3(1.5, 2.0, 1.5)
	mesh.mesh = prism
	mesh.material_override = mat_cempasuchil
	mesh.position.y = 1.0
	inter.add_child(mesh)
	inter.body_entered.connect(func(body):
		if body == player_ref and not inter.get_meta("activo"):
			inter.set_meta("activo", true)
			mesh.material_override = mat_obsidiana
			switches_activados += 1
			var hud = get_node_or_null("HUD")
			if hud: hud.actualizar_switch()
			if switches_activados >= 3 and muro_bloqueo != null:
				muro_bloqueo.queue_free()
	)
	inter.position = pos
	add_child(inter)

# Monedas de a Peso (Coleccionable para el camión)
func crear_peso_camion(pos: Vector3):
	var gem = Area3D.new()
	var col = CollisionShape3D.new()
	var shape = SphereShape3D.new()
	shape.radius = 1.2
	col.shape = shape
	gem.add_child(col)

	var mat_peso = StandardMaterial3D.new()
	mat_peso.albedo_color = Color(0.8, 0.7, 0.2) # Dorado/Bronce (Moneda)
	mat_peso.metallic = 1.0; mat_peso.roughness = 0.3

	var mesh = MeshInstance3D.new()
	var cyl = CylinderMesh.new()
	cyl.top_radius = 0.8; cyl.bottom_radius = 0.8; cyl.height = 0.15
	mesh.mesh = cyl
	mesh.material_override = mat_peso
	mesh.rotation_degrees.x = 90 # Moneda parada
	gem.add_child(mesh)

	# Rotación animada
	var spin = Node3D.new()
	spin.add_child(mesh)
	gem.add_child(spin)

	gem.body_entered.connect(func(body):
		if body == player_ref:
			var hud = get_node_or_null("HUD")
			if hud: hud.actualizar_gema()
			gem.queue_free()
	)
	gem.position = pos
	add_child(gem)

# Tzompantli — Muro de cráneos histórico de Tenochtitlán (Mejorado)
func crear_tzompantli(pos: Vector3, columnas: int):
	var pared = StaticBody3D.new()
	var col = CollisionShape3D.new()
	var box = BoxShape3D.new(); box.size = Vector3(columnas * 1.5, 4.5, 1.5)
	col.shape = box; col.position.y = 2.25
	pared.add_child(col)
	var mesh = MeshInstance3D.new()
	var bm = BoxMesh.new(); bm.size = Vector3(columnas * 1.5, 4.5, 1.5)
	mesh.mesh = bm; mesh.material_override = mat_pared_caliza # Muro con caliza grabada
	mesh.position.y = 2.25
	pared.add_child(mesh)
	
	var mat_craneo = StandardMaterial3D.new()
	mat_craneo.albedo_color = Color(0.85, 0.82, 0.75) # Color hueso viejo realista
	mat_craneo.roughness = 0.9
	
	for col_idx in range(columnas):
		for fila in range(3):
			# Base del cráneo (Esfera)
			var c_mesh = MeshInstance3D.new()
			var sph = SphereMesh.new(); sph.radius = 0.35; sph.height = 0.7
			sph.radial_segments = 8; sph.rings = 4 # Optimizado
			c_mesh.mesh = sph; c_mesh.material_override = mat_craneo
			c_mesh.position = Vector3((col_idx - columnas / 2.0) * 1.5 + 0.75, fila * 1.2 + 1.2, 0)
			
			# Mandíbula (Caja)
			var jaw = MeshInstance3D.new()
			var jaw_box = BoxMesh.new(); jaw_box.size = Vector3(0.4, 0.4, 0.5)
			jaw.mesh = jaw_box; jaw.material_override = mat_craneo
			jaw.position = Vector3(0, -0.2, 0.2)
			c_mesh.add_child(jaw)
			
			pared.add_child(c_mesh)

	pared.position = pos
	add_child(pared)

# Calendario Azteca (Tonalpohualli) incrustado en el piso
func crear_calendario_azteca(pos: Vector3):
	var mat_cal = StandardMaterial3D.new()
	mat_cal.albedo_color = Color(0.4, 0.25, 0.0)
	mat_cal.emission_enabled = true
	mat_cal.emission = Color(1.0, 0.5, 0.0)
	mat_cal.emission_energy_multiplier = 0.8
	mat_cal.metallic = 0.6; mat_cal.roughness = 0.3

	var disco = StaticBody3D.new()
	var d_col = CollisionShape3D.new()
	var d_shape = CylinderShape3D.new()
	d_shape.radius = 6.0; d_shape.height = 0.3
	d_col.shape = d_shape; disco.add_child(d_col)

	var d_mesh = MeshInstance3D.new()
	var cyl = CylinderMesh.new()
	cyl.top_radius = 6.0; cyl.bottom_radius = 6.0; cyl.height = 0.3
	d_mesh.mesh = cyl; d_mesh.material_override = mat_cal
	disco.add_child(d_mesh)

	# Anillo interior (runas)
	var mat_runa = StandardMaterial3D.new()
	mat_runa.albedo_color = Color(0.0, 1.0, 0.8)
	mat_runa.emission_enabled = true
	mat_runa.emission = Color(0.0, 1.0, 0.8)
	mat_runa.emission_energy_multiplier = 1.5
	var inner_mesh = MeshInstance3D.new()
	var inner_cyl = CylinderMesh.new()
	inner_cyl.top_radius = 3.5; inner_cyl.bottom_radius = 3.5; inner_cyl.height = 0.35
	inner_mesh.mesh = inner_cyl; inner_mesh.material_override = mat_runa
	disco.add_child(inner_mesh)

	disco.position = pos
	add_child(disco)

# NPC Amistoso (Perro Xoloitzcuintle)
func crear_npc_xolo(pos: Vector3):
	var npc = Area3D.new()
	var col = CollisionShape3D.new()
	var shape = SphereShape3D.new()
	shape.radius = 3.0 # Rango de conversación
	col.shape = shape
	npc.add_child(col)
	
	# Placeholder visual para el perrito (Cilindro naranja)
	var mesh = MeshInstance3D.new()
	var cyl = CylinderMesh.new()
	cyl.top_radius = 0.4; cyl.bottom_radius = 0.4; cyl.height = 0.8
	mesh.mesh = cyl
	mesh.material_override = mat_cempasuchil
	npc.add_child(mesh)
	
	npc.body_entered.connect(func(body):
		if body == player_ref:
			var hud = get_node_or_null("HUD")
			if hud:
				hud.mostrar_notificacion("🐾 Xolo: ¡Guau! (Abre el Gran Muro buscando 3 Altares)")
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
func crear_plataforma(pos: Vector3, tamaño: Vector3, material: Material):
	# Usar mallas NATIVAS de Godot garantiza que la colisión y la vista encajen milimétricamente
	var plat = StaticBody3D.new()
	var col = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = tamaño
	col.shape = box
	plat.add_child(col)
	
	var m_inst = MeshInstance3D.new()
	var bm = BoxMesh.new()
	bm.size = tamaño
	m_inst.mesh = bm
	m_inst.material_override = material
	plat.add_child(m_inst)
	
	plat.position = pos
	add_child(plat)

func crear_portal_checkpoint(pos: Vector3):
	var checkpoint = Area3D.new()
	var col = CollisionShape3D.new()
	var shape = BoxShape3D.new()
	shape.size = Vector3(3, 4, 3)
	col.shape = shape
	checkpoint.add_child(col)
	
	var frame = StaticBody3D.new()
	var col_l = CollisionShape3D.new()
	var b_l = BoxShape3D.new()
	b_l.size = Vector3(1, 4, 1)
	col_l.shape = b_l
	col_l.position = Vector3(-1.8, 2, 0)
	frame.add_child(col_l)
	
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

func crear_pilar(pos: Vector3):
	var pilar = StaticBody3D.new()
	var modelo = cargar_glb_runtime("res://models/pilar_azteca.glb")
	if modelo:
		modelo.scale = Vector3(1.5, 1.0, 1.5)
		aplicar_material(modelo, mat_obsidiana)
		pilar.add_child(modelo)
	var col = CollisionShape3D.new()
	var shape = CylinderShape3D.new()
	shape.radius = 0.9
	shape.height = 4.0
	col.shape = shape
	col.position.y = 2.0
	pilar.add_child(col)
	pilar.position = pos
	add_child(pilar)

func crear_arbol(pos: Vector3):
	var tronco = MeshInstance3D.new()
	var cil = CylinderMesh.new()
	cil.top_radius = 0.3; cil.bottom_radius = 0.8; cil.height = 6.0
	tronco.mesh = cil
	tronco.material_override = mat_obsidiana # Tronco como pilar de obsidiana
	tronco.position = pos
	
	var col = CollisionShape3D.new()
	var shape = CylinderShape3D.new()
	shape.radius = 0.8; shape.height = 6.0
	col.shape = shape
	var sb = StaticBody3D.new()
	sb.add_child(col)
	tronco.add_child(sb)
	
	# Hojas del inframundo (Cempasúchil brillante)
	for i in range(4):
		var copa = MeshInstance3D.new()
		var esf = SphereMesh.new()
		esf.radial_segments = 8; esf.rings = 4 # DRÁSTICA REDUCCIÓN DE POLÍGONOS (FPS Fix)
		esf.radius = randf_range(2.0, 3.5); esf.height = esf.radius * 1.5
		copa.mesh = esf
		copa.material_override = mat_arbol_muerto
		copa.position = Vector3(randf_range(-1.0, 1.0), 3.0 + i*1.2, randf_range(-1.0, 1.0))
		tronco.add_child(copa)
		
	add_child(tronco)

func crear_flor(pos: Vector3):
	var flor = MeshInstance3D.new()
	var esf = SphereMesh.new()
	esf.radius = 0.4; esf.height = 0.2
	flor.mesh = esf
	flor.material_override = mat_cempasuchil
	flor.position = pos
	add_child(flor)

func crear_caja(pos: Vector3):
	var crate = StaticBody3D.new()
	crate.set_script(load("res://scripts/crate.gd"))
	crate.add_to_group("crates")
	var col = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(1.5, 1.5, 1.5)
	col.shape = box
	crate.add_child(col)
	var m_inst = MeshInstance3D.new()
	var bm = BoxMesh.new()
	bm.size = Vector3(1.5, 1.5, 1.5)
	bm.material = mat_madera
	m_inst.mesh = bm
	crate.add_child(m_inst)
	crate.position = pos
	add_child(crate)

func crear_monolito_flotante(pos: Vector3):
	var mono = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = Vector3(randf_range(2.0, 8.0), randf_range(15.0, 30.0), randf_range(2.0, 8.0))
	mono.mesh = box
	mono.material_override = mat_pared_caliza # Monolitos grabados
	
	# Runas brillantes empotradas (Magia del Mictlán)
	var rune = MeshInstance3D.new()
	var rune_box = BoxMesh.new()
	rune_box.size = Vector3(box.size.x * 1.02, box.size.y * 0.1, box.size.z * 1.02)
	rune.mesh = rune_box
	rune.material_override = mat_portal
	rune.position.y = randf_range(-box.size.y/3, box.size.y/3)
	mono.add_child(rune)
	
	mono.position = pos
	mono.rotation_degrees = Vector3(randf_range(-15, 15), randf_range(0, 360), randf_range(-15, 15))
	add_child(mono)
	
	# Gestión Dinámica de RAM (Solo procesa si está en pantalla)
	var vis = VisibleOnScreenEnabler3D.new()
	vis.aabb = AABB(Vector3(-10, -15, -10), Vector3(20, 30, 20))
	vis.enable_node_path = ".." # Apunta al Monolito para desactivar animaciones cuando no se ve
	mono.add_child(vis)
	
	# Animación suave de levitación
	var dur_up = randf_range(4.0, 8.0)
	var dur_down = randf_range(4.0, 8.0)
	var offset = randf_range(3.0, 10.0)
	var tw = get_tree().create_tween().set_loops()
	tw.tween_property(mono, "position:y", pos.y + offset, dur_up).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	tw.tween_property(mono, "position:y", pos.y, dur_down).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)

func crear_ruina_azteca(pos: Vector3):
	var ruina = StaticBody3D.new()
	var pisos = randi_range(2, 4)
	
	# Crear pirámides escalonadas destruidas procedimentalmente
	for i in range(pisos):
		var mesh_inst = MeshInstance3D.new()
		var box = BoxMesh.new()
		var ancho = 8.0 - (i * 2.0)
		box.size = Vector3(ancho, 1.2 + (i*0.2), ancho)
		mesh_inst.mesh = box
		mesh_inst.material_override = mat_pared_caliza # Ruinas de piedra caliza
		mesh_inst.position.y = (i * 1.2) + 0.6
		
		# Destrucción procedural
		if randf() > 0.6:
			mesh_inst.rotation_degrees.y = randf_range(-10, 10)
			mesh_inst.position.x += randf_range(-0.5, 0.5)
			mesh_inst.position.z += randf_range(-0.5, 0.5)
			
		ruina.add_child(mesh_inst)
		
		var col = CollisionShape3D.new()
		var col_shape = BoxShape3D.new()
		col_shape.size = box.size
		col.shape = col_shape
		col.position = mesh_inst.position
		ruina.add_child(col)
	
	ruina.position = pos
	ruina.rotation_degrees.y = randf_range(0, 360)
	
	# Gestión Dinámica de RAM
	var vis = VisibleOnScreenEnabler3D.new()
	vis.aabb = AABB(Vector3(-10, -5, -10), Vector3(20, 20, 20))
	vis.enable_node_path = ".."
	ruina.add_child(vis)
	
	add_child(ruina)

# --- MODELO PROCEDURAL DEL JUGADOR (TIJUANA) ---
func crear_modelo_tijuana() -> Node3D:
	var pivot = Node3D.new()
	var mat_piel = StandardMaterial3D.new()
	mat_piel.albedo_color = Color(0.2, 0.8, 0.3) # Verde reptil
	
	# Torso (Forma circular gordita)
	var torso = MeshInstance3D.new()
	var torso_mesh = SphereMesh.new(); torso_mesh.radius = 0.55; torso_mesh.height = 1.1
	torso.mesh = torso_mesh; torso.material_override = mat_piel
	torso.position.y = 1.0
	pivot.add_child(torso)
	
	# Cabeza (Circular)
	var cabeza = MeshInstance3D.new()
	var cabeza_mesh = SphereMesh.new(); cabeza_mesh.radius = 0.4; cabeza_mesh.height = 0.8
	cabeza.mesh = cabeza_mesh; cabeza.material_override = mat_piel
	cabeza.position.y = 0.8
	cabeza.position.z = -0.1
	torso.add_child(cabeza)
	
	# GoPro (Cabeza)
	var gopro = MeshInstance3D.new()
	var gopro_mesh = BoxMesh.new(); gopro_mesh.size = Vector3(0.15, 0.15, 0.2)
	var mat_gopro = StandardMaterial3D.new(); mat_gopro.albedo_color = Color(0.1, 0.1, 0.1)
	gopro.mesh = gopro_mesh; gopro.material_override = mat_gopro
	gopro.position = Vector3(0, 0.4, -0.3) # En la frente circular
	cabeza.add_child(gopro)
	var lente = MeshInstance3D.new()
	var lente_mesh = CylinderMesh.new(); lente_mesh.top_radius = 0.05; lente_mesh.bottom_radius = 0.05; lente_mesh.height = 0.05
	var mat_lente = StandardMaterial3D.new(); mat_lente.albedo_color = Color(1,0,0); mat_lente.emission_enabled = true; mat_lente.emission = Color(1,0,0)
	lente.mesh = lente_mesh; lente.material_override = mat_lente
	lente.rotation_degrees.x = 90; lente.position.z = -0.1
	gopro.add_child(lente)
	
	# Cangurera (Cintura)
	var cangurera = MeshInstance3D.new()
	var cang_mesh = BoxMesh.new(); cang_mesh.size = Vector3(0.7, 0.2, 0.3)
	var mat_cang = StandardMaterial3D.new(); mat_cang.albedo_color = Color(0.8, 0.1, 0.5) # Rosa mexicano / Fiusha
	cangurera.mesh = cang_mesh; cangurera.material_override = mat_cang
	cangurera.position = Vector3(0, -0.4, -0.45)
	torso.add_child(cangurera)
	
	# Brazos
	for lado in [-1, 1]:
		var brazo = MeshInstance3D.new()
		var brazo_mesh = CapsuleMesh.new(); brazo_mesh.radius = 0.15; brazo_mesh.height = 0.8
		brazo.mesh = brazo_mesh; brazo.material_override = mat_piel
		brazo.position = Vector3(lado * 0.55, 0.2, 0)
		brazo.rotation_degrees.z = lado * 15 # Ligeramente abiertos
		torso.add_child(brazo)
		
	# Piernas
	for lado in [-1, 1]:
		var pierna = MeshInstance3D.new()
		var pierna_mesh = CapsuleMesh.new(); pierna_mesh.radius = 0.18; pierna_mesh.height = 0.8
		pierna.mesh = pierna_mesh; pierna.material_override = mat_piel
		pierna.position = Vector3(lado * 0.25, -0.5, 0)
		torso.add_child(pierna)
		
	# Cola de lagartija
	var cola = MeshInstance3D.new()
	var cola_mesh = CylinderMesh.new(); cola_mesh.top_radius = 0.2; cola_mesh.bottom_radius = 0.0; cola_mesh.height = 1.0
	cola.mesh = cola_mesh; cola.material_override = mat_piel
	cola.rotation_degrees.x = -60
	cola.position = Vector3(0, -0.4, 0.6)
	torso.add_child(cola)
	
	return pivot

# --- ESTRUCTURAS MAYAS/AZTECAS (Chozas/Casas Calli) ---
func crear_casa_azteca(pos: Vector3):
	var casa = StaticBody3D.new()
	
	# Muros (Base Cuadrada de Caliza)
	var muro = MeshInstance3D.new()
	var muro_box = BoxMesh.new(); muro_box.size = Vector3(8, 4, 8)
	muro.mesh = muro_box; muro.material_override = mat_pared_caliza
	muro.position.y = 2.0
	casa.add_child(muro)
	
	var col_muro = CollisionShape3D.new()
	var shape_muro = BoxShape3D.new(); shape_muro.size = muro_box.size
	col_muro.shape = shape_muro; col_muro.position.y = 2.0
	casa.add_child(col_muro)
	
	# Puerta (Hueco oscuro)
	var puerta = MeshInstance3D.new()
	var p_box = BoxMesh.new(); p_box.size = Vector3(2, 2.5, 0.5)
	var mat_puerta = StandardMaterial3D.new(); mat_puerta.albedo_color = Color(0,0,0)
	puerta.mesh = p_box; puerta.material_override = mat_puerta
	puerta.position = Vector3(0, 1.25, 4.01)
	casa.add_child(puerta)
	
	# Techo (Prisma de Paja/Madera)
	var techo = MeshInstance3D.new()
	var t_mesh = PrismMesh.new(); t_mesh.size = Vector3(9, 3, 9)
	techo.mesh = t_mesh; techo.material_override = mat_madera
	techo.position.y = 5.5
	casa.add_child(techo)
	
	casa.position = pos
	casa.rotation_degrees.y = randf_range(0, 360)
	add_child(casa)

# --- CAMINOS DE PIEDRA ---
func crear_camino(pos_inicial: Vector3, pos_final: Vector3, num_piedras: int):
	for i in range(num_piedras):
		var interp = float(i) / float(num_piedras)
		var p_pos = pos_inicial.lerp(pos_final, interp)
		
		# Variación orgánica
		p_pos.x += randf_range(-1.0, 1.0)
		p_pos.z += randf_range(-1.0, 1.0)
		
		var piedra = MeshInstance3D.new()
		var b_mesh = BoxMesh.new(); b_mesh.size = Vector3(randf_range(2,3), 0.2, randf_range(2,3))
		piedra.mesh = b_mesh; piedra.material_override = mat_pared_caliza
		piedra.position = Vector3(p_pos.x, 0.1, p_pos.z)
		piedra.rotation_degrees.y = randf_range(0, 360)
		add_child(piedra)
