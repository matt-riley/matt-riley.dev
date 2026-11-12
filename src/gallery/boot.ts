import "../styles/gallery.css";
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { type AssetId, AssetStore } from "./assets";
import { mountQuality } from "./quality";
import { publishGallery } from "./state";
import type {
  Cleanup,
  FrameListener,
  GalleryApp,
  GallerySession,
} from "./types";

interface Options {
  onFailure(): void;
}

export function boot({ onFailure }: Options): GallerySession {
  const root = document.documentElement;
  const layer = document.createElement("div");
  layer.className = "gallery-layer";
  layer.dataset.galleryLayer = "";
  layer.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  canvas.className = "gallery-canvas";
  canvas.setAttribute("aria-hidden", "true");
  canvas.tabIndex = -1;
  layer.append(canvas);
  document.body.append(layer);
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      failIfMajorPerformanceCaveat: true,
    });
  } catch (error) {
    layer.remove();
    throw error;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, innerWidth / innerHeight, 0.03, 80);
  const hemisphere = new HemisphereLight(0xffffff, 0xbcb6ab, 1.5);
  hemisphere.name = "gallery-fill";
  const key = new DirectionalLight(0xffffff, 3);
  key.name = "gallery-key";
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 15;
  key.shadow.camera.left = key.shadow.camera.bottom = -3;
  key.shadow.camera.right = key.shadow.camera.top = 3;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.01;
  scene.add(hemisphere, key, key.target);
  const cleanups = new Set<Cleanup>();
  const frames = new Set<FrameListener>();
  const resizes = new Set<(width: number, height: number) => void>();
  const roomMaterials = new Map<Material, MeshBasicMaterial>();
  const glazed = new Set<MeshStandardMaterial>();
  const night = () => root.dataset.lights === "after-hours";
  let disposed = false;
  let enabled = false;
  let paused = false;
  let frame = 0;
  let lastTime = 0;
  let app: GalleryApp | undefined;

  function addCleanup(cleanup: Cleanup): Cleanup {
    if (disposed) {
      cleanup();
      return () => {};
    }
    cleanups.add(cleanup);
    return () => {
      cleanups.delete(cleanup);
    };
  }

  function prepare(asset: GLTF, id: AssetId) {
    asset.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.castShadow = id !== "room";
      object.receiveShadow = true;
      const convert = (material: Material): Material => {
        if (!(material instanceof MeshStandardMaterial)) return material;
        if (id === "room" && material.userData.baked_lightmap) {
          const cached = roomMaterials.get(material);
          if (cached) return cached;
          const map = material.emissiveMap;
          if (!map)
            throw new Error("Room material is missing its UV1 baked map");
          map.channel = 1;
          map.colorSpace = SRGBColorSpace;
          const unlit = new MeshBasicMaterial({
            map,
            side: material.side,
            color: night() ? 0x303030 : 0xffffff,
          });
          unlit.name = material.name;
          unlit.userData = { ...material.userData };
          // The texture is already AgX display-referred; do not tone-map it again.
          unlit.toneMapped = false;
          roomMaterials.set(material, unlit);
          material.dispose();
          return unlit;
        }
        if (material.name === "porcelain") {
          material.roughness = 0.85;
          material.metalness = 0;
        } else if (material.name.startsWith("glaze")) {
          if (material.name === "glaze") {
            // Match Blender's approved AgX glaze without changing its #E8741A paint.
            // The renderer retains ACES for the other live materials.
            material.onBeforeCompile = (shader) => {
              shader.fragmentShader = shader.fragmentShader.replace(
                "#include <tonemapping_fragment>",
                "gl_FragColor.rgb = AgXToneMapping(gl_FragColor.rgb * 3.0);",
              );
            };
            material.customProgramCacheKey = () => "museum-glaze-agx";
          }
          material.roughness = 0.15;
          material.metalness = 0;
          glazed.add(material);
          material.emissive
            .copy(material.color)
            .multiplyScalar(night() ? 0.035 : 0);
        }
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(convert)
        : convert(object.material);
    });
  }
  const assets = new AssetStore(prepare);

  function requestRender() {
    if (disposed || !enabled || paused || frame || document.hidden) return;
    frame = requestAnimationFrame(draw);
  }
  function draw(time: number) {
    frame = 0;
    if (disposed || document.hidden || root.dataset.gallery !== "ready") return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    let again = false;
    try {
      for (const listener of frames)
        if (listener(delta, time / 1000)) again = true;
      if (disposed) return;
      if (app) {
        const target = app.room.getObjectByName(
          `stop_${app.activeStop}_target`,
        );
        if (target) target.getWorldPosition(key.target.position);
        key.position.copy(key.target.position).add({ x: -3, y: 4, z: 3 });
      }
      renderer.render(scene, camera);
      layer.dataset.rendered = "true";
      if (again) requestRender();
    } catch {
      dispose();
      onFailure();
    }
  }
  function resize() {
    if (disposed) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    for (const listener of resizes) listener(innerWidth, innerHeight);
    requestRender();
  }
  function syncLights() {
    scene.background = new Color(
      getComputedStyle(root).getPropertyValue("--wall").trim() || "#F4F1EA",
    );
    hemisphere.intensity = night() ? 0.15 : 1.5;
    key.intensity = night() ? 0.1 : 3;
    for (const material of roomMaterials.values())
      material.color.set(night() ? 0x303030 : 0xffffff);
    for (const material of glazed)
      material.emissive
        .copy(material.color)
        .multiplyScalar(night() ? 0.035 : 0);
    requestRender();
  }
  const setting = (event: Event) => {
    if ((event as CustomEvent<{ key: string }>).detail.key === "lights")
      syncLights();
  };
  const visible = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      lastTime = 0;
      requestRender();
    }
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    if (!disposed) {
      dispose();
      onFailure();
    }
  };
  window.addEventListener("resize", resize);
  document.addEventListener("mr:setting", setting);
  document.addEventListener("visibilitychange", visible);
  canvas.addEventListener("webglcontextlost", contextLost);
  addCleanup(() => window.removeEventListener("resize", resize));
  addCleanup(() => document.removeEventListener("mr:setting", setting));
  addCleanup(() => document.removeEventListener("visibilitychange", visible));
  addCleanup(() => canvas.removeEventListener("webglcontextlost", contextLost));
  resize();
  syncLights();

  function dispose() {
    if (disposed) return;
    disposed = true;
    enabled = false;
    cancelAnimationFrame(frame);
    frame = 0;
    for (const cleanup of [...cleanups].reverse()) {
      try {
        cleanup();
      } catch {
        /* Continue releasing the GPU if an optional plugin fails. */
      }
    }
    cleanups.clear();
    frames.clear();
    resizes.clear();
    assets.dispose();
    roomMaterials.clear();
    glazed.clear();
    key.shadow.dispose();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    layer.remove();
  }

  const ready = (async (): Promise<GalleryApp> => {
    const roomAsset = await assets.get("room");
    if (disposed) throw new DOMException("Gallery was disposed", "AbortError");
    const room = roomAsset.scene;
    scene.add(room);
    room.updateMatrixWorld(true);
    const position = room.getObjectByName("stop_0_cam");
    const target = room.getObjectByName("stop_0_target");
    if (!position || !target)
      throw new Error("Room is missing its entrance camera nodes");
    position.getWorldPosition(camera.position);
    camera.lookAt(target.getWorldPosition(key.target.position));
    const stops = [
      ...document.querySelectorAll<HTMLElement>("section[data-exhibit]"),
    ];
    const hashStop = stops.findIndex((stop) => `#${stop.id}` === location.hash);
    const initialStop = Math.max(hashStop, 0);
    assets.setNearestStop(initialStop);
    await assets.get(assets.nearestExhibit(initialStop));
    if (disposed) throw new DOMException("Gallery was disposed", "AbortError");
    app = {
      renderer,
      scene,
      camera,
      room,
      assets,
      activeStop: initialStop,
      get disposed() {
        return disposed;
      },
      requestRender,
      setPaused(value) {
        paused = value;
        if (paused) {
          cancelAnimationFrame(frame);
          frame = 0;
        } else {
          lastTime = 0;
          requestRender();
        }
      },
      addCleanup,
      onFrame(listener) {
        frames.add(listener);
        return () => {
          frames.delete(listener);
        };
      },
      onResize(listener) {
        resizes.add(listener);
        return () => {
          resizes.delete(listener);
        };
      },
    };
    await publishGallery(app);
    app.addCleanup(mountQuality(app));
    if (disposed) throw new DOMException("Gallery was disposed", "AbortError");
    // Compile shader programs without stalling the first visible frame.
    await renderer.compileAsync(scene, camera);
    if (disposed) throw new DOMException("Gallery was disposed", "AbortError");
    // One hidden frame proves the renderer before the gate publishes ready.
    // Plugins run on the following RAF, after gallery CSS is active, before the
    // canvas becomes visible. A direct hash visit never flashes the entrance.
    renderer.render(scene, camera);
    enabled = true;
    assets.prefetch(initialStop);
    requestRender();
    return app;
  })();
  return { ready, dispose };
}
