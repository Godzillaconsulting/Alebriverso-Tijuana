import re

file_path = r"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\scripts\main.gd"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

def replace_func(func_name, new_body, content):
    pattern = r"func " + func_name + r"\([^)]*\):.*?(?=func [a-zA-Z_]+\()"
    # Use re.DOTALL to match across newlines
    match = re.search(pattern, content, re.DOTALL)
    if match:
        content = content[:match.start()] + new_body + "\n\n" + content[match.end():]
    return content

caja = """func crear_caja(pos: Vector3):
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
	crate.add_child(m_inst)
	crate.position = pos
	add_child(crate)"""

arbol = """func crear_arbol(pos: Vector3):
	var m_inst = cargar_glb_runtime("res://models/arbol_muerto_re4.glb")
	if not m_inst: m_inst = Node3D.new()
	m_inst.position = pos
	m_inst.rotation_degrees.y = randf_range(0, 360)
	var sb = StaticBody3D.new()
	var col = CollisionShape3D.new()
	var shape = CylinderShape3D.new(); shape.radius = 0.8; shape.height = 6.0
	col.shape = shape
	sb.add_child(col)
	m_inst.add_child(sb)
	add_child(m_inst)"""

arbol_caido = """func crear_arbol_caido(pos: Vector3, rot_y: float):
	var m_inst = cargar_glb_runtime("res://models/arbol_muerto_re4.glb")
	if not m_inst: m_inst = Node3D.new()
	m_inst.position = pos
	m_inst.rotation_degrees.y = rot_y
	m_inst.rotation_degrees.x = 90
	add_child(m_inst)"""

monolito = """func crear_monolito_flotante(pos: Vector3):
	var m_inst = cargar_glb_runtime("res://models/monolito_obsidiana.glb")
	if not m_inst: m_inst = Node3D.new()
	m_inst.position = pos
	m_inst.rotation_degrees = Vector3(randf_range(0, 360), randf_range(0, 360), randf_range(0, 360))
	add_child(m_inst)"""
	
combi = """func crear_portal_combi(pos: Vector3):
	var m_inst = cargar_glb_runtime("res://models/portal_obsidiana.glb")
	if not m_inst: m_inst = Node3D.new()
	m_inst.position = pos
	
	var luz = OmniLight3D.new()
	luz.light_color = Color(0.6, 0.1, 0.9)
	luz.light_energy = 8.0
	luz.omni_range = 10.0
	luz.position = Vector3(0, 1, -2.5)
	m_inst.add_child(luz)
	add_child(m_inst)"""

maleza = """func crear_maleza_bloqueadora(pos: Vector3):
	var m_inst = cargar_glb_runtime("res://models/arbol_muerto_re4.glb")
	if not m_inst: m_inst = Node3D.new()
	m_inst.position = pos
	m_inst.scale = Vector3(0.5, 0.2, 0.5)
	add_child(m_inst)"""

tzompantli = """func crear_tzompantli(pos: Vector3, columnas: int):
	pass # Eliminado para quitar esferas feas"""

calendario = """func crear_calendario_azteca(pos: Vector3):
	pass # Eliminado para quitar polígonos feos"""

content = replace_func("crear_caja", caja, content)
content = replace_func("crear_arbol", arbol, content)
content = replace_func("crear_arbol_caido", arbol_caido, content)
content = replace_func("crear_monolito_flotante", monolito, content)
content = replace_func("crear_portal_combi", combi, content)
content = replace_func("crear_maleza_bloqueadora", maleza, content)
content = replace_func("crear_tzompantli", tzompantli, content)
content = replace_func("crear_calendario_azteca", calendario, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Refactorización completada.")
