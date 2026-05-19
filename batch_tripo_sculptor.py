import os
import torch
from PIL import Image
import logging

try:
    from tsr.system import TSR
except ImportError:
    print("ERROR: La librería nativa de TripoSR no está compilada en este entorno.")
    exit(1)

logging.basicConfig(level=logging.INFO)
print("=== BATCH TRIIPOSR SCULPTOR ===")

device = "cuda:0" if torch.cuda.is_available() else "cpu"
print(f"[+] Utilizando dispositivo: {device}")

print("[>>] Cargando LRM Neural Weights...")
model = TSR.from_pretrained(
    "stabilityai/TripoSR",
    config_name="config.yaml",
    weight_name="model.ckpt",
)
model.renderer.set_chunk_size(8192)
model.to(device)

images_to_process = {
    "jaguar": r"C:\Users\GODZILLA.IA\.gemini\antigravity\brain\dca80497-a8e3-47f2-b964-99b8a6153837\jaguar_blueprint_1779222049537.png",
    "xolo": r"C:\Users\GODZILLA.IA\.gemini\antigravity\brain\dca80497-a8e3-47f2-b964-99b8a6153837\xolo_blueprint_1779222064161.png",
    "mercader": r"C:\Users\GODZILLA.IA\.gemini\antigravity\brain\dca80497-a8e3-47f2-b964-99b8a6153837\merchant_blueprint_1779222077038.png"
}

output_dir = r"C:\Users\GODZILLA.IA\Tijuana\Godzilla_Game\models"
os.makedirs(output_dir, exist_ok=True)

for name, path in images_to_process.items():
    if not os.path.exists(path):
        print(f"[-] ERROR: No se encontró la imagen para {name} en {path}")
        continue
        
    print(f"\n[>>] Procesando: {name}")
    image = Image.open(path).convert("RGBA")
    
    with torch.no_grad():
        scene_codes = model(image, device=device)
        mesh = model.extract_mesh(scene_codes)[0]
    
    output_path = os.path.join(output_dir, f"raw_{name}.obj")
    print(f"[>>] Exportando {name} a {output_path}...")
    
    # Rotar al eje Y del Tijuana Engine
    mesh.apply_transform([
        [1, 0, 0, 0],
        [0, 0, -1, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 1]
    ])
    mesh.export(output_path)

print("\n=== BATCH COMPLETADO ===")
