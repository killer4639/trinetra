//! Trinetra library: embedded content plus the read-only JSON API.
//!
//! Two entry points share this crate:
//! - `src/main.rs`: native axum server for local development (`cargo run --release`).
//! - `src/worker.rs`: Cloudflare Worker, built to WebAssembly by `worker-build`.

pub mod api;
pub mod content;

#[cfg(target_arch = "wasm32")]
mod worker;
