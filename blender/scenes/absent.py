"""Six curved vase fragments on the floor; B-03 owns the empty plinth/pawprint."""
import math
import bpy
from lib import materials, scene
from lib.export import export_glb
from lib.objects import mesh

MODEL_ID = "absent"


def create(still=False):
    porcelain, glaze = materials.porcelain(still=still), materials.glaze()
    root = scene.empty("exhibit_absent")
    arrangements = [(-0.14, -0.09, 0.2, 0.28), (-0.035, -0.12, -0.4, -0.35),
                    (0.10, -0.09, 0.7, 0.2), (-0.105, 0.055, -1.1, 0.4),
                    (0.03, 0.065, 1.3, -0.2), (0.145, 0.065, 2.2, 0.3)]
    for index, (x, y, yaw, tilt) in enumerate(arrangements):
        columns, rows = 8, 3
        width = 0.83 + index * 0.045
        height = 0.041 + (index % 3) * 0.009
        vertices = []
        for inside in (False, True):
            for row in range(rows + 1):
                radius = 0.067 + 0.01 * math.cos(row * math.pi / rows) - (0.006 if inside else 0)
                for column in range(columns + 1):
                    angle = (column / columns - 0.5) * width + 0.04 * math.sin(row + index)
                    z = height * (row / rows - 0.5)
                    if row in (0, rows):
                        z += 0.004 * math.sin(column * 1.7 + index)
                    vertices.append((radius * math.sin(angle), radius * math.cos(angle) - 0.067, z))
        surface_count = (columns + 1) * (rows + 1)
        faces, inner_faces = [], []
        for layer in (0, 1):
            for row in range(rows):
                for column in range(columns):
                    a = layer * surface_count + row * (columns + 1) + column
                    face = (a, a + 1, a + columns + 2, a + columns + 1)
                    faces.append(tuple(reversed(face)) if layer == 0 else face)
                    inner_faces.append(layer == 1)
        # Close the four broken edges with porcelain, retaining the orange inner face.
        perimeter = list(range(columns + 1)) + [r * (columns + 1) + columns for r in range(1, rows + 1)]
        perimeter += [rows * (columns + 1) + c for c in range(columns - 1, -1, -1)]
        perimeter += [r * (columns + 1) for r in range(rows - 1, 0, -1)]
        for a, b in zip(perimeter, perimeter[1:] + perimeter[:1]):
            faces.append((a, b, b + surface_count, a + surface_count))
            inner_faces.append(False)
        obj = mesh(f"curved_vase_shard_{index}", vertices, faces, porcelain, root, bevel=0.002)
        obj.data.materials.append(glaze)
        for polygon, inside in zip(obj.data.polygons, inner_faces):
            polygon.material_index = 1 if inside else 0
            polygon.use_smooth = True
        obj.rotation_euler = ((-math.pi / 2 if index % 2 == 0 else math.pi / 2) + tilt, 0.12 * (index % 2), yaw)
        obj.location.x, obj.location.y = x, y
        bpy.context.view_layer.update()
        bottom = min((obj.matrix_world @ mathutils_vector(corner)).z for corner in obj.bound_box)
        obj.location.z -= bottom
    return root


def mathutils_vector(value):
    from mathutils import Vector
    return Vector(value)


def build(output_path):
    scene.reset()
    export_glb(output_path, [create()])
