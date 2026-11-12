"""Render B-06 pose evidence in the approved B-02 day lighting. No blend files."""

import argparse
import json
from pathlib import Path
import sys

import bpy

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from lib import materials, scene
from scenes.cat import POSES, create_poses
from scenes.keyframe import area, point_at


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "out/cat-views")
    parser.add_argument("--samples", type=int, default=16)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    args.output.mkdir(parents=True, exist_ok=True)
    root, poses = create_poses()
    root.location.z = 1
    current = bpy.context.scene
    current.render.resolution_x = 480
    current.render.resolution_y = 360
    current.render.resolution_percentage = 100
    current.render.image_settings.file_format = "PNG"
    current.render.image_settings.color_mode = "RGBA"
    current.render.image_settings.compression = 25
    current.view_settings.exposure = -0.5
    if current.render.engine == "CYCLES":
        current.cycles.samples = args.samples
        current.cycles.use_denoising = True
        current.cycles.seed = 7
        current.cycles.adaptive_threshold = 0.06
    world = bpy.data.worlds.new("gallery_world")
    current.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 0.96, 0.88, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.16
    room = materials.room()
    room.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.5
    porcelain = materials.porcelain(still=True)
    floor = scene.cube("floor", (7, 7, 0.1), (0, 0, -0.055), room, 0)
    back_wall = scene.cube("back_wall", (7, 0.1, 3.5), (0, 1.15, 1.7), room, 0)
    side_wall = scene.cube("side_wall", (0.1, 7, 3.5), (-1.15, 0, 1.7), room, 0)
    plinth = scene.cube("plinth", (0.45, 0.45, 1), (0, 0, 0.5), porcelain, 0.003)
    area("skylight", (-0.5, -0.2, 3.2), (0, 0, 0.7), 420, 2.5, (1, 0.96, 0.89))
    area("warm_bounce", (1.5, -2, 1.2), (0, 0, 0.8), 45, 2, (1, 0.92, 0.82))
    data = bpy.data.cameras.new("pose_camera")
    camera = bpy.data.objects.new("pose_camera", data)
    bpy.context.collection.objects.link(camera)
    current.camera = camera
    data.type = "ORTHO"
    data.ortho_scale = 0.31
    views = {"front": (0, -0.7, 1.13), "side": (0.7, 0, 1.13), "three-quarter": (0.46, -0.58, 1.35)}
    for pose in POSES:
        for name, pivot in poses.items():
            for obj in [pivot, *pivot.children_recursive]:
                obj.hide_render = name != pose
        for view, location in views.items():
            camera.location = location
            point_at(camera, (0, 0, 1.105))
            current.render.film_transparent = False
            current.render.filepath = str(args.output / f"{pose}-{view}.png")
            bpy.ops.render.render(write_still=True)
            print(f"Rendered {pose} / {view}", flush=True)
        # Transparent render permits a true 80px-high pose proof without the plinth.
        floor.hide_render = plinth.hide_render = back_wall.hide_render = side_wall.hide_render = True
        current.render.film_transparent = True
        current.render.filepath = str(args.output / f"{pose}-cutout.png")
        bpy.ops.render.render(write_still=True)
        floor.hide_render = plinth.hide_render = back_wall.hide_render = side_wall.hide_render = False
    parameters = {
        "engine": current.render.engine, "samples": args.samples, "denoise": True,
        "seed": 7, "exposure": -0.5, "world_strength": 0.16,
        "skylight_watts": 420, "skylight_size_m": 2.5,
        "bounce_watts": 45, "bounce_size_m": 2,
        "glaze": "#E8741A", "glaze_dark": "#C95F12", "roughness": 0.15,
        "views": views, "orthographic_scale_m": 0.31,
        "status": "B-02 P2/G2 approved baseline; B-06 cat appearance remains open to Matt's veto.",
    }
    (args.output / "parameters.json").write_text(json.dumps(parameters, indent=2) + "\n")


if __name__ == "__main__":
    main()
