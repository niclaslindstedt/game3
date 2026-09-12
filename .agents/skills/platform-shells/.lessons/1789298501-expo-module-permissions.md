---
title: Read a new Expo module's own AndroidManifest before adding it — what it declares is what the store listing shows
date: 2026-09-12
scope: native/app.config.js, native/package.json
concepts: [android-permissions, expo, store-review, dependencies]
---

`expo-screen-capture` declares three permissions in
`node_modules/expo-screen-capture/android/src/main/AndroidManifest.xml`, and
only one of them is harmless: `DETECT_SCREEN_CAPTURE` (API 34+) is
install-time and prompts nobody. Below Android 14 the same listener watches the
media store and needs `READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE` at
RUNTIME — the rider's whole photo library, asked for so a game can notice its
own screenshots. That is a Play review question and a prompt nobody wanted.

The repo already had the pattern: `RECORD_AUDIO`, which `expo-audio` pulls in
for a recorder the game never uses, is stripped in `app.config.js`'s
`blockedPermissions`. Do the same, and let the feature be honestly narrower —
here, "iOS everywhere, Android 14 and up". The module logs and stands down on
an older device; nothing crashes.

**So: `cat` the module's manifest before the dependency is committed**, not
after a store reviewer asks. A merged manifest is the app's permission list,
and a transitive permission is indistinguishable from one you asked for.
