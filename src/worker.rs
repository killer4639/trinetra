//! Cloudflare Worker entry point.
//!
//! Cloudflare serves `static/` directly from its asset store; `wrangler.toml` sends only
//! `/api/*` here. Content is parsed once per isolate and reused across requests.

use std::sync::OnceLock;

use serde::Serialize;
use worker::{Context, Env, Method, Request, Response, Result, event};

use crate::{
    api::{self, ApiRoute},
    content::Library,
};

/// Content never changes within a deployment, so browsers and the edge may cache briefly.
const CACHE_CONTROL: &str = "public, max-age=300";

static LIBRARY: OnceLock<Library> = OnceLock::new();

#[event(fetch)]
async fn fetch(request: Request, _env: Env, _context: Context) -> Result<Response> {
    if request.method() != Method::Get && request.method() != Method::Head {
        return Response::error("Method Not Allowed", 405);
    }
    let path = request.path();
    let Some(route) = api::route(&path) else {
        return Response::error("Not Found", 404);
    };

    let library = library()?;
    match route {
        ApiRoute::Beads => json(&library.bead_summaries()),
        ApiRoute::Bead(index) => match library.bead(index) {
            Some(bead) => json(bead),
            None => Response::error("Not Found", 404),
        },
    }
}

fn library() -> Result<&'static Library> {
    if let Some(library) = LIBRARY.get() {
        return Ok(library);
    }
    let parsed = Library::embedded()
        .map_err(|error| worker::Error::RustError(format!("content: {error}")))?;
    Ok(LIBRARY.get_or_init(|| parsed))
}

fn json<T: Serialize>(value: &T) -> Result<Response> {
    let response = Response::from_json(value)?;
    response.headers().set("Cache-Control", CACHE_CONTROL)?;
    Ok(response)
}
