// Scroll-driven reveals inside the third eye. Each `.scene` is taller than the viewport and
// pins its `.scene-frame`; scrolling through the scene maps to a local 0..1 progress, and
// every `[data-window]` element inside fades by that progress (same format as captions).
import { clamp, windowOpacity } from './math.js';

const RISE_PIXELS = 18;

export function initRealm(root) {
  const scenes = [];
  for (const scene of root.querySelectorAll('.scene')) {
    const items = [];
    for (const element of scene.querySelectorAll('[data-window]')) {
      items.push({ element, window: element.dataset.window.split(',').map(Number), opacity: -1 });
    }
    scenes.push({ scene, items });
  }

  function sceneProgress(box, viewportHeight) {
    const pinnedSpan = box.height - viewportHeight;
    if (pinnedSpan > 0) return clamp(-box.top / pinnedSpan, 0, 1);
    return clamp(1 - box.top / viewportHeight, 0, 1);
  }

  function update() {
    const viewportHeight = window.innerHeight;
    for (const { scene, items } of scenes) {
      const box = scene.getBoundingClientRect();
      if (box.bottom < 0 || box.top > viewportHeight) continue;
      const progress = sceneProgress(box, viewportHeight);
      for (const item of items) {
        const opacity = windowOpacity(item.window, progress);
        if (Math.abs(opacity - item.opacity) < 0.001) continue;
        item.opacity = opacity;
        item.element.style.opacity = opacity.toFixed(3);
        item.element.style.visibility = opacity > 0 ? 'visible' : 'hidden';
        item.element.style.setProperty('--rise', `${((1 - opacity) * RISE_PIXELS).toFixed(1)}px`);
      }
    }
  }

  return { update };
}
