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

Platform: Left/Right or A/D moves freely; Space/Up/W jumps, holding controls height, and a second press double-jumps. Down/S fast-drops. E/Enter interacts with chests, signs, and the RV goal.

Trail Scout: arrows or WASD move in four directions, E/Enter interacts, H provides a hint, and X uses charged power. RV Rally: Left/Right or A/D steers, Down/S brakes, X uses charged power. Snack Storm: arrows or A/D, touch dragging, or arrow buttons move the character; X uses power. Camp Pairs uses native card buttons, keyboard navigation, and limited Peek hints. P/Escape pauses action play.

Sound is opt-in. Assist and reduced-motion preferences persist. Daily challenges use neutral gear, no charms, and no assist; normal play retains the selected profile.

The score stack is the product of chain (up to 5×), frenzy (2×), Gold Rush (2×), and Griffin's power (1.5×), up to 30×. Records keep fractional multipliers such as 7.5×.

## Offline release v20

The app remains on its existing URL and keeps manifest ID `/`, scope `/`, and start URL `/?source=homescreen`. Its display name is Doodle Onward. The approved Griffin icon and all four character atlases use `?v=20`.

The worker cache is `doodle-onward-journey-v20`. The release bundle includes fourteen active JavaScript modules, both stylesheets, the manifest, approved character art, shared scenery, icon, and font. Module queries and image request queries must match the precache exactly.

Navigation uses the network when available and falls back to the cached entry offline. Listed same-origin assets use the release cache. Arbitrary, non-GET, and cross-origin requests are not intercepted. Activation removes only obsolete `doodle-onward-`, `boerne-doodlin-`, and `griffin-snack-patrol-` caches.

Register `/sw.js` with `updateViaCache:'none'` on the published site. Local preview skips registration. Activate a waiting update with `{type:'SKIP_WAITING'}` while idle, and reload a previously controlled page once on `controllerchange`. The worker does not interrupt a run by forcing activation during install.

The offline regression executes the actual shared image loader, checks exact requested URLs, walks the active module imports and stylesheet assets, verifies the manifest icon, tests offline navigation and module delivery, and checks safe cache cleanup.

## Verification and publishing

No dependency installation or compilation step is required. Run:

~~~sh
node --test tests/*.test.mjs
~~~

Journey tests cover all thirty levels, ninety medals, world gates, migration, duplicate receipts, real quest actions, charm effects/configuration, Daily rules, checkpoint isolation, malformed saves, and storage failures. Engine tests and browser QA cover the actual movement, interactions, 3D rendering, cards, audio, responsive layout, and control flow.

Publish the validated `dist/` through the existing Sites source repository and save/deploy workflow. Keep the same project and public audience. The original Griffin reference guide remains the authority for character artwork.
