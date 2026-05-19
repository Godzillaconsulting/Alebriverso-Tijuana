import bpy
import math

# Limpiar escena
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

def create_material(name, color):
    mat = bpy.data.materials.new(name=f"Mat_{name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
        bsdf.inputs['Roughness'].default_value = 0.8 # Piedra no muy brillante
    return mat

def create_mesh(name, primitive_op, location, scale, material, **kwargs):
    primitive_op(location=location, **kwargs)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    if material:
        obj.data.materials.append(material)
    
    # Añadir un Bevel modifier para que no se vea tan "N64" y capte mejor la luz (estilo PS2)
    mod = obj.modifiers.new(name="Bevel", type='BEVEL')
    mod.width = 0.2
    mod.segments = 2
    
    return obj

# Paleta de colores "Atardecer Cálido" para contrastar con Tijuana
mat_piedra_volcanica = create_material("PiedraVolcanica", (0.3, 0.2, 0.18, 1))
mat_piedra_clara = create_material("PiedraClara", (0.6, 0.5, 0.45, 1))
mat_rojo_sangre = create_material("RojoSangre", (0.5, 0.1, 0.05, 1))
mat_agua = create_material("AguaCanal", (0.1, 0.3, 0.4, 1))
mat_oro = create_material("OroInca", (0.8, 0.6, 0.1, 1))
mat_obsidiana = create_material("Obsidiana", (0.05, 0.05, 0.08, 1))

# --- 1. PLAZA PRINCIPAL (Mercado) ---
# Piso principal con más detalle (compuesto por varias losas grandes en vez de un solo plano)
for x in range(-2, 3):
    for y in range(-2, 3):
        create_mesh(f"Losa_Plaza_{x}_{y}", bpy.ops.mesh.primitive_cube_add, (x*20, y*20, 0), (9.9, 9.9, 0.5), mat_piedra_clara)

# --- 2. CANAL Y CHINAMPA REDONDEADA ---
# Canal de agua (plano enorme)
create_mesh("Agua_Texcoco", bpy.ops.mesh.primitive_plane_add, (0, -60, -2), (100, 40, 1), mat_agua)
# Chinampa con bordes suavizados (usando cilindro aplastado para romper la cuadratura)
create_mesh("Chinampa_Curva", bpy.ops.mesh.primitive_cylinder_add, (0, -60, -0.5), (15, 10, 0.5), mat_piedra_volcanica, vertices=32)

# --- 3. TEMPLO MAYOR (Escalinatas reales y columnas) ---
# Base piramidal (3 niveles escalonados)
create_mesh("Templo_Base1", bpy.ops.mesh.primitive_cube_add, (0, 60, 2), (25, 20, 2), mat_piedra_volcanica)
create_mesh("Templo_Base2", bpy.ops.mesh.primitive_cube_add, (0, 64, 6), (20, 16, 2), mat_piedra_volcanica)
create_mesh("Templo_Base3", bpy.ops.mesh.primitive_cube_add, (0, 68, 10), (15, 12, 2), mat_piedra_volcanica)

# Escalinata esculpida (varios peldaños en lugar de una rampa lisa)
for i in range(15):
    create_mesh(f"Peldano_{i}", bpy.ops.mesh.primitive_cube_add, (0, 40 + i*1.8, 0.5 + i*0.8), (6, 1.5, 0.5), mat_piedra_clara)

# Santuarios en la cima (con columnas cilíndricas!)
# Santuario Tlaloc (Izquierda)
create_mesh("Sant_Tlaloc_Base", bpy.ops.mesh.primitive_cube_add, (-4, 72, 13), (4, 4, 1), mat_agua)
create_mesh("Col_T_1", bpy.ops.mesh.primitive_cylinder_add, (-7, 69, 15), (0.5, 0.5, 2), mat_piedra_clara)
create_mesh("Col_T_2", bpy.ops.mesh.primitive_cylinder_add, (-1, 69, 15), (0.5, 0.5, 2), mat_piedra_clara)
create_mesh("Techo_Tlaloc", bpy.ops.mesh.primitive_cube_add, (-4, 72, 17.5), (4.5, 4.5, 0.5), mat_agua)

# Santuario Huitzilopochtli (Derecha)
create_mesh("Sant_Huitzi_Base", bpy.ops.mesh.primitive_cube_add, (4, 72, 13), (4, 4, 1), mat_rojo_sangre)
create_mesh("Col_H_1", bpy.ops.mesh.primitive_cylinder_add, (1, 69, 15), (0.5, 0.5, 2), mat_piedra_clara)
create_mesh("Col_H_2", bpy.ops.mesh.primitive_cylinder_add, (7, 69, 15), (0.5, 0.5, 2), mat_piedra_clara)
create_mesh("Techo_Huitzi", bpy.ops.mesh.primitive_cube_add, (4, 72, 17.5), (4.5, 4.5, 0.5), mat_rojo_sangre)

# --- 4. ATREZO (Props estéticos) ---
# Braseros circulares (ya no cuadrados)
create_mesh("Brasero_L", bpy.ops.mesh.primitive_cylinder_add, (-8, 40, 1.5), (1.5, 1.5, 1), mat_obsidiana)
create_mesh("Brasero_R", bpy.ops.mesh.primitive_cylinder_add, (8, 40, 1.5), (1.5, 1.5, 1), mat_obsidiana)

# Calendario Azteca de Oro (decoración en el piso de la plaza)
create_mesh("Calendario_Centro", bpy.ops.mesh.primitive_cylinder_add, (0, 0, 0.6), (6, 6, 0.2), mat_oro, vertices=64)


# Exportar
import os
os.makedirs(r"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models", exist_ok=True)
export_path = r"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\escenario_tenochtitlan_ps2.glb"

# Aplicar modificadores antes de exportar
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=False, export_apply=True)

print(f"Escenario Nivel 1 (Estilo PS2) exportado con éxito a: {export_path}")
