import type { MeshBasicMaterial, Vector3 } from "three";

export interface NightUniforms {
  museumFrom: { value: number };
  museumTo: { value: number };
  museumFront: { value: number };
  museumLow: { value: number };
  museumTorchPosition: { value: Vector3 };
  museumTorchDirection: { value: Vector3 };
}

/** The unlit atlas and portrait share the torch cone without re-lighting the bake. */
export function bindNightShader(
  material: MeshBasicMaterial,
  uniforms: NightUniforms,
) {
  const originalCompile = material.onBeforeCompile;
  const originalKey = material.customProgramCacheKey;
  const key = originalKey.call(material);
  material.onBeforeCompile = (shader, renderer) => {
    originalCompile.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vMuseumWorld;",
      )
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvMuseumWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying vec3 vMuseumWorld;
      uniform float museumFrom;
      uniform float museumTo;
      uniform float museumFront;
      uniform float museumLow;
      uniform vec3 museumTorchPosition;
      uniform vec3 museumTorchDirection;`,
      )
      .replace(
        "#include <tonemapping_fragment>",
        `float museumBay = clamp((vMuseumWorld.x + 15.0) / 30.0, 0.0, 1.0);
      float museumNight = mix(museumFrom, museumTo, smoothstep(museumBay - 0.04, museumBay + 0.04, museumFront));
      vec3 museumLight = mix(vec3(0.052, 0.059, 0.068), vec3(1.0), museumLow);
      if (museumNight > 0.001 && museumLow < 0.5) {
        vec3 museumRay = vMuseumWorld - museumTorchPosition;
        float museumDistance = length(museumRay);
        float museumCone = smoothstep(0.92718385, 0.95630476, dot(normalize(museumRay), museumTorchDirection));
        museumCone *= min(1.0, 8.0 / (1.0 + museumDistance * museumDistance * 0.35));
        museumLight += vec3(0.95, 0.90, 0.82) * museumCone;
      }
      gl_FragColor.rgb *= mix(vec3(1.0), museumLight, museumNight);
      #include <tonemapping_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `${key}:museum-after-hours-v1`;
  material.needsUpdate = true;
  return () => {
    material.onBeforeCompile = originalCompile;
    material.customProgramCacheKey = originalKey;
    material.needsUpdate = true;
  };
}
