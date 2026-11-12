"""B-07: reproducible photographs from the gallery's exported geometry and stops.

Run build.py first: Blender imports raw glTF, not the Meshopt web derivatives.
The baked runtime atlas is deliberately replaced by the original shared surface
materials for these path-traced photographs: this allows actual exhibit shadows
and a single night torch without lighting the baked room a second time.
"""
import argparse
import hashlib
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

STOPS = ("entrance", "tools", "flagz", "waffle-agent", "agent-skills", "waystone", "acquisitions", "human-error", "gift-shop")
MODELS = ("tools", "flagz", "waffle-agent", "agent-skills", "waystone", "open-mic", "boom-bap", "absent", "gift-shop")
# Match E-06's canonical initial locations: sit on the empty Human Error plinth,
# sleep on the gift-shop counter. Other stops use their first authored marker.
PREFERRED_CAT_MARKERS = {7: "cat_9", 8: "cat_11"}


def cat_marker(markers, stop):
    marker = next((obj for obj in markers if obj.name == PREFERRED_CAT_MARKERS.get(stop)), None)
    if marker is None:
        marker = next(obj for obj in markers if int(obj["stop"]) == stop)
    if int(marker["stop"]) != stop:
        raise ValueError(f"Cat marker {marker.name} belongs to the wrong stop")
    return marker


def cat_pose(marker, stop):
    # E-06 scripts these two poses; the room marker still records its generic
    # alternate pose, so do not rewrite or validate that metadata as the script.
    return {7: "sit", 8: "sleep"}.get(stop, marker["pose"])


def import_raw(path):
    if not path.is_file():
        raise FileNotFoundError(f"Missing raw model {path}. Run pnpm assets to build all source scenes first.")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return set(bpy.data.objects) - before


def surfaces(objects):
    """Restore the approved physical materials; do not mutate the source atlas."""
    porcelain = materials.porcelain(still=True)
    glaze = materials.glaze()
    room = materials.room()
    room.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.5
    for material in (porcelain, glaze, room):
        shader = material.node_tree.nodes["Principled BSDF"]
        for name in ("Base Color", "Emission Color"):
            for link in list(shader.inputs[name].links):
                material.node_tree.links.remove(link)
        shader.inputs["Emission Strength"].default_value = 0
    for obj in objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            name = slot.material.name if slot.material else ""
            if name.startswith("glaze_dark"):
                # B-06's approved second stripe colour remains intact.
                continue
            slot.material = glaze if name.startswith("glaze") else room if name.startswith("room") else porcelain


def clone_pose(source, parent=None):
    duplicate = source.copy()
    bpy.context.collection.objects.link(duplicate)
    duplicate.parent = parent
    duplicate.hide_render = False
    for child in source.children:
        clone_pose(child, duplicate)
    return duplicate


def assemble(raw):
    current = scene.reset()
    room_objects = import_raw(raw / "room.glb")
    surfaces(room_objects)
    # Lookups are captured before imports with potentially duplicated node names.
    nodes = {obj.name: obj for obj in room_objects}
    models = {}
    for model in MODELS:
        objects = import_raw(raw / f"{model}.glb")
        surfaces(objects)
        root = next(obj for obj in objects if obj.name == f"exhibit_{model}")
        root.matrix_world = nodes[f"anchor_{model}"].matrix_world.copy()
        models[model] = root
    cat_objects = import_raw(raw / "cat.glb")
    surfaces(cat_objects)
    poses = {obj.name: obj for obj in cat_objects if obj.name in {"cat_sit", "cat_loaf", "cat_stretch", "cat_sleep"}}
    markers = sorted((obj for obj in room_objects if obj.name.startswith("cat_") and obj.name[4:].isdigit()), key=lambda obj: int(obj.name[4:]))
    for stop in range(len(STOPS)):
        marker = cat_marker(markers, stop)
        pose = clone_pose(poses[f"cat_{cat_pose(marker, stop)}"])
        pose.name = f"photograph_cat_stop_{stop}"
        pose.matrix_world = marker.matrix_world.copy()
        if stop == 7:
            # Runtime rotates around glTF Y by pi: Blender's equivalent is Z.
            # The cat pointedly looks away from the fallen porcelain fragments.
            pose.rotation_euler.rotate_axis("Z", math.pi)
    for obj in cat_objects:
        obj.hide_render = True
    # The original approved photograph is the only photographic texture; UV0 is
    # reserved for this plane in B-03. No lettering is added to the geometry.
    portrait = nodes["portrait_plane"]
    material = materials.porcelain(still=True).copy()
    material.name = "original_cat_portrait"
    shader = material.node_tree.nodes["Principled BSDF"]
    texture = material.node_tree.nodes.new("ShaderNodeTexImage")
    uv = material.node_tree.nodes.new("ShaderNodeUVMap")
    uv.uv_map = portrait.data.uv_layers[0].name
    material.node_tree.links.new(uv.outputs["UV"], texture.inputs["Vector"])
    texture.image = bpy.data.images.load(str(ROOT.parent / "src/assets/waffle-portrait.jpg"), check_existing=True)
    # Match E-07's original-photo proportions instead of stretching it to the
    # room's placeholder plane. Importing the raw GLB restores Blender Z-up.
    bpy.context.view_layer.update()
    if portrait.dimensions.x > 0 and portrait.dimensions.z > 0:
        image_width, image_height = texture.image.size
        portrait.scale.x *= (image_width / image_height) / (portrait.dimensions.x / portrait.dimensions.z)
    material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    portrait.data.materials.clear()
    portrait.data.materials.append(material)
    bpy.context.view_layer.update()
    return current, nodes, models


def subject_bounds(name, nodes, models):
    if name == "entrance":
        subjects = [obj for key, obj in nodes.items() if key.startswith(("rope_", "touch_rope", "unhooked_rope", "title_wall"))]
    elif name == "acquisitions":
        subjects = [obj for key, obj in nodes.items() if key.startswith("acquisitions_frame")]
    elif name == "human-error":
        subjects = [models[key] for key in ("open-mic", "boom-bap", "absent")]
        subjects += [obj for key, obj in nodes.items() if key.startswith(("plinth_open", "plinth_boom", "plinth_absent", "portrait_"))]
    elif name == "gift-shop":
        # The scripted sleeping cat is on the counter beside the linked objects.
        # Keep both in the square photograph rather than cropping the cat away.
        subjects = [models[name], bpy.data.objects["photograph_cat_stop_8"]]
    else:
        subjects = [models[name]]
    meshes = {mesh for obj in subjects for mesh in (obj, *obj.children_recursive) if mesh.type == "MESH"}
    points = [mesh.matrix_world @ Vector(corner) for mesh in meshes for corner in mesh.bound_box]
    low = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    high = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return (low + high) / 2, max(high[index] - low[index] for index in range(3))


def lighting(current, camera, target, mode, stop):
    for obj in list(bpy.data.objects):
        if obj.type == "LIGHT":
            bpy.data.objects.remove(obj, do_unlink=True)
    world = current.world
    if world is None:
        world = bpy.data.worlds.new("catalogue_world")
        current.world = world
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (1, 0.96, 0.88, 1)
    room_study = stop in ("entrance", "acquisitions")
    background.inputs["Strength"].default_value = (0.35 if room_study else 0.16) if mode == "day" else 0.001
    current.view_settings.exposure = -1 if mode == "day" and room_study else -0.5
    for material in bpy.data.materials:
        if material.name.startswith("glaze") and material.use_nodes:
            shader = material.node_tree.nodes.get("Principled BSDF")
            if shader:
                shader.inputs["Emission Color"].default_value = shader.inputs["Base Color"].default_value
                shader.inputs["Emission Strength"].default_value = 0 if mode == "day" else 0.12
    x = target.x
    if mode == "day" and room_study:
        sky = area("baked_gallery_skylight", (0, 0, 4.18), (0, 0, 0), 2600, 29, (1, 0.96, 0.89))
        sky.data.shape = "RECTANGLE"
        sky.data.size_y = 1.1
    elif mode == "day":
        area("catalogue_skylight", (x - 0.5, 1.2, 3.2), (x, 1.6, 0.7), 420, 2.5, (1, 0.96, 0.89))
        area("catalogue_bounce", (x + 1.5, -0.4, 1.2), (x, 1.6, 0.8), 45, 2, (1, 0.92, 0.82))
    else:
        data = bpy.data.lights.new("camera_left_torch", "SPOT")
        torch = bpy.data.objects.new("camera_left_torch", data)
        bpy.context.collection.objects.link(torch)
        torch.location = camera.location + Vector((-0.7, 0.4, 0.2))
        data.energy = 35
        data.spot_size = math.radians(28)
        data.spot_blend = 0.7
        data.shadow_soft_size = 0.08
        data.color = (1, 0.94, 0.84)
        point_at(torch, target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw-dir", type=Path, default=ROOT / "out")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "out/stills")
    parser.add_argument("--only", choices=STOPS)
    parser.add_argument("--start-at", choices=STOPS, help="Resume a partial batch from this stop, retaining earlier complete originals")
    parser.add_argument("--mode", choices=("day", "night"))
    parser.add_argument("--crop", choices=("wide", "square"))
    parser.add_argument("--samples", type=int, default=8)
    parser.add_argument("--preview", action="store_true", help="Render one-third size QA images; build-stills refuses to publish them")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    current, nodes, models = assemble(args.raw_dir)
    current.view_settings.exposure = -0.5
    current.render.image_settings.file_format = "PNG"
    current.render.image_settings.color_mode = "RGB"
    current.render.image_settings.compression = 60
    current.render.film_transparent = False
    if current.render.engine != "CYCLES":
        raise RuntimeError("Catalogue photographs require Cycles with denoising")
    current.cycles.samples = args.samples
    current.cycles.use_denoising = True
    if hasattr(current.cycles, "denoising_use_gpu"):
        current.cycles.denoising_use_gpu = False
    current.cycles.adaptive_threshold = 0.06
    current.cycles.max_bounces = 8
    current.cycles.seed = 7
    data = bpy.data.cameras.new("catalogue_camera")
    camera = bpy.data.objects.new("catalogue_camera", data)
    bpy.context.collection.objects.link(camera)
    current.camera = camera
    data.type = "PERSP"
    data.sensor_fit = "VERTICAL"
    data.sensor_height = 24
    data.lens = 24 / (2 * math.tan(math.radians(35) / 2))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for stop, name in enumerate(STOPS):
        if args.only and name != args.only:
            continue
        if args.start_at and stop < STOPS.index(args.start_at):
            continue
        # Runtime owns one travelling figurine. Do not accidentally photograph a
        # second stop's cat at the edge of a wide view through the long room.
        for obj in bpy.data.objects:
            if obj.name.startswith("photograph_cat_stop_"):
                hidden = obj.name != f"photograph_cat_stop_{stop}"
                for part in (obj, *obj.children_recursive):
                    part.hide_render = hidden
        camera.location = nodes[f"stop_{stop}_cam"].matrix_world.translation
        target = nodes[f"stop_{stop}_target"].matrix_world.translation
        focus, extent = subject_bounds(name, nodes, models)
        point_at(camera, target)
        for mode in ([args.mode] if args.mode else ("day", "night")):
            camera.location = nodes[f"stop_{stop}_cam"].matrix_world.translation
            point_at(camera, target)
            lighting(current, camera, focus, mode, name)
            for crop, width in (("wide", 2400), ("square", 1600)):
                if args.crop and args.crop != crop:
                    continue
                if crop == "square":
                    wall_study = name in ("entrance", "acquisitions", "human-error")
                    margin = 1.35 if name == "entrance" else 1.2 if wall_study else 1.65
                    direction = Vector((0.15, -1, 0.2) if wall_study else (0.45, -1, 0.65)).normalized()
                    distance = max(0.7, extent / (2 * math.tan(math.radians(35) / 2)) * margin)
                    camera.location = focus + direction * distance
                    # Foreground floor fragments sit nearer the lens than the
                    # tall portrait: give Human Error a little more floor space.
                    point_at(camera, focus - Vector((0, 0, 0.2)) if name in ("entrance", "human-error") else focus)
                else:
                    camera.location = nodes[f"stop_{stop}_cam"].matrix_world.translation
                    point_at(camera, target)
                current.render.resolution_x = width
                current.render.resolution_y = 1600
                current.render.resolution_percentage = 33 if args.preview else 100
                current.render.filepath = str(args.output_dir / f"{name}-{mode}-{crop}.png")
                bpy.ops.render.render(write_still=True)
                print(f"Catalogue {name} {mode} {crop} complete", flush=True)
    sources = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in [args.raw_dir / f"{name}.glb" for name in ("room", *MODELS, "cat")]}
    markers = [obj for obj in nodes.values() if obj.name.startswith("cat_") and obj.name[4:].isdigit()]
    cats = {name: {"marker": marker.name, "pose": cat_pose(marker, stop), "position": list(marker.matrix_world.translation), "turn_z_degrees": 180 if stop == 7 else 0} for stop, name in enumerate(STOPS) for marker in [cat_marker(markers, stop)]}
    (args.output_dir / "parameters.json").write_text(json.dumps({"sources_sha256": sources, "vertical_fov_degrees": 35, "samples": args.samples, "denoise": True, "seed": 7, "exposure": -0.5, "view_transform": "AgX", "day": "B-02 approved 420W skylight/45W bounce/world0.16", "night": "B-02 approved 35W torch/28deg cone/world0.001/glaze emission0.12", "room": "Original shared surface colours, path-traced rather than double-lighting the runtime atlas", "portrait": "Original waffle-portrait.jpg on B-03 portrait_plane UV0; original aspect ratio preserved", "cats": cats, "crops": {"wide": [2400,1600], "square": [1600,1600]}}, indent=2) + "\n")


if __name__ == "__main__":
    main()
