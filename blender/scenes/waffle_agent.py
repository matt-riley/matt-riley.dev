"""A waffle on a plain plate: thirty-six pockets, one connected syrup pool."""
import math
from lib import materials, scene
from lib.export import export_glb
from lib.objects import box, cylinder, extrude, part

MODEL_ID = "waffle-agent"


def create():
    root = scene.empty("exhibit_waffle-agent")
    porcelain, glaze = materials.porcelain(), materials.glaze()
    cylinder("plain_plate", .225, .012, (0,0,.006), porcelain, root, 64)
    cylinder("waffle_base", .185, .018, (0,0,.024), porcelain, root, 64)
    for n in range(-3, 4):
        position = n * .048
        chord = 2 * math.sqrt(.18 ** 2 - position ** 2)
        box(f"waffle_rib_x_{n}", (chord,.011,.018), (0,position,.041), porcelain, root, .003)
        box(f"waffle_rib_y_{n}", (.011,chord,.018), (position,0,.041), porcelain, root, .003)
    outline = [(-.043,-.045),(.042,-.045),(.047,-.010),(.082,-.008),(.087,.045),(.155,.051),(.181,.064),(.176,.085),(.09,.075),(.054,.045),(-.040,.042),(-.051,.005)]
    extrude("glazed_syrup", outline, .034, .007, glaze, root)
    cursor = part("touch_cursor", root, (-.072,-.072,.034), axis="y", kind="slide", limits=(0,.012))
    box("cursor_block", (.008,.028,.017), (-.072,-.072,.0415), porcelain, cursor)
    return root


def build(output):
    scene.reset()
    export_glb(output, [create()])
