---
title: `git rebase --continue` COMMITS immediately — run `make fmt` before it, or the format fix lands in the working tree after the commit that needed it
date: 2026-09-10
scope: docs, .agents/skills/conflict
concepts: [rebase, formatting, gates, prettier]
---

The skill's loop puts `make fmt && make lint` at step 8, after
`git rebase --continue` at step 6. But `--continue` writes the commit there and
then: anything `make fmt` rewrites afterwards is an unstaged change against a
commit that has already been made, and a `make fmt-check` run at step 8 passes
on the WORKING TREE while the pushed commit is still unformatted. CI's `format`
job then goes red on a branch whose local check was green.

It bites hardest on a hand-resolved markdown table. Prettier pads
`docs/*.md` table columns to the widest cell, so splicing one row from the
other side of a conflict leaves that row's padding wrong by a few spaces —
invisible in review, and a guaranteed `format` failure.

So: run `make fmt` on the resolved files BEFORE staging them, or re-check
`git status` after `--continue` and amend. `git status --porcelain` printing
anything at all once the rebase reports success means the commit is not what
was verified.
