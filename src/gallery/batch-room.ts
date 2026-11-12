import {
  Float32BufferAttribute,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Keep named nodes and animated pivots; batch only draws sharing a pivot/material. */
function batch(root: Object3D, room: boolean) {
  root.updateWorldMatrix(true, true);
  const groups = new Map<Object3D, Map<Material, Mesh[]>>();
  root.traverse((object) => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
    if (
      room &&
      (!(object.material instanceof MeshBasicMaterial) ||
        object.name === "portrait_plane")
    )
      return;
    let pivot = root;
    let ancestor: Object3D | null = object;
    while (ancestor && ancestor !== root) {
      if (ancestor.name.startsWith("touch_")) {
        if (room) return;
        pivot = ancestor;
        break;
      }
      ancestor = ancestor.parent;
    }
    // An actual touch mesh is its own draw: hiding it would hide a child batch.
    if (pivot === object) return;
    const materials = groups.get(pivot) ?? new Map<Material, Mesh[]>();
    const members = materials.get(object.material) ?? [];
    members.push(object);
    materials.set(object.material, members);
    groups.set(pivot, materials);
  });
  for (const [pivot, materials] of groups)
    for (const [material, members] of materials) {
      if (members.length < 2) continue;
      const inverse = new Matrix4().copy(pivot.matrixWorld).invert();
      const geometries = members.map((member) => {
        const source = member.geometry.clone();
        const geometry = source.index ? source.toNonIndexed() : source;
        if (source !== geometry) source.dispose();
        const attributes = room ? ["position", "uv1"] : ["position", "normal"];
        for (const name of Object.keys(geometry.attributes)) {
          if (!attributes.includes(name)) {
            geometry.deleteAttribute(name);
            continue;
          }
          const attribute = geometry.getAttribute(name);
          const values = [];
          for (let vertex = 0; vertex < attribute.count; vertex++) {
            values.push(attribute.getX(vertex), attribute.getY(vertex));
            if (attribute.itemSize === 3) values.push(attribute.getZ(vertex));
          }
          geometry.setAttribute(
            name,
            new Float32BufferAttribute(values, attribute.itemSize),
          );
        }
        if (!room && !geometry.getAttribute("normal"))
          geometry.computeVertexNormals();
        geometry.applyMatrix4(
          new Matrix4().multiplyMatrices(inverse, member.matrixWorld),
        );
        return geometry;
      });
      const merged = mergeGeometries(geometries, false);
      geometries.forEach((geometry) => {
        geometry.dispose();
      });
      if (!merged) throw new Error(`Cannot batch material ${material.name}`);
      const mesh = new Mesh(merged, material);
      mesh.name = `runtime_batch_${material.name}`;
      mesh.castShadow = !room;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      for (const member of members) member.visible = false;
    }
}

export function batchRoom(room: Object3D) {
  batch(room, true);
}
export function batchExhibit(root: Object3D) {
  batch(root, false);
}
