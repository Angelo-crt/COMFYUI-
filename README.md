# COMFYUI-

## Casca + estilo "manos y destello rojo"

Workflow: `workflows/casca_estilo_manos_api.json` (formato API; arrástralo a ComfyUI o usa *Load*).

- `input/personaje.jpg` -> personaje (se carga con IPAdapter, peso 0.8, `linear`).
- `input/estilo.jpg` -> estilo (IPAdapter `style transfer`) y base de composición (img2img, denoise 0.72).

Copia ambas imágenes a `ComfyUI/input/`.

Requisitos: ComfyUI_IPAdapter_plus, checkpoint SDXL, modelos IPAdapter SDXL "plus" + CLIP Vision.

Ajustes: sube `denoise` (0.8) para que el personaje se integre más; bájalo (0.6) para conservar las manos.
Peso del personaje 0.6-1.0.
