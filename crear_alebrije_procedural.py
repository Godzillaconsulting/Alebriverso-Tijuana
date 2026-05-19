import bpy
import math
import os

# 1. Limpiar escena completamente
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 2. Crear el objeto base Metaball
# Las "Metaballs" son fórmulas matemáticas que se fusionan como gotas de mercurio.
# Son perfectas para crear formas orgánicas y redondeadas por código.
mball = bpy.data.metaballs.new("AlebrijeMeta")
# Aumentar la resolución para que los polígonos sean suaves
mball.resolution = 0.1 
mball.render_resolution = 0.1

obj = bpy.data.objects.new("AlebrijeBase", mball)
bpy.context.collection.objects.link(obj)

def add_meta_part(location, radius):
    """Función para agregar 'gotas' de volumen que se fusionan"""
    element = mball.elements.new()
    element.co = location
    element.radius = radius
    element.type = 'BALL'
    return element

# 3. CONSTRUCCIÓN DEL MODELO (El Árbol de decisiones de geometría)

# -- Cuerpo central --
add_meta_part((0, 0, 1.5), 1.2)
add_meta_part((0, 0.8, 1.6), 1.0) # Pecho

# -- Cabeza de Iguana --
add_meta_part((0, 1.8, 2.0), 0.7) # Cráneo
add_meta_part((0, 2.4, 1.9), 0.4) # Hocico alargado

# -- Cola larga (fusionándose hacia atrás) --
add_meta_part((0, -1.0, 1.3), 0.8)
add_meta_part((0, -2.0, 1.0), 0.6)
add_meta_part((0, -3.0, 0.7), 0.4)
add_meta_part((0, -4.0, 0.4), 0.2)

# -- Piernas traseras (gruesas) --
add_meta_part((0.8, -0.5, 0.7), 0.5)
add_meta_part((-0.8, -0.5, 0.7), 0.5)
# Pies traseros
add_meta_part((0.9, -0.2, 0.2), 0.3)
add_meta_part((-0.9, -0.2, 0.2), 0.3)

# -- Brazos delanteros --
add_meta_part((0.7, 1.2, 0.8), 0.4)
add_meta_part((-0.7, 1.2, 0.8), 0.4)
# Manos delanteras
add_meta_part((0.8, 1.5, 0.3), 0.25)
add_meta_part((-0.8, 1.5, 0.3), 0.25)

# -- Alas rudimentarias (esferas altas) --
add_meta_part((1.0, 0.5, 2.2), 0.5)
add_meta_part((-1.0, 0.5, 2.2), 0.5)

# 4. Magia: Convertir la matemática en polígonos reales suavizados
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.convert(target='MESH')

# Darle la instrucción de que las caras no sean cuadradas, sino sombreado suave
bpy.ops.object.shade_smooth()

# 5. Exportar el modelo listo para Godot (.glb)
export_path = r"C:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\alebrije_procedural.glb"
# Export format is automatically determined by the extension .glb or explicitly set
bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB')

print(f"MAGIA COMPLETADA. Modelo exportado a {export_path}")
