# Doodle Onward

One great road trip, thirty platform adventures, and a family with an unusually strong interest in snacks. Griffin, the BoerneDoodle, heads toward Boerne with Kevin, Mittens, and Spike. Kevin remains the family's forever guide.

**Play:** [Doodle Onward](https://griffin-snack-patrol.jdietz.chatgpt.site/). That is the published site; this repository holds its source. A Griffin game about the move.

## Built for an iPhone in a moving car

On a phone a run takes the whole screen, in either orientation, and **the play field is the controller**. There are no on-screen buttons.

| Activity | Touch | Keyboard |
| --- | --- | --- |
| Platform adventure | Slide your left thumb to run. Tap the right side to jump; hold for height, tap again in the air. Flick up for your power. Pull down to drop fast. Chests open and signs speak when you reach them. | Left/Right or A/D, Space/Up/W to jump, Down/S to drop, X for power, E to open |
| Trail Scout | Swipe to step and keep dragging to keep walking, or tap a tile to go there. Hold still for a hint. Two fingers use your power. | Arrows or WASD, E to interact, H for a hint, X for power |
| RV Rally | Drag anywhere to steer. Pull back, or rest a second finger, to brake. Flick up to boost. Tilt steering is an option in the guide. | Left/Right or A/D, Down/S to brake, X to boost |
| Snack Storm | Drag to catch. Flick up for your power. | Left/Right or A/D, X for power |
| Camp Pairs | Tap the cards. | Tab to a card, Enter or Space |

The glowing power layer at the top of the screen can always be tapped as well. P or Escape pauses on a keyboard; the pause button is in the top corner. Real buttons for every action stay available to keyboard, switch, and screen reader users and appear only when focused.

## Five chapters, at your pace

The journey has **five worlds with six platform levels each**: Rogue River, Redwood Run, Painted Canyon, Starlight Mesa, and Boerne Hills. The first three levels in an opened world are available immediately. Every different level you finish opens another, and **four of six clears open the next world**. All thirty levels remain replayable. There are no calendar locks.

Explore branching routes, ride moving platforms, bounce on snack bandits (some hop, roll, or float), open blocks and secret chests, and find the two keys that open each RV goal. Strings of **treat balloons** make an air route between the high paths, **vents** in some gaps lift you back up if you drop in while they are erupting, and a quiet **trail marker** before each gap means a fall costs a heart but not a long walk back. Checkpoints save your place. Each world ends with a boss that leaps away after every stomp.

Every level has three persistent medals:

1. Reach the RV.
2. Find all three golden snacks.
3. Finish with no hits or within that level's target time.

Medals can be earned across different attempts. Normal layouts stay consistent while you learn them. **Remix** really reshuffles the climbs, the raised sections, and the bandits.

## Stack the good stuff

Score bonuses multiply together: **5× chain × 2× frenzy × 2× Gold Rush × 1.5× Griffin power = 30×**. The meter at the top keeps all four layers on screen, lit or waiting, each with its own timer, so it is always clear what is running and what is missing. Long air chains and secret stashes add Gold Rush time, and a frenzy starts a short snack shower. Each new tier (2×, 5×, 10×, 20×, 30×) is announced once on the way up. The best combined multiplier is saved with each activity's records.

## A backpack full of good things

Treats pay for permanent Snack Magnet, Extra Zoom, and Big Heart upgrades. **Twenty family quests**, four per world, reward actual actions such as stomps, treasures, memory matches, rally dodges, and successful snack chains. Earn **twelve charms** through medals, quests, and world clears, then equip up to three. The passport collects world, activity, family, and achievement stickers.

A Daily Adventure chooses a seeded activity and world for the device's local date. Its neutral gear and assist settings keep attempts consistent. A successful finish grants one daily bonus; further attempts can improve the record.

## Source layout

This is a static ES-module game. `dist/` is the complete site; there is no package installation or compilation step. See [CLAUDE.md](CLAUDE.md) for the module map and the rules that must hold.

| Module | Responsibility |
| --- | --- |
| `game.js`, `index.html`, `style.css`, `play.css` | Controller, camp, map, panels, and the phone-first run layout |
| `controls.js`, `hud.js`, `haptics.js`, `fx.js` | Gestures, the HUD and stack meter, touch feedback, and shared game feel |
| `world-levels.js`, `platform-engine.js`, `platform-renderer.js` | Thirty platform courses, their simulation, and their painted worlds |
| `scout-engine.js`, `scout-view.js` | Trail Scout |
| `rally3d.js` | RV driving simulation and the 3D renderers |
| `memory-game.js`, `minigames.css` | Camp Pairs |
| `snack-engine.js`, `renderer.js` | Snack Storm, the shared character-art loader, and the camp scene |
| `journey.js` | Progression, quests, gear, charms, passport, records, migration, and checkpoints |
| `characters.js`, `audio.js`, `celebrations.js` | Family identities, sound, and celebrations |
| `sw.js`, `manifest.webmanifest` | Offline release bundle and installed-app metadata |

Older runner and campaign source remains for its tests; the page does not load it. Griffin's approved likeness is documented in [GRIFFIN_REFERENCE.md](GRIFFIN_REFERENCE.md).

## Verify and preview

```sh
node --test tests/*.test.mjs
python3 -m http.server 8000 --directory dist
```

Then open `http://localhost:8000/`. Local preview skips the service worker, so check installed and offline reopening on the published site after its worker has finished installing.

## Hosting

`dist/` is served from the site root and its manifest pins scope `/`. That is the identity of the published game and is covered by tests, so leave it as it is when publishing to the existing site.

For a host that serves from a subfolder, build a relative-path copy:

```sh
node scripts/build-portable.mjs build/portable
```

`.github/workflows/pages.yml` can publish that copy to GitHub Pages, but only when someone starts it by hand from the Actions tab (and after Pages is switched to "GitHub Actions" in the repository settings). It does not touch the published site.

## Saves

The save key is `doodle-onward-journey-v1`. It imports the prior `boerne-doodlin-adventure-v2` wallet, upgrades, character, settings, and compatible records once, and leaves the original untouched. Progress belongs to one browser on one device. To move it, open the passport and either download a backup file or **copy the backup as text** and paste it on the other phone. Changing hosts also means moving the save this way.

Scores and rankings are personal to the current browser. There is no online leaderboard, account, or purchase.
