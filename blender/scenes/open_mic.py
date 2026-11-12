"""A small stage microphone; the only glazed part is the grille ball."""
import math
from lib import materials, scene
from lib.export import export_glb
from lib.objects import ball, cylinder, part, pipe, rod

MODEL_ID = "open-mic"


def create(still=False):
    porcelain, glaze = materials.porcelain(still=still), materials.glaze()
    root = scene.empty("exhibit_open-mic")
    cylinder("round_weighted_base", 0.084, 0.016, (0, 0, 0.008), porcelain, root, 40)
    cylinder("base_neck", 0.019, 0.025, (0, 0, 0.028), porcelain, root, 24)
    cylinder("upright", 0.0065, 0.355, (0, 0, 0.215), porcelain, root, 20)
    cylinder("height_collar", 0.012, 0.028, (0, 0, 0.272), porcelain, root, 24)
    ball("swivel_joint", 0.012, (0, 0, 0.403), porcelain, root)
    mic = part("touch_mic", root, (0, 0, 0.403), axis="x", kind="hinge", limits=(-0.14, 0.14))
    cylinder("microphone_body", 0.0115, 0.062, (0, 0, 0.437), porcelain, mic, 24)
    cylinder("grille_collar", 0.017, 0.012, (0, 0, 0.463), porcelain, mic, 24)
    ball("glazed_grille_ball", 0.031, (0, 0, 0.469), glaze, mic)
    # Fine circumferential ridges give the generic grille a readable silhouette.
    for row, z in enumerate((0.454, 0.469, 0.484)):
        radius = math.sqrt(0.031 ** 2 - (z - 0.469) ** 2)
        points = [(radius * math.cos(i * math.tau / 32), radius * math.sin(i * math.tau / 32), z) for i in range(32)]
        pipe(f"grille_ridge_{row}", points, 0.002, glaze, mic, cyclic=True)
    # The cable is a deliberate loose line, not a stock microphone's connector.
    cable = [(0, 0.014, 0.416), (0.007, 0.021, 0.29), (0.012, 0.015, 0.08),
             (0.013, 0.025, 0.003), (0.052, 0.045, 0.003), (0.102, 0.027, 0.003),
             (0.12, -0.023, 0.003), (0.087, -0.066, 0.003), (0.027, -0.087, 0.003),
             (-0.032, -0.109, 0.003), (-0.093, -0.093, 0.003)]
    pipe("trailing_cable", cable, 0.0025, porcelain, root)
    return root


def build(output_path):
    scene.reset()
    export_glb(output_path, [create()])
