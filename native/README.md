<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Sea Haven — the store app

The App Store / Play Store shell: a thin [Expo](https://expo.dev) / React
Native wrapper whose entire content is a full-screen WebView over a copy of the
built website packed inside the app and served from a local HTTP server on
launch — so the game runs on-device, offline, and updates through the store.

Two rules hold, and they are the whole design:

- **Nothing in `engine/` may learn this shell exists.** The one file of `pwa/`
  that does is [`pwa/src/shell-host.ts`](../pwa/src/shell-host.ts).
- **A feature the shell needs is a feature the website needs first.** The shell
  adds reach, never a rule (OSS_GAME_SPEC §33).

See [`docs/platforms.md`](../docs/platforms.md) for where this sits.

## What the shell actually does

Everything else is the website. The shell is four things a browser tab cannot
give a phone:

| The thing                | Where it lives                                         | Why the website cannot do it                                                                                                                               |
| ------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The game, on-device      | `src/local-server.ts`                                  | `assets/webroot.zip` unzipped once per bundle and served from a fixed loopback port, so the origin — and the stored settings on it — survives every launch |
| Sound through the ringer | `App.tsx` (`setAudioModeAsync`)                        | iOS silences a WebView's WebAudio on the ringer switch; a game should sound like a game                                                                    |
| The sea in the hands     | `src/injected.ts` → `src/rumble.ts` → `src/haptics.ts` | a WKWebView has no Vibration API at all, and the phone under it has the best haptics the game will ever run on                                             |
| Off-site links           | `src/navigation.ts`                                    | there is no address bar and no back button, so a link out would replace the game with a page the rider cannot leave                                        |

### The haptics bridge, end to end

The website owns the feature; the shell only plays what it is handed.

```
engine event / CraftState.slam
  → pwa/src/game/rumble.ts     what is felt, and how big: { ms, strength }
  → pwa/src/game/haptics.ts    the one motor, the ledger, the player's switch
  → shell-host.ts              dispatches `sh-shell-rumble` (a no-op in a browser)
  → src/injected.ts            the listener, posted over the message channel
  → src/rumble.ts              parsed, then sized into a burst of taps
  → src/haptics.ts             expo-haptics plays it
```

Four of those files cannot import each other, so the event's name and the
message's shape are stated in three places and held together by
`tests/rumble_test.ts` and `tests/shell_test.ts`. **A rename in one of them is
a phone that silently stops buzzing** — change one, change all three.

## The tree

| File                          | What it is                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `App.tsx`                     | the whole shell: one WebView, the audio session, the message channel         |
| `app.config.js`               | the Expo config, with name and colours READ off `pwa/src/identity.ts`        |
| `src/config.ts`               | where the WebView points — the bundle, or `EXPO_PUBLIC_GAME_URL`             |
| `src/local-server.ts`         | unzip the packed site once per bundle, serve it on a fixed port              |
| `src/injected.ts`             | the three injected scripts: the shell flag, the rumble bridge, the hardening |
| `src/navigation.ts`           | is this URL leaving the site — pure, so the root suite holds it              |
| `src/rumble.ts`               | a pulse parsed and sized into taps — pure, for the same reason               |
| `src/haptics.ts`              | the only file that touches `expo-haptics`                                    |
| `scripts/bundle-web.mjs`      | `vite build` + a deterministic zip into `assets/webroot.zip`                 |
| `scripts/ios-device.mjs`      | bundle → prebuild → sign → install → launch on a real iPhone over USB        |
| `plugins/with-ios-signing.js` | pins `DEVELOPMENT_TEAM` so a prebuild does not discard it                    |

`src/rumble.ts` and `src/navigation.ts` import **nothing at all**, which is
what lets the root vitest suite hold the seam without installing this tree;
`tests/imports_test.ts` holds them to that.

## Running it

This tree is **outside the npm workspace** with a dependency tree of its own,
so a root `npm ci` does not install it. From the repo root:

```sh
make native-install     # once, and after a dependency change
make native-bundle      # vite build + assets/webroot.zip — before EVERY build
make native-typecheck   # tsc over this tree (the root lint never sees it)
make native-ios         # prebuild + run in the iOS simulator
make native-android     # run on an Android device/emulator
make native-iphone      # a REAL iPhone over USB: bundle, sign, install, launch
```

`make native-iphone ARGS="--device 'my iPhone'"` picks between several;
`ARGS="--skip-bundle"` reuses the packed site.

**The app ships whatever zip is on disk**, so a stale one silently installs the
last build's game. `native-bundle` first, every time — `native-iphone` and the
EAS scripts do it for you.

To point a debug build at a deployed slot instead of the bundle, set
`EXPO_PUBLIC_GAME_URL` at build time (see `.env.example`). A store build must
never set it: streaming the website is the exact shape App Store guideline 4.2
rejects.

## Store builds

Cloud builds go through [EAS](https://expo.dev/eas); the profiles are in
`eas.json` and the workflow is `.github/workflows/native.yml` — **manual
dispatch only**, because a build spends paid minutes and store credentials.

[`RELEASING.md`](RELEASING.md) is the run-through, and says what is still
missing before a first submission.

## What is deliberately NOT here

- **No authored store listing.** The sibling rally repo compiles one source of
  listing copy into App Store, Play and Steam metadata; that is a subsystem of
  its own and the skill that owns it is reserved rather than written. Until it
  lands, the listing is typed into App Store Connect and the Play Console by
  hand — `RELEASING.md` lists what they ask for.
- **No app records, no credentials.** `eas.json`'s `ascAppId` and
  `appleTeamId` are empty because the records do not exist yet, and every
  credential is read from the environment (`.env.example` documents each one,
  where to get it and what shape it is). This repository is public: nothing
  personal and nothing secret is committed here, not even as a default a
  contributor could override.
