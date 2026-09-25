//! Trinetra: a scroll-driven blog. Serves the static frontend and a small read-only JSON API.

mod content;

use std::{env, net::SocketAddr, path::PathBuf, sync::Arc};

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
    let library = content::Library::load(&site_root.join("content"))?;
    println!("loaded {} beads and {} posts", library.bead_count(), library.post_count());

    let state = AppState { library: Arc::new(library) };
    let app = Router::new()
        .route("/api/beads", get(list_beads))
        .route("/api/beads/{index}", get(get_bead))
        .route("/api/posts", get(list_posts))
        .route("/api/posts/{slug}", get(get_post))
        .fallback_service(ServeDir::new(site_root.join("static")))
        .with_state(state);

    let address = SocketAddr::from(([127, 0, 0, 1], listen_port()?));
    let listener = tokio::net::TcpListener::bind(address).await?;
    println!("Trinetra is open at http://{address}");
    axum::serve(listener, app).with_graceful_shutdown(shutdown_signal()).await?;
    Ok(())
}

/// `TRINETRA_ROOT` lets a deployed binary point at its content; defaults to the crate directory.
fn site_root() -> PathBuf {
    match env::var_os("TRINETRA_ROOT") {
        Some(root) => PathBuf::from(root),
        None => PathBuf::from(env!("CARGO_MANIFEST_DIR")),
    }
}

fn listen_port() -> Result<u16, String> {
    match env::var("PORT") {
        Ok(text) => text.parse::<u16>().map_err(|error| format!("invalid PORT '{text}': {error}")),
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

async fn list_posts(State(state): State<AppState>) -> Response {
    Json(state.library.post_summaries()).into_response()
}

async fn get_post(State(state): State<AppState>, Path(slug): Path<String>) -> Response {
    match state.library.post(&slug) {
        Some(post) => Json(post).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
