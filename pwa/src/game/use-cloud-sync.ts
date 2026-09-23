// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CLOUD SAVE, driven — when the game pulls, when it pushes, and what it does
// while neither has happened yet.
//
// The rules are the smallest set that keeps two devices honest:
//
//   AT BOOT        pull, merge, push the merged result back. A device that
//                  has been away comes back with the other's work, and the
//                  cloud ends up holding the union rather than whichever
//                  device spoke last.
//   WHEN TOLD      the same, because "changed" means another device wrote.
//   AFTER A WRITE  push, debounced. A run finishing writes the book and the
//                  board in the same tick, and a rider who beats their time
//                  three times in a row should cost one upload, not three.
//
// NEVER A BLOCKING WAIT. Every path degrades to "the game is device-local":
// a browser (no shell), a rider signed out of iCloud, a store that refused
// the write. The game is fully playable in all three, which is why none of
// them is an error the player has to dismiss.
//
// The merge lives in `./cloud-save.ts`; the transport in `../shell-host.ts`.
// This file owns only the WHEN.

import { useEffect, useRef } from "react";

import { askShellCloud, onShellCloud, shellHost, type ShellCloudReply } from "../shell-host.ts";
import type { CampaignProgress } from "./campaign.ts";
import { applyCloudSave, parseSave, type CloudSave } from "./cloud-save.ts";
import type { RecordBook } from "./records.ts";

/** How long after the last write the push goes up. Long enough to coalesce a
 * finish (book + board, same tick) and a rider who immediately rides again. */
const PUSH_AFTER_MS = 4000;

/** How long an ask may go unanswered before the game stops waiting. A shell
 * that never answers is a shell without the module; the game is device-local
 * and nothing should hang on it. */
const ANSWER_WITHIN_MS = 8000;

let nextId = 0;
const newId = (): string => `cloud-${++nextId}`;

/** One round trip, resolved with the reply or null when nothing came back. */
function ask(action: "status" | "load" | "save", data?: string): Promise<ShellCloudReply | null> {
  return new Promise((resolve) => {
    const requestId = newId();
    let settled = false;
    const done = (reply: ShellCloudReply | null): void => {
      if (settled) return;
      settled = true;
      stop();
      clearTimeout(timer);
      resolve(reply);
    };
    const stop = onShellCloud((reply) => {
      if ("requestId" in reply && reply.requestId === requestId) done(reply);
    });
    const timer = setTimeout(() => done(null), ANSWER_WITHIN_MS);
    askShellCloud(
      action === "save" ? { action, requestId, data: data ?? "" } : { action, requestId },
    );
  });
}

/** Pull what the cloud holds, merge it into this device, and push the union
 * back. Returns what is now on both, or null when there is no cloud. */
async function reconcile(): Promise<CloudSave | null> {
  const status = await ask("status");
  if (!status || status.event !== "status" || !status.ok || !status.available) return null;
  const loaded = await ask("load");
  const remote = loaded && loaded.event === "load" && loaded.ok ? parseSave(loaded.data) : null;
  const merged = applyCloudSave(remote);
  await ask("save", JSON.stringify(merged));
  return merged;
}

/**
 * Keep this device's book and board in step with the rider's other devices.
 *
 * The setters are called when a pull brought something in: the merge writes
 * local storage, and React is holding the old copies until it is told.
 */
export function useCloudSync(app: {
  records: RecordBook;
  campaign: CampaignProgress;
  setRecords: (book: RecordBook) => void;
  setCampaign: (progress: CampaignProgress) => void;
}): void {
  const latest = useRef(app);
  latest.current = app;
  const merged = useRef((save: CloudSave) => {
    latest.current.setRecords(save.records);
    latest.current.setCampaign(save.campaign);
  });

  // A WRITE IS A NEW OBJECT in either store — both are replaced wholesale, and
  // a finish replaces both in one tick, which is the upload this coalesces.
  // The first render is not a write: the stores were just loaded off this
  // device, and uploading that on boot would race the pull below.
  const writes = useRef(0);
  const seen = useRef<{ records: unknown; campaign: unknown } | null>(null);
  if (seen.current === null) {
    seen.current = { records: app.records, campaign: app.campaign };
  } else if (seen.current.records !== app.records || seen.current.campaign !== app.campaign) {
    seen.current = { records: app.records, campaign: app.campaign };
    writes.current += 1;
  }
  const writeCount = writes.current;

  // BOOT, and whenever the cloud says another device wrote.
  useEffect(() => {
    if (shellHost() !== "native") return;
    let alive = true;
    const pull = (): void => {
      void reconcile().then((save) => {
        if (alive && save) merged.current(save);
      });
    };
    pull();
    return onShellCloud((reply) => {
      if (reply.event === "changed") pull();
    });
  }, []);

  // AFTER A WRITE, debounced. The first render is a write by definition (the
  // stores were just loaded), so the count is what tells them apart.
  useEffect(() => {
    if (shellHost() !== "native" || writeCount === 0) return;
    const timer = setTimeout(() => {
      void reconcile();
    }, PUSH_AFTER_MS);
    return () => clearTimeout(timer);
  }, [writeCount]);
}
