<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Sea Haven — the store app (placeholder)

The App Store / Play Store shell will live here: a thin
[Expo](https://expo.dev) / React Native wrapper whose entire content is a
full-screen WebView over a copy of the built website packed inside the app and
served from a local HTTP server on launch — so the game runs on-device,
offline, and updates through the store.

Nothing is built yet. When it is, it follows the sibling rally repo's tree
exactly — `app.config.js`, `src/injected.ts` (the frozen `__SH_SHELL__`
global and the message channel), `src/local-server.ts`, an audio session that
plays through the iOS ringer switch, the phone's haptics behind a bridge the
website's own `rumble` table drives — with its own `make native-*` targets, a
dispatch-only build workflow, and a gitignored `store/copy.mts` for the
listing's words beside a committed `store/listing.mts` for its rules.

Two rules hold from the first line:

- **Nothing in `engine/` may learn this shell exists.** The one file of `pwa/`
  that does is `pwa/src/shell-host.ts`.
- **A feature the shell needs is a feature the website needs first.** The
  shell adds reach, never a rule (OSS_GAME_SPEC §33).

See [`docs/platforms.md`](../docs/platforms.md) for where this sits.
