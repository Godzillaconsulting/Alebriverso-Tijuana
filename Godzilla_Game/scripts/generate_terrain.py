import bpy
import bmesh
import math

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def create_organic_terrain():
    clear_scene()
    
    # 1. Crear el grid principal (La gran plaza y alrededores)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=200, y_subdivisions=200, size=500, enter_editmode=False, location=(0, -4.5, 0))
    terrain = bpy.context.active_object
    terrain.name = "Terreno_Organico"
    
    # 2. Modificador de Desplazamiento (Ruido Perlin)
    mod = terrain.modifiers.new("Displace", 'DISPLACE')
    
    # Textura de Ruido Voronoi/Perlin para las colinas
    tex = bpy.data.textures.new("TerrainNoise", type='CLOUDS')
    tex.noise_scale = 15.0
    tex.noise_depth = 4
    
    mod.texture = tex
    mod.strength = 6.0 # Altura de las colinas
    
    # 3. Aplicar y suavizar
    bpy.context.view_layer.objects.active = terrain
    bpy.ops.object.modifier_apply(modifier="Displace")
    
    # 4. Aplanar el centro para la ciudad y el jugador (Atenuación radial)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(terrain.data)
    
    for v in bm.verts:
        # Calcular distancia al centro (Tenochtitlan y Hub)
        dist = math.sqrt(v.co.x**2 + v.co.y**2)
        if dist < 120:
            # Aplanar suavemente
            v.co.z = (v.co.z * (dist / 120.0)) - 0.5
        elif dist > 180:
            # Elevar los bordes como un cráter gigante / montañas lejanas
            factor = (dist - 180) / 70.0
            v.co.z += factor * 8.0
            
    bmesh.update_edit_mesh(terrain.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    
    # Shade Smooth
    bpy.ops.object.shade_smooth()
    
    # 5. Exportar
    export_path = r"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\terreno_organico.glb"
    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print(f"Exportado: {export_path}")

if __name__ == "__main__":
    create_organic_terrain()
