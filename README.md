# Trinetra

Lord Shiva in meditation, told through scrolling. When you scroll, his third eye opens and the
camera travels into it. You can drag his rudrākṣa mala, and each bead opens one of 27 forms of
Shiva. Inside the eye, three scenes reveal verses from Kashmir Shaivism (Spanda Kārikā 1.1,
Śiva Sūtras 3.9–3.11, Pratyabhijñāhṛdayam 1).

- **Backend:** Rust. It serves a small content API (`/api/beads`, `/api/beads/{index}`) from
  `content/beads.json`, embedded with `include_str!`. In production this is a Cloudflare Worker
  (`src/worker.rs`, compiled to WebAssembly). For local development it's an axum server
  (`src/main.rs`) that also serves `static/`.
- **Frontend:** vanilla JS and Three.js (vendored). There is no build step.
- **Figure:** a 2.5D relief baked from concept art. See [docs/shiva-figure.md](docs/shiva-figure.md).

## Run

```
cargo run --release
```

Then open http://127.0.0.1:8080. Two debug parameters:
- `?p=0.5` pins the scroll progress to a value from 0 to 1.
- `?debug` exposes the stage as `window.trinetraStage`.

## Deploy (Cloudflare Workers)

The repo is connected to Cloudflare Workers Builds, so every push to `main` deploys. The
settings are the defaults: no build command, and `npx wrangler deploy` as the deploy command.
`wrangler.toml` runs `tools/cloudflare_build.sh`, which installs Rust (the build image lacks it)
and runs `worker-build --release`. Cloudflare serves `static/` as assets, and only `/api/*`
reaches the Worker.

To deploy manually, run `npx wrangler deploy`. On Windows, `sh` isn't available, so run
`worker-build --release` first, then deploy with a config that has no `[build]` section.
