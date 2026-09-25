// Floating ash (bhasma) caught in the light, and embers that pour from the open third eye.
import * as THREE from 'three';

const DUST_COUNT = 520;
const EMBER_COUNT = 220;
const DUST_BOX = { x: 9, yMin: -5, yMax: 7.5, zMin: -4, zMax: 12 };

function softDotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function pointsMaterial(texture, color, size, opacity) {
  return new THREE.PointsMaterial({
    map: texture, color, size, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
}

export class Dust {
  constructor(texture = softDotTexture()) {
    this.texture = texture;
    this.positions = new Float32Array(DUST_COUNT * 3);
    this.phases = new Float32Array(DUST_COUNT);
    for (let index = 0; index < DUST_COUNT; index += 1) {
      this.positions[index * 3] = (Math.random() * 2 - 1) * DUST_BOX.x;
      this.positions[index * 3 + 1] = DUST_BOX.yMin + Math.random() * (DUST_BOX.yMax - DUST_BOX.yMin);
      this.positions[index * 3 + 2] = DUST_BOX.zMin + Math.random() * (DUST_BOX.zMax - DUST_BOX.zMin);
      this.phases[index] = Math.random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = pointsMaterial(texture, 0xbccaff, 0.055, 0.5);
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  update(seconds, dt) {
    const positions = this.positions;
    for (let index = 0; index < DUST_COUNT; index += 1) {
      const phase = this.phases[index];
      positions[index * 3] += Math.sin(seconds * 0.21 + phase) * 0.05 * dt;
      positions[index * 3 + 1] += (0.07 + 0.04 * Math.sin(phase)) * dt;
      positions[index * 3 + 2] += Math.cos(seconds * 0.17 + phase) * 0.04 * dt;
      if (positions[index * 3 + 1] > DUST_BOX.yMax) positions[index * 3 + 1] = DUST_BOX.yMin;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

export class Embers {
  constructor(origin, texture = softDotTexture()) {
    this.origin = origin.clone();
    this.positions = new Float32Array(EMBER_COUNT * 3);
    this.velocities = new Float32Array(EMBER_COUNT * 3);
    this.ages = new Float32Array(EMBER_COUNT);
    this.lifetimes = new Float32Array(EMBER_COUNT);
    for (let index = 0; index < EMBER_COUNT; index += 1) this.respawn(index, Math.random());
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = pointsMaterial(texture, 0xffa04a, 0.06, 0);
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  respawn(index, age01) {
    const angle = Math.random() * Math.PI * 2;
    const spread = 0.12 + Math.random() * 0.5;
    this.positions[index * 3] = this.origin.x + (Math.random() - 0.5) * 0.12;
    this.positions[index * 3 + 1] = this.origin.y + (Math.random() - 0.5) * 0.5;
    this.positions[index * 3 + 2] = this.origin.z + 0.02;
    this.velocities[index * 3] = Math.cos(angle) * spread;
    this.velocities[index * 3 + 1] = Math.sin(angle) * spread * 0.6 + 0.35;
    this.velocities[index * 3 + 2] = 0.35 + Math.random() * 0.9;
    this.lifetimes[index] = 1.4 + Math.random() * 2.2;
    this.ages[index] = age01 * this.lifetimes[index];
  }

  update(intensity, dt) {
    this.material.opacity = intensity;
    this.points.visible = intensity > 0.001;
    if (!this.points.visible) return;
    for (let index = 0; index < EMBER_COUNT; index += 1) {
      this.ages[index] += dt;
      if (this.ages[index] > this.lifetimes[index]) {
        this.respawn(index, 0);
        continue;
      }
      this.velocities[index * 3 + 1] += 0.25 * dt;
      this.positions[index * 3] += this.velocities[index * 3] * dt;
      this.positions[index * 3 + 1] += this.velocities[index * 3 + 1] * dt;
      this.positions[index * 3 + 2] += this.velocities[index * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
