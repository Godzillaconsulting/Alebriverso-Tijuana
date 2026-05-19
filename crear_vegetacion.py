import bpy
import math
import random
import os

def clean_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

def export_model(filename):
    path = f"C:\\Users\\GODZILLA.IA\\Tijuana\\Godzilla_Game\\models\\{filename}.glb"
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB')
    print(f"Generado: {filename}.glb")

# --- 1. ÁRBOL DE LA SELVA (Estilo Low Poly / Crash) ---
clean_scene()
# Tronco
bpy.ops.mesh.primitive_cylinder_add(radius=0.3, depth=3.0, location=(0, 1.5, 0))
# Hojas principales (copa del árbol)
bpy.ops.mesh.primitive_ico_sphere_add(radius=1.5, subdivisions=2, location=(0, 3.5, 0))
# Hojas laterales para darle volumen orgánico
bpy.ops.mesh.primitive_ico_sphere_add(radius=1.2, subdivisions=2, location=(0.8, 3.0, 0.5))
bpy.ops.mesh.primitive_ico_sphere_add(radius=1.2, subdivisions=2, location=(-0.8, 3.0, -0.5))
bpy.ops.mesh.primitive_ico_sphere_add(radius=1.0, subdivisions=2, location=(0, 2.5, 1.0))
export_model("arbol_selva")

# --- 2. FLOR DE CEMPASÚCHIL FLOTANTE ---
clean_scene()
# Tallo delgado verde
bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.5, location=(0, 0.25, 0))
# Pétalos densos (Esfera aplastada)
bpy.ops.mesh.primitive_ico_sphere_add(radius=0.25, subdivisions=3, location=(0, 0.5, 0))
flor = bpy.context.active_object
flor.scale = (1.0, 0.5, 1.0) # Aplastar la esfera para que parezca flor
export_model("flor_cempasuchil")

# --- 3. MATORRAL DE PASTO SALVAJE ---
clean_scene()
# Crear varios conos verdes simulando briznas de pasto altas
for i in range(7):
    x = random.uniform(-0.3, 0.3)
    z = random.uniform(-0.3, 0.3)
    rot_x = random.uniform(-0.4, 0.4)
    rot_y = random.uniform(-0.4, 0.4)
    rot_z = random.uniform(0, 6.28)
    bpy.ops.mesh.primitive_cone_add(radius1=0.05, radius2=0.0, depth=0.8, location=(x, 0.4, z), rotation=(rot_x, rot_y, rot_z))
export_model("pasto_matorral")

print("--- VEGETACIÓN GENERADA CON ÉXITO ---")
