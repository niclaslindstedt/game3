---
title: A fresh remote container has nothing installed — `npm ci` before the first test, and `npm install --no-save playwright-core@1` before the first browser-driven lab
date: 2026-09-10
concepts: [tooling, install, remote-session, vitest, screenshots]
---

In a Claude web session the repository is cloned fresh and nothing is
installed: the first `npx vitest run tests/<topic>_test.ts` fails with
`Cannot find package 'vitest' imported from vitest.config.ts…` and a lab
that imports three.js through the alias dies the same way on `three`. It
reads as a broken config and is not one. `npm ci --no-audit --no-fund` takes
under ten seconds and fixes both; do it right after the preflight, before
the first edit, so the failure never lands in the middle of a measurement.

`npm ci` is not the whole shelf: **playwright-core is deliberately not a
dependency**, so the first browser-driven lab (`make screenshots`,
`profile`, `sky`, `flora`, `birds`) exits with
`playwright-core is not installed`. `npm install --no-save playwright-core@1`
is the fix, and the browser itself is already there —
`CHROMIUM_PATH=/opt/pw-browsers/chromium` in front of the target.
