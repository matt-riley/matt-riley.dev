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
sys.path.insert(0, str(HERE))
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
    # Kiln-pooling variation is baked into portable sRGB colour and linear ORM.
    cloud = rng.normal(0, 1, (256, 256))
    for _ in range(40):
        cloud = (cloud * 4 + np.roll(cloud, 1, 0) + np.roll(cloud, -1, 0) + np.roll(cloud, 1, 1) + np.roll(cloud, -1, 1)) / 8
    cloud = np.clip(cloud / cloud.std(), -2, 2)
    glaze = np.array([175, 52, 4]) + cloud[..., None] * np.array([3, 1.5, .5])
    png(TEXTURES / "glaze-colour.png", np.clip(glaze, 0, 255))
    rough = np.clip(.22 + cloud*.008, .19, .25)
    png(TEXTURES / "glaze-orm.png", np.stack((np.ones_like(rough), rough, np.zeros_like(rough)), axis=-1)*255)


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
    p.inputs["Coat Weight"].default_value = .8
    p.inputs["Coat Roughness"].default_value = .075
    tree = orange.node_tree
    for key, filename in (("colour", "glaze-colour.png"), ("orm", "glaze-orm.png")):
        image = bpy.data.images.load(str(TEXTURES / filename), check_existing=False)
        image.colorspace_settings.name = "sRGB" if key == "colour" else "Non-Color"
        node = tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        node.extension = "REPEAT"
        if key == "colour":
            tree.links.new(node.outputs["Color"], p.inputs["Base Color"])
        else:
            split = tree.nodes.new("ShaderNodeSeparateColor")
            tree.links.new(node.outputs["Color"], split.inputs["Color"])
            tree.links.new(split.outputs["Green"], p.inputs["Roughness"])
            tree.links.new(split.outputs["Blue"], p.inputs["Metallic"])
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
    def face(points):
        indices = []
        for point in points:
            indices.append(len(vertices))
            vertices.append(point)
        faces.append(tuple(indices))
    for i in range(n):
        j = (i+1)%n
        # Lower tray brackets pass through these open-top guide notches, not solid walls.
        if name == "rounded_body" and abs(outer[i][0]-outer[j][0]) < 1e-8 and abs(outer[i][1]-outer[j][1]) > .1:
            lo,hi,cut = -.004,.080,.064
            yi,yj=outer[i][1],outer[j][1]
            u,v=sorted(((lo-yi)/(yj-yi),(hi-yi)/(yj-yi)))
            def point(ring,t,z):
                x1,y1=ring[i];x2,y2=ring[j]
                return (x1+(x2-x1)*t,y1+(y2-y1)*t,z)
            for start,end,top in ((0,u,height),(u,v,cut),(v,1,height)):
                face([point(outer,start,0),point(outer,end,0),point(outer,end,top),point(outer,start,top)])
                face([point(inner,start,top),point(inner,end,top),point(inner,end,thickness),point(inner,start,thickness)])
                face([point(outer,start,top),point(outer,end,top),point(inner,end,top),point(inner,start,top)])
            face([point(outer,u,cut),point(inner,u,cut),point(inner,u,height),point(outer,u,height)])
            face([point(outer,v,cut),point(outer,v,height),point(inner,v,height),point(inner,v,cut)])
        else:
            faces.extend(((i,j,n+j,n+i),(n+i,n+j,2*n+j,2*n+i),(2*n+i,2*n+j,3*n+j,3*n+i)))
    return local(mesh(name, vertices, faces, mat, None, .0016), owner)


def tray(name, owner, mat):
    return shell(name, .406 if name.startswith("upper") else .416, .066 if name.startswith("upper") else .070, .026 if name.startswith("upper") else .028, owner, mat, .009, .005)


def hollow_lid(owner, mat):
    # Closed height 43mm: a hollow, softly sloped ceramic cap, not a solid plate.
    rings = [(.458,.205,.030,0), (.452,.199,.032,.029), (.429,.177,.034,.043), (.442,.189,.023,0), (.421,.169,.030,.039)]
    outlines = [outline(w,d,r,-.1305) for w,d,r,z in rings]
    n = len(outlines[0])
    vertices = [(x,y,rings[i][3]) for i,ring in enumerate(outlines) for x,y in ring]
    faces = [tuple(range(2*n,3*n)), tuple(reversed(range(4*n,5*n)))]
    for i in range(n):
        j=(i+1)%n
        for a,b in ((0,1),(1,2)):
            faces.append((a*n+i,a*n+j,b*n+j,b*n+i))
        faces.append((i,3*n+i,3*n+j,j))
        faces.append((3*n+i,4*n+i,4*n+j,3*n+j))
    cap = local(mesh("rounded_lid",vertices,faces,mat,None,0),owner)
    # Bottom-open guide pockets clear the upper tray mounting blocks in the closed lid.
    for x in (-.229,.229):
        bpy.ops.mesh.primitive_cube_add(size=1)
        cutter = bpy.context.object
        cutter.name = "temporary_lid_guide_cut"
        local(cutter,owner,(x,-.086,.012))
        cutter.scale=(.060,.090,.028)
        bpy.context.view_layer.update()
        modifier=cap.modifiers.new("upper_tray_guide","BOOLEAN")
        modifier.operation="DIFFERENCE"
        modifier.object=cutter
        bpy.context.view_layer.objects.active=cap
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(cutter,do_unlink=True)
    scene.bevel(cap,.0035,2)
    return cap


def create():
    root = scene.empty("hero_toolbox")
    root["asset_id"] = "immersive-toolbox"
    root["units"] = "metres; authored Z-up, exported glTF Y-up"
    body, orange, dark = materials()
    shell("rounded_body", .460, .230, .100, root, body, .030, .008)
    b("rear_top_rail", (.435, .025, .010), (0, .101, .102), body, root, .006)
    lid = part("touch_lid", root, (0, .117, .102), delta=-math.radians(110), phase="lid")
    hollow_lid(lid, body)
    for x in (-.19, .19):
        disk(f"lid_hinge_{x}", .010, .055, (x, .117, .102), body, root)
    b("latch_receiver", (.042, .016, .037), (0, -.121, .085), body, root, .009)
    clasp = part("touch_clasp", lid, (0, -.239, .030), delta=-math.radians(42), phase="clasp")
    b("clasp_tongue", (.032, .019, .045), (0, -.003, -.022), body, clasp, .009)
    b("clasp_thumb", (.016, .008, .014), (0, -.014, -.023), body, clasp, .005)
    # A swivelling handle stays upright as the lid opens; every old hinge is preserved.
    handle = part("touch_handle", lid, (0,-.208,.064), delta=math.radians(110), phase="lid")
    path = [(-.075,0),(-.075,.005),(-.075,.010)]
    path += [(-.050+.025*math.cos(a),.010+.025*math.sin(a)) for a in [math.pi-i*math.pi/24 for i in range(1,13)]]
    path += [(-.050+i*.100/8,.035) for i in range(1,9)]
    path += [(.050+.025*math.cos(a),.010+.025*math.sin(a)) for a in [math.pi/2-i*math.pi/24 for i in range(1,13)]]
    path += [(.075,.005),(.075,0)]
    points = [Vector((x,z*.30,z)) for x,z in path]
    vertices, faces = [], []
    sides, radius = 16,.018
    for i,point in enumerate(points):
        tangent=(points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized()
        normal=Vector((0,1,0)).cross(tangent).normalized()
        binormal=tangent.cross(normal).normalized()
        for j in range(sides):
            a=math.tau*j/sides
            vertices.append(tuple(point+radius*(normal*math.cos(a)+binormal*math.sin(a))))
        if i:
            for j in range(sides):
                k=(j+1)%sides
                faces.append(((i-1)*sides+j,(i-1)*sides+k,i*sides+k,i*sides+j))
    faces += [tuple(reversed(range(sides))),tuple(range((len(points)-1)*sides,len(points)*sides))]
    local(mesh("orange_carrying_bail",vertices,faces,orange,None,0),handle)
    for x in (-.075,.075):
        b(f"bail_socket_{x}",(.045,.035,.028),(x,-.208,.055),body,lid,.009)
        disk(f"bail_pin_{x}",.006,.048,(x,-.209,.064),dark,lid)
    carriers = []
    # Parallel links translate each tray along an arc; counter-pivots keep it level.
    for label, y, z in (("front", -.084, .014), ("upper", -.094, .055)):
        travel = 1.75 if label == "front" else 1.40
        primary = part(f"touch_tray_{label}", root, (0, y-.014, z), base=-1.15, delta=travel)
        secondary = part(f"touch_tray_{label}_link", root, (0, y+.014, z), base=-1.15, delta=travel)
        for group in (primary, secondary):
            for x in (-.236, .236):
                tube(f"{group.name}_arm_{x}", [(x, 0, 0), (x, 0, .137)], .0032, body, group)
                for h in (0, .137):
                    disk(f"{group.name}_pin_{x}_{h}", .0065, .011 if h else .026, (x, 0, h), orange if h == .137 else body, group)
        level = part(f"touch_tray_{label}_level", primary, (0, 0, .137), base=1.15, delta=-travel)
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
        tube(f"coiled_lead_{radius}", [(.100 + math.cos(i*math.tau/20)*radius, math.sin(i*math.tau/20)*radius*.65, .010) for i in range(20)], .0021, dark, upper, True)
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
                modifier.segments = 2 if obj.name in ("rounded_body", "rounded_lid") else (3 if obj.name.startswith(("clasp_", "latch_receiver", "bail_socket")) else 1)
                if obj.name in ("rounded_body", "rounded_lid"):
                    modifier.width = .0035
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        if obj.name != "orange_carrying_bail":
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


def batch_rigid(root):
    # Joining only direct siblings preserves the mechanism and all pivot transforms.
    owners = [root] + [obj for obj in root.children_recursive if obj.type == "EMPTY"]
    for owner in owners:
        siblings = [obj for obj in owner.children if obj.type == "MESH"]
        if len(siblings) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in siblings:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = siblings[0]
        bpy.ops.object.join()
        siblings[0].name = f"{owner.name}_rigid"


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
    s.view_settings.exposure = -1.0
    s.world.use_nodes = True
    background = s.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (1, .94, .84, 1)
    background.inputs["Strength"].default_value = .075
    stone, p = material("proof_ledge", "#A58E74", .88)
    n = stone.node_tree.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 190
    bump = stone.node_tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .28
    bump.inputs["Distance"].default_value = .0012
    stone.node_tree.links.new(n.outputs["Fac"], bump.inputs["Height"])
    stone.node_tree.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    wall, p = material("proof_wall", "#DCCBB2", .95)
    tree = wall.node_tree
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 145
    noise.inputs["Detail"].default_value = 3
    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .45
    bump.inputs["Distance"].default_value = .002
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    b("proof_stone_ledge", (2.5, .72, .10), (0, 0, -.052), stone, None, .005)
    b("proof_wall", (3.0, .05, 2), (0, .43, .85), wall, None, .003)
    # A small handmade room context stays proof-only; it is not in the toolbox GLB.
    ink, _ = material("proof_ink", "#201C16", .65)
    cover, _ = material("proof_record_cover", "#B34F1C", .72)
    paper, _ = material("proof_print_paper", "#E7DDC8", .90)
    for i, x in enumerate((-.43, -.412, -.39)):
        spine = b(f"proof_record_spine_{i}", (.018,.10,.29-i*.018), (x,.16,.145), ink if i != 1 else cover, None,.002)
        spine.rotation_euler.y = -.08+i*.055
    b("proof_orange_record_sleeve", (.15,.018,.255), (-.34,.19,.128), cover, None,.001)
    disc = cylinder("proof_vinyl", .074,.003, (-.34,.178,.130), ink,None,64)
    disc.rotation_euler.x = math.pi/2
    label = cylinder("proof_vinyl_label", .019,.004, (-.34,.175,.130), paper,None,32)
    label.rotation_euler.x = math.pi/2
    b("proof_frame", (.235,.025,.34), (.43,.385,.18), ink,None,.004)
    b("proof_print", (.213,.008,.317), (.43,.368,.18), paper,None,.001)
    circle = cylinder("proof_print_orange_circle", .077,.003, (.43,.361,.19),cover,None,64)
    circle.rotation_euler.x = math.pi/2
    bpy.ops.object.light_add(type="AREA", location=(-.65, -.35, .72))
    key = bpy.context.object
    key.name = "proof_warm_window"
    key.data.energy = 38
    key.data.shape = "RECTANGLE"
    key.data.size = .14
    key.data.size_y = .60
    key.data.color = (1, .86, .65)
    aim(key, (0, 0, .15))
    bpy.ops.object.light_add(type="AREA", location=(-.45, -.15, .60))
    fill = bpy.context.object
    fill.name = "proof_soft_bounce"
    fill.data.energy = .6
    fill.data.size = 1.0
    fill.data.color = (1, .96, .87)
    aim(fill, (0, 0, .12))
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 2))
    sun = bpy.context.object
    sun.name = "proof_window_stripe_sun"
    aim(sun, (.7, .35, 0))
    sun.data.energy = .65
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
    raw = OUT / "toolbox.raw.glb"
    if "--render-only" not in sys.argv:
        export_only(raw)
    elif not POSES:
        # Freeze the proven export: rendering must not silently regenerate its geometry.
        preflight = json.loads((HERE / "clearance.json").read_text())
        if preflight.get("rawSourceSha256") != hashlib.sha256(raw.read_bytes()).hexdigest():
            raise RuntimeError("Proof export differs from the checked mechanism")
        POSES.update(preflight["parts"])
    if "--export-only" in sys.argv:
        return
    render_proofs(raw)


def export_only(raw):
    texture_maps()
    scene.reset()
    root = create()
    finalise(root)
    from clearance import check_clearance
    check_clearance(root, POSES, pose, HERE / "clearance.json")
    batch_rigid(root)
    pose(0)
    export_glb(raw, [root])
    preflight_path = HERE / "clearance.json"
    preflight = json.loads(preflight_path.read_text())
    preflight["rawSourceSha256"] = hashlib.sha256(raw.read_bytes()).hexdigest()
    preflight_path.write_text(json.dumps(preflight, indent=2)+"\n")


def render_proofs(raw):
    # Proofs re-import the actual exported GLB, rather than unpublished shader nodes.
    scene.reset()
    bpy.ops.import_scene.gltf(filepath=str(raw))
    camera = studio()
    cameras = {}
    pose(0)
    cameras["closed"] = render(camera, "closed", (.25,-.78,.180),(0,0,.105),52)
    pose(1)
    cameras["open"] = render(camera, "open", (.35,-.84,.44),(0,-.020,.160),48)
    cameras["mobile-open"] = render(camera, "mobile-open", (.28,-.65,.37),(.03,-.04,.16),50, 720, 960)
    (HERE / "parameters.json").write_text(json.dumps({"source": "Original procedural asset; accepted direction A reference", "renderer": "Blender Cycles CPU, AgX exposure -1.0, 48 samples, four threads", "maxTextureSize": 512, "glazeTextureSize": 256, "textureTileMetres": TILE, "parts": POSES, "cameras": cameras, "lighting": {"keyPositionBlender": [-.65,-.35,.72], "keyWatts": 38, "keySize": [.14,.60], "fillWatts": .6, "worldStrength": .075}, "openingSequence": {"clasp": [0,.18], "lid": [.10,.68], "trays": [.38,1.0]}, "rawProofAsset": "blender/out/hero-toolbox/toolbox.raw.glb", "rawProofSha256": hashlib.sha256(raw.read_bytes()).hexdigest(), "caseDimensionsMetres": [.460,.230,.145], "lidHeightMetres": .043, "linearMaterialHandling": "sRGB base-colour images; non-colour ORM/normal images; no legacy shader multiplier"}, indent=2)+"\n")

if __name__ == "__main__":
    main()
