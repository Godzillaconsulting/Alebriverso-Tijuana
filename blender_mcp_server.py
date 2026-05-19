import os
import subprocess
from mcp.server.fastmcp import FastMCP

# Ruta a tu ejecutable de Blender
BLENDER_PATH = r"C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
PROJECT_FILE = "escenario.blend"

# Inicializar MCP
mcp = FastMCP("BlenderScenarioServer")

def run_blender_script(script_code: str) -> str:
    """Ejecuta un script de Python temporal dentro de Blender."""
    # 1. Guardar el código en un archivo temporal
    temp_script = "blender_temp_command.py"
    with open(temp_script, "w", encoding="utf-8") as f:
        f.write(script_code)
    
    # 2. Si no existe el proyecto, creamos uno vacío en memoria primero
    args = [BLENDER_PATH, "-b"]
    if os.path.exists(PROJECT_FILE):
        args.append(PROJECT_FILE)
    
    args.extend(["-P", temp_script])
    
    # 3. Ejecutar Blender de fondo
    result = subprocess.run(args, capture_output=True, text=True)
    
    if result.returncode != 0:
        return f"Error ejecutando Blender:\n{result.stderr}"
    return "Comando ejecutado con éxito y escenario guardado."

@mcp.tool()
def init_scene() -> str:
    """Inicializa la escena borrando todo y creando el archivo base."""
    code = f"""
import bpy
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
bpy.ops.wm.save_as_mainfile(filepath=r"{os.path.abspath(PROJECT_FILE)}")
"""
    return run_blender_script(code)

@mcp.tool()
def add_cube(name: str, size: float, x: float, y: float, z: float) -> str:
    """Añade un cubo de cierto tamaño en coordenadas X, Y, Z."""
    code = f"""
import bpy
bpy.ops.mesh.primitive_cube_add(size={size}, location=({x}, {y}, {z}))
bpy.context.active_object.name = '{name}'
bpy.ops.wm.save_mainfile()
"""
    return run_blender_script(code)

@mcp.tool()
def add_light(name: str, x: float, y: float, z: float, energy: float) -> str:
    """Añade una luz POINT."""
    code = f"""
import bpy
bpy.ops.object.light_add(type='POINT', location=({x}, {y}, {z}))
bpy.context.active_object.name = '{name}'
bpy.context.active_object.data.energy = {energy}
bpy.ops.wm.save_mainfile()
"""
    return run_blender_script(code)

if __name__ == "__main__":
    print("Servidor MCP de Blender iniciado. Esperando conexión del cliente...", flush=True)
    mcp.run()
