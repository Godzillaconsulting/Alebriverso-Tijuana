from PIL import Image
import os
import glob

def process_image(input_path, output_path):
    print(f"Procesando {input_path}...")
    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()
        
        newData = []
        # Eliminando fondo blanco (Alpha Mask)
        for item in datas:
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                newData.append((255, 255, 255, 0)) # Transparente
            else:
                newData.append(item)
                
        img.putdata(newData)
        
        # Upscale a 2K (2048x2048) manteniendo calidad
        img = img.resize((2048, 2048), Image.Resampling.LANCZOS)
        
        img.save(output_path, "PNG")
        print(f"Guardado exitosamente: {output_path}")
    except Exception as e:
        print(f"Error procesando {input_path}: {e}")

if __name__ == "__main__":
    base_dir = r"D:\Proyecos IA\Jaky}\ALEBRIVERSO\assets"
    input_dir = os.path.join(base_dir, "raw")
    output_dir = os.path.join(base_dir, "sprites")
    
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    files = glob.glob(os.path.join(input_dir, "*.png"))
    if not files:
        print(f"Pipelines en espera: No se encontraron imágenes PNG en {input_dir}.")
        print("Por favor, coloca los renders (Serpiente, Jaguar, Huitzilopochtli) en esa carpeta y vuelve a ejecutar el script.")
    else:
        print(f"Se encontraron {len(files)} imágenes. Iniciando Post-Procesamiento...")
        for f in files:
            filename = os.path.basename(f)
            out_path = os.path.join(output_dir, filename)
            process_image(f, out_path)
        print("¡Post-Procesamiento finalizado!")
