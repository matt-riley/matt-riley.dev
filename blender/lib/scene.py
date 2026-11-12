"""Small Blender helpers. Author Z-up in metres; glTF export converts to Y-up."""

import bpy


def reset():
    """Start each independently exported scene with no objects or materials."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    try:
        import addon_utils
        addon_utils.enable("cycles")
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        print("Renderer: Cycles (CPU)")
    except Exception as error:
        scene.render.engine = "BLENDER_EEVEE"
        print(f"Renderer: EEVEE fallback; Cycles unavailable: {error}")
    return scene


def empty(name, location=(0, 0, 0), **properties):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    for key, value in properties.items():
        obj[key] = value
    return obj


def bevel(obj, width=0.005, segments=3):
    modifier = obj.modifiers.new("soft_edges", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    return obj


def subdivide(obj, levels=1):
    modifier = obj.modifiers.new("subdivision", "SUBSURF")
    modifier.levels = levels
    modifier.render_levels = levels
    return obj


def smooth(obj):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def apply_modifiers(obj):
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def cube(name, dimensions, location=(0, 0, 0), material=None, bevel_width=0.005):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    if bevel_width:
        bevel(obj, bevel_width)
    return obj


def sphere(name, radius, location=(0, 0, 0), material=None, segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=radius, location=location
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    if material:
        obj.data.materials.append(material)
    return smooth(obj)
