import {
  AgXToneMapping,
  Box3,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import modelURL from "../assets/immersive/toolbox.glb?url";

export interface ToolboxRuntime {
  setOpen(open: boolean): void;
  turn(direction: number): void;
  dispose(): void;
}

function disposeObject(root: Group | Scene) {
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material))
      if (value instanceof Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}

export async function createToolboxRuntime(
  host: HTMLElement,
  onFailure: () => void,
  signal: AbortSignal,
): Promise<ToolboxRuntime> {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "A real-time ceramic toolbox. Use the adjacent buttons to open, close and turn it.",
  );
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    failIfMajorPerformanceCaveat: true,
    powerPreference: "low-power",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new Scene();
  scene.background = new Color("#e9d7c1");
  scene.fog = new Fog("#e9d7c1", 2, 6);
  const camera = new PerspectiveCamera(32, 1, 0.01, 100);
  const display = new Group();
  scene.add(display);
  const floor = new Mesh(
    new PlaneGeometry(200, 200),
    new MeshStandardMaterial({ color: "#d7bda0", roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.001;
  floor.receiveShadow = true;
  scene.add(floor);
  const key = new DirectionalLight("#ffe6bd", 4.0);
  key.position.set(-0.65, 0.72, 0.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -0.65;
  key.shadow.camera.right = key.shadow.camera.top = 0.65;
  key.shadow.camera.near = 0.01;
  key.shadow.camera.far = 3;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.002;
  key.shadow.radius = 4;
  key.shadow.blurSamples = 8;
  scene.add(key, new HemisphereLight("#ffefd9", "#806047", 1.2));
  let environment: WebGLRenderTarget | undefined;
  let disposed = false;
  let frame = 0;
  let amount = 1;
  let yaw = 0;
  let animation: { from: number; to: number; at: number } | undefined;
  let drag:
    | { id: number; x: number; y: number; yaw: number; active: boolean }
    | undefined;
  const hinges: Array<{
    node: Group;
    rest: Quaternion;
    delta: number;
    phase: string;
  }> = [];
  const axis = new Vector3(1, 0, 0);
  const rotation = new Quaternion();
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (n: number, min = 0, max = 1) =>
    Math.min(max, Math.max(min, n));
  const phaseAmount = (phase: string) => {
    const [start, end] =
      phase === "clasp" ? [0, 0.18] : phase === "lid" ? [0.1, 0.68] : [0.38, 1];
    const t = clamp((amount - start) / (end - start));
    // Keep the exact certified joint path; only the overall clock is eased.
    return t;
  };
  const pose = () => {
    for (const { node, rest, delta, phase } of hinges)
      node.quaternion
        .copy(rest)
        .multiply(rotation.setFromAxisAngle(axis, delta * phaseAmount(phase)));
    display.rotation.y = yaw;
    host.dataset.toolboxOpen = amount.toFixed(3);
    host.dataset.toolboxYaw = yaw.toFixed(3);
  };
  const draw = (now: number) => {
    frame = 0;
    if (disposed || document.hidden) return;
    if (animation) {
      const t = clamp((now - animation.at) / 700);
      amount =
        animation.from +
        (animation.to - animation.from) * (t * t * (3 - 2 * t));
      if (t === 1) animation = undefined;
    }
    pose();
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    host.dataset.toolboxDrawCalls = String(renderer.info.render.calls);
    host.dataset.toolboxTriangles = String(renderer.info.render.triangles);
    if (animation) request();
  };
  const request = () => {
    if (!frame && !disposed && !document.hidden)
      frame = requestAnimationFrame(draw);
  };
  const bounds = new Box3();
  const target = new Vector3(0, 0.15, 0);
  const direction = new Vector3(0.27, 0.3, 0.85).normalize();
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height || disposed) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Frame the full hinge sweep, leaving space for the native controls below.
    const tangent = Math.tan((camera.fov * Math.PI) / 360);
    const right = new Vector3()
      .crossVectors(new Vector3(0, 1, 0), direction)
      .normalize();
    const up = new Vector3().crossVectors(direction, right).normalize();
    let distance = 0.1;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const point = new Vector3(x, y, z).sub(target);
          distance = Math.max(
            distance,
            point.dot(direction) +
              Math.max(
                Math.abs(point.dot(right)) / (tangent * camera.aspect),
                Math.abs(point.dot(up)) / tangent,
              ),
          );
        }
    distance *= 1.1;
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    request();
  };
  const observer = new ResizeObserver(resize);
  const lost = (event: Event) => {
    event.preventDefault();
    if (!disposed) onFailure();
  };
  const visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      if (animation) {
        amount = animation.to;
        animation = undefined;
      }
    } else request();
  };
  const down = (event: PointerEvent) => {
    if (event.isPrimary && event.button === 0)
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        yaw,
        active: false,
      };
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy)) {
      drag.active = true;
      canvas.setPointerCapture(event.pointerId);
    }
    if (drag.active) {
      yaw = clamp(drag.yaw + dx / 230, -0.8, 0.8);
      request();
    }
  };
  const up = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return;
    if (canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    drag = undefined;
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    signal.removeEventListener("abort", dispose);
    document.removeEventListener("visibilitychange", visibility);
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
    key.shadow.map?.dispose();
    environment?.dispose();
    disposeObject(scene);
    renderer.dispose();
    if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
    canvas.remove();
    delete host.dataset.toolboxOpen;
    delete host.dataset.toolboxYaw;
    delete host.dataset.toolboxDrawCalls;
    delete host.dataset.toolboxTriangles;
  };
  signal.addEventListener("abort", dispose, { once: true });
  canvas.addEventListener("webglcontextlost", lost);
  try {
    const pmrem = new PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    try {
      environment = pmrem.fromScene(room, 0.04);
    } finally {
      disposeObject(room);
      pmrem.dispose();
    }
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.6;
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    const response = await fetch(modelURL, { signal });
    if (!response.ok) throw new Error("Toolbox model unavailable");
    const gltf = await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(await response.arrayBuffer(), "");
    if (disposed || signal.aborted) {
      disposeObject(gltf.scene);
      throw new DOMException("Cancelled", "AbortError");
    }
    display.add(gltf.scene);
    gltf.scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
      const range = object.userData.range;
      if (
        object.userData.kind === "hinge" &&
        Array.isArray(range) &&
        range.length === 2 &&
        Number.isFinite(range[1])
      )
        hinges.push({
          node: object as Group,
          rest: object.quaternion.clone(),
          delta: range[1],
          phase: String(object.userData.phase),
        });
    });
    if (hinges.length < 8) throw new Error("Incomplete toolbox hinges");
    bounds.makeEmpty();
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      amount = progress;
      pose();
      bounds.union(new Box3().setFromObject(display));
    }
    amount = 1;
    pose();
    if (bounds.isEmpty()) throw new Error("Empty toolbox model");
    bounds.getCenter(target);
    host.append(canvas);
    resize();
    if (renderer.extensions.has("KHR_parallel_shader_compile"))
      await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    if (disposed || signal.aborted)
      throw new DOMException("Cancelled", "AbortError");
    draw(performance.now());
    observer.observe(host);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    document.addEventListener("visibilitychange", visibility);
    return {
      setOpen(open) {
        if (disposed) return;
        if (motion.matches) {
          amount = open ? 1 : 0;
          animation = undefined;
        } else
          animation = { from: amount, to: open ? 1 : 0, at: performance.now() };
        request();
      },
      turn(direction) {
        if (disposed) return;
        yaw = clamp(yaw + (direction * Math.PI) / 12, -0.8, 0.8);
        request();
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
