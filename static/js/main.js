import { createStage } from './stage/scene.js';
import { Portal } from './portal.js';
import { initUi } from './ui.js';
import { fetchJson } from './api.js';
import { clamp, smoothstep, windowOpacity } from './math.js';
import { initRealm } from './realm.js';

const MALA_INTERACTIVE_UNTIL = 0.47;
const PROGRESS_EASE_PER_SECOND = 5;
const FRAME_SECONDS_MAX = 0.05;
const FALLBACK_BEAD_COUNT = 28;
const CHAPTER_COUNT = 5;

const journey = document.getElementById('journey');
const portalCanvas = document.getElementById('portal');
const flash = document.getElementById('flash');
const hints = document.getElementById('hints');
const loader = document.getElementById('loader');
const railDot = document.querySelector('#rail i');
const chapterCounter = document.getElementById('chapter-counter');
const captions = [];
for (const element of document.querySelectorAll('.caption')) {
  captions.push({ element, window: element.dataset.window.split(',').map(Number), chapter: Number(element.dataset.chapter || 0) });
}

const ui = initUi();
const portal = new Portal(portalCanvas);
let stage = null;
let beadSummaries = [];

let targetProgress = 0;
let progress = 0;
let lastFrame = performance.now();
const pinnedProgress = readPinnedProgress();

function readScroll() {
  if (pinnedProgress !== null) {
    targetProgress = pinnedProgress;
    return;
  }
  const span = journey.offsetHeight - window.innerHeight;
  targetProgress = span > 0 ? clamp(window.scrollY / span, 0, 1) : 0;
}

function onResize() {
  if (stage) stage.resize();
  portal.resize();
  readScroll();
}

function updateOverlays() {
  let chapter = 0;
  for (const caption of captions) {
    const opacity = windowOpacity(caption.window, progress);
    caption.element.style.opacity = opacity.toFixed(3);
    caption.element.style.visibility = opacity > 0 ? 'visible' : 'hidden';
    caption.element.style.setProperty('--rise', `${((1 - opacity) * 14).toFixed(1)}px`);
    if (caption.chapter > 0 && progress >= caption.window[0]) chapter = caption.chapter;
  }
  chapterCounter.textContent = `${chapter} / ${CHAPTER_COUNT}`;
  railDot.style.top = `${(progress * 100).toFixed(2)}%`;
  hints.style.opacity = (1 - smoothstep(0.02, 0.07, progress)).toFixed(3);
  flash.style.opacity = smoothstep(0.94, 0.99, progress).toFixed(3);
}

function frame(now) {
  const dt = Math.min(FRAME_SECONDS_MAX, (now - lastFrame) / 1000);
  lastFrame = now;
  progress += (targetProgress - progress) * (1 - Math.exp(-PROGRESS_EASE_PER_SECOND * dt));
  if (Math.abs(targetProgress - progress) < 1e-4) progress = targetProgress;

  if (stage) {
    stage.mala.setInteractive(progress < MALA_INTERACTIVE_UNTIL);
    stage.update(progress, now / 1000, dt);
  }
  const portalOpacity = smoothstep(0.875, 0.91, progress);
  portalCanvas.style.opacity = portalOpacity.toFixed(3);
  if (portalOpacity > 0 && progress < 0.995) portal.draw(progress, dt);
  updateOverlays();
  requestAnimationFrame(frame);
}

// Keyboard and screen-reader route to every bead, mirroring the clickable 3D mala.
function renderBeadIndex(summaries) {
  const nav = document.getElementById('bead-index');
  nav.replaceChildren();
  for (const summary of summaries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${summary.title} ${summary.subtitle || ''}`.trim();
    button.addEventListener('click', () => ui.openBead(summary.index, summary));
    nav.append(button);
  }
}

async function loadContent() {
  try {
    beadSummaries = await fetchJson('/api/beads');
  } catch (error) {
    console.error('beads unavailable, showing an unnamed mala', error);
    beadSummaries = [];
    for (let index = 0; index < FALLBACK_BEAD_COUNT; index += 1) beadSummaries.push({ index, title: 'Rudraksha', subtitle: '' });
  }
  renderBeadIndex(beadSummaries);
  if (stage) stage.mala.setBeads(beadSummaries);
}

async function loadStage() {
  try {
    stage = await createStage(document.getElementById('gl'), ui);
    stage.mala.setBeads(beadSummaries);
    if (new URLSearchParams(window.location.search).has('debug')) window.trinetraStage = stage;
    loader.classList.add('gone');
  } catch (error) {
    console.error('the 3D stage failed to load', error);
    loader.replaceChildren(document.createTextNode('The vision could not be rendered on this device.'));
  }
}

// `?p=0.4` pins the journey at that point and ignores scrolling (handy while designing).
function readPinnedProgress() {
  const text = new URLSearchParams(window.location.search).get('p');
  if (text === null) return null;
  const requested = Number(text);
  return Number.isFinite(requested) ? clamp(requested, 0, 1) : null;
}

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const realm = initRealm(document.getElementById('realm'));
window.addEventListener('scroll', readScroll, { passive: true });
window.addEventListener('scroll', realm.update, { passive: true });
window.addEventListener('resize', onResize);
window.addEventListener('resize', realm.update);
document.getElementById('to-surface').addEventListener('click', (event) => {
  event.preventDefault();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

readScroll();
realm.update();
progress = targetProgress;
loadContent();
loadStage();
requestAnimationFrame(frame);
