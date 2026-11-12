# Doodle Onward

A family road-trip game (Grants Pass, Oregon to Boerne, Texas) starring Griffin
the Bernedoodle with Kevin, Mittens, and Spike. Played mostly on iPhones, passed
around in a moving car. The owner's standing direction: **the most dynamic
version possible, modern, touch and tap only, no on-screen control interface.**

Read `CLAUDE_HANDOFF.md` for the product history and art rules, and
`GRIFFIN_REFERENCE.md` before touching any Griffin artwork.

## Run it

```sh
node --test tests/*.test.mjs                      # whole suite, no install step
python3 -m http.server 8000 --directory dist      # then open http://localhost:8000/
node scripts/build-portable.mjs build/portable    # copy that runs from any folder
```

`dist/` is the complete buildless site (plain ES modules). Add `?debug=1` to
the address for `window.__doodle` (run, journey, renderer, controls, startRun,
...) when scripting a browser. Playwright with an iPhone device profile is the
usual way to check a change; look at the screenshots, do not just read numbers.

## Map

| Files | What lives there |
| --- | --- |
| `dist/game.js` | Controller: screens, run lifecycle, results, panels, saves |
| `dist/controls.js` | Gesture input. The play field is the controller |
| `dist/hud.js`, `dist/play.css` | In-run HUD, bonus-stack meter, phone layout |
| `dist/fx.js`, `dist/haptics.js` | Shared game feel: particles, shake, hit-stop, popups, taps |
| `dist/platform-engine.js`, `dist/world-levels.js`, `dist/platform-renderer.js` | The 30-level platform adventure |
| `dist/scout-engine.js`, `dist/scout-view.js` | Trail Scout |
| `dist/rally3d.js` | RV Rally simulation and both 3D renderers |
| `dist/snack-engine.js`, `dist/renderer.js` | Snack Storm, shared sprite loader, camp hero scene |
| `dist/memory-game.js`, `dist/minigames.css` | Camp Pairs |
| `dist/journey.js` | Progression authority: saves, rewards, quests, charms, daily |
| `dist/audio.js`, `dist/celebrations.js` | Sound and result-screen confetti |
| `dist/sw.js`, `dist/manifest.webmanifest` | Offline bundle and install metadata |
| `scripts/build-portable.mjs` | Relative-path copy for subfolder hosts and previews |

Older campaign files (`engine.js`, `progression.js`, `road.js`, `journal.js`,
`trail.js`, `phone.js`, `iphone.css`, `campaign.css`) are kept for their tests
and because `renderer.js` imports constants from `adventure-engine.js`. They are
not loaded by the page.

## Rules that must hold

- **Saves.** Key `doodle-onward-journey-v1`; legacy source
  `boerne-doodlin-adventure-v2`. Every persistent reward goes through
  `Journey.completeRun(summary)` exactly once per stable `runId`. Device-only
  preferences (haptics, tilt, seen coach marks) live in
  `doodle-onward-device-v1`, not in the journey.
- **The stack.** 5x chain x 2x frenzy x 2x Gold Rush x 1.5x Griffin power = 30x.
  Add ways to earn or show a layer; never add or change a multiplier.
- **Level ids are saved.** Platform checkpoints refer to `e12`/`p4` style ids by
  generation order. Anything new in `getLevel` is appended after the goal with
  its own random stream. Remix and daily layouts may differ freely.
- **Determinism.** Same seed, same course, whatever the player does. No
  `Math.random()` in simulation. Pause freezes everything (simulation time only).
- **Daily** runs use neutral gear, no charms, no assist, and never touch
  ordinary checkpoints.
- **Touch only on phones.** No visible pads or buttons. New actions get a
  gesture in `controls.js`; real buttons stay available to keyboard and
  assistive tech inside `.assist-controls` (hidden until focused).
- **Motion.** Everything honours Reduced motion; text on a phone is 11 px or
  larger; nothing important sits under the HUD band (`view.insets`).
- **iPhone canvas.** No `shadowBlur` in loops (use cached glow sprites), no
  per-frame gradients or allocations per entity, device pixel ratio capped at 2.
- **Art and words.** Griffin comes only from `griffin-character-atlas.png`;
  `griffin-atlas.png` supplies props (cells 4 to 8) and nothing else. Keep
  "Kevin, our forever guide. Along for every mile." Copy is warm and plain: no
  em dashes, say "children".

## Releasing

Every script and stylesheet is requested with `?v=N`, and the service worker
cache is `doodle-onward-journey-vN`. Bump all of them together (a global
replace of the number across `dist/` and the offline tests), add any new file to
`CORE` in `dist/sw.js`, and run the suite: `tests/offline.test.mjs` and
`tests/release.test.mjs` fail on any mismatch.

`dist/` assumes it is served from the site root and the manifest pins scope
`/`; that is the identity of the published game, so do not make it relative.
For a subfolder host use the portable build. Publishing to the live site is the
owner's step; the GitHub Pages workflow only runs when started by hand.
