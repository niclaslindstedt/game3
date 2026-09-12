---
title: A shell → page bridge already has a door (SHELL_COMMAND), and its test has to RUN the injected script rather than read it
date: 2026-09-12
scope: native/src/injected.ts, tests/shell_test.ts
concepts: [bridge, seam, shell-command, injected, screenshots]
---

The haptics bridge this skill describes runs page → shell, and is offered as
the shape every later bridge takes. The store app's screenshot capture runs
the OTHER way — the phone tells the shell something the page cannot hear — and
the mistake is inventing a second channel for it. **There already is one, and
it is the macOS menu bar's:** `SHELL_COMMAND` / `SHELL_COMMANDS` in
`shell-host.ts`, a word on `sh-shell-command`, every word a button the website
already has. A `WebView.injectJavaScript` of a four-line IIFE dispatching that
event is the whole shell half, and it belongs in `injected.ts` beside the
scripts that load with the page. No new event, no new page code: one
`onShellCommand` listener serves the menu bar and the phone alike.

**Its test cannot assert on the script's source.** A bridge whose script is a
STRING fails in the one way a source assertion cannot see: a misspelled event
or an unknown command word runs clean, dispatches into nothing, and looks
exactly like the feature not existing. So evaluate it —

```ts
new Function("window", script)({ dispatchEvent(e) { seen.push(e); return true; } })
```

— and feed what comes out to the page's own listener. `onShellCommand` listens
on `globalThis`, which in Node has no `addEventListener`, so borrow an
`EventTarget`'s methods onto `globalThis` for the test and put them back in a
`finally`. Then prove it bites by renaming the word and watching it fail: a
seam test that passes over a broken seam is worse than no test at all.
