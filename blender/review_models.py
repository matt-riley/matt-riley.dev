"""Render B-04 four-angle material studies and a flat black silhouette per exhibit."""
import argparse
import importlib.util
import math
from pathlib import Path
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from lib import materials, scene


def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def area(name, location, energy, size, colour):
    data = bpy.data.lights.new(name, 'AREA')
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    data.energy, data.size, data.color = energy, size, colour
    aim(obj, (0,0,1.15))


def render_model(name, output):
    scene.reset()
    spec = importlib.util.spec_from_file_location(name, ROOT/'scenes'/f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    root = module.create()
    root.location.z += 1
    current = bpy.context.scene
    current.render.resolution_x = current.render.resolution_y = 512
    current.render.resolution_percentage = 100
    current.render.image_settings.file_format = 'PNG'
    current.render.image_settings.color_mode = 'RGBA'
    current.view_settings.exposure = -.5
    if current.render.engine == 'CYCLES':
        current.cycles.samples = 16
        current.cycles.use_denoising = True
        current.cycles.seed = 7
        current.cycles.max_bounces = 6
        current.cycles.adaptive_threshold = .08
    porcelain = materials.porcelain(still=True)
    room = materials.room()
    room.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = .5
    floor = scene.cube('review_floor', (6,6,.1), (0,0,-.055), room, 0)
    plinth = scene.cube('review_plinth', (.45,.45,1), (0,0,.5), porcelain, .003)
    world = bpy.data.worlds.new('review_world')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (1,.96,.88,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = .16
    current.world = world
    area('skylight', (-.5,-.2,3.2), 420, 2.5, (1,.96,.89))
    area('warm_bounce', (1.5,-2,1.2), 45, 2, (1,.92,.82))
    data = bpy.data.cameras.new('review_camera')
    camera = bpy.data.objects.new('review_camera', data)
    bpy.context.collection.objects.link(camera)
    current.camera = camera
    data.type = 'ORTHO'
    data.ortho_scale = .66
    output.mkdir(parents=True, exist_ok=True)
    for angle in range(4):
        rotation = math.radians(-35+angle*90)
        camera.location = (math.sin(rotation)*1.2,-math.cos(rotation)*1.2,1.63)
        aim(camera, (0,0,1.16))
        current.render.filepath = str(output/f'{name}-{angle}.png')
        bpy.ops.render.render(write_still=True)
    # Render a true black shape with existing materials, not a new palette entry.
    floor.hide_render = plinth.hide_render = True
    current.view_settings.view_transform = "Standard"
    current.view_settings.exposure = 0
    for material in bpy.data.materials:
        shader = material.node_tree.nodes.get("Principled BSDF") if material.use_nodes else None
        if shader:
            shader.inputs["Base Color"].default_value = (0, 0, 0, 1)
            for input_name in ("Specular IOR Level", "Coat Weight", "Subsurface Weight", "Emission Strength"):
                shader.inputs[input_name].default_value = 0
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1,1,1,1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1
    camera.location = (-.68,-1,1.53)
    aim(camera, (0,0,1.18))
    current.render.filepath = str(output/f'{name}-silhouette.png')
    bpy.ops.render.render(write_still=True)


parser = argparse.ArgumentParser()
parser.add_argument('--only', choices=['tools','flagz','waffle_agent','agent_skills','waystone'])
parser.add_argument('--output-dir', type=Path, default=ROOT/'out/model-reviews')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
for name in ([args.only] if args.only else ['tools','flagz','waffle_agent','agent_skills','waystone']):
    render_model(name, args.output_dir)
