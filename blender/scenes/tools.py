"""The approved cantilever toolbox, with three independently authored pivots."""
from lib import materials, scene
from lib.export import export_glb
from lib.objects import box, part, pipe, rod, tray


def create():
    root = scene.empty("exhibit_tools")
    porcelain, glaze = materials.porcelain(), materials.glaze()
    tray("toolbox", (0, 0, 0.004), 0.34, 0.18, 0.13, porcelain, root)
    for side, label in [(-1, "left"), (1, "right")]:
        pivot = part(f"touch_tray_{label}", root, (0, side * 0.07, 0.10), axis="x", limits=(0, side * 0.35))
        tray(f"tray_{label}", (0, side * 0.135, 0.205), 0.32, 0.095, 0.048, porcelain, pivot)
        for x in (-0.151, 0.151):
            for height in (0.09, 0.13):
                rod(f"arm_{label}_{x}_{height}", (x, side * 0.067, height), (x, side * 0.147, height + 0.112), 0.0034, porcelain, pivot)
        for x in (-0.07, 0.065):
            box(f"divider_{label}_{x}", (0.008, 0.087, 0.035), (x, side * 0.135, 0.224), porcelain, pivot)
    drawer = part("touch_drawer", root, (0, -0.095, 0.047), axis="z", kind="slide", limits=(0, 0.075))
    box("drawer_face", (0.245, 0.012, 0.041), (0, -0.096, 0.047), porcelain, drawer)
    pipe("glazed_handle", [(-0.031, -0.104, 0.047), (-0.031, -0.125, 0.047), (0.031, -0.125, 0.047), (0.031, -0.104, 0.047)], 0.0043, glaze, drawer)
    pipe("carrying_handle", [(-0.146, 0, 0.12), (-0.146, 0, 0.335), (0.146, 0, 0.335), (0.146, 0, 0.12)], 0.006, porcelain, root)
    return root


def build(output):
    scene.reset()
    export_glb(output, [create()])
