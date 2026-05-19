import re

file_path = r"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\scripts\main.gd"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Eliminar MURO BLOQUEADOR GIGANTE viejo y reemplazar con monolitos
muro_viejo = """	# MURO BLOQUEADOR GIGANTE (Aspecto de Fortaleza Antigua)
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
	muro_bloqueo.position = Vector3(0, 12, -45); add_child(muro_bloqueo)"""

muro_nuevo = """	# BARRERA DE MONOLITOS ORGÁNICOS
	for x in [-20, -10, 0, 10, 20]:
		crear_roca_flotante(Vector3(x, 0, -45), Vector3(8, 12, 5))"""
content = content.replace(muro_viejo, muro_nuevo)

# 2. Reemplazar RUTA ESTE para plataformas en línea recta (sin doble salto)
ruta_vieja = """	# 5. RUTA ESTE — Calzada de Saltos Largos
	crear_plataforma(Vector3(50, 0, 0), Vector3(20, 1, 20), mat_obsidiana)
	crear_caja(Vector3(55, 1, 0)); crear_caja(Vector3(45, 1, 0))
	# Plataformas sobre el abismo (mucho más separadas)
	for i in range(8):
		crear_plataforma(Vector3(70 + i*12, i*1.2, randf_range(-5,5)), Vector3(5, 0.5, 5), mat_obsidiana)
	# Altar del Este Épico + Gema oculta
	crear_plataforma(Vector3(180, 10, -5), Vector3(25, 1, 25), mat_obsidiana)
	crear_tzompantli(Vector3(180, 10, -16), 12)"""

ruta_nueva = """	# 5. RUTA ESTE — Saltos Realistas hacia enfrente
	crear_roca_flotante(Vector3(40, 0, 0), Vector3(8, 2, 8))
	crear_caja(Vector3(42, 2, 0)); crear_caja(Vector3(38, 2, 0))
	# Plataformas alineadas hacia el este (separación de 6m para un salto normal humano)
	for i in range(12):
		crear_roca_flotante(Vector3(50 + i*6, 0, 0), Vector3(4, 1, 4))
	# Altar del Este (Gran roca plana)
	crear_roca_flotante(Vector3(125, 0, 0), Vector3(10, 2, 10))"""
content = content.replace(ruta_vieja, ruta_nueva)

# 3. Eliminar Camino de antorchas altas de la _ready
antorchas = """	# Camino de Antorchas Altas
	for z in range(-190, -80, 15):
		crear_antorcha_alta(Vector3(-10, -4, z))
		crear_antorcha_alta(Vector3(10, -4, z))"""
content = content.replace(antorchas, "")

# 4. Agregar función crear_roca_flotante y eliminar crear_plataforma y demas basura
roca_func = """func crear_roca_flotante(pos: Vector3, escala: Vector3 = Vector3(1,1,1)):
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
		
	add_child(m_inst)"""

# Borramos func crear_plataforma, crear_pilar, crear_antorcha_alta, crear_flor, crear_ruina_azteca, crear_camino
def purge_func(func_name, content):
    pattern = r"func " + func_name + r"\([^)]*\):.*?(?=func [a-zA-Z_]+\()"
    match = re.search(pattern, content, re.DOTALL)
    if match:
        content = content[:match.start()] + "" + content[match.end():]
    return content

content = purge_func("crear_plataforma", content)
content = purge_func("crear_pilar", content)
content = purge_func("crear_antorcha_alta", content)
content = purge_func("crear_flor", content)
content = purge_func("crear_ruina_azteca", content)
content = purge_func("crear_camino", content)
content = purge_func("crear_casa_azteca", content)
content = purge_func("crear_interruptor", content)
content = purge_func("crear_peso_camion", content)

content += "\n\n" + roca_func + "\n"

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Purga SM64 completada.")
