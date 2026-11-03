# Abre cada GLB exportado no Blender e imprime a caixa envolvente em metros (Blender: z para cima).
import sys, glob, bpy
from mathutils import Vector
for f in sorted(glob.glob(sys.argv[sys.argv.index("--") + 1] + "/*.glb")):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.gltf(filepath=f)
    except Exception as e:
        print("GLB", f, "FALHOU", e); continue
    lo = Vector((1e9, 1e9, 1e9)); hi = -lo
    n = 0
    for o in bpy.context.scene.objects:
        if o.type != "MESH": continue
        n += 1
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    print("GLB", f.split("\\")[-1].split("/")[-1], "malhas", n, "min", [round(v, 2) for v in lo], "max", [round(v, 2) for v in hi], "anims", len(bpy.data.actions))
