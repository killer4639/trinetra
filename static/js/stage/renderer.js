// Renderer plus the "film" look: depth of field, bloom for the third eye's fire, then a
// colour grade with grain and vignette applied last so the grain sits on top of everything.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const PIXEL_RATIO_MAX = 1.5;

const FilmShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.075 },
    uVignette: { value: 1.0 },
    uWarmth: { value: 0 },
    uFade: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uWarmth, uFade;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main() {
      vec2 fromCenter = vUv - 0.5;
      float edge = dot(fromCenter, fromCenter);
      vec3 color;
      color.r = texture2D(tDiffuse, vUv - fromCenter * edge * 0.014).r;
      color.g = texture2D(tDiffuse, vUv).g;
      color.b = texture2D(tDiffuse, vUv + fromCenter * edge * 0.014).b;

      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(luma), color, 0.95);
      vec3 shadowTint = vec3(0.012, 0.02, 0.055);
      vec3 highlightTint = mix(vec3(0.96, 0.99, 1.02), vec3(1.1, 0.93, 0.76), uWarmth);
      color = shadowTint * (1.0 - luma) + color * highlightTint;

      float vignette = 1.0 - smoothstep(0.18, 0.9, length(fromCenter * vec2(1.0, 1.2)) * uVignette);
      color *= mix(0.42, 1.0, vignette);

      float grain = hash(vUv * vec2(1920.0, 1080.0) + fract(uTime * 7.13) * 100.0) - 0.5;
      color += grain * uGrain * (0.55 + 0.9 * (1.0 - luma));
      color = mix(color, vec3(1.0, 0.95, 0.85), uFade);
      gl_FragColor = vec4(color, 1.0);
    }`,
};

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_MAX));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, { focus: 20, aperture: 0.0003, maxblur: 0.01 });
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.28, 0.45, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const film = new ShaderPass(FilmShader);
  composer.addPass(film);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    composer.setSize(window.innerWidth, window.innerHeight);
  }

  return { composer, bokeh, bloom, film, resize };
}
