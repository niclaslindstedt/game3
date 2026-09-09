<!-- Title must be a conventional-commit subject (it becomes the squash
     commit on main): feat(engine): give the hull a rooster tail -->

## What & why

<!-- What changes, and what it does for the player or the project. -->

## Linked issue

<!-- Closes #… (if any). -->

## Test plan

<!-- How you verified it: commands run, scenarios ridden, screenshots for
     visual changes. For hull / water / generator changes paste the
     `make sim` table BEFORE and AFTER, and the `make waves` / `make ride`
     pictures where they apply. -->

## Checklist

- [ ] `make test`, `make lint`, `make fmt-check` pass locally
- [ ] Tests added/updated for behavior changes
- [ ] `make sim` before/after included (hull, water or generator changes)
- [ ] Changeset fragment in `.changes/unreleased/` (or `no-changelog` applies)
- [ ] Docs updated per AGENTS.md → Documentation sync points
- [ ] PR title is a conventional-commit subject
