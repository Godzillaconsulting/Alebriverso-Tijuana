import bpy
import math
import os

def clean_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

def export_model(filename):
    path = f"C:\\Users\\GODZILLA.IA\\Tijuana\\Godzilla_Game\\models\\{filename}.glb"
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB')
    print(f"Exportado: {filename}.glb")

# --- 1. PORTAL DEL MICTLÁN (Sirve como Checkpoint y Meta) ---
clean_scene()
# Aro de piedra
bpy.ops.mesh.primitive_torus_add(major_radius=2.0, minor_radius=0.5, location=(0, 2, 0), rotation=(math.radians(90), 0, 0))
# Base
bpy.ops.mesh.primitive_cube_add(size=2.0, scale=(2, 0.2, 1), location=(0, -0.2, 0))
export_model("portal_mictlan")

# --- 2. PILAR DE OBSIDIANA (Decoración del entorno) ---
clean_scene()
# Cuerpo del pilar
bpy.ops.mesh.primitive_cylinder_add(radius=0.6, depth=4.0, location=(0, 2, 0))
# Bases cuadradas estilo azteca
bpy.ops.mesh.primitive_cube_add(size=1.5, location=(0, 0.5, 0))
bpy.ops.mesh.primitive_cube_add(size=1.8, location=(0, 0.2, 0))
bpy.ops.mesh.primitive_cube_add(size=1.5, location=(0, 3.5, 0))
export_model("pilar_azteca")

# --- 3. PLATAFORMA TEMPLO (Sustituye a los aburridos cubos) ---
clean_scene()
# Escalón 1 (Base grande)
bpy.ops.mesh.primitive_cube_add(size=6.0, scale=(1, 0.2, 1), location=(0, 0, 0))
# Escalón 2 (Medio)
bpy.ops.mesh.primitive_cube_add(size=5.0, scale=(1, 0.2, 1), location=(0, 0.6, 0))
export_model("chinampa_templo")

print("--- TODOS LOS ASSETS GENERADOS ---")
