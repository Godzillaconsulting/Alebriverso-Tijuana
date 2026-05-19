import os
import torch
from PIL import Image
import logging

try:
    from tsr.system import TSR
except ImportError:
    print("ERROR: La librería nativa de TripoSR no está compilada en este entorno.")
    print("Por favor, ejecuta la instalación de dependencias primero.")
    exit(1)

logging.basicConfig(level=logging.INFO)

print("=== TIJUANA ENGINE: LOCAL AI SCULPTOR (TripoSR API) ===")

# 1. Auditoría de Hardware (El paso más crítico)
if torch.cuda.is_available():
    device = "cuda:0"
    print("[+] NVIDIA GPU CUDA Detectada. ¡Velocidad de escultura estimada: 0.5s!")
else:
    device = "cpu"
    print("[-] ADVERTENCIA CRÍTICA: No se detectó GPU CUDA.")
    print("[-] El modelo operará en la CPU. Peligro de RAM Out-Of-Memory e iteraciones hiper-lentas.")

# 2. Cargar el Músculo (Red Neuronal)
print("\n[>>] Cargando LRM Neural Weights (StabilityAI/TripoSR)...")
model = TSR.from_pretrained(
    "stabilityai/TripoSR",
    config_name="config.yaml",
    weight_name="model.ckpt",
)
model.renderer.set_chunk_size(8192) # Optimizador para no quemar la VRAM
model.to(device)

# 3. Leer el Blueprint
input_image_path = "C:\\Users\\GODZILLA.IA\\Tijuana\\ALEBRIJE_REALISTA_FRONTAL_LIMPIO.png"
print(f"\n[>>] Analizando Blueprint: {input_image_path}...")
image = Image.open(input_image_path).convert("RGBA")

# 4. Proceso de Escultura Matemático
print("[>>] Densificando Triplane y ejecutando Marching Cubes...")
with torch.no_grad():
    scene_codes = model(image, device=device)
    # Extraemos físicamente la malla (Vértices, Caras, Colores)
    mesh = model.extract_mesh(scene_codes)[0]

# 5. Exportando directamente al corazón del Motor
output_path = r"C:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models\alebrije.obj"
print(f"\n[>>] Malla atrapada. Exportando a {output_path}...")
mesh.apply_transform([
    [1, 0, 0, 0],
    [0, 0, -1, 0],
    [0, 1, 0, 0],
    [0, 0, 0, 1]
]) # Rotar al eje Y del Tijuana Engine
mesh.export(output_path)

print("\n=== ESCULTURA EXITOSA ===")
