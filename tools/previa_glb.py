# Renderiza uma prévia (Workbench) da cena exportada, vista de cima e de lado, para conferir posições.
import sys, math, bpy
f, out = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=f)
sc = bpy.context.scene
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.light = "STUDIO"
sc.display.shading.color_type = "TEXTURE"
sc.render.resolution_x, sc.render.resolution_y = 1280, 720
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
sc.camera = cam
cam.location = (16, -20, 11)
d = cam.location
cam.rotation_euler = (math.radians(63), 0, math.radians(38))
sc.frame_set(10)
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
