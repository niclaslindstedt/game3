// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PICTURE OPTIONS, and WHAT EACH ONE ACTUALLY BUYS. A row on the options
// page is one word — "low", "medium", "high" — and every part of the renderer
// that answers to it needs a number, a distance or a flag. Those tables are
// here, one per lever, each saying what the lever costs and what it is worth.
// Nothing in this file draws anything: it is the dictionary between a menu row
// and a draw call, and it is DOM-free so the root suite can read the whole
// ladder without a browser (`tests/video_test.ts`).
//
// THE WORDS ON THE CHIPS ARE NOT HERE. Every one of them is `strings.ts`'s
// (§39.1); this file names the STOPS and the menu looks their labels up.

/** THE PICTURE, AS FIVE QUESTIONS: how much sea, how many pixels, how much
 * world, how far that world runs before the haze takes it, and whether you can
 * see INTO the water — and a sixth row that is about the MACHINE rather than
 * the picture, how many frames a second it is asked for. Every lever below is
 * real and read by the renderer, but a rider does not have an opinion about
 * pine density — they have an opinion about whether the game is smooth, and
 * about which of the things making it unsmooth they would rather keep. Six
 * rows is what lets them answer that.
 *
 * The point of the split is that the costs are NOT the same cost, and a
 * machine can be short of one while rich in another:
 *
 *   WATER       is CPU. The grid is the only thing in the frame that calls the
 *               engine's `surfaceAt` thousands of times a frame, and that call
 *               is a sum over the sea's components. Nothing about the GPU
 *               makes it cheaper.
 *   RESOLUTION  is pixels — every one of them, every frame, whatever is on
 *               screen. The single biggest lever on a weak GPU.
 *   DETAIL      is how much world there is per metre: the spray thrown off the
 *               hull, the sea life under the surface, the tree line behind the
 *               shore, how many sheets of cloud are in the sky (and so in the
 *               sea reflecting it), and whether the rain lands on the water.
 *   DISTANCE    is how many metres of it there ARE — vertices, and nothing
 *               else. Where DETAIL thins the wood the rider is riding past,
 *               DISTANCE decides how much coast is submitted at all, and pulls
 *               the fog in over the cut so the shore ends in weather rather
 *               than at an edge.
 *   SEE-THROUGH is the one thing on the page that is a LOOK rather than an
 *               amount — and it is paid twice over, in a transparent pass over
 *               most of the frame and in everything drawn under it.
 *   FRAME RATE  is TIME: how often all of the above is asked for. Every other
 *               row makes a frame cheaper; this one makes fewer of them, on
 *               a schedule the machine can keep.
 *
 * A phone with a dense screen is the ordinary case of wanting one and not the
 * others: it wants the pixels it paid for and would rather give up the sea
 * life than look at a soft picture. Under one knob that trade cannot be said
 * at all. */
export type VideoSettings = {
  /** HOW FAR OUT THE SEA IS STILL A SEA — the near grid's fineness and reach,
   * how far the ripples survive, and how sharply a tile is sampled along the
   * water. Its own row (WATER), and the reason this page exists: the shader is
   * handsome under the rider and the wave a dozen metres out is a facet.
   * Rebuilds the water grid when it is set, which is a few milliseconds and
   * happens while a card is up. */
  water: WaterLevel;
  /** HOW FAR THE WORLD RUNS before the haze closes over it — how much shore is
   * drawn, how far out its cover is planted, and how hard the fog is pulled in
   * to meet them. Its own row (DISTANCE), and the cheapest frames on the page:
   * everything it takes away is geometry that was already inside the fog.
   *
   * It applies from the next frame with nothing rebuilt — the shore's chunks
   * and the cover's stands are hidden and shown, never re-planted. */
  distance: DistanceLevel;
  /** What share of the device's own pixels the frame is drawn at — its own
   * row (RESOLUTION), and it applies the moment it is set. */
  resolution: ResolutionLevel;
  /** THE SEA AS A WINDOW: inside the near grid the surface is transparent and
   * what lies under it — the bed, a rock's foot, a school of fish — is drawn
   * and visible. Off, the near water is opaque at every angle and nothing
   * beneath it is drawn at all.
   *
   * Its own row rather than a share of DETAIL because it is not an amount of
   * anything: it is the difference between a sea you look into and a sea you
   * look at, which is a taste as much as a budget. It is also the dearest
   * thing in the frame on a tile GPU — a blended pass over most of the picture
   * with the whole sea bed already drawn behind it — so it is the row to reach
   * for first on a phone that is struggling. Applies the moment it is set. */
  seeThrough: boolean;
  /** THE WATER THROWN OFF THE HULL: the chine sheets, the rooster tail, the
   * plume a landing punches out, the patches they leave behind (`spray.ts`).
   * Part of DETAIL, and it applies the instant it is set — none of it is
   * geometry, it is a pool spawned into per step. Thousands of alpha-blended
   * sprites right in front of the lens, which is where a fill-bound machine
   * hurts most. */
  spray: SprayLevel;
  /** WHETHER ANYTHING SWIMS HERE (R20) — the pods under the surface, drawn
   * only inside the see-through radius anyway. Part of DETAIL, and it applies
   * the instant it is set. Two stops rather than three because there is no
   * half measure worth having: the pods are already culled to what the rider
   * can see into. */
  fauna: boolean;
  /** HOW THICKLY THE SHORE IS PLANTED — the wood behind the beach, the scrub
   * on the bank, the grass, the reed in the river's margins and the loose
   * stone at the waterline (`flora.ts`). Part of DETAIL. One instanced draw
   * call a SPECIES whatever the count, so what this buys is vertex work rather
   * than submission, and it applies the instant it is set: the cover is planted
   * once at its thickest and the row decides how much of it is drawn. */
  flora: FloraLevel;
  /** HOW MUCH SKY THERE IS — how deep the cloud sheets are read, whether
   * their sunlit faces are found by a second sample, and how many sheets may
   * be stacked at once (`SKY_LOOK`). Part of DETAIL, and it recompiles the
   * dome and the water's mirror on its way, which is a few milliseconds.
   *
   * It is the steepest per-pixel lever the game has, because it is paid
   * TWICE: once on every pixel of sky, and again on every pixel of sea,
   * which reflects the same sheets. That is also why it is worth the most —
   * over open water the sky and its reflection are most of the frame. */
  sky: SkyLevel;
  /** WHETHER THE RAIN LANDS ON THE SEA — the rings a downpour pocks the
   * surface with (`water-shader.ts`), and how far out they are drawn. Part of
   * DETAIL, and it applies the instant it is set.
   *
   * OFF is genuinely off rather than a short fade: the whole nine-cell ring
   * loop is skipped, so a level under a clear sky pays nothing for it at any
   * stop and a phone in a downpour pays nothing for it at this one. */
  rainRings: RainRingLevel;
  /** HOW MANY FRAMES A SECOND THE GAME MAY DRAW — its own row (FRAME RATE),
   * and the one row on the page that is not about the picture at all but
   * about the machine drawing it. A display refreshing at a hundred and
   * twenty asks for a frame every eight milliseconds, and a frame this game
   * cannot finish in eight is drawn late, unevenly, on a chip that is
   * heating up to do it; holding the rate at sixty, or at thirty on a phone
   * that cannot keep sixty, is the same work done on time. The engine never
   * learns the number: it steps at 120 Hz behind whatever frames are drawn
   * (`run-loop.ts`), and `frame-rate.ts`'s gate is where a callback is
   * skipped. MAX is the display's own rate, whatever it is. */
  frameRate: FrameRateLevel;
};

export const WATER_LEVELS = ["low", "medium", "high"] as const;
export type WaterLevel = (typeof WATER_LEVELS)[number];

export const DISTANCE_LEVELS = ["low", "medium", "high"] as const;
export type DistanceLevel = (typeof DISTANCE_LEVELS)[number];

export const RESOLUTION_LEVELS = ["low", "medium", "high"] as const;
export type ResolutionLevel = (typeof RESOLUTION_LEVELS)[number];

export const SPRAY_LEVELS = ["off", "low", "full"] as const;
export type SprayLevel = (typeof SPRAY_LEVELS)[number];

export const FLORA_LEVELS = ["sparse", "normal", "lush"] as const;
export type FloraLevel = (typeof FLORA_LEVELS)[number];

export const SKY_LEVELS = ["low", "medium", "high"] as const;
export type SkyLevel = (typeof SKY_LEVELS)[number];

export const RAIN_RING_LEVELS = ["off", "near", "far"] as const;
export type RainRingLevel = (typeof RAIN_RING_LEVELS)[number];

export const FRAME_RATE_LEVELS = ["30", "60", "max"] as const;
export type FrameRateLevel = (typeof FRAME_RATE_LEVELS)[number];

/** What each FRAME RATE stop holds the loop to, frames a second. `max` is no
 * cap at all — every animation frame the display offers is drawn — and it is
 * spelled as infinity so a gate built on it never skips. */
export const FRAME_RATE_CAP: Record<FrameRateLevel, number> = {
  "30": 30,
  "60": 60,
  max: Number.POSITIVE_INFINITY,
};

/** THE SKY LADDER — what each stop of the SKY lever compiles into the dome
 * and into the water's mirror.
 *
 * `layers` is the steep one: every sheet is a whole field of noise sampled on
 * every sky pixel and again on every sea pixel, and which sheets go is the
 * cloud chart's `rank` rather than their altitudes. One sheet is the sky the
 * level is actually ridden under and nothing over it — a deck with no scud
 * under it, a cirrus veil with no cumulus below. `octaves` is how much
 * structure each sheet has: three is mass with one arm of erosion, five is a
 * cauliflower edge. `sunlit` takes a second sample toward the sun to find
 * which way a cloud's surface faces, and it is the difference between cloud
 * and cotton wool. */
export const SKY_LOOK: Record<SkyLevel, { octaves: number; sunlit: boolean; layers: number }> = {
  low: { octaves: 3, sunlit: false, layers: 1 },
  medium: { octaves: 4, sunlit: true, layers: 2 },
  high: { octaves: 5, sunlit: true, layers: 3 },
};

/** Where the rain's rings begin to fade and where they are gone, m from the
 * lens. `off` is both zero, which the shader reads as "draw none".
 *
 * NEAR is the honest reach: a raindrop's ring is a hand's width across, and
 * past twenty metres it is under a pixel — what the eye is actually reading
 * out there is the sheet in the air and the fog behind it. FAR carries them
 * out to where the near water grid gives way, which on a machine with the
 * pixels for it is the difference between a shower on the boat and a shower
 * on the bay. */
export const RAIN_RING_REACH: Record<RainRingLevel, readonly [number, number]> = {
  off: [0, 0],
  near: [9, 22],
  far: [20, 48],
};

/** What one stop of the WATER row builds. `water-mesh.ts` lays its grid out of
 * the first three and `water-shader.ts` reads the last two. */
export type WaterLook = {
  /** Vertices a side of the near grid. Its square is how many times the
   * engine's `surfaceAt` is called per frame, and that is the whole bill. */
  grid: number;
  /** How far the near grid reaches either side of the craft, m. */
  half: number;
  /** The cell at the craft, m. The grid is laid on a cubic, so the cell grows
   * to about four times this at the edge — detail is spent where the camera
   * is, and the far cells carry the long swell, which is all that survives
   * the distance anyway. */
  cell: number;
  /** Where the shader's ripples begin to fade and where they are gone, m from
   * the lens. Past that the broad glint lobe carries the roughness on its own,
   * and the sea reads as a smooth sheet with a highlight on it. Pushing this
   * out costs nothing per pixel — the tile is fetched either way — but it does
   * cost aliasing, which is why the top stop is paired with the anisotropy
   * that keeps a tile legible at a grazing angle. */
  rippleFade: readonly [number, number];
  /** Anisotropic samples for a tile seen ALONG the water — the ripples, the
   * foam. Isotropic mip selection at a grazing angle blurs a tile across the
   * view as hard as along it, and what is left is streaks radiating from the
   * lens. three clamps this to what the hardware has. */
  anisotropy: number;
};

/** THE WATER LADDER — the row this page was built for.
 *
 * MEDIUM is the design point: the grid the game was tuned on, and the picture
 * every screenshot in the repo was taken at. LOW and HIGH are a real step
 * either side of it rather than a shade, because a stop that does not visibly
 * buy anything is a stop nobody would move to.
 *
 * The three numbers at the top of each row multiply into the cost: `grid`
 * squared is the call count, and `cell` decides how much of that fineness
 * lands near the rider rather than out at the edge. LOW is about six tenths of
 * the design point's calls, HIGH about one and three quarters — which is the
 * honest price of a sea that is still a sea twenty metres out, and the reason
 * it is a row the player turns rather than a number the game picks.
 *
 * HIGH does not simply push the same profile further: it drops the centre cell
 * to well under a metre, which is where the short wind chop stops being two
 * samples per wave. That is what the crudeness a few metres out actually IS —
 * a wave shorter than two cells cannot be drawn at all, however far the grid
 * reaches. */
export const WATER_LOOK: Record<WaterLevel, WaterLook> = {
  // The phone that stutters: a coarser sea over a shorter reach, the ripples
  // given up early, and the cheapest filtering that is still not streaks.
  low: { grid: 56, half: 110, cell: 2.2, rippleFade: [40, 170], anisotropy: 2 },
  // The design point.
  medium: { grid: 72, half: 120, cell: 1.5, rippleFade: [60, 260], anisotropy: 8 },
  // A machine with headroom: a cell under a metre at the rider, half again the
  // reach, and the ripples carried out to where the far grid takes over — the
  // sea the shader was written for, at the distance a rider actually looks.
  high: { grid: 96, half: 140, cell: 0.85, rippleFade: [120, 460], anisotropy: 16 },
};

/** What one stop of the DISTANCE row is worth. Two radii and a haze, and the
 * three are one answer rather than three: the radii say where the world stops
 * and the haze says how far the eye gets before it stops caring, and a stop
 * that moved one without the others would be either a visible edge or a
 * needlessly murky day. */
export type DistanceLook = {
  /** How far the SHORE is drawn, m from the lens. A chunk of ground whose
   * bounding sphere lies wholly beyond this is not submitted. */
  shore: number;
  /** How far the COVER is drawn, m from the lens — the trees, the scrub, the
   * grass, the reed and the loose stone (`flora.ts`). Always inside `shore`:
   * a stand of pines is a silhouette and the slab under it is not, so cover
   * that outlived its ground would be a wood standing on the sea. */
  cover: number;
  /** What the sky's own fog range is worth here — a multiplier on the
   * preset's `fogNear` AND `fogFar` (`sky.ts`), applied before whatever is
   * falling shortens it again (`weather.ts`).
   *
   * THIS IS THE HALF THAT MAKES THE ROW HONEST. Hiding geometry is easy; the
   * hard part is that the rider must not be able to SEE it hidden, and the
   * only thing that hides a cut-off is air. So every stop pulls the fog in
   * until it has closed over its own radii — `tests/video_test.ts` holds the
   * table to it against the clearest sky the ladder can deal — and what the
   * rider gets for choosing LOW is not a shore that ends, but a hazier day.
   *
   * It is also the reference generation's own answer. The 90s jetski racers
   * ran on machines that could draw a few hundred metres of world, and what
   * they did about it — every one of them — was to put weather in front of
   * the edge. A short view here reads as that era rather than as a budget. */
  haze: number;
};

/** THE DISTANCE LADDER — how much coast there IS.
 *
 * The cheapest frames on the page, because almost everything it takes away was
 * already invisible: a level is some seventeen hundred metres across and the
 * clearest sky the game deals closes at under six hundred, so the design point
 * itself can drop the far half of the shore and the wood on it without
 * changing one pixel. That is what MEDIUM is — the picture the game was tuned
 * on, minus the geometry nobody could see.
 *
 * LOW is where the row starts costing something, and it costs it in AIR: the
 * fog comes in to a bit over half its range so the shore can end at four
 * hundred and sixty metres inside it. The day is hazier. Nothing is missing.
 *
 * HIGH spends a fast machine's headroom on the opposite trade — the fog pushed
 * out a stop past what the sky authored, and the coast drawn out to meet it.
 * Modestly: the shore's own skirt runs out only so far, and a view long enough
 * to reach the end of the world is a worse picture than a short one. */
export const DISTANCE_LOOK: Record<DistanceLevel, DistanceLook> = {
  low: { shore: 460, cover: 380, haze: 0.55 },
  medium: { shore: 900, cover: 700, haze: 1 },
  high: { shore: 1500, cover: 1150, haze: 1.15 },
};

/** What share of the DEVICE'S OWN pixels each stop draws — a multiplier on the
 * ratio the page has already capped at `MAX_DPR`, not a second ceiling over
 * it.
 *
 * A share rather than a ceiling because a ceiling asks the wrong question: as
 * a ceiling, "1" is the whole screen on a laptop and a ninth of it on a phone
 * handing the page three device pixels per CSS pixel, so one row would buy a
 * native picture on the machine with headroom and a soft one on the machine
 * that paid for a dense screen. As a share every stop means the same thing
 * everywhere — HIGH is the screen the device has (up to the cap), and each
 * stop down is a smaller canvas scaled up.
 *
 * The ladder is gentler than a straight halving because `MAX_DPR` has already
 * taken the worst of it: a 3× phone is drawing at 2× before this row is
 * consulted, so LOW here is a quarter of the pixels of the screen rather than
 * a sixteenth, and it is still legible enough to ride. */
export const RESOLUTION_SCALE: Record<ResolutionLevel, number> = {
  low: 0.5,
  medium: 0.75,
  high: 1,
};

/** Spawn-rate multiplier per spray stop; `off` also takes the sheets, the tail
 * and the foam patches out entirely. */
export const SPRAY_SCALE: Record<SprayLevel, number> = {
  off: 0,
  low: 0.45,
  full: 1,
};

/** How much of the cover is drawn, as a share of what `flora.ts` plants. It
 * is planted at `lush` whatever the row says and the row sets the instance
 * count per species, so moving it costs nothing and shows immediately — and
 * thinning it can never change what the hull hits, because nothing in the
 * roster is a solid. The rocks in `rocks.ts` are never thinned for the same
 * reason in reverse: they ARE solids, and a rock you can hit but cannot see is
 * the worst bug a picture setting could buy. */
export const FLORA_SCALE: Record<FloraLevel, number> = {
  sparse: 0.4,
  normal: 1,
  lush: 1.6,
};

/** The three levers DETAIL owns. Named as a slice of `VideoSettings` rather
 * than restated, so adding another is a decision about which row it belongs on
 * instead of a silent omission from both. */
export type DetailSettings = Pick<VideoSettings, "spray" | "fauna" | "flora" | "sky" | "rainRings">;

export const DETAIL_LEVELS = ["low", "medium", "high"] as const;
export type DetailLevel = (typeof DETAIL_LEVELS)[number];

/** What each DETAIL stop is worth, cheapest first — the order the ladder is
 * walked and the order `detailOf` breaks its ties in. Changing a preset here
 * changes what LOW, MEDIUM and HIGH mean everywhere, including for every blob
 * already stored.
 *
 * They are one row because they are one judgement with one answer: nobody has
 * an opinion about the tree line that is not also an opinion about whether
 * there are fish under the boat. */
export const DETAIL_PRESETS: Record<DetailLevel, DetailSettings> = {
  // The phone that would rather have the frames: under half the spray, an
  // empty sea under the hull, a thin tree line, one cloud sheet read shallow,
  // and a sea the rain does not land on.
  low: { spray: "low", fauna: false, flora: "sparse", sky: "low", rainRings: "off" },
  // The design point — every lever at the number the game was tuned on.
  medium: { spray: "full", fauna: true, flora: "normal", sky: "medium", rainRings: "near" },
  // A machine with headroom: a thicker shore, a third cloud sheet read a stop
  // deeper, and the rain landing out to where the near grid gives way. The
  // spray is already every droplet the hull throws and the sea life already
  // every pod the rider can see into, so those two have nowhere left to go —
  // a stop that promised more would be the page inventing work to sell.
  high: { spray: "full", fauna: true, flora: "lush", sky: "high", rainRings: "far" },
};

/** Where the rows stand on a first visit — and the answers are not the same
 * answer, because the costs are not the same cost.
 *
 * WATER ships MEDIUM: the design point, the grid every number in the water was
 * tuned against. HIGH is a choice somebody makes after finding out their
 * machine can hold it, and LOW is one they make after finding out it cannot —
 * neither is a default anybody should be given without asking.
 *
 * RESOLUTION ships HIGH, which is the device's own screen under the page's
 * cap. Sharpness is the one thing a rider cannot get back by looking harder: a
 * soft picture reads as a cheap game on the first frame, before anything has
 * been ridden. It is also the row that is cheapest to MOVE — it applies mid-run
 * with nothing rebuilt — so a machine that cannot hold it says so within a
 * gate and the fix is one press away.
 *
 * SEE-THROUGH ships ON, because it is most of what makes this water read as
 * water rather than as a painted surface: the bed coming up under the shallows
 * and a school crossing under the hull are the two things that say there is a
 * volume down there. It is the first row to turn off on a phone that is
 * struggling, and the last one a machine with headroom should ever give up.
 *
 * DETAIL ships MEDIUM, the design point, for the same reason WATER does.
 *
 * DISTANCE ships MEDIUM because MEDIUM is free: at that stop the fog closes
 * before the shore does on every sky the game deals, so the default picture is
 * the tuned one and the machine simply stops drawing what was never visible.
 * A rider only ever moves this row to buy something — frames at LOW, a longer
 * view at HIGH — never to get back to correct.
 *
 * FRAME RATE ships MAX — the display's own rate, which is what every browser
 * game a rider has met does without asking. It is the row to reach for on a
 * phone that draws unevenly, and a cap is a choice about THIS machine that
 * nothing here can make for it. */
export const DEFAULT_VIDEO: VideoSettings = {
  water: "medium",
  distance: "medium",
  resolution: "high",
  seeThrough: true,
  frameRate: "max",
  ...DETAIL_PRESETS.medium,
};

/** Which DETAIL stop a set of levers IS: by exact match, else the stop that
 * agrees with the most of the three, ties going to the CHEAPER picture because
 * `DETAIL_PRESETS` is walked cheapest first. So a blob written on another
 * build's ladder lands on the picture it most resembles, and never on a
 * heavier one than it asked for. A blob with none of the three in it is a blob
 * with no opinion, which is MEDIUM: the design point, not the floor. */
export function detailOf(video: Partial<VideoSettings>): DetailLevel {
  const keys = Object.keys(DETAIL_PRESETS.medium) as (keyof DetailSettings)[];
  let best: DetailLevel = "medium";
  let agreed = 0;
  for (const id of DETAIL_LEVELS) {
    const agree = keys.filter((key) => DETAIL_PRESETS[id][key] === video[key]).length;
    if (agree > agreed) {
      best = id;
      agreed = agree;
    }
  }
  return agreed > 0 ? best : "medium";
}
