<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Sea Haven — the desktop app (placeholder)

The desktop shell will live here: a thin [Tauri](https://tauri.app) wrapper
around the built website for Windows, macOS and Linux — one window in the
platform's own webview, the site bundled inside it and served from a private
scheme, so it plays offline and is an app rather than a viewer for a web page.

Nothing is built yet. When it is, it follows the sibling rally repo's tree
exactly — two Rust crates, `shell/` for every DECISION (no Tauri, no GUI, a
suite that runs on a bare Rust toolchain) and `src-tauri/` for every EFFECT —
with its own `make tauri*` targets, its own workflow, and a packaging job that
slots into `release.yml` between `release` and `publish`.

Two rules hold from the first line:

- **Nothing in `engine/` may learn this shell exists.** The one file of `pwa/`
  that does is `pwa/src/shell-host.ts`, which reads the frozen `__SH_SHELL__`
  global the shell's initialization script defines and nothing else.
- **A feature the shell needs is a feature the website needs first.** The
  shell adds reach — a stable origin, a window that remembers itself, a real
  fullscreen, a menu bar — never a rule (OSS_GAME_SPEC §33).

See [`docs/platforms.md`](../docs/platforms.md) for where this sits.
