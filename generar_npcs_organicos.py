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

def add_metaball(mball, name, location, radius):
    element = mball.elements.new()
    element.co = location
    element.radius = radius
    return element

def create_organic_humanoid(name, material_color):
    # Crear contenedor de metaballs
    mdata = bpy.data.metaballs.new(name + "_Meta")
    mobj = bpy.data.objects.new(name + "_MetaObj", mdata)
    bpy.context.collection.objects.link(mobj)
    
    # Torso
    add_metaball(mdata, "Torso1", (0, 0, 1.0), 0.3)
    add_metaball(mdata, "Torso2", (0, 0, 1.2), 0.35)
    add_metaball(mdata, "Torso3", (0, 0, 1.4), 0.4)
    # Cabeza
    add_metaball(mdata, "Neck", (0, 0, 1.6), 0.15)
    add_metaball(mdata, "Head", (0, 0, 1.8), 0.25)
    # Brazos L
    add_metaball(mdata, "Shoulder.L", (0.3, 0, 1.4), 0.15)
    add_metaball(mdata, "Bicep.L", (0.45, 0, 1.2), 0.12)
    add_metaball(mdata, "Forearm.L", (0.55, 0, 0.9), 0.1)
    add_metaball(mdata, "Hand.L", (0.6, 0, 0.6), 0.12)
    # Brazos R
    add_metaball(mdata, "Shoulder.R", (-0.3, 0, 1.4), 0.15)
    add_metaball(mdata, "Bicep.R", (-0.45, 0, 1.2), 0.12)
    add_metaball(mdata, "Forearm.R", (-0.55, 0, 0.9), 0.1)
    add_metaball(mdata, "Hand.R", (-0.6, 0, 0.6), 0.12)
    # Piernas L
    add_metaball(mdata, "Hip.L", (0.2, 0, 0.9), 0.2)
    add_metaball(mdata, "Thigh.L", (0.2, 0, 0.6), 0.18)
    add_metaball(mdata, "Calf.L", (0.2, 0, 0.3), 0.15)
    add_metaball(mdata, "Foot.L", (0.2, 0.1, 0.05), 0.12)
    # Piernas R
    add_metaball(mdata, "Hip.R", (-0.2, 0, 0.9), 0.2)
    add_metaball(mdata, "Thigh.R", (-0.2, 0, 0.6), 0.18)
    add_metaball(mdata, "Calf.R", (-0.2, 0, 0.3), 0.15)
    add_metaball(mdata, "Foot.R", (-0.2, 0.1, 0.05), 0.12)
    
    # Aumentar resolución
    mdata.resolution = 0.05
    
    # Convertir a malla
    bpy.context.view_layer.objects.active = mobj
    mobj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    mesh_obj = bpy.context.active_object
    mesh_obj.name = name + "Mesh"
    
    # Material
    mat = bpy.data.materials.new(name=f"Mat_{name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = material_color
    mesh_obj.data.materials.append(mat)
    
    return mesh_obj

def create_organic_quadruped(name, material_color):
    mdata = bpy.data.metaballs.new(name + "_Meta")
    mobj = bpy.data.objects.new(name + "_MetaObj", mdata)
    bpy.context.collection.objects.link(mobj)
    
    # Torso
    add_metaball(mdata, "Chest", (0, 0.6, 0.5), 0.25)
    add_metaball(mdata, "Belly", (0, 0.3, 0.45), 0.22)
    add_metaball(mdata, "Hips", (0, 0.0, 0.5), 0.22)
    # Cabeza
    add_metaball(mdata, "Neck", (0, 0.8, 0.6), 0.15)
    add_metaball(mdata, "Head", (0, 0.95, 0.75), 0.2)
    add_metaball(mdata, "Snout", (0, 1.15, 0.7), 0.12)
    # Orejas
    add_metaball(mdata, "Ear.L", (0.1, 0.9, 0.9), 0.08)
    add_metaball(mdata, "Ear.R", (-0.1, 0.9, 0.9), 0.08)
    # Piernas FL
    add_metaball(mdata, "Shoulder.FL", (0.15, 0.6, 0.4), 0.12)
    add_metaball(mdata, "Leg.FL", (0.15, 0.6, 0.2), 0.08)
    add_metaball(mdata, "Foot.FL", (0.15, 0.65, 0.05), 0.06)
    # Piernas FR
    add_metaball(mdata, "Shoulder.FR", (-0.15, 0.6, 0.4), 0.12)
    add_metaball(mdata, "Leg.FR", (-0.15, 0.6, 0.2), 0.08)
    add_metaball(mdata, "Foot.FR", (-0.15, 0.65, 0.05), 0.06)
    # Piernas BL
    add_metaball(mdata, "Thigh.BL", (0.15, 0.0, 0.4), 0.15)
    add_metaball(mdata, "Leg.BL", (0.15, -0.1, 0.2), 0.08)
    add_metaball(mdata, "Foot.BL", (0.15, -0.05, 0.05), 0.06)
    # Piernas BR
    add_metaball(mdata, "Thigh.BR", (-0.15, 0.0, 0.4), 0.15)
    add_metaball(mdata, "Leg.BR", (-0.15, -0.1, 0.2), 0.08)
    add_metaball(mdata, "Foot.BR", (-0.15, -0.05, 0.05), 0.06)
    # Cola
    add_metaball(mdata, "Tail1", (0, -0.15, 0.5), 0.08)
    add_metaball(mdata, "Tail2", (0, -0.3, 0.45), 0.06)
    add_metaball(mdata, "Tail3", (0, -0.45, 0.4), 0.04)

    mdata.resolution = 0.05
    bpy.context.view_layer.objects.active = mobj
    mobj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    mesh_obj = bpy.context.active_object
    mesh_obj.name = name + "Mesh"
    
    mat = bpy.data.materials.new(name=f"Mat_{name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = material_color
    mesh_obj.data.materials.append(mat)
    
    return mesh_obj

def rig_humanoid(mesh_obj, name):
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = name + "Rig"
    amt = arm.data

    root = amt.edit_bones[0]
    root.name = "Root"; root.head = (0,0,0); root.tail = (0,0,0.5)
    
    spine = amt.edit_bones.new("Spine"); spine.head = (0,0,0.5); spine.tail = (0,0,1.2); spine.parent = root; spine.use_connect = True
    head = amt.edit_bones.new("Head"); head.head = (0,0,1.2); head.tail = (0,0,1.8); head.parent = spine; head.use_connect = True
    arm_l = amt.edit_bones.new("Arm.L"); arm_l.head = (0.25,0,1.3); arm_l.tail = (0.6,0,0.6); arm_l.parent = spine
    arm_r = amt.edit_bones.new("Arm.R"); arm_r.head = (-0.25,0,1.3); arm_r.tail = (-0.6,0,0.6); arm_r.parent = spine
    leg_l = amt.edit_bones.new("Leg.L"); leg_l.head = (0.2,0,0.8); leg_l.tail = (0.2,0,0.0); leg_l.parent = root
    leg_r = amt.edit_bones.new("Leg.R"); leg_r.head = (-0.2,0,0.8); leg_r.tail = (-0.2,0,0.0); leg_r.parent = root

    bpy.ops.object.mode_set(mode='OBJECT')
    
    bpy.ops.object.select_all(action='DESELECT')
    mesh_obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return arm

def rig_quadruped(mesh_obj, name):
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = name + "Rig"
    amt = arm.data

    root = amt.edit_bones[0]
    root.name = "Root"; root.head = (0,0,0.4); root.tail = (0,0.2,0.4)
    
    spine = amt.edit_bones.new("Spine"); spine.head = (0,0.2,0.4); spine.tail = (0,0.8,0.4); spine.parent = root; spine.use_connect = True
    neck = amt.edit_bones.new("Neck"); neck.head = (0,0.8,0.4); neck.tail = (0,0.9,0.7); neck.parent = spine; neck.use_connect = True
    head = amt.edit_bones.new("Head"); head.head = (0,0.9,0.7); head.tail = (0,1.2,0.7); head.parent = neck; head.use_connect = True
    
    leg_fl = amt.edit_bones.new("Leg.FL"); leg_fl.head = (0.15, 0.6, 0.4); leg_fl.tail = (0.15, 0.6, 0); leg_fl.parent = spine
    leg_fr = amt.edit_bones.new("Leg.FR"); leg_fr.head = (-0.15, 0.6, 0.4); leg_fr.tail = (-0.15, 0.6, 0); leg_fr.parent = spine
    leg_bl = amt.edit_bones.new("Leg.BL"); leg_bl.head = (0.15, 0.0, 0.4); leg_bl.tail = (0.15, -0.1, 0); leg_bl.parent = root
    leg_br = amt.edit_bones.new("Leg.BR"); leg_br.head = (-0.15, 0.0, 0.4); leg_br.tail = (-0.15, -0.1, 0); leg_br.parent = root
    tail = amt.edit_bones.new("Tail"); tail.head = (0,-0.15,0.4); tail.tail = (0,-0.45,0.4); tail.parent = root

    bpy.ops.object.mode_set(mode='OBJECT')
    
    bpy.ops.object.select_all(action='DESELECT')
    mesh_obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    return arm

def generate_all():
    clean_scene()
    
    # 1. Jaguar (Humanoide)
    c_jaguar = (0.9, 0.7, 0.1, 1.0)
    mesh_jag = create_organic_humanoid("Jaguar", c_jaguar)
    rig_humanoid(mesh_jag, "Jaguar")
    bpy.ops.export_scene.gltf(filepath=r"C:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\jaguar_rigged_realistic.glb", export_format='GLB', use_selection=False)
    
    clean_scene()
    
    # 2. Xoloitzcuintle (Cuadrúpedo)
    c_xolo = (0.15, 0.15, 0.15, 1.0)
    mesh_xolo = create_organic_quadruped("Xolo", c_xolo)
    rig_quadruped(mesh_xolo, "Xolo")
    bpy.ops.export_scene.gltf(filepath=r"C:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\xolo_rigged_realistic.glb", export_format='GLB', use_selection=False)
    
    clean_scene()
    
    # 3. Mercader (Humanoide)
    c_ropa = (0.85, 0.8, 0.7, 1.0)
    mesh_merc = create_organic_humanoid("Mercader", c_ropa)
    rig_humanoid(mesh_merc, "Mercader")
    bpy.ops.export_scene.gltf(filepath=r"C:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\merchant_rigged_realistic.glb", export_format='GLB', use_selection=False)

generate_all()
print("¡Modelos orgánicos generados y riggeados con éxito!")
