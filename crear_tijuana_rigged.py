import bpy
import math

# 1. Limpiar escena
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# 2. Crear Armature (Esqueleto)
bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
arm_obj = bpy.context.active_object
arm_obj.name = "TijuanaRig"
amt = arm_obj.data
amt.name = "TijuanaArmature"

# Hueso Root
root_bone = amt.edit_bones[0]
root_bone.name = "Root"
root_bone.head = (0, 0, 0)
root_bone.tail = (0, 0, 0.5)

# Columna (Spine)
spine = amt.edit_bones.new("Spine")
spine.head = (0, 0, 0.5)
spine.tail = (0, 0, 1.2)
spine.parent = root_bone
spine.use_connect = True

# Cabeza (Head)
head = amt.edit_bones.new("Head")
head.head = (0, 0, 1.2)
head.tail = (0, 0, 1.8)
head.parent = spine
head.use_connect = True

# Brazo Izquierdo
arm_l = amt.edit_bones.new("Arm.L")
arm_l.head = (0.5, 0, 1.0)
arm_l.tail = (1.0, 0, 0.5)
arm_l.parent = spine

# Brazo Derecho
arm_r = amt.edit_bones.new("Arm.R")
arm_r.head = (-0.5, 0, 1.0)
arm_r.tail = (-1.0, 0, 0.5)
arm_r.parent = spine

# Pierna Izquierda
leg_l = amt.edit_bones.new("Leg.L")
leg_l.head = (0.3, 0, 0.5)
leg_l.tail = (0.3, 0, 0.0)
leg_l.parent = root_bone

# Pierna Derecha
leg_r = amt.edit_bones.new("Leg.R")
leg_r.head = (-0.3, 0, 0.5)
leg_r.tail = (-0.3, 0, 0.0)
leg_r.parent = root_bone

# Salir a modo Objeto
bpy.ops.object.mode_set(mode='OBJECT')

# 3. Crear Geometría (Forma redonda, de culto)
def create_mesh(name, primitive_op, location, scale, material_color):
    primitive_op(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    
    mat = bpy.data.materials.new(name=f"Mat_{name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = material_color
        bsdf.inputs['Roughness'].default_value = 0.8
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj

# Colores (RGBA)
color_skin = (0.15, 0.6, 0.2, 1.0) # Lagartija verde/lima
color_gopro = (0.05, 0.05, 0.05, 1.0)
color_fanny = (1.0, 0.2, 0.6, 1.0) # Rosa chillón
color_belly = (0.8, 0.8, 0.4, 1.0) # Panza amarilla

meshes = []

# Torso (Gordito, esférico)
meshes.append(create_mesh("Torso", bpy.ops.mesh.primitive_uv_sphere_add, (0, 0, 0.85), (0.6, 0.5, 0.6), color_skin))
# Panza
meshes.append(create_mesh("Panza", bpy.ops.mesh.primitive_uv_sphere_add, (0, -0.15, 0.85), (0.5, 0.45, 0.55), color_belly))
# Cabeza (Redonda)
meshes.append(create_mesh("Cabeza", bpy.ops.mesh.primitive_uv_sphere_add, (0, 0, 1.5), (0.35, 0.35, 0.35), color_skin))
# Hocico
meshes.append(create_mesh("Hocico", bpy.ops.mesh.primitive_cube_add, (0, -0.3, 1.45), (0.15, 0.2, 0.1), color_skin))
# Brazos
meshes.append(create_mesh("Brazo.L", bpy.ops.mesh.primitive_cylinder_add, (0.75, 0, 0.75), (0.12, 0.12, 0.4), color_skin))
meshes.append(create_mesh("Brazo.R", bpy.ops.mesh.primitive_cylinder_add, (-0.75, 0, 0.75), (0.12, 0.12, 0.4), color_skin))
# Piernas
meshes.append(create_mesh("Pierna.L", bpy.ops.mesh.primitive_cylinder_add, (0.3, 0, 0.25), (0.18, 0.18, 0.25), color_skin))
meshes.append(create_mesh("Pierna.R", bpy.ops.mesh.primitive_cylinder_add, (-0.3, 0, 0.25), (0.18, 0.18, 0.25), color_skin))
# Cangurera
meshes.append(create_mesh("Cangurera", bpy.ops.mesh.primitive_cube_add, (0, -0.55, 0.75), (0.25, 0.1, 0.15), color_fanny))
# GoPro
meshes.append(create_mesh("GoPro", bpy.ops.mesh.primitive_cube_add, (0, -0.35, 1.7), (0.08, 0.08, 0.06), color_gopro))
# Cola
meshes.append(create_mesh("Cola", bpy.ops.mesh.primitive_cone_add, (0, 0.4, 0.5), (0.15, 0.15, 0.5), color_skin))

# Ajustes de rotación
bpy.data.objects['Brazo.L'].rotation_euler = (0, -0.5, 0)
bpy.data.objects['Brazo.R'].rotation_euler = (0, 0.5, 0)
bpy.data.objects['Cola'].rotation_euler = (-1.0, 0, 0)

# Unir todas las mallas
bpy.ops.object.select_all(action='DESELECT')
for m in meshes:
    m.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
joined_mesh = bpy.context.active_object
joined_mesh.name = "TijuanaMesh"

# 4. Asignar Esqueleto con Pesos Automáticos
bpy.ops.object.select_all(action='DESELECT')
joined_mesh.select_set(True)
arm_obj.select_set(True)
bpy.context.view_layer.objects.active = arm_obj
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

# 5. Exportar a GLB
export_path = r"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\tijuana_rigged.glb"
bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=False)

print(f"Exportado exitosamente a {export_path}")

