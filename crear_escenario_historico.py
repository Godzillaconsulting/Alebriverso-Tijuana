import bpy
import random
import math

# Limpiar escena
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

def create_mesh(name, op, location, scale, color):
    op(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    
    mat = bpy.data.materials.new(name=f"Mat_{name}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color
        bsdf.inputs['Roughness'].default_value = 0.9
    obj.data.materials.append(mat)
    return obj

meshes = []

c_piedra = (0.4, 0.4, 0.35, 1) # Piedra caliza antigua (Gris)
c_agua = (0.05, 0.2, 0.1, 1) # Agua oscura
c_camino = (0.8, 0.75, 0.6, 1)
c_azul = (0.1, 0.4, 0.6, 1) # Camino claro (Calzadas)
c_rojo = (0.6, 0.2, 0.15, 1) # Rojo óxido para frisos
c_verde = (0.15, 0.3, 0.1, 1)
c_oro = (0.8, 0.6, 0.1, 1)
c_obsidiana = (0.1, 0.1, 0.1, 1) # Verde oscuro para montañas/vegetación

# 1. EL LAGO DE TEXCOCO (Gigantesco)
meshes.append(create_mesh("Lago", bpy.ops.mesh.primitive_plane_add, (0, 0, -2), (1000, 1000, 1), c_agua))

# 2. CALZADAS PRINCIPALES (Cruz que atraviesa el lago)
# Calzada Sur (Por donde llega el jugador)
meshes.append(create_mesh("Calzada_Sur", bpy.ops.mesh.primitive_cube_add, (0, -300, -1), (12, 400, 1), c_camino))
# Calzada Norte
meshes.append(create_mesh("Calzada_Norte", bpy.ops.mesh.primitive_cube_add, (0, 300, -1), (12, 400, 1), c_camino))
# Calzada Este
meshes.append(create_mesh("Calzada_Este", bpy.ops.mesh.primitive_cube_add, (300, 0, -1), (400, 12, 1), c_camino))
# Calzada Oeste
meshes.append(create_mesh("Calzada_Oeste", bpy.ops.mesh.primitive_cube_add, (-300, 0, -1), (400, 12, 1), c_camino))

# 3. RECINTO SAGRADO (Plaza central)
meshes.append(create_mesh("IslaCentral", bpy.ops.mesh.primitive_cube_add, (0, 0, -0.5), (150, 150, 0.5), c_piedra))

# Muros del Recinto (Coatepantli)
wall_t = 2.0
wall_h = 6.0
r_size = 150
# Norte
meshes.append(create_mesh("MuroRecinto_N", bpy.ops.mesh.primitive_cube_add, (0, r_size/2, wall_h/2), (r_size, wall_t, wall_h), c_piedra))
# Sur (Con hueco para entrada)
meshes.append(create_mesh("MuroRecinto_S1", bpy.ops.mesh.primitive_cube_add, (-r_size/4 - 6, -r_size/2, wall_h/2), (r_size/2 - 12, wall_t, wall_h), c_piedra))
meshes.append(create_mesh("MuroRecinto_S2", bpy.ops.mesh.primitive_cube_add, (r_size/4 + 6, -r_size/2, wall_h/2), (r_size/2 - 12, wall_t, wall_h), c_piedra))
# Lados
meshes.append(create_mesh("MuroRecinto_E", bpy.ops.mesh.primitive_cube_add, (r_size/2, 0, wall_h/2), (wall_t, r_size, wall_h), c_piedra))
meshes.append(create_mesh("MuroRecinto_O", bpy.ops.mesh.primitive_cube_add, (-r_size/2, 0, wall_h/2), (wall_t, r_size, wall_h), c_piedra))


# 4. TEMPLO MAYOR (HUECO Y EXPLORABLE EN EL CENTRO)
def build_hollow_floor(level, y_offset, z_base, size, height, wall_t=2.0):
    # Piso
    meshes.append(create_mesh(f"BasamentoPiso_{level}", bpy.ops.mesh.primitive_cube_add, (0, y_offset, z_base), (size, size, 1), c_piedra))
    # Paredes exteriores
    meshes.append(create_mesh(f"MuroA_{level}", bpy.ops.mesh.primitive_cube_add, (0, y_offset + size/2 - wall_t/2, z_base + height/2), (size, wall_t, height), c_piedra))
    meshes.append(create_mesh(f"MuroL_{level}", bpy.ops.mesh.primitive_cube_add, (-size/2 + wall_t/2, y_offset, z_base + height/2), (wall_t, size, height), c_piedra))
    meshes.append(create_mesh(f"MuroR_{level}", bpy.ops.mesh.primitive_cube_add, (size/2 - wall_t/2, y_offset, z_base + height/2), (wall_t, size, height), c_piedra))
    # Frente (puerta)
    door_w = 8.0
    side_w = (size - door_w) / 2
    meshes.append(create_mesh(f"MuroF1_{level}", bpy.ops.mesh.primitive_cube_add, (-size/2 + side_w/2, y_offset - size/2 + wall_t/2, z_base + height/2), (side_w, wall_t, height), c_piedra))
    meshes.append(create_mesh(f"MuroF2_{level}", bpy.ops.mesh.primitive_cube_add, (size/2 - side_w/2, y_offset - size/2 + wall_t/2, z_base + height/2), (side_w, wall_t, height), c_piedra))
    meshes.append(create_mesh(f"Dintel_{level}", bpy.ops.mesh.primitive_cube_add, (0, y_offset - size/2 + wall_t/2, z_base + height - 1.5), (door_w, wall_t, 3), c_piedra))
    
    # Rampa interior
    if level < 3:
        ramp_len = size * 0.7
        meshes.append(create_mesh(f"RampaInt_{level}", bpy.ops.mesh.primitive_cube_add, (0, y_offset, z_base + height/2), (4, ramp_len, 1), c_piedra))
        rampa = bpy.data.objects[f"RampaInt_{level}"]
        inclinacion = 0.4 if level % 2 == 1 else -0.4
        rampa.rotation_euler = (inclinacion, 0, 0)
        # Techo parcial
        meshes.append(create_mesh(f"TechoL_{level}", bpy.ops.mesh.primitive_cube_add, (-size/4, y_offset, z_base + height), (size/2 - 2, size, 1), c_piedra))
        meshes.append(create_mesh(f"TechoR_{level}", bpy.ops.mesh.primitive_cube_add, (size/4, y_offset, z_base + height), (size/2 - 2, size, 1), c_piedra))

y_templo = 20
build_hollow_floor(1, y_templo, 0, 50, 14)
build_hollow_floor(2, y_templo, 14, 40, 12)
build_hollow_floor(3, y_templo, 26, 30, 10)
meshes.append(create_mesh("TechoFinal", bpy.ops.mesh.primitive_cube_add, (0, y_templo, 36), (30, 30, 1), c_piedra))
# 4.5 DETALLES TEMPLO MAYOR
meshes.append(create_mesh("EscalinataPrincipal", bpy.ops.mesh.primitive_cube_add, (0, y_templo - 25, 18), (16, 25, 0.5), c_piedra))
bpy.data.objects["EscalinataPrincipal"].rotation_euler = (0.7, 0, 0)
meshes.append(create_mesh("CabezaSerpienteL", bpy.ops.mesh.primitive_cube_add, (-10, y_templo - 40, 2), (4, 4, 4), c_piedra))
meshes.append(create_mesh("CabezaSerpienteR", bpy.ops.mesh.primitive_cube_add, (10, y_templo - 40, 2), (4, 4, 4), c_piedra))

# Templos Gemelos (Tlaloc Azul y Huitzilopochtli Rojo)
meshes.append(create_mesh("TemploGemeloAzul", bpy.ops.mesh.primitive_cube_add, (-8, y_templo + 5, 41), (10, 10, 10), c_piedra))
meshes.append(create_mesh("TechoAzul", bpy.ops.mesh.primitive_cube_add, (-8, y_templo + 5, 47), (12, 12, 2), c_azul))
meshes.append(create_mesh("TemploGemeloRojo", bpy.ops.mesh.primitive_cube_add, (8, y_templo + 5, 41), (10, 10, 10), c_piedra))
meshes.append(create_mesh("TechoRojo", bpy.ops.mesh.primitive_cube_add, (8, y_templo + 5, 47), (12, 12, 2), c_rojo))

# 4.6 TZOMPANTLI Y ESCULTURA JAGUAR EN LA PLAZA
meshes.append(create_mesh("TzompantliPlaza", bpy.ops.mesh.primitive_cube_add, (0, y_templo - 60, 2), (30, 4, 6), c_piedra))
meshes.append(create_mesh("CalaverasTzom", bpy.ops.mesh.primitive_cube_add, (0, y_templo - 60, 4), (28, 5, 4), c_camino)) # Hueso
meshes.append(create_mesh("EstatuaJaguar", bpy.ops.mesh.primitive_cube_add, (25, y_templo - 40, 2), (6, 10, 4), c_obsidiana))

meshes.append(create_mesh("AltarJefe", bpy.ops.mesh.primitive_cylinder_add, (0, y_templo, 37), (4, 4, 1), c_piedra))

meshes.append(create_mesh("CalendarioJefe", bpy.ops.mesh.primitive_cylinder_add, (0, y_templo+8, 33), (8, 8, 1), c_oro))
bpy.data.objects['CalendarioJefe'].rotation_euler = (1.57, 0, 0)


# 5. TEMPLOS SECUNDARIOS (Pirámides sólidas alrededor de la plaza)
def create_solid_pyramid(name, x, y, size, levels):
    for i in range(levels):
        s = size - (i * 4)
        meshes.append(create_mesh(f"{name}_L{i}", bpy.ops.mesh.primitive_cube_add, (x, y, i * 3 + 1.5), (s, s, 3), c_piedra))
        # Adorno rojo en la parte superior
        if i == levels - 1:
            meshes.append(create_mesh(f"{name}_Adorno", bpy.ops.mesh.primitive_cube_add, (x, y, i * 3 + 3.5), (s-2, s-2, 1), c_rojo))

create_solid_pyramid("TemploSec1", -40, -40, 20, 4)
create_solid_pyramid("TemploSec2", 40, -40, 20, 4)
create_solid_pyramid("TemploSec3", -50, 30, 24, 5)
create_solid_pyramid("TemploSec4", 50, 30, 24, 5)


# 6. CIUDAD EXTERIOR (CHINAMPAS Y BARRIOS)
# Para simular la densidad de la ciudad vista desde lejos, generamos cuadrículas de casas/terrenos
for x_grid in range(-3, 4):
    for y_grid in range(-3, 4):
        # Ignorar el centro (Recinto Sagrado)
        if abs(x_grid) <= 1 and abs(y_grid) <= 1:
            continue
            
        cx = x_grid * 120
        cy = y_grid * 120
        
        # Base de la Chinampa
        meshes.append(create_mesh(f"Chinampa_{x_grid}_{y_grid}", bpy.ops.mesh.primitive_cube_add, (cx, cy, -0.8), (100, 100, 0.5), c_piedra))
        
        # Canales (El espacio entre chinampas ya es agua)
        
        # Casas/Plataformas en la chinampa
        for _ in range(8):
            hx = cx + random.uniform(-40, 40)
            hy = cy + random.uniform(-40, 40)
            meshes.append(create_mesh(f"Casa_{x_grid}_{y_grid}_{_}", bpy.ops.mesh.primitive_cube_add, (hx, hy, 1), (12, 12, 4), c_piedra))
            # Techo rojo
            meshes.append(create_mesh(f"TechoCasa_{x_grid}_{y_grid}_{_}", bpy.ops.mesh.primitive_cube_add, (hx, hy, 3.2), (13, 13, 0.5), c_rojo))


# 7. VOLCÁN DE FONDO (Popocatépetl)
meshes.append(create_mesh("Volcan", bpy.ops.mesh.primitive_cone_add, (-600, 600, 0), (400, 400, 200), c_verde))
# Nieve en la cima
meshes.append(create_mesh("NieveVolcan", bpy.ops.mesh.primitive_cone_add, (-600, 600, 150), (100, 100, 55), (0.9, 0.9, 0.9, 1)))

# Unir todo en una sola malla
# No unimos las mallas para mantener los nombres y materiales individuales

# Exportar GLB
export_path = r"c:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\escenario_tenochtitlan.glb"
bpy.ops.export_scene.gltf(filepath=export_path, export_format='GLB', use_selection=False)

print(f"Escenario ÉPICO exportado a {export_path}")





