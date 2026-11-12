"""Render-only B-02 look development. No web model is exported from this scene."""

import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from lib import materials, scene

ROUGHNESS = (0.75, 0.85, 0.95)
GLAZES = ("#DF6D17", "#E8741A", "#EF7B20")


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def rod(name, start, end, radius, material):
    start, end = Vector(start), Vector(end)
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=(end - start).length, location=(start + end) / 2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = (end - start).to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    scene.bevel(obj, min(radius / 2, 0.001), 3)
    scene.smooth(obj)
    return obj


def tray(name, centre, width, depth, height, material):
    x, y, z = centre
    t = 0.004
    scene.cube(f"{name}_floor", (width, depth, t), (x, y, z), material, 0.0012)
    for sign in (-1, 1):
        scene.cube(f"{name}_end_{sign}", (t, depth, height), (x + sign * (width - t) / 2, y, z + height / 2), material, 0.0012)
        scene.cube(f"{name}_side_{sign}", (width - 2 * t, t, height), (x, y + sign * (depth - t) / 2, z + height / 2), material, 0.0012)


def toolbox(porcelain, glaze):
    tray("body", (0, 0, 1.014), 0.34, 0.18, 0.13, porcelain)
    # Two trays swing away from the central carrying handle.
    for side in (-1, 1):
        tray(f"tray_{side}", (0, side * 0.135, 1.205), 0.32, 0.095, 0.048, porcelain)
        for x in (-0.151, 0.151):
            for y, z in ((0.067, 1.09), (0.071, 1.13)):
                rod(f"cantilever_{side}_{x}_{z}", (x, side * y, z), (x, side * (y + 0.08), z + 0.112), 0.0034, porcelain)
                scene.sphere(f"joint_{side}_{x}_{z}", 0.0045, (x, side * y, z), porcelain, 16, 8)
    # A shallow front drawer, with the single glazed working part.
    scene.cube("drawer_face", (0.245, 0.011, 0.041), (0, -0.095, 1.047), porcelain, 0.002)
    for x in (-0.031, 0.031):
        rod(f"handle_mount_{x}", (x, -0.103, 1.047), (x, -0.123, 1.047), 0.0043, glaze)
        scene.sphere(f"handle_curve_{x}", 0.0043, (x, -0.123, 1.047), glaze, 16, 8)
    rod("drawer_handle", (-0.031, -0.123, 1.047), (0.031, -0.123, 1.047), 0.0043, glaze)
    for x in (-0.146, 0.146):
        rod(f"carrying_handle_{x}", (x, 0, 1.12), (x, 0, 1.335), 0.005, porcelain)
    rod("carrying_grip", (-0.146, 0, 1.335), (0.146, 0, 1.335), 0.008, porcelain)
    # Quiet interior dividers give the open trays scale without adding colour.
    for y in (-0.135, 0.135):
        for x in (-0.07, 0.065):
            scene.cube(f"divider_{y}_{x}", (0.0035, 0.087, 0.035), (x, y, 1.224), porcelain, 0.0009)


def area(name, location, target, energy, size, colour):
    data = bpy.data.lights.new(name, "AREA")
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    data.energy, data.shape, data.size, data.color = energy, "DISK", size, colour
    point_at(obj, target)
    return obj


def setup(mode="day", roughness=0.85, glaze_colour="#E8741A", width=2400, height=1600):
    current = scene.reset()
    current.render.resolution_x = width
    current.render.resolution_y = height
    current.render.resolution_percentage = 100
    current.render.image_settings.file_format = "PNG"
    current.render.image_settings.color_mode = "RGB"
    current.render.image_settings.compression = 25
    current.render.film_transparent = False
    current.view_settings.exposure = -0.5
    if current.render.engine == "CYCLES":
        current.cycles.samples = 32 if width > 1000 else 16
        current.cycles.use_denoising = True
        current.cycles.adaptive_threshold = 0.06
        current.cycles.max_bounces = 8
        current.cycles.seed = 7
    porcelain = materials.porcelain(still=True)
    porcelain.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = roughness
    glaze = materials.glaze()
    glaze_shader = glaze.node_tree.nodes["Principled BSDF"]
    glaze_shader.inputs["Base Color"].default_value = materials._linear(glaze_colour)
    room = materials.room()
    room.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.5
    scene.cube("floor", (7, 7, 0.1), (0, 0, -0.055), room, 0)
    scene.cube("back_wall", (7, 0.1, 3.5), (0, 1.15, 1.7), room, 0)
    scene.cube("side_wall", (0.1, 7, 3.5), (-1.15, 0, 1.7), room, 0)
    scene.cube("plinth", (0.45, 0.45, 1), (0, 0, 0.5), porcelain, 0.003)
    toolbox(porcelain, glaze)
    world = bpy.data.worlds.new("gallery_world")
    current.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 0.96, 0.88, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.16
    camera_data = bpy.data.cameras.new("keyframe_camera")
    camera = bpy.data.objects.new("keyframe_camera", camera_data)
    bpy.context.collection.objects.link(camera)
    current.camera = camera
    camera.location = (1.5, -2.7, 2.0)
    camera_data.lens = 45
    point_at(camera, (0, 0, 0.72))
    if mode == "after-hours":
        world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.001
        torch_data = bpy.data.lights.new("camera_left_torch", "SPOT")
        torch = bpy.data.objects.new("camera_left_torch", torch_data)
        bpy.context.collection.objects.link(torch)
        torch.location = (-0.7, -1.7, 1.7)
        torch_data.energy = 35
        torch_data.spot_size = math.radians(28)
        torch_data.spot_blend = 0.7
        torch_data.shadow_soft_size = 0.08
        torch_data.color = (1, 0.94, 0.84)
        point_at(torch, (0, 0, 1.04))
        glaze_shader.inputs["Emission Color"].default_value = materials._linear(glaze_colour)
        glaze_shader.inputs["Emission Strength"].default_value = 0.12
    else:
        area("skylight", (-0.5, -0.2, 3.2), (0, 0, 0.7), 420, 2.5, (1, 0.96, 0.89))
        area("warm_bounce", (1.5, -2, 1.2), (0, 0, 0.8), 45, 2, (1, 0.92, 0.82))
    if mode == "close-up":
        camera.location = (0.56, -0.85, 1.58)
        camera_data.lens = 60
        point_at(camera, (0, -0.025, 1.15))
    return current


def render(output, **parameters):
    current = setup(**parameters)
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    current.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {output}", flush=True)


def main():
    parser = argparse.ArgumentParser(description="B-02 render-only look-development study")
    parser.add_argument("--only", choices=("day", "after-hours", "close-up", "variants", "all"), default="all")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "renders/keyframe")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    for mode in ("day", "after-hours", "close-up"):
        if args.only in (mode, "all"):
            render(args.output_dir / f"{mode}.png", mode=mode)
    if args.only in ("variants", "all"):
        for row, roughness in enumerate(ROUGHNESS):
            for column, colour in enumerate(GLAZES):
                render(ROOT / "out/keyframe-variants" / f"p{row + 1}-g{column + 1}.png", mode="close-up", roughness=roughness, glaze_colour=colour, width=800, height=480)
    parameters = {
        "engine": bpy.context.scene.render.engine, "fallback": "EEVEE if Cycles cannot be enabled; reported by scene.reset",
        "resolution": [2400, 1600], "samples": 32, "denoise": True, "seed": 7, "exposure": -0.5,
        "camera": {"day_and_after_hours": {"location": [1.5, -2.7, 2.0], "target": [0, 0, 0.72], "lens_mm": 45}, "close_up": {"location": [0.56, -0.85, 1.58], "target": [0, -0.025, 1.15], "lens_mm": 60}},
        "room_roughness": 0.5, "porcelain_still_subsurface_weight": 0.025,
        "baseline": {"porcelain_roughness": 0.85, "glaze_colour": "#E8741A", "glaze_roughness": 0.15, "clearcoat": 1},
        "porcelain_roughness_rows": list(ROUGHNESS), "glaze_colour_columns": list(GLAZES),
        "variant_resolution": [800, 480], "variant_samples": 16, "variant_view": "close-up",
        "day": {"world_strength": 0.16, "skylight_watts": 420, "skylight_size_m": 2.5, "bounce_watts": 45},
        "after_hours": {"world_strength": 0.001, "torch_watts": 35, "torch_cone_degrees": 28, "glaze_emission": 0.12},
        "status": "Draft studies; no material variant has been approved by Matt."
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "parameters.json").write_text(json.dumps(parameters, indent=2) + "\n")


if __name__ == "__main__":
    main()
