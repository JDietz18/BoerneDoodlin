# Continue Doodle Onward in Claude Code

Read CLAUDE_HANDOFF.md, then README.md, GRIFFIN_REFERENCE.md, and REBUILD_NOTES.md.

This package is the shipped Site version 13 source. The intended GitHub repository
is JDietz18/BoerneDoodlin. ChatGPT could not access that repository; compare its
actual contents before integrating this package.

From this directory:

```sh
node --test tests/*.test.mjs
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000/. There is no dependency installation or build step.
The baseline is 130 passing tests. The recorded prior run is in VERIFICATION.txt.

Use a feature branch or isolated worktree, preserve existing work and player
saves, and verify all five activities. The full handoff covers artwork, engine
contracts, root hosting paths, offline behavior, and remaining device checks.
