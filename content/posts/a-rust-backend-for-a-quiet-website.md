title: A Rust backend for a quiet website
date: 2026-09-12
summary: Everything is parsed once at startup and served from memory. No database, no build step.
---
The server is a small [axum](https://github.com/tokio-rs/axum) app:

- `GET /api/beads` — the mala, one entry per rudraksha
- `GET /api/beads/{index}` — a single bead, rendered to HTML
- `GET /api/posts` and `GET /api/posts/{slug}` — the writing

Posts are markdown files with a tiny header. Adding a post means adding a file and
restarting. That is the whole CMS.

```text
title: Your title
date: 2026-09-24
summary: One line for the card.
---
The body, in markdown.
```
