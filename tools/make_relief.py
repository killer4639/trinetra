"""Bakes the Shiva concept image into a 2.5D relief for the site.

Inputs:
  assets/shiva-concept.png          square concept art (front view, dark background)
  <model>                            Depth-Anything-V2 ONNX, e.g.
                                     https://huggingface.co/onnx-community/depth-anything-v2-base/resolve/main/onnx/model.onnx
Outputs (static/models/shiva/):
  albedo.jpg   the colour image
  mask.png     soft silhouette (white = figure)
  height.bin   little-endian uint16 grid, GRID x GRID, row 0 = image top, 0..65535 = relief height 0..1

Usage: python tools/make_relief.py <model.onnx>
Needs: numpy, pillow, onnxruntime.
"""
import os
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'assets', 'shiva-concept.png')
OUT = os.path.join(ROOT, 'static', 'models', 'shiva')
INFERENCE_SIZE = 1022  # multiple of the ViT patch size (14)
GRID = 385  # vertices per side; the mesh has GRID - 1 segments
MASK_LOW, MASK_HIGH = 0.10, 0.18  # normalised disparity: background sits near 0.05
HEIGHT_FLOOR = 0.25  # disparity mapped to zero height
FILL_RADIUS_PX = 24


def box_blur(image, radius):
    """Separable box blur (edge-clamped); three passes approximate a gaussian."""
    assert radius >= 1
    result = image.astype(np.float64)
    for _ in range(3):
        for axis in (0, 1):
            pad = [(0, 0), (0, 0)]
            pad[axis] = (radius + 1, radius)
            summed = np.cumsum(np.pad(result, pad, mode='edge'), axis=axis)
            length = result.shape[axis]
            upper = np.take(summed, np.arange(2 * radius + 1, 2 * radius + 1 + length), axis=axis)
            lower = np.take(summed, np.arange(0, length), axis=axis)
            result = (upper - lower) / (2 * radius + 1)
    return result


def smoothstep(low, high, value):
    t = np.clip((value - low) / (high - low), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def estimate_disparity(image, model_path):
    pixels = np.asarray(image.resize((INFERENCE_SIZE, INFERENCE_SIZE), Image.BICUBIC), np.float32) / 255.0
    pixels = (pixels - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    batch = pixels.transpose(2, 0, 1)[None].astype(np.float32)
    session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])
    disparity = np.squeeze(session.run(None, {session.get_inputs()[0].name: batch})[0]).astype(np.float64)
    span = disparity.max() - disparity.min()
    assert span > 0, 'depth model returned a flat map'
    return (disparity - disparity.min()) / span


def relief_height(disparity):
    """Figure heights, with the background filled by the blurred figure edge so the
    silhouette never tears into a vertical wall."""
    mask = smoothstep(MASK_LOW, MASK_HIGH, disparity)
    height = np.clip(disparity - HEIGHT_FLOOR, 0.0, None)
    weight = box_blur(mask, FILL_RADIUS_PX) + 1e-6
    filled = box_blur(height * mask, FILL_RADIUS_PX) / weight
    height = mask * height + (1.0 - mask) * filled * 0.85
    return height / height.max(), mask


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    image = Image.open(SOURCE).convert('RGB')
    assert image.width == image.height, 'concept image must be square'
    os.makedirs(OUT, exist_ok=True)

    disparity = estimate_disparity(image, sys.argv[1])
    height, mask = relief_height(disparity)

    image.save(os.path.join(OUT, 'albedo.jpg'), quality=92)
    mask_image = Image.fromarray((mask * 255).astype(np.uint8)).resize(image.size, Image.BILINEAR)
    mask_image.save(os.path.join(OUT, 'mask.png'))
    grid = np.asarray(Image.fromarray(height.astype(np.float32)).resize((GRID, GRID), Image.BILINEAR), np.float64)
    grid = np.clip(grid, 0.0, 1.0)
    (grid * 65535).round().astype('<u2').tofile(os.path.join(OUT, 'height.bin'))
    print(f'wrote {OUT}: albedo {image.size}, height grid {GRID}x{GRID}')


if __name__ == '__main__':
    main()
