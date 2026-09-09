# Platforms

The repository is structured after its sibling rally repo, which ships one product through many shells: web/PWA, desktop, and native mobile (App Store / Play Store). Sea Haven adopts the same shape deliberately — the engine is headless and shell-agnostic, and every shell wraps the identical built site — and ships **one shell today**, the web, with the other two reserved.

## Web / PWA (`pwa/`)

The deployed site IS the product. It is installable (home-screen app on iOS/Android, fullscreen launch), offline-capable (hand-rolled precaching service worker), self-updating (in-app prompt from `pwa/src/lib/pwa-update.ts`), and phone-first with full desktop keyboard support. Three deploy slots on [game3.niclaslindstedt.se](https://game3.niclaslindstedt.se/):

| Slot        | Serves                                        |
| ----------- | --------------------------------------------- |
| `/`         | The latest release (highest `v*` tag)         |
| `/preview/` | Current `main`, on every push                 |
| `/branch/`  | A feature branch parked via workflow dispatch |

Each slot is a whole build at its own base path with its own install identity, so the three can be installed side by side without fighting over one service-worker scope.

## Desktop (`tauri/`) — reserved

A **thin [Tauri](https://tauri.app) wrapper** around the built website for Windows, macOS and Linux: one window in the platform's own webview, the site bundled inside it and served from a private scheme. [`tauri/README.md`](../tauri/README.md) is the placeholder and says what the tree will be — two Rust crates, every decision in one and every effect in the other, checked by their own targets and their own workflow, packaged per platform onto every release between `release` and `publish` in `release.yml`.

## Native mobile (`native/`) — reserved

A **thin [Expo](https://expo.dev) / React Native wrapper** around the same built website: one full-screen WebView over a copy of the site packed inside the app and served locally on launch, so it plays offline and updates through the store. [`native/README.md`](../native/README.md) is the placeholder.

## What the page knows about a shell

One file: `pwa/src/shell-host.ts`. Each shell's initialization script defines one frozen global, `__SH_SHELL__`, before the game's own scripts run, and that module is the only place that reads it. What a shell may say to the page and what the page may ask of a shell travels on a handful of DOM events prefixed `sh-` — a fullscreen ask and its answer, a haptic pulse, a menu row pressed — and every one of them is a thing the website already does. **Nothing in `engine/` learns a shell exists.**

## Deliberate differences from the sibling repo

- **No shell yet.** The vertical slice is the website; the two shells arrive as their own trees with their own checks, and nothing in the root suite reaches into either.
- **No modding seam.** Content is typed data in `engine/game/defs/` (the craft catalog, the tuning). If content authoring outgrows TypeScript rows, the path is the sibling's: data catalogs compiled by a script — the defs modules are already the seam.
- **No multiplayer/server.** Levels are deterministic by seed, so the natural first social feature is asynchronous: a shared seed, then ghost times — no server shell until then.

When a shell lands, it gets its own top-level directory, its packaging job slots into `release.yml`, and this document describes it as it is.
