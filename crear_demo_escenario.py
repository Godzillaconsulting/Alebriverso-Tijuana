import bpy
import random
import os

# Borrar la escena por defecto
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Crear un plano como suelo
bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
suelo = bpy.context.active_object
suelo.name = "Terreno"

# Crear una pequeña "ciudad" de estructuras cúbicas
for i in range(35):
    x = random.uniform(-10, 10)
    y = random.uniform(-10, 10)
    height = random.uniform(1, 8)
    # Colocar en z = height/2 para que descanse sobre el suelo
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, height / 2.0))
    obj = bpy.context.active_object
    obj.scale[2] = height
    obj.name = f"Estructura_{i}"

# Añadir una esfera flotante misteriosa en el centro
bpy.ops.mesh.primitive_uv_sphere_add(radius=2, location=(0, 0, 12))
esfera = bpy.context.active_object
esfera.name = "Orbe_Flotante"

# Añadir una luz de sol espectacular
bpy.ops.object.light_add(type='SUN', location=(10, 10, 20))
sol = bpy.context.active_object
sol.data.energy = 4.0
sol.rotation_euler = (0.8, -0.4, 0)

# Añadir una luz puntual cerca del orbe flotante
bpy.ops.object.light_add(type='POINT', location=(0, 0, 10))
punto = bpy.context.active_object
punto.data.energy = 5000.0
punto.data.color = (0.8, 0.2, 1.0) # Luz púrpura
punto.name = "Luz_Orbe"

# Guardar el archivo
output_path = os.path.abspath("escenario_generado.blend")
bpy.ops.wm.save_as_mainfile(filepath=output_path)
print(f"MAGIA COMPLETADA. Archivo guardado en: {output_path}")
