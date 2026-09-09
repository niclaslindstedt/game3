# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
.PHONY: build test lint fmt fmt-check release clean install icons check-seo sim level analyze waves ride screenshots profile hooks shellcheck actionlint changelog bump docs

build:
	npm run build

# The vitest suite. SHARD=i/N runs only the i-th of N slices of the test
# FILES — how CI fans the suite out across runners (four of them); a bare
# `make test` is still the whole thing, and stays the definition of green.
#
# Sharding splits at file granularity, so the SLOWEST SINGLE FILE is the
# floor and more runners cannot get under it. Keeping that floor down is
# what keeps the fan-out worth having: a rule suite shares one corpus of
# built levels through tests/support/levels.ts rather than rebuilding it
# per rule, and a file whose subject is really two gets split.
test:
	npm test -- $(if $(SHARD),--shard=$(SHARD),)

lint:
	npm run lint

fmt:
	npm run fmt

fmt-check:
	npm run fmt:check

release:
	npm run build

clean:
	rm -rf pwa/dist node_modules pwa/node_modules previews

install:
	npm install

# Regenerate the PWA install icons, the favicon and the Open Graph image from
# the app mark (keep pwa/public/icons/icon.svg in lockstep).
icons:
	npm run icons

check-seo:
	npm run build && npm run check:seo

# Headless balance sweep: the bot rides generated levels through the real
# engine and prints the pace / gates / air / dives table, per seed and craft.
# `make sim SEEDS=3,7 CRAFT=marlin`
sim:
	npm run sim -- $(if $(SEEDS),--seeds $(SEEDS),) $(if $(CRAFT),--craft $(CRAFT),) $(ARGS)

# THE LEVEL MAP: one level from above, from the engine alone — no build, no
# browser. Depth shading, the shore, every solid, every gate numbered with
# its ramp, and the wind arrow, drawn to previews/level-<seed>.png; beside it
# a table of every gate with its offshore distance and the depth under it. A
# claim about "the second air gate on seed 38" is a claim about a row here.
# `make level SEED=38` · `make level SEED=38 ARGS=--json`
level:
	npm run level -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# SCORE generated levels instead of looking at them: every gate within a
# hundred metres of shore, the depth along the path, the solids clear of it,
# the run-up before every ramp, the gate spacing and the course length —
# each a band, and a finding names what is wrong. The measuring half of the
# generator loop; `make level` is the looking half. Exits non-zero on any
# error finding.
# `make analyze SEED=7` · `make analyze COUNT=24`
analyze:
	npm run analyze -- $(if $(SEED),--seed $(SEED),) $(if $(COUNT),--count $(COUNT),) $(ARGS)

# THE WAVES LAB — the water on its own, with nothing riding it: a transect
# from the shore out to sea at several moments, the significant height
# against the offshore distance (the fetch law made visible), and the
# spectrum the sea is built from, drawn to previews/waves-<seed>.png; under
# it a table of Hs, Tp, wavelength and the depth a wave breaks at. Pure
# Node. Required before/after any change to engine/game/water.ts — a wave
# model is judged by the sea it makes, and a screenshot shows one wave.
# `make waves SEED=38` · `make waves SEED=38 ARGS="--wind 12"`
waves:
	npm run waves -- $(if $(SEED),--seed $(SEED),) $(ARGS)

# THE RIDE LAB — the craft on the water, drawn in profile every sixth of a
# second over the water it crossed, with the numbers that decide the next
# step beside each cell: speed, pitch, wetted share, rpm and air time. One
# staged scenario at a time (pwa/src/game/scenarios.ts names them: cruise,
# chop, launch, landing, dive, backflip…), through the real engine and a
# canvas, so what is drawn is isolated from everything that is not the
# physics. Required before/after any change to the hull, the planing lift,
# the slamming or the flight.
# `make ride SCENARIO=launch` · `make ride SCENARIO=chop CRAFT=otter`
ride:
	npm run ride -- $(if $(SCENARIO),--scenario $(SCENARIO),) $(if $(CRAFT),--craft $(CRAFT),) \
		$(if $(SEED),--seed $(SEED),) $(ARGS)

# Drive the built app headlessly and screenshot the staged moments at the
# two reference viewports (desktop landscape, phone portrait). Needs a built
# pwa/dist, `npm i --no-save playwright-core` and a Chromium (CHROMIUM_PATH
# overrides discovery). `make screenshots SCENE=launch`
screenshots:
	node scripts/screenshot.mjs $(if $(SCENE),--scene $(SCENE),) $(ARGS)

# Meter what one frame costs the renderer: draw calls, triangles, program
# and texture binds, per scene. Same Chromium requirements as
# `screenshots`. Run it before and after any rendering change.
profile:
	npm run profile

shellcheck:
	shellcheck scripts/*.sh .githooks/* .claude/hooks/*.sh

actionlint:
	actionlint -color

# Install the repo's git hooks (pre-commit fmt/lint checks, conventional
# commit message lint).
hooks:
	git config core.hooksPath .githooks
	@echo "git hooks installed (core.hooksPath = .githooks)"

docs:
	@echo "see docs/"

# Local preview of what the release workflow will write to CHANGELOG.md.
# Pass the planned version: `make changelog VERSION=0.2.0`. Consumes the
# fragments in .changes/unreleased/ — run inside a scratch branch or
# revert afterwards if you only wanted a preview.
changelog:
	@test -n "$(VERSION)" || { \
		echo "usage: make changelog VERSION=X.Y.Z"; exit 2; \
	}
	node scripts/release/collate-changelog.mjs $(VERSION)

# Print the semver bump (patch/minor/major) the release workflow will
# auto-derive from the current .changes/unreleased/ fragments. Read-only.
bump:
	@node scripts/release/compute-bump.mjs
