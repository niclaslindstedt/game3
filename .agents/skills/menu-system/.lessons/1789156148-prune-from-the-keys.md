---
title: Prune a kept-picture store from its stored KEYS, never from the roll in hand — in hand is one visit's, the store is every visit's
date: 2026-09-11
scope: pwa/src/lib/shot-store.ts, pwa/src/lib/shot-roll.ts
concepts: [screenshots, gallery, indexeddb, storage, persistence]
---

The obvious way to pay a roll's cap on disk is to delete every stored key the
roll no longer holds. It is wrong, and silently: the roll in memory is only
what THIS visit has taken — nothing reads the store until the gallery is
opened (`loadShots` has one caller, `menu-gallery.tsx`) — so on a visit where
nobody opened it, the first press deletes every picture the player has ever
taken. It showed as `1/40` in the gallery after a probe took pictures across
several page loads; take them across RELOADS or the bug is invisible.

`keysPastCap(storedKeys, limit)` is the fix and the shape to copy: ids lead
with the capture time (`shotId`), so a plain string sort is a sort by age and
the keys answer "what falls off" on their own. Reading the roll IN first
(`await loadShots()` before the prune) also works and is what I wrote first —
but it pulls up to forty PNGs, some thirty megabytes, off disk and into memory
in the middle of a run to answer a question about order. `getAllKeys` costs
nothing.

Put the decision in the storage-free half so the suite holds it: Node has no
IndexedDB, so anything left inside the store module is untested by
construction, and this is a data-loss bug that no screenshot and no type
error would ever show.

A second trap beside it: a read off disk must be CAPPED as it joins what is
in hand (`withStored(..., limit)`), or three taken this session onto a full
store is a gallery listing forty-three pictures the next prune will delete.

The sibling repo `game2` has both bugs in the module this was ported from.
What came across was the shape; the shape was wrong.
