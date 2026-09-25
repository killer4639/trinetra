// The rudrākṣa mala: displaced bead geometry laid along a loop that rests on the neck and
// chest. Beads slide along the loop when dragged (they follow the pointer), keep a little
// inertia, and each one opens its card when clicked.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MODEL } from './config.js';

const SKIN_CLEARANCE = 0.2;
const BEAD_FILL = 0.47;
const DRAG_THRESHOLD_PX = 6;
const VELOCITY_DECAY_PER_SECOND = 2.4;
const VELOCITY_MAX = 0.6;
const IDLE_DRIFT = 0.0035;
const GURU_SCALE = 1.32;
const HOVER_COLOR = new THREE.Color(2.1, 1.55, 1.05);
const BASE_COLOR = new THREE.Color(1, 1, 1);
// Share of the loop's samples on the visible chest side.
const FRONT_SHARE = 0.72;

function hash3(x, y, z) {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function valueNoise(x, y, z) {
  const ix = Math.floor(x); const iy = Math.floor(y); const iz = Math.floor(z);
  const fx = x - ix; const fy = y - iy; const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx); const uy = fy * fy * (3 - 2 * fy); const uz = fz * fz * (3 - 2 * fz);
  let sum = 0;
  for (let corner = 0; corner < 8; corner += 1) {
    const cx = corner & 1; const cy = (corner >> 1) & 1; const cz = (corner >> 2) & 1;
    const weight = (cx ? ux : 1 - ux) * (cy ? uy : 1 - uy) * (cz ? uz : 1 - uz);
    sum += weight * hash3(ix + cx, iy + cy, iz + cz);
  }
  return sum;
}

// A rudrākṣa: slightly flattened, five deep meridian grooves (pañcamukhī), craggy ridged
// lobes between them, holes at the poles. Crevices are darkened through vertex colours.
function createBeadGeometry() {
  let geometry = new THREE.IcosahedronGeometry(1, 6);
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  geometry = mergeVertices(geometry);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const point = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index).normalize();
    const polar = Math.abs(point.y);
    const around = Math.atan2(point.z, point.x);
    const groove = Math.pow(Math.max(0, Math.cos(5 * around)), 34) * (1 - Math.pow(polar, 4));
    const coarse = 1 - Math.abs(2 * valueNoise(point.x * 5.5 + 3, point.y * 5.5, point.z * 5.5) - 1);
    const fine = 1 - Math.abs(2 * valueNoise(point.x * 13 + 7, point.y * 13, point.z * 13) - 1);
    const crags = coarse * 0.62 + fine * 0.38;
    const hole = THREE.MathUtils.smoothstep(polar, 0.9, 0.99) * 0.3;
    const relief = 0.16 * (crags - 0.55) - 0.2 * groove - hole;
    point.multiplyScalar(1 + relief);
    point.y *= 0.88;
    position.setXYZ(index, point.x, point.y, point.z);
    const shade = THREE.MathUtils.clamp(0.45 + (relief + 0.12) * 3.2, 0.28, 1.15);
    colors[index * 3] = shade;
    colors[index * 3 + 1] = shade * 0.92;
    colors[index * 3 + 2] = shade * 0.86;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// The loop: a U laid on the relief from one side of the neck, over the chest, to the other,
// then closing behind the neck where the relief hides it.
function createLoopCurve(surface) {
  const { sideX, topY, bottomY, backLift, backDepth, samples } = MODEL.mala;
  const frontSamples = Math.round(samples * FRONT_SHARE);
  const points = [];
  for (let sample = 0; sample <= frontSamples; sample += 1) {
    const phase = -Math.PI / 2 + (Math.PI * sample) / frontSamples;
    const x = sideX * Math.sin(phase);
    const y = topY - (topY - bottomY) * Math.pow(Math.max(0, Math.cos(phase)), 2);
    const normal = surface.normalAt(x, y).lerp(new THREE.Vector3(0, 0, 1), 0.3).normalize();
    points.push(new THREE.Vector3(x, y, surface.heightAt(x, y)).addScaledVector(normal, SKIN_CLEARANCE));
  }
  const backZ = surface.heightAt(0, topY) - backDepth;
  const backSamples = samples - frontSamples;
  for (let sample = 1; sample < backSamples; sample += 1) {
    const phase = Math.PI / 2 + (Math.PI * sample) / backSamples;
    const lift = backLift * Math.sin((Math.PI * sample) / backSamples);
    points.push(new THREE.Vector3(sideX * Math.sin(phase), topY + lift, backZ));
  }
  return new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
}

// A silk tassel: a bound knot and a flared bundle of thin threads hanging from the guru bead.
function createTassel() {
  const silk = new THREE.MeshPhysicalMaterial({ color: 0x6a1a0e, roughness: 0.7, sheen: 1, sheenColor: new THREE.Color(0xd2603a), sheenRoughness: 0.35 });
  const threads = [];
  const threadCount = 48;
  for (let thread = 0; thread < threadCount; thread += 1) {
    const angle = (thread / threadCount) * Math.PI * 2 + Math.sin(thread * 12.9898) * 0.3;
    const flare = 0.05 + 0.1 * Math.abs(Math.sin(thread * 78.233));
    const length = 0.8 + 0.12 * Math.abs(Math.sin(thread * 3.7));
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(Math.cos(angle) * 0.03, -0.2, Math.sin(angle) * 0.03),
      new THREE.Vector3(Math.cos(angle) * flare * 0.7, -0.2 - length * 0.5, Math.sin(angle) * flare * 0.7),
      new THREE.Vector3(Math.cos(angle) * flare, -0.2 - length, Math.sin(angle) * flare),
    );
    threads.push(new THREE.TubeGeometry(curve, 10, 0.011, 4, false));
  }
  const bundle = new THREE.Mesh(mergeGeometries(threads), silk);
  for (const geometry of threads) geometry.dispose();
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), silk);
  knot.scale.set(1, 1.5, 1);
  knot.position.y = -0.16;
  bundle.castShadow = true;
  const group = new THREE.Group();
  group.add(bundle, knot);
  return group;
}

export class Mala3D {
  constructor(surface, camera, canvas, ui) {
    this.surface = surface;
    this.camera = camera;
    this.canvas = canvas;
    this.ui = ui;
    this.curve = createLoopCurve(surface);
    this.count = MODEL.mala.beadCount;
    this.radius = (this.curve.getLength() / this.count) * BEAD_FILL;
    this.summaries = [];
    this.offset = 0;
    this.velocity = 0;
    this.interactive = true;
    this.hovered = -1;
    this.drag = null;
    this.pointer = { x: 0, y: 0, inside: false, dirty: false };
    this.raycaster = new THREE.Raycaster();
    this.group = new THREE.Group();
    this.buildMeshes();
    this.wirePointer();
    this.layout();
  }

  buildMeshes() {
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x7a3d20, vertexColors: true, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xb86a3c),
    });
    this.beads = new THREE.InstancedMesh(createBeadGeometry(), material, this.count);
    this.beads.castShadow = true;
    this.beads.receiveShadow = true;
    for (let index = 0; index < this.count; index += 1) this.beads.setColorAt(index, BASE_COLOR);
    const threadMaterial = new THREE.MeshStandardMaterial({ color: 0x4a0d0a, roughness: 0.8 });
    this.thread = new THREE.Mesh(new THREE.TubeGeometry(this.curve, 480, this.radius * 0.12, 6, true), threadMaterial);
    this.tassel = createTassel();
    this.tassel.scale.setScalar(this.radius / 0.24);
    this.group.add(this.thread, this.beads, this.tassel);
  }

  beadParameter(index) {
    const value = this.offset + index / this.count;
    return value - Math.floor(value);
  }

  layout() {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const twist = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const scale = new THREE.Vector3();
    for (let index = 0; index < this.count; index += 1) {
      const parameter = this.beadParameter(index);
      const position = this.curve.getPointAt(parameter);
      quaternion.setFromUnitVectors(up, this.curve.getTangentAt(parameter));
      quaternion.multiply(twist.setFromAxisAngle(up, index * 2.39));
      scale.setScalar(this.radius * (index === 0 ? GURU_SCALE : 1));
      this.beads.setMatrixAt(index, matrix.compose(position, quaternion, scale));
      if (index === 0) this.tassel.position.copy(position).add(new THREE.Vector3(0, -this.radius * GURU_SCALE * 0.7, 0.03));
    }
    this.beads.instanceMatrix.needsUpdate = true;
  }

  setBeads(summaries) {
    this.summaries = summaries.slice(0, this.count);
  }

  setInteractive(interactive) {
    if (interactive === this.interactive) return;
    this.interactive = interactive;
    if (!interactive) this.setHovered(-1);
  }

  wirePointer() {
    const canvas = this.canvas;
    canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
    canvas.addEventListener('pointerleave', () => { this.pointer.inside = false; this.pointer.dirty = true; });
    canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));
    canvas.addEventListener('pointercancel', () => { this.drag = null; });
  }

  onPointerMove(event) {
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    this.pointer.inside = true;
    this.pointer.dirty = true;
    if (!this.drag) return;
    const moved = Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY);
    if (moved > DRAG_THRESHOLD_PX) this.drag.moved = true;
    if (!this.drag.moved) return;
    const step = this.screenStep(this.beadParameter(this.drag.index), event.clientX - this.drag.lastX, event.clientY - this.drag.lastY);
    this.offset += step;
    const seconds = Math.max(1e-3, (event.timeStamp - this.drag.lastTime) / 1000);
    this.velocity = THREE.MathUtils.clamp(this.velocity * 0.5 + (step / seconds) * 0.5, -VELOCITY_MAX, VELOCITY_MAX);
    this.drag.lastX = event.clientX;
    this.drag.lastY = event.clientY;
    this.drag.lastTime = event.timeStamp;
    this.layout();
  }

  // Converts a pointer movement into a slide along the loop so the grabbed bead tracks the pointer.
  screenStep(parameter, deltaX, deltaY) {
    const delta = 0.004;
    const from = this.toScreen(this.curve.getPointAt(parameter));
    const to = this.toScreen(this.curve.getPointAt((parameter + delta) % 1));
    const tangentX = to.x - from.x;
    const tangentY = to.y - from.y;
    const lengthSquared = tangentX * tangentX + tangentY * tangentY;
    if (lengthSquared < 0.25) return (deltaX / Math.max(1, window.innerWidth)) * 0.25;
    return ((deltaX * tangentX + deltaY * tangentY) / lengthSquared) * delta;
  }

  onPointerDown(event) {
    if (!this.interactive || event.button !== 0) return;
    this.pointer.x = event.clientX;
    this.pointer.y = event.clientY;
    const index = this.pick();
    if (index < 0) return;
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    this.velocity = 0;
    this.drag = { index, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, lastTime: event.timeStamp, moved: false };
    this.canvas.style.cursor = 'grabbing';
  }

  onPointerUp(event) {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (drag.moved) return;
    this.velocity = 0;
    const summary = this.summaries[drag.index] || { title: 'Rudrākṣa', subtitle: '' };
    this.ui.openBead(drag.index, summary);
  }

  toScreen(localPoint) {
    const projected = localPoint.clone().applyMatrix4(this.group.matrixWorld).project(this.camera);
    return { x: (projected.x * 0.5 + 0.5) * window.innerWidth, y: (-projected.y * 0.5 + 0.5) * window.innerHeight, z: projected.z };
  }

  pick() {
    const ndc = new THREE.Vector2((this.pointer.x / window.innerWidth) * 2 - 1, -(this.pointer.y / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObject(this.beads, false);
    if (hits.length === 0 || hits[0].instanceId === undefined) return -1;
    // Beads behind the neck are hidden by the relief; they must not be pickable through it.
    const local = this.group.worldToLocal(hits[0].point.clone());
    if (local.z < this.surface.heightAt(local.x, local.y) - 0.02) return -1;
    return hits[0].instanceId;
  }

  setHovered(index) {
    if (index === this.hovered) return;
    if (this.hovered >= 0) this.beads.setColorAt(this.hovered, BASE_COLOR);
    if (index >= 0) this.beads.setColorAt(index, HOVER_COLOR);
    this.beads.instanceColor.needsUpdate = true;
    this.hovered = index;
    if (!this.drag) this.canvas.style.cursor = index >= 0 ? 'pointer' : '';
    if (index < 0) this.ui.hideTooltip();
  }

  updateTooltip() {
    if (this.hovered < 0 || this.drag?.moved) {
      this.ui.hideTooltip();
      return;
    }
    const summary = this.summaries[this.hovered];
    if (!summary) return;
    const centre = this.curve.getPointAt(this.beadParameter(this.hovered));
    const top = this.toScreen(centre.clone().add(new THREE.Vector3(0, this.radius * 1.4, 0)));
    this.ui.showTooltipAt(summary, top.x, top.y);
  }

  update(dt) {
    if (!this.drag) {
      this.velocity *= Math.exp(-VELOCITY_DECAY_PER_SECOND * dt);
      this.offset += (this.velocity + IDLE_DRIFT) * dt;
      this.layout();
    }
    this.offset -= Math.floor(this.offset);
    if (this.interactive && (this.pointer.dirty || this.drag)) {
      this.pointer.dirty = false;
      this.setHovered(this.drag ? this.drag.index : (this.pointer.inside ? this.pick() : -1));
    }
    if (this.interactive) this.updateTooltip();
  }

  // World-space centre of a bead, for camera framing.
  beadPosition(index) {
    return this.curve.getPointAt(this.beadParameter(index));
  }

  // World-space point on the visible chest arc: 0 = left neck side, 0.5 = lowest, 1 = right.
  frontAnchor(fraction) {
    assert01(fraction);
    const parameter = (fraction * Math.round(MODEL.mala.samples * FRONT_SHARE)) / MODEL.mala.samples;
    this.group.updateMatrixWorld(true);
    return this.curve.getPoint(parameter).applyMatrix4(this.group.matrixWorld);
  }
}

function assert01(value) {
  if (!(value >= 0 && value <= 1)) throw new Error(`expected a fraction in [0, 1], got ${value}`);
}
