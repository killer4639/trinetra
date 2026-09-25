export function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

export function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

export function smoothstep(edgeLow, edgeHigh, value) {
  const t = clamp((value - edgeLow) / (edgeHigh - edgeLow), 0, 1);
  return t * t * (3 - 2 * t);
}

// window = [fadeInStart, fullStart, fullEnd, fadeOutEnd]; a fadeInStart equal to fullStart
// means the element is fully visible from that point without fading in.
export function windowOpacity(window, value) {
  const [fadeInStart, fullStart, fullEnd, fadeOutEnd] = window;
  const fadeIn = fullStart > fadeInStart ? smoothstep(fadeInStart, fullStart, value) : (value >= fullStart ? 1 : 0);
  const fadeOut = 1 - smoothstep(fullEnd, fadeOutEnd, value);
  return fadeIn * fadeOut;
}

export function toDevanagariDigits(number) {
  const digits = '०१२३४५६७८९';
  let text = '';
  for (const character of String(number)) text += digits[Number(character)] ?? character;
  return text;
}
