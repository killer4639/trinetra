#!/bin/sh
# Builds the Rust Worker into build/ for `wrangler deploy`.
# Cloudflare's build image ships Node but not Rust, so install a minimal toolchain if absent.
set -eu

if ! command -v cargo >/dev/null 2>&1; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
        | sh -s -- -y --profile minimal --default-toolchain stable
    . "$HOME/.cargo/env"
fi

rustup target add wasm32-unknown-unknown
if ! command -v worker-build >/dev/null 2>&1; then
    cargo install --quiet --locked "worker-build@^0.8"
fi
worker-build --release
