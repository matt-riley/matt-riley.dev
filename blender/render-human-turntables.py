"""B-05 review stills in the approved B-02 P2/G2 key-frame lighting."""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from lib import materials, scene
from scenes.keyframe import area, point_at

MODELS = {"open-mic": "open_mic", "boom-bap": "boom_bap", "absent": "absent", "gift-shop": "gift_shop"}


def render_model(name, output):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scenes" / f"{MODELS[name]}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for angle in (0, 90, 180, 270):
        current = scene.reset()
        root = module.create(still=True)
        root.location.z = 0 if name == "absent" else 1
        root.rotation_euler.z = math.radians(angle)
        bpy.context.view_layer.update()
        bounds = [obj.matrix_world @ Vector(corner) for obj in root.children_recursive if obj.type == "MESH" for corner in obj.bound_box]
        low = Vector(tuple(min(point[index] for point in bounds) for index in range(3)))
        high = Vector(tuple(max(point[index] for point in bounds) for index in range(3)))
        target = (low + high) / 2
        radius = max(high[index] - low[index] for index in range(3))
        room = materials.room()
        room.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.5
        scene.cube("review_floor", (7, 7, 0.1), (0, 0, -0.055), room, 0)
        scene.cube("review_back_wall", (7, 0.1, 3.5), (0, 1.15, 1.7), room, 0)
        scene.cube("review_side_wall", (0.1, 7, 3.5), (-1.15, 0, 1.7), room, 0)
        if name != "absent":
            scene.cube("review_plinth", (0.45, 0.45, 1), (0, 0, 0.5), materials.porcelain(still=True), 0.003)
        world = bpy.data.worlds.new("approved_gallery_world")
        current.world = world
        world.use_nodes = True
        world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 0.96, 0.88, 1)
        world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.16
        area("approved_skylight", (-0.5, -0.2, 3.2), (0, 0, 0.7), 420, 2.5, (1, 0.96, 0.89))
        area("approved_warm_bounce", (1.5, -2, 1.2), (0, 0, 0.8), 45, 2, (1, 0.92, 0.82))
        camera_data = bpy.data.cameras.new("turntable_camera")
        camera = bpy.data.objects.new("turntable_camera", camera_data)
        bpy.context.collection.objects.link(camera)
        current.camera = camera
        camera.location = target + Vector((1.4, -2.3, 1.65)).normalized() * max(0.9, radius * 3.7)
        camera_data.lens = 55
        point_at(camera, target)
        current.view_settings.exposure = -0.5
        current.render.resolution_x = 640
        current.render.resolution_y = 640
        current.render.resolution_percentage = 100
        current.render.image_settings.file_format = "PNG"
        current.render.image_settings.color_mode = "RGB"
        current.render.film_transparent = False
        if current.render.engine == "CYCLES":
            current.cycles.samples = 16
            current.cycles.use_denoising = True
            current.cycles.adaptive_threshold = 0.06
            current.cycles.max_bounces = 8
            current.cycles.seed = 7
        current.render.filepath = str(output / f"{name}-{angle}.png")
        bpy.ops.render.render(write_still=True)
        print(f"Rendered {name} {angle} degrees", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Render the four B-05 model turntables")
    parser.add_argument("--only", choices=tuple(MODELS))
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    output = ROOT / "out/human-turntable-frames"
    output.mkdir(parents=True, exist_ok=True)
    for name in ([args.only] if args.only else MODELS):
        render_model(name, output)
    (output / "parameters.json").write_text(json.dumps({
        "lighting": "B-02 approved P2/G2 day key frame",
        "porcelain_roughness": 0.85, "glaze_colour": "#E8741A",
        "room_roughness": 0.5, "exposure": -0.5, "world_strength": 0.16,
        "skylight_watts": 420, "skylight_size_m": 2.5, "bounce_watts": 45,
        "samples": 16, "seed": 7, "frame_resolution": [640, 640], "angles_degrees": [0, 90, 180, 270],
        "absent_placement": "floor fragments; B-03 supplies full-size plinth dusting and pawprint",
    }, indent=2) + "\n")


if __name__ == "__main__":
    main()
