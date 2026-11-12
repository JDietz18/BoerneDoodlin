// Doodle Onward · Camp Pairs.
// Every reveal, match, swap and countdown belongs to update(dt), so a pause
// freezes the whole board. The DOM only mirrors that state: CSS classes drive
// the flips and flourishes, and the cards themselves are the controls.
//
// Events sent to onEvent, in the order a board usually meets them:
//   start, deal, ready            the board is dealt, previewed, then open for play
//   flip {index, first, key, wild, pan}
//   match {pair, indices, value, bonus, combo, multiplier, perfect, wild, pan}
//   collect {kind: 'pair' | 'gold', value, bonus, combo, multiplier}, combo (from the second pair in a row)
//   streak {combo, multiplier, tier}   at 3, 5, 7 and 9 pairs in a row
//   golden {pair, bonus, treats, indices}
//   mismatch {mistakes, indices, streakLost, pan}, streak-lost {streak}
//   hint and peek {remaining, duration}   the Peek chip (hint is the original cue)
//   swap {indices, lead, duration}, swap-done {indices}
//   timer-low (15 s), timer-warning (10 s), tick {remaining} for 5 to 1
//   perfect-game or time-up, then won or lost {result}; pause and resume

const INK = '#22403b';
const LINE = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
function starPath(cx, cy, outer, inner, points = 5) {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer, a = -Math.PI / 2 + i * Math.PI / points;
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  }
  return `${d}z`;
}

// Road-trip faces. Each entry: key, text fallback, spoken label, face tint, art (64 x 64).
const PICTURES = [
  ['paw', '🐾', 'Paw print', '#ffe3c2',
    `<g fill="#4b3a33" ${LINE}><path d="M32 30.5c-8.6 0-15.5 6.4-15.5 13.6 0 5.7 4.7 9 10 8.2 2.2-.3 3.6-1.1 5.5-1.1s3.3.8 5.5 1.1c5.3.8 10-2.5 10-8.2 0-7.2-6.9-13.6-15.5-13.6z"/><ellipse cx="13.6" cy="27.5" rx="5.2" ry="6.9" transform="rotate(-20 13.6 27.5)"/><ellipse cx="24.6" cy="16.8" rx="5.4" ry="7.3" transform="rotate(-7 24.6 16.8)"/><ellipse cx="39.4" cy="16.8" rx="5.4" ry="7.3" transform="rotate(7 39.4 16.8)"/><ellipse cx="50.4" cy="27.5" rx="5.2" ry="6.9" transform="rotate(20 50.4 27.5)"/></g><path d="M24.5 41.5c1.6-3.6 4.2-5.4 7.5-5.4" fill="none" stroke="#927468" stroke-width="2.6" stroke-linecap="round"/>`],
  ['bone', '🦴', 'Treat bone', '#cfe9ff',
    `<g transform="rotate(-32 32 32)"><g fill="#fffaf0" ${LINE}><circle cx="14" cy="25.5" r="7.5"/><circle cx="14" cy="38.5" r="7.5"/><circle cx="50" cy="25.5" r="7.5"/><circle cx="50" cy="38.5" r="7.5"/><rect x="14" y="25" width="36" height="14"/></g><rect x="10.4" y="26.3" width="43.2" height="11.4" fill="#fffaf0"/><path d="M19 35h22" stroke="#e6d6b8" stroke-width="2.6" stroke-linecap="round"/></g>`],
  ['rv', '🚐', 'Family RV', '#d5f2e3',
    `<rect x="20" y="10.5" width="13" height="7" rx="2.5" fill="#e9dcc3" ${LINE}/><path d="M6 21a5 5 0 0 1 5-5h32.5c7.2 0 12.6 5.6 13.6 13.4l1 8.3a5 5 0 0 1-5 5.6H11a5 5 0 0 1-5-5z" fill="#fffaf0" ${LINE}/><path d="M7.3 33.5h50.3l.6 4.9a3.6 3.6 0 0 1-3.6 4H11a3.7 3.7 0 0 1-3.7-3.7z" fill="#2f9a8c"/><path d="M7.4 31.4h50" stroke="#f0884a" stroke-width="2.4"/><rect x="11.5" y="20.5" width="11" height="8" rx="2" fill="#a8dff0" ${LINE}/><rect x="26.5" y="20.5" width="10" height="8" rx="2" fill="#a8dff0" ${LINE}/><path d="M41.5 20.5h3.4c3.4 0 6 3.3 7 8h-10.4z" fill="#a8dff0" ${LINE}/><g ${LINE}><circle cx="19" cy="44.5" r="6.4" fill="#3d4247"/><circle cx="46" cy="44.5" r="6.4" fill="#3d4247"/></g><circle cx="19" cy="44.5" r="2.3" fill="#e4e4e0"/><circle cx="46" cy="44.5" r="2.3" fill="#e4e4e0"/>`],
  ['star', '⭐', 'Golden star', '#cdd9ff',
    `<path d="${starPath(32, 34, 26, 11.6)}" fill="#ffc93c" ${LINE}/><path d="M23 29.5c1.4-3 3.4-4.8 6-5.6" fill="none" stroke="#fff3bf" stroke-width="3" stroke-linecap="round"/>`],
  ['cactus', '🌵', 'Cactus', '#ffe9b8',
    `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M32 50V16M32 41H18.5V28.5M32 34.5h13.5V23" stroke="${INK}" stroke-width="15"/><path d="M32 50V16M32 41H18.5V28.5M32 34.5h13.5V23" stroke="#58b368" stroke-width="10.2"/><path d="M32 19v27M18.5 30v5M45.5 24.5v5" stroke="#3e8f4e" stroke-width="1.8"/></g><circle cx="32" cy="9" r="4.2" fill="#ff7fa3" ${LINE}/><ellipse cx="32" cy="55" rx="21" ry="4.6" fill="#e3b574" ${LINE}/>`],
  ['pine', '🌲', 'Pine tree', '#dff3d0',
    `<rect x="28" y="45" width="8" height="13.5" rx="1.6" fill="#8a5a3c" ${LINE}/><path d="M32 3l12.5 15H39l11.5 13.5H44l13 15H7l13-15h-6.5L25 18h-5.5z" fill="#2f8f5b" ${LINE}/><path d="M26 24.5h6M19.5 39.5h10" stroke="#63bf88" stroke-width="2.6" stroke-linecap="round"/>`],
  ['river', '🏞️', 'River bend', '#d6f1f7',
    `<rect x="7" y="9" width="50" height="46" rx="10" fill="#bfe9f5"/><circle cx="44" cy="25" r="6.5" fill="#ffd45e"/><path d="M7 28.5c7-6 15-6 22-1 8 5 19 4 28-2V45a10 10 0 0 1-10 10H17A10 10 0 0 1 7 45z" fill="#8fd07a"/><path d="M30 27.5c8 3 9 7 2 11s-12 8.5-9 16.5h22c-6-7-4-11 2-15s3-10.5-11-12.5z" fill="#3ea6dd"/><path d="M29 48h8M33.5 41.5h5" stroke="#dcf5ff" stroke-width="2.2" stroke-linecap="round"/><rect x="7" y="9" width="50" height="46" rx="10" fill="none" ${LINE}/>`],
  ['moon', '🌙', 'Crescent moon', '#3a4580',
    `<path d="M38 9.5A23 23 0 1 0 54.5 41 18.5 18.5 0 0 1 38 9.5z" fill="#ffe9a3" ${LINE}/><path d="M50 12l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff6cf"/><circle cx="55" cy="27" r="1.6" fill="#fff6cf"/><circle cx="24" cy="38" r="2.6" fill="#f2d47c"/><circle cx="31" cy="46" r="1.7" fill="#f2d47c"/>`],
  ['bluebonnet', '🪻', 'Bluebonnet', '#fff0b8',
    `<path d="M32 60V38" fill="none" stroke="#3e8f4e" stroke-width="3.6" stroke-linecap="round"/><path d="M32 58c-8-.5-13-4.5-14-11 7 0 12 3.5 14 10 2-6.5 7-10 14-10-1 6.5-6 10.5-14 11z" fill="#58b368" ${LINE}/><ellipse cx="32" cy="7.5" rx="4" ry="4.2" fill="#fffaf0" ${LINE}/><g fill="#3f6fd8" ${LINE}><ellipse cx="27.2" cy="15" rx="5.4" ry="4.8"/><ellipse cx="36.8" cy="15" rx="5.4" ry="4.8"/><ellipse cx="23" cy="24" rx="5.8" ry="5"/><ellipse cx="41" cy="24" rx="5.8" ry="5"/><ellipse cx="32" cy="23" rx="5.8" ry="5"/><ellipse cx="18.5" cy="33.5" rx="5.8" ry="5"/><ellipse cx="45.5" cy="33.5" rx="5.8" ry="5"/><ellipse cx="27.5" cy="34.5" rx="5.8" ry="5"/><ellipse cx="36.5" cy="34.5" rx="5.8" ry="5"/></g><g fill="#fffaf0"><circle cx="27.2" cy="14.4" r="1.7"/><circle cx="36.8" cy="14.4" r="1.7"/><circle cx="32" cy="22.4" r="1.8"/><circle cx="23" cy="23.4" r="1.6"/><circle cx="41" cy="23.4" r="1.6"/><circle cx="27.5" cy="34" r="1.6"/><circle cx="36.5" cy="34" r="1.6"/></g>`],
  ['key', '🔑', 'Camp key', '#d9e5ff',
    `<g transform="rotate(-38 32 32)" fill="#f4b93f" ${LINE}><path d="M27 28.5h29a2 2 0 0 1 2 2V39a1.5 1.5 0 0 1-1.5 1.5h-2.5A1.5 1.5 0 0 1 52.5 39v-3.5H50v5.5a1.5 1.5 0 0 1-1.5 1.5H46a1.5 1.5 0 0 1-1.5-1.5v-5.5H27z"/><path fill-rule="evenodd" d="M18 19.5a12.5 12.5 0 1 0 .01 0zM18 27a5 5 0 1 1-.01 0z"/></g>`],
  ['map', '🗺️', 'Trail map', '#dff3d0',
    `<g ${LINE}><path d="M7 17l17-5.5V49L7 54.5z" fill="#f8ebc2"/><path d="M24 11.5L40 17v37.5L24 49z" fill="#ead596"/><path d="M40 17l17-5.5V49l-17 5.5z" fill="#f8ebc2"/></g><path d="M13 44c4-8.5 8-3.5 11-9.5s6-12 11-8 6 8.5 9.5 4.5" fill="none" stroke="#e2574c" stroke-width="2.8" stroke-dasharray=".1 5.4" stroke-linecap="round"/><path d="M45.5 21.5l5.5 5.5M51 21.5L45.5 27" stroke="#e2574c" stroke-width="3" stroke-linecap="round"/><circle cx="13" cy="44" r="3" fill="#2f9a8c"/>`],
  ['tent', '⛺', 'Tent', '#cfeaf7',
    `<path d="M32 12V5l8 3-8 3" fill="#ffd45e" ${LINE}/><path d="M32 12L7 52h50z" fill="#f2784b" ${LINE}/><path d="M32 12L19.5 52h25z" fill="#ffa26b" ${LINE}/><path d="M32 27L23.5 52h17z" fill="#3b2b33" ${LINE}/><path d="M4 52h56" fill="none" ${LINE}/>`],
  ['fish', '🐟', 'River fish', '#d2f4ee',
    `<g ${LINE}><path d="M48 32l12-10.5v21z" fill="#2f9a8c"/><path d="M27 19.5c3-5.5 8.5-7 13-6-1 3.5-2.5 6-5 8z" fill="#2f9a8c"/><path d="M5 32c6-11 16.5-15.5 27.5-14.5 9.5 1 16 6.5 20 14.5-4 8-10.5 13.5-20 14.5-11 1-21.5-3.5-27.5-14.5z" fill="#49bcab"/></g><path d="M13 36.5c8 5 18.5 6.5 30.5 2.5" fill="none" stroke="#ffb3a1" stroke-width="3.2" stroke-linecap="round"/><path d="M24.5 25.5c2 4 2 8.5 0 12.5" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><circle cx="16.5" cy="28.5" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1.8"/><circle cx="17.2" cy="28.5" r="1.5" fill="${INK}"/>`],
  ['acorn', '🌰', 'Acorn', '#ffe6c9',
    `<path d="M32 12.5c0-3.5 1.2-5.5 4-7" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M17 29c0 13 6 23.5 15 27 9-3.5 15-14 15-27z" fill="#dba25c" ${LINE}/><path d="M11.5 28c0-10 9-16 20.5-16s20.5 6 20.5 16c0 2.2-1.5 3.5-3.5 3.5H15c-2 0-3.5-1.3-3.5-3.5z" fill="#8a5a3c" ${LINE}/><path d="M20 22l4 4.5M28 18.5l4 4.5M36.5 18.5l4 4.5M45 22l-3.5 4" stroke="#69422a" stroke-width="2" stroke-linecap="round"/><path d="M24 37c1 6 3 10 6.5 13" fill="none" stroke="#f3c88d" stroke-width="2.8" stroke-linecap="round"/>`],
  ['sun', '☀️', 'Canyon sun', '#ffd9b8',
    `<path d="M32 3.5v7M32 53.5v7M3.5 32h7M53.5 32h7M11.8 11.8l5 5M47.2 47.2l5 5M11.8 52.2l5-5M47.2 16.8l5-5" stroke="#f47b3a" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="32" r="16" fill="#ffc93c" ${LINE}/><circle cx="26.2" cy="30" r="2" fill="${INK}"/><circle cx="37.8" cy="30" r="2" fill="${INK}"/><path d="M26 36c3 3.6 9 3.6 12 0" fill="none" ${LINE}/><circle cx="22.5" cy="35.5" r="2.4" fill="#ff9f7a"/><circle cx="41.5" cy="35.5" r="2.4" fill="#ff9f7a"/>`],
  ['lantern', '🏮', 'Camp lantern', '#3f3a78',
    `<g transform="translate(32 33) scale(1.17) translate(-32 -33)"><path d="M22 16.5c0-9 20-9 20 0" fill="none" stroke="#f3e7c9" stroke-width="3" stroke-linecap="round"/><path d="M20 15.5h24l3.5 6.5h-31z" fill="#e2574c" ${LINE}/><rect x="18.5" y="22" width="27" height="24.5" rx="4.5" fill="#ffe9a3" ${LINE}/><path d="M32 26.5c4 4 6.2 7 6.2 10.3a6.2 6.2 0 0 1-12.4 0c0-3.3 2.2-6.3 6.2-10.3z" fill="#ff9a3c" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M32 33c2 2 3 3.5 3 5a3 3 0 0 1-6 0c0-1.5 1-3 3-5z" fill="#fff6cf"/><rect x="15.5" y="46.5" width="33" height="9.5" rx="3.2" fill="#e2574c" ${LINE}/></g>`],
  ['hat', '🤠', 'Trail hat', '#ffeccc',
    `<path d="M3.5 38.5c6 11 18 14.5 28.5 14.5s22.5-3.5 28.5-14.5c-5 2.5-10 2.8-14.5 1.5h-28c-4.5 1.3-9.5 1-14.5-1.5z" fill="#c98f52" ${LINE}/><path d="M18 40.5c0-10 1-22 6-25 3-1.8 5 2.3 8 2.3s5-4.1 8-2.3c5 3 6 15 6 25-8 3.2-20 3.2-28 0z" fill="#dcaa6e" ${LINE}/><path d="M18.2 34.5c8 3.2 19.6 3.2 27.6 0l.2 6c-8 3.2-20 3.2-28 0z" fill="#7a3f2a" ${LINE}/><path d="${starPath(32, 37.8, 3.6, 1.5)}" fill="#ffd45e"/>`],
  ['campfire', '🔥', 'Campfire', '#33406f',
    `<path d="M32 4.5c2 8.5 12.5 12.5 12.5 24.5a12.5 12.5 0 0 1-25 0c0-5 3-8.5 5.2-12.5 1 3 2 4.3 4.2 5.3-1-6.3 0-12.3 3.1-17.3z" fill="#ff8a3c" ${LINE}/><path d="M32 23.5c1 4 6.2 6 6.2 11.3a6.2 6.2 0 0 1-12.4 0c0-3 2-4.3 3-6.3 1 1.5 1.6 2.1 2.6 2.6-.5-2.6-.3-5.1.6-7.6z" fill="#ffd45e"/><g fill="#8a5a3c" ${LINE}><rect x="9" y="46" width="46" height="8.5" rx="4.2" transform="rotate(13 32 50)"/><rect x="9" y="46" width="46" height="8.5" rx="4.2" transform="rotate(-13 32 50)"/></g>`]
];
const PICTURE = new Map(PICTURES.map(([key, symbol, label, tint, art]) => [key, { key, symbol, label, tint, art }]));

// Each world leans on its own scenery. The first ANCHORS symbols always appear.
const ANCHORS = 3;
const WORLD_SETS = [
  ['river', 'fish', 'paw', 'bone', 'rv', 'pine', 'tent', 'star', 'map', 'campfire'],
  ['pine', 'acorn', 'campfire', 'paw', 'bone', 'tent', 'map', 'key', 'moon', 'rv', 'star'],
  ['cactus', 'sun', 'map', 'rv', 'key', 'star', 'paw', 'bone', 'river', 'lantern', 'moon'],
  ['moon', 'star', 'lantern', 'cactus', 'tent', 'campfire', 'paw', 'bone', 'rv', 'key', 'map', 'sun'],
  ['bluebonnet', 'hat', 'rv', 'cactus', 'paw', 'bone', 'star', 'key', 'map', 'river', 'sun', 'moon', 'tent']
];
const WORLD_KEYS = ['river', 'redwood', 'canyon', 'mesa', 'boerne'];
// Card back emblems, one per world (48 x 48, drawn in the current text colour).
const EMBLEMS = [
  '<path d="M6 16c4-4.5 8-4.5 12 0s8 4.5 12 0 8-4.5 12 0M6 25c4-4.5 8-4.5 12 0s8 4.5 12 0 8-4.5 12 0M6 34c4-4.5 8-4.5 12 0s8 4.5 12 0 8-4.5 12 0" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>',
  '<path d="M24 3l8.5 11.5h-4l8 10.5h-5l9.5 11.5H7l9.5-11.5h-5l8-10.5h-4z" fill="currentColor"/><rect x="21.3" y="36.5" width="5.4" height="8.5" rx="1.2" fill="currentColor"/>',
  '<circle cx="24" cy="15" r="7.5" fill="currentColor"/><path d="M3 42V32h8v-5.5h10V32h7v-8.5h10V32h7v10z" fill="currentColor"/>',
  '<path d="M24 4l4.4 15.6L44 24l-15.6 4.4L24 44l-4.4-15.6L4 24l15.6-4.4z" fill="currentColor"/><circle cx="39" cy="9" r="2.4" fill="currentColor"/><circle cx="9" cy="39" r="2" fill="currentColor"/>',
  `<circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="3"/><path d="${starPath(24, 24.8, 14.5, 5.9)}" fill="currentColor"/>`
];
// Later worlds add seeded twists: a golden pair worth a bonus, and cards that
// trade places once (twice in Boerne Hills). Easygoing mode skips the swaps.
const TWISTS = [[], ['golden'], ['swap'], ['golden', 'swap'], ['golden', 'swap', 'swap']];
const GOLDEN_BONUS = 150, GOLDEN_TREATS = 2;
const STREAK_MILESTONES = [3, 5, 7, 9];
const SWAP_WAIT = .4, SWAP_GO = .9, SWAP_END = 1.7;
const FLAME = '<svg viewBox="0 0 24 28" aria-hidden="true" focusable="false"><path class="cp-flame__outer" d="M12 1c1 5.2 7.4 7.6 7.4 15.2a7.4 7.4 0 0 1-14.8 0c0-3.2 1.7-5.2 3.1-7.3.6 1.9 1.3 2.7 2.5 3.3C9.7 8.7 10.3 4.7 12 1z"/><path class="cp-flame__inner" d="M12 13.5c.6 2.3 3.2 3.3 3.2 6.2a3.2 3.2 0 0 1-6.4 0c0-1.7 1-2.5 1.6-3.6.4.9.8 1.2 1.3 1.5-.2-1.5-.1-2.9.3-4.1z"/></svg>';
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.2 12c2.6-4.5 5.9-6.8 9.8-6.8s7.2 2.3 9.8 6.8c-2.6 4.5-5.9 6.8-9.8 6.8S4.8 16.5 2.2 12z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.3" fill="currentColor"/></svg>';

let sequence = 0;
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(Number(n)) ? Number(n) : a));
const clone = value => JSON.parse(JSON.stringify(value));
function seeded(seed) { let state = Number(seed) >>> 0; return () => { state = (state + 0x6d2b79f5) >>> 0; let n = Math.imul(state ^ state >>> 15, state | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; }; }
function shuffle(array, random) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
const svg = (body, box = 64) => `<svg viewBox="0 0 ${box} ${box}" aria-hidden="true" focusable="false">${body}</svg>`;

export class MemoryGame {
  constructor(container, { onEvent = () => {}, onFinish = () => {} } = {}) {
    this.container = container; this.onEvent = onEvent; this.onFinish = onFinish; this._destroyed = false; this._quiet = true;
    this._presses = new Map(); this._swallow = null;
    // A touch flips on contact, which forgives a thumb that slides on a bumpy
    // road. The click that follows is swallowed; keyboard and assistive
    // activation arrive as a click alone and still work.
    this._down = event => {
      if (event.button > 0) return;
      const card = event.target?.closest?.('[data-memory-card]');
      if (!card || !this.container.contains(card)) return;
      const index = Number(card.dataset.memoryCard);
      card.classList.add('is-pressed'); this._presses.set(event.pointerId, { card, index });
      this._tap(index);
    };
    this._up = event => {
      const press = this._presses.get(event.pointerId); if (!press) return;
      this._presses.delete(event.pointerId); press.card.classList.remove('is-pressed');
      this._swallow = event.type === 'pointerup' ? { index: press.index, stamp: event.timeStamp } : null;
    };
    this._click = event => {
      const card = event.target?.closest?.('[data-memory-card]');
      if (card && this.container?.contains(card)) {
        const index = Number(card.dataset.memoryCard), swallow = this._swallow; this._swallow = null;
        if (swallow && swallow.index === index && Math.abs(event.timeStamp - swallow.stamp) < 700) return;
        this._tap(index);
      } else if (event.target?.closest?.('[data-memory-peek]')) this.peek();
    };
    this._key = event => { this._swallow = null; this._navigate(event); };
    if (container?.addEventListener) {
      container.addEventListener('click', this._click); container.addEventListener('keydown', this._key);
      container.addEventListener('pointerdown', this._down);
      for (const name of ['pointerup', 'pointercancel', 'pointerleave']) container.addEventListener(name, this._up);
    }
    this.container?.classList.add('memory-game-host');
    this.reset(); this.mode = 'ready'; this._quiet = false; this._sync();
  }
  emit(type, detail = {}) { if (!this._quiet) this.onEvent({ ...detail, type }); }

  reset({ worldIndex = 0, characterId = 'griffin', seed = 1, gear = {}, assist = false, charms = {}, dailyDate = '' } = {}) {
    if (this._destroyed) return this;
    this.worldIndex = Math.round(clamp(worldIndex, 0, 4)); this.stage = this.worldIndex;
    this.characterId = ['griffin', 'kevin', 'mittens', 'spike'].includes(characterId) ? characterId : 'griffin';
    this.seed = Number(seed) >>> 0; this.dailyDate = String(dailyDate || ''); this.assist = Boolean(assist && !this.dailyDate);
    this.gear = { magnet: 0, charge: 0, heart: 0 }; for (const key of Object.keys(this.gear)) this.gear[key] = this.dailyDate ? 0 : Math.round(clamp(gear?.[key] || 0, 0, key === 'heart' ? 2 : 3));
    this.charms = this.dailyDate ? {} : clone(charms && typeof charms === 'object' ? charms : {});
    this.runId = `memory-${Date.now().toString(36)}-${++sequence}`; this.runMode = 'memory'; this.mode = 'running';
    this.totalPairs = [6, 8, 8, 10, 10][this.worldIndex]; this.pairs = 0; this.mistakes = 0; this.perfects = 0;
    this.score = 0; this.treats = 0; this.gold = 0; this.flips = 0; this.combo = 0; this.bestCombo = 0; this.multiplier = 1; this.totalMultiplier = 1; this.bestMultiplier = 1;
    this.time = 0; this.timeLimit = this.assist ? 150 : 90; this.hearts = 1; this.maxHearts = 1;
    this.hints = 1 + this.gear.charge + (this.assist ? 1 : 0); this.hintsUsed = 0;
    this._resolveTime = 0; this._resolveTotal = 0; this._pending = ''; this._missShown = false; this._queued = null;
    this._selected = []; this._missedKeys = new Set(); this._summary = null; this._focusIndex = 0; this._lastSecond = -1; this._warning = false; this._low = false;
    this.goldenFound = 0; this.swaps = 0; this.timeBonus = 0; this.perfectGame = false; this._swap = null; this._swapsDone = 0; this._missRun = 0;

    const random = seeded(this.seed), set = WORLD_SETS[this.worldIndex];
    const chosen = [...set.slice(0, ANCHORS), ...shuffle(set.slice(ANCHORS), random)].slice(0, this.totalPairs).map(key => PICTURE.get(key));
    this.cards = shuffle(chosen.flatMap(({ key, symbol, label }) => [0, 1].map(() => ({ key, symbol, label, matched: false, faceUp: false, wild: false }))), random).map((card, index) => ({ ...card, id: index }));
    // Twists draw from their own stream, so the same seed always deals the
    // same board no matter which twists a world carries.
    const twist = seeded((this.seed ^ 0x5bd1e995) >>> 0), plan = TWISTS[this.worldIndex];
    this.twists = []; this.wildKey = ''; this._swapPlan = [];
    if (plan.includes('golden')) {
      this.wildKey = chosen[Math.floor(twist() * chosen.length)].key; this.twists.push('golden');
      for (const card of this.cards) card.wild = card.key === this.wildKey;
    }
    const swapCount = plan.filter(name => name === 'swap').length;
    for (let k = 0; k < swapCount; k++) {
      const at = Math.round(this.totalPairs * (k + 1) / (swapCount + 1)) - (twist() < .5 ? 1 : 0);
      const order = shuffle(this.cards.map((_, index) => index), twist);
      if (!this.assist) this._swapPlan.push({ at, order });
    }
    if (this._swapPlan.length) this.twists.push('swap');

    this._calm = this._reducedMotion();
    this._startPreview(this.assist ? 2.8 : 1.95, 'deal');
    this.message = 'Take a little peek. Remember a few friendly faces!';
    this._build(); this._sync();
    this.emit('start', { runId: this.runId, mode: 'memory', worldIndex: this.worldIndex, twists: [...this.twists] });
    this.emit('deal', { cards: this.cards.length, duration: this.previewTime });
    return this;
  }

  // The preview is a ripple: each card opens and closes on its own beat,
  // measured in simulation time.
  _startPreview(seconds, kind) {
    this.previewTime = seconds; this._previewTotal = seconds; this._previewKind = kind;
    const deal = kind === 'deal';
    this._wave = this._calm ? { lead: 0, spread: 0, tail: 0, tailSpread: 0 }
      : deal ? { lead: .12, spread: .28, tail: .3, tailSpread: .12 } : { lead: 0, spread: .2, tail: .36, tailSpread: .14 };
  }
  _previewShows(index) {
    if (!(this.previewTime > 0)) return false;
    const wave = this._wave, elapsed = this._previewTotal - this.previewTime, r = this._rankOf(index);
    return elapsed >= wave.lead + r * wave.spread && elapsed < this._previewTotal - wave.tail + r * wave.tailSpread;
  }
  _rankOf(index) { return this._ranks ? this._ranks[index] : ((index % 4) + Math.floor(index / 4)) / Math.max(1, 3 + Math.floor((this.cards.length - 1) / 4)); }

  flip(index) {
    if (this.mode !== 'running' || this._destroyed || this.previewTime > 0 || this._resolveTime > 0 || this._swap || !Number.isInteger(index)) return false;
    const card = this.cards[index]; if (!card || card.matched || card.faceUp || this._selected.length >= 2) return false;
    card.faceUp = true; this._selected.push(index); this.flips++; this._focusIndex = index;
    const first = this._selected.length === 1;
    this.message = first ? `${card.label}. Find its friend.` : 'Two cards. Let’s see…';
    this.emit('flip', { index, first, key: card.key, wild: card.wild, pan: this._pan(index) });
    if (!first) {
      const match = this.cards[this._selected[0]].key === card.key;
      this._pending = match ? 'match' : 'miss'; this._missShown = false;
      this._resolveTime = this._resolveTotal = match ? .36 : (this.assist ? 1 : .78);
    }
    this._sync(); return true;
  }
  // A tap from the board. One early tap during a resolve is remembered so
  // quick fingers are never ignored.
  _tap(index) {
    if (this.flip(index)) return true;
    const card = this.cards[index];
    if (this.mode === 'running' && this._resolveTime > 0 && !this._swap && card && !card.matched && !this._selected.includes(index)) this._queued = index;
    else if (this.mode === 'running' && card && !card.matched) this._nudge(index);
    return false;
  }
  peek() {
    if (this.mode !== 'running' || this.previewTime > 0 || this._resolveTime > 0 || this._swap || this._selected.length || this.hints <= 0) return false;
    this.hints--; this.hintsUsed++; this._missRun = 0; this._calm = this._reducedMotion(); this._startPreview(this.assist ? 2 : 1.3, 'peek');
    this.message = 'One helpful peek. You’ve got this!';
    // 'hint' is the original contract; 'peek' is the Camp Pairs cue.
    this.emit('hint', { remaining: this.hints, mode: 'memory', text: 'A quick peek!' });
    this.emit('peek', { remaining: this.hints, duration: this.previewTime });
    this._kick(this.root, 'is-peek-flash'); this._sync(); return true;
  }
  pause() { if (this.mode === 'running') { this.mode = 'paused'; this._queued = null; this._releasePresses(); this.emit('pause'); this._sync(); } }
  resume() { if (this.mode === 'paused') { this.mode = 'running'; this.emit('resume'); this._sync(); } }

  update(dt) {
    if (this.mode !== 'running' || this._destroyed) return;
    dt = clamp(dt || 0, 0, 1);
    this._tickEffects(dt);
    // A swap holds the clock: nobody loses time while the cards trade places.
    if (this._swap) { this._updateSwap(dt); return; }
    this.time = Math.min(this.timeLimit, this.time + dt);
    if (this.previewTime > 0) {
      this.previewTime = Math.max(0, this.previewTime - dt);
      if (!this.previewTime) {
        const dealt = this._previewKind === 'deal'; this._previewKind = '';
        this.message = 'Pick two cards. Matching friends build your streak.';
        if (dealt) this.emit('ready', { pairs: this.totalPairs, twists: [...this.twists] });
        this._sync();
      } else this._syncCards();
    } else if (this._resolveTime > 0) {
      this._resolveTime = Math.max(0, this._resolveTime - dt);
      if (!this._resolveTime) this._resolve();
      else if (this._pending === 'miss' && !this._missShown && this._resolveTotal - this._resolveTime >= .3) { this._missShown = true; this._syncCards(); }
    }
    if (this.mode !== 'running') return;
    const left = this.timeLimit - this.time;
    if (!this._low && left <= 15) { this._low = true; this.emit('timer-low', { remaining: 15 }); this._sync(); }
    if (!this._warning && left <= 10) { this._warning = true; this.message = 'Ten seconds. One pair at a time!'; this.emit('timer-warning', { remaining: 10 }); this._sync(); }
    if (this.time >= this.timeLimit) this._finish(false);
    else if (Math.ceil(left) !== this._lastSecond) {
      this._syncClock();
      if (this._lastSecond <= 5 && this._lastSecond > 0) { this.emit('tick', { remaining: this._lastSecond }); this._countdown(this._lastSecond); }
    }
  }

  _resolve() {
    if (this._selected.length !== 2) return;
    const keepBoardFocus = Boolean(this.buttons?.includes(this.container?.ownerDocument.activeElement));
    const pair = [...this._selected], [a, b] = pair.map(index => this.cards[index]);
    this._pending = ''; this._missShown = false;
    let milestone = 0, lost = 0, value = 0, bonus = 0;
    if (a.key === b.key) {
      a.matched = b.matched = true; this.pairs++; this.combo++; this._missRun = 0; this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.multiplier = Math.min(5, 1 + Math.floor((this.combo - 1) / 2)); this.totalMultiplier = this.multiplier; this.bestMultiplier = Math.max(this.bestMultiplier, this.multiplier);
      const perfect = !this._missedKeys.has(a.key); if (perfect) this.perfects++;
      value = 60 * this.multiplier; bonus = a.wild ? GOLDEN_BONUS : 0;
      this.score += value + bonus; this.treats += (perfect ? 3 : 2) + (a.wild ? GOLDEN_TREATS : 0); if (a.wild) this.goldenFound++;
      this.message = a.wild ? `The golden pair! ${GOLDEN_BONUS} bonus points.` : this.combo > 1 ? `${this.combo} pairs in a row! ${this.multiplier}× memory bonus.` : `${a.label} matched! A perfect little pair.`;
      this.emit('match', { pair: a.key, pairs: this.pairs, totalPairs: this.totalPairs, perfect, value, combo: this.combo, multiplier: this.multiplier, indices: pair, wild: a.wild, bonus, pan: this._pan(pair[1]) });
      this.emit('collect', { kind: a.wild ? 'gold' : 'pair', value, bonus, combo: this.combo, multiplier: this.multiplier, totalMultiplier: this.totalMultiplier });
      if (this.combo > 1) this.emit('combo', { combo: this.combo, multiplier: this.multiplier, totalMultiplier: this.totalMultiplier });
      if (a.wild) this.emit('golden', { pair: a.key, bonus, treats: GOLDEN_TREATS, indices: pair });
      milestone = STREAK_MILESTONES.indexOf(this.combo) + 1;
      if (milestone) this.emit('streak', { combo: this.combo, multiplier: this.multiplier, tier: milestone });
    } else {
      lost = this.combo;
      a.faceUp = b.faceUp = false; this._missedKeys.add(a.key); this._missedKeys.add(b.key);
      this.mistakes++; this._missRun++; this.combo = 0; this.multiplier = this.totalMultiplier = 1;
      this.message = 'Different friends. Now you know where they live.';
      this.emit('mismatch', { mistakes: this.mistakes, indices: pair, streakLost: lost, pan: this._pan(pair[1]) });
      if (lost >= 2) this.emit('streak-lost', { streak: lost });
    }
    this._selected = []; this._sync();
    if (a.matched) { this._celebrate(pair, value, bonus, a.wild, milestone); this._focusNext(keepBoardFocus); }
    else this._commiserate(pair, lost);
    if (this.pairs === this.totalPairs) { this._finish(true); return; }
    if (a.matched) this._queueSwap();
    const queued = this._queued; this._queued = null;
    if (queued !== null && !this._swap) this.flip(queued);
  }

  // Seeded swap: the first two open, different cards in this swap's own order.
  _queueSwap() {
    const plan = this._swapPlan[this._swapsDone]; if (!plan || this.pairs < plan.at) return;
    const open = plan.order.filter(index => !this.cards[index].matched && !this.cards[index].faceUp);
    const a = open[0], b = open.find(index => index !== a && this.cards[index].key !== this.cards[a].key);
    this._swapsDone++;
    if (a === undefined || b === undefined) return;
    this._swap = { a, b, time: 0, phase: 0 };
  }
  _updateSwap(dt) {
    const swap = this._swap; swap.time += dt;
    if (swap.phase === 0 && swap.time >= SWAP_WAIT) {
      swap.phase = 1; this.message = `Switcheroo! Cards ${swap.a + 1} and ${swap.b + 1} are trading places.`;
      this.emit('swap', { indices: [swap.a, swap.b], lead: SWAP_GO - SWAP_WAIT, duration: SWAP_END - SWAP_WAIT });
      this._banner('Switcheroo!', 'Two cards trade places', 'swap', this._spots ? [this._spots[swap.a].y, this._spots[swap.b].y] : null); this._sync();
    }
    if (swap.phase === 1 && swap.time >= SWAP_GO) {
      swap.phase = 2; const { a, b } = swap;
      [this.cards[a], this.cards[b]] = [this.cards[b], this.cards[a]];
      this._paintFace(a); this._paintFace(b); this._travel(a, b); this._sync();
    }
    if (swap.phase === 2 && swap.time >= SWAP_END) {
      this._swap = null; this.swaps++; this.message = 'All settled. Pick two cards.';
      this.emit('swap-done', { indices: [swap.a, swap.b] }); this._sync();
    }
  }

  _finish(won) {
    if (this.mode !== 'running' || this._summary) return;
    this.mode = won ? 'won' : 'lost'; this.previewTime = 0; this._resolveTime = 0; this._swap = null; this._queued = null; this._pending = '';
    if (won) { this.timeBonus = Math.ceil(this.timeLimit - this.time) * 3 + this.perfects * 10; this.score += this.timeBonus; this.perfectGame = this.mistakes === 0; }
    else this.hearts = 0;
    this.message = won ? 'All together! A happy little campfire crew.' : 'The campfire is still warm. Try those pairs again.';
    this._summary = this._snapshot(); this._sync(); this._finale(won); const summary = this.result();
    // Flourish events go out before the final one: a controller stops listening after it.
    if (won && this.perfectGame) this.emit('perfect-game', { pairs: this.pairs, bestCombo: this.bestCombo, score: this.score });
    if (!won) this.emit('time-up', { pairs: this.pairs, totalPairs: this.totalPairs });
    this.emit(this.mode, { result: summary }); if (!this._quiet) this.onFinish(this.result());
  }
  _snapshot() {
    return {
      runId: this.runId, mode: 'memory', state: this.mode, won: this.mode === 'won', worldIndex: this.worldIndex, stage: this.worldIndex, characterId: this.characterId, seed: this.seed, dailyDate: this.dailyDate, assist: this.assist, gear: { ...this.gear }, charms: clone(this.charms),
      score: this.score, treats: this.treats, gold: 0, pairs: this.pairs, totalPairs: this.totalPairs, mistakes: this.mistakes, perfects: this.perfects, flips: this.flips, hintsUsed: this.hintsUsed, bestCombo: this.bestCombo, bestMultiplier: this.bestMultiplier,
      time: Number(this.time.toFixed(3)), timeLimit: this.timeLimit, distance: 0, hits: 0, dodged: 0, hearts: this.hearts, maxHearts: 1,
      twists: [...this.twists], goldenFound: this.goldenFound, swaps: this.swaps, timeBonus: this.timeBonus, perfectGame: this.perfectGame
    };
  }
  result() { return clone(this._summary || this._snapshot()); }
  // Where a card sits on screen (viewport pixels), for a controller that wants
  // to aim its own effects. It measures the page: call it on an event, not every frame.
  cardCenter(index) {
    const rect = this.buttons?.[index]?.getBoundingClientRect?.();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null;
  }
  focus() { this.buttons?.find(button => !button.disabled)?.focus({ preventScroll: true }); }

  // ---- DOM ------------------------------------------------------------------
  _reducedMotion() {
    const doc = this.container?.ownerDocument; if (!doc) return false;
    try { return doc.documentElement?.dataset?.reducedMotion === 'true' || Boolean(doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch { return false; }
  }
  _build() {
    if (!this.container?.ownerDocument) return;
    const doc = this.container.ownerDocument, make = (tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; };
    const hide = node => { node.setAttribute('aria-hidden', 'true'); return node; };
    this._observer?.disconnect(); this._effects = []; this._bannerLife = 0; this._states = []; this._ranks = null; this._spots = null; this._cols = 0; this._presses.clear();
    this.container.dataset.cpWorld = WORLD_KEYS[this.worldIndex];
    const root = make('section', 'camp-pairs'); root.setAttribute('aria-label', 'Camp Pairs memory game'); root.dataset.world = WORLD_KEYS[this.worldIndex];

    const bar = make('div', 'cp-bar');
    const streak = hide(make('div', 'cp-streak')), flame = make('span', 'cp-flame'); flame.innerHTML = FLAME;
    this.streakCount = make('b', 'cp-streak__n'); this.streakMult = make('i', 'cp-streak__x'); streak.append(flame, this.streakCount, this.streakMult); this.streakEl = streak;
    const track = hide(make('span', 'cp-timer')); this.timerFill = make('i'); track.append(this.timerFill);
    this.timerLabel = make('span', 'cp-time'); this.timerLabel.setAttribute('role', 'timer'); this.timerLabel.setAttribute('aria-label', 'Time left');
    const hint = make('button', 'cp-peek'); hint.type = 'button'; hint.dataset.memoryPeek = 'true';
    const eye = hide(make('span', 'cp-peek__eye')); eye.innerHTML = EYE; this.peekCount = hide(make('b', 'cp-peek__n'));
    hint.append(eye, hide(make('span', 'cp-peek__word', 'Peek')), this.peekCount); this.hintButton = hint;
    bar.append(track, streak, this.timerLabel, hint);

    const board = make('div', 'cp-board'); this.board = board;
    this.grid = make('div', 'cp-grid'); this.grid.dataset.pairs = String(this.totalPairs); this.grid.setAttribute('role', 'group');
    this.grid.setAttribute('aria-label', `${this.totalPairs} matching pairs. Use arrow keys to move between cards.`);
    this.buttons = this.cards.map((card, index) => {
      const button = make('button', 'cp-card'); button.type = 'button'; button.dataset.memoryCard = String(index);
      const tilt = hide(make('span', 'cp-tilt')), inner = make('span', 'cp-inner'), back = make('span', 'cp-back'), face = make('span', 'cp-face');
      back.innerHTML = svg(EMBLEMS[this.worldIndex], 48); inner.append(back, face); tilt.append(inner); button.append(tilt);
      this.grid.append(button); return button;
    });
    this.faces = this.buttons.map(button => button.querySelector('.cp-face'));
    for (let i = 0; i < this.cards.length; i++) this._paintFace(i);
    this.fx = hide(make('div', 'cp-fx')); this.countEl = hide(make('div', 'cp-count')); this.bannerEl = hide(make('div', 'cp-banner'));
    board.append(this.grid, this.fx, this.countEl, this.bannerEl);
    this.status = make('p', 'cp-status'); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite'); this.status.setAttribute('aria-atomic', 'true');
    root.append(bar, board, this.status); this.root = root;
    root.classList.toggle('is-dealing', !this._calm);
    this.container.replaceChildren(root);
    // One-shot flourishes tidy themselves away when their animation ends.
    root.addEventListener('animationend', event => {
      const node = event.target, name = event.animationName;
      if (node.parentNode === this.fx) node.remove();
      else if (name === 'cp-travel' || name === 'cp-nudge') node.classList.remove('is-travel', 'is-nudge');
      else if (node === this.grid) node.classList.remove('is-pulse', 'is-pulse-big', 'is-gold-pulse');
      else if (name === 'cp-wave') root.classList.remove('is-peek-flash');
    });
    const Observer = doc.defaultView?.ResizeObserver;
    if (Observer) { this._observer = new Observer(() => this._layout()); this._observer.observe(board); }
    this._layout();
  }
  _paintFace(index) {
    const face = this.faces?.[index]; if (!face) return;
    const card = this.cards[index], picture = PICTURE.get(card.key);
    face.innerHTML = svg(picture.art) + (card.wild ? '<i class="cp-gold"></i>' : '');
    face.style.setProperty('--cp-tint', picture.tint);
    this.buttons[index].classList.toggle('is-golden', card.wild);
    if (this._states) this._states[index] = -1;
  }
  // Picks the column count that gives the biggest picture on each card, then
  // records each card's spot so effects never need to measure the page.
  _layout() {
    const board = this.board; if (!board || !this.buttons) return;
    const width = board.clientWidth, height = board.clientHeight, count = this.cards.length; if (!width || !height) return;
    const gap = clamp(Math.min(width, height) * .024, 6, 12);
    let best = null;
    for (let cols = 2; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      let w = (width - gap * (cols - 1)) / cols, h = (height - gap * (rows - 1)) / rows; if (w <= 0 || h <= 0) continue;
      if (w / h > 1.12) w = h * 1.12; else if (w / h < .6) h = w / .6;
      if (w > 176) { h *= 176 / w; w = 176; }
      // Cards never drop under 56 px wide while a roomier arrangement exists.
      const score = (w >= 56 ? 1e7 : 0) + Math.min(w * .92, h * .8) * 1000 * (cols * rows === count ? 1 : .97) + w * h * .01;
      if (!best || score > best.score) best = { cols, rows, w, h, score };
    }
    if (!best) return;
    const { cols, rows } = best, w = Math.floor(best.w * 2) / 2, h = Math.floor(best.h * 2) / 2;
    const gridWidth = cols * w + (cols - 1) * gap, gridHeight = rows * h + (rows - 1) * gap, left = (width - gridWidth) / 2, top = (height - gridHeight) / 2;
    this._cols = cols; this._cardSize = { w, h };
    const style = this.grid.style;
    style.setProperty('--cp-w', `${w}px`); style.setProperty('--cp-h', `${h}px`); style.setProperty('--cp-gap', `${gap}px`); style.width = `${gridWidth + .5}px`;
    this._spots = []; this._ranks = [];
    const rankMax = Math.max(1, cols + rows - 2);
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols), col = i % cols, inRow = row === rows - 1 ? count - row * cols : cols, shift = (cols - inRow) * (w + gap) / 2;
      const x = left + shift + col * (w + gap) + w / 2, y = top + row * (h + gap) + h / 2, rank = (row + col + (cols - inRow) / 2) / rankMax;
      this._spots.push({ x, y, pan: clamp((x / width - .5) * .8, -.4, .4) }); this._ranks.push(rank);
      const s = this.buttons[i].style;
      s.setProperty('--cp-rank', rank.toFixed(3)); s.setProperty('--cp-dx', `${(width / 2 - x).toFixed(1)}px`); s.setProperty('--cp-dy', `${(height + h - y).toFixed(1)}px`);
    }
  }
  _pan(index) { return this._spots?.[index]?.pan || 0; }

  _syncClock() {
    const left = this.timeLimit - this.time; this._lastSecond = Math.ceil(left);
    if (!this.timerLabel) return;
    const second = this._lastSecond, held = this.mode !== 'running' || Boolean(this._swap);
    this.timerLabel.textContent = `${Math.floor(second / 60)}:${String(second % 60).padStart(2, '0')}`;
    // One style write a second: the bar glides to the next whole second. A
    // held clock (pause, swap, ending) sits exactly where the time stands.
    this.timerFill.style.setProperty('--cp-time', String(clamp((held ? left : Math.max(0, second - 1)) / this.timeLimit, 0, 1)));
    this.timerFill.classList.toggle('is-held', held);
    const clock = this.mode === 'lost' ? 'out' : this.mode === 'won' ? 'ok' : second <= 5 ? 'final' : second <= 15 ? 'low' : 'ok';
    if (this.root.dataset.clock !== clock) this.root.dataset.clock = clock;
  }
  _syncCards() {
    if (!this.buttons) return;
    const busy = this.mode !== 'running' || this.previewTime > 0 || this._resolveTime > 0 || Boolean(this._swap), reveal = this.mode === 'lost';
    const swap = this._swap && this._swap.phase > 0 ? this._swap : null;
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i], button = this.buttons[i];
      const up = card.faceUp || card.matched || reveal || this._previewShows(i);
      const miss = this._missShown && this._selected.includes(i), cue = Boolean(swap && (swap.a === i || swap.b === i));
      const state = (up ? 1 : 0) | (card.matched ? 2 : 0) | (busy ? 4 : 0) | (miss ? 8 : 0) | (i === this._focusIndex ? 16 : 0) | (cue ? 32 : 0) | (card.faceUp ? 64 : 0);
      if (this._states[i] === state) continue; this._states[i] = state;
      button.classList.toggle('is-up', up); button.classList.toggle('is-matched', card.matched); button.classList.toggle('is-miss', miss);
      button.classList.toggle('is-picked', card.faceUp && !card.matched && !miss); button.classList.toggle('is-swapping', cue);
      // Temporarily busy cards stay focusable; aria-disabled blocks repeated input
      // without throwing keyboard focus out of the board during a reveal.
      button.disabled = card.matched; button.setAttribute('aria-disabled', String(busy || card.matched));
      button.tabIndex = i === this._focusIndex ? 0 : -1; button.setAttribute('aria-pressed', String(up));
      button.setAttribute('aria-label', card.matched ? `Matched ${card.label}` : up ? `Card ${i + 1}: ${card.label}${card.wild ? ', golden' : ''}` : `Card ${i + 1}, face down`);
    }
  }
  _sync() {
    if (!this.container || !this.buttons) return;
    if (this.cards[this._focusIndex]?.matched) this._focusIndex = this.cards.findIndex(card => !card.matched);
    this._syncCards();
    const root = this.root, running = this.mode === 'running', previewing = this.previewTime > 0;
    if (!previewing && root.classList.contains('is-dealing')) root.classList.remove('is-dealing');
    root.classList.toggle('is-peeking', previewing && this._previewKind === 'peek');
    root.classList.toggle('is-paused', this.mode === 'paused');
    root.classList.toggle('is-won', this.mode === 'won'); root.classList.toggle('is-lost', this.mode === 'lost'); root.classList.toggle('is-perfect', this.mode === 'won' && this.perfectGame);
    const heat = this.combo ? this.multiplier : 0;
    if (root.dataset.heat !== String(heat)) root.dataset.heat = String(heat);
    this.streakEl.classList.toggle('is-lit', this.combo > 0);
    this.streakEl.style.setProperty('--cp-grow', String(Math.min(1.7, 1 + this.combo * .08))); this.streakEl.style.setProperty('--cp-ring', String(Math.min(1, this.combo / 9)));
    const count = this.combo ? String(this.combo) : '', mult = this.multiplier > 1 ? `${this.multiplier}×` : '';
    if (this.streakCount.textContent !== count) { this.streakCount.textContent = count; if (count) this._kick(this.streakEl, 'is-bump'); }
    if (this.streakMult.textContent !== mult) this.streakMult.textContent = mult;
    const peeks = String(this.hints);
    if (this.peekCount.textContent !== peeks) this.peekCount.textContent = peeks;
    this.hintButton.setAttribute('aria-label', `Peek at all unmatched cards. ${this.hints} left.`);
    this.hintButton.disabled = !running || !this.hints || previewing || this._resolveTime > 0 || Boolean(this._swap) || Boolean(this._selected.length);
    this.hintButton.classList.toggle('is-spent', !this.hints);
    // Three misses in a row: the chip glows as a quiet offer of help.
    this.hintButton.classList.toggle('is-offering', running && this.hints > 0 && this._missRun >= 3);
    if (this.status.textContent !== this.message) this.status.textContent = this.message;
    this._syncClock();
  }

  // ---- flourishes (visual only) ---------------------------------------------
  // Restarts a one-shot CSS animation. One forced style read per event, never per frame.
  _kick(node, name) { if (!node?.classList) return; node.classList.remove(name); void node.offsetWidth; node.classList.add(name); }
  _effect(className, x, y, seconds, text, sub) {
    if (!this.fx) return null;
    while (this._effects.length > 40) this._effects.shift().node.remove();
    const doc = this.container.ownerDocument, node = doc.createElement('span'); node.className = className;
    node.style.left = `${x.toFixed(1)}px`; node.style.top = `${y.toFixed(1)}px`;
    if (text) { node.textContent = text; if (sub) { const small = doc.createElement('small'); small.textContent = sub; node.append(small); } }
    this.fx.append(node); this._effects.push({ node, life: seconds }); return node;
  }
  // Effect lifetimes are simulation time too, so a pause holds them in place.
  _tickEffects(dt) {
    if (this._bannerLife > 0) { this._bannerLife -= dt; if (this._bannerLife <= 0) this.bannerEl?.classList.remove('is-on'); }
    const list = this._effects; if (!list?.length) return;
    for (let i = list.length - 1; i >= 0; i--) { list[i].life -= dt; if (list[i].life <= 0) { list[i].node.remove(); list.splice(i, 1); } }
  }
  _sparks(x, y, golden) {
    if (this._calm || !this.fx) return;
    const reach = (this._cardSize?.w || 80) * .78;
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2 + Math.random() * .5, far = reach * (.7 + Math.random() * .5);
      const node = this._effect(`cp-spark${golden || i % 2 ? ' is-gold' : ''}${i % 3 === 0 ? ' is-star' : ''}`, x, y, .8);
      node.style.setProperty('--cp-sx', `${(Math.cos(angle) * far).toFixed(1)}px`); node.style.setProperty('--cp-sy', `${(Math.sin(angle) * far).toFixed(1)}px`);
    }
  }
  _banner(title, sub, kind, avoid) {
    if (!this.bannerEl) return;
    // Keep the banner off the cards it is talking about.
    let top = '';
    if (avoid?.length && this.board) {
      const height = this.board.clientHeight || 1, away = at => Math.min(...avoid.map(y => Math.abs(y - at * height)));
      top = `${[.5, .16, .84].reduce((best, at) => away(at) > away(best) + 1 ? at : best) * 100}%`;
    }
    this.bannerEl.style.top = top;
    this.bannerEl.textContent = title;
    if (sub) { const small = this.container.ownerDocument.createElement('small'); small.textContent = sub; this.bannerEl.append(small); }
    this.bannerEl.dataset.kind = kind || ''; this._kick(this.bannerEl, 'is-on');
    this._bannerLife = ['won', 'perfect', 'lost'].includes(kind) ? 0 : 1.25;
  }
  _celebrate(pair, value, bonus, golden, milestone) {
    if (!this._spots) return;
    const [first, second] = pair.map(index => this._spots[index]), lift = (this._cardSize?.h || 90) * .28;
    const sub = golden ? 'Golden pair!' : this.multiplier > 1 ? `${this.multiplier}× streak` : this.combo === 2 ? '2 in a row' : '';
    this._effect(`cp-pop${golden ? ' is-gold' : this.multiplier > 1 ? ' is-hot' : ''}`, clamp(second.x, 56, this.board.clientWidth - 56), Math.max(26, second.y - lift), this._calm ? .85 : 1.15, `+${value + bonus}`, sub);
    this._sparks(first.x, first.y, golden); this._sparks(second.x, second.y, golden);
    if (golden) this._kick(this.grid, 'is-gold-pulse');
    if (milestone) { this._banner(`${this.combo} in a row!`, `${this.multiplier}× points`, 'streak'); this._kick(this.grid, milestone > 1 ? 'is-pulse-big' : 'is-pulse'); }
  }
  _commiserate(pair, lost) {
    if (lost < 2 || !this._spots) return;
    const spot = this._spots[pair[1]];
    this._effect('cp-pop is-lost', clamp(spot.x, 56, this.board.clientWidth - 56), Math.max(22, spot.y - (this._cardSize?.h || 90) * .28), 1.1, 'Streak lost');
    this._kick(this.streakEl, 'is-out');
  }
  _countdown(second) { if (!this.countEl) return; this.countEl.textContent = String(second); this._kick(this.countEl, 'is-tick'); }
  // A tap that cannot land yet still gets an answer: the card shrugs.
  _nudge(index) {
    const button = this.buttons?.[index];
    if (!button || this._calm || this.previewTime > 0 || this.cards[index].faceUp || button.classList.contains('is-swapping') || button.classList.contains('is-travel')) return;
    this._kick(button, 'is-nudge');
  }
  _finale(won) {
    if (!this.root) return;
    for (const { node } of this._effects.splice(0)) if (this._calm) node.remove();
    if (this.countEl) this.countEl.textContent = '';
    if (won) this._banner(this.perfectGame ? 'Perfect game!' : 'All matched!', this.perfectGame ? 'Not one miss' : `Best streak ${this.bestCombo}`, this.perfectGame ? 'perfect' : 'won');
    else this._banner('Time’s up!', `${this.pairs} of ${this.totalPairs} pairs found`, 'lost');
    // A perfect board showers gold from its corners and its heart.
    if (won && this.perfectGame && this._spots) for (const index of new Set([0, this._cols - 1, this.cards.length >> 1, this.cards.length - this._cols, this.cards.length - 1])) { const spot = this._spots[index]; if (spot) this._sparks(spot.x, spot.y, true); }
  }
  // Two face-down cards cross paths. Each button starts where the other sat.
  _travel(a, b) {
    if (!this._spots || this._calm) return;
    const from = this._spots[a], to = this._spots[b], dx = to.x - from.x, dy = to.y - from.y;
    const bow = (this._cardSize?.w || 80) * .5 / (Math.hypot(dx, dy) || 1);
    // Opposite bows, so the two cards pass side by side instead of through each other.
    for (const [index, sign] of [[a, 1], [b, -1]]) {
      const button = this.buttons[index], style = button.style;
      style.setProperty('--cp-tx', `${(dx * sign).toFixed(1)}px`); style.setProperty('--cp-ty', `${(dy * sign).toFixed(1)}px`);
      style.setProperty('--cp-ax', `${(-dy * bow * sign).toFixed(1)}px`); style.setProperty('--cp-ay', `${(dx * bow * sign).toFixed(1)}px`);
      this._kick(button, 'is-travel');
    }
  }
  _releasePresses() { for (const { card } of this._presses.values()) card.classList.remove('is-pressed'); this._presses.clear(); }

  _focusNext(keepBoardFocus = false) {
    if (!this.container || !this.buttons) return;
    const active = this.container.ownerDocument.activeElement;
    if (!keepBoardFocus && !this.buttons.includes(active)) return;
    this.buttons.find(button => !button.disabled)?.focus({ preventScroll: true });
  }
  _navigate(event) {
    const target = event.target?.closest?.('[data-memory-card]'); if (!target || !this.container.contains(target)) return;
    const index = Number(target.dataset.memoryCard), columns = this._cols || 4;
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
    if (delta === undefined && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault(); let next = event.key === 'Home' ? 0 : event.key === 'End' ? this.cards.length - 1 : (index + delta + this.cards.length) % this.cards.length;
    const direction = delta < 0 || event.key === 'End' ? -1 : 1;
    for (let tries = 0; tries < this.cards.length && this.cards[next].matched; tries++) next = (next + direction + this.cards.length) % this.cards.length;
    if (!this.cards[next].matched) { this._focusIndex = next; this._sync(); this.buttons[next].focus({ preventScroll: true }); }
  }
  destroy() {
    if (this._destroyed) return; this._destroyed = true; this.mode = 'destroyed';
    this._observer?.disconnect(); this._observer = null;
    if (this.container?.removeEventListener) {
      this.container.removeEventListener('click', this._click); this.container.removeEventListener('keydown', this._key);
      this.container.removeEventListener('pointerdown', this._down);
      for (const name of ['pointerup', 'pointercancel', 'pointerleave']) this.container.removeEventListener(name, this._up);
    }
    if (this.container?.dataset) delete this.container.dataset.cpWorld;
    this.container?.classList.remove('memory-game-host'); this.container?.replaceChildren(); this.buttons = null; this.grid = null; this.fx = null; this.root = null; this._effects = [];
  }
}
