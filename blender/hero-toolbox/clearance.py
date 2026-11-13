"""Exact triangle crossings for authored, sequenced mechanism poses before packing.
Intentional bolted joints within rigid assemblies are excluded; shells, moving trays,
link rods, brackets, latch and handle are checked against obstructing solid walls.
"""
import json
import bpy
from mathutils.bvhtree import BVHTree
from mathutils.geometry import intersect_ray_tri


def check_clearance(root, parts, pose, output):
    meshes = [obj for obj in root.children_recursive if obj.type == "MESH"]
    lookup = {obj.name: obj for obj in meshes}
    topology = {}
    for obj in meshes:
        obj.data.calc_loop_triangles()
        topology[obj.name] = [tuple(tri.vertices) for tri in obj.data.loop_triangles]

    def assembly(name):
        owner = bpy.data.objects[name]
        return [obj for obj in owner.children_recursive if obj.type == "MESH"]

    lower, upper = assembly("front_tray_carrier"), assembly("upper_tray_carrier")
    pairs = []
    body, lid = lookup["rounded_body"], lookup["rounded_lid"]
    for obj in lower + upper + [lid, lookup["clasp_tongue"]]:
        pairs.append((body, obj))
    for obj in meshes:
        if "_arm_" in obj.name:
            pairs.append((body, obj))
    for obj in lower + upper + [lookup["orange_carrying_bail"]]:
        pairs.append((lid, obj))
    pairs.extend((a, b) for a in lower for b in upper)
    windows = {"clasp": (0, .18), "lid": (.10, .68), "tray": (.38, 1)}
    failures, bounds, minimum_stack_gap = [], [], float("inf")

    def crosses(triangle, other):
        for i in range(3):
            start, end = triangle[i], triangle[(i+1)%3]
            direction = end-start
            length = direction.length
            if length < 1e-9:
                continue
            hit = intersect_ray_tri(*other, direction.normalized(), start, True)
            if hit is not None and 1e-6 < (hit-start).length < length-1e-6:
                return True
        return False

    for step in range(101):
        progress = step/100
        for name, part in parts.items():
            start, end = windows[part["phase"]]
            fraction = min(1, max(0, (progress-start)/(end-start)))
            bpy.data.objects[name].rotation_euler.x = part["base"]+part["delta"]*fraction
        bpy.context.view_layer.update()
        cache = {}
        def collider(obj):
            if obj.name not in cache:
                vertices = [obj.matrix_world @ v.co for v in obj.data.vertices]
                triangles = topology[obj.name]
                cache[obj.name] = (vertices, triangles, BVHTree.FromPolygons(vertices, triangles, all_triangles=True))
            return cache[obj.name]
        for a, b in pairs:
            av, at, ab = collider(a)
            bv, bt, bb = collider(b)
            for ai, bi in ab.overlap(bb):
                ta = [av[index] for index in at[ai]]
                tb = [bv[index] for index in bt[bi]]
                if crosses(ta, tb) or crosses(tb, ta):
                    failures.append({"progress": progress, "a": a.name, "b": b.name})
                    break
        low_vertices = collider(lookup["front_ceramic_tray"])[0]
        high_vertices = collider(lookup["upper_ceramic_tray"])[0]
        minimum_stack_gap = min(minimum_stack_gap, min(v.z for v in high_vertices)-max(v.z for v in low_vertices))
        if step % 10 == 0:
            all_vertices = [v for obj in meshes for v in collider(obj)[0]]
            bounds.append({"progress": progress, "min": [min(v[i] for v in all_vertices) for i in range(3)], "max": [max(v[i] for v in all_vertices) for i in range(3)]})
        if step % 20 == 0:
            print(f"CLEARANCE {step}/100: {len(failures)} crossing pairs", flush=True)
    report = {"fractions": 101, "pairChecksPerFraction": len(pairs), "sequenceWindows": windows, "parts": parts, "minimumTrayShellGapMetres": minimum_stack_gap, "triangleCrossings": failures, "sampledBoundsBlender": bounds, "limits": "Checks segment/triangle surface crossings; intentional joints and within-assembly contacts excluded. Coplanar tangencies are not reported."}
    output.write_text(json.dumps(report, indent=2)+"\n")
    pose(0)
    if failures:
        raise RuntimeError(f"Mechanism preflight found {len(failures)} triangle crossing pairs; see {output}")
    if minimum_stack_gap < .001:
        raise RuntimeError(f"Tray clearance below 1mm: {minimum_stack_gap}")
