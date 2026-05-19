import bpy
import math
import os

# Limpiar escena
bpy.ops.wm.read_factory_settings(use_empty=True)

# Parámetros de la serpiente
segments = 8
radius = 0.2
length_per_segment = 0.4

# 1. Crear Armature (Huesos)
bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
armature = bpy.context.object
armature.name = "Snake_Armature"
bpy.ops.armature.select_all(action='SELECT')
bpy.ops.armature.delete()

bones = []
for i in range(segments):
    bpy.ops.armature.bone_primitive_add(name=f"Bone_{i}")
    bone = armature.data.edit_bones[f"Bone_{i}"]
    bone.head = (0, 0, -i * length_per_segment)
    bone.tail = (0, 0, -(i + 1) * length_per_segment)
    if i > 0:
        bone.parent = armature.data.edit_bones[f"Bone_{i-1}"]
        bone.use_connect = True
    bones.append(bone)

bpy.ops.object.mode_set(mode='OBJECT')

# 2. Crear Malla (Serpiente)
bpy.ops.mesh.primitive_cylinder_add(
    vertices=16, 
    radius=radius, 
    depth=segments * length_per_segment, 
    location=(0, 0, -(segments * length_per_segment) / 2)
)
snake_mesh = bpy.context.object
snake_mesh.name = "Snake_Mesh"

# Rotar cilindro para alinear con huesos
snake_mesh.rotation_euler[0] = math.pi / 2
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Afilar la cola y cabeza
for v in snake_mesh.data.vertices:
    z = v.co.z
    if z < -(segments - 1) * length_per_segment:
        v.co.x *= 0.1
        v.co.y *= 0.1
    elif z > -length_per_segment:
        v.co.x *= 0.8
        v.co.y *= 0.8

# 3. Emparentar Malla al Armature con Pesos Automáticos
snake_mesh.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# 4. Material de la serpiente (Verde oscuro escamoso)
mat = bpy.data.materials.new(name="Mat_Snake")
mat.use_nodes = True
nodes = mat.node_tree.nodes
bsdf = nodes.get("Principled BSDF")
bsdf.inputs['Base Color'].default_value = (0.01, 0.1, 0.02, 1) # Verde oscuro
bsdf.inputs['Roughness'].default_value = 0.2
if snake_mesh.data.materials:
    snake_mesh.data.materials[0] = mat
else:
    snake_mesh.data.materials.append(mat)

# 5. Animación de Nado (Zig-Zag)
bpy.ops.object.mode_set(mode='POSE')
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = 60

action = bpy.data.actions.new(name="Snake_Swim")
armature.animation_data_create().action = action

amplitude = 0.4
speed = 2.0

for frame in range(1, 61):
    bpy.context.scene.frame_set(frame)
    time = frame / 60.0
    
    for i, bone in enumerate(armature.pose.bones):
        bone.rotation_mode = 'XYZ'
        offset = i * 0.5
        # Movimiento zig-zag de izquierda a derecha
        angle = math.sin((time * speed * math.pi * 2) - offset) * amplitude
        bone.rotation_euler[1] = angle
        bone.keyframe_insert(data_path="rotation_euler", frame=frame)

bpy.ops.object.mode_set(mode='OBJECT')

# Exportar a GLB
output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "Godzilla_Game", "models"))
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "snake_rigged.glb")

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    use_selection=False,
    export_animations=True
)

print(f"Serpiente riggeada exportada exitosamente a: {output_path}")
