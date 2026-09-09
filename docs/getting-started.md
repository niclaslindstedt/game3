# Getting started

## Playing

Open [game3.niclaslindstedt.se](https://game3.niclaslindstedt.se/). The game boots straight onto the water: a generated stretch of taiga shore, the sea beside it, a course of buoy gates laid along the coast, and your craft idling behind the first gate. There are no menus yet — this is the vertical slice — so the run starts when you open the throttle, and the clock with it.

**What a run is.** The course is a line of gates, in order. A **water gate** is two buoys; cross the line between them, the right way round, and it counts. An **air gate** is a ring hanging over the water with a floating **ramp** moored before it: hit the ramp with pace, lean back, and fly through the ring. Skip a gate by passing the one after it and the missed one is still counted as reached, with a penalty on the clock. The last gate is the finish. **R** puts you back at the last gate you passed, facing the next one; **Enter** restarts the whole run on the same shore.

**Choosing a level.** Every level is generated from a seed, so a URL is a level: `?seed=38` opens seed 38, and `?craft=marlin` picks the craft (`skiff`, `marlin`, `otter`, `dart`). The seed is in the HUD corner, beside the build label — send both with a bug report and whoever reads it stands on the same water.

**The craft.** Four ship, and what separates them is real physics off a data card rather than a badge: the **skiff** (a light runabout — quick, nimble, skittish in chop), the **marlin** (heavy performance — the fastest, and it needs room), the **otter** (stable touring — the heaviest, the softest over waves, slow to turn) and the **dart** (a stand-up — the lightest, the most agile, the least stable). There is no rider drawn yet; the rider is a point mass in the spec, and the lean you input is that mass moving.

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

There is no brake, no handbrake and no gear: a jet ski has a throttle and a nozzle, and that is the whole of it. Which means the one thing to learn early — **no throttle, almost no steering**. The nozzle turns the thrust; with no thrust there is nothing to turn. Off the throttle the hull keeps going where it was pointed, with only the keel's small say in the matter. To turn, stay on the gas.

**Phone (touch).** The LEFT half of the screen is the handlebar: touch anywhere and move your thumb — sideways travel steers, vertical travel leans (down toward you is back, nose up). The RIGHT half is the throttle lever: touch anchors it at zero, and dragging DOWN opens it — full throttle at about ninety pixels of travel — analogue, held for as long as the finger is down, and closed the moment it lifts. Both overlays are drawn under the thumb that owns them. Works in portrait and landscape.

### How a run reads

The HUD is the game's own type over the water: **speed** big in km/h, the **rpm bar** under it (no gear to show), the **run clock** and **gate n / N** top left with the **last split** beside them, a **wind vane** — the direction it blows from and the metres per second — and, whenever the hull leaves the water, an **air time** counter that runs until you land. The build label sits in the corner.

**The water is the game.** The sea is a sum of real waves, built from the level's wind by a fetch-limited spectrum: in the lee of the shore it is nearly flat, and the further out you ride the more the wind has had room to work on it, so the swell grows with distance from the coast. It shoals as it comes in — steepening over the shallows, and breaking where it gets too tall for the depth under it. The hull floats on that surface by displacement, twelve probes reading the water under them; it lifts onto the plane as speed rises and the drag drops away through the hump; and it feels the orbital motion of the wave itself, so a crest gives it a shove and a trough takes one back. A hard landing decelerates hard; a nose-down landing DIVES — the bow buries, the drag spikes and the nose is dragged further down — which is what the lean is for.

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
