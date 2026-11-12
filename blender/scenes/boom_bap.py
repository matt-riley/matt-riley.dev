"""An original portrait-format pad instrument, without borrowed brand geometry."""
from lib import materials, scene
from lib.export import export_glb
from lib.objects import ball, box, cylinder, extrude, part

MODEL_ID = "boom-bap"


def create(still=False):
    porcelain, glaze = materials.porcelain(still=still), materials.glaze()
    root = scene.empty("exhibit_boom-bap")
    # A portrait slab with unequal chamfers and a clipped rear-right corner.
    outline = [(-0.117, -0.17), (0.117, -0.17), (0.138, -0.145),
               (0.138, 0.115), (0.092, 0.17), (-0.11, 0.17), (-0.138, 0.143), (-0.138, -0.141)]
    extrude("porcelain_chassis", outline, 0.012, 0.043, porcelain, root)
    for x in (-0.10, 0.10):
        for y in (-0.132, 0.13):
            ball(f"foot_{x}_{y}", 0.012, (x, y, 0.0096), porcelain, root, (1, 1, 0.8))
    # One connected orange inlay beneath independently moving orange pad tops.
    box("connected_glaze_inlay", (0.232, 0.232, 0.004), (0, -0.031, 0.057), glaze, root, 0.006)
    for row in range(4):
        for column in range(4):
            index = row * 4 + column
            x, y = (column - 1.5) * 0.054, -0.031 + (row - 1.5) * 0.054
            pivot = part(f"touch_pad_{index}", root, (x, y, 0.061), axis="y", kind="slide", limits=(-0.003, 0))
            box(f"pad_{index}", (0.045, 0.045, 0.009), (x, y, 0.0635), glaze, pivot, 0.003)
    # Two deliberately diagonal, unequal dials; no screen, faders or transport row.
    cylinder("large_dial", 0.021, 0.022, (-0.066, 0.12, 0.065), porcelain, root, 32)
    cylinder("small_dial", 0.014, 0.018, (0.053, 0.14, 0.064), porcelain, root, 28)
    return root


def build(output_path):
    scene.reset()
    export_glb(output_path, [create()])
