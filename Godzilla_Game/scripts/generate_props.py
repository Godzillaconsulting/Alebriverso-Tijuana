import bpy
import bmesh
import math
import random

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def export_glb(name):
    export_path = fr"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\{name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )

def create_fractal_tree():
    clear_scene()
    
    # Usar Vértices + Skin Modifier para ramas ultra-orgánicas curvas
    mesh = bpy.data.meshes.new("TreeBase")
    obj = bpy.data.objects.new("Tree_Organic", mesh)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    
    bm = bmesh.new()
    
    # Función recursiva fractal
    def grow_branch(bm, start_v, direction, length, depth):
        if depth == 0: return
        
        # Curvar dirección matemáticamente (viento/peso)
        direction.x += random.uniform(-0.4, 0.4)
        direction.y += random.uniform(-0.4, 0.4)
        direction.z += random.uniform(-0.1, 0.2)
        direction.normalize()
        
        end_co = start_v.co + (direction * length)
        end_v = bm.verts.new(end_co)
        bm.edges.new((start_v, end_v))
        
        # Ramificar
        num_branches = random.randint(1, 3) if depth > 1 else 0
        for _ in range(num_branches):
            new_dir = direction.copy()
            new_dir.x += random.uniform(-0.8, 0.8)
            new_dir.y += random.uniform(-0.8, 0.8)
            new_dir.z += random.uniform(-0.3, 0.6)
            new_dir.normalize()
            grow_branch(bm, end_v, new_dir, length * 0.7, depth - 1)
            
    # Raíz
    root_v = bm.verts.new((0, 0, 0))
    import mathutils
    grow_branch(bm, root_v, mathutils.Vector((0, 0, 1)), 4.0, 5)
    
    layer = bm.verts.layers.skin.verify()
    for v in bm.verts:
        # Hacer que la raíz sea más gruesa basado en su altura Z (las ramas altas son más delgadas)
        r = max(0.1, 0.6 - (v.co.z * 0.05))
        v[layer].radius = (r, r)
    
    bm.to_mesh(mesh)
    bm.free()
    
    # Modificadores
    skin = obj.modifiers.new("Skin", 'SKIN')
    subsurf = obj.modifiers.new("Subsurf", 'SUBSURF')
    subsurf.levels = 2
    
    # Desplazamiento para corteza rugosa
    disp = obj.modifiers.new("Displace", 'DISPLACE')
    tex = bpy.data.textures.new("Bark", 'CLOUDS')
    tex.noise_scale = 1.5
    disp.texture = tex
    disp.strength = 0.1
    
    # Aplicar modificadores
    bpy.ops.object.modifier_apply(modifier="Skin")
    bpy.ops.object.modifier_apply(modifier="Subsurf")
    bpy.ops.object.modifier_apply(modifier="Displace")
    
    bpy.ops.object.shade_smooth()
    export_glb("arbol_muerto_re4")

def create_other_props():
    # Caja de madera tablones
    clear_scene()
    bpy.ops.mesh.primitive_cube_add(size=1.4)
    cube = bpy.context.active_object
    mod = cube.modifiers.new("Bevel", 'BEVEL')
    mod.width = 0.05
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier="Bevel")
    export_glb("caja_madera_re4")
    
    # Monolito
    clear_scene()
    bpy.ops.mesh.primitive_cylinder_add(radius=1.5, depth=4.0, vertices=6)
    mon = bpy.context.active_object
    disp = mon.modifiers.new("Displace", 'DISPLACE')
    tex = bpy.data.textures.new("Rock", 'VORONOI')
    tex.noise_scale = 2.0
    disp.texture = tex
    disp.strength = 0.8
    bpy.ops.object.modifier_apply(modifier="Displace")
    bpy.ops.object.shade_smooth()
    export_glb("monolito_obsidiana")
    
    # Portal
    clear_scene()
    bpy.ops.mesh.primitive_torus_add(major_radius=4.0, minor_radius=0.8, major_segments=12, minor_segments=6)
    portal = bpy.context.active_object
    portal.rotation_euler[0] = 1.57
    disp = portal.modifiers.new("Displace", 'DISPLACE')
    disp.texture = tex
    disp.strength = 0.5
    bpy.ops.object.modifier_apply(modifier="Displace")
    bpy.ops.object.shade_smooth()
    export_glb("portal_obsidiana")

if __name__ == "__main__":
    create_fractal_tree()
    create_other_props()
