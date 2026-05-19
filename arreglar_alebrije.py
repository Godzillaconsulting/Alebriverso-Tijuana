import bpy

def clean_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

clean_scene()

# Material Alebrije (Rosa Mexicano brillante)
mat = bpy.data.materials.new("ColorAlebrije")
mat.use_nodes = True
nodes = mat.node_tree.nodes
nodes.clear()
bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
bsdf.inputs['Base Color'].default_value = (0.9, 0.1, 0.6, 1.0) # Rosa/Magenta
out = nodes.new(type='ShaderNodeOutputMaterial')
mat.node_tree.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])

# Material Ojos (Amarillo brillante)
mat_ojo = bpy.data.materials.new("ColorOjo")
mat_ojo.use_nodes = True
n_ojo = mat_ojo.node_tree.nodes
n_ojo.clear()
bsdf_ojo = n_ojo.new(type='ShaderNodeBsdfPrincipled')
bsdf_ojo.inputs['Base Color'].default_value = (1.0, 0.8, 0.1, 1.0) # Amarillo
out_ojo = n_ojo.new(type='ShaderNodeOutputMaterial')
mat_ojo.node_tree.links.new(bsdf_ojo.outputs['BSDF'], out_ojo.inputs['Surface'])

# 1. Cuerpo
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1)
cuerpo = bpy.context.active_object
cuerpo.scale = (0.6, 1.5, 0.6)
cuerpo.location = (0, 1.5, 0)
cuerpo.data.materials.append(mat)

# 2. Cabeza
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.6)
cabeza = bpy.context.active_object
cabeza.location = (0, 3.0, 0.5)
cabeza.data.materials.append(mat)

# 3. Cola
bpy.ops.mesh.primitive_cone_add(radius1=0.4, depth=1.5)
cola = bpy.context.active_object
cola.rotation_euler = (1.57, 0, 0)
cola.location = (0, 0.5, -1.0)
cola.data.materials.append(mat)

# 4. Ojo Izquierdo
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.15)
ojo_izq = bpy.context.active_object
ojo_izq.location = (-0.3, 3.2, 0.9)
ojo_izq.data.materials.append(mat_ojo)

# 5. Ojo Derecho
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.15)
ojo_der = bpy.context.active_object
ojo_der.location = (0.3, 3.2, 0.9)
ojo_der.data.materials.append(mat_ojo)

# 6. Unir todas las mallas para que sea un solo modelo sólido
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = cuerpo
bpy.ops.object.join()

# Renombrar
cuerpo.name = "Alebrije"

# Exportar sobrescribiendo el modelo defectuoso de bolas
path = "C:\\Users\\GODZILLA.IA\\Tijuana\\Godzilla_Game\\models\\alebrije_procedural.glb"
bpy.ops.export_scene.gltf(filepath=path, export_format='GLB')
print("Nuevo modelo de Alebrije exportado correctamente.")
