---
name: ui-review
description: "Use for a fit-and-finish pass over the game's UI — the HUD, the touch controls (the handlebar and the throttle lever), the finish card, the update toast. Drives the screenshot-audit loop: capture every surface at the reference viewports (desktop landscape, phone portrait), evaluate against the quality bar, fix what clips, overflows, or drifts off the shared look, and verify with re-captures."
---

# UI Review — audit the HUD and every overlay

The game's UI drifts the way all game UI drifts: a new readout ships at a size
that reads on desktop and vanishes on a phone, a touch control creeps under a
thumb's blind spot, an overlay assumes landscape. This skill is the periodic
sweep that catches all of it at once — **look at every surface, judge it, fix
it, look again**. Never evaluate UI from code alone; the failures (clipping,
overlap, illegibility over bright water) only show up in pixels.

The UI surface today is small — `pwa/src/game/hud.tsx` (the readouts),
`hud-dial.tsx` (the bars), `hud-touch.tsx` (the thumb zones, which are the
phone's only controls), `pwa/src/styles.css`, and the update toast
(`update-button.tsx` over `lib/pwa-update.ts`) — which is exactly why a sweep
is cheap enough to run on every UI change.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs ui-review --list`, then the ones this task
touches. Load **`skill-reflection`** at both ends of the session.

## Tooling

| Piece | Role |
| --- | --- |
| `scripts/screenshot.mjs` | The capture harness — serves `pwa/dist`, opens `?seed=&craft=&scene=&shot=1`, waits for `window.__SH_READY__`, captures at 1280×720 (desktop landscape) and 390×844 (phone portrait) to `previews/` |
| `make screenshots SCENE=<name>` | Runs it for one scene against the BUILT app (`make build` first); `CHROMIUM_PATH=/opt/pw-browsers/chromium` in web sessions; no `SCENE=` is every scene |
| Read tool on the PNGs | The evaluation itself — every judgement is made on a screenshot, not on source |
| `npm run dev` | Headed spot-checks (the toast's timing, touch behaviour in devtools emulation) |

The two shipped viewports are the floor, not the ceiling: when a change is
layout-sensitive, add a capture at the tight cases — landscape phone
(844×390, the harshest axis for a HUD strip: the lever and the handlebar
each want the bottom corner and the speed wants the middle) and a small
phone (375×667) — by passing a viewport in a scene. A surface tuned to
exactly fit 390×844 runs out of room on the SE class first.

**When the change is ONE instrument's placement rather than a surface, take
one scene per viewport instead of the whole sweep.** `SCENE=rest` is the cheap
one — it stands the craft still, so the run-up is nothing and the HUD is at
its floor; `SCENE=cruise` is the same frame at speed.

## The quality bar

Judge every screenshot against this list. Extend it when a new rule of thumb
settles (that is the `skill-reflection` promotion path).

1. **Nothing clips or overlaps at either viewport.** The HUD's elements keep
   clear of each other and of the safe areas at every aspect ratio the scenes
   capture.
2. **Legible over the WORLD, not over a mockup.** The scene behind the HUD is
   a pale northern sky over teal water with white foam and spray in it — the
   worst case for white text is the foam, and the worst case for dark text is
   the deep water. Every readout keeps its ink/shadow treatment (`hudInk` /
   `hudShadow` in `identity.ts`'s palette); a new element that skips it reads
   fine in devtools and vanishes in the spray.
3. **Touch targets are thumb-sized and reachable.** The HUD IS the touch
   control surface on phones: the handlebar in the lower-left arc, the lever
   in the lower-right, sized for a moving thumb, and no readout a rider must
   watch mid-turn under either. The lever's full travel (~90 px down) fits
   inside the safe area from wherever a thumb plausibly lands.
4. **Essential info reads at speed.** Speed, the next gate, the air time —
   a rider glances at these mid-swell. Small captions are fine for ambient
   info (the wind, the build label); anything decision-driving is big.
5. **One look.** The HUD wears the northern-sea identity — the palette from
   `pwa/src/identity.ts`, never a re-hardcoded colour. A new overlay that
   invents its own greys is drift; re-skin it.
6. **Portrait is designed, not squeezed.** The portrait layout is its own
   arrangement, not the landscape HUD scaled down — the water fills a tall
   frame differently, and the horizon sits higher.
7. **Safe areas + reduced motion.** Anything pinned to a screen edge respects
   `env(safe-area-inset-*)`; decorative animation (the vane's swing, the
   lever's spring) has a `prefers-reduced-motion` fallback that keeps the
   information.
8. **The PWA surfaces count too.** The update toast and install flow are UI —
   capture them when they change (the toast can be forced by temporarily
   wiring a URL-param check into the update state; revert before committing).
9. **An instrument's IDLE state never sits on its own alert ramp.** The rpm
   bar that warms toward the redline must read cool and inert at idle; a
   warm "neutral" lands close enough to the low end of that ramp that an
   idling craft looks like a screaming one. Quiet when there is no news is
   what makes the news findable at speed.

## Process

1. **Capture the baseline.** `make build && make screenshots` on a clean
   tree; skim EVERY PNG with the Read tool. List findings in two buckets:
   _broken_ (clips, overlaps, unreadable) and _drift_ (off-palette,
   undersized, inconsistent). Note the surfaces that are already strong —
   they define the bar, and the list proves the sweep was total.

   **When the edit is already written, take the baseline from `origin/main`
   rather than skipping it** — a chip that overflows by 40 px says nothing
   about whose fault that is. A worktree builds one in seconds with no
   `npm install`, because the build only ever reads the tree:

   ```sh
   git worktree add ../base-main origin/main
   ln -s "$PWD/node_modules" ../base-main/node_modules
   ln -s "$PWD/pwa/node_modules" ../base-main/pwa/node_modules
   (cd ../base-main && npm run build --workspace pwa)
   ```

   Point the harness at either `pwa/dist` and run it twice;
   `git worktree remove --force` before committing. This is also the only
   safe way to take a late BEFORE — `git stash && make … && git stash pop`
   leaves the work stashed when the long target times out. Report a
   pre-existing overflow instead of quietly fixing or quietly inheriting it.

2. **Fix structurally, not per-symptom.** Prefer the shared fix (a token, a
   shared text-shadow rule, a layout container) over per-element nudges; most
   drift exists because a surface predates a shared pattern. New CSS goes
   next to the component's existing block in `styles.css`.
3. **Re-capture and re-look.** Same harness, same scenes. Diff by eye against
   the baseline; a fix that helps landscape can break portrait.
4. **Gates + ship.** `make build && make test && make lint && make fmt-check`,
   a changeset fragment when anything user-visible changed, then the `commit`
   skill. Presentation-only passes rarely need new tests; engine untouched
   means the suite should be green unmodified.

## Skill self-improvement

Load the **`skill-reflection`** skill before this session commits. A settled
quality rule belongs in the bar above; a new surface earns a scene in
`scripts/screenshot.mjs` (over a moment in `scenarios.ts`) in the same change
that ships it — a surface the harness can't reach is a surface no sweep will
ever look at.
