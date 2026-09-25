# The Shiva figure

Shiva is a **2.5D relief**: the concept painting (`assets/shiva-concept.png`) displaced by a
depth map estimated from it. This keeps the painting's photoreal face, hair and light, while the
camera still gets real parallax, depth of field and mala shadows. The camera stays within about ±25°
of the front view, which is all the scroll path uses.

The site paints on top of it in the shader (`static/js/stage/relief.js`):
- **Nīla grade**: the painting's lightness is mapped to an indigo → cobalt → moonlit ramp, and
  the throat keeps a deeper blue. Set `MODEL.grade` to 0 for the natural ash tone.
- **Tripundra**: three ash bands.
- **Ādiyogī's white mark**: the eye's seam glows through it, and then it opens into the third eye.
- **Crescent moon**: silver, at his right temple. The **mala** is laid on the relief surface.

## Replacing or re-baking the figure

1. Generate a square, front-view concept image. Keep the forehead bare (no marks), use a dark
   plain background, no necklace, and eyes closed. The prompt that produced the current image:

   > Hyper-realistic cinematic sculpture bust of Lord Shiva in deep meditation, head, neck, shoulders
   > and upper chest, both eyes gently closed, serene face, ash-smeared pale blue-grey skin, faint
   > blue tint on the throat, smooth bare forehead with no marks, long matted dreadlocks coiled
   > into a tall topknot, locks falling behind the shoulders, no jewellery, no necklace, neutral
   > dark background, soft studio light, front view, symmetrical, photoreal --ar 1:1

2. Save it as `assets/shiva-concept.png` and bake:

   ```
   pip install numpy pillow onnxruntime
   # model: https://huggingface.co/onnx-community/depth-anything-v2-base/resolve/main/onnx/model.onnx
   python tools/make_relief.py path\to\model.onnx
   ```

   This writes `static/models/shiva/albedo.jpg`, `mask.png` and `height.bin`.

3. Re-anchor `static/js/stage/config.js`. Image pixel `(px, py)` of a `W`-wide image maps to
   `x = (px / W - 0.5) * 10` and `y = (0.5 - py / W) * 10`. Update:
   - `thirdEye`: the centre of the forehead.
   - `moon`: position and size.
   - `mala.sideX`, `mala.topY`: where the neck meets the shoulders.
   - `mala.bottomY`: the lowest point of the loop on the chest.

4. Check the framing with `?p=0`, `?p=0.19`, `?p=0.3`, `?p=0.62` and `?p=0.77`.
