import bpy
import os

# Borrar la escena
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

def rig_model(obj_path, glb_path, armature_type="human"):
    # Limpiar
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Importar OBJ
    # Importante: Dependiendo de la versión de Blender, puede ser bpy.ops.wm.obj_import o bpy.ops.import_scene.obj
    try:
        bpy.ops.wm.obj_import(filepath=obj_path)
    except AttributeError:
        bpy.ops.import_scene.obj(filepath=obj_path)
        
    
    # Seleccionar la malla importada
    mesh_obj = None
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            mesh_obj = obj
            break
            
    if not mesh_obj:
        print(f"No se encontró malla en {obj_path}")
        return
        
    mesh_obj.name = "CharacterMesh"
    
    # Centrar el cursor
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    
    # Escalar la malla porque TripoSR puede generarla muy pequeña o grande
    # Ajustaremos a una escala normalizada (bounding box)
    # TripoSR suele hacer cajas de 1x1x1
    mesh_obj.scale = (2.0, 2.0, 2.0)
    bpy.context.view_layer.objects.active = mesh_obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    # Mover la malla para que la base esté en Z=0
    # Obtenemos la caja delimitadora (local coordinates)
    bbox_corners = [mesh_obj.matrix_world @ mathutils.Vector(corner) for corner in mesh_obj.bound_box]
    min_z = min([v.z for v in bbox_corners])
    mesh_obj.location.z -= min_z
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    
    bpy.ops.object.armature_add(enter_editmode=True, align='WORLD', location=(0, 0, 0))
    arm = bpy.context.active_object
    arm.name = "AutoRig"
    amt = arm.data
    
    if armature_type == "human":
        # Construir esqueleto humano básico
        root = amt.edit_bones[0]
        root.name = "Root"; root.head = (0,0,0); root.tail = (0,0,0.5)
        
        spine = amt.edit_bones.new("Spine"); spine.head = (0,0,0.5); spine.tail = (0,0,1.2); spine.parent = root; spine.use_connect = True
        head = amt.edit_bones.new("Head"); head.head = (0,0,1.2); head.tail = (0,0,1.6); head.parent = spine; head.use_connect = True
        arm_l = amt.edit_bones.new("Arm.L"); arm_l.head = (0.2,0,1.0); arm_l.tail = (0.8,0,0.6); arm_l.parent = spine
        arm_r = amt.edit_bones.new("Arm.R"); arm_r.head = (-0.2,0,1.0); arm_r.tail = (-0.8,0,0.6); arm_r.parent = spine
        leg_l = amt.edit_bones.new("Leg.L"); leg_l.head = (0.15,0,0.5); leg_l.tail = (0.15,0,0.0); leg_l.parent = root
        leg_r = amt.edit_bones.new("Leg.R"); leg_r.head = (-0.15,0,0.5); leg_r.tail = (-0.15,0,0.0); leg_r.parent = root
    else: # quadruped
        # Xolo esqueleto
        root = amt.edit_bones[0]
        root.name = "Root"; root.head = (0,0,0.4); root.tail = (0,0.2,0.4)
        
        spine = amt.edit_bones.new("Spine"); spine.head = (0,0.2,0.4); spine.tail = (0,0.8,0.4); spine.parent = root; spine.use_connect = True
        neck = amt.edit_bones.new("Neck"); neck.head = (0,0.8,0.4); neck.tail = (0,0.9,0.7); neck.parent = spine; neck.use_connect = True
        head = amt.edit_bones.new("Head"); head.head = (0,0.9,0.7); head.tail = (0,1.2,0.7); head.parent = neck; head.use_connect = True
        
        leg_fl = amt.edit_bones.new("Leg.FL"); leg_fl.head = (0.1, 0.7, 0.4); leg_fl.tail = (0.1, 0.7, 0); leg_fl.parent = spine
        leg_fr = amt.edit_bones.new("Leg.FR"); leg_fr.head = (-0.1, 0.7, 0.4); leg_fr.tail = (-0.1, 0.7, 0); leg_fr.parent = spine
        leg_bl = amt.edit_bones.new("Leg.BL"); leg_bl.head = (0.1, 0.1, 0.4); leg_bl.tail = (0.1, 0.1, 0); leg_bl.parent = root
        leg_br = amt.edit_bones.new("Leg.BR"); leg_br.head = (-0.1, 0.1, 0.4); leg_br.tail = (-0.1, 0.1, 0); leg_br.parent = root
        tail = amt.edit_bones.new("Tail"); tail.head = (0,0.1,0.4); tail.tail = (0,-0.3,0.5); tail.parent = root

    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Parent con pesos automáticos
    bpy.ops.object.select_all(action='DESELECT')
    mesh_obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    
    # Exportar GLB
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB', use_selection=False)

models_dir = r"C:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models"

targets = [
    ("raw_jaguar.obj", "jaguar_rigged_realistic.glb", "human"),
    ("raw_xolo.obj", "xolo_rigged_realistic.glb", "quadruped"),
    ("raw_mercader.obj", "merchant_rigged_realistic.glb", "human")
]

import mathutils

for obj_name, glb_name, rig_type in targets:
    obj_path = os.path.join(models_dir, obj_name)
    glb_path = os.path.join(models_dir, glb_name)
    
    if os.path.exists(obj_path):
        print(f"Riggeando {obj_name}...")
        rig_model(obj_path, glb_path, rig_type)
        print(f"Guardado como {glb_name}")
    else:
        print(f"No se encontro {obj_path}")

print("Rigging terminado.")
