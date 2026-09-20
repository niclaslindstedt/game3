---
title: A camera framed around a CARD solves its framing, measures the card, and lets the sky decide how far out it stands
date: 2026-09-20
scope: pwa/src/game/camera-menu.ts, pwa/src/game/live-camera.ts
concepts: [camera, framing, menu, haze, weather, viewports]
---

The front door's drone is the first camera here whose subject sits where a
rider never would. Four things it needed that no rung of the ladder does:

**SOLVE the framing.** "Hold the craft at this point in the frame" is one
equation — rotate the aim off the craft's direction by `anchor · tan(half-fov)`
in the lens's own right and up. Solving it is what makes ONE shot work at
16:9, at a phone upright (whose vertical field hor+ widens by half again) and
at a phone on its side. Three authored framings are three things to keep in
step.

**Measure the card.** `anchorFor` takes the card's box in NDC and puts the
rider in the deepest band around it, so a card that grows a row moves the
rider by itself. The three reference viewports give three genuinely different
answers, which is why picking beats authoring.

**THE HAZE IS PART OF THE FRAMING.** At 46 m up and 110 m out the shot was the
best picture in the game under a clear sky and a GHOST under rain: at that
range the heaviest skies take nearly all the contrast out of a hull. Keep the
slant range inside ~80 m, and scale height and standoff TOGETHER by the sky
the seed dealt (`MENU_CAM.flownIn`, clear 1.0 → squall 0.6) so the depression
never moves and only the reach does. It is what an operator does anyway.

**Ask where the water is at the distance you need it.** A compass bearing
(`Level.seaHeading`) stands the lens in a pine wood — a taiga start sits in a
channel ~150 m wide. The offshore field's GRADIENT is no better: a rider sits
mid-channel, a ridge of that field, so the slope is noise and pointed inland
on all three seeds measured. A RING of `Level.offshore` samples at the
standoff the shot wants answers it.
