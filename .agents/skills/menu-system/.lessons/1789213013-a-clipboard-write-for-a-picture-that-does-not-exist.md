---
title: A clipboard write can be started for a picture that does not exist yet — ClipboardItem takes a PROMISE, and that is the only way the shutter can copy
date: 2026-09-12
scope: pwa/src/lib/share-image.ts, pwa/src/App.tsx, pwa/src/game/screenshots.ts
concepts: [screenshots, gallery, clipboard, input]
---

`navigator.clipboard.write` needs the press's transient user activation, and
the shutter's picture does not exist at the press: the drawing buffer can only
be read inside the animation callback that filled it, frames later. Awaiting
the capture and then writing is refused — the activation is gone by the first
`await`.

The way through is in the spec: a `ClipboardItem` value may be a
`Promise<Blob>`. `copyWhenReady()` (share-image.ts) is called synchronously
from the press with a deferred promise, and the frame loop settles it with the
blob when the capture lands. Chromium and WebKit both want this shape; WebKit
accepts nothing else.

Two things that are easy to get wrong and cost a session each:

- The deferred promise needs its own `.catch(() => {})`. A picture that never
  arrives rejects it, and without that the rejection surfaces as an unhandled
  one in the console of a player who merely pressed the shutter in a
  backgrounded tab.
- Say COPIED only after `await`ing the write's own result. It can still be
  refused (permission, a browser with no PNG writer — `canCopyImage()` returns
  false on Firefox), and a receipt promising a paste that is not there is worse
  than no receipt.

It cannot be unit-tested — the whole path is DOM. Drive it: a playwright
context with `clipboard-read`/`clipboard-write` granted for the origin, press
Enter, then read `.hud-flash` and `navigator.clipboard.read()`; the second must
come back holding `image/png`.
