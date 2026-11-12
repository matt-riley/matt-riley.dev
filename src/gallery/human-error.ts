import { gsap } from "gsap";
import {
  Box3,
  Mesh,
  MeshBasicMaterial,
  SpotLight,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from "three";
import type { ExhibitRegistry } from "./exhibits";
import { animatePart, type Part } from "./parts";
import { setStopTarget } from "./rail-state";

/** A bounded nod and a spotlight that always returns to darkness after 2s. */
export function nodMicrophone(
  part: Part,
  light: SpotLight,
  render: () => void,
) {
  const timeline = gsap.timeline({ onUpdate: render });
  timeline.add(
    animatePart(part, 0.8, { duration: 0.16, ease: "power2.out" }),
    0,
  );
  timeline.add(
    animatePart(part, 0.5, { duration: 0.32, ease: "sine.inOut" }),
    0.16,
  );
  timeline.to(light, { intensity: 12, duration: 0.12, ease: "sine.out" }, 0);
  timeline.to(light, { intensity: 0, duration: 0.25, ease: "sine.in" }, 1.75);
  return timeline;
}

export async function mountHumanError(registry: ExhibitRegistry) {
  const app = registry.app;
  const portraitURL = document.querySelector<HTMLElement>("[data-portrait-src]")
    ?.dataset.portraitSrc;
  const plane = app.room.getObjectByName("portrait_plane");
  if (!portraitURL || !plane) return;

  const texture = await new TextureLoader().loadAsync(portraitURL);
  if (registry.disposed) {
    texture.dispose();
    return;
  }
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  const portrait = new MeshBasicMaterial({ map: texture, toneMapped: false });
  portrait.name = "original-cat-portrait";
  const originalMaterials = new Map<Mesh, Mesh["material"]>();
  const originalScale = plane.scale.x;
  const size = new Box3().setFromObject(plane).getSize(new Vector3());
  const image = texture.image as { width: number; height: number };
  // Fit the original photograph inside its frame; never crop, filter or stretch.
  if (size.x > 0 && size.y > 0)
    plane.scale.x *= image.width / image.height / (size.x / size.y);
  plane.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    originalMaterials.set(object, object.material);
    object.material = portrait;
  });

  const releaseRecords = registry.onRecord((record) => {
    if (record.id === "absent") {
      const restoreHandler = registry.setTouchHandler("absent", () => {});
      const restoreDrag = registry.setDraggable("absent", false);
      const plinth = app.room.getObjectByName("plinth_absent");
      const restoreBounds = registry.setPickBounds("absent", () => {
        record.root.updateWorldMatrix(true, true);
        plinth?.updateWorldMatrix(true, true);
        const box = new Box3().setFromObject(record.root);
        if (plinth) box.union(new Box3().setFromObject(plinth));
        return box;
      });
      return () => {
        restoreHandler();
        restoreDrag();
        restoreBounds();
      };
    }
    if (record.id !== "open-mic") return;
    const part = record.parts.get("touch_mic");
    const control = document.querySelector<HTMLElement>(
      "#open-mic [data-touch]",
    );
    if (!part || !control) return;
    const light = new SpotLight(0xfff0da, 0, 4, Math.PI / 7, 0.85, 2);
    light.name = "human-error-mic-spotlight";
    const centre = registry.bounds(record).getCenter(new Vector3());
    light.position.copy(centre).add(new Vector3(-0.15, 1.5, 0.4));
    light.target.position.copy(centre);
    app.scene.add(light, light.target);
    let nod: gsap.core.Timeline | undefined;
    const neutral = part.rotation[part.userData.axis];
    const restoreControl = registry.setControl(
      "open-mic",
      "touch_mic",
      control,
    );
    const restoreHandler = registry.setTouchHandler("open-mic", (event) => {
      if (event.detail?.model !== "open-mic") return;
      nod?.kill();
      nod = nodMicrophone(part, light, app.requestRender);
    });
    return () => {
      restoreControl();
      restoreHandler();
      nod?.kill();
      part.rotation[part.userData.axis] = neutral;
      light.removeFromParent();
      light.target.removeFromParent();
      light.shadow.dispose();
    };
  });

  // Permanent anchors keep framing stable while lower-tier devices unload meshes.
  const bounds = ["open-mic", "boom-bap", "absent"].map((id) => {
    const anchor = app.room.getObjectByName(`anchor_${id}`);
    const plinth = app.room.getObjectByName(`plinth_${id}`);
    if (!anchor || !plinth) return new Box3();
    const point = anchor.getWorldPosition(new Vector3());
    const height = id === "absent" ? 0.12 : 0.5;
    const objectBox = new Box3().setFromCenterAndSize(
      point.add(new Vector3(0, height / 2, 0)),
      new Vector3(0.5, height, 0.5),
    );
    const frame = new Box3().setFromObject(plinth).union(objectBox);
    // The middle of the pan also makes room for the original portrait above it.
    if (id === "boom-bap") frame.union(new Box3().setFromObject(plane));
    return frame;
  });
  const releasePan = setStopTarget(7, ({ sectionProgress }) => {
    if (bounds.some((box) => box.isEmpty())) return;
    const progress = Math.max(0, Math.min(1, sectionProgress)) * 2;
    const first = Math.min(1, Math.floor(progress));
    const fraction = progress - first;
    const box = new Box3(
      bounds[first].min.clone().lerp(bounds[first + 1].min, fraction),
      bounds[first].max.clone().lerp(bounds[first + 1].max, fraction),
    );
    return { target: box.getCenter(new Vector3()), bounds: box };
  });
  app.requestRender();

  return () => {
    releaseRecords();
    releasePan();
    originalMaterials.forEach((material, mesh) => {
      mesh.material = material;
    });
    plane.scale.x = originalScale;
    portrait.dispose();
    texture.dispose();
  };
}
