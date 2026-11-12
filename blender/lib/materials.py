"""The museum's shared materials. Colours are specified in sRGB."""

import bpy

# B-02: Matt approved P2/G2 in the Codex chat; decision recorded on the Notion task.
PORCELAIN_ROUGHNESS = 0.85
GLAZE_COLOUR = "#E8741A"


def _linear(hex_colour):
    channels = [int(hex_colour[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    return tuple(
        channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4
        for channel in channels
    ) + (1,)


def _material(name, colour, roughness):
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
        material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = _linear(colour)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = 0
    material.diffuse_color = _linear(colour)
    return material, shader


def porcelain(still=False):
    material, shader = _material("porcelain", "#F1EEE6", PORCELAIN_ROUGHNESS)
    shader.inputs["Subsurface Weight"].default_value = 0.025 if still else 0
    return material


def glaze():
    material, shader = _material("glaze", GLAZE_COLOUR, 0.15)
    shader.inputs["Coat Weight"].default_value = 1
    shader.inputs["Coat Roughness"].default_value = 0.1
    return material


def room():
    """Room surface for the later light-baked gallery scene (B-03)."""
    material, _ = _material("room", "#F4F1EA", 1)
    return material
