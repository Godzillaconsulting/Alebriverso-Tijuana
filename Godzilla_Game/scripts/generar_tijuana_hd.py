import bpy
import math
import mathutils

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

def build_tijuana_metaball():
    # Usamos metaballs (superficies isosuperficiales o curvas de nivel en 3D)
    bpy.ops.object.metaball_add(type='BALL', radius=0.5, location=(0, 0, 1.2))
    mb = bpy.context.active_object
    mb.name = "Body_Meta"
    mb.data.resolution = 0.05 # Alta resolución para que no parezca plastilina
    
    parts = [
        # Torso e Iguana
        ('Chest', 0.45, (0, 0, 1.4)),
        ('Belly', 0.4, (0, 0, 1.0)),
        ('Neck', 0.25, (0, 0.1, 1.7)),
        ('Head_Base', 0.3, (0, 0.2, 1.9)),
        ('Snout', 0.2, (0, 0.4, 1.9)), # Hocico largo
        ('Jaw', 0.15, (0, 0.4, 1.8)),
        # Extremidades (Hombros, brazos)
        ('L_Shoulder', 0.25, (0.4, 0, 1.4)),
        ('R_Shoulder', 0.25, (-0.4, 0, 1.4)),
        ('L_Arm', 0.2, (0.5, 0, 1.0)),
        ('R_Arm', 0.2, (-0.5, 0, 1.0)),
        ('L_Hand', 0.15, (0.5, 0, 0.6)),
        ('R_Hand', 0.15, (-0.5, 0, 0.6)),
        # Piernas
        ('L_Hip', 0.3, (0.25, 0, 0.8)),
        ('R_Hip', 0.3, (-0.25, 0, 0.8)),
        ('L_Leg', 0.2, (0.25, 0, 0.4)),
        ('R_Leg', 0.2, (-0.25, 0, 0.4)),
        ('L_Foot', 0.15, (0.25, -0.1, 0.1)),
        ('R_Foot', 0.15, (-0.25, -0.1, 0.1)),
        # Cola de iguana (curvas de nivel decrecientes)
        ('Tail_1', 0.3, (0, -0.3, 0.8)),
        ('Tail_2', 0.25, (0, -0.6, 0.7)),
        ('Tail_3', 0.2, (0, -0.9, 0.5)),
        ('Tail_4', 0.15, (0, -1.2, 0.3)),
        ('Tail_5', 0.1, (0, -1.5, 0.1))
    ]
    
    # Agregar púas en la espalda (Iguana crest)
    for i in range(5):
        parts.append((f'Spike_{i}', 0.08, (0, -0.15, 1.6 - (i*0.2))))
        
    for name, radius, loc in parts:
        bpy.ops.object.metaball_add(type='BALL', radius=radius, location=loc)
        
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    mesh_obj = bpy.context.active_object
    mesh_obj.name = "Tijuana_Mesh"
    
    # Agregar alas geométricas planas a la espalda
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.3, -0.2, 1.4))
    wing_r = bpy.context.active_object; wing_r.scale = (0.5, 0.05, 1.0); wing_r.rotation_euler = (0.2, -0.3, -0.3)
    
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.3, -0.2, 1.4))
    wing_l = bpy.context.active_object; wing_l.scale = (0.5, 0.05, 1.0); wing_l.rotation_euler = (0.2, 0.3, 0.3)
    
    # Unir alas al cuerpo
    wing_r.select_set(True); wing_l.select_set(True); mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.join()
    
    return mesh_obj

def build_tijuana_armature(mesh_obj):
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = "Rig"
    
    bpy.ops.armature.select_all(action='SELECT')
    bpy.ops.armature.delete()
    
    bones = {
        'Root': ((0,0,0), (0,0,0.8)),
        'Spine': ((0,0,0.8), (0,0,1.4)),
        'Head': ((0,0,1.4), (0,0.2,1.9)),
        'Tail': ((0,-0.1,0.8), (0,-1.0,0.4)),
        'L_Arm': ((0.4,0,1.4), (0.5,0,0.6)),
        'R_Arm': ((-0.4,0,1.4), (-0.5,0,0.6)),
        'L_Leg': ((0.2,0,0.8), (0.2,0,0)),
        'R_Leg': ((-0.2,0,0.8), (-0.2,0,0))
    }
    
    ebones = arm.data.edit_bones
    b_dict = {}
    for name, (head, tail) in bones.items():
        b = ebones.new(name)
        b.head = head; b.tail = tail; b_dict[name] = b
        
    b_dict['Spine'].parent = b_dict['Root']
    b_dict['Head'].parent = b_dict['Spine']
    b_dict['Tail'].parent = b_dict['Root']
    b_dict['L_Arm'].parent = b_dict['Spine']
    b_dict['R_Arm'].parent = b_dict['Spine']
    b_dict['L_Leg'].parent = b_dict['Root']
    b_dict['R_Leg'].parent = b_dict['Root']
    
    bpy.ops.object.mode_set(mode='OBJECT')
    
    mesh_obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    
    # Crear arma (Resortera) y atarla a la mano derecha
    bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=0.4, location=(0,0,0))
    weapon = bpy.context.active_object
    weapon.name = "Resortera"
    # Horquetas
    for rot in [-0.5, 0.5]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=0.3, location=(rot*0.1, 0, 0.3))
        h = bpy.context.active_object
        h.rotation_euler = (0, rot, 0)
        h.parent = weapon
    # Semillas de Cacao
    for cx in [-0.05, 0, 0.05]:
        bpy.ops.mesh.primitive_cube_add(size=0.05, location=(cx, 0.05, 0.4))
        c = bpy.context.active_object
        c.parent = weapon
            
    # Parentar arma a hueso R_Arm
    weapon.parent = arm
    weapon.parent_type = 'BONE'
    weapon.parent_bone = 'R_Arm'
    weapon.location = (-0.5, 0.2, 0.6)
    weapon.rotation_euler = (1.57, 0, 0)
    
    return arm

def animate_tijuana_walk(arm):
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
    rot_z_tail = [0.2, 0.0, -0.2, 0.0, 0.2]
    
    for i, frame in enumerate(frames):
        pbones['L_Leg'].rotation_quaternion = mathutils.Euler((rot_x_l_leg[i], 0, 0)).to_quaternion()
        pbones['R_Leg'].rotation_quaternion = mathutils.Euler((rot_x_r_leg[i], 0, 0)).to_quaternion()
        pbones['L_Arm'].rotation_quaternion = mathutils.Euler((rot_x_l_arm[i], 0, 0)).to_quaternion()
        pbones['R_Arm'].rotation_quaternion = mathutils.Euler((rot_x_r_arm[i], 0, 0)).to_quaternion()
        pbones['Tail'].rotation_quaternion = mathutils.Euler((0, 0, rot_z_tail[i])).to_quaternion()
        pbones['Root'].location = (0, 0, 0.05 * math.sin(frame * math.pi / 15))
        
        for b in pbones:
            b.keyframe_insert(data_path="rotation_quaternion", frame=frame)
            b.keyframe_insert(data_path="location", frame=frame)
            
    bpy.ops.object.mode_set(mode='OBJECT')

def main():
    clear_scene()
    mesh = build_tijuana_metaball()
    arm = build_tijuana_armature(mesh)
    animate_tijuana_walk(arm)
    export_glb("tijuana_rigged_hd")

if __name__ == "__main__":
    main()
