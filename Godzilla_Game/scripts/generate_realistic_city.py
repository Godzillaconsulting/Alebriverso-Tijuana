import bpy
import bmesh
import math
import os

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def create_lake():
    # Lago enorme
    bpy.ops.mesh.primitive_plane_add(size=1000, enter_editmode=False, align='WORLD', location=(0, 0, 0))
    lake = bpy.context.active_object
    lake.name = "Lago_Texcoco"

def create_causeways():
    # Calzada Principal Sur (Piedra)
    bpy.ops.mesh.primitive_cube_add(size=1, enter_editmode=False, location=(0, 0.5, 150))
    causeway = bpy.context.active_object
    causeway.scale = (20, 1, 300)
    causeway.name = "Calzada_Piedra_Sur"
    
    # Postes/Pilares al lado de la calzada
    for i in range(-140, 300, 20):
        for x in [-11, 11]:
            bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=4, location=(x, 2, i))
            pillar = bpy.context.active_object
            pillar.name = "Piedra_Pilar"

def create_snake_head(loc, rot_z):
    # Cabeza de Quetzalcoatl estilizada (Bloques)
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    base = bpy.context.active_object
    base.scale = (2, 3, 3)
    base.name = "Piedra_Cabeza_Serpiente"
    base.rotation_euler[2] = math.radians(rot_z)
    
    # Hocico
    loc_h = (loc[0], loc[1]-0.5, loc[2]+2.5 if rot_z == 0 else loc[2]-2.5)
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc_h)
    hocico = bpy.context.active_object
    hocico.scale = (1.5, 1.5, 2)
    hocico.name = "Piedra_Hocico"
    hocico.rotation_euler[2] = math.radians(rot_z)
    hocico.parent = base

def create_brazier(loc):
    # Brasero de piedra
    bpy.ops.mesh.primitive_cylinder_add(radius=1.5, depth=3, location=loc)
    brazier = bpy.context.active_object
    brazier.name = "Piedra_Brasero"
    
    # Hueco superior
    bpy.ops.mesh.primitive_cylinder_add(radius=1.2, depth=1, location=(loc[0], loc[1]+1.5, loc[2]))
    hole = bpy.context.active_object
    
    bool_mod = brazier.modifiers.new("Boolean", 'BOOLEAN')
    bool_mod.operation = 'DIFFERENCE'
    bool_mod.object = hole
    hole.display_type = 'WIRE'
    hole.hide_render = True
    hole.parent = brazier

def create_pyramid(loc):
    # Basamento principal (7 niveles con biseles tipo tablero/talud)
    levels = 7
    base_width = 100
    base_depth = 100
    height_per_level = 5.5
    
    pyramid_root = bpy.data.objects.new("Templo_Mayor_Root", None)
    bpy.context.collection.objects.link(pyramid_root)
    pyramid_root.location = loc
    
    current_y = height_per_level / 2.0
    
    for i in range(levels):
        w = base_width - (i * 10)
        d = base_depth - (i * 10)
        
        # Talud (Inclinación base)
        bpy.ops.mesh.primitive_cube_add(size=1, enter_editmode=False, location=(loc[0], current_y, loc[2]))
        level_obj = bpy.context.active_object
        level_obj.scale = (w, height_per_level, d)
        level_obj.name = f"Basamento_Piedra_{i}"
        
        # Dar forma trapezoidal usando Edit Mode (bmesh)
        bpy.context.view_layer.objects.active = level_obj
        bpy.ops.object.mode_set(mode='EDIT')
        bm = bmesh.from_edit_mesh(level_obj.data)
        for v in bm.verts:
            if v.co.z > 0: # Vértices superiores
                v.co.x *= 0.95
                v.co.y *= 0.95
        bmesh.update_edit_mesh(level_obj.data)
        bpy.ops.object.mode_set(mode='OBJECT')
        level_obj.parent = pyramid_root
        current_y += height_per_level

    # --- ESCALINATAS DETALLADAS ---
    # En lugar de un plano, creamos instancias de escalones reales
    num_steps = 75
    step_width = 35
    step_height = (current_y - (height_per_level/2)) / num_steps
    step_depth = 0.8
    start_z = loc[2] + (base_depth/2) + 10
    
    stairs_root = bpy.data.objects.new("Escalera_Piedra_Root", None)
    bpy.context.collection.objects.link(stairs_root)
    stairs_root.parent = pyramid_root
    
    for i in range(num_steps):
        sy = (i * step_height) + (step_height/2)
        sz = start_z - (i * step_depth)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(loc[0], sy, sz))
        step = bpy.context.active_object
        step.scale = (step_width, step_height, step_depth * 1.5)
        step.name = f"Escalera_Piedra_Paso_{i}"
        step.parent = stairs_root

    # Separador central de escaleras (Alfarda)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(loc[0], current_y/2, start_z - (num_steps*step_depth)/2))
    alfarda = bpy.context.active_object
    alfarda.scale = (4, current_y, num_steps*step_depth + 2)
    alfarda.name = "Piedra_Alfarda_Central"
    alfarda.rotation_euler[0] = math.atan2(current_y, num_steps*step_depth)
    alfarda.parent = pyramid_root

    # Cabezas de Serpiente en la base
    create_snake_head((loc[0] - (step_width/2) - 2, 1.5, start_z), 0)
    create_snake_head((loc[0] + (step_width/2) + 2, 1.5, start_z), 0)
    create_snake_head((loc[0], 1.5, start_z), 0) # Central
    
    # Adoratorios (Tlaloc y Huitzilopochtli) en la cima
    top_y = current_y + 6
    for i, offset_x in enumerate([-12, 12]):
        bpy.ops.mesh.primitive_cube_add(size=1, enter_editmode=False, location=(loc[0] + offset_x, top_y, loc[2] - 5))
        temple = bpy.context.active_object
        temple.scale = (16, 12, 16)
        temple.name = f"Templo_Piedra_{i}"
        temple.parent = pyramid_root
        
        # Techos (Inclinados)
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=12, depth=8, location=(loc[0] + offset_x, top_y + 10, loc[2] - 5))
        roof = bpy.context.active_object
        roof.name = f"Templo_Techo_{i}"
        roof.rotation_euler[2] = math.radians(45)
        roof.parent = pyramid_root
        
        # Puerta
        bpy.ops.mesh.primitive_cube_add(size=1, enter_editmode=False, location=(loc[0] + offset_x, top_y - 2, loc[2] + 4.5))
        door = bpy.context.active_object
        door.scale = (6, 8, 5)
        
        bool_mod = temple.modifiers.new("Boolean", 'BOOLEAN')
        bool_mod.operation = 'DIFFERENCE'
        bool_mod.object = door
        door.display_type = 'WIRE'
        door.hide_render = True
        door.parent = pyramid_root
        
        # Braseros frente a las puertas
        create_brazier((loc[0] + offset_x, current_y + 1.5, loc[2] + 8))

def main():
    clear_scene()
    create_lake()
    create_causeways()
    create_pyramid((0, 0, -80))
    
    # Exportar GLB
    export_path = r"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\tenochtitlan_realista.glb"
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        export_apply=True
    )
    print(f"Exportado exitosamente a {export_path}")

if __name__ == "__main__":
    main()
