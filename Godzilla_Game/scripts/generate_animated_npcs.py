import bpy
import math

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def export_glb(name):
    export_path = fr"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\{name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_animations=True
    )
    print(f"Exportado: {export_path}")

def build_metaball_biped(is_warrior=False):
    # Crea un cuerpo humanoide orgánico (sin esquinas)
    bpy.ops.object.metaball_add(type='BALL', radius=0.6, location=(0, 0, 1.2))
    mb = bpy.context.active_object
    mb.name = "Body_Meta"
    
    parts = [
        ('Chest', 0.5, (0, 0, 1.5)),
        ('Head', 0.4, (0, 0, 2.2)),
        ('L_Shoulder', 0.3, (0.5, 0, 1.5)),
        ('R_Shoulder', 0.3, (-0.5, 0, 1.5)),
        ('L_Arm', 0.25, (0.6, 0, 1.0)),
        ('R_Arm', 0.25, (-0.6, 0, 1.0)),
        ('L_Hand', 0.2, (0.6, 0, 0.5)),
        ('R_Hand', 0.2, (-0.6, 0, 0.5)),
        ('L_Hip', 0.3, (0.3, 0, 0.8)),
        ('R_Hip', 0.3, (-0.3, 0, 0.8)),
        ('L_Leg', 0.25, (0.3, 0, 0.4)),
        ('R_Leg', 0.25, (-0.3, 0, 0.4)),
        ('L_Foot', 0.2, (0.3, -0.1, 0.1)),
        ('R_Foot', 0.2, (-0.3, -0.1, 0.1))
    ]
    
    # ROPA AZTECA (Faldón / Taparrabos)
    parts.append(('Loincloth_Front', 0.3, (0, -0.3, 0.7)))
    parts.append(('Loincloth_Back', 0.3, (0, 0.3, 0.7)))
    
    if is_warrior:
        # Armadura hombros gruesos
        parts.append(('Armor_L', 0.4, (0.6, 0, 1.6)))
        parts.append(('Armor_R', 0.4, (-0.6, 0, 1.6)))
        # Tocado de cabeza (Penacho base)
        parts.append(('Headdress_1', 0.3, (0, -0.2, 2.5)))
        parts.append(('Headdress_2', 0.3, (0, 0.2, 2.5)))
    
    for name, radius, loc in parts:
        bpy.ops.object.metaball_add(type='BALL', radius=radius, location=loc)
        
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    mesh_obj = bpy.context.active_object
    mesh_obj.name = "Organic_Mesh"
    return mesh_obj

def build_biped_armature(mesh_obj, is_warrior=False):
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = "Rig"
    
    bpy.ops.armature.select_all(action='SELECT')
    bpy.ops.armature.delete()
    
    bones = {
        'Root': ((0,0,0), (0,0,0.8)),
        'Spine': ((0,0,0.8), (0,0,1.5)),
        'Head': ((0,0,1.5), (0,0,2.3)),
        'L_Arm': ((0.4,0,1.5), (0.6,0,0.5)),
        'R_Arm': ((-0.4,0,1.5), (-0.6,0,0.5)),
        'L_Leg': ((0.3,0,0.8), (0.3,0,0)),
        'R_Leg': ((-0.3,0,0.8), (-0.3,0,0))
    }
    
    ebones = arm.data.edit_bones
    b_dict = {}
    for name, (head, tail) in bones.items():
        b = ebones.new(name)
        b.head = head
        b.tail = tail
        b_dict[name] = b
        
    b_dict['Spine'].parent = b_dict['Root']
    b_dict['Head'].parent = b_dict['Spine']
    b_dict['L_Arm'].parent = b_dict['Spine']
    b_dict['R_Arm'].parent = b_dict['Spine']
    b_dict['L_Leg'].parent = b_dict['Root']
    b_dict['R_Leg'].parent = b_dict['Root']
    
    bpy.ops.object.mode_set(mode='OBJECT')
    
    mesh_obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    
    # Crear arma (Macuahuitl) y atarla a la mano derecha
    if is_warrior:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0,0,0))
        weapon = bpy.context.active_object
        weapon.scale = (0.05, 0.2, 0.8) # Forma de pala
        weapon.name = "Macuahuitl"
        # Dientes de obsidiana
        for z in [-0.3, 0, 0.3]:
            bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.05, 0, z))
            tooth = bpy.context.active_object
            tooth.scale = (0.1, 0.25, 0.1)
            tooth.parent = weapon
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0.05, 0, z))
            tooth2 = bpy.context.active_object
            tooth2.scale = (0.1, 0.25, 0.1)
            tooth2.parent = weapon
            
        # Parentar arma a hueso R_Arm
        weapon.parent = arm
        weapon.parent_type = 'BONE'
        weapon.parent_bone = 'R_Arm'
        weapon.location = (-0.6, 0, 0.3)
        weapon.rotation_euler = (1.57, 0, 0)
    
    return arm

def animate_biped_walk(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    
    pbones = arm.pose.bones
    arm.animation_data_create()
    act = bpy.data.actions.new(name="Walk")
    arm.animation_data.action = act
    
    frames = [0, 15, 30, 45, 60]
    rot_x_l_leg = [0.3, 0.0, -0.3, 0.0, 0.3]
    rot_x_r_leg = [-0.3, 0.0, 0.3, 0.0, -0.3]
    rot_x_l_arm = [-0.3, 0.0, 0.3, 0.0, -0.3]
    rot_x_r_arm = [0.3, 0.0, -0.3, 0.0, 0.3]
    
    for i, frame in enumerate(frames):
        pbones['L_Leg'].rotation_quaternion = mathutils.Euler((rot_x_l_leg[i], 0, 0)).to_quaternion()
        pbones['R_Leg'].rotation_quaternion = mathutils.Euler((rot_x_r_leg[i], 0, 0)).to_quaternion()
        pbones['L_Arm'].rotation_quaternion = mathutils.Euler((rot_x_l_arm[i], 0, 0)).to_quaternion()
        pbones['R_Arm'].rotation_quaternion = mathutils.Euler((rot_x_r_arm[i], 0, 0)).to_quaternion()
        pbones['Root'].location = (0, 0, 0.05 * math.sin(frame * math.pi / 15))
        
        for b in pbones:
            b.keyframe_insert(data_path="rotation_quaternion", frame=frame)
            b.keyframe_insert(data_path="location", frame=frame)
            
    bpy.ops.object.mode_set(mode='OBJECT')

import mathutils
def main():
    # 1. JAGUAR (Guerrero Armado Caminando)
    clear_scene()
    mesh = build_metaball_biped(is_warrior=True)
    arm = build_biped_armature(mesh, is_warrior=True)
    animate_biped_walk(arm)
    export_glb("jaguar_anim")
    
    # 2. MERCHANT (Humanoide Caminando/Idle con ropa)
    clear_scene()
    mesh = build_metaball_biped(is_warrior=False)
    arm = build_biped_armature(mesh, is_warrior=False)
    animate_biped_walk(arm)
    export_glb("merchant_anim")
    
    # 3. XOLO (Cuadrúpedo - simplificado)
    clear_scene()
    # Metaballs para perro
    parts = [
        ('Body', 0.4, (0, 0, 0.6)),
        ('Neck', 0.3, (0, 0.5, 0.8)),
        ('Head', 0.25, (0, 0.7, 1.0)),
        ('Tail', 0.2, (0, -0.5, 0.6)),
        ('FL_Leg', 0.15, (0.2, 0.4, 0.2)),
        ('FR_Leg', 0.15, (-0.2, 0.4, 0.2)),
        ('BL_Leg', 0.15, (0.2, -0.4, 0.2)),
        ('BR_Leg', 0.15, (-0.2, -0.4, 0.2))
    ]
    for name, radius, loc in parts:
        bpy.ops.object.metaball_add(type='BALL', radius=radius, location=loc)
        
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    xolo_mesh = bpy.context.active_object
    
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm = bpy.context.active_object
    bpy.ops.armature.select_all(action='SELECT'); bpy.ops.armature.delete()
    
    ebones = arm.data.edit_bones
    bones = {
        'Root': ((0,0,0.6), (0,0.4,0.6)),
        'Neck': ((0,0.4,0.6), (0,0.7,1.0)),
        'FL_Leg': ((0.2,0.4,0.6), (0.2,0.4,0)),
        'FR_Leg': ((-0.2,0.4,0.6), (-0.2,0.4,0)),
        'BL_Leg': ((0.2,-0.4,0.6), (0.2,-0.4,0)),
        'BR_Leg': ((-0.2,-0.4,0.6), (-0.2,-0.4,0))
    }
    b_dict = {}
    for name, (head, tail) in bones.items():
        b = ebones.new(name)
        b.head = head; b.tail = tail; b_dict[name] = b
    
    b_dict['Neck'].parent = b_dict['Root']
    b_dict['FL_Leg'].parent = b_dict['Root']
    b_dict['FR_Leg'].parent = b_dict['Root']
    b_dict['BL_Leg'].parent = b_dict['Root']
    b_dict['BR_Leg'].parent = b_dict['Root']
    
    bpy.ops.object.mode_set(mode='OBJECT')
    xolo_mesh.select_set(True); arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    
    # Anim Cuadrúpedo
    bpy.ops.object.mode_set(mode='POSE')
    arm.animation_data_create(); act = bpy.data.actions.new(name="Trot"); arm.animation_data.action = act
    pbones = arm.pose.bones
    frames = [0, 15, 30, 45, 60]
    rx1 = [0.2, 0.0, -0.2, 0.0, 0.2]
    rx2 = [-0.2, 0.0, 0.2, 0.0, -0.2]
    for i, frame in enumerate(frames):
        pbones['FL_Leg'].rotation_quaternion = mathutils.Euler((rx1[i], 0, 0)).to_quaternion()
        pbones['BR_Leg'].rotation_quaternion = mathutils.Euler((rx1[i], 0, 0)).to_quaternion()
        pbones['FR_Leg'].rotation_quaternion = mathutils.Euler((rx2[i], 0, 0)).to_quaternion()
        pbones['BL_Leg'].rotation_quaternion = mathutils.Euler((rx2[i], 0, 0)).to_quaternion()
        for b in pbones: b.keyframe_insert(data_path="rotation_quaternion", frame=frame)
            
    bpy.ops.object.mode_set(mode='OBJECT')
    export_glb("xolo_anim")

if __name__ == "__main__":
    main()
