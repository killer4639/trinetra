// The inside of the third eye: a warp tunnel of light streaks with Shiva/Shakti
// triangles (yantra gateways) rushing past, converging on a white-gold core.
import { lerp, smoothstep } from './math.js';

const STREAK_COUNT = 650;
const GATE_INTERVAL_SECONDS = 0.55;
const GATE_COUNT_MAX = 24;
const PIXEL_RATIO_MAX = 1.5;
const DEPTH_NEAR = 0.03;
const PALETTE = ['#ffd9a0', '#ff9a4a', '#e0662e', '#f3e6cf', '#c9a36a', '#fff3e0'];

export class Portal {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.streaks = [];
    this.gates = [];
    this.twist = 0;
    this.gateTimer = 0;
    this.gateFlip = false;
    for (let index = 0; index < STREAK_COUNT; index += 1) this.streaks.push(this.spawnStreak(Math.random()));
    this.resize();
  }

  spawnStreak(depth) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.15 + Math.random() * 1.2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: depth, color: PALETTE[(Math.random() * PALETTE.length) | 0] };
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_MAX);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.fillStyle = '#0a0604';
    this.context.fillRect(0, 0, this.width, this.height);
  }

  draw(progress, dt) {
    const { context, width, height } = this;
    const speed = lerp(0.35, 1.7, smoothstep(0.88, 0.97, progress));
    this.twist += dt * (0.25 + speed * 0.5);
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = 'rgba(10, 6, 4, 0.32)';
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    const focal = Math.min(width, height) * 0.5;
    this.drawStreaks(focal, speed, dt);
    this.drawGates(focal, speed, dt);
    this.drawCore(progress, focal);
    context.globalCompositeOperation = 'source-over';
  }

  project(x, y, z, focal) {
    const cos = Math.cos(this.twist * (1 - z));
    const sin = Math.sin(this.twist * (1 - z));
    return {
      x: this.width / 2 + ((x * cos - y * sin) / z) * focal,
      y: this.height / 2 + ((x * sin + y * cos) / z) * focal,
    };
  }

  drawStreaks(focal, speed, dt) {
    const { context } = this;
    context.lineWidth = 1.4;
    for (let index = 0; index < this.streaks.length; index += 1) {
      const streak = this.streaks[index];
      const tail = streak.z;
      streak.z -= speed * dt;
      if (streak.z < DEPTH_NEAR) {
        this.streaks[index] = this.spawnStreak(1);
        continue;
      }
      const from = this.project(streak.x, streak.y, tail + 0.02, focal);
      const to = this.project(streak.x, streak.y, streak.z, focal);
      context.globalAlpha = Math.min(1, (1 - streak.z) * 1.4);
      context.strokeStyle = streak.color;
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  drawGates(focal, speed, dt) {
    this.gateTimer += dt;
    if (this.gateTimer >= GATE_INTERVAL_SECONDS && this.gates.length < GATE_COUNT_MAX) {
      this.gateTimer = 0;
      this.gateFlip = !this.gateFlip;
      this.gates.push({ z: 1.4, pointsUp: this.gateFlip });
    }
    const { context } = this;
    const survivors = [];
    for (const gate of this.gates) {
      gate.z -= speed * dt * 0.8;
      if (gate.z < DEPTH_NEAR * 2) continue;
      survivors.push(gate);
      const radius = (0.9 / gate.z) * focal * 0.5;
      const rotation = this.twist * 0.6 + (gate.pointsUp ? 0 : Math.PI);
      context.globalAlpha = Math.min(1, (1.4 - gate.z) * 1.2) * Math.min(1, gate.z * 3);
      context.strokeStyle = gate.pointsUp ? '#ffcf6b' : '#ff7a4a';
      context.lineWidth = Math.max(1, 2.2 / gate.z);
      context.beginPath();
      for (let corner = 0; corner <= 3; corner += 1) {
        const angle = rotation - Math.PI / 2 + (corner * Math.PI * 2) / 3;
        const x = this.width / 2 + Math.cos(angle) * radius;
        const y = this.height / 2 + Math.sin(angle) * radius;
        if (corner === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
    this.gates = survivors;
    context.globalAlpha = 1;
  }

  drawCore(progress, focal) {
    const { context, width, height } = this;
    const bloom = smoothstep(0.9, 0.99, progress);
    const radius = focal * lerp(0.12, 1.6, bloom);
    const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, radius);
    gradient.addColorStop(0, `rgba(255, 250, 235, ${0.55 + 0.45 * bloom})`);
    gradient.addColorStop(0.3, `rgba(255, 200, 110, ${0.25 + 0.4 * bloom})`);
    gradient.addColorStop(1, 'rgba(255, 120, 40, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
}
