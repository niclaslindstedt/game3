---
title: A driver script in the scratchpad cannot resolve `playwright-core` — import it by absolute path, and never pipe a long browser run through `tail`
date: 2026-09-20
concepts: [remote-session, tooling, screenshots, measurement]
---

Two traps when a session writes a one-off browser driver into the scratchpad
directory rather than into `scripts/`:

**Node resolves bare specifiers from the SCRIPT's location, not the cwd.** A
file under the scratchpad dies on `import { chromium } from "playwright-core"`
with `ERR_MODULE_NOT_FOUND` however the repo was installed. Import it by
absolute path instead —
`import { chromium } from "/home/user/game3/node_modules/playwright-core/index.mjs"`
— or put the script under `scripts/`. Same for any other dependency; only
repo-relative absolute paths (`scripts/lib/serve-dist.mjs`) work either way.
`serveDir(dir)` from `scripts/lib/serve-dist.mjs` returns `{ url, close }`,
with the url already carrying a trailing slash.

**`node driver.mjs | tail -N` shows NOTHING until the process exits.** `tail`
buffers by construction, so a ten-minute browser run looks identical to a
crashed one for its whole length, and every intermediate `console.log` planted
to find out where it got to is swallowed. Redirect to a file and read the file
(`> out.txt 2>&1`), or drop the pipe entirely.

Budget the run honestly: under this container's software rasterizer
(`--use-angle=swiftshader-webgl`) the benchmark's WARM-UP alone is
`countdown / step` frames — 180 of them — each one drained, before a single
measured frame. Ten minutes is normal, not a hang. Check it is alive with
`pgrep -af chrome` (the process is `chrome`, not `chromium`) rather than
assuming.
