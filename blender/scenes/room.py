"""Nine-bay gallery with a shared UV1 day-light bake and runtime placement nodes."""

import json
import math
from pathlib import Path
import bpy
from mathutils import Vector
from lib import materials, scene
from lib.export import export_glb

ROOT = Path(__file__).resolve().parents[1]
BAY_WIDTH = 30 / 9
IDS = ("entrance", "tools", "flagz", "waffle-agent", "agent-skills", "waystone", "acquisitions", "human-error", "gift-shop")


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def build(output):
    current = scene.reset()
    root = scene.empty("exhibit_room")
    porcelain, glaze, room = materials.porcelain(), materials.glaze(), materials.room()
    room.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.5
    static = []

    def cube(name, dimensions, location, material=room, bevel=0.003):
        obj = scene.cube(name, dimensions, location, material, bevel)
        obj.parent = root
        scene.apply_modifiers(obj)
        static.append(obj)
        return obj

    def cylinder(name, location, radius, depth):
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=depth, location=location)
        obj = bpy.context.object
        obj.name = name
        obj.data.name = name
        obj.data.materials.append(porcelain)
        scene.bevel(obj, 0.003, 3)
        scene.apply_modifiers(obj)
        scene.smooth(obj)
        obj.parent = root
        static.append(obj)
        return obj

    def marker(name, location, **properties):
        obj = scene.empty(name, location, **properties)
        obj.parent = root
        return obj

    def plinth(name, x, y=1.65):
        cube(name, (0.45, 0.45, 1), (x, y, 0.5), porcelain, 0.003)
        return (x, y, 1)

    def frame(name, centre, width, height, trim=0.045):
        x, y, z = centre
        cube(f"{name}_back", (width, 0.025, height), (x, y + 0.02, z), porcelain, 0.002)
        for sign in (-1, 1):
            cube(f"{name}_vertical_{sign}", (trim, 0.065, height), (x + sign * (width - trim) / 2, y, z), porcelain, 0.002)
            cube(f"{name}_horizontal_{sign}", (width - 2 * trim, 0.065, trim), (x, y, z + sign * (height - trim) / 2), porcelain, 0.002)

    # Continuous solid shell prevents light leaks; inset skirting creates a shadow gap.
    cube("floor", (30.2, 6.2, 0.16), (0, 0, -0.08), room, 0)
    for sign in (-1, 1):
        cube(f"wall_long_{sign}", (30.2, 0.16, 4), (0, sign * 3.08, 2), room, 0)
        cube(f"skirting_{sign}", (30, 0.035, 0.07), (0, sign * 2.98, 0.035), room, 0.001)
        cube(f"wall_end_{sign}", (0.16, 6.16, 4), (sign * 15.08, 0, 2), room, 0)
        cube(f"ceiling_{sign}", (30.16, 2.45, 0.12), (0, sign * 1.825, 4.06), room, 0)
        cube(f"skylight_reveal_{sign}", (30, 0.08, 0.22), (0, sign * 0.61, 4.03), room, 0.003)

    anchors = {}
    for stop, exhibit in enumerate(IDS):
        x = -15 + BAY_WIDTH * (stop + 0.5)
        side = "left" if stop % 2 == 0 else "right"
        sign = 1 if side == "left" else -1
        object_x = x + sign * 0.68
        if stop == 8:
            object_x = min(object_x, 13.85)
        marker(f"stop_{stop}_cam", (x, -2.1, 1.5), placard_side=side, fov=35, stop=stop)
        marker(f"stop_{stop}_target", (x, 1.65, 0.9), stop=stop)
        if 1 <= stop <= 5:
            anchors[exhibit] = plinth(f"plinth_{exhibit}", object_x)
        elif stop == 0:
            cube("title_wall", (2.2, 0.035, 1.2), (object_x, 2.955, 1.6), room, 0.002)
            for index, post_x in enumerate((object_x - 0.42, object_x + 0.42)):
                cylinder(f"rope_post_{index}", (post_x, 1.5, 0.43), 0.025, 0.86)
                cylinder(f"rope_foot_{index}", (post_x, 1.5, 0.025), 0.11, 0.05)
                finial = scene.sphere(f"rope_finial_{index}", 0.04, (post_x, 1.5, 0.89), porcelain, 20, 10)
                finial.parent = root
                static.append(finial)
            curve = bpy.data.curves.new("unhooked_rope", "CURVE")
            curve.dimensions, curve.bevel_depth, curve.bevel_resolution = "3D", 0.014, 4
            spline = curve.splines.new("BEZIER")
            spline.bezier_points.add(3)
            for point, coordinate in zip(spline.bezier_points, ((0, 0, 0), (0.12, -0.02, -0.2), (0.18, -0.015, -0.49), (0.1, 0, -0.68))):
                point.co = coordinate
                point.handle_left_type = point.handle_right_type = "AUTO"
            rope = bpy.data.objects.new("touch_rope", curve)
            bpy.context.collection.objects.link(rope)
            rope.location = (object_x - 0.42, 1.5, 0.86)
            rope.parent = root
            rope.data.materials.append(glaze)
            rope["axis"], rope["kind"], rope["range"] = "z", "hinge", [-0.18, 0.18]
            bpy.ops.object.select_all(action="DESELECT")
            rope.select_set(True)
            bpy.context.view_layer.objects.active = rope
            bpy.ops.object.convert(target="MESH")
        elif stop == 6:
            frame("acquisitions_frame", (object_x, 2.91, 1.6), 2.4, 1.2)
        elif stop == 7:
            # Keep all three plinths in the exhibit half of this view.
            for exhibit_id, offset in (("open-mic", 0.1), ("boom-bap", 0.7), ("absent", 1.3)):
                position = plinth(f"plinth_{exhibit_id}", x + sign * offset)
                anchors[exhibit_id] = position if exhibit_id != "absent" else (x + sign * offset, 1.1, 0)
            frame("portrait_frame", (x + sign * 0.7, 2.91, 1.85), 0.5, 0.6, 0.035)
            bpy.ops.mesh.primitive_plane_add(size=1, location=(x + sign * 0.7, 2.867, 1.85), rotation=(math.pi / 2, 0, 0))
            portrait = bpy.context.object
            portrait.name = "portrait_plane"
            portrait.scale = (0.43, 0.53, 1)
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            portrait.data.materials.append(porcelain)
            portrait.parent = root
            static.append(portrait)
        elif stop == 8:
            cube("gift_shop_shelf", (2, 0.35, 0.055), (object_x, 2.7, 1.38), porcelain, 0.003)
            cube("gift_shop_counter", (1.45, 0.6, 0.9), (object_x, 1.6, 0.45), porcelain, 0.003)
            anchors["gift-shop"] = (object_x, 1.6, 0.9)

    for exhibit, location in anchors.items():
        marker(f"anchor_{exhibit}", location)
    cat_spots = json.loads((ROOT / "cat-spots.json").read_text())["spots"]
    for spot in cat_spots:
        marker(f"cat_{spot['id']}", spot["position"], pose=spot["pose"], stop=spot["stop"])

    # A shallow pressed pawprint and scattered ceramic dust occupy the empty
    # room plinth; B-05 supplies only the floor fragments beside it.
    empty_plinth = bpy.data.objects.get("plinth_absent")
    paw_x, paw_y = empty_plinth.location.x, empty_plinth.location.y
    for number, (dx, dy, rx, ry) in enumerate(((0, -0.012, 0.019, 0.014), (-0.022, 0.008, 0.008, 0.01), (-0.008, 0.02, 0.008, 0.011), (0.009, 0.02, 0.008, 0.011), (0.023, 0.007, 0.008, 0.01))):
        cutter = scene.sphere(f"paw_cutter_{number}", 1, (paw_x + dx, paw_y + dy, 1.001), None, 16, 8)
        cutter.scale = (rx, ry, 0.0025)
        bpy.context.view_layer.objects.active = cutter
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        modifier = empty_plinth.modifiers.new(f"pressed_paw_{number}", "BOOLEAN")
        modifier.operation, modifier.object = "DIFFERENCE", cutter
        scene.apply_modifiers(empty_plinth)
        bpy.data.objects.remove(cutter, do_unlink=True)
    for number, (dx, dy) in enumerate(((-0.055, 0.025), (0.04, -0.04), (0.06, 0.012), (-0.03, -0.05), (0.025, 0.048))):
        dust = scene.sphere(f"absent_dust_{number}", 0.0022, (paw_x + dx, paw_y + dy, 1.001), porcelain, 8, 4)
        dust.scale.z = 0.35
        dust.parent = root
        static.append(dust)
    bake_lightmap(current, static, (room, porcelain))
    export_glb(output, [root])


def bake_lightmap(current, objects, bake_materials):
    if current.render.engine != "CYCLES":
        raise RuntimeError("Room lightmap baking requires Cycles; enable the Cycles add-on before building room")
    current.cycles.samples = 32
    current.view_settings.exposure = -1
    current.render.image_settings.file_format = "PNG"
    current.render.image_settings.color_mode = "RGB"
    current.render.image_settings.color_depth = "8"
    current.cycles.max_bounces = 6
    current.cycles.seed = 11
    current.cycles.use_denoising = True
    current.world = bpy.data.worlds.new("room_bake_world")
    current.world.use_nodes = True
    current.world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    current.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    light_data = bpy.data.lights.new("skylight_bake", "AREA")
    light_data.energy, light_data.shape, light_data.size, light_data.size_y = 2600, "RECTANGLE", 29, 1.1
    light = bpy.data.objects.new("skylight_bake", light_data)
    bpy.context.collection.objects.link(light)
    light.location = (0, 0, 4.18)
    point_at(light, (0, 0, 0))
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        if not obj.data.uv_layers:
            obj.data.uv_layers.new(name="UVMap")
        obj.data.uv_layers.new(name="Lightmap")
        obj.data.uv_layers.active_index = 1
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006)
    bpy.ops.object.mode_set(mode="OBJECT")
    # Reserve more atlas density for the nearby porcelain faces and pawprint;
    # the large, quiet room shell needs much less detail per square metre.
    for obj in objects:
        if any(material == bake_materials[1] for material in obj.data.materials):
            for loop in obj.data.uv_layers[1].data:
                loop.uv = loop.uv * 4
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=True, margin=0.006)
    bpy.ops.object.mode_set(mode="OBJECT")
    image = bpy.data.images.new("room_lightmap_linear", width=2048, height=2048, alpha=False, float_buffer=True)
    for material in bake_materials:
        nodes = material.node_tree.nodes
        for node in nodes:
            node.select = False
        texture = nodes.new("ShaderNodeTexImage")
        texture.name = "day_lightmap"
        texture.image = image
        texture.select = True
        nodes.active = texture
        # Local occlusion adds gentle skirting and plinth contact shadows to the bake.
        shader = nodes.get("Principled BSDF")
        ao = nodes.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = 0.25
        ao.samples = 4
        colour = nodes.new("ShaderNodeMixRGB")
        colour.blend_type = "MULTIPLY"
        colour.inputs[0].default_value = 1
        colour.inputs[1].default_value = shader.inputs["Base Color"].default_value[:]
        material.node_tree.links.new(ao.outputs["Color"], colour.inputs[2])
        material.node_tree.links.new(colour.outputs[0], shader.inputs["Base Color"])
    current.render.bake.margin = 12
    current.render.bake.use_clear = True
    # Bake one joined duplicate, not one full atlas per named object. Original
    # objects keep their names, topology and UVs for export after the proxy bake.
    bpy.ops.object.select_all(action="DESELECT")
    proxies = []
    dynamic = [obj for obj in current.objects if obj.type == "MESH" and obj not in objects]
    dynamic_visibility = {obj: obj.hide_render for obj in dynamic}
    for obj in dynamic:
        obj.hide_render = True
    for obj in objects:
        proxy = obj.copy()
        proxy.data = obj.data.copy()
        bpy.context.collection.objects.link(proxy)
        proxy.hide_render = False
        proxy.hide_set(False)
        obj.hide_render = True
        obj.hide_set(True)
        proxy.select_set(True)
        proxies.append(proxy)
    bpy.ops.object.select_all(action="DESELECT")
    for proxy in proxies:
        proxy.select_set(True)
    bpy.context.view_layer.objects.active = proxies[0]
    bpy.ops.object.join()
    proxy = bpy.context.object
    proxy.name = "room_bake_proxy"
    print("Baking single 2048px room proxy atlas (Cycles, 32 samples)", flush=True)
    try:
        bpy.ops.object.bake(type="COMBINED")
    finally:
        bpy.data.objects.remove(proxy, do_unlink=True)
        for obj in objects:
            obj.hide_render = False
            obj.hide_set(False)
        for obj, hidden in dynamic_visibility.items():
            obj.hide_render = hidden

    baked_path = ROOT / "out/room-lightmap.png"
    baked_path.parent.mkdir(parents=True, exist_ok=True)
    # Keep HDR irradiance until AgX/exposure is applied, then transport the
    # display-referred day result as an ordinary sRGB texture. Saving raw byte
    # bake pixels would clip lit porcelain to white and lose the contact shadows.
    image.save_render(str(baked_path), scene=current)
    display_image = bpy.data.images.load(str(baked_path), check_existing=False)
    display_image.name = "room_lightmap"
    display_image.colorspace_settings.name = "sRGB"
    # glTF transport: an emissive UV1 texture carries the combined day-light bake.
    # G-01 moves this to material.lightMap, sets colour white and clears emission.
    for material in bake_materials:
        nodes, links = material.node_tree.nodes, material.node_tree.links
        shader = nodes.get("Principled BSDF")
        for link in list(shader.inputs["Base Color"].links):
            links.remove(link)
        shader.inputs["Base Color"].default_value = (1, 1, 1, 1)
        shader.inputs["Emission Color"].default_value = (1, 1, 1, 1)
        shader.inputs["Emission Strength"].default_value = 1
        uv = nodes.new("ShaderNodeUVMap")
        uv.uv_map = "Lightmap"
        texture = nodes.get("day_lightmap")
        texture.image = display_image
        links.new(uv.outputs["UV"], texture.inputs["Vector"])
        links.new(texture.outputs["Color"], shader.inputs["Emission Color"])
        material["baked_lightmap"] = True
        material["baked_uv"] = 1
        material["baked_transport"] = "emissive"
    print("Baked one 2048px UV1 day lightmap with skylight/bounce/AO", flush=True)
