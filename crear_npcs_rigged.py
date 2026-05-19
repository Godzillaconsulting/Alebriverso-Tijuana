import bpy
import math

def clean_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.armatures:
        bpy.data.armatures.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)

def create_mesh(name, primitive_op, location, scale, material_color, rotation=(0,0,0)):
    primitive_op(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = rotation
    
    mat = bpy.data.materials.new(name=f"Mat_{name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = material_color
        bsdf.inputs['Roughness'].default_value = 0.8
    obj.data.materials.append(mat)
    return obj

def parent_mesh_to_arm(meshes, root_name, arm_obj):
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    joined_mesh = bpy.context.active_object
    joined_mesh.name = root_name

    bpy.ops.object.select_all(action='DESELECT')
    joined_mesh.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return joined_mesh

# -----------------------------------------------------------------
# 1. GUERRERO JAGUAR
# -----------------------------------------------------------------
def create_jaguar():
    clean_scene()
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = "JaguarRig"
    amt = arm.data

    root = amt.edit_bones[0]
    root.name = "Root"; root.head = (0,0,0); root.tail = (0,0,0.5)
    
    spine = amt.edit_bones.new("Spine"); spine.head = (0,0,0.5); spine.tail = (0,0,1.4); spine.parent = root; spine.use_connect = True
    head = amt.edit_bones.new("Head"); head.head = (0,0,1.4); head.tail = (0,0,2.0); head.parent = spine; head.use_connect = True
    arm_l = amt.edit_bones.new("Arm.L"); arm_l.head = (0.5,0,1.2); arm_l.tail = (1.0,0,0.6); arm_l.parent = spine
    arm_r = amt.edit_bones.new("Arm.R"); arm_r.head = (-0.5,0,1.2); arm_r.tail = (-1.0,0,0.6); arm_r.parent = spine
    leg_l = amt.edit_bones.new("Leg.L"); leg_l.head = (0.3,0,0.5); leg_l.tail = (0.3,0,0.0); leg_l.parent = root
    leg_r = amt.edit_bones.new("Leg.R"); leg_r.head = (-0.3,0,0.5); leg_r.tail = (-0.3,0,0.0); leg_r.parent = root

    bpy.ops.object.mode_set(mode='OBJECT')

    c_skin = (0.6, 0.3, 0.15, 1.0)
    c_jaguar = (0.9, 0.7, 0.1, 1.0)
    c_obsidian = (0.1, 0.1, 0.1, 1.0)

    meshes = []
    meshes.append(create_mesh("Torso", bpy.ops.mesh.primitive_cylinder_add, (0, 0, 0.95), (0.4, 0.4, 0.9), c_skin))
    meshes.append(create_mesh("Cabeza", bpy.ops.mesh.primitive_uv_sphere_add, (0, 0, 1.7), (0.3, 0.3, 0.3), c_skin))
    meshes.append(create_mesh("Yelmo", bpy.ops.mesh.primitive_uv_sphere_add, (0, -0.05, 1.8), (0.35, 0.35, 0.35), c_jaguar))
    meshes.append(create_mesh("Macuahuitl", bpy.ops.mesh.primitive_cube_add, (1.0, 0.2, 0.6), (0.05, 0.2, 0.6), c_obsidian, (0, 0, 0)))
    meshes.append(create_mesh("Brazo.L", bpy.ops.mesh.primitive_cylinder_add, (0.75, 0, 0.9), (0.12, 0.12, 0.5), c_skin, (0,-0.5,0)))
    meshes.append(create_mesh("Brazo.R", bpy.ops.mesh.primitive_cylinder_add, (-0.75, 0, 0.9), (0.12, 0.12, 0.5), c_skin, (0,0.5,0)))
    meshes.append(create_mesh("Pierna.L", bpy.ops.mesh.primitive_cylinder_add, (0.3, 0, 0.25), (0.15, 0.15, 0.25), c_skin))
    meshes.append(create_mesh("Pierna.R", bpy.ops.mesh.primitive_cylinder_add, (-0.3, 0, 0.25), (0.15, 0.15, 0.25), c_skin))

    parent_mesh_to_arm(meshes, "JaguarMesh", arm)
    bpy.ops.export_scene.gltf(filepath=r"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\jaguar_rigged.glb", export_format='GLB', use_selection=False)

# -----------------------------------------------------------------
# 2. XOLOITZCUINTLE (PERRO)
# -----------------------------------------------------------------
def create_xolo():
    clean_scene()
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = "XoloRig"
    amt = arm.data

    root = amt.edit_bones[0]
    root.name = "Root"; root.head = (0,0,0.4); root.tail = (0,0.2,0.4)
    
    spine = amt.edit_bones.new("Spine"); spine.head = (0,0.2,0.4); spine.tail = (0,0.8,0.4); spine.parent = root; spine.use_connect = True
    neck = amt.edit_bones.new("Neck"); neck.head = (0,0.8,0.4); neck.tail = (0,0.9,0.7); neck.parent = spine; neck.use_connect = True
    head = amt.edit_bones.new("Head"); head.head = (0,0.9,0.7); head.tail = (0,1.2,0.7); head.parent = neck; head.use_connect = True
    
    leg_fl = amt.edit_bones.new("Leg.FL"); leg_fl.head = (0.2, 0.7, 0.4); leg_fl.tail = (0.2, 0.7, 0); leg_fl.parent = spine
    leg_fr = amt.edit_bones.new("Leg.FR"); leg_fr.head = (-0.2, 0.7, 0.4); leg_fr.tail = (-0.2, 0.7, 0); leg_fr.parent = spine
    leg_bl = amt.edit_bones.new("Leg.BL"); leg_bl.head = (0.2, 0.1, 0.4); leg_bl.tail = (0.2, 0.1, 0); leg_bl.parent = root
    leg_br = amt.edit_bones.new("Leg.BR"); leg_br.head = (-0.2, 0.1, 0.4); leg_br.tail = (-0.2, 0.1, 0); leg_br.parent = root
    
    tail = amt.edit_bones.new("Tail"); tail.head = (0,0.1,0.4); tail.tail = (0,-0.3,0.5); tail.parent = root

    bpy.ops.object.mode_set(mode='OBJECT')

    c_xolo = (0.15, 0.15, 0.15, 1.0)
    meshes = []
    
    meshes.append(create_mesh("Torso", bpy.ops.mesh.primitive_cylinder_add, (0, 0.5, 0.4), (0.25, 0.25, 0.8), c_xolo, (math.pi/2,0,0)))
    meshes.append(create_mesh("Cabeza", bpy.ops.mesh.primitive_uv_sphere_add, (0, 1.0, 0.7), (0.22, 0.22, 0.22), c_xolo))
    meshes.append(create_mesh("Hocico", bpy.ops.mesh.primitive_cube_add, (0, 1.2, 0.7), (0.1, 0.18, 0.1), c_xolo))
    meshes.append(create_mesh("Oreja.L", bpy.ops.mesh.primitive_cone_add, (0.15, 1.0, 0.9), (0.08, 0.08, 0.2), c_xolo, (-0.2,0,0)))
    meshes.append(create_mesh("Oreja.R", bpy.ops.mesh.primitive_cone_add, (-0.15, 1.0, 0.9), (0.08, 0.08, 0.2), c_xolo, (-0.2,0,0)))
    meshes.append(create_mesh("Leg.FL", bpy.ops.mesh.primitive_cylinder_add, (0.2, 0.7, 0.2), (0.06, 0.06, 0.4), c_xolo))
    meshes.append(create_mesh("Leg.FR", bpy.ops.mesh.primitive_cylinder_add, (-0.2, 0.7, 0.2), (0.06, 0.06, 0.4), c_xolo))
    meshes.append(create_mesh("Leg.BL", bpy.ops.mesh.primitive_cylinder_add, (0.2, 0.1, 0.2), (0.06, 0.06, 0.4), c_xolo))
    meshes.append(create_mesh("Leg.BR", bpy.ops.mesh.primitive_cylinder_add, (-0.2, 0.1, 0.2), (0.06, 0.06, 0.4), c_xolo))
    meshes.append(create_mesh("Tail", bpy.ops.mesh.primitive_cone_add, (0, -0.1, 0.45), (0.05, 0.05, 0.2), c_xolo, (-1.0,0,0)))

    parent_mesh_to_arm(meshes, "XoloMesh", arm)
    bpy.ops.export_scene.gltf(filepath=r"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\xolo_rigged.glb", export_format='GLB', use_selection=False)


# -----------------------------------------------------------------
# 3. MERCADER
# -----------------------------------------------------------------
def create_merchant():
    clean_scene()
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = "MerchantRig"
    amt = arm.data

    root = amt.edit_bones[0]
    root.name = "Root"; root.head = (0,0,0); root.tail = (0,0,0.5)
    
    spine = amt.edit_bones.new("Spine"); spine.head = (0,0,0.5); spine.tail = (0,0,1.2); spine.parent = root; spine.use_connect = True
    head = amt.edit_bones.new("Head"); head.head = (0,0,1.2); head.tail = (0,0,1.6); head.parent = spine; head.use_connect = True
    arm_l = amt.edit_bones.new("Arm.L"); arm_l.head = (0.5,0,1.0); arm_l.tail = (1.0,0,0.6); arm_l.parent = spine
    arm_r = amt.edit_bones.new("Arm.R"); arm_r.head = (-0.5,0,1.0); arm_r.tail = (-1.0,0,0.6); arm_r.parent = spine

    bpy.ops.object.mode_set(mode='OBJECT')

    c_ropa = (0.85, 0.8, 0.7, 1.0)
    c_piel = (0.5, 0.3, 0.15, 1.0)
    c_paja = (0.8, 0.7, 0.3, 1.0)

    meshes = []
    meshes.append(create_mesh("Torso", bpy.ops.mesh.primitive_cylinder_add, (0, 0, 0.6), (0.4, 0.4, 0.6), c_ropa))
    meshes.append(create_mesh("Cabeza", bpy.ops.mesh.primitive_uv_sphere_add, (0, 0, 1.4), (0.35, 0.35, 0.35), c_piel))
    meshes.append(create_mesh("Sombrero_Base", bpy.ops.mesh.primitive_cylinder_add, (0, 0, 1.7), (0.9, 0.9, 0.05), c_paja, (-0.2,0,0)))
    meshes.append(create_mesh("Sombrero_Copa", bpy.ops.mesh.primitive_cone_add, (0, 0.05, 1.9), (0.3, 0.3, 0.2), c_paja, (-0.2,0,0)))
    meshes.append(create_mesh("Brazo.L", bpy.ops.mesh.primitive_cylinder_add, (0.75, 0, 0.8), (0.1, 0.1, 0.4), c_ropa, (0,-0.5,0)))
    meshes.append(create_mesh("Brazo.R", bpy.ops.mesh.primitive_cylinder_add, (-0.75, 0, 0.8), (0.1, 0.1, 0.4), c_ropa, (0,0.5,0)))

    parent_mesh_to_arm(meshes, "MerchantMesh", arm)
    bpy.ops.export_scene.gltf(filepath=r"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\merchant_rigged.glb", export_format='GLB', use_selection=False)

# EJECUCIÓN
create_jaguar()
create_xolo()
create_merchant()

print("¡Todos los NPCs generados y exportados!")
