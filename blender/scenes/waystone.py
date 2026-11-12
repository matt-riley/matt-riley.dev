"""An uneven standing stone with an original ring-and-arrow inlaid waymark."""
import math
import bpy
from lib import materials, scene
from lib.export import export_glb
from lib.objects import ball, box, mesh, part, pipe


def create():
    root = scene.empty("exhibit_waystone")
    porcelain, glaze = materials.porcelain(), materials.glaze()
    box("stone_base", (.35,.23,.018), (0,0,.009), porcelain, root, .005)
    vertices = [(-.105,-.065,.018),(.10,-.065,.018),(.11,.065,.018),(-.09,.07,.018),(-.076,-.065,.355),(.06,-.065,.40),(.077,.035,.375),(-.065,.055,.37)]
    stone = mesh("standing_stone", vertices, [(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)], porcelain, root, .004)
    # Carve a manifold circular recess before adding the connected arrow inlay.
    ring = [(.044*math.sin(i*math.tau/24),-.065,.246+.044*math.cos(i*math.tau/24)) for i in range(24)]
    cutter = pipe("temporary_ring_cutter", ring, .004, porcelain, root, cyclic=True)
    scene.apply_modifiers(stone)
    boolean = stone.modifiers.new("carved_waymark_ring", "BOOLEAN")
    boolean.operation = "DIFFERENCE"
    boolean.solver = "EXACT"
    boolean.object = cutter
    bpy.context.view_layer.objects.active = stone
    bpy.ops.object.modifier_apply(modifier=boolean.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    pipe("glazed_waymark_ring", ring, .003, glaze, root, cyclic=True)
    # The stem meets the ring at its lower point; the arrow head is one bent ribbon.
    pipe("glazed_waymark_arrow", [(0,-.067,.18),(0,-.067,.274),(-.019,-.067,.255),(0,-.067,.274),(.019,-.067,.255)], .003, glaze, root)
    marker = part("touch_marker", root, (.132,-.025,.021), axis="y", kind="slide", limits=(0,.04))
    ball("cairn_pebble", .022, (.132,-.025,.021), porcelain, marker, (1,.8,.65))
    return root


def build(output):
    scene.reset()
    export_glb(output, [create()])
