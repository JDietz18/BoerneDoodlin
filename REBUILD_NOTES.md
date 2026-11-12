# Doodle Onward journey expansion

## Scope

The journey now centers on thirty free-movement platform levels across five worlds. Four arcade activities provide different kinds of play: top-down Trail Scout, 3D RV Rally, Snack Storm, and Camp Pairs. A five-chapter structure supports short daily sessions, but progression has no date or waiting requirement.

Worlds are Rogue River, Redwood Run, Painted Canyon, Starlight Mesa, and Boerne Hills. IDs are `river`, `redwood`, `canyon`, `mesa`, and `boerne`; level IDs use those prefixes with `-1` through `-6`. Three levels are initially available in each opened world. Each distinct clear opens one more level, and four of six clears open the next world.

Medals use the actual level metadata: finish, collect `goldTarget` golden snacks, and finish without a hit or within `parTime`. Each goal remains earned across retries. New-medal and first-clear rewards cannot be collected again by replaying the same accomplishment.

## Journey API

`journey.js` exports `Journey`, `SAVE_KEY`, `MODES`, `UPGRADES`, `CHARMS`, `QUESTS`, `ACHIEVEMENTS`, `STICKERS`, `loadJourney`, `saveJourney`, and `localDateKey`. It re-exports `WORLDS` and `LEVELS` from the shared level catalog.

~~~js
const journey = loadJourney(storage);
const config = journey.getRunConfig({
  mode: 'platform',
  levelId: 'river-1',
  remix: false
});

engine.reset(config);

// After the engine finishes:
const report = journey.completeRun({
  ...engine.result(),
  worldIndex: config.worldIndex,
  dailyDate: config.dailyDate,
  seed: config.seed
});

if (report.ok && !report.repeat) {
  const saved = saveJourney(storage, journey);
  // Show a nonblocking storage notice when saved is false.
}
~~~

Keep the active config fields when adapting an older engine. In particular, the original Snack Storm reports a fixed stage; its controller must enrich the result with the current world, seed, and daily date.

### Configuration

`getRunConfig({mode, levelId, worldIndex, seed, remix, dailyDate, characterId})` returns:

~~~js
{
  mode, levelId, worldIndex, stage, characterId,
  gear: {magnet, charge, heart},
  charms: {/* confirmed engine effects */},
  assist, seed, remix, dailyDate, checkpoint, medalGoals
}
~~~

The mode is `platform`, `scout`, `snack`, `memory`, or `rally`. For normal platform play the seed is deterministic by level. Remix generates a fresh seed unless one is supplied. Other activities accept a supplied seed. A daily date selects and standardizes the challenge's mode, world, level, and seed; platform dailies use remix geometry.

Equipped charm IDs are stored in `state.charms.loadout`. Configuration exposes their actual effects in `config.charms`, while gear-level bonuses are merged into `config.gear` with normal caps. The supported effects are `stompCharge`, `goldDuration`, `comboGrace`, `extraJump`, `stompBounce`, `secretMagnet`, `shieldStart`, `speed`, and `powerDuration`. Engine-specific perks apply where that mechanic exists. Memory's charge gear adds Peek hints.

### Results and rewards

`completeRun(summary)` returns:

~~~js
{
  ok, repeat, earnedTreats, rewards,
  medals, medalGoals, newMedals,
  unlockedLevels, unlockedWorlds,
  questRewards, unlockedCharms, stickers, achievements,
  newBest, bestMultiplier, dailyBonus, home
}
~~~

`earnedTreats` already includes collected treats, gold, finish, new medal, first clear, world clear, quest, and daily rewards. Do not award any component again in the UI. A stable unique run ID prevents duplicate processing across every activity and reload.

Level IDs in `unlockedLevels` identify new map buttons. `unlockedWorlds`, `questRewards`, `unlockedCharms`, `stickers`, and `achievements` contain full definitions for display. `medalGoals` includes each actual label, target, and earned status. `levelGoals(levelId)` supplies goals before a run.

Each quest tracks its own sticky progress and pays once. World/mode filters prevent unrelated actions from advancing it. Distinct-level and family-member goals use unique IDs. Chain and multiplier goals use the highest single-run value, not a sum across runs. The perfect-memory quest requires a **finished game with zero mistakes**; perfect individual pairs are not enough.

### Other methods

| Method | Result |
| --- | --- |
| `selectCharacter(id)`, `selectWorld(index)`, `setSetting(key, boolean)` | Boolean success |
| `purchaseUpgrade(id)` | `{ok, cost, level, message}` |
| `equipCharm(id)` | Toggles an earned charm; returns `{ok, equipped, message}` and enforces three slots |
| `questProgress(worldIndex?)` | Display-ready quests with progress, target, reward, completion, and ratio |
| `getDailyChallenge(date)` | Activity/world/seed selection plus title, date, bonus, claimed status, and best score |
| `saveCheckpoint(levelId, snapshot)`, `clearCheckpoint(levelId)` | Boolean success |
| `serialize()` | Independent JSON snapshot |

Save after successful purchases, equipment, character, world, or setting changes. Checkpoints are copied, size-bounded, and validated against both top-level and engine-config level IDs. Normal-level config includes its saved snapshot; a fresh remix or daily never inherits an unrelated checkpoint. Successful level completion clears its checkpoint.

## Persistent state

The new key is **`doodle-onward-journey-v1`**. Its state contains:

- Wallet, selected character/world, settings, and three capped upgrade levels.
- Five ordered world records and thirty level records with separate medal flags.
- Twenty quest records, unlocked/equipped charms, and passport collections.
- Separate records for each of the five modes.
- Action counters, per-character counters, and fractional best multipliers.
- Date-specific Daily history, per-level checkpoints, and the last 384 run receipts.
- A migration record and the complete legacy snapshot.

On first use, a valid `boerne-doodlin-adventure-v2` save transfers its wallet, upgrades, selected character, settings, former adventure record into the platform record, and Snack Storm record. All former records remain available in the legacy snapshot. The original key is not modified, and a valid Journey save never repeats migration. Prior runner wins do not fabricate clears or quests in the new thirty-level journey.

Daily bonuses are once per local calendar date. Every activity is eligible for the daily selection. A daily platform visit can use a locked world, but cannot bypass story unlocks or award its locked level's permanent medals. Personal records and rankings stay on the current browser/device.

## Controls and accessibility

On a phone the play field is the controller and nothing is drawn over it. `dist/controls.js` tracks each finger on its own and reports intent; `dist/game.js` turns that into engine calls.

| Activity | Touch | Keyboard |
| --- | --- | --- |
| Platform | Left half: slide to run, flick up for power, pull down to drop. Right half: tap to jump, hold for height, tap again in the air. Chests open and signs speak on arrival. | Left/Right or A/D, Space/Up/W, Down/S, X, E/Enter |
| Trail Scout | Swipe or drag to walk, tap a tile (or the corner map) to go there, press and hold for a hint, two fingers for power. Walking into a chest, the neighbor, or the RV uses it. | Arrows or WASD, E/Enter, H, X |
| RV Rally | Drag to steer, pull back or rest a second finger to brake, flick up to boost. Tilt steering is opt in. | Left/Right or A/D, Down/S, X |
| Snack Storm | Drag to catch, flick up or a second finger for power. | Left/Right or A/D, X |
| Camp Pairs | Tap the cards. | Tab, Enter or Space |

The glowing power layer in the stack meter, Trail Scout's hint chip, and pause act when a finger lands, so they work while a thumb is already on the field. Real buttons for every action live in `.assist-controls` for keyboard, switch, and screen reader users and stay out of sight until focused. P/Escape pauses.

Sound is opt-in. Assist and reduced-motion preferences persist in the journey. Touch feedback, tilt steering, and which first-time hints have been seen are device preferences in `doodle-onward-device-v1`. Daily challenges use neutral gear, no charms, and no assist; normal play retains the selected profile.

The score stack is the product of chain (up to 5×), frenzy (2×), Gold Rush (2×), and Griffin's power (1.5×), up to 30×. Records keep fractional multipliers such as 7.5×. The meter shows all four layers at all times; the frenzy bar rests while a frenzy is cooling down.

## Offline release v22

The app remains on its existing URL and keeps manifest ID `/`, scope `/`, and start URL `/?source=homescreen`. Its display name is Doodle Onward. The approved Griffin icon and all four character atlases use `?v=22`.

The worker cache is `doodle-onward-journey-v22`. The release bundle includes twenty active JavaScript modules, four stylesheets, the manifest, approved character art, shared scenery, icon, and font. Module queries and image request queries must match the precache exactly, and the install step asks the network for fresh copies so a phone never mixes an old module with a new page. `tests/release.test.mjs` fails if any file carries a different version.

Navigation uses the network when available and falls back to the cached entry offline. Listed same-origin assets use the release cache. Arbitrary, non-GET, and cross-origin requests are not intercepted. Activation removes only obsolete `doodle-onward-`, `boerne-doodlin-`, and `griffin-snack-patrol-` caches.

Register `/sw.js` with `updateViaCache:'none'` on the published site. Local preview skips registration. Activate a waiting update with `{type:'SKIP_WAITING'}` while idle, and reload a previously controlled page once on `controllerchange`. The worker does not interrupt a run by forcing activation during install.

The offline regression executes the actual shared image loader, checks exact requested URLs, walks the active module imports and stylesheet assets, verifies the manifest icon, tests offline navigation and module delivery, and checks safe cache cleanup.

## What the touch-first release changed

Built on the Site version 13 source. Save format, reward rules, level ids, and the 30× stack are unchanged.

- **Controls.** Gestures only on a phone (table above). No pads or buttons are drawn. First-time hints fade once each move has been tried.
- **HUD.** One glanceable band: hearts, goals, score, a countdown for timed modes, and a stack meter that keeps all four layers on screen. Each new tier (2×, 5×, 10×, 20×, 30×) is announced once on the way up.
- **Game feel.** `fx.js` gives every view the same bounded particles, popups, shake, hit-stop, and slow motion. `haptics.js` adds taps where the phone allows it.
- **Platform adventure.** Rebuilt painted view with a look-ahead camera. New optional pieces, all appended after the goal so saved ids never move: treat-balloon skyways, vents in some gaps, trail markers before gaps, and a finish staircase. Bandits can hop, roll, or float; bosses leap away after each stomp. A frenzy starts a short snack shower. Remix reshuffles climbs, raised sections, and bandits.
- **Trail Scout.** Painted maps with a follow camera and corner map, tap-to-walk, treat trails from chests, a wandering critter, and a hidden golden paw. Walking into something uses it.
- **RV Rally.** Finger-following steering, a countdown, a different road character per world, ramps, near misses, treat convoys, and a final push.
- **Snack Storm.** A storm per world with gusts, comets, and bounces, its own stack tiers, and a final countdown.
- **Camp Pairs.** Streaks, a golden pair, card swaps, and a time bonus.
- **Sound.** A palette per world and music that leans in as the stack grows.
- **Saves.** A backup can be copied as text and pasted on another phone. An unfinished mini-game banks what was found when you leave.
- **Hosting.** `scripts/build-portable.mjs` writes a relative-path copy for subfolder hosts and previews. `dist/` itself still belongs at the site root.

Two small balance changes came with the mini-game work: a Rally treat convoy pays about a third more, and the golden pair in Camp Pairs pays two extra.

## Verification and publishing

No dependency installation or compilation step is required. Run:

~~~sh
node --test tests/*.test.mjs
~~~

Journey tests cover all thirty levels, ninety medals, world gates, migration, duplicate receipts, real quest actions, charm effects/configuration, Daily rules, checkpoint isolation, malformed saves, and storage failures. Engine tests cover movement, the new platform pieces (every skyway and staircase is crossed by a bot in all 30 levels, with and without Easygoing mode), each mini-game, gestures, the HUD, the offline bundle, and version consistency.

What was checked for v21, in Chromium with an iPhone profile:

- All five activities played with real multi-touch at 390×750, 320×568, 844×390, and 667×375, with no console errors.
- Chips and pause under a held thumb, repeat flicks, the hint ring, braking, assist buttons by keyboard, and desktop keyboard play.
- A phone with release 20 installed meeting release 21 on the same address: the save carried over, no old module was mixed in, the old cache was removed, and every activity reopened offline.
- The portable build inside a host page that wraps it the way a preview does.
- Platform drawing at about 4 ms a frame with the processor slowed four times.
- Independent reviews of the platform adventure, RV Rally, Snack Storm, the gestures, and the saves, each on a frozen copy. What they confirmed was fixed and given a test that fails without the fix: a stomped boss that leapt back into the buddy, bandits that reached through step platforms, trail markers that returned the buddy into a bandit's lane, a Snack Storm course that depended on frame pacing, and a Rally scene that lost sharpness for good at 30 frames a second.

What has not been checked, and should be before a trip depends on it:

- A real iPhone in Safari and as a Home Screen app. Chromium is not WebKit: touch timing, safe areas, audio unlock, the wake lock, and WebGL in RV Rally all deserve a few minutes on the actual phones.
- RV Rally's quicker way of showing its 3D scene (straight to the screen instead of copied onto the page's canvas). It has only ever run on a software renderer, so it is off by default and the game draws the road the way release 13 did. "Faster road drawing" in the guide turns it on for one phone; if the road looks right there, it is safe to leave on.
- Sound by ear. The cue list is tested; nobody has listened to it.
- Touch feedback. iPhone has no vibration interface for web pages; the fallback used here is unproven on a device and simply does nothing where it is unsupported.
- Tilt steering, battery use, and heat over a long session.

Publish the validated `dist/` through the existing Sites source repository and save/deploy workflow. Keep the same project and public audience. The original Griffin reference guide remains the authority for character artwork.
