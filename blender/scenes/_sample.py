"""A small material and export contract fixture; not a museum exhibit."""

from lib import materials, scene
from lib.export import export_glb


def build(output):
    scene.reset()
    # Blender Z-up becomes glTF Y-up: root at the centre of the base, Y=0.
    root = scene.empty("exhibit__sample")
    body = scene.cube("sample_body", (0.28, 0.28, 0.28), (0, 0, 0.14), materials.porcelain())
    knob = scene.sphere("touch_sample", 0.07, (0, 0, 0.35), materials.glaze())
    knob["axis"] = "y"
    knob["kind"] = "hinge"
    knob["range"] = [0, 0.3]
    body.parent = root
    knob.parent = root
    export_glb(output, [root])
