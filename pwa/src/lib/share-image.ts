// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SENDING A PICTURE SOMEWHERE ELSE — the three ways a screenshot can leave
// the game, and an honest answer about which of them this device has.
//
// There is no single "share" on the web, so this module answers the
// question the gallery actually has — what can this browser do with a PNG?
// — and gives each answer its own verb. The gallery offers the ones that
// come back true, in this order, because that is the order of how directly
// each gets the picture to a person:
//
//   SHARE   `navigator.share({ files })`, the platform's own sheet. On a
//           phone this is the whole point: the camera roll, Messages, and
//           whatever chat app the player actually uses. Desktop Safari and
//           Windows Chrome raise a real sheet too, which is why this is
//           never gated on "is this touch" — it is gated on `canShare`, and
//           the browser is the one that knows.
//   COPY    the clipboard, as an image/png item. Where there is no sheet
//           there is nearly always a paste target one window away.
//   SAVE    a download. The floor: every browser can put a file on a disk.
//
// EVERY PROBE IS A REAL PROBE. `navigator.share` exists in browsers that
// will refuse a file payload, and `navigator.clipboard.write` exists in
// browsers with no PNG writer, so both are asked about the exact thing
// being sent rather than about their own existence. A button offered on a
// false positive is a button that does nothing when pressed, which is worse
// than one that was never there.
//
// SHARING NEEDS THE GESTURE. Both `share` and `write` want transient user
// activation, so they have to be called from the press itself and never
// after an `await` that outlives it. That is why nothing here decodes,
// re-encodes or fetches: a caller hands over a Blob it already holds.
//
// Which the gallery can always manage: it presses with the PNG already on
// the roll. THE SHUTTER'S PICTURE DOES NOT EXIST YET at the moment of the
// press — the drawing buffer can only be read inside the animation callback
// that filled it, frames away (game/screenshots.ts) — and awaiting it would
// spend the activation before the write. `copyWhenReady` is the way through
// that the clipboard spec itself provides: a `ClipboardItem` takes a PROMISE
// of a blob, so the write is started from the press with the picture still
// unwritten and the frame loop settles it a few frames later. Nothing else
// here may await before it calls: `share` has no such door and the shutter
// does not offer it.

/** The one MIME type everything here moves. */
export const MIME_PNG = "image/png";

/** A PNG blob as a named File — what `navigator.share` wants, and what
 * decides the name the receiving app shows. */
export function pngFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: MIME_PNG });
}

/** Whether the platform's share sheet will take THIS file. */
export function canShareImage(file: File): boolean {
  if (typeof navigator === "undefined") return false;
  // `share` and `canShare` are optional in the DOM lib, so the pair is
  // narrowed here rather than declared as globals — which also keeps this
  // module loadable somewhere with no DOM at all.
  const nav = navigator as Navigator & {
    share?: (data: { files?: File[] }) => Promise<void>;
    canShare?: (data: { files?: File[] }) => boolean;
  };
  if (typeof nav.share !== "function") return false;
  // `canShare` is the only honest answer about files, and a browser with
  // `share` but no `canShare` predates file sharing entirely.
  if (typeof nav.canShare !== "function") return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** Whether a PNG can go on the clipboard. */
export function canCopyImage(): boolean {
  if (typeof navigator === "undefined" || typeof ClipboardItem === "undefined") return false;
  if (typeof navigator.clipboard?.write !== "function") return false;
  // Firefox ships `ClipboardItem` with a text-only writer, and `supports`
  // is how it says so. A browser without the probe supports PNG — it is the
  // one type the spec makes mandatory.
  const supports = (ClipboardItem as unknown as { supports?: (type: string) => boolean }).supports;
  if (typeof supports !== "function") return true;
  try {
    return supports(MIME_PNG);
  } catch {
    return true;
  }
}

/** Raise the platform's share sheet. True when the picture went somewhere,
 * false when it did not — INCLUDING a player dismissing the sheet, which
 * arrives as an AbortError and is an ordinary outcome rather than a failure
 * worth reporting. */
export async function shareImage(
  file: File,
  data: { title?: string; text?: string } = {},
): Promise<boolean> {
  try {
    await navigator.share({ ...data, files: [file] });
    return true;
  } catch {
    return false;
  }
}

/** Put the PNG on the clipboard. */
export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ [MIME_PNG]: blob })]);
    return true;
  } catch {
    return false;
  }
}

/** What a copy started before its picture existed hands back: `done` says
 * whether the PNG reached the clipboard, and the caller settles the write by
 * calling `ready` with the blob — or with null when there was no picture to
 * copy, which fails the write rather than leaving it open for ever. */
export type PendingCopy = { done: Promise<boolean>; ready: (blob: Blob | null) => void };

/**
 * Start a clipboard write for a picture that has not been drawn yet. MUST be
 * called synchronously from the press: the transient user activation both
 * Chromium and WebKit want is spent by the first `await`, and a write started
 * afterwards is refused as a document without user activation.
 *
 * Returns null where this browser has no PNG writer, so a caller can say what
 * it actually did rather than promising a copy that never happened.
 */
export function copyWhenReady(): PendingCopy | null {
  if (!canCopyImage()) return null;
  let ready: (blob: Blob | null) => void = () => {};
  const picture = new Promise<Blob>((resolve, reject) => {
    ready = (blob) => (blob ? resolve(blob) : reject(new Error("no picture")));
  });
  // The rejection is answered by the `write` below and by nothing else; this
  // keeps a picture that never arrived from surfacing as an unhandled one.
  picture.catch(() => {});
  const done = navigator.clipboard
    .write([new ClipboardItem({ [MIME_PNG]: picture })])
    .then(() => true)
    .catch(() => false);
  return { done, ready };
}

/** Save the PNG to the player's downloads. The path that always works.
 *
 * The anchor is put in the document rather than clicked detached: Firefox
 * ignores a click on an element that is not in a document, and the object
 * URL is revoked on a later task because revoking it in this one races the
 * download that has only just been started. */
export function saveImage(blob: Blob, name: string): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}
