# Examples

Runnable inputs for the project's tooling. Each example is reproducible with
one command, so it cannot silently rot.

## Level seeds (`seeds.md`)

A curated list of known-good level seeds with their character — a sheltered
bay, a long exposed reach, a ramp-heavy course. Try one:

```sh
npm run level -- --seed 38            # draw the plan to previews/
npm run waves -- --seed 38            # the sea it builds, on its own
npm run sim -- --seeds 38,7,123       # let the bot ride them
```

Or ride one directly: open the dev server with `?seed=38` on the URL (the
`craft` parameter picks the craft: `skiff`, `marlin`, `otter` or `dart`).
