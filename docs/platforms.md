# Platforms

The repository is structured after its sibling rally repo, which ships one product through many shells: web/PWA, desktop, and native mobile (App Store / Play Store). Sea Haven adopts the same shape deliberately — the engine is headless and shell-agnostic, and every shell wraps the identical built site — and ships **all three today**: the web, the desktop app and the store app.

## Web / PWA (`pwa/`)

The deployed site IS the product. It is installable (home-screen app on iOS/Android, fullscreen launch), offline-capable (hand-rolled precaching service worker), self-updating (in-app prompt from `pwa/src/lib/pwa-update.ts`), and phone-first with full desktop keyboard support. Three deploy slots on [game3.niclaslindstedt.se](https://game3.niclaslindstedt.se/):

| Slot        | Serves                                        |
| ----------- | --------------------------------------------- |
| `/`         | The latest release (highest `v*` tag)         |
| `/preview/` | Current `main`, on every push                 |
| `/branch/`  | A feature branch parked via workflow dispatch |

Each slot is a whole build at its own base path with its own install identity, so the three can be installed side by side without fighting over one service-worker scope.

## Desktop (`tauri/`)

A **thin [Tauri](https://tauri.app) wrapper** around the built website for Windows, macOS and Linux: one window in the platform's own webview, the site bundled inside it and served from the private `game://` scheme, so it plays offline and is an app rather than a viewer for a web page. [`tauri/README.md`](../tauri/README.md) is the tree.

Two Rust crates, and the split is the design: `shell/` holds every DECISION (no Tauri, no GUI, no window) and `src-tauri/` every EFFECT. So `cargo test -p seahaven-shell` — `make tauri-test` — runs the whole decision layer on a machine with a Rust toolchain and nothing else installed, which is what makes the tree's logic coverable on an ordinary runner. `make tauri-lint` reaches both crates and does need the platform's webview development libraries. Neither is on the root suite's path: `make test` and `make lint` stop at this tree's edge, and `.github/workflows/desktop-tauri.yml` runs both on every push that touches it.

What the shell adds around the page is the short list a browser tab cannot give a game, and nothing else: one stable origin (so stored settings survive an update), a window that remembers its size and place, a fullscreen the page may ask for, links out that open in the player's own browser, a launch log for a bug report, and — on macOS — a real menu bar whose every row presses a key the game already has (B, R, C, Enter).

`make desktop` packages this machine's downloads into `tauri/release/`; the `desktop` matrix in `release.yml` does the same on a runner per platform and attaches every one to the release, which stays a DRAFT until all three have landed.

**No store half.** The sibling repo's shell also carries a Steam page and a Mac App Store submission, both compiled from an authored listing this repository does not have. None of that is ported — a listing is its own craft with its own review loop, and half a submission in the tree is worse than none.

## Native mobile (`native/`)

A **thin [Expo](https://expo.dev) / React Native wrapper** around the same built website: one full-screen WebView over a copy of the site packed inside the app (`assets/webroot.zip`) and served from a local HTTP server on launch, so it plays offline and updates through the store. [`native/README.md`](../native/README.md) is the tree and [`native/RELEASING.md`](../native/RELEASING.md) the submission run-through.

It is outside the npm workspace with a dependency tree of its own, so it installs, typechecks and builds on its own targets:

| Target                  | Does                                                         |
| ----------------------- | ------------------------------------------------------------ |
| `make native-install`   | install this tree's dependencies (a root `npm ci` does not)  |
| `make native-bundle`    | `vite build` + a deterministic zip into `assets/webroot.zip` |
| `make native-typecheck` | `tsc` over the shell — the root lint never sees it           |
| `make native-ios`       | prebuild + run in the iOS simulator                          |
| `make native-android`   | run on an Android device or emulator                         |
| `make native-iphone`    | bundle, sign, install and launch on a real iPhone over USB   |

Cloud builds go through [EAS](https://expo.dev/eas) (`native/eas.json`), driven by `.github/workflows/native.yml` — **workflow-dispatch only**, because a build spends paid minutes and store credentials.

The shell is four things a browser tab cannot give a phone, and nothing else: the game served on-device, an audio session that survives the ringer switch, the phone's haptics under the game's own vibration table, and off-site links handed to the system browser.

## What the page knows about a shell

One file: `pwa/src/shell-host.ts`. Each shell's initialization script defines one frozen global, `__SH_SHELL__`, before the game's own scripts run, and that module is the only place that reads it. What a shell may say to the page and what the page may ask of a shell travels on a handful of DOM events prefixed `sh-` — a fullscreen ask and its answer, a haptic pulse, a menu row pressed — and every one of them is a thing the website already does. **Nothing in `engine/` learns a shell exists.**

The desktop shell restates those names in Rust and cannot import them, so `tests/tauri_test.ts` is where those two sides are held together: the global, both fullscreen events, the menu's whole word list, the window title, the brand background and the bundle's description, each against `pwa/src/identity.ts` or `shell-host.ts`.

The haptic pulse is the one of those that is live, and it is worth following end to end because it is the shape every later bridge takes:

```
engine event / CraftState.slam
  → pwa/src/game/rumble.ts     what is felt, and how big: { ms, strength }
  → pwa/src/game/haptics.ts    the one motor, the ledger, the player's switch
  → shell-host.ts              dispatches `sh-shell-rumble` (a no-op in a browser)
  → native/src/injected.ts     the listener, posted over the WebView's channel
  → native/src/rumble.ts       parsed, then sized into a burst of taps
  → native/src/haptics.ts      expo-haptics plays it
```

The website still owns the feature: every pulse is authored, decided and switched off in `pwa/`, and the shell only plays what it is handed. A browser with a motor answers the same table through the Vibration API; a browser without one feels nothing, which is what having no motor should be. The event's name and the message's shape are stated in three files that cannot import each other, so `tests/rumble_test.ts` and `tests/shell_test.ts` hold them together — `native/src/rumble.ts`, `navigation.ts` and `injected.ts` import nothing at all, which is what lets the root suite read them without installing that tree (`tests/imports_test.ts`'s `SHELL_SEAM`).

## Deliberate differences from the sibling repo

- **No authored store listing.** The sibling compiles one source of listing copy into App Store, Play and Steam metadata, with a preflight and a screenshot sweep behind it. Here the desktop shell ships its downloads and the phone listing is typed into the consoles by hand; `native/RELEASING.md` lists what they ask for, and the Steam page has no counterpart at all yet.
- **No modding seam.** Content is typed data in `engine/game/defs/` (the craft catalog, the tuning). If content authoring outgrows TypeScript rows, the path is the sibling's: data catalogs compiled by a script — the defs modules are already the seam.
- **No multiplayer/server.** Levels are deterministic by seed, so the natural first social feature is asynchronous: a shared seed, then ghost times — no server shell until then.

Each platform shell has its own top-level directory with its own toolchain, its own checks off the root suite's path, its own packaging or build job, and a paragraph here describing it as it is. Another one would be added the same way.
