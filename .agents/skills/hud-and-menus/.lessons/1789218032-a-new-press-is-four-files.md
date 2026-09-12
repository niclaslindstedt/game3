---
title: A new keyboard PRESS is four files and no Rust — and it is gated on the SURFACE its effect is on, not on "run"
date: 2026-09-12
scope: pwa/src/game/settings-input.ts, pwa/src/App.tsx, pwa/src/game/input.ts
concepts: [input, keys, settings, surfaces, shell]
---

Binding a key to an app-level action costs exactly four edits, and the
compiler finds three of them: the word in `InputAction`, a `DEFAULT_KEYS`
row with the reasoning for that key, a `KEY_ACTIONS` row (the one the type
system does NOT check — `menu_system_test.ts` does), its `STRINGS.key*`
label, and the branch in `App.tsx`'s `act`. `menu-keys.tsx` grows the row
on its own and needs no edit.

**It does not oblige the desktop menu bar.** `ShellCommand` /
`SHELL_COMMANDS` in `shell-host.ts` is a SEPARATE, shorter list — `pause`
has never been on it — so a new press restates nothing in Rust and
`tests/tauri_test.ts` stays green. Adding the word there is what would
oblige `tauri/shell/src/menu.rs`, and only a row the Mac menu should
actually carry earns that.

**Gate it on the surface its effect is on.** `act` answers `pause` and
`shot` before the `shellRef.current !== "run"` line, and a press whose
effect is drawn wherever the HUD is drawn wants `hudOver(shellRef.current)`
instead — the HUD stands under the pause card, and a held frame is where a
rider most wants the water uncovered. Anything below the `!== "run"` gate
is silently dead over the pause card.
