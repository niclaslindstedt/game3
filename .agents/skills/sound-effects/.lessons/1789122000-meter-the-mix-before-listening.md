---
title: The first cut of the mix was metered before anyone heard it — and the meter's SHAPE is the check, not its numbers
date: 2026-09-10
scope: scripts/audition.mjs, pwa/src/game/audio/
concepts: [audition, meter, mixing, tooling, review]
---

`make audition ARGS=--meter` taps whatever reaches the master limiter with an
analyser in a headless Chromium (`--autoplay-policy=no-user-gesture-required`
is what lets the context start on the script's press) and prints dBFS per bed
preset and per bank sound. The first table of this game read:

    idle, afloat, a breeze   -35.7   launch from rest  -30.1   cruise  -32.5
    flat out                 -28.8   in the air        -34.0   storm at the shore -31.9
    capsize -20.1  dive -21.5  land_hard -25.0  hit_rock -26.9  slap -30.0
    gate -35.8  air_gate -35.2  finish -28.3  bubbles -46..-52

What it settles: the ladder idle < cruise < flat out holds, the air sits
under flat out, the big water is the top of the bank and the chimes the
bottom, and nothing is within 15 dB of the limiter. What it cannot settle is
whether the whine is the right pitch of annoying or the surf breathes like a
beach — a person with ears decides that on the page.

Two traps in the meter itself: an `AnalyserNode` snapshot is 43 ms of signal,
so a short one-shot (the slap) read once after it has finished meters as
silence — poll every few tens of milliseconds for the sound's whole length
and keep the PEAK; and the surf breathes on the sea's period, so a bed read
for less than a whole breath reports wherever the set happened to be — read
for six seconds and take the mean.
