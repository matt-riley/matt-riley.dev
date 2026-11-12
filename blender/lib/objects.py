"""Metre-scale porcelain primitives; author Z-up, export glTF Y-up."""
import bpy
from lib import scene


def parent(obj, owner):
    bpy.context.view_layer.update()
    matrix = obj.matrix_world.copy()
    obj.parent = owner
    obj.matrix_world = matrix
    return obj


def part(name, owner, location=(0, 0, 0), axis="x", kind="hinge", limits=(0, 0.5)):
    return parent(scene.empty(name, location, axis=axis, kind=kind, range=list(limits)), owner)


def box(name, size, location, material, owner, bevel=0.002):
    return parent(scene.cube(name, size, location, material, bevel), owner)


def ball(name, radius, location, material, owner, scale=(1, 1, 1)):
    obj = scene.sphere(name, radius, location, material, 16, 8)
    obj.scale = scale
    return parent(obj, owner)


def pipe(name, points, radius, material, owner, cyclic=False):
    bpy.ops.object.select_all(action="DESELECT")
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    curve.use_fill_caps = True
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, value in zip(spline.points, points):
        point.co = (*value, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return parent(obj, owner)


def rod(name, start, end, radius, material, owner):
    return pipe(name, [start, end], radius, material, owner)


def cylinder(name, radius, depth, location, material, owner, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    obj.data.materials.append(material)
    scene.bevel(obj, 0.002, 2)
    return parent(scene.smooth(obj), owner)


def tray(name, centre, width, depth, height, material, owner):
    x, y, z = centre
    thickness = 0.008
    box(f"{name}_floor", (width, depth, thickness), (x, y, z), material, owner)
    for sign in (-1, 1):
        box(f"{name}_end_{sign}", (thickness, depth, height), (x + sign * (width - thickness) / 2, y, z + height / 2), material, owner)
        box(f"{name}_side_{sign}", (width - 2 * thickness, thickness, height), (x, y + sign * (depth - thickness) / 2, z + height / 2), material, owner)


def mesh(name, vertices, faces, material, owner, bevel=0.002):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(material)
    if bevel:
        scene.bevel(obj, bevel, 2)
    return parent(obj, owner)


def extrude(name, outline, z, depth, material, owner):
    n = len(outline)
    vertices = [(x, y, height) for height in (z, z + depth) for x, y in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return mesh(name, vertices, faces, material, owner)
