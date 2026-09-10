---
title: The tauri/ tree is OUTSIDE eslint and INSIDE prettier — a nested .gitignore does not save it, so every generated file under it must be named in .prettierignore by hand
date: 2026-09-10
scope: tauri/, .prettierignore, eslint.config.js
concepts: [prettier, eslint, tooling, generated]
---

`eslint.config.js` ignores `tauri/**` outright (the shell has its own
toolchain), so nothing under it is ever linted by `make lint` — a `.mjs`
there is checked only by clippy's neighbours and by review.

Prettier is the opposite and the asymmetry is the trap: it DOES format
`tauri/**/*.{mjs,json,md}`, and it does not read `tauri/.gitignore` — only
the root `.prettierignore`. So every generated artifact under the tree has to
be named there separately from the `.gitignore` that already hides it from
git: `tauri/src-tauri/icons/` (written by `scripts/icons.mjs`) and
`tauri/src-tauri/gen/` (written by `tauri-build` on EVERY compile) alongside
the `target/`, `webroot/`, `release/` and `node_modules/` entries.

The failure is confusing rather than obvious: `make fmt-check` goes red on a
tree that just compiled clean, naming JSON files nobody wrote, and it only
appears after somebody has run the Rust build once. Add the ignore entry in
the same change that adds the generator.

Rust is not Prettier's business at all — `.rs`, `Cargo.toml` and `Cargo.lock`
are `cargo fmt`'s (`make tauri-fmt`), which is a separate gate CI runs in
`desktop-tauri.yml` and `make fmt`/`make lint` never reach.
