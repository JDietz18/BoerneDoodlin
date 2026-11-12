# Doodle Onward: Claude Code handoff

> **Where things stand now.** This document describes the Site version 13
> baseline that was handed over (asset version v20). The repository has moved
> on to the touch-first release, v21: gesture controls with no on-screen
> buttons, a rebuilt platform view, livelier mini-games, and a new HUD. The
> contracts in section 7 still hold. For the current module map and rules read
> `CLAUDE.md`; for controls, the offline bundle, and what has and has not been
> verified read `REBUILD_NOTES.md`.

Prepared November 11, 2026, Pacific time. This document describes the finished release handed over from ChatGPT, not an inspected copy of the intended GitHub repository.

## 1. Your assignment

Take ownership of the existing Doodle Onward game. Establish the supplied, working release in the real GitHub repository, preserve the user's existing work, and verify a runnable baseline before making further improvements.

Justin likes the current direction. Continue from this build. Treat subsequent requests for a "10x" improvement as a request for better game feel, interaction, variety, and replay value. A larger feature count or framework migration is not an outcome by itself.

Read the actual repository's `AGENTS.md`, `CLAUDE.md`, and applicable directory instructions first. Then read this document, `README.md`, `GRIFFIN_REFERENCE.md`, and `REBUILD_NOTES.md`. Inspect code and play the game before proposing changes.

## 2. Source and release facts

| Item | Handoff baseline |
| --- | --- |
| Product name | **Doodle Onward** |
| Live game | https://griffin-snack-patrol.jdietz.chatgpt.site/ |
| Intended GitHub repository | https://github.com/JDietz18/BoerneDoodlin |
| Published Site version | **13** |
| Sites source commit | `497566edfd452d58746e9f0d6101ed5ce4c650f2` |
| Asset query version | `?v=20` |
| Offline cache | `doodle-onward-journey-v20` |
| Last full test run | **130 passed, 0 failed, 0 skipped** |
| Verified Node runtime | `v24.22.1` |
| Verified Python runtime | `3.12.14` |
| Source package root | `Doodle-Onward/` |

**GitHub status:** The ChatGPT GitHub connection returned 404 for `JDietz18/BoerneDoodlin`. This does not establish whether the repository is private, unavailable to that connection, renamed, or missing. No GitHub files, default branch, instructions, CI configuration, or history were inspected, and no GitHub changes were made. The commit above belongs to the managed Sites source repository. Do not claim it exists in the GitHub repository.

Claude Code may have different repository access. Check the authenticated environment directly. Keep the current repository structure, instructions, and uncommitted changes until you have compared them with this package.

The handoff ZIP includes the complete source, assets, tests, existing technical/reference documents, and the prior test report (`VERIFICATION.txt`). It excludes Git metadata, Site hosting identity, credentials, runtime data, and the temporary phone-QA page. It does not contain the user's original uploaded Griffin photos/videos; the approved game artwork and reference guide are included. Links in the guide may require Justin's account access.

## 3. Product direction and identity

This is a personal family road-trip game about traveling from Grants Pass, Oregon, toward Boerne, Texas. Griffin is the central character. Jamie and Truen particularly enjoy bonus stacking. The goal is enjoyable repeat sessions throughout a five-day trip, with meaningful side activities and progress that carries between modes.

Preserve these requirements:

- The visible product title is **Doodle Onward**. `BoerneDoodlin` remains the repository name and may appear in legacy identifiers. Do not rename saved-game keys merely to match the title.
- Keep original, responsive platforming with free left/right movement, jumping, bounce combat, secrets, and satisfying feedback. The requested Mario-like feel concerns play mechanics; use the game's own art, characters, sound, and worlds.
- Keep the 2D platform adventure, 2D top-down exploration, and 3D driving mode. The current 3D mode is **RV Rally**, not a free-roaming 3D Griffin adventure.
- Keep all four playable characters available from the start: **Griffin, Kevin, Mittens, Spike**.
- Preserve Kevin's memorial meaning and phrase: **"Kevin, our forever guide. Along for every mile."** The current footer begins "With Kevin...".
- Use warm, playful, human copy. Avoid em dashes, canned AI language, and unnecessary small labels above headings. Use "children" rather than "kids" when applicable. Avoid Bricolage Grotesque and Nunito Sans.
- Preserve readable touch targets, keyboard controls, opt-in audio, assist mode, and reduced-motion support.

### Griffin's likeness is established

`GRIFFIN_REFERENCE.md` is the artwork authority. Griffin is a mature black-and-white Bernedoodle with warm dark brown eyes, a broad white crown narrowing into a slim forehead blaze, dark eye surrounds, long black ears, a broad fluffy white muzzle with gray around the black nose, a white chin and chest bib, a white nape patch, mostly black legs with small white toe tips, and a curved black tail with a fluffy white tip. His body coat is neatly clipped; his head, muzzle, ears, and tail are fuller.

Do not add tan markings or eyebrows, tall white socks, puppy proportions, a narrow poodle muzzle, or an unrequested collar. Warm illustration highlights are lighting, not brown coat markings.

Current Griffin art comes from `dist/assets/griffin-character-atlas.png` and `dist/assets/griffin-icon.png`. The atlas has four poses and measured regions in `CHARACTER_ART.griffin`. The older `griffin-atlas.png` remains only for snack/obstacle props in cells 4–8. Its obsolete dog cells 0–3 must never become fallback Griffin art.

## 4. What is already shipped

| Activity ID | Player-facing name | Current behavior |
| --- | --- | --- |
| `platform` | Platform adventure | 30 levels, free movement, variable/double jump, jump buffering and coyote time, stomps, snack blocks, springs, moving/crumbling platforms, secret chests, checkpoints, two goal keys, three golden snacks, and world-final bounce battles. |
| `scout` | Trail Scout | Seeded top-down mazes, three treasure chests, a gate key, a parcel delivery to a neighbor, and a return to the RV. Three trail hints; no countdown. |
| `rally` | RV Rally | A 60-second 3D driving challenge with steering, braking, boosts, snacks, obstacles, shields, magnets, health, and gold. WebGL and software 3D renderers share the scene geometry. |
| `snack` | Snack Storm | A 45-second catching game with touch dragging or left/right movement, mud hazards, powers, and stacking bonuses. |
| `memory` | Camp Pairs | 6, 8, or 10 matching pairs by world, an initial preview, limited peeks, streak bonuses, native card buttons, keyboard navigation, and pausable timing. |

Worlds are **Rogue River**, **Redwood Run**, **Painted Canyon**, **Starlight Mesa**, and **Boerne Hills**. Their IDs are `river`, `redwood`, `canyon`, `mesa`, and `boerne`. Each has six levels, with IDs such as `river-1` and `boerne-6`.

Three levels begin open in an unlocked world. Each distinct clear opens another level; four of six clears open the next world. There are no real-time waiting gates. Each level offers three persistent medals: finish, collect all three gold, and finish without a hit or within its target time. Medals can accumulate across attempts. Total: **90 medals**.

Shared progression includes **20 quests**, **12 earnable charms**, a maximum **three equipped charms**, permanent upgrades, a passport/sticker collection, personal records, seeded daily challenges, and platform remixes. A daily challenge uses neutral gear, no charms, and assist off. Its successful daily bonus pays once per device-local date; repeat attempts may improve records.

The maximum bonus stack is:

**5× chain × 2× frenzy × 2× Gold Rush × 1.5× Griffin power = 30× points.**

These modes and progression systems are implemented. Do not describe them as future plans.

## 5. Local setup and repository integration

This package is a **buildless static ES-module game**. `dist/` is the complete website. No package installation, bundler, framework, backend, API key, or compilation step is required for this baseline.

From the extracted `Doodle-Onward` directory:

```sh
node --test tests/*.test.mjs
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000/`. Serve `dist/` at the server root. Do not open `index.html` through `file://`.

### Recommended takeover sequence

1. Locate the real repository, confirm its remote and current branch, inspect `git status`, and read its instructions. Clone the user-provided URL only if a checkout is not already available. Preserve any existing local work.
2. Read this handoff and the supplied documents. Compare the repository with the release package. Identify the real entry point, asset paths, hosting configuration, and any CI workflows before importing.
3. Create an appropriate feature branch or isolated worktree. Integrate the shipped source without replacing unrelated files, deleting history, or overwriting secrets/configuration. Do not assume the repo is empty or that its default branch is named `main`.
4. Run the supplied baseline and any meaningful repository-specific checks. If the repository's architecture differs, map the game into that structure deliberately and record the differences.
5. Preview and exercise each activity. Confirm Griffin's artwork, saves, rewards, touch/keyboard controls, and the deployment path.
6. Finish with the actual changed-file summary, test results, runnable preview, branch/commit information, and any concrete remaining blocker. Follow Justin's current instructions and the repository's established workflow for pushes, PRs, or deployment.

Work autonomously on reversible implementation details. Do not invent access or claim a successful GitHub sync without reading back the resulting repository state.

## 6. Architecture map

All file paths below are relative to the package root.

| Files | Responsibilities |
| --- | --- |
| `dist/index.html`, `dist/style.css`, `dist/game.js` | Camp/home UI, world map, quest board, backpack, passport, input, run lifecycle, and persistence orchestration |
| `dist/world-levels.js` | Five-world catalog, 30 level definitions, deterministic/remixed platform geometry |
| `dist/platform-engine.js` | Platform simulation, collisions, entities, goals, checkpoints, snapshots |
| `dist/platform-renderer.js` | Home, platform, and top-down canvas presentation |
| `dist/scout-engine.js` | Maze exploration, treasures, parcel delivery, hints, exit conditions |
| `dist/rally3d.js` | Driving simulation, WebGL renderer, software 3D fallback |
| `dist/memory-game.js`, `dist/minigames.css` | Camp Pairs simulation, accessible DOM controls, responsive layout |
| `dist/snack-engine.js`, `dist/renderer.js` | Snack Storm and shared approved character-art loading/drawing |
| `dist/journey.js` | Progression, reward accounting, quests, charms, records, migration, checkpoints |
| `dist/characters.js`, `dist/audio.js`, `dist/celebrations.js` | Character IDs/abilities/art regions, sound, celebration effects |
| `dist/sw.js`, `dist/manifest.webmanifest` | Offline bundle and installed-app metadata |
| `tests/*.test.mjs` | Node test suite, including active systems and retained legacy behavior |

Older runner/campaign files remain for compatibility. These include `engine.js`, `progression.js`, `road.js`, `journal.js`, `trail.js`, `phone.js`, `iphone.css`, and `campaign.css`. Do not delete files solely because they look old: active `renderer.js` still imports world constants from `adventure-engine.js`, and legacy tests remain in the full suite. The current progression authority is `journey.js`.

## 7. Contracts to preserve

### Persistence and checkpoints

- Current save key: `doodle-onward-journey-v1`.
- Legacy migration source: `boerne-doodlin-adventure-v2`.
- Migration imports wallet, upgrades, selected character, settings, and compatible records once. It retains a legacy snapshot and leaves the old key untouched. Old runner wins do not fabricate clears in the new campaign.
- Normal platform attempts save on checkpoints, pause, return to camp, page hide, and roughly every ten seconds of active play.
- Daily/remix runs must not inherit, consume, overwrite, or clear ordinary platform checkpoints. Restored attempts retain their starting character and gear.
- The controller currently persists normal platform attempts only. Scout exposes snapshots, but persistent Scout resume is not wired into the UI.
- Save import must detach the old run before replacing the `Journey`, so an old run cannot award progress into the imported save.
- Storage failures leave the game playable and show the session-only/export notice.
- Progress is browser/device/origin-local. Changing hosts does not automatically transfer local storage; use the existing export/import feature when moving saves.

### Configuration, completion, and rewards

`journey.getRunConfig(selection)` supplies mode, level, world, seed, character, gear, charm effects, assist, daily context, checkpoint, and medal goals. The engine consumes that configuration. All persistent rewards pass through **`Journey.completeRun(summary)`**.

`earnedTreats` already contains the complete reward. Never award its components again in the controller. Keep stable unique `runId` values; the last 384 receipts prevent duplicate processing. Preserve the controller's completion guard because Memory may notify through both an event and its completion callback.

Keep the active configuration when adapting older engines. Snack Storm results require enrichment with the active mode/world/seed/daily date. A daily visit to a locked world must not unlock the story or grant locked-level medals. Perfect-memory quest credit requires a completed game with zero mistakes, not merely one perfect pair. `bestMultiplier` can be fractional, such as `7.5`; do not round it down.

Charms belong in the validated loadout and run configuration. Do not show a charm as equipped unless it is earned, respects the three-slot limit, and affects a supported mechanic. See `REBUILD_NOTES.md` for API return shapes and effect names.

### Engine and UI boundaries

- Engine `mode` fields describe lifecycle states; activity selection uses IDs such as `platform` and `scout`. Do not confuse them.
- `PlatformRun` uses player x as center and y as feet, with y increasing downward.
- Scout has grid coordinates plus interpolated `renderX/renderY`. The first direction press steps immediately; holding repeats on a cooldown. Parcel state is `parcel`; the successful delivery event is `deliver`.
- Trail Scout uses **H for hint** and **X for power**.
- Preserve native Enter/Space activation on DOM buttons. Reset held input on pause, blur, and visibility changes.
- Memory resolves flips/matches using simulation time so pause freezes them.
- Rally uses actual 3D scene meshes in both renderers. `data-renderer` and `data-render-status` expose the chosen backend and reason. The controller must not overwrite those diagnostics.

## 8. Offline, versioning, and publishing

The current release uses `?v=20` in active imports, styles, character atlas requests, and icon references. Its worker cache is `doodle-onward-journey-v20`. When releasing changed cached assets, update cache/version references together and run `tests/offline.test.mjs`. The tests walk imports and asset requests to catch mismatches.

The worker caches the active module graph, both stylesheets, artwork, scenery, icon, manifest, and font. It uses network-first navigation and a cached entry fallback. It removes only the game's owned cache prefixes. A waiting update activates while idle; do not force reloads during an outing.

Service-worker registration is intentionally skipped on `localhost` and `127.0.0.1`. A local preview alone does not verify installed/offline behavior. Test that behavior on an appropriate secure staging or production origin after the worker has installed completely.

**Hosting-path constraint:** The app assumes `/`. It uses root-relative assets, `/sw.js`, root precache entries, and manifest scope/start URL. A GitHub Pages project path such as `/BoerneDoodlin/` needs a coordinated base-path adaptation and offline tests. Supplying a GitHub repository does not imply a request to move hosting to GitHub Pages.

The live game is the existing public Site at the URL above. Its project ID is `appgprj_6a9b62f342fc8191b179f76120ef7dfe`; the hosted checkout serves `dist/` through `.openai/hosting.json`. That environment-specific file is deliberately excluded from this portable package. Reuse the existing Site identity and audience if publishing through Sites. Obtain fresh access through the authorized environment. This handoff contains no usable hosting credentials and does not establish a GitHub-to-Sites deployment connection.

## 9. Validation baseline and honest limits

The prior full run passed **130 tests**. `VERIFICATION.txt` records that run. It covers progression/migration, real quest actions, reward idempotency, checkpoint isolation, all-level reachability, platform behavior, Scout completion, Rally courses and rendering geometry, Memory, audio/celebrations, and the offline bundle.

Browser QA checked desktop and phone layouts, all five activity entry points, card matching, controls, and the published platform adventure. The inspected cloud browser had no WebGL context, so its observed Rally rendering used **software 3D**. There has not been a complete physical-device certification or a measured five-day playtime study.

Useful next checks are real iPhone/iPad/Android touch play, portrait and landscape, native WebGL performance, sustained battery/thermal behavior, browser interruption/resume, and installed-app reopening in airplane mode. Record what was actually tested.

There is currently no cloud save synchronization, online leaderboard, multiplayer, or free-roaming 3D character mode. Those would be separate future features.

### Regression checklist for the next release

- Run the existing suite before and after relevant changes; keep deterministic scenarios and useful failure assertions.
- Exercise move, jump, power, interact, pause, resume, restart, and return-to-camp controls.
- Verify high routes and required keys remain reachable with ordinary gear; check moving/crumbling platforms and boss exits.
- Complete a Scout delivery and exit; check that hints and power remain separate actions.
- Verify Memory pause/flip timing and completion awards; exercise Rally steering/braking/boosting.
- Confirm ordinary checkpoints survive starting/retrying daily and remix runs.
- Confirm rewards pay once, world gates remain intact, and save export/import preserves the intended state.
- Inspect artwork, readability, touch targets, safe areas, and scroll/overlay behavior on the actual device sizes used.
- Verify cached version consistency and a safe update from the previous release when publishing.

Do not broaden testing without a concrete risk. A passing automated suite does not prove game feel or long-session replay value.

## 10. Suggested next priorities, not already-authorized new features

After repository integration and a verified baseline, use Justin's next brief to choose a focused improvement. High-value candidates are:

1. **Physical-device playability:** input responsiveness, camera framing, safe areas, reliable interruption/resume, battery use, and offline reopening.
2. **Game feel:** jump/bounce feedback, collision clarity, readable hazards, useful audio cues, and a clearer sense of progress during an outing.
3. **Content variety:** more distinct world mechanics and side-route decisions, using the existing progression rather than adding unrelated menus.
4. **Stacking clarity:** help players recognize which bonuses are active, why they combined, and how charm choices affect their runs.
5. **Replay tuning:** learn from actual sessions, adjust pacing and rewards, and add targeted challenges where repetition becomes noticeable.

Preserve the approved visual direction, Griffin's likeness, family characters, existing saves, and all working modes. Refactor or adopt new technology only when it solves a demonstrated problem.

## 11. Takeover completion report

When the baseline is established, report:

- Which repository, branch, and commit now contain the integrated work, or the exact remaining access blocker.
- What differed between the repository and this package, and how existing work was preserved.
- The preview URL and commands that actually work in that environment.
- Tests run, results, and device/browser checks performed.
- Any known defect or verification gap, clearly separated from proposed improvements.
- The most useful next change based on playtesting and Justin's latest request.

The immediate success condition is a faithful, working, repository-integrated baseline that Claude can continue safely. The next creative brief should build from that foundation.
