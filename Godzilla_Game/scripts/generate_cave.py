import bpy
import bmesh
import math

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def export_glb(name):
    export_path = fr"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\assets\models\{name}"
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True
    )
    print(f"Exportado: {export_path}")

def apply_heavy_displacement(obj, texture_name="RockNoise", strength=2.5, scale=0.8):
    # Subdividir para dar geometría al desplazamiento
    subsurf = obj.modifiers.new(name="Subdivision", type='SUBSURF')
    subsurf.levels = 4
    subsurf.render_levels = 4
    
    # Crear textura de ruido (Voronoi es bueno para rocas afiladas)
    tex = bpy.data.textures.get(texture_name)
    if not tex:
        tex = bpy.data.textures.new(texture_name, type='VORONOI')
        tex.noise_scale = scale
        tex.distance_metric = 'DISTANCE'
    
    # Modificador de Desplazamiento
    displace = obj.modifiers.new(name="Displace", type='DISPLACE')
    displace.texture = tex
    displace.strength = strength
    displace.direction = 'NORMAL'

def create_canyon_module():
    clear_scene()
    
    # Muro Izquierdo
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-7, 0, 5))
    left_wall = bpy.context.active_object
    left_wall.scale = (4, 10, 15) # Ancho, Largo(Z), Alto
    apply_heavy_displacement(left_wall, "CanyonNoise", strength=3.0, scale=0.6)
    
    # Muro Derecho
    bpy.ops.mesh.primitive_cube_add(size=1, location=(7, 0, 5))
    right_wall = bpy.context.active_object
    right_wall.scale = (4, 10, 15)
    apply_heavy_displacement(right_wall, "CanyonNoise2", strength=3.0, scale=0.7)
    
    # Unir
    left_wall.select_set(True)
    right_wall.select_set(True)
    bpy.context.view_layer.objects.active = left_wall
    bpy.ops.object.join()
    left_wall.name = "Canon_Modulo"
    
    # Aplicar modificadores
    bpy.ops.object.modifier_apply(modifier="Subdivision")
    bpy.ops.object.modifier_apply(modifier="Displace")
    
    export_glb("canon_modulo.glb")

def create_cave_tunnel():
    clear_scene()
    
    # Crear un cilindro para el túnel
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=6, depth=10, location=(0, 0, 2))
    tunnel = bpy.context.active_object
    tunnel.rotation_euler[0] = math.pi / 2 # Acostarlo en el eje Z (Y en Blender)
    
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    
    # Borrar la mitad inferior para hacer un arco
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(tunnel.data)
    faces_to_delete = [f for f in bm.faces if f.calc_center_median().z < 0]
    bmesh.ops.delete(bm, geom=faces_to_delete, context='FACES')
    # Borrar tapas
    faces_to_delete = [f for f in bm.faces if abs(f.normal.y) > 0.9]
    bmesh.ops.delete(bm, geom=faces_to_delete, context='FACES')
    bmesh.update_edit_mesh(tunnel.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Engrosar
    solidify = tunnel.modifiers.new(name="Solidify", type='SOLIDIFY')
    solidify.thickness = 1.5
    bpy.ops.object.modifier_apply(modifier="Solidify")
    
    # Desplazamiento extremo para techo rocoso tipo cueva
    apply_heavy_displacement(tunnel, "CaveNoise", strength=1.5, scale=0.4)
    
    bpy.ops.object.modifier_apply(modifier="Subdivision")
    bpy.ops.object.modifier_apply(modifier="Displace")
    
    tunnel.name = "Cueva_Tunel"
    export_glb("cueva_tunel.glb")

if __name__ == "__main__":
    create_canyon_module()
    create_cave_tunnel()
