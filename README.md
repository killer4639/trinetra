# Trinetra

Notes from the third eye: a blog whose front page is Lord Shiva in meditation. When you scroll,
his third eye opens and the camera travels into it. You can drag his rudrākṣa mala, and each bead
opens its own entry.

- **Backend:** Rust (axum). It serves `static/` plus a small content API (`/api/beads`, `/api/beads/{index}`,
  `/api/posts`, `/api/posts/{slug}`) backed by `content/beads.json` and `content/posts/*.md`.
- **Frontend:** vanilla JS and Three.js (vendored). There is no build step.
- **Figure:** a 2.5D relief baked from concept art. See [docs/shiva-figure.md](docs/shiva-figure.md).

## Run

```
cargo run --release
```

Then open http://127.0.0.1:8080. Two debug parameters:
- `?p=0.5` pins the scroll progress to a value from 0 to 1.
- `?debug` exposes the stage as `window.trinetraStage`.
