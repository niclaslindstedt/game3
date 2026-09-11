// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCREENSHOT ROLL'S POLICY — what a picture is, what order the roll is
// in, how many it keeps, and how a read off disk joins what is already in
// hand. No storage of any kind: shot-store.ts is the IndexedDB around this.
//
// Split out and DOM-free because this half is the half that can be wrong in
// a way nobody notices. A roll that quietly stopped capping is an unbounded
// pile of megabytes in somebody's browser profile, and the browser it
// happens in first is the one with no IndexedDB at all — a private tab,
// where the roll IS this module and nothing else. The tests read it here.

/** One picture in the roll, as it is stored and as it is handed back. */
export type Shot = {
  /** Sortable and unique: the capture time, then a counter for the same ms. */
  id: string;
  /** When it was taken (epoch ms) — what the roll is ordered by. */
  takenAt: number;
  /** The picture's own pixel size, so a gallery can lay a frame out before
   * the browser has decoded anything. */
  width: number;
  height: number;
  /** One line of context — this game writes the shore and the craft. */
  label: string;
  /** The PNG itself. */
  blob: Blob;
};

/** Everything but the pixels — what a listing needs. */
export type ShotMeta = Omit<Shot, "blob">;

/** A picture's id. The timestamp leads so a plain string sort is a sort by
 * age, and the counter breaks the tie two captures in the same millisecond
 * would otherwise be — which is not hypothetical: a held key repeats. */
export function shotId(takenAt: number, counter: number): string {
  return `${takenAt}-${counter.toString().padStart(6, "0")}`;
}

/** The roll with a new picture at its head, capped. Newest first, which is
 * the order every reader wants — a gallery opens on the picture just taken,
 * never on the first one ever kept. */
export function withShot(roll: readonly Shot[], entry: Shot, limit: number): Shot[] {
  return [entry, ...roll].slice(0, Math.max(1, limit));
}

/** What a read off disk joins onto what is already in hand. Anything
 * captured while the read was in flight is newer than everything stored, so
 * this is a concat of the sorted remainder rather than a merge sort — and
 * ids already held win, because the in-memory copy is the one whose blob
 * the gallery may already be showing.
 *
 * CAPPED like every other way the roll grows. A read is the one path that
 * can put more pictures in hand than the cap allows — three taken this
 * session joined onto a full store is forty-three — and a roll over its cap
 * is a gallery listing pictures the next prune is about to delete. */
export function withStored(roll: readonly Shot[], stored: readonly Shot[], limit: number): Shot[] {
  const held = new Set(roll.map((entry) => entry.id));
  return [...roll, ...stored.filter((entry) => !held.has(entry.id)).sort(byNewest)].slice(
    0,
    Math.max(1, limit),
  );
}

function byNewest(a: Shot, b: Shot): number {
  return b.takenAt - a.takenAt;
}

/**
 * WHICH STORED PICTURES A PRUNE DELETES: everything on disk past the cap,
 * OLDEST FIRST — decided from the stored KEYS alone.
 *
 * The obvious version of this — delete every stored key the roll in hand does
 * not hold — is wrong in a way nothing would catch, and this function exists
 * to make it unavailable. Nothing reads the store until the gallery is opened
 * (`loadShots` has one caller), so on a visit where nobody opened it the roll
 * in hand is exactly what THIS visit has taken; a prune against that set
 * deletes every picture the player has ever taken, one frame after the first
 * press of the session.
 *
 * Keys are enough because `shotId` is built to make them enough: the capture
 * time leads, so a plain string sort is a sort by age. Which also means the
 * prune never has to read a single PNG back off disk to know what to keep —
 * a `getAll` on a full roll is some thirty megabytes pulled into memory in
 * the middle of a run, to answer a question about order.
 */
export function keysPastCap(stored: readonly string[], limit: number): string[] {
  const newestFirst = [...stored].sort().reverse();
  return newestFirst.slice(Math.max(1, limit));
}

/** The pixels dropped. A listing that carried the blobs would keep every
 * picture in the roll alive for as long as anything held the list. */
export function shotMeta(shots: readonly Shot[]): ShotMeta[] {
  return shots.map(({ id, takenAt, width, height, label }) => ({
    id,
    takenAt,
    width,
    height,
    label,
  }));
}

/** The pixel size a FILMSTRIP THUMBNAIL is decoded at.
 *
 * The strip draws a picture at about eighty pixels across, and decoding the
 * 1920-wide original to show it there costs a full-frame decode and holds
 * some eight megabytes of bitmap per tile — forty of those at once is what
 * makes opening a gallery a stall rather than a press. The tile crops with
 * `object-fit: cover`, so the picture keeps its own shape here and merely
 * COVERS the box; and it is never scaled UP, on the same principle the
 * capture itself obeys — an enlarged picture is bytes spent on interpolated
 * pixels nobody asked for. */
export function thumbSize(
  width: number,
  height: number,
  boxWidth: number,
  boxHeight: number,
): { width: number; height: number } {
  // A record with no size in it (nothing writes one, but the roll is read
  // back off disk and disks are not a promise) gets the box itself.
  if (width <= 0 || height <= 0) return { width: boxWidth, height: boxHeight };
  const scale = Math.min(1, Math.max(boxWidth / width, boxHeight / height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
