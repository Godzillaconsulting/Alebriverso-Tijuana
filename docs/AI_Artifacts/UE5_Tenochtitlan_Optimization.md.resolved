# Especificaciones de Optimización de Motor: Tenochtitlán 1400 d.C. (UE 5.7)

*Documento de Ingeniería Técnica para Renders Estéticos y Gama Media a 60FPS constantes.*

## 1. Iluminación "Atardecer Esmeralda" (Lumen Config para Gama Media)
Para garantizar 60 FPS en hardware tipo RTX 3060 / RX 6600 sin perder la vibra esmeralda rebotando en el Templo Mayor, ejecutamos los siguientes CVars en la configuración del nivel:

```ini
; Limitar los rayos del Lumen a "Low-Mid" pero incrementar la acumulación temporal.
r.Lumen.DiffuseIndirect.Allow=1
r.Lumen.HardwareRayTracing=0  ; Software RayTracing puro, más amigable con hardware base.
r.Lumen.ScreenProbeGather.DownsampleFactor=16 ; Crucial. El downsampling absorbe el "Glow" sin laguer.
r.Lumen.Reflections.MaxTracesPerPoint=1 ; Menos trazos reflejados en el charco de las chinampas.
r.SkyLight.RealTimeCapture.TimeSlice=1  ; Captura del atardecer verde escalonado, no cada frame.
```

## 2. Optimizaciones de Geometría y Culling
**Problema:** La "Gran Escalinata" del Templo Mayor tiene escalones pesados que se comen los Draw Calls.  
**Solución Técnica:**
- **Frustum Culling Modificado:** Habilitar *Hardware Occlusion Queries* y usar **HLODs (Hierarchical Level of Detail)** para el templo base cuando estás en las Chinampas.
- A medida que Tijuana salta los escalones, la cámara ("Ejes Fijos") restringe el FOV (Field of View). Ajustar el `Cull Distance Volume` de las chinampas tras el jugador a 3000 unidades. Literalmente "dejamos de existir" lo que Tijuana deja abajo.

## 3. Lógica de Shaders Estéticos y Cel-Shading

### Cel Shading Post-Process (Bordes HD)
* El Cel Shader clásico choca con Lumen. La solución es un **Material Post-Process en "Before ToneMapping"**. 
* Basado en la detección del Buffer de Profundidad (SceneDepth) modificado: Un operador Sobel compara los píxeles adyacentes; si hay una caída de profundidad marcada (Ej: Borde de la cara del Jaguar obsidiana), pinta un píxel de contorno `#1A1A1A`.

### Scrolling Textures de 4KB (Emulación Nintendo 64)
* En tu Material de Pasto de la Chinampa, en lugar de pintar césped 3D, mapearemos una textura pixelada de 4KB importada sin MipMaps y con filtrado `Nearest` (Nearest Neighbor filtering).
* Añadir un nudo **Panner** en el Grafo de Material conectado a los UVs de la textura (Velocidad: X:-0.01, Y:0.02) combinado con un `World Position Offset` atado a una onda de Seno para lograr la **vibración mágica**.

### Bloom Intenso Múltiple (Render Targets)
* Para que los neones de la espada de Huitzilopochtli no maten el rendimiento con *Convolution Bloom*, se aísla el canal emisivo con un **Custom Depth Stencil**. 
* Solo los objetos con *CustomDepth Pass = 1* mandarán luz al Render Target secundario de Bloom (Media resolución), aplicándolo de forma barata ("Fake Bloom").

## 4. Partículas "Bit-Pop" (Sincronía Niágara / Audio)
- Sistema basado en la GPU con **Niagara Systems**. 
- Usando un evento **Collision Event en Niagara**, al instante que la chispa del Tonalli recolectado muere, exporta una señal por Blueprint que detona el *Sound Cue* 8-Bit, asegurando retraso = 0ms.
