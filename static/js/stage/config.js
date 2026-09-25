// Everything that depends on the particular Shiva figure lives here.
// The figure is a 2.5D relief baked from concept art by tools/make_relief.py.
// World units: the square image spans SIZE x SIZE, centred on the origin, +y up,
// the face looks down +z. Image pixel (px, py) maps to x = (px / W - 0.5) * SIZE, y = (0.5 - py / W) * SIZE.
export const MODEL = {
  albedoUrl: '/models/shiva/albedo.jpg',
  maskUrl: '/models/shiva/mask.png',
  heightUrl: '/models/shiva/height.bin',
  grid: 385,
  size: 10,
  // Relief depth for height 0..1 (tuned so the nose-to-ear depth reads like a real head).
  depth: 5.0,

  // 1 = the blue "Nīla" painting grade, 0 = the concept's natural ash tone.
  grade: 1.0,

  // Third eye centre on the forehead (z is read from the relief), and its half height.
  thirdEye: { x: 0.02, y: 2.09, halfHeight: 0.3 },
  // Where the chest fades into darkness.
  shadowFloor: { black: -5.0, lit: -3.6 },

  // Silver crescent at his right temple, as on Ādiyogī.
  moon: { x: 1.6, y: 3.1, radius: 0.48, lift: 0.45 },

  // The mala: a U over the collarbones and chest from the neck sides, closing behind the neck.
  mala: { beadCount: 28, sideX: 1.6, topY: -1.9, bottomY: -3.75, backLift: 0.6, backDepth: 1.6, samples: 72 },
};
