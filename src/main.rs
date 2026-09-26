//! Trinetra: a scroll-driven site. Serves the static frontend and a small read-only JSON API.
//!
//! This is the native server for local development; production runs `src/worker.rs` on
//! Cloudflare. Routes here must match `api::route`.

use std::{env, net::SocketAddr, path::PathBuf, sync::Arc};

use trinetra::content;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use tower_http::services::ServeDir;

const LISTEN_PORT_DEFAULT: u16 = 8080;

#[derive(Clone)]
struct AppState {
    library: Arc<content::Library>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let site_root = site_root();
    let library = content::Library::embedded()?;
    println!("loaded {} beads", library.bead_count());

    let state = AppState {
        library: Arc::new(library),
    };
    let app = Router::new()
        .route("/api/beads", get(list_beads))
        .route("/api/beads/{index}", get(get_bead))
        .fallback_service(ServeDir::new(site_root.join("static")))
        .with_state(state);

    let address = SocketAddr::from(([127, 0, 0, 1], listen_port()?));
    let listener = tokio::net::TcpListener::bind(address).await?;
    println!("Trinetra is open at http://{address}");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

/// `TRINETRA_ROOT` lets a relocated binary find `static/`; defaults to the crate directory.
/// Content is compiled in, so only static assets are read from disk.
fn site_root() -> PathBuf {
    match env::var_os("TRINETRA_ROOT") {
        Some(root) => PathBuf::from(root),
        None => PathBuf::from(env!("CARGO_MANIFEST_DIR")),
    }
}

fn listen_port() -> Result<u16, String> {
    match env::var("PORT") {
        Ok(text) => text
            .parse::<u16>()
            .map_err(|error| format!("invalid PORT '{text}': {error}")),
        Err(env::VarError::NotPresent) => Ok(LISTEN_PORT_DEFAULT),
        Err(error) => Err(format!("invalid PORT: {error}")),
    }
}

async fn shutdown_signal() {
    if let Err(error) = tokio::signal::ctrl_c().await {
        eprintln!("failed to listen for ctrl-c, shutting down: {error}");
    }
}

async fn list_beads(State(state): State<AppState>) -> Response {
    Json(state.library.bead_summaries()).into_response()
}

async fn get_bead(State(state): State<AppState>, Path(index): Path<u16>) -> Response {
    match state.library.bead(index) {
        Some(bead) => Json(bead).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
