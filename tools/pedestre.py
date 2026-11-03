# Enxuga um personagem Rocketbox já convertido (projeto Lei Seca): só as animações de andar e de ficar parado,
# texturas em até 512 px, exportado como GLB com JPEG.
#   blender -b --factory-startup --python tools/pedestre.py -- <entrada.glb> <saida.glb>
import sys
import bpy

src, dst = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
keep = {"andando", "parada"}
for a in list(bpy.data.actions):
    base = a.name.split("|")[-1].split("_")[0] if "|" in a.name else a.name
    if not any(k in a.name for k in keep):
        bpy.data.actions.remove(a)
print("ACTIONS", [a.name for a in bpy.data.actions])
for img in bpy.data.images:
    if img.size[0] > 512:
        img.scale(512, max(1, int(img.size[1] * 512 / img.size[0])))
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_image_format="JPEG", export_animation_mode="ACTIONS", export_jpeg_quality=80)
