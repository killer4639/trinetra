//! Embeds `content/` into the crate at compile time.
//!
//! Cloudflare Workers have no filesystem, so the Worker and the native server both read
//! beads and posts from string constants generated here. Parsing and validation still
//! happen once at startup in `content.rs`, which keeps a single code path for both targets.

use std::{
    env, fs,
    path::{Path, PathBuf},
};

/// Mirrors `POST_COUNT_MAX` in `content.rs`; the runtime check stays authoritative.
const POST_COUNT_MAX: usize = 4096;

fn main() {
    let manifest_directory =
        PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("cargo sets CARGO_MANIFEST_DIR"));
    let content_directory = manifest_directory.join("content");
    // A directory path makes cargo rescan everything beneath it for modifications.
    println!("cargo::rerun-if-changed={}", content_directory.display());

    let post_paths = sorted_post_paths(&content_directory.join("posts"));
    let mut generated = String::with_capacity(256 + post_paths.len() * 256);
    generated.push_str("pub const BEADS_JSON: &str = include_str!(");
    push_path_literal(&mut generated, &content_directory.join("beads.json"));
    generated.push_str(");\n\npub const POSTS: &[super::SourceFile] = &[\n");
    for path in &post_paths {
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .expect("post file names are UTF-8");
        generated.push_str(&format!(
            "    super::SourceFile {{ name: {name:?}, text: include_str!("
        ));
        push_path_literal(&mut generated, path);
        generated.push_str(") },\n");
    }
    generated.push_str("];\n");

    let out_directory = PathBuf::from(env::var_os("OUT_DIR").expect("cargo sets OUT_DIR"));
    let out_path = out_directory.join("embedded_content.rs");
    if let Err(error) = fs::write(&out_path, generated) {
        panic!("failed to write {}: {error}", out_path.display());
    }
}

/// Sorted so the embedded order, and therefore the build output, is deterministic.
fn sorted_post_paths(posts_directory: &Path) -> Vec<PathBuf> {
    let entries = match fs::read_dir(posts_directory) {
        Ok(entries) => entries,
        Err(error) => panic!("failed to read {}: {error}", posts_directory.display()),
    };
    let mut paths = Vec::new();
    for entry in entries {
        let path = match entry {
            Ok(entry) => entry.path(),
            Err(error) => panic!(
                "failed to read an entry of {}: {error}",
                posts_directory.display()
            ),
        };
        if path.extension().and_then(|extension| extension.to_str()) != Some("md") {
            continue;
        }
        assert!(
            paths.len() < POST_COUNT_MAX,
            "more than {POST_COUNT_MAX} posts in {}",
            posts_directory.display()
        );
        paths.push(path);
    }
    paths.sort();
    paths
}

/// Debug formatting yields a correctly escaped string literal, including Windows backslashes.
fn push_path_literal(generated: &mut String, path: &Path) {
    let text = path.to_str().expect("content paths are UTF-8");
    generated.push_str(&format!("{text:?}"));
}
