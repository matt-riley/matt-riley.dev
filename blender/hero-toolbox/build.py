"""One isolated ceramic toolbox hero. No museum scene or shared material changes.
Run: Blender --background --threads 4 --python-exit-code 1 --python this_file
"""
from pathlib import Path
import hashlib
import json
import math
import struct
import sys
import zlib

import bpy
import numpy as np
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "blender"))
from lib import scene
from lib.export import export_glb
from lib.objects import box, cylinder, pipe, mesh

OUT = ROOT / "blender/out/hero-toolbox"
TEXTURES = HERE / "textures"
PROOFS = HERE / "proofs"
for path in (OUT, TEXTURES, PROOFS):
    path.mkdir(parents=True, exist_ok=True)
POSES = {}
TILE = .10


def png(path, data):
    data = np.asarray(data, dtype=np.uint8)
    h, w, channels = data.shape
    def chunk(kind, content):
        return struct.pack(">I", len(content)) + kind + content + struct.pack(">I", zlib.crc32(kind + content) & 0xffffffff)
    rows = b"".join(b"\0" + row.tobytes() for row in data)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2 if channels == 3 else 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))


def texture_maps():
    rng = np.random.default_rng(118823)
    n = 512
    noise = rng.normal(0, 1, (n, n))
    broad = noise.copy()
    for _ in range(5):
        broad = (broad * 4 + np.roll(broad, 1, 0) + np.roll(broad, -1, 0) + np.roll(broad, 1, 1) + np.roll(broad, -1, 1)) / 8
    broad /= max(float(broad.std()), .001)
    flecks = np.zeros((n, n))
    pores = np.zeros((n, n))
    for _ in range(420):
        cx, cy = rng.integers(0, n, 2)
        radius = rng.uniform(.55, 1.65)
        strength = rng.uniform(.15, .65)
        for dy in range(-5, 6):
            for dx in range(-5, 6):
                weight = math.exp(-(dx * dx + dy * dy) / (2 * radius * radius))
                flecks[(cy + dy) % n, (cx + dx) % n] += strength * weight
                pores[(cy + dy) % n, (cx + dx) % n] -= .000025 * weight
    base = np.array([238, 230, 216], dtype=float)
    colour = np.clip(base + broad[..., None] * 1.15 + noise[..., None] * .35 - flecks[..., None] * np.array([82, 100, 109]), 0, 255)
    rough = np.clip(.46 + broad * .014 + flecks * .06, .36, .58)
    orm = np.stack((np.ones_like(rough), rough, np.zeros_like(rough)), axis=-1) * 255
    height = pores + broad * .000003
    du = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) / (2 * TILE / n)
    dv = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) / (2 * TILE / n)
    normals = np.stack((-du, -dv, np.ones_like(du)), axis=-1)
    normals /= np.linalg.norm(normals, axis=-1)[..., None]
    png(TEXTURES / "stoneware-colour.png", colour)
    png(TEXTURES / "stoneware-orm.png", orm)
    png(TEXTURES / "stoneware-normal.png", (normals * .5 + .5) * 255)


def linear(hexcolour):
    rgb = [int(hexcolour[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb) + (1,)


def material(name, colour, roughness):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = linear(colour)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = 0
    return m, p


def materials():
    body, p = material("hero_stoneware", "#EEE6D8", .46)
    p.inputs["Coat Weight"].default_value = .22
    p.inputs["Coat Roughness"].default_value = .24
    tree = body.node_tree
    images = {}
    for key, filename in (("colour", "stoneware-colour.png"), ("orm", "stoneware-orm.png"), ("normal", "stoneware-normal.png")):
        image = bpy.data.images.load(str(TEXTURES / filename), check_existing=False)
        image.colorspace_settings.name = "sRGB" if key == "colour" else "Non-Color"
        node = tree.nodes.new("ShaderNodeTexImage")
        node.name = f"Tiled {key}"
        node.image = image
        node.extension = "REPEAT"
        images[key] = node
    tree.links.new(images["colour"].outputs["Color"], p.inputs["Base Color"])
    separate = tree.nodes.new("ShaderNodeSeparateColor")
    tree.links.new(images["orm"].outputs["Color"], separate.inputs["Color"])
    tree.links.new(separate.outputs["Green"], p.inputs["Roughness"])
    tree.links.new(separate.outputs["Blue"], p.inputs["Metallic"])
    normal = tree.nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = .28
    tree.links.new(images["normal"].outputs["Color"], normal.inputs["Color"])
    tree.links.new(normal.outputs["Normal"], p.inputs["Normal"])
    orange, p = material("hero_orange_glaze", "#CC4A05", .14)
    p.inputs["Coat Weight"].default_value = 1
    p.inputs["Coat Roughness"].default_value = .10
    dark, p = material("hero_charcoal", "#242322", .43)
    p.inputs["Coat Weight"].default_value = .15
    return body, orange, dark


def local(obj, owner, location=(0, 0, 0), rotation=(0, 0, 0)):
    obj.parent = owner
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.location = location
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = rotation
    return obj


def empty(name, owner, location=(0, 0, 0), rotation=(0, 0, 0)):
    return local(scene.empty(name), owner, location, rotation)


def part(name, owner, location, base=0, delta=0, phase="tray"):
    obj = empty(name, owner, location, (base, 0, 0))
    obj["kind"], obj["axis"], obj["range"] = "hinge", "x", [0, delta]
    obj["phase"] = phase
    POSES[name] = {"base": base, "delta": delta, "phase": phase}
    return obj


def b(name, size, location, mat, owner, bevel=.002):
    return local(box(name, size, (0, 0, 0), mat, None, bevel), owner, location)


def tube(name, points, radius, mat, owner, cyclic=False):
    return local(pipe(name, points, radius, mat, None, cyclic), owner)


def disk(name, radius, depth, location, mat, owner):
    return local(cylinder(name, radius, depth, (0, 0, 0), mat, None, 16), owner, location, (0, math.pi / 2, 0))


def outline(width, depth, radius, cy=0, segments=6):
    points = []
    for cx, y, start in ((width / 2 - radius, depth / 2 - radius, 0), (-width / 2 + radius, depth / 2 - radius, 90), (-width / 2 + radius, -depth / 2 + radius, 180), (width / 2 - radius, -depth / 2 + radius, 270)):
        for i in range(segments + 1):
            angle = math.radians(start + i * 90 / segments)
            points.append((cx + radius * math.cos(angle), cy + y + radius * math.sin(angle)))
    return points


def shell(name, width, depth, height, owner, mat, radius=.022, thickness=.008):
    outer = outline(width, depth, radius)
    inner = outline(width - thickness * 2, depth - thickness * 2, max(radius - thickness, .004))
    n = len(outer)
    vertices = [(x, y, z) for points, z in ((outer, 0), (outer, height), (inner, height), (inner, thickness)) for x, y in points]
    faces = [tuple(reversed(range(n))), tuple(range(3*n, 4*n))]
    for i in range(n):
        j = (i + 1) % n
        faces.extend(((i, j, n+j, n+i), (n+i, n+j, 2*n+j, 2*n+i), (2*n+i, 2*n+j, 3*n+j, 3*n+i)))
    return local(mesh(name, vertices, faces, mat, None, .0016), owner)


def rounded_plate(name, width, depth, height, cy, owner, mat):
    points = outline(width, depth, .020, cy)
    n = len(points)
    vertices = [(x, y, z) for z in (0, height) for x, y in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    return local(mesh(name, vertices, faces, mat, None, .002), owner)


def tray(name, owner, mat):
    return shell(name, .416, .070, .028, owner, mat, .009, .005)


def create():
    root = scene.empty("hero_toolbox")
    root["asset_id"] = "immersive-toolbox"
    root["units"] = "metres; authored Z-up, exported glTF Y-up"
    body, orange, dark = materials()
    shell("rounded_body", .460, .230, .174, root, body)
    b("rear_top_rail", (.435, .050, .014), (0, .090, .181), body, root, .006)
    lid = part("touch_lid", root, (0, .070, .176), delta=-math.radians(110), phase="lid")
    rounded_plate("rounded_lid", .458, .185, .014, -.0925, lid, body)
    b("lid_inner_inset", (.380, .133, .0025), (0, -.092, -.001), body, lid, .012)
    for x in (-.19, .19):
        disk(f"lid_hinge_{x}", .010, .055, (x, .070, .177), body, root)
    b("latch_receiver", (.038, .018, .043), (0, -.123, .142), body, root, .009)
    clasp = part("touch_clasp", lid, (0, -.188, .010), delta=math.radians(42), phase="clasp")
    b("clasp_tongue", (.026, .012, .036), (0, -.003, -.020), body, clasp, .006)
    b("clasp_thumb", (.012, .006, .012), (0, -.010, -.023), body, clasp, .003)
    # The carrying bail leans behind the lid's swept arc instead of intersecting it.
    points = []
    for x, z in ((-.105, .194), (-.098, .220), (-.085, .238), (-.065, .245), (.065, .245), (.085, .238), (.098, .220), (.105, .194)):
        points.append((x, .116 + (z - .19) * .30, z))
    tube("orange_carrying_bail", points, .018, orange, root)
    for x in (-.105, .105):
        b(f"bail_socket_{x}", (.042, .035, .045), (x, .113, .194), body, root, .011)
        disk(f"bail_pin_{x}", .007, .045, (x, .109, .194), dark, root)
    carriers = []
    # Parallel links translate each tray along an arc; counter-pivots keep it level.
    for label, y, z in (("front", -.140, .035), ("upper", -.090, .070)):
        travel = 1.70 if label == "front" else 1.35
        primary = part(f"touch_tray_{label}", root, (0, y-.014, z), base=-1.1, delta=travel)
        secondary = part(f"touch_tray_{label}_link", root, (0, y+.014, z), base=-1.1, delta=travel)
        for group in (primary, secondary):
            for x in (-.240, .240):
                tube(f"{group.name}_arm_{x}", [(x, 0, 0), (x, 0, .130)], .0032, body, group)
                for h in (0, .130):
                    disk(f"{group.name}_pin_{x}_{h}", .0065, .011, (x, 0, h), orange if h == .130 else body, group)
        level = part(f"touch_tray_{label}_level", primary, (0, 0, .130), base=1.1, delta=-travel)
        carrier = empty(f"{label}_tray_carrier", level, (0, .014, 0))
        tray(f"{label}_ceramic_tray", carrier, body)
        for x in (-.224, .224):
            b(f"{label}_link_bracket_{x}", (.045, .038, .008), (x, 0, .006), body, carrier, .002)
        carriers.append(carrier)
    lower, upper = carriers
    # Small, honest props; no brand marks or baked project labels.
    b("keyboard_chassis", (.112, .054, .010), (-.090, 0, .011), dark, upper, .004)
    for row in range(4):
        for column in range(4):
            b(f"key_{row}_{column}", (.019, .0085, .0045), (-.126 + column*.024, -.018 + row*.012, .018), orange if row > 1 and column > 1 else body, upper, .001)
    for radius in (.017, .022):
        tube(f"coiled_lead_{radius}", [(.100 + math.cos(i*math.tau/32)*radius, math.sin(i*math.tau/32)*radius*.65, .010) for i in range(32)], .0021, dark, upper, True)
    b("folded_strip", (.080, .043, .015), (-.105, 0, .013), body, lower, .006)
    for i in range(5):
        b(f"strip_inlay_{i}", (.077, .0022, .002), (-.105, -.016 + i*.008, .021), dark, lower, .0006)
    b("orange_pocket_tool", (.104, .044, .015), (.075, 0, .013), orange, lower, .005)
    for x in (.055, .087):
        b(f"pocket_tool_button_{x}", (.020, .010, .002), (x, -.002, .022), dark, lower, .002)
    b("notebook_pages", (.125, .086, .015), (-.055, .025, .019), body, root, .003)
    b("notebook_cover", (.131, .091, .004), (-.055, .025, .028), body, root, .003)
    for i in range(6):
        tube(f"notebook_loop_{i}", [(-.105+i*.018, .058, .027), (-.105+i*.018, .065, .034), (-.105+i*.018, .071, .027)], .0015, dark, root)
    tube("orange_pen", [(.055, .015, .017), (.173, .015, .017)], .005, orange, root)
    return root


def finalise(root):
    for obj in list(root.children_recursive):
        if obj.type != "MESH":
            continue
        for modifier in obj.modifiers:
            if modifier.type == "BEVEL":
                modifier.segments = 1
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        try:
            modifier = obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
            modifier.keep_sharp = True
        except Exception:
            pass
        scene.apply_modifiers(obj)
        uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name="UVMap")
        offset = int(hashlib.sha1(obj.name.encode()).hexdigest()[:8], 16) / 0xffffffff
        for polygon in obj.data.polygons:
            axis = max(range(3), key=lambda i: abs(polygon.normal[i]))
            a, c = ((1, 2), (0, 2), (0, 1))[axis]
            for loop in polygon.loop_indices:
                point = obj.data.vertices[obj.data.loops[loop].vertex_index].co
                uv.data[loop].uv = (point[a] / TILE + offset, point[c] / TILE + offset*.73)


def pose(fraction):
    for name, value in POSES.items():
        obj = bpy.data.objects.get(name)
        if obj:
            obj.rotation_mode = "XYZ"
            obj.rotation_euler.x = value["base"] + value["delta"] * fraction
    bpy.context.view_layer.update()


def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def studio():
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = 48
    s.cycles.use_denoising = True
    s.render.threads_mode = "FIXED"
    s.render.threads = 4
    s.view_settings.view_transform = "AgX"
    s.view_settings.exposure = -.5
    s.world.use_nodes = True
    background = s.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (1, .94, .84, 1)
    background.inputs["Strength"].default_value = .075
    stone, p = material("proof_ledge", "#8B8273", .93)
    n = stone.node_tree.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 190
    bump = stone.node_tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .28
    bump.inputs["Distance"].default_value = .0012
    stone.node_tree.links.new(n.outputs["Fac"], bump.inputs["Height"])
    stone.node_tree.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    wall, p = material("proof_wall", "#E0D5C2", .95)
    b("proof_stone_ledge", (2.5, 1.2, .055), (0, 0, -.032), stone, None, .005)
    b("proof_wall", (3.0, .05, 2), (0, .43, .85), wall, None, .003)
    bpy.ops.object.light_add(type="AREA", location=(-.65, -.35, .72))
    key = bpy.context.object
    key.name = "proof_warm_window"
    key.data.energy = 46
    key.data.shape = "RECTANGLE"
    key.data.size = .24
    key.data.size_y = .50
    key.data.color = (1, .86, .65)
    aim(key, (0, 0, .15))
    bpy.ops.object.light_add(type="AREA", location=(-.45, -.15, .60))
    fill = bpy.context.object
    fill.name = "proof_soft_bounce"
    fill.data.energy = 1.5
    fill.data.size = 1.0
    fill.data.color = (1, .96, .87)
    aim(fill, (0, 0, .12))
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 2))
    sun = bpy.context.object
    sun.name = "proof_window_stripe_sun"
    sun.rotation_euler = (math.radians(28), math.radians(-25), math.radians(-26))
    sun.data.energy = 0
    sun.data.angle = .045
    for i in range(2):
        bar = b(f"proof_window_mullion_{i}", (.035, 1.4, .04), (.10+i*.36, -.25, .73), wall, None, .003)
        bar.rotation_euler.z = math.radians(-22)
        bar.visible_camera = False
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "proof_camera"
    camera.data.sensor_fit = "HORIZONTAL"
    camera.data.sensor_width = 36
    s.camera = camera
    return camera


def render(camera, name, location, target, lens, width=1400, height=900):
    s = bpy.context.scene
    camera.location = location
    camera.data.lens = lens
    camera.data.shift_x = -.055 if width > height else 0
    aim(camera, target)
    s.render.resolution_x, s.render.resolution_y = width, height
    s.render.resolution_percentage = 100
    s.render.image_settings.file_format = "PNG"
    s.render.filepath = str(PROOFS / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    return {"positionBlender": list(location), "targetBlender": list(target), "positionGLTF": [location[0], location[2], -location[1]], "targetGLTF": [target[0], target[2], -target[1]], "verticalFov": math.degrees(2*math.atan((36/(width/height))/(2*lens))), "shiftX": camera.data.shift_x, "width": width, "height": height}


def main():
    texture_maps()
    scene.reset()
    root = create()
    finalise(root)
    pose(0)
    raw = OUT / "toolbox.raw.glb"
    export_glb(raw, [root])
    # Proofs re-import the actual exported GLB, rather than unpublished shader nodes.
    scene.reset()
    bpy.ops.import_scene.gltf(filepath=str(raw))
    camera = studio()
    cameras = {}
    pose(0)
    cameras["closed"] = render(camera, "closed", (.36, -.80, .275), (0, 0, .145), 51)
    if "--closed-only" in sys.argv:
        (HERE / "parameters-v2.json").write_text(json.dumps({"status": "Art-review draft, not approved reference parity", "camera": cameras["closed"], "lighting": {"keyPositionBlender": [-.65,-.35,.72], "keyWatts": 46, "keySize": [.24,.50], "fillWatts": 1.5, "worldStrength": .075, "exposure": -.5}, "glazeSourceColour": "#CC4A05", "handleRadiusMetres": .018, "parts": POSES}, indent=2)+"\n")
        return
    pose(1)
    cameras["open"] = render(camera, "open", (.64, -.98, .85), (0, -.015, .20), 49)
    cameras["mobile-open"] = render(camera, "mobile-open", (.40, -.75, .58), (.02, -.03, .20), 48, 720, 960)
    (HERE / "parameters.json").write_text(json.dumps({"source": "Original procedural asset; accepted direction A reference", "renderer": "Blender Cycles CPU, AgX exposure -0.5, 48 samples, four threads", "textureSize": 512, "textureTileMetres": TILE, "parts": POSES, "cameras": cameras, "lighting": {"keyPositionBlender": [-.65,-.35,.72], "keyWatts": 46, "keySize": [.24,.50], "fillWatts": 1.5, "worldStrength": .075}, "openingSequence": {"clasp": [0,.18], "lid": [.10,.68], "trays": [.38,1.0]}, "rawProofAsset": "blender/out/hero-toolbox/toolbox.raw.glb"}, indent=2)+"\n")

if __name__ == "__main__":
    main()
