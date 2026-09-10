# Getting started

## Playing

Open [game3.niclaslindstedt.se](https://game3.niclaslindstedt.se/). The house's name comes up while the first shore is built, then the title and an invitation; press anything and you are on the front door — **START** and **OPTIONS**, over a sea that is already running, ridden by the bot. START opens the start card, which asks the four things that decide the run: which **craft**, which **shore** (a seed, with the coast it makes charted underneath it — the whole course, its shallows, its skerries and the line through its gates), what **time** of day (sunrise, day or sunset, worked out from this coast's own daylight), and what **weather** (fine, wind or storm — one word for the sky and the sea under it). Each row can be left AS DEALT, which rides the level exactly as it was generated. **RIDE** then stands the run up behind a loading card and hands it to you: a generated stretch of taiga shore, the sea beside it, a course of buoy gates laid along the coast, and your craft behind the first gate. The run starts when you open the throttle, and the clock with it. **Escape** leaves a run for the front door again.

**Options.** The craft you ride, the camera a run opens on, and whether the HUD is drawn — remembered between visits. There is no volume yet because there is no sound yet, and no key bindings because the keys below are fixed; each arrives as a row on that page the day the thing behind it does.

**The developer page.** Hold **START** for seven seconds and it appears under OPTIONS. Behind it are the same seed the start card picks, a wind and a sea in exact figures to override the level's own, the staged moments, and a COPY REPRO LINK that writes the lot back out as a URL — which is the point of it: a frame you found is a frame you can hand to somebody else.

**What a run is.** The course is a line of gates, in order. A **water gate** is two buoys; cross the line between them, the right way round, and it counts. An **air gate** is a ring hanging over the water with a floating **ramp** moored before it: hit the ramp with pace, lean back, and fly through the ring. Skip a gate by passing the one after it and the missed one is still counted as reached, with a penalty on the clock. The last gate is the finish. **R** puts you back at the last gate you passed, facing the next one; **Enter** restarts the whole run on the same shore.

**Choosing a level.** Every level is generated from a seed, so a URL is a level: `?seed=38` opens seed 38, and `?craft=marlin` picks the craft (`skiff`, `marlin`, `otter`, `dart`); add `?start=1` to skip the cards and ride it. The seed is in the HUD corner, beside the build label — send both with a bug report and whoever reads it stands on the same water. The whole set of parameters is in [configuration.md](configuration.md).

**The craft.** Four ship, and what separates them is real physics off a data card rather than a badge: the **skiff** (a light runabout — quick, nimble, skittish in chop), the **marlin** (heavy performance — the fastest, and it needs room), the **otter** (stable touring — the heaviest, the softest over waves, slow to turn) and the **dart** (a stand-up — the lightest, the most agile, the least stable). The rider on the saddle is drawn from the engine's own readings: the lean you input moves a point mass in the physics, and the figure slides and leans where that mass went, tucks into the wind as the pump opens, hangs into a turn, and takes a landing in his knees and back.

### Controls

**Desktop (keyboard).**

| Key       | Action                                                      |
| --------- | ----------------------------------------------------------- |
| ↑ / W     | Throttle — analogue in spirit: it ramps up while held       |
| ← → / A D | Steer — ramped, so a tap is a nudge and a hold is full lock |
| ↓ / S     | Lean back — nose up; in the air, pitch the nose up          |
| Shift     | Lean forward — nose down; in the air, pitch the nose down   |
| R         | Reset to the last gate passed                               |
| Enter     | Restart the run                                             |
| C         | Camera: next view                                           |
| Escape    | Leave the run for the main menu                             |

On a menu card the arrow keys (or WASD) walk the rows, Enter or Space presses one, and Escape goes back a page.

There is no brake, no handbrake and no gear: a jet ski has a throttle and a nozzle, and that is the whole of it. Which means the one thing to learn early — **no throttle, almost no steering**. The nozzle turns the thrust; with no thrust there is nothing to turn. Off the throttle the hull keeps going where it was pointed, with only the keel's small say in the matter. To turn, stay on the gas.

**Phone (touch).** The LEFT half of the screen is the handlebar: touch anywhere and move your thumb — sideways travel steers, vertical travel leans (down toward you is back, nose up). The RIGHT half is the throttle lever: touch anchors it at zero, and dragging DOWN opens it — full throttle at about ninety pixels of travel — analogue, held for as long as the finger is down, and closed the moment it lifts. Both overlays are drawn under the thumb that owns them. Works in portrait and landscape.

### How a run reads

The HUD is the game's own type over the water: **speed** big in km/h, the **rpm bar** under it (no gear to show), the **run clock** and **gate n / N** top left with the **last split** beside them, a **wind vane** — the direction it blows from and the metres per second — and, whenever the hull leaves the water, an **air time** counter that runs until you land. Under the wind vane sits the **minimap**: a square of sea around you with the shore, the shallows, the rocks and reefs, the racing line and the gates on it — the one you owe picked out, and a chevron on the frame pointing at it when it is off the window. The frame is the progress gauge, and the figure under it is how far the next gate is. The build label sits in the corner.

**The water is the game.** The sea is a sum of real waves, built from the level's wind by a fetch-limited spectrum: even in the lee of the shore it runs half a metre, and the further out you ride the more the wind has had room to work on it, so the swell grows with distance from the coast — at a hull's pace a crest every second or so: the climb, the launch, the drop into the next face. It shoals as it comes in — steepening over the shallows, and breaking where it gets too tall for the depth under it. The hull floats on that surface by displacement, twelve probes reading the water under them; it lifts onto the plane as speed rises and the drag drops away through the hump; and it feels the orbital motion of the wave itself, so a crest gives it a shove and a trough takes one back. A hard landing decelerates hard; a nose-down landing DIVES — the bow buries, the drag spikes and the nose is dragged further down — which is what the lean is for.

**The air.** A ramp is a plane the hull rides up; leave it at speed and the craft is ballistic, with the wind leaning on it and the lean input pitching it. Level the hull before the water arrives and it lands clean; land nose-down and it dives; hold the lean back off a big ramp and a **backflip** is reachable — reachable, not scored.

### Installing on your phone

The game is a PWA. iOS Safari: Share → **Add to Home Screen**. Android Chrome: menu → **Install app** (or accept the install prompt). The installed game launches fullscreen, works offline once loaded, and shows an in-app prompt when a new build ships.

## Developing

```sh
git clone https://github.com/niclaslindstedt/game3
cd game3
npm install
npm run dev
```

Then read [architecture.md](architecture.md) for the layout and [CONTRIBUTING.md](../CONTRIBUTING.md) for the workflow. The tools you'll live in while tuning: `make sim` (does the change help or hurt, measured), `make waves` (what the sea is), `make ride` (what the hull does on it), `make level` (what the generator builds), `make screenshots` (what it looks like).
