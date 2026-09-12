# Audio

**The game ships no audio files.** Every sound is synthesized in the browser
from authored parameters. That is what keeps the app small enough to install
over a phone connection, keeps it working offline the moment it is cached,
and makes the sound design as reviewable as the craft catalog — a sound is a
list of numbers you can read, diff and retune. It is also the answer to the
questions a sound engine raises before it exists: no MIT-licensed sample
library, because a sample is an asset and the game ships none (and a
recording of one jet ski is one jet ski at one throttle from one seat); no
MIDI, because MIDI is a note format and a browser has no instrument to play
it on — the instrument would have to be written anyway, and it has been; no
audio library, because the whole instrument is one file over WebAudio, which
every browser already has.

The register is **a modern arcade racer on real water** — not a chip, and
not a sample library. A chip voice is an oscillator with an envelope. What a
jet ski sounds like is a small engine with grit in it, a pump that WHINES, a
sheet of spray that hisses, and water, which has no transient at all. Four
things in the instrument exist to close that gap: noise has a COLOUR (white /
pink / brown), noise has an ENVELOPE (so a splash can swell and hold instead
of just stopping), filters SWEEP, and oscillators SATURATE through a soft
curve.

## The shape of it

```
                       pwa/src/lib/synth.ts        ← the only WebAudio code
                                ▲
                        audio/bus.ts  (one context, the fader's view)
                                │
          ┌─────────────────────┴──────────────────────┬──────────────────┐
     bank.ts + bubbles.ts                   engine-voice.ts  water-voice.ts   bird-voice.ts
     (discrete sounds, the tails)           (the LAYERS: built once, steered) (who says what)
          │                                              ▲                        ▲
       route.ts                                     ride-bed.ts  ← reads     bird-bed.ts ← reads
   (GameEvent → sound)                                   ▲       GameState        ▲       GameState +
          └──────────── listener.ts ─────────────────────┴────────────────────────┘       bird-plan.ts
                     (what the camera does to the mix)
                                ▲
                          audio/index.ts  ← App.tsx's one door
```

| Module                               | What it owns                                                                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pwa/src/lib/voice.ts`               | The vocabulary: every parameter a sound may be written in, the `Synth` interface, the `Layer` a bed is made of, and the arithmetic worth testing (`envelopeShape`, `safeCutoff`, the shaper). **DOM-free.**                         |
| `pwa/src/lib/synth.ts`               | The instrument. `tone()` and `noise()` for one-shots, `layer()` for the beds, one shared echo bus, a master limiter, and the whole audio-context lifecycle.                                                                         |
| `pwa/src/game/audio/bus.ts`          | One synth, one volume-scaled view for the effects fader. A score, when it comes, is a second view — never a second synth.                                                                                                           |
| `pwa/src/game/audio/bank.ts`         | Every discrete sound the run makes, as data: the slap, two landings, the dive, a hull on a rock, the keel on the bottom, the capsize, the launch, the buoy's chime, the ring, the miss, the reset, the line — and the birds' cries. |
| `pwa/src/game/audio/bubbles.ts`      | The tail every splash gets: Minnaert's bubble, a sine chirping up, in a burst the router sizes.                                                                                                                                     |
| `pwa/src/game/audio/route.ts`        | Which sound a `GameEvent` makes, how big, which bubbles it leaves, and how it is heard from the seat it is watched from.                                                                                                            |
| `pwa/src/game/audio/listener.ts`     | What each rung of the camera ladder does to the mix — one row per `CameraMode`.                                                                                                                                                     |
| `pwa/src/game/audio/engine-voice.ts` | The engine and the pump, as eight layers: where each should be for a set of revs, a throttle, a load, a wet intake, the jet's slip and how far the exhaust has cleared the water.                                                   |
| `pwa/src/game/audio/water-voice.ts`  | The hull in the water, the wind and the sea, as seven layers: the wash, the spray, the chop, the wind, the swell, the surf and its foam.                                                                                            |
| `pwa/src/game/audio/rack.ts`         | The plumbing every bed shares: build a layer, rebuild one whose context died, steer it.                                                                                                                                             |
| `pwa/src/game/audio/ride-bed.ts`     | The scheduler: the state, once a frame, into every layer's target — and the one cue nothing reports, the slap.                                                                                                                      |
| `pwa/src/game/audio/bird-voice.ts`   | What the birds say: which cry each species makes, how often on the wing and on the rock, how far off it is heard, and the hashed draw that deals a flock's cries per quarter second. **DOM-free, plan-free.**                       |
| `pwa/src/game/audio/bird-bed.ts`     | The birds' scheduler: the one plan the renderer draws from, asked for by level; once a frame, which flocks are in earshot, how much of each is up, and the cries owed since the last frame — and the flush.                         |
| `pwa/src/game/audio/index.ts`        | The front door `App.tsx` talks to: events in, the bed fed, the seat, `silence()`, `reset()`.                                                                                                                                        |

## An event, a cue, or a bed

The engine emits `GameEvent`s from `step()` and has no idea any of them make a
noise. Three kinds of sound come out the other side:

- **Event sounds** answer a moment the simulation reported: a landing, a
  dive, a hit, the keel on the bottom, a capsize, a launch, a gate, a ring,
  a miss, a reset, the line. `route.ts` maps the event to a bank id and a
  `PlayShape` — a scale (`gain`, `pitch`, `stretch`, `pan`) applied to the
  authored voices, so one landing covers a hop off a wave and an eleven-metre
  drop off a ramp (scaled by the DESCENT the event carries, with a floor
  under it because a hull is heavy and no landing sounds like nothing; a
  descent past 5 m/s or a nose or tail more than a quarter radian off level
  picks the SLAMMED landing, which is the one with a hit in it, because the
  hull is the thing being hit). A dive is sized by how deep the bow went, a
  hit by the closing speed, a ring by how high it was taken.
- **Cues** are moments the app can read off the state and the engine never
  reported. The SLAP is the worked example: the engine publishes the hull's
  own `slam` (N, the wedge impact of the probes entering the water) on
  `CraftState`, and the bed decides when a slam is a slap — past a third of
  a g, at most one per seventh of a second, and never inside the three
  tenths after a landing, which the landing already owns. **Presentation
  never becomes a `GameEvent`.** The BIRDS are the other cue — see below.
- **Beds** have no beginning and no end. They are LAYERS — see below.

Every splash — a landing, a dive, a capsize, a reset — also leaves
**bubbles**: what a drop or a hull going under actually sounds like is not
the water but the air it trapped, ringing at Minnaert's frequency
(`3.26 / r` Hz for a radius in metres, so a 3 mm bubble is a kilohertz) and
chirping upward as it rises. `bubbles.ts` plays each as one sine with its
`to` above its `from`; `bubblesForEvent` says how many and how deep — a
handful of small quick ones after a landing, the air out of a hull after a
dive or a capsize.

And a landing that took the run's LONGEST FLIGHT gets a second voice over the
top of the splash: `recordForEvent` is a separate decision about the same
event, the way `bubblesForEvent` is, so the landing still sounds like the
landing it was — sized by how hard the hull arrived — and the news is laid
over it rather than folded into it. The chime is pitched where the water is
not: four thin sines climbing a major triad, no body at all, against a splash
that is all body and no top. Whether it is a record at all is the ENGINE's
word (`progress.bestAir`, decided in `step.ts`), so nothing in the audio
compares one flight against another.

## How a bed is made

The engine, the pump, the spray, the wind and the sea are not one-shots and
are not made of them. Each is a **layer**: a node graph the synth builds once
(`Synth.layer`) and never stops — an oscillator or a looping window onto the
noise pool, a filter, a saturation curve, a gain, a panner — and then STEERS.
Every frame `ride-bed.ts` reads the state and hands each layer a target
(`LayerTarget`: a level, a pitch, a cutoff, how hard it is pushed into its
curve, a pan) and a glide, and the layer moves there with `setTargetAtTime`
on the audio thread.

That is the whole difference between this instrument and one asked to fake a
continuous sound out of overlapping one-shots, and it is the reason the audio
does not crackle: nothing is booked ahead (a late frame leaves every layer
holding its last value rather than leaving a hole), nothing has to tile, the
audio thread does a fixed amount of work (fifteen layers for the whole run),
and a change of state is a cross-fade for free.

**SILENCE HAS TO BE SAID.** The same property means a bed that is simply no
longer fed does not stop: it holds. So a frame that is not hearing the run
says so, through `RunAudio.silence()` — `App.tsx` hushes on the pause card,
on a hidden tab and on a frozen screenshot frame, and feeds the bed on every
frame the engine steps, DUCKED to half under the attract card, the front door
and the loading card, where the bot's run is scenery. The run's events make
no noise at all without the player's hands on the craft: a gate the bot
takes under the menu is not news.

**Every layer's cutoff is held under Nyquist against the LIVE sample rate.**
A biquad's coefficients come from its cutoff divided by half the sample rate;
at or past 1 that is not a bright filter, it is undefined, and WebKit answers
with a harsh burst. The rate is not a constant: iOS picks it from the live
audio ROUTE, and a Bluetooth headset in hands-free mode drops the whole
session to 16 kHz. `safeCutoff()` in `voice.ts` clamps every cutoff,
authored or steered, and `tests/audio_test.ts` walks every authored filter
against every rate a context comes back at and sweeps the beds' computed
cutoffs across their whole range. Every authored cutoff sits under 7 kHz for
the same reason: the clamp stops the fault but cannot give back a hiss
authored above the ceiling.

**No voice ever starts on a step** (`MIN_ATTACK_MS`), **and the saturation
is soft** (`tanh`, never a clip). Both are the sibling rally game's lessons,
carried across whole.

## What the engine is made of

Every craft in the catalog is a **three-cylinder four-stroke**, the modern
marine engine, so the firing note is `rpm / 60 × 1.5` (`FIRINGS_PER_REV`):
idle (1500 rpm) is a 38 Hz chug felt more than heard, the limiter (8000) is
200 Hz of a small engine being asked for everything. The revs are the
engine's own `craft.rpm` — the same number the dial reads, so the needle and
the note can never disagree — and the band they are read against is the
craft's own idle and redline (`revOf`). Eight layers, eight jobs
(`engine-voice.ts`): a HUM (the firing note, a detuned triangle pair driven
harder into the curve with the load), its OCTAVE (which carries the note at
idle where 38 Hz is a thing a phone cannot reproduce), a RASP (the exhaust's
edge, a driven sawtooth in a band that climbs, the layer heard from BEHIND),
a BASS (a sine an octave under, floored at 44 Hz), the INTAKE (the airbox
under the seat, pink noise opening with the throttle), the pump's WHINE (the
impeller's three blades passing the stator's six vanes, `rpm / 60 × 18` — a
sine far above the note, 450 Hz at idle and 2.4 kHz at the limiter, the
sound everyone on a beach knows a jet ski by), the FROTH (cavitation — white
noise at the transom when the pump is asked for more than the water will
give, fullest on a launch from rest and gone once the hull is running, read
off the jet's SLIP against the hull's speed) and the GURGLE (the wet exhaust,
the blat of a pipe that exits below the waterline).

**The load is the throttle with water to push against.** `craft.throttleEff`
is in the state; the bed multiplies it by how fed the intake is
(`INTAKE_WETTED` — a quarter of the bottom wet), so in the AIR, where the
physics unloads the pump and runs the crank free to the limiter, the froth
goes, the whine thins to a dry whistle and the hum loses its grit.

**The exhaust exits under the waterline, and it is the loudest fact about
what a jet ski sounds like.** A runabout's pipe comes out below the boot, so
for nearly the whole of a run the engine is heard THROUGH WATER — which is an
attenuator and a lowpass both, and why a machine that is deafening on a
trailer is a burble from a beach. `exhaustClear(wetted, airborne, capsized)`
is that reading, 0..1: the share of the bottom that is DRY, cubed, because
the pipe sits low and aft and is the last thing on the hull to clear the
surface. Measured, it runs about 0.001 at rest, 0.03 at half throttle, 0.24
at full plane and 1 in the air; capsized is 0, because a hull on its back has
its bottom in the air and its pipe under the surface.

Everything either side of the waterline hangs off it. With the pipe under,
the hum and its octave are held to `SUBMERGED` (0.35) of their level and the
hum's cutoff to 45% of its brightness, the rasp — the exhaust's own edge, the
layer the water owns outright — to 15%, and the GURGLE carries the engine
instead: it is scaled by `1 − clear` rather than by the revs, so a pipe under
water goes from an idle knock to a hard wet tearing rather than being blown
clear. The bass is least affected (75% at worst), because the block is bolted
to a hull and a hull is a drum. Come out of the water and it inverts inside a
few tenths — the note brightens, the rasp cracks open, the blat stops.

So the engine is not one loudness with the air as an exception. It is **two
voices either side of the waterline**, and the ordinary state of a run is the
quiet one: coming out of the water is what makes the engine an event.

## What the water is made of

Seven layers (`water-voice.ts`), and a rule over all of them: **water has no
transient**. The WASH is the hull pushing water aside at displacement speed,
a brown rush that rises to the hump (6 m/s) and hands over as the bottom
lifts; the SPRAY is the sheets off the chines once it has, a pink hiss on a
power of the pace that is the game's whole sense of speed, and gone the
instant the hull is in the air; the CHOP is the bottom crossing a short sea,
a mid band that grows with the wave height under the hull (the two bands'
heights by their shares at the craft's own position, the same partition
`surfaceAt` reads) and with the pace — the individual big ones are the slap;
the WIND is the air past the rider's ears on the SQUARE of the apparent wind
(the craft's speed and the true wind as one vector, so a headwind is loud and
a tailwind quiet at the same pace), and the only hull-side layer that keeps
going in the air; the SEA is the swell itself, a low breathing rumble that is
nothing in a flat calm and most of the world in a storm; the SURF is the
break on the shore, read off the level's own `offshore` field — how far the
beach is (nothing past 260 m), which side it stands (the field's gradient,
panned through the input model's one screen flip), how big the ocean band is
— and breathing on the sea's own peak period in sets that group the way real
ones do; the FOAM is the same break's top end, the wash running up the sand a
moment after each set.

## What the birds say

The sky is heard between things, never over them. The birds the renderer
draws (`bird-plan.ts` — the flocks, their roosts, their loops, the skeins
crossing on passage) cry through `bird-bed.ts`, which asks for the SAME plan
(`birdPlanFor`, kept against the level), so the ear and the eye agree without
either being told about the other. Six of the eight speak (`bird-voice.ts`, `BIRD_CALLS`): the gull's
'kyow' — a driven sawtooth gliding down through a nasal band with the throat's
wobble on it, the everyday racket off the skerries; the tern's 'kee-arr', the
harshest and smallest; the drake eider's soft 'ah-ooo' off a raft, the quietest
on purpose; the goose's nasal double honk, the whooper's rising bugle and the
crane's rattling trumpet, which are what a skein going over sounds like from
a hundred metres down. The cormorant and the eagle keep quiet: the eagle's
thin yelp is a thing a coast hears a few times a year, and its silence over
the water is the character. Every cry is a small driven oscillator with its
own FORMANT (a bandpass sat where the syrinx resonates) and a glide, because
every call a bird makes is a glide; the long ones sit on the echo bus so they
come off the shore. All of them are authored under the water's smallest
splash, and `tests/audio_test.ts` holds them there.

**A cry is a cue, never an event**, and it is a HASH, not a die. Each species
has a rate per bird per minute on the wing and another at rest (`callRate`,
blended by how much of the flock is up — `flightShare`, read off the plan
without posing a bird — and with the roost dimmed toward a night floor by
the same sun the sky is lit by). The bed turns that into a chance per
quarter-second slot (Poisson, capped so a bigger flock is not a busier one)
and draws each slot of the window since the last frame off the flock's own
scatter with `hash2` — the draw the plan places its birds with — so a seed
cries the same cries on every ride, a replay cries them again, and nothing
touches `state.rng`. A flock is heard from where it IS (its rock at rest, its
beat in the air), at its authored level inside a reference distance and on
the inverse square past it, faded to nothing over the last third of its
reach; panned to the side it stands through the input model's one screen
flip; and pitched a little differently every time, because a colony is many
throats. A skein is heard from its leader with the height in the distance,
so it is faint by construction. The window a frame owes is capped at a
second, and `silence()` forgets it, so a tab that was away for a minute does
not come back to a minute of gulls at once.

**The flush is the one bird sound the craft causes.** The rule — a raft or a
shore flock goes up for a hull inside `FLUSH_RADIUS` of its home, re-armed
only once the flush is over — is `flushAt` in `bird-plan.ts`, stated once
and kept twice: the renderer's memory draws the raft going up, the bed's
plays it. The eider's whirr (pink bursts at a wingbeat's cadence, each softer
than the last as the birds clear the surface, over a wash of the water they
threw) and three shouts of the flock's own cry, louder than an ordinary one
and spread over the second the birds take to get up, booked on the ENGINE's
clock so a pause holds them with the run.

## The listener

The picture moves from the foredeck to a helicopter and the sound moves with
it (`listener.ts`, one row per `CameraMode`, read by the beds every frame and
by the router for every one-shot). On the foredeck the engine is behind you
and the water is an arm's length away — the bow slicing, the spray, the wind
full in the face. On the saddle the engine is under you and the intake at
your knees. Over the transom the pump and the exhaust are the loudest things
in the world. Behind and above (`chase`, the seat the game is tuned at) it
is all there in proportion. Stood back and flown high the craft is a small
thing on a big sea: the engine thin, the wind gone, the surf and the swell
most of what there is. One-shots take the seat's `events` gain and its
`muffle`, a pitch multiplier that moves every filter down with it. A
camera-dependent sound is a column in that table, never a branch in a bed.

## Options

OPTIONS ▸ SOUND is one fader, 0–100% in twentieths, reading OFF at the
bottom of its travel; the pause card opens the same page. It scales one view
of the one synth, and a layer reads the fader every frame, so a fader moved
mid-run is heard at once. A MUSIC fader arrives with the music, not before.

## When audio is allowed to start

A browser makes no sound before the player has touched something, and a
context built outside a real gesture is one iOS Safari will never resume —
so the unlock hangs off actual gestures only: a document-wide `pointerdown`
and `keydown` in the capture phase (`App.tsx`), so a card that stops
propagation cannot swallow it. Backgrounding the app suspends the context; a
zombie context is healed by a suspend/resume cycle and, failing that,
replaced on the player's next touch, with every layer built on the old one
reporting itself dead and rebuilt; a headset connecting re-seats the route.

## Judging any of it

```sh
make audition                       # previews/audition.html — listen
make audition ARGS=--meter          # ...and the level table, from a headless Chromium
```

The page is built from the repository's own code — the same synth, bank and
beds that ship, compiled and inlined — with the engine and the pump under
sliders for the revs, the throttle and the jet's slip (and a switch for the
air), the water under sliders for the pace, the planing, the sea under the
hull, the apparent wind, the surf and how far off the shore is, a row of
SEATS so the mix can be heard from every camera, and every sound in the bank
on a button beside the description it was written against. It is the only
honest way to judge a continuous sound.

The meter is for a reviewer — or a session — that cannot listen: it drives
that page in Chromium, taps what reaches the master limiter with an
analyser, and prints a level in dBFS for six bed presets (idle, a launch from
rest, cruise, flat out, the air, a storm at the shore) and for every sound in
the bank. It is read as a SHAPE — idle under cruise under flat out, the air
under flat out with the water gone, the big water at the top of the bank and
the chimes at the bottom, nothing within a few dB of the limiter — and the
`sound-effects` skill says what each row should do. It is not a judgement: a
sound that meters right can still be the wrong sound. A mix that meters
wrong is wrong.

`tests/audio_test.ts` holds the rest: every event routes to a sound the bank
has, no voice exceeds the ceiling, the chimes stay under the water, every
water noise opens over an attack, the engine works harder under load and
runs free in the air, the spray is nothing until the hull planes and steep
with the pace, only the wind survives the air, the surf falls with the
distance to the shore and breathes inside its floor, the listener has a row
per rung, the bed builds its layers once and steers them every frame, books
nothing ahead, rebuilds them on a replaced context, says its silence, raises
the slap once per gap and never inside a landing, every bird that speaks
names a sound the bank has and stays under the smallest splash, the cries
are dealt the same twice and never two in a slot, a flock is heard within
its reach and not past it, a flushed raft shouts once and forgets it on a
reset, and the bird bed follows the seat, the duck and its silence — and
every cutoff, authored or steered, stays under the headset's Nyquist.
