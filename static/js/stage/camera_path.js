// The camera's journey, as keyframes on scroll progress. Positions and targets are joined
// with a Catmull-Rom spline so the move never stops dead between chapters.
import * as THREE from 'three';

function catmullRom(p0, p1, p2, p3, t, out) {
  const t2 = t * t;
  const t3 = t2 * t;
  for (const axis of ['x', 'y', 'z']) {
    out[axis] = 0.5 * ((2 * p1[axis]) + (-p0[axis] + p2[axis]) * t + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2 + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3);
  }
  return out;
}

export function createCameraPath(eye, malaAnchors) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const offset = (anchor, x, y, z) => anchor.clone().add(v(x, y, z));
  const { left, bottom, right } = malaAnchors;
  // Opens low and looking up, the way one stands before Ādiyogī, then descends to the mala.
  const keys = [
    { p: 0.0, position: v(0, -1.6, 19.4), target: v(0, 0.2, 2.4), fov: 30, aperture: 0.0004 },
    { p: 0.09, position: v(0.7, -1.9, 16.4), target: v(0, -0.3, 2.4), fov: 30, aperture: 0.0008 },
    { p: 0.19, position: offset(left, -2.0, 0.7, 6.2), target: left.clone(), fov: 28, aperture: 0.005 },
    { p: 0.3, position: offset(bottom, 0.35, 0.9, 5.8), target: bottom.clone(), fov: 26, aperture: 0.0065 },
    { p: 0.41, position: offset(right, 2.0, 0.9, 6.2), target: right.clone(), fov: 28, aperture: 0.005 },
    { p: 0.51, position: v(2.1, 0.5, 12.6), target: v(0, 1.3, 3.0), fov: 30, aperture: 0.0018 },
    { p: 0.62, position: v(0.55, eye.y + 0.4, eye.z + 3.3), target: eye.clone(), fov: 30, aperture: 0.004 },
    { p: 0.77, position: v(0, eye.y + 0.03, eye.z + 1.3), target: eye.clone(), fov: 32, aperture: 0.006 },
    { p: 0.9, position: v(0, eye.y, eye.z + 0.07), target: eye.clone().add(v(0, 0, -0.4)), fov: 62, aperture: 0 },
    { p: 1.0, position: v(0, eye.y, eye.z + 0.07), target: eye.clone().add(v(0, 0, -0.4)), fov: 62, aperture: 0 },
  ];

  const sample = { position: new THREE.Vector3(), target: new THREE.Vector3(), fov: 30, aperture: 0 };

  function at(progress) {
    let segment = keys.length - 2;
    for (let index = 0; index < keys.length - 1; index += 1) {
      if (progress < keys[index + 1].p) { segment = index; break; }
    }
    const from = keys[segment];
    const to = keys[segment + 1];
    const linear = THREE.MathUtils.clamp((progress - from.p) / (to.p - from.p), 0, 1);
    const eased = THREE.MathUtils.lerp(linear, linear * linear * (3 - 2 * linear), 0.55);
    const before = keys[Math.max(0, segment - 1)];
    const after = keys[Math.min(keys.length - 1, segment + 2)];
    catmullRom(before.position, from.position, to.position, after.position, eased, sample.position);
    catmullRom(before.target, from.target, to.target, after.target, eased, sample.target);
    sample.fov = THREE.MathUtils.lerp(from.fov, to.fov, eased);
    sample.aperture = THREE.MathUtils.lerp(from.aperture, to.aperture, eased);
    return sample;
  }

  return { at };
}
