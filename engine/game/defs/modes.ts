// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FOUR WAYS ONTO THE WATER, and what each one switches on.
//
// A run is one engine over one sea, and a MODE is a bundle of rules laid
// over it rather than a second engine: whether the COURSE is counted (the
// gates, the splits, the finish at the last buoy), whether the TRICKS are
// (the two strokes on the bars and the score they buy), how many RIVALS
// stand on the grid, how long the lights hold everybody before the clock
// starts, and whether the run ends at a finish line or at a buzzer. The
// rules are a plain record on the state (`GameState.rules`) and every
// system that answers to one reads it there; nothing branches on a mode's
// NAME below the app.
//
//   RACE        the course against a field: eleven riders on the grid with
//               the player, everybody let go on the same GO, and a hull
//               that may be leaned on (`rivals.ts`). The clock is the
//               race; the tricks are switched off, because a rider going
//               for a flip in a race is a rider who has stopped racing.
//   TRICKS      the same shore with the course taken off it: no gates, no
//               finish, the ramps left standing, the same three lights
//               before the clock runs DOWN from a length the rider chose
//               (`TRICK_LIMITS`). The score is the run.
//   TIME TRIAL  the race with the field taken off: the course, the clock,
//               the lights, nobody else on the water.
//   FREE        the water with nothing asked of the rider: the course still
//               stands and the tricks still count, but there are no lights,
//               no buzzer and nobody else out there. It is the OPEN rules
//               with a door on them — which is the point of it, and why it
//               is the one mode whose rules row is `OPEN_RULES` itself
//               rather than a bundle of its own.
//
// OPEN is those same rules with no mode named at all — what a run is dealt
// when nothing asks for one, which is what the sim, the labs and the tests
// ride, because a measurement wants the whole engine under it and no lights
// in front of it. FREE is not a second copy of them: a rider chose them, and
// a mode is how the app says so.
//
// WHAT FREE IS FOR IS THE WATER, NOT THE RULES. Every other mode asks the
// rider to be measured, so the day it is measured on has to be a day the
// generator would deal: a wind inside R12's band, blowing off the sea, over
// a sea R36 drew. Free asks for nothing, so the app may hand it a wind, a
// quarter and a swell of the rider's own choosing — twenty metres rolling
// into a flat calm, or a gale straight off the land — and nothing about that
// is dishonest, because there is no time to compare it with. That is a rule
// the APP keeps (`new-game.ts`, `records.ts`): the engine has always taken
// whatever wind and sea it was handed, and still does.

/** The modes a rider may choose, in the order the front door offers them:
 * the three that measure something, then the one that does not. */
export const GAME_MODES = ["race", "tricks", "timeTrial", "free"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export function isGameMode(value: unknown): value is GameMode {
  return GAME_MODES.some((id) => id === value);
}

/** WHAT A RUN IS PLAYING BY. Read everywhere, written once by `createGame`. */
export type RunRules = {
  /** Whether the gates count: splits, misses, the finish at the last gate.
   * Off, the course still stands — the ramps are what a tricks run is for —
   * but nothing is taken, nothing is charged and nothing is finished by it. */
  course: boolean;
  /** Whether the two strokes are read and the score is kept. Off, a lean
   * held back in the air is trim and nothing more, and `tricks.score`
   * stays at 0 for the whole run. */
  tricks: boolean;
  /** How many OTHER riders start beside the player (`rivals.ts`). */
  rivals: number;
  /** Whether one hull may LEAN ON another (`rivals.ts`'s `clipRiders`).
   * Off, the field is stepped and placed exactly as before and every hull
   * passes through every other — what a run wants when the riders are
   * there to make the water feel lived on rather than to be raced through
   * a gap. Meaningless with no rivals, and kept on there so the open rules
   * say what a race says. */
  contact: boolean;
  /** How long the lights hold the field before the clock starts, s. Zero is
   * no lights at all: the run is `running` from its first step. */
  countdown: number;
  /** How long the run lasts, s, before the buzzer ends it — 0 for a run that
   * ends at the finish line instead. */
  limit: number;
};

/** The engine's own rules, dealt when no mode is asked for — see the
 * header. */
export const OPEN_RULES: RunRules = {
  course: true,
  tricks: true,
  rivals: 0,
  contact: true,
  countdown: 0,
  limit: 0,
};

/** THE RACE'S NUMBERS — stated here rather than in `tuning.ts`, which is at
 * the §20.5 cap, and because every one of them is the race's alone. */
export const RACE = {
  /** The field: how many other riders stand on the grid. Eleven, so the
   * whole grid is a round dozen. */
  rivals: 11,
  /** The lights, s. Three, counted down one a second, then GO. */
  countdown: 3,
  /** THE GRID: how many abreast a row stands, how far apart across the row
   * the lanes are, m, and how far behind each other the rows stand, m. A
   * runabout is under 1.3 m across the sponsons and about 3 m long, so a
   * four-metre lane is a hull's width of clear water either side and an
   * eight-metre pitch is a length and a half between a bow and the transom
   * ahead of it — room to get on the throttle without being shoved before
   * the first gate. */
  grid: { abreast: 3, lane: 4, pitch: 8 },
  /** The least water a grid slot may stand in, m: a hull at rest draws
   * about a third of a metre and the first stroke of the pump wants a
   * clear intake, so a slot over anything shallower is a slot the grid is
   * moved forward off. */
  gridDepth: 1.5,
  /** HOW ONE HULL LEANS ON ANOTHER (`rivals.ts`). The two are resolved as a
   * pair of keels — three points along each, a hull's half-beam round every
   * one — pushed apart along the line between the two closest points and
   * given an impulse along it. `restitution` is how much of the closing
   * speed comes back (a hull is a hollow shell on the water: it bounces
   * more than a skerry gives, and less than a buoy would); `tangentKeep`
   * how much of the sliding speed is kept, so a shoulder-to-shoulder barge
   * costs both riders a little of their way and neither of them their
   * heading. `speed` is the closing speed, m/s, above which the contact is
   * an EVENT worth a sound and a shudder, and `cooldown` how long, s, one
   * hull is deaf to the same rival after one. */
  bump: { restitution: 0.4, tangentKeep: 0.9, speed: 1.2, cooldown: 0.5 },
  /** Two hulls at heights this far apart, m, are not touching: one is
   * flying over the other, and a ring ridden above a rival's head is not a
   * collision. */
  bumpClearance: 1.6,
  /** THE FIELD'S PACE. Every rival rides the same bot the sim rides, on the
   * same roster at the same class as the player, and what separates them
   * is the THROTTLE each is allowed: dealt off the run's own stream between
   * these two shares of full, so the field strings out down the first leg
   * the way a real one does rather than arriving at every gate as one
   * clump. The top of the band is full throttle — the quickest rival is as
   * quick as the bot — and the bottom is a rider a fifth off the pace, who
   * is still ahead of anyone who hits a rock. */
  paceBand: { min: 0.8, max: 1 },
  /** THE FIELD'S RIDERS, as a multiple of the catalog's own rider on that
   * hull — dealt off the same stream as the pace, once, at the grid. The
   * catalog carries one rider of about eighty kilos on every craft because
   * a spec sheet has to quote SOMETHING; a start line does not have twelve
   * of him on it. Real riders run from a light teenager to a heavy adult in
   * wet gear, which over an eighty-kilo nominal is roughly this band.
   *
   * It is not dressing. The rider is a point mass above the centre of
   * gravity, so the draw moves what the hull weighs, what it floats at,
   * how much of it is out of the water for the wind to push on, and how
   * hard it is to turn — on the DART, a hundred and fifty kilos of hull,
   * a heavy rider is a fifth of the whole machine. Twelve hulls sitting on
   * one start line answering the same puff at twelve slightly different
   * rates is most of what tells a grid from a formation, and this is where
   * it comes from.
   *
   * The PLAYER's rider is never dealt: the craft card quotes a spec sheet
   * and a spec sheet that changed per run would be a lie on the card. */
  riderBand: { min: 0.72, max: 1.3 },
} as const;

/** THE TRICKS RUN'S LENGTHS, s, in the order the start card offers them:
 * two, four and six minutes. Whole minutes, because the row is read as one. */
export const TRICK_LIMITS = [120, 240, 360] as const;

/** How far behind the nearest ramp's hinge a reset stands the rider in a
 * run with no course to send him back along, m — a ramp's own run-up, so
 * the next thing he does is take it. */
export const TRICK_RESET_BACK = 60;

/** The rules a MODE is played by. The tricks run's `limit` is the rider's
 * choice and is filled in by `createGame` off `TRICK_LIMITS`. */
export const MODE_RULES: Record<GameMode, RunRules> = {
  race: {
    course: true,
    tricks: false,
    rivals: RACE.rivals,
    contact: true,
    countdown: RACE.countdown,
    limit: 0,
  },
  tricks: {
    course: false,
    tricks: true,
    rivals: 0,
    contact: true,
    countdown: RACE.countdown,
    limit: TRICK_LIMITS[0],
  },
  timeTrial: {
    course: true,
    tricks: false,
    rivals: 0,
    contact: true,
    countdown: RACE.countdown,
    limit: 0,
  },
  // The open rules, named — see the header. Stated as the object itself
  // rather than copied out, so the two can never come to disagree.
  free: OPEN_RULES,
};
