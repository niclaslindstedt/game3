---
title: A fresh remote container has no node_modules — `npx vitest` dies on vitest.config with ERR_MODULE_NOT_FOUND, so run `npm ci` before the first test or lab
date: 2026-09-10
concepts: [tooling, install, remote-session, vitest]
---

In a Claude web session the repository is cloned fresh and nothing is
installed: the first `npx vitest run tests/<topic>_test.ts` fails with
`Cannot find package 'vitest' imported from vitest.config.ts…` and a lab
that imports three.js through the alias dies the same way on `three`. It
reads as a broken config and is not one. `npm ci --no-audit --no-fund` takes
under ten seconds and fixes both; do it right after the preflight, before
the first edit, so the failure never lands in the middle of a measurement.
