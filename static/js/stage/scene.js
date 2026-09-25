// Assembles the relief, moon, mala, light and atmosphere, and drives them from scroll progress.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRenderer, createComposer } from './renderer.js';
import { loadRelief } from './relief.js';
import { Mala3D } from './mala3d.js';
import { Dust, Embers } from './particles.js';
import { createCameraPath } from './camera_path.js';

const BACKGROUND = 0x04050d;
const PARALLAX_UNITS = 0.35;
const RENDER_UNTIL = 0.93;
const KEY_INTENSITY = 380;

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// A cold indigo glow behind the figure, like moonlit sky, so the silhouette separates from the dark.
function createBackHaze() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(58, 86, 170, 0.6)');
  gradient.addColorStop(0.45, 'rgba(26, 40, 96, 0.3)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 30),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, fog: false }),
  );
  haze.position.set(0.8, 2.6, -4);
  return haze;
}

function addLights(scene, renderer, eye) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;
  pmrem.dispose();

  const key = new THREE.SpotLight(0xf0f3ff, KEY_INTENSITY, 0, 0.5, 0.85, 2);
  key.position.set(-5.5, 12, 14);
  key.target.position.set(0, 0, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 6;
  key.shadow.camera.far = 34;
  const rim = new THREE.DirectionalLight(0x7e9cff, 1.6);
  rim.position.set(7, 5, -3);
  const rimLeft = new THREE.DirectionalLight(0x4e66c0, 0.8);
  rimLeft.position.set(-8, 1.5, -2);
  const eyeLight = new THREE.PointLight(0xff7a30, 0, 0, 2);
  eyeLight.position.copy(eye).add(new THREE.Vector3(0, 0, 0.4));
  scene.add(key, key.target, rim, rimLeft, eyeLight);
  return { key, eyeLight };
}

export async function createStage(canvas, ui) {
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  scene.fog = new THREE.FogExp2(BACKGROUND, 0.022);
  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.01, 80);

  const relief = await loadRelief();
  const root = new THREE.Group();
  scene.add(root);
  root.add(relief.mesh, relief.moon);
  const mala = new Mala3D(relief.surface, camera, canvas, ui);
  root.add(mala.group);
  root.updateMatrixWorld(true);
  const eye = root.localToWorld(relief.eye.clone());
  scene.add(createBackHaze());
  const dust = new Dust();
  const embers = new Embers(eye, dust.texture);
  scene.add(dust.points, embers.points);
  const lights = addLights(scene, renderer, eye);
  const path = createCameraPath(eye, {
    left: mala.frontAnchor(0.27),
    bottom: mala.frontAnchor(0.5),
    right: mala.frontAnchor(0.73),
  });
  const post = createComposer(renderer, scene, camera);

  const pointer = { x: 0, y: 0, smoothX: 0, smoothY: 0 };
  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  function placeCamera(progress, seconds, dt) {
    const shot = path.at(progress);
    // Portrait screens see less width, so pull back along the view line to keep the framing.
    const aspect = camera.aspect;
    const widen = aspect < 1 ? Math.min(1.6, 1 + (1 - aspect) * 0.9) : 1;
    const follow = 1 - Math.exp(-3 * dt);
    pointer.smoothX += (pointer.x - pointer.smoothX) * follow;
    pointer.smoothY += (pointer.y - pointer.smoothY) * follow;
    const parallax = PARALLAX_UNITS * (1 - smoothstep(0.6, 0.85, progress)) * (1 - 0.7 * smoothstep(0.12, 0.2, progress));
    camera.position.copy(shot.position).sub(shot.target).multiplyScalar(widen).add(shot.target);
    camera.position.x += pointer.smoothX * parallax + Math.sin(seconds * 0.31) * 0.03;
    camera.position.y -= pointer.smoothY * parallax * 0.6 + Math.sin(seconds * 0.47) * 0.02;
    camera.lookAt(shot.target);
    if (camera.fov !== shot.fov) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }
    post.bokeh.uniforms.focus.value = camera.position.distanceTo(shot.target);
    post.bokeh.uniforms.aperture.value = shot.aperture;
  }

  function update(progress, seconds, dt) {
    if (progress > RENDER_UNTIL) return;
    const open = smoothstep(0.56, 0.79, progress);
    relief.uniforms.uOpen.value = open;
    relief.uniforms.uLeak.value = smoothstep(0.42, 0.57, progress);
    relief.uniforms.uTime.value = seconds;
    lights.eyeLight.intensity = 1.1 * open + 0.2 * relief.uniforms.uLeak.value;
    lights.key.intensity = KEY_INTENSITY * (1 - 0.35 * open);
    post.bloom.strength = 0.28 + 0.26 * open;
    post.film.uniforms.uTime.value = seconds;
    post.film.uniforms.uWarmth.value = open * 0.5;
    post.film.uniforms.uFade.value = smoothstep(0.86, 0.905, progress);
    relief.moon.material.emissiveIntensity = 0.55 + Math.sin(seconds * 0.8) * 0.12;

    placeCamera(progress, seconds, dt);
    dust.update(seconds, dt);
    embers.update(open * 0.9, dt);
    mala.update(dt);
    post.composer.render(dt);
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    post.resize();
  }

  return { update, resize, mala };
}
