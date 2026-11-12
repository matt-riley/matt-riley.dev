"""B-06: one ceramic kitten, four static poses. Blender Z-up; front is -Y."""

import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

from lib import materials, scene
from lib.export import export_glb

POSES = ("sit", "loaf", "stretch", "sleep")


def ellipsoid(name, location, radii, parts):
    obj = scene.sphere(name, 1, location, None, 20, 12)
    obj.scale = radii
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    parts.append(obj)
    return obj


def tube(name, points, radius, parts):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 8
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    curve.use_fill_caps = True
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, location in zip(spline.bezier_points, points):
        point.co = location
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    parts.append(bpy.context.object)
    return bpy.context.object


def ear(name, centre, outward, parts):
    w, t, h = 0.030, 0.022, 0.029
    vertices = [(-w/2, -t/2, 0), (w/2, -t/2, 0), (outward, -t/2, h),
                (-w/2, t/2, 0), (w/2, t/2, 0), (outward, t/2, h)]
    faces = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (0, 2, 5, 3), (1, 4, 5, 2)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = centre
    parts.append(obj)
    return obj


def head(parts, centre, angle=0, tilt=0):
    """The same oversized head, muzzle and small ears identify every pose."""
    start = len(parts)
    x, y, z = centre
    ellipsoid("head", centre, (0.045, 0.039, 0.042), parts)
    for sign in (-1, 1):
        ellipsoid("muzzle", (x + sign * 0.012, y - 0.033, z - 0.014), (0.015, 0.010, 0.011), parts)
        ear("ear", (x + sign * 0.027, y + 0.002, z + 0.026), sign * 0.003, parts)
    ellipsoid("nose", (x, y - 0.043, z - 0.008), (0.005, 0.004, 0.0035), parts)
    turn = Matrix.Rotation(math.radians(angle), 4, "Z") @ Matrix.Rotation(math.radians(tilt), 4, "X")
    origin = Vector(centre)
    for obj in parts[start:]:
        obj.location = origin + turn @ (obj.location - origin)
        obj.rotation_euler = turn.to_euler()
    return origin, turn


def sculpt(pose):
    parts = []
    if pose == "sit":
        ellipsoid("body", (0, 0.012, 0.083), (0.051, 0.046, 0.074), parts)
        ellipsoid("chest", (0, -0.004, 0.123), (0.036, 0.034, 0.055), parts)
        for sign in (-1, 1):
            ellipsoid("haunch", (sign * 0.034, 0.022, 0.039), (0.029, 0.035, 0.035), parts)
            ellipsoid("front_leg", (sign * 0.018, -0.022, 0.051), (0.013, 0.016, 0.044), parts)
            ellipsoid("front_paw", (sign * 0.019, -0.038, 0.015), (0.016, 0.025, 0.015), parts)
        face = head(parts, (0, -0.017, 0.164), 12)
        tube("wrapped_tail", [(0.020, 0.048, 0.032), (0.060, 0.036, 0.022), (0.068, -0.019, 0.017), (0.035, -0.055, 0.014), (-0.014, -0.056, 0.014)], 0.009, parts)
    elif pose == "loaf":
        ellipsoid("loaf_body", (0, 0.012, 0.055), (0.059, 0.081, 0.051), parts)
        for sign in (-1, 1):
            ellipsoid("tucked_paw", (sign * 0.018, -0.031, 0.017), (0.015, 0.021, 0.013), parts)
        face = head(parts, (0, -0.057, 0.084))
        tube("tucked_tail", [(0.027, 0.076, 0.036), (0.060, 0.058, 0.025), (0.065, 0.006, 0.020), (0.052, -0.035, 0.018)], 0.009, parts)
    elif pose == "stretch":
        ellipsoid("hips", (0, 0.056, 0.104), (0.045, 0.044, 0.042), parts)
        torso = ellipsoid("sloping_back", (0, 0.005, 0.074), (0.037, 0.067, 0.031), parts)
        torso.rotation_euler.x = math.radians(29)
        ellipsoid("lower_chest", (0, -0.045, 0.041), (0.035, 0.034, 0.026), parts)
        for sign in (-1, 1):
            ellipsoid("hind_leg", (sign * 0.027, 0.059, 0.052), (0.016, 0.020, 0.049), parts)
            ellipsoid("hind_paw", (sign * 0.029, 0.078, 0.017), (0.017, 0.028, 0.017), parts)
            ellipsoid("reaching_paw", (sign * 0.025, -0.108, 0.012), (0.016, 0.037, 0.012), parts)
        face = head(parts, (0, -0.077, 0.044))
        tube("raised_tail", [(0, 0.082, 0.115), (0.003, 0.108, 0.149), (0.013, 0.098, 0.178), (0.019, 0.076, 0.171)], 0.008, parts)
    else:
        bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=12, location=(0, 0.006, 0.041), major_radius=0.050, minor_radius=0.034)
        parts.append(bpy.context.object)
        face = head(parts, (0.050, -0.025, 0.047), -70, 35)
        for sign in (-1, 1):
            ellipsoid("sleeping_paw", (0.022 + sign * 0.014, -0.063, 0.022), (0.020, 0.027, 0.016), parts)
        points = [(0.080 * math.cos(t), 0.006 + 0.080 * math.sin(t), 0.031) for t in [0.35, 0.95, 1.6, 2.3, 3.0, 3.7, 4.3]]
        tube("curled_tail", points, 0.010, parts)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    remesh = obj.modifiers.new("fused_ceramic", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = 0.0025
    remesh.use_smooth_shade = True
    scene.apply_modifiers(obj)
    smoothing = obj.modifiers.new("soft_ceramic", "SMOOTH")
    smoothing.factor = 0.8
    smoothing.iterations = 3
    scene.apply_modifiers(obj)

    # Shallow pressed eyes: actual indentations, rather than painted pupils.
    origin, turn = face
    for sign in (-1, 1):
        cutters = []
        if pose == "sleep":
            points = [origin + turn @ Vector((sign * 0.017 + t, -0.037, 0.002 - 0.0015 * (t / 0.005)**2)) for t in (-0.005, 0, 0.005)]
            cutter = tube("closed_eye_cutter", points, 0.0018, cutters)
        else:
            cutter = ellipsoid("eye_cutter", origin + turn @ Vector((sign * 0.017, -0.037, 0.003)), (0.0036, 0.0036, 0.0036), cutters)
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new("pressed_eye", "BOOLEAN")
        modifier.operation = "DIFFERENCE"
        modifier.object = cutter
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(cutter, do_unlink=True)

    obj.data.calc_loop_triangles()
    reduction = obj.modifiers.new("figurine_budget", "DECIMATE")
    reduction.ratio = min(1, 2600 / max(1, len(obj.data.loop_triangles)))
    scene.apply_modifiers(obj)
    obj.data.calc_loop_triangles()
    if len(obj.data.loop_triangles) > 2990:
        reduction = obj.modifiers.new("final_budget", "DECIMATE")
        reduction.ratio = 2850 / len(obj.data.loop_triangles)
        scene.apply_modifiers(obj)
    scene.smooth(obj)
    return obj


def stripes(obj, pose, glaze, dark):
    """Project four narrow glazed ribbons onto the final rounded surface."""
    obj.data.materials.clear()
    obj.data.materials.append(glaze)
    bpy.context.view_layer.update()
    ribbons = []
    if pose == "sit":
        paths = [[((x, 0.3, z - 0.003), (x, 0.3, z + 0.003)) for x in [(-0.052 + i * 0.0052) for i in range(21)]] for z in (0.065, 0.090, 0.115, 0.140)]
        direction = Vector((0, -1, 0))
    elif pose == "sleep":
        paths = [[((r * math.cos(angle - 0.04), 0.006 + r * math.sin(angle - 0.04), 0.3), (r * math.cos(angle + 0.04), 0.006 + r * math.sin(angle + 0.04), 0.3)) for r in [0.025 + i * 0.006 for i in range(11)]] for angle in (0.20, 0.95, 1.70, 2.45)]
        direction = Vector((0, 0, -1))
    else:
        paths = [[((x, y - 0.003, 0.3), (x, y + 0.003, 0.3)) for x in [(-0.052 + i * 0.0052) for i in range(21)]] for y in (-0.012, 0.014, 0.040, 0.066)]
        direction = Vector((0, 0, -1))
    for index, path in enumerate(paths):
        vertices, faces, previous = [], [], None
        for endpoints in path:
            samples = [obj.ray_cast(Vector(point), direction) for point in endpoints]
            if not all(sample[0] for sample in samples):
                previous = None
                continue
            first = len(vertices)
            vertices.extend(tuple(location + normal * 0.00015) for _, location, normal, _ in samples)
            if previous is not None:
                faces.append((previous, previous + 1, first + 1, first))
            previous = first
        if not faces:
            continue
        mesh = bpy.data.meshes.new(f"tabby_stripe_{index}")
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(dark)
        mesh.update()
        ribbon = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.collection.objects.link(ribbon)
        scene.smooth(ribbon)
        ribbons.append(ribbon)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    for ribbon in ribbons:
        ribbon.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()


def create_poses():
    scene.reset()
    glaze = materials.glaze()
    dark = glaze.copy()
    dark.name = "glaze_dark"
    dark.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = materials._linear("#C95F12")
    dark.diffuse_color = materials._linear("#C95F12")
    root = scene.empty("exhibit_cat")
    poses = {}
    for pose in POSES:
        obj = sculpt(pose)
        stripes(obj, pose, glaze, dark)
        positions = [vertex.co for vertex in obj.data.vertices]
        centre_x = (min(p.x for p in positions) + max(p.x for p in positions)) / 2
        centre_y = (min(p.y for p in positions) + max(p.y for p in positions)) / 2
        floor = min(p.z for p in positions)
        extent = max(max(p[i] for p in positions) - min(p[i] for p in positions) for i in range(3))
        scale = 0.22 / extent
        for vertex in obj.data.vertices:
            vertex.co = (vertex.co - Vector((centre_x, centre_y, floor))) * scale
        obj.data.update()
        # Named empty preserves the base pivot when meshopt recentres geometry.
        pivot = scene.empty(f"cat_{pose}", pose=pose)
        pivot.parent = root
        obj.name = f"geometry_cat_{pose}"
        obj.data.name = obj.name
        obj.parent = pivot
        obj.data.calc_loop_triangles()
        triangles = len(obj.data.loop_triangles)
        if triangles >= 3000:
            raise ValueError(f"cat_{pose}: {triangles} triangles exceeds pose budget")
        print(f"cat_{pose}: {triangles} triangles", flush=True)
        poses[pose] = pivot
    return root, poses


def build(output_path):
    root, _ = create_poses()
    export_glb(Path(output_path), [root])
