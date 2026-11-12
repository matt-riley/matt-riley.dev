"""Export a deliberate object set and its descendants, never scene cameras/lights."""

from pathlib import Path
import bpy
from mathutils import Matrix


def export_glb(path, objects):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    export_objects = set()
    for obj in objects:
        export_objects.add(obj)
        export_objects.update(obj.children_recursive)
    export_objects = {obj for obj in export_objects if obj.type not in {"CAMERA", "LIGHT"}}
    # Quantisation can recenter mesh leaf nodes. A named parent pivot keeps its
    # authored transform while the anonymous geometry child absorbs that change.
    for obj in sorted(export_objects, key=lambda item: item.name):
        if obj.type != "MESH" or not obj.name.startswith("touch_"):
            continue
        name, world, parent = obj.name, obj.matrix_world.copy(), obj.parent
        obj.name = f"geometry_{name}"
        pivot = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(pivot)
        pivot.parent = parent
        pivot.matrix_world = world
        for key in list(obj.keys()):
            pivot[key] = obj[key]
            del obj[key]
        obj.parent = pivot
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = Matrix.Identity(4)
        export_objects.add(pivot)
    if not export_objects:
        raise ValueError("Cannot export an empty object set")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in export_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = min(export_objects, key=lambda item: item.name)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_materials="EXPORT",
        export_draco_mesh_compression_enable=False,
    )
    print(f"Exported {path}")
