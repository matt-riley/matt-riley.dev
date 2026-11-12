"""Three small link objects and a plain mug of tea, all authored for this museum."""
import math
from lib import materials, scene
from lib.export import export_glb
from lib.objects import box, cylinder, mesh, part, pipe, tray

MODEL_ID = "gift-shop"


def create(still=False):
    porcelain, glaze = materials.porcelain(still=still), materials.glaze()
    root = scene.empty("exhibit_gift-shop")
    work = part("touch_item_work", root, (-0.14, 0.045, 0), axis="y", kind="slide", limits=(0, 0.04))
    box("notebook_pages", (0.068, 0.052, 0.102), (-0.14, 0.045, 0.051), porcelain, work)
    box("notebook_cover_front", (0.076, 0.006, 0.11), (-0.14, 0.015, 0.055), porcelain, work)
    box("notebook_cover_back", (0.076, 0.006, 0.11), (-0.14, 0.075, 0.055), porcelain, work)
    box("notebook_spine", (0.008, 0.062, 0.11), (-0.174, 0.045, 0.055), porcelain, work)
    box("notebook_glazed_band", (0.078, 0.064, 0.004), (-0.14, 0.045, 0.073), glaze, work, 0.002)
    tools = part("touch_item_tools", root, (-0.025, 0.06, 0), axis="y", kind="slide", limits=(0, 0.04))
    tray("tiny_toolbox", (-0.025, 0.06, 0.005), 0.098, 0.065, 0.045, porcelain, tools)
    # The little open toolbox echoes the collection's first cantilever tool chest.
    for sign in (-1, 1):
        tray(f"tiny_tray_{sign}", (-0.025, 0.06 + sign * 0.044, 0.068), 0.089, 0.027, 0.018, porcelain, tools)
        pipe(f"tiny_arm_{sign}", [(-0.065, 0.06 + sign * 0.02, 0.032), (-0.065, 0.06 + sign * 0.043, 0.069)], 0.002, porcelain, tools)
    pipe("tiny_carrying_handle", [(-0.062, 0.06, 0.047), (-0.062, 0.06, 0.103), (0.012, 0.06, 0.103), (0.012, 0.06, 0.047)], 0.003, porcelain, tools)
    box("toolbox_glazed_band", (0.1, 0.067, 0.004), (-0.025, 0.06, 0.028), glaze, tools, 0.002)
    github = part("touch_item_github", root, (0.115, 0.065, 0), axis="y", kind="slide", limits=(0, 0.04))
    box("filing_box", (0.083, 0.073, 0.077), (0.115, 0.065, 0.0385), porcelain, github)
    box("filing_box_lid", (0.089, 0.079, 0.009), (0.115, 0.065, 0.081), porcelain, github)
    box("filing_box_slot", (0.033, 0.006, 0.009), (0.115, 0.025, 0.06), porcelain, github)
    box("filing_box_glazed_band", (0.085, 0.075, 0.004), (0.115, 0.065, 0.027), glaze, github, 0.002)
    # Hollow mug: a closed bottom and two rings of walls, with a separate tea surface.
    cx, cy, segments = 0.085, -0.105, 32
    vertices = []
    for radius, z in ((0.032, 0.004), (0.034, 0.082), (0.028, 0.082), (0.027, 0.011)):
        for i in range(segments):
            angle = i * math.tau / segments
            vertices.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle), z))
    faces = []
    for ring in range(3):
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((ring * segments + i, ring * segments + j, (ring + 1) * segments + j, (ring + 1) * segments + i))
    faces.append(tuple(reversed(range(segments))))
    faces.append(tuple(range(3 * segments, 4 * segments)))
    mug = mesh("plain_mug", vertices, faces, porcelain, root, bevel=0.002)
    scene.smooth(mug)
    handle = [(cx + 0.034 + 0.024 * math.sin(math.pi * i / 20), cy, 0.043 + 0.028 * math.cos(math.pi * i / 20)) for i in range(21)]
    pipe("mug_handle", handle, 0.004, porcelain, root)
    cylinder("glazed_tea_surface", 0.0275, 0.003, (cx, cy, 0.072), glaze, root, 32)
    return root


def build(output_path):
    scene.reset()
    export_glb(output_path, [create()])
