"""A sloped switch panel: three porcelain toggles, three small glazed flags."""
from lib import materials, scene
from lib.export import export_glb
from lib.objects import box, mesh, part, rod


def create():
    root = scene.empty("exhibit_flagz")
    porcelain, glaze = materials.porcelain(), materials.glaze()
    vertices = [(-.20,-.13,0),(.20,-.13,0),(.20,.13,0),(-.20,.13,0),(-.20,-.13,.055),(.20,-.13,.055),(.20,.13,.13),(-.20,.13,.13)]
    mesh("sloped_panel", vertices, [(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)], porcelain, root, .006)
    for index, key in enumerate(("lights", "cat", "sound")):
        x = (index - 1) * .125
        box(f"switch_socket_{key}", (.048,.042,.008), (x,-.055,.082), porcelain, root)
        toggle = part(f"touch_switch_{key}", root, (x,-.055,.088), axis="x", limits=(-.35,.35))
        rod(f"toggle_{key}", (x,-.055,.088), (x,-.075,.14), .009, porcelain, toggle)
        box(f"toggle_grip_{key}", (.032,.021,.018), (x,-.075,.14), porcelain, toggle, .005)
        flag = part(f"touch_flag_{key}", root, (x,.065,.12), axis="x", limits=(-.65,0))
        rod(f"pin_{key}", (x,.065,.12), (x,.065,.285), .0045, porcelain, flag)
        mesh(f"glazed_flag_{key}", [(x,.06,.275),(x+.067,.06,.265),(x+.06,.06,.225),(x,.06,.231),(x,.068,.275),(x+.067,.068,.265),(x+.06,.068,.225),(x,.068,.231)], [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], glaze, flag)
    return root


def build(output):
    scene.reset()
    export_glb(output, [create()])
