"""A two-drawer library cabinet, twelve porcelain cards and one glazed holder."""
from lib import materials, scene
from lib.export import export_glb
from lib.objects import box, parent, part, pipe, tray

MODEL_ID = "agent-skills"


def create():
    root = scene.empty("exhibit_agent-skills")
    porcelain, glaze = materials.porcelain(), materials.glaze()
    for side in (-1,1):
        box(f"cabinet_side_{side}", (.012,.22,.30), (side*.154,0,.15), porcelain, root)
    for z in (.006,.146,.294):
        box(f"cabinet_shelf_{z}", (.30,.22,.012), (0,0,z), porcelain, root)
    box("cabinet_back", (.30,.012,.30), (0,.104,.15), porcelain, root)
    box("lower_drawer_face", (.29,.012,.126), (0,-.112,.076), porcelain, root)
    pipe("lower_porcelain_pull", [(-.035,-.12,.076),(-.035,-.14,.076),(.035,-.14,.076),(.035,-.12,.076)], .004, porcelain, root)
    drawer = part("touch_drawer", root, (0,-.17,.175), axis="z", kind="slide", limits=(0,.075))
    tray("upper_drawer", (0,-.085,.16), .284,.21,.075,porcelain,drawer)
    box("upper_drawer_face", (.292,.012,.108), (0,-.196,.205), porcelain, drawer)
    pipe("glazed_label_holder", [(-.047,-.205,.19),(.047,-.205,.19),(.047,-.205,.224),(-.047,-.205,.224)], .003, glaze, drawer, cyclic=True)
    for i in range(12):
        y = -.155 + i*.014
        if i < 8:
            hinge = part(f"touch_card_{i}", drawer, (0,y,.172), axis="x", limits=(0,-.55))
        else:
            hinge = parent(scene.empty(f"card_hinge_{i}", (0,y,.172)), drawer)
        box(f"index_card_{i}", (.242,.0045,.076 + (i%3)*.001), (0,y,.21), porcelain, hinge)
    return root


def build(output):
    scene.reset()
    export_glb(output, [create()])
