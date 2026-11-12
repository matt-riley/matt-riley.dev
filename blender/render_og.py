"""Render the identity still from the approved cat and shared museum materials."""
import argparse
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from lib import materials, scene
from scenes.cat import create_poses
from scenes.keyframe import area, point_at


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "out/identity/og-scene.png")
    parser.add_argument("--samples", type=int, default=16)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    _, poses = create_poses()
    for name, pose in poses.items():
        for obj in (pose, *pose.children_recursive):
            obj.hide_render = name != "sit"
    poses["sit"].location = (0.75, 0, 1)
    current = bpy.context.scene
    porcelain, wall = materials.porcelain(still=True), materials.room()
    scene.cube("share_plinth", (0.45, 0.45, 1), (0.75, 0, 0.5), porcelain, 0.003)
    scene.cube("share_floor", (10, 8, 0.08), (0, 0, -0.04), wall, 0)
    scene.cube("share_wall", (10, 0.08, 4), (0, 1.1, 2), wall, 0)
    current.world = bpy.data.worlds.new("share_world")
    current.world.use_nodes = True
    background = current.world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (1, 0.96, 0.88, 1)
    background.inputs["Strength"].default_value = 0.16
    area("share_skylight", (0.25, -0.6, 3.2), (0.75, 0, 0.9), 420, 2.5, (1, 0.96, 0.89))
    area("share_bounce", (2.25, -1, 1.2), (0.75, 0, 0.8), 45, 2, (1, 0.92, 0.82))
    data = bpy.data.cameras.new("share_camera")
    camera = bpy.data.objects.new("share_camera", data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0, -3.3, 1.8)
    data.lens = 45
    point_at(camera, Vector((0, 0, 0.85)))
    current.camera = camera
    current.render.resolution_x = 1200
    current.render.resolution_y = 630
    current.render.resolution_percentage = 100
    current.render.image_settings.file_format = "PNG"
    current.render.image_settings.color_mode = "RGB"
    current.render.image_settings.compression = 70
    current.view_settings.exposure = -0.5
    if current.render.engine == "CYCLES":
        current.cycles.samples = args.samples
        current.cycles.use_denoising = True
        if hasattr(current.cycles, "denoising_use_gpu"):
            current.cycles.denoising_use_gpu = False
        current.cycles.seed = 7
        current.cycles.max_bounces = 6
    args.output.parent.mkdir(parents=True, exist_ok=True)
    current.render.filepath = str(args.output)
    bpy.ops.render.render(write_still=True)
    (args.output.parent / "parameters.json").write_text(json.dumps({
        "width": 1200, "height": 630, "samples": args.samples, "seed": 7,
        "pose": "sit", "camera": list(camera.location), "lens_mm": 45,
        "view_transform": "AgX", "exposure": -0.5,
        "porcelain_roughness": materials.PORCELAIN_ROUGHNESS,
        "glaze": materials.GLAZE_COLOUR,
    }, indent=2) + "\n")


if __name__ == "__main__":
    main()
