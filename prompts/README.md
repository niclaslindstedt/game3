# prompts/

LLM prompts this project ships, versioned per OSS_GAME_SPEC §13.2: each prompt lives in its own directory as immutable `<major>_<minor>_<patch>.md` files with YAML front matter (`name`, `description`, `version` matching the filename) and `## System` / `## User` sections. Existing versions are never edited — every change is a new file at a bumped semver.

No prompts yet: the game has no LLM features, and the repo's agent guidance lives in [AGENTS.md](../AGENTS.md) and `.agents/skills/` instead. The first candidate for this directory is a level-describer prompt (turning a generated shore's plan — its bays, its skerries, its ramps and the wind — into the one line of copy a level card carries); when it lands it goes in `prompts/level-card/1_0_0.md` following the format above.
