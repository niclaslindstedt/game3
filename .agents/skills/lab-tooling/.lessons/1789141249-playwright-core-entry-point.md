---
title: A scratch probe outside the tree must import `playwright-core/index.mjs` by absolute path — `index.js` resolves and exports no `chromium`
date: 2026-09-11
scope: scripts/
concepts: [screenshots, tooling, remote-session, verification]
---

`playwright-core` is deliberately not a dependency (`npm install --no-save
playwright-core@1` installs it), and a probe written under the scratchpad
cannot resolve it by name — Node looks beside the SCRIPT, not beside the
repo. The absolute path is the fix, but the package has no `main`: only an
`exports` map. So `import("<repo>/node_modules/playwright-core/index.js")`
succeeds and hands back the INTERNAL entry — `clientEventEmitter`,
`registry`, `server`, no `chromium` — and the failure reads as
`Cannot read properties of undefined (reading 'launch')`, which looks like
a broken install rather than a wrong file.

`.../playwright-core/index.mjs` is the one with `chromium` on it. A tool
INSIDE `scripts/` has no such problem and imports it by name, the way
`screenshot.mjs` does.

The browser itself is already there in a Claude web session:
`executablePath: "/opt/pw-browsers/chromium"`, matching the
`CHROMIUM_PATH=` the Make targets take. A probe that serves `pwa/dist`
itself needs a content-type map — Chromium refuses a module script served
as `application/octet-stream` and the page boots to a blank screen with no
error in the console.
