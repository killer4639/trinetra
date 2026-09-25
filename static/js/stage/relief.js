// Shiva as a 2.5D relief: the concept painting displaced by its estimated depth. The
// painting's own light is kept (emissive) and blended with scene light so the mala can cast
// shadows and the third eye can light the brow. The blue grade, tripundra, Ādiyogī's white
// mark and the third eye are painted in the shader so they stay sharp in extreme close-up.
import * as THREE from 'three';
import { MODEL } from './config.js';

const NOISE_GLSL = /* glsl */ `
  varying vec3 vObj;
  uniform float uOpen, uLeak, uTime, uGrade, uBaked;
  uniform vec3 uEye;
  uniform vec2 uShadowFloor;
  uniform float uEyeHalfHeight;
  uniform sampler2D uMask;
  float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise3(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p) { float sum = 0.0; float amp = 0.5; for (int octave = 0; octave < 4; octave++) { sum += amp * noise3(p); p *= 2.03; amp *= 0.5; } return sum; }
  // Luminance to the Nīla ramp: ink-indigo shadows, cobalt mids, moonlit highlights.
  vec3 nilaRamp(float l) {
    vec3 c0 = vec3(0.004, 0.006, 0.026);
    vec3 c1 = vec3(0.022, 0.04, 0.15);
    vec3 c2 = vec3(0.12, 0.19, 0.48);
    vec3 c3 = vec3(0.66, 0.77, 0.97);
    if (l < 0.33) return mix(c0, c1, l / 0.33);
    if (l < 0.7) return mix(c1, c2, (l - 0.33) / 0.37);
    return mix(c2, c3, (l - 0.7) / 0.3);
  }
`;

// Runs right after the albedo is sampled; declares values used by later chunks.
const SURFACE_GLSL = /* glsl */ `
  float figure = texture2D(uMask, vMapUv).r;
  if (figure < 0.5) discard;
  vec3 source = diffuseColor.rgb;
  // The map is decoded to linear light; grade and mask on perceptual lightness instead.
  float luma = pow(max(dot(source, vec3(0.2126, 0.7152, 0.0722)), 1e-5), 1.0 / 2.2);
  vec3 sourceGamma = pow(max(source, vec3(1e-5)), vec3(1.0 / 2.2));
  float blueness = sourceGamma.b - 0.5 * (sourceGamma.r + sourceGamma.g);
  vec3 nila = nilaRamp(clamp(pow(luma, 1.2), 0.0, 1.0));
  nila = mix(nila, nila * vec3(0.55, 0.8, 1.35), smoothstep(0.02, 0.1, blueness));
  vec3 skin = mix(source, nila, uGrade);
  float skinMask = smoothstep(0.3, 0.45, luma);

  // Tripundra: three soft bands of ash following the brow, broken where the third eye sits.
  vec2 q = vec2(vObj.x - uEye.x, vObj.y - uEye.y);
  float eyeScale = uEyeHalfHeight / 0.34;
  float bandEdge = (0.026 + 0.012 * (noise3(vObj * 26.0) - 0.5)) * eyeScale;
  float bands = 0.0;
  for (int band = -1; band <= 1; band++) {
    float centre = float(band) * 0.16 * eyeScale - 0.07 * q.x * q.x;
    bands = max(bands, 1.0 - smoothstep(bandEdge - 0.012, bandEdge, abs(q.y - centre)));
  }
  float bandSpan = 1.0 - smoothstep(0.85, 1.05 + 0.1 * noise3(vObj * 11.0), abs(q.x));
  float eyeGap = smoothstep(0.15 * eyeScale, 0.2 * eyeScale, abs(q.x)) + smoothstep(0.4 * eyeScale, 0.46 * eyeScale, abs(q.y));
  float ash = bands * bandSpan * clamp(eyeGap, 0.0, 1.0) * skinMask * (0.45 + 0.55 * smoothstep(0.25, 0.6, noise3(vObj * 40.0)));
  skin = mix(skin, mix(vec3(0.82, 0.84, 0.86), vec3(0.72, 0.82, 1.0), uGrade) * (0.8 + 0.3 * noise3(vObj * 70.0)), ash * 0.7);

  // Ādiyogī's white mark: a flame-shaped drop, pointed at the top, that the eye opens through.
  float along = q.y / uEyeHalfHeight;
  float markT = clamp((along + 0.55) / 1.25, 0.0, 1.0);
  float markHalfWidth = 0.6 * uEyeHalfHeight * sqrt(markT) * pow(1.0 - markT, 0.85);
  float inMark = (1.0 - smoothstep(-0.004, 0.006, abs(q.x) - markHalfWidth)) * step(-0.55, along) * step(along, 0.7);
  float markFade = 1.0 - smoothstep(0.0, 0.35, uOpen);
  skin = mix(skin, vec3(0.93, 0.95, 0.97), inMark * markFade * skinMask);

  // Third eye: a vertical almond whose width follows uOpen.
  float halfWidth = (0.004 + 0.4 * uEyeHalfHeight * uOpen) * max(0.0, 1.0 - along * along);
  float lidEdge = abs(q.x) - halfWidth;
  float inEye = (1.0 - smoothstep(-0.006, 0.004, lidEdge)) * step(abs(along), 1.0);
  float kohl = (1.0 - smoothstep(0.0, 0.024, abs(lidEdge))) * (1.0 - smoothstep(0.82, 1.08, abs(along))) * smoothstep(0.02, 0.2, uOpen);
  skin = mix(skin, vec3(0.01, 0.012, 0.03), kohl * 0.85);
  skin = mix(skin, vec3(0.02, 0.01, 0.01), inEye * smoothstep(0.0, 0.05, uOpen));

  vec2 eyeSpace = vec2(q.x / (0.4 * uEyeHalfHeight), along);
  float radial = length(eyeSpace);
  float angle = atan(eyeSpace.y, eyeSpace.x);
  float flame = fbm3(vec3(cos(angle) * 2.0, sin(angle) * 2.0, radial * 3.0 - uTime * 1.3));
  vec3 fire = mix(vec3(0.45, 0.03, 0.01), vec3(1.0, 0.36, 0.06), 1.0 - smoothstep(0.3, 0.92, radial + (flame - 0.5) * 0.6));
  fire = mix(fire, vec3(1.0, 0.86, 0.6), 1.0 - smoothstep(0.0, 0.3, length(vec2(eyeSpace.x * 2.2, eyeSpace.y)) + (flame - 0.5) * 0.3));
  float streaks = 0.65 + 0.35 * noise3(vec3(angle * 9.0, radial * 2.0, uTime * 0.4));
  float irisRim = smoothstep(0.7, 0.95, radial);
  fire *= streaks * (1.0 - 0.75 * irisRim);
  vec3 eyeEmissive = fire * inEye * uOpen * (1.3 + 1.5 * flame);
  float seam = (1.0 - smoothstep(0.0, 0.016, abs(q.x))) * (1.0 - smoothstep(0.5, 0.75, abs(along)));
  eyeEmissive += vec3(1.0, 0.45, 0.12) * seam * uLeak * (1.0 - uOpen) * 1.6;
  vec2 haloSpace = q / vec2(1.25, 1.85) / uEyeHalfHeight;
  float halo = exp(-dot(haloSpace, haloSpace) * 2.2);
  eyeEmissive += vec3(0.9, 0.32, 0.08) * halo * (uOpen * 0.1 + uLeak * 0.04);

  // The painting is cut by its frame at the shoulders and the chest; fade those edges into the dark.
  float floorShade = smoothstep(uShadowFloor.x, uShadowFloor.y, vObj.y)
    * (1.0 - smoothstep(3.5, 4.85, abs(vObj.x)))
    * (1.0 - smoothstep(4.7, 4.98, vObj.y));
  vec3 painted = skin * floorShade;
  diffuseColor.rgb = painted;
`;

async function loadHeights() {
  const response = await fetch(MODEL.heightUrl);
  if (!response.ok) throw new Error(`relief heights: HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  const expected = MODEL.grid * MODEL.grid;
  if (buffer.byteLength !== expected * 2) throw new Error(`relief heights: expected ${expected * 2} bytes, got ${buffer.byteLength}`);
  const view = new DataView(buffer);
  const heights = new Float32Array(expected);
  for (let index = 0; index < expected; index += 1) heights[index] = (view.getUint16(index * 2, true) / 65535) * MODEL.depth;
  return heights;
}

// Bilinear height lookup in world units; x, y in model space.
function createSurface(heights) {
  const cells = MODEL.grid - 1;
  function heightAt(x, y) {
    const column = THREE.MathUtils.clamp((x / MODEL.size + 0.5) * cells, 0, cells);
    const row = THREE.MathUtils.clamp((0.5 - y / MODEL.size) * cells, 0, cells);
    const c0 = Math.min(cells - 1, Math.floor(column));
    const r0 = Math.min(cells - 1, Math.floor(row));
    const fc = column - c0;
    const fr = row - r0;
    const at = (r, c) => heights[r * MODEL.grid + c];
    const top = at(r0, c0) * (1 - fc) + at(r0, c0 + 1) * fc;
    const bottom = at(r0 + 1, c0) * (1 - fc) + at(r0 + 1, c0 + 1) * fc;
    return top * (1 - fr) + bottom * fr;
  }
  function normalAt(x, y) {
    const step = MODEL.size / cells;
    const dx = (heightAt(x + step, y) - heightAt(x - step, y)) / (2 * step);
    const dy = (heightAt(x, y + step) - heightAt(x, y - step)) / (2 * step);
    return new THREE.Vector3(-dx, -dy, 1).normalize();
  }
  return { heightAt, normalAt };
}

function createGeometry(heights) {
  const cells = MODEL.grid - 1;
  const geometry = new THREE.PlaneGeometry(MODEL.size, MODEL.size, cells, cells);
  const position = geometry.attributes.position;
  if (position.count !== heights.length) throw new Error('relief grid does not match the plane');
  for (let index = 0; index < position.count; index += 1) position.setZ(index, heights[index]);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function loadTexture(loader, url, isColor) {
  const texture = loader.load(url);
  texture.anisotropy = 8;
  texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return texture;
}

function createMaterial(uniforms) {
  const loader = new THREE.TextureLoader();
  uniforms.uMask = { value: loadTexture(loader, MODEL.maskUrl, false) };
  const material = new THREE.MeshPhysicalMaterial({
    map: loadTexture(loader, MODEL.albedoUrl, true),
    roughness: 0.5,
    sheen: 0.7,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color(0x5f7fd0),
    specularIntensity: 0.4,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${SURFACE_GLSL}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, max(1.0 - skinMask, ash));')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += painted * uBaked + eyeEmissive;');
  };
  return material;
}

function crescentGeometry(radius) {
  const tipAngle = 2.2;
  const thickness = radius * 0.36;
  const steps = 48;
  const shape = new THREE.Shape();
  for (let step = 0; step <= steps; step += 1) {
    const angle = -tipAngle + (2 * tipAngle * step) / steps;
    if (step === 0) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  for (let step = steps - 1; step >= 1; step -= 1) {
    const angle = -tipAngle + (2 * tipAngle * step) / steps;
    const inner = radius - thickness * Math.cos((angle / tipAngle) * (Math.PI / 2));
    shape.lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
  }
  return new THREE.ExtrudeGeometry(shape, { depth: radius * 0.1, bevelEnabled: true, bevelThickness: radius * 0.04, bevelSize: radius * 0.035, bevelSegments: 4, curveSegments: 4 });
}

// Ādiyogī's crescent: polished silver, tips pointing up and out from the temple.
function createMoon(surface) {
  const { x, y, radius, lift } = MODEL.moon;
  const moon = new THREE.Mesh(
    crescentGeometry(radius),
    new THREE.MeshPhysicalMaterial({ color: 0xdfe8f6, metalness: 0.85, roughness: 0.22, emissive: 0x9fb8ff, emissiveIntensity: 0.55, clearcoat: 1 }),
  );
  moon.position.set(x, y, surface.heightAt(x - radius, y) + lift);
  moon.rotation.set(0, -0.25, 2.55);
  moon.castShadow = true;
  return moon;
}

export async function loadRelief() {
  const heights = await loadHeights();
  const surface = createSurface(heights);
  const eye = new THREE.Vector3(MODEL.thirdEye.x, MODEL.thirdEye.y, surface.heightAt(MODEL.thirdEye.x, MODEL.thirdEye.y));
  const uniforms = {
    uOpen: { value: 0 },
    uLeak: { value: 0 },
    uTime: { value: 0 },
    uGrade: { value: MODEL.grade },
    uBaked: { value: 0.55 },
    uEye: { value: eye.clone() },
    uEyeHalfHeight: { value: MODEL.thirdEye.halfHeight },
    uShadowFloor: { value: new THREE.Vector2(MODEL.shadowFloor.black, MODEL.shadowFloor.lit) },
  };
  const mesh = new THREE.Mesh(createGeometry(heights), createMaterial(uniforms));
  mesh.receiveShadow = true;
  const moon = createMoon(surface);
  return { mesh, moon, surface, uniforms, eye };
}
