// The inside of the third eye: stillness, not a storm. A single bindu breathes at the centre,
// spanda ripples widen from it like rings on still water, and a few motes of dust drift past
// only as fast as the reader scrolls. At the end the bindu swells into the white light.
import { lerp, smoothstep } from './math.js';

const PIXEL_RATIO_MAX = 1.5;
const INK = '#0b0d0e';

const RIPPLE_COUNT = 7;
const RIPPLE_SECONDS_PER_CYCLE = 14;
const RIPPLE_CYCLES_PER_JOURNEY = 1.2;
const RIPPLE_REACH = 1.7;

const MOTE_COUNT = 140;
const MOTE_DEPTH_NEAR = 0.08;
const MOTE_DEPTHS_PER_JOURNEY = 2.4;
const MOTE_DRIFT_PER_SECOND = 0.004;

const BREATH_SECONDS = 6;
// The slice of total scroll progress during which this canvas is visible.
const JOURNEY_START = 0.875;
const JOURNEY_END = 0.995;

function fraction(value) {
  return value - Math.floor(value);
}

export class Portal {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.seconds = 0;
    this.motes = [];
    for (let index = 0; index < MOTE_COUNT; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.25 + Math.random() * 1.1;
      this.motes.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, depthSeed: Math.random(), size: 0.5 + Math.random() * 1.1 });
    }
    this.resize();
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, PIXEL_RATIO_MAX);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.fillStyle = INK;
    this.context.fillRect(0, 0, this.width, this.height);
  }

  draw(progress, dt) {
    const { context, width, height } = this;
    this.seconds += dt;
    const journey = smoothstep(JOURNEY_START, JOURNEY_END, progress);
    const focal = Math.min(width, height) * 0.5;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = INK;
    context.fillRect(0, 0, width, height);
    this.drawGlow(focal, journey);
    context.globalCompositeOperation = 'lighter';
    this.drawRipples(focal, journey);
    this.drawMotes(focal, journey);
    context.globalCompositeOperation = 'source-over';
    this.drawBindu(focal, journey);
  }

  drawGlow(focal, journey) {
    const { context, width, height } = this;
    const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, focal * 1.6);
    gradient.addColorStop(0, `rgba(200, 164, 108, ${(0.1 + 0.12 * journey).toFixed(3)})`);
    gradient.addColorStop(1, 'rgba(200, 164, 108, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  // Rings are born at the bindu and widen with both time and scroll; scrolling moves you through them.
  drawRipples(focal, journey) {
    const { context, width, height } = this;
    const phase = this.seconds / RIPPLE_SECONDS_PER_CYCLE + journey * RIPPLE_CYCLES_PER_JOURNEY;
    const fadeOut = 1 - smoothstep(0.8, 1, journey);
    context.lineWidth = 1;
    context.strokeStyle = '#c8a46c';
    for (let index = 0; index < RIPPLE_COUNT; index += 1) {
      const age = fraction(phase + index / RIPPLE_COUNT);
      const radius = focal * RIPPLE_REACH * age * age;
      context.globalAlpha = Math.sin(Math.PI * age) * 0.28 * fadeOut;
      context.beginPath();
      context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  drawMotes(focal, journey) {
    const { context, width, height } = this;
    const travel = journey * MOTE_DEPTHS_PER_JOURNEY + this.seconds * MOTE_DRIFT_PER_SECOND;
    context.fillStyle = '#f3e6cf';
    for (const mote of this.motes) {
      const depth = MOTE_DEPTH_NEAR + (1 - MOTE_DEPTH_NEAR) * fraction(mote.depthSeed - travel);
      const x = width / 2 + (mote.x / depth) * focal;
      const y = height / 2 + (mote.y / depth) * focal;
      const nearness = 1 - depth;
      context.globalAlpha = smoothstep(0, 0.35, nearness) * (1 - smoothstep(0.8, 0.92, nearness)) * 0.5;
      context.beginPath();
      context.arc(x, y, mote.size * (0.6 + nearness * 1.4), 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  // The same light as #flash, so the hand-off to the realm is seamless.
  drawBindu(focal, journey) {
    const { context, width, height } = this;
    const breath = 1 + 0.08 * Math.sin((this.seconds * Math.PI * 2) / BREATH_SECONDS);
    const swell = smoothstep(0.55, 1, journey);
    const radius = focal * lerp(0.07, 1.9, swell * swell) * breath;
    const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, radius);
    gradient.addColorStop(0, 'rgba(255, 248, 234, 1)');
    gradient.addColorStop(0.18, 'rgba(243, 220, 184, 0.75)');
    gradient.addColorStop(0.5, 'rgba(202, 164, 119, 0.18)');
    gradient.addColorStop(1, 'rgba(202, 164, 119, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
}
