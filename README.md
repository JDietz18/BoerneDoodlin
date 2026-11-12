# Doodle Onward

One great road trip, thirty platform adventures, and a family with an unusually strong interest in snacks. Griffin, the BoerneDoodle, heads toward Boerne with Kevin, Mittens, and Spike. Kevin remains the family's forever guide.

**Play:** [Doodle Onward](https://griffin-snack-patrol.jdietz.chatgpt.site/). This repository updates the same existing public site.

## Five chapters, at your pace

The journey has **five worlds with six platform levels each**: Rogue River, Redwood Run, Painted Canyon, Starlight Mesa, and Boerne Hills. The first three levels in an opened world are available immediately. Every different level you finish opens another, and **four of six clears open the next world**. All thirty levels remain replayable. There are no calendar locks.

Explore branching routes, jump onto moving platforms, bounce on snack bandits, open blocks and secret chests, and find the two keys that open each RV goal. Checkpoints save your place. Each world ends with an optional boss level.

Every level has three persistent medals:

1. Reach the RV.
2. Find all three golden snacks.
3. Finish with no hits or within that level's target time.

Medals can be earned across different attempts. Normal layouts stay consistent while you learn them. Remix creates a fresh seeded layout.

## Five ways to play

| Activity | Play | Controls |
| --- | --- | --- |
| Platform adventure | Explore thirty full levels with keys, secrets, checkpoints, and bosses. | Left/Right or A/D to move; Space, Up, or W to jump. Hold for height and press again for a double jump. Down/S drops faster. E/Enter opens or interacts. |
| Trail Scout | Explore a top-down trail, find treasures and a parcel, make the delivery, and return to the RV. There is no countdown. | Arrow keys or WASD to move; E/Enter to interact; H for a trail hint; X for charged power. |
| RV Rally | Drive a 60-second 3D course, collect snacks, and steer around obstacles. | Left/Right or A/D to steer; hold Down/S to brake; X for charged power. |
| Snack Storm | Catch falling treats during a 45-second snack shower. | Left/Right or A/D; on touch screens drag across the field or use the arrow buttons. X activates charged power. |
| Camp Pairs | Match the campfire cards before time runs out. | Click or tap cards; keyboard users can navigate the card buttons and activate them with Enter/Space. Peek provides a limited hint. |

Touch controls are provided for the action modes. **P or Escape pauses**. All four characters and all four arcade detours are available from the start.

RV Rally uses native WebGL for its 3D scene when available. Its software renderer draws the same meshes with perspective, clipping, depth sorting, lighting, and fog on devices without WebGL; it keeps the full driving game playable.

## A backpack full of good things

Treats pay for permanent Snack Magnet, Extra Zoom, and Big Heart upgrades. **Twenty family quests**, four per world, reward actual actions such as stomps, treasures, memory matches, rally dodges, and successful snack chains. Progress is sticky and quest rewards are automatic.

Earn **twelve charms** through medals, quests, and world clears, then equip up to three. Their effects include a third platform jump, longer bonus windows, stronger stomp rebounds, a starting shield, better reach, and faster power charging. The passport collects world, activity, family, and achievement stickers.

Score bonuses multiply together: **5× chain × 2× frenzy × 2× Gold Rush × 1.5× Griffin power = 30×**. The best combined multiplier is saved with each activity's records.

A Daily Adventure chooses a seeded activity and world for the device's local date. Its neutral gear and assist settings keep attempts consistent. A successful finish grants one daily bonus; further attempts can improve the record. A daily visit to a locked world does not skip the platform progression gates.

## Source layout

This is a static ES-module game. `dist/` is the complete site; there is no package installation or compilation step.

| Module | Responsibility |
| --- | --- |
| `game.js`, `index.html`, `style.css` | Controller, camp, map, backpack, passport, input, and responsive UI |
| `world-levels.js` | Five worlds and thirty deterministic or remixed platform layouts |
| `platform-engine.js`, `platform-renderer.js` | Free platform movement, interactions, checkpoints, and canvas drawing |
| `scout-engine.js` | Top-down exploration, treasures, delivery, and hints |
| `rally3d.js` | RV driving simulation and the 3D renderer |
| `memory-game.js`, `minigames.css` | Camp Pairs state, accessible card controls, and layout |
| `snack-engine.js`, `renderer.js` | Snack Storm and the shared approved character-art loader |
| `journey.js` | Progression, quests, gear, charms, passport, records, migration, and checkpoints |
| `characters.js`, `audio.js`, `celebrations.js` | Family identities, artwork settings, sound, and celebrations |
| `sw.js`, `manifest.webmanifest` | Offline release bundle and installed-app metadata |

The shared renderer still imports the original adventure engine's world constants. Older runner/campaign source and tests remain for compatibility; the active progression uses `journey.js`. Griffin's approved likeness is documented in [GRIFFIN_REFERENCE.md](GRIFFIN_REFERENCE.md).

## Verify and preview

Run the complete suite with a current Node.js runtime:

~~~sh
node --test tests/*.test.mjs
~~~

For progression and the offline bundle:

~~~sh
node --test tests/journey.test.mjs tests/offline.test.mjs
~~~

Use the Sites managed preview:

~~~sh
sites-preview start /absolute/path/to/checkout
~~~

Verify keyboard and touch play in every activity, checkpoint resume, rewards after retry, world unlocks, charm effects, pause/resume, audio opt-in, and reload persistence. Local preview disables worker registration. Verify installed/offline reopening on the published release after its worker finishes installing. Stop the preview with `sites-preview stop`.

## Saves and release

The new save key is `doodle-onward-journey-v1`. It imports the prior `boerne-doodlin-adventure-v2` wallet, upgrades, character, settings, and compatible records once. The complete earlier save is retained as a legacy snapshot and its original key is untouched. New levels and quests begin with their own progress.

Scores and rankings are personal to the current browser/device. There is no online leaderboard, account economy, or real-money purchase. Storage failures leave play available and are reported by the controller.

Publish through the existing Sites repository workflow using `.openai/hosting.json`, which serves `dist/`. Keep the same project, URL, and public audience. See [REBUILD_NOTES.md](REBUILD_NOTES.md) for the data and offline contracts.
