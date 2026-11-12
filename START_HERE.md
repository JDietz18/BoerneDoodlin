# Continue Doodle Onward in Claude Code

Read CLAUDE_HANDOFF.md, then README.md, GRIFFIN_REFERENCE.md, and REBUILD_NOTES.md.

This repository began as the shipped Site version 13 source and now holds the
touch-first release built on it (asset version v21). CLAUDE.md has the current
module map and the rules that must hold.

From this directory:

```sh
node --test tests/*.test.mjs
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000/. There is no dependency installation or build step.
The suite runs in a few seconds and must stay green. Continuous integration
runs it on every push.

Use a feature branch or isolated worktree, preserve existing work and player
saves, and verify all five activities. The full handoff covers artwork, engine
contracts, root hosting paths, offline behavior, and remaining device checks.
