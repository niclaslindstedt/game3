---
title: A probe that opens the app's IndexedDB first destroys what it measures, and a receipt cannot tell two presses apart
date: 2026-09-11
scope: previews/, pwa/src/lib/shot-store.ts
concepts: [screenshots, playwright, probe, indexeddb, storage]
---

Two ways a browser-driven probe lies about a feature that KEEPS something.

`indexedDB.open("seahaven-shots", 1)` from the probe, with no
`onupgradeneeded`, creates an empty database at version 1 with no object
store. The app then opens the same version, finds no store, and every `put`
throws into the store's own catch — so the pictures are lost to the
measurement rather than to the code, and the probe prints a confident
`store holds 0`. Read the store at the END, after a page that has opened it,
or supply exactly the schema the app creates.

And two presses in one page cannot be told apart by waiting for the HUD's
receipt: the first one's line is still in the news column when the second is
pressed, so the wait returns at once and whatever follows — a navigation, a
read — lands mid-capture, which on this rasterizer is ten seconds long. It
reads as a picture the store dropped. Count the receipts (or the rows), or
take one picture a page.

Both cost an hour here. The tell for the second one was in the ids: a roll id
is `${takenAt}-${counter}` with the counter reset per page load, so two
survivors both ending `-000001` said "the first shot of two different visits"
— which was the answer, and it was the app working.

A probe script also has to live under `previews/` (gitignored, beside the
repo's `node_modules`): run from a scratchpad outside the tree it dies with
`ERR_MODULE_NOT_FOUND: playwright-core`, because Node resolves packages from
the SCRIPT's directory.
