/* Original, locally synthesized score and sound effects for Boerne Doodlin’.
 * No audio files and no timers: every note is scheduled on the Web Audio clock
 * from update() and play().
 *
 * Gestures: call unlock() from real user input. It is cheap enough to call on
 * every pointerup / touchend / click / keydown, and it only does work when the
 * sound needs starting or reviving (first tap, after a phone call, lock screen
 * or app switch). Nothing in update(), play(), or setEnabled() creates or
 * resumes an AudioContext.
 *
 * Mix notes: phones cannot reproduce much below 250 Hz, so bass and drums carry
 * harmonics, cues sit between 300 Hz and 3 kHz, and every cue is tuned to the
 * current world's key so effects harmonise with the score.
 */

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
// Five-note ladders (as scale degrees) used for chains: no step can sound sour.
const BRIGHT = [0, 1, 2, 4, 5];
const EARTHY = [0, 2, 3, 4, 6];
const _ = null;

/* Each world is its own little band. Phrases are sixteen steps of scale degrees
 * above the current chord; `order` strings phrases into an eight bar tune.
 * bass / logs / stabs map a step to a degree. echo is [steps, send, feedback].
 */
const THEMES = [
  { // Rogue River: a marimba water-wheel with glittering chimes on top.
    root: 50, scale: MAJOR, ladder: BRIGHT, bpm: 108, swing: .07, chords: [0, 3, 5, 4], color: 3400, level: 1,
    lead: 'wood', octave: 12, hold: .22, gain: 1,
    bass: { 0: 0, 8: 4 }, kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14], snap: 1700,
    arp: { kind: 'chime', notes: [0, 2, 4, 7, 4, 2], octave: 24, every: 1 },
    echo: [3, .14, .28], order: [0, 1, 0, 2, 0, 1, 3, 2],
    phrases: [
      [0, _, 2, _, 4, 2, _, 1, 0, _, 2, 4, _, 1, _, _],
      [2, _, 4, 5, _, 4, _, 2, 1, _, 0, _, 2, _, 0, _],
      [4, _, _, 2, 4, _, 5, 4, 2, _, 0, _, 1, 2, _, _],
      [7, _, 5, 4, _, 2, _, 4, 5, _, 4, 2, _, 0, _, _]
    ]
  },
  { // Redwood Run: a hollow flute over slow log drums, lazy and tall.
    root: 43, scale: MIXOLYDIAN, ladder: BRIGHT, bpm: 96, swing: .15, chords: [0, 6, 3, 0], color: 2800, level: 1,
    lead: 'reed', octave: 24, hold: .4, gain: .62,
    bass: { 0: 0, 10: 4 }, kick: [0, 10], snare: [4, 12], click: 900, hat: [6, 14], snap: 1500,
    logs: { 0: 0, 6: 4, 8: 2, 14: 4 },
    arp: { kind: 'wood', notes: [0, 4, 2, 4, 7, 4], octave: 24, every: 2 },
    echo: [3, .18, .32], order: [0, 1, 0, 2, 0, 1, 3, 2],
    phrases: [
      [0, _, _, 2, 4, _, _, _, 3, _, _, 2, 0, _, _, _],
      [4, _, _, _, 2, _, 0, _, 1, _, 2, _, _, _, _, _],
      [2, _, _, 4, 5, _, _, _, 4, _, _, 2, 3, _, _, _],
      [7, _, _, _, 4, _, _, 5, 4, _, 2, _, 0, _, _, _]
    ]
  },
  { // Painted Canyon: a twanging guitar over a three-three-two desert shuffle.
    root: 45, scale: DORIAN, ladder: EARTHY, bpm: 118, swing: .04, chords: [0, 3, 0, 4], color: 3900, level: 1,
    lead: 'twang', octave: 12, hold: .24, gain: 1.25,
    bass: { 0: 0, 6: 0, 12: 4 }, kick: [0, 6, 12], snare: [4, 12], hat: [2, 10, 14], snap: 1250,
    arp: { kind: 'twang', notes: [7, 4, 2, 4, 7, 9, 7, 4], octave: 24, every: 1 },
    echo: [3, .12, .26], order: [0, 1, 0, 2, 0, 1, 3, 2],
    phrases: [
      [0, _, 4, 2, _, 0, _, 3, 4, _, _, 2, 1, _, 0, _],
      [2, _, 0, _, 4, _, 5, 4, _, 2, _, 1, 0, _, _, _],
      [4, _, 4, _, 5, 4, _, 2, _, 4, _, 2, _, 0, _, _],
      [7, _, 6, 4, _, _, 5, 4, 2, _, _, 0, _, 1, 0, _]
    ]
  },
  { // Starlight Mesa: glass bells with room to ring, soft pads, twinkling stars.
    root: 52, scale: MINOR, ladder: EARTHY, bpm: 88, swing: .02, chords: [0, 5, 3, 4], color: 3000, level: .86,
    lead: 'glass', octave: 12, hold: .95, gain: .9, pads: true, twinkle: true,
    bass: { 0: 0 }, kick: [0], snare: [12], click: 1500, hat: [4, 10], snap: 1500,
    arp: { kind: 'chime', notes: [0, 4, 7, 9, 7, 4], octave: 24, every: 2 },
    echo: [3, .26, .42], order: [0, 1, 0, 2, 0, 1, 3, 2],
    phrases: [
      [0, _, _, _, 4, _, 2, _, _, _, 5, _, 4, _, _, _],
      [2, _, _, 4, _, _, 5, _, 4, _, 2, _, 0, _, _, _],
      [4, _, _, _, _, _, 7, _, 5, _, _, _, 4, _, 2, _],
      [0, _, 2, _, _, _, 4, _, _, _, 2, _, _, _, _, _]
    ]
  },
  { // Boerne Hills: a squeezebox two-step with a banjo roll, bright and homeward.
    root: 48, scale: MAJOR, ladder: BRIGHT, bpm: 120, swing: .12, chords: [0, 3, 4, 0], color: 3700, level: 1,
    lead: 'squeeze', octave: 12, hold: .2, gain: .7,
    bass: { 0: 0, 8: -3 }, kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14], snap: 2100,
    stabs: { 4: 2, 12: 4 },
    arp: { kind: 'twang', notes: [0, 4, 7, 2, 4, 7, 4, 9], octave: 24, every: 1 },
    echo: [3, .12, .26], order: [0, 1, 0, 2, 0, 1, 3, 2],
    phrases: [
      [0, _, 2, 4, _, 2, _, 0, 4, _, 5, _, 4, 2, _, _],
      [2, _, 4, _, 5, _, 4, 2, 0, _, 1, _, 2, _, 0, _],
      [4, 5, 7, _, 5, _, 4, _, 2, _, 4, _, 5, 4, 2, _],
      [7, _, 5, 4, _, 2, 4, _, 2, 1, 0, _, _, _, 0, _]
    ]
  }
];

/* Timbres use at most two oscillators each.
 *   over:    [ratio, level, decay seconds]  a bright partial that dies quickly
 *   fm:      [ratio, start index, end index, portion of the note the glide takes]
 *   vibrato: Hz, a slow wobble that makes sustained leads sing
 *   hold:    sustain the note instead of letting it ring out like a mallet
 */
const TIMBRES = {
  round: {},
  wood: { over: [3, .16, .085] },
  bell: { over: [2.01, .18, .085] },
  chime: { over: [2.76, .28, .3] },
  pluck: { wave: 'triangle', level: .85, over: [2, .08, .085] },
  pad: { wave: 'triangle', attack: .045 },
  glass: { fm: [3.5, 1.5, .12, .5] },
  twang: { fm: [1, 2.8, 1.3, .5], level: .85 },
  bass: { fm: [1, 2.3, .8, .6] },
  thump: { fm: [1, 1.3, .2, .35] },
  reed: { wave: 'reed', attack: .022, hold: true, vibrato: 5.2 },
  squeeze: { wave: 'squeeze', attack: .012, hold: true, vibrato: 5.8 }
};
// Harmonic recipes for createPeriodicWave, with a plain fallback shape.
const WAVES = {
  reed: { partials: [1, .1, .38, .05, .16, .03, .07], fallback: 'triangle' },
  squeeze: { partials: [1, .55, .42, .26, .2, .1, .08, .04], fallback: 'triangle' }
};

// Other names the engines use for a sound that already exists.
const ALIASES = {
  double: 'double-jump', chicken: 'gold', zoom: 'power', won: 'finish', win: 'finish', lose: 'lost',
  dodge: 'near-miss', clean: 'near-miss', crash: 'hit', chest: 'treasure', golden: 'treasure', parcel: 'pickup',
  'final-tick': 'tick', 'timer-low': 'timer-warning', ready: 'section', 'bloom-seed': 'marker', 'critter-back': 'marker',
  'fever-end': 'layer-end', 'gold-rush-end': 'layer-end', 'power-end': 'layer-end', 'trail-fade': 'layer-end',
  streak: 'combo', 'streak-lost': 'chain-lost', paw: 'secret', 'paw-reveal': 'secret-found', 'perfect-game': 'secret-found',
  trail: 'bloom', 'trail-complete': 'convoy'
};
const STACK_TIERS = [2, 5, 10, 20, 30];
const MAX_SOURCES = 48;          // every oscillator or noise player scheduled at once
const LIMITS = { music: 26, effects: 28 };   // effects may push music tails out, never the reverse
const MASTER_LEVEL = 1.15;      // one knob for overall loudness
const EFFECTS_LEVEL = 1.3;
const STALL_SECONDS = 3;       // longer than any speaker (or car Bluetooth) takes to wake
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const number = (n, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const whole = (n, fallback, low, high) => clamp(Math.trunc(number(n, fallback)), low, high);
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
// High notes read as louder (and phone speakers favour them), so ease them back.
const tilt = freq => clamp((620 / freq) ** .3, .5, 1.25);
const audioConstructor = () => globalThis.AudioContext || globalThis.webkitAudioContext;
const noop = () => {};
const YES = Promise.resolve(true), NO = Promise.resolve(false);

/* The little toolbox a cue is written with. Times are seconds after the cue starts. */
class Kit {
  constructor(audio) { this.audio = audio; }
  begin(now, pan, priority) {
    this.now = now; this.at = now + .005; this.pan = pan; this.priority = priority; this.played = false;
    return this;
  }
  deg(degree, octave = 12) { return frequency(this.audio._scaleNote(degree, octave)); }
  rung(step, octave = 12) { return frequency(this.audio._ladderNote(step, octave)); }
  tone(freq, duration, kind = 'wood', gain = .1, delay = 0, end = 0) {
    this.played = this.audio._tone({ freq, duration, kind, gain, end, time: this.at + delay,
      pan: this.pan, group: 'effects', priority: this.priority }) || this.played;
  }
  /** Decoration on top of a cue: the first thing dropped when the mix is busy. */
  extra(freq, duration, kind, gain, delay = 0) {
    const keep = this.priority;
    this.priority = 1;
    this.tone(freq, duration, kind, gain, delay);
    this.priority = keep;
  }
  run(degrees, gap = .065, duration = .19, kind = 'wood', gain = .1, delay = 0, octave = 12) {
    for (let i = 0; i < degrees.length; i++) this.tone(this.deg(degrees[i], octave), duration, kind, gain, delay + i * gap);
  }
  air(duration, cutoff, gain = .045, delay = 0, end = 0, q = .65, attack = .003) {
    this.played = this.audio._noiseHit({ duration, cutoff, gain, end, q, attack, time: this.at + delay,
      pan: this.pan, group: 'effects', priority: this.priority }) || this.played;
  }
  duck(seconds) { this.audio._duckUntil = Math.max(this.audio._duckUntil, this.now + seconds); }
  layer() { this.audio._layerAt = this.now; }
}

const cue = (gap, priority, make, extra) => ({ gap, priority, make, ...extra });
const chainOf = d => whole(d.chain, 1, 1, 12);
const goSound = k => {
  k.run([7, 11, 14], 0, .42, 'bell', .05);
  k.tone(k.deg(0, 0), .4, 'bass', .07);
  k.air(.2, 1800, .04, 0, 5200, .7);
  k.duck(.3);
};
const tierOf = d => {
  const value = number(d.level) || number(d.total) || number(d.tier) || number(d.totalMultiplier) || 2;
  let tier = STACK_TIERS[0];
  for (const step of STACK_TIERS) if (value >= step) tier = step;
  return tier;
};

/* name: cue(minimum gap in seconds, priority, maker). When the mix is full a cue
 * may take the place of a lesser one: 4 is the thumb's own action (jump, card
 * flip), 3 is what that action hit, 2 is a flourish, 1 is decoration and the
 * first to go. `family` shares one rate limit between related cues and `rank`
 * lets a bigger moment through inside that window. Notes are written as scale
 * degrees (deg) or ladder steps (rung) so every cue is in the world's key.
 */
const CUES = {
  // Moving about.
  jump: cue(.09, 4, k => k.tone(310, .115, 'round', .11, 0, 640)),
  'double-jump': cue(.09, 4, k => { k.tone(440, .14, 'round', .11, 0, 880); k.tone(1100, .08, 'wood', .04, .035); }),
  slide: cue(.18, 2, k => { k.air(.14, 1500, .045, 0, 700); k.tone(190, .1, 'bass', .06, 0, 110); }),
  land: cue(.12, 1, (k, d) => {
    const force = clamp(Math.abs(number(d.speed, 480)) / 950, 0, 1);
    if (force < .1) return;
    k.tone(165, .07, 'bass', .018 + .05 * force, 0, 80);
    k.air(.03 + .03 * force, 560, .005 + .015 * force);
  }),
  landing: cue(.2, 2, k => { k.tone(190, .12, 'bass', .1, 0, 70); k.air(.07, 620, .045); k.tone(260, .06, 'round', .05, .1, 200); }),
  spring: cue(.16, 2, k => { k.tone(150, .22, 'pluck', .115, 0, 720); k.tone(430, .13, 'wood', .055, .11, 590); }),
  ramp: cue(.25, 2, k => { k.air(.3, 600, .05, 0, 3000, .8, .06); k.tone(200, .28, 'pluck', .08, 0, 640); }),
  vent: cue(.3, 2, k => { k.air(.45, 420, .07, 0, 2600, .9, .09); k.tone(180, .4, 'round', .04, 0, 540); }),
  splash: cue(.2, 2, k => {
    k.air(.22, 2600, .075, 0, 700, .5);
    k.tone(880, .05, 'round', .045, .06, 1500);
    k.tone(1250, .045, 'round', .03, .13, 1900);
  }),
  crumble: cue(.22, 2, k => {
    k.air(.06, 420, .07); k.air(.07, 330, .06, .07); k.air(.1, 250, .055, .15);
    k.tone(150, .16, 'bass', .06, .02, 70);
  }),
  respawn: cue(.5, 2, k => {
    k.air(.26, 700, .025, 0, 2400, .8, .08);
    k.tone(k.deg(0), .2, 'bell', .06, .06);
    k.tone(k.deg(4), .28, 'bell', .06, .16);
  }),
  step: cue(.11, 1, k => k.tone(330, .03, 'wood', .022)),
  // Holding a direction against a wall repeats this, so it is rare and soft.
  bump: cue(.45, 1, k => { k.tone(190, .05, 'bass', .04, 0, 130); k.air(.02, 700, .012); }),
  bounce: cue(.09, 1, k => k.tone(230, .1, 'pluck', .06, 0, 470)),

  // Treats, chains and stomps.
  collect: cue(.045, 2, (k, d) => {
    const chain = k.audio._chain(d, k.now), step = k.audio._chainRung(chain);
    k.tone(k.rung(step), .13, 'wood', .108 - step * .002);
    const total = number(d.totalMultiplier, number(d.multiplier, 1));
    // A glint on top grows as the whole bonus stack does.
    if (total >= 4) k.extra(k.rung(step + 5), .1, 'chime', Math.min(.05, .01 + .011 * Math.log2(total)), .012);
  }),
  gold: cue(.11, 2, (k, d) => {
    const lift = whole(d.multiplier, 1, 1, 5) - 1;
    k.tone(k.rung(lift + 7), .07, 'bell', .11);
    k.tone(k.rung(lift + 10), .26, 'bell', .12, .06);
    k.extra(k.rung(lift + 12), .2, 'chime', .045, .11);
  }),
  key: cue(.2, 2, (k, d) => {
    const have = whole(d.keys, 1, 1, 6), lift = Math.min(3, have - 1) * 2;
    k.air(.05, 6200, .022);
    k.run([4 + lift, 7 + lift, 9 + lift], .05, .2, 'bell', .1);
    // The last key resolves with a held note.
    if (have >= number(d.requiredKeys, 99)) k.tone(k.deg(14), .4, 'chime', .05, .17);
  }),
  stomp: cue(.07, 3, (k, d) => {
    const chain = chainOf(d);
    k.tone(300, .09, 'round', .12, 0, 115);
    k.air(.04, 900, .04);
    k.tone(k.rung(chain + 1), .13, 'wood', .095, .02);
    if (chain >= 3) k.extra(k.rung(chain + 3), .16, 'chime', .045, .07);
    if (chain >= 5) k.extra(k.rung(chain + 5), .2, 'chime', .04, .12);
  }, { rank: chainOf }),
  smash: cue(.1, 3, k => { k.air(.11, 650, .08); k.tone(210, .17, 'bass', .13, 0, 58); k.tone(k.deg(7), .16, 'bell', .06, .03); }),
  pop: cue(.05, 3, (k, d) => {
    const chain = chainOf(d), pitch = k.rung(chain - 1);
    k.air(.018, 3200, .05);
    k.tone(pitch, .07, 'round', .11, 0, pitch * 1.85);
    if (chain >= 4) k.extra(k.rung(chain + 2), .12, 'chime', .035, .04);
  }, { rank: chainOf }),
  block: cue(.08, 2, k => { k.tone(250, .06, 'round', .1, 0, 170); k.tone(k.deg(4), .1, 'wood', .07, .03); }),
  miss: cue(.12, 1, k => k.tone(330, .1, 'round', .05, 0, 180)),
  fizzle: cue(.12, 1, k => k.air(.1, 1800, .03, 0, 700)),
  'chain-lost': cue(.8, 2, k => {
    k.tone(k.deg(4), .3, 'round', .07, 0, k.deg(0));
    k.tone(k.deg(0), .22, 'wood', .045, .2);
    k.audio._streak = 0;
  }),

  // Bonus layers and the stack.
  combo: cue(.4, 2, (k, d) => {
    const lift = whole(d.multiplier, 2, 1, 5) - 2;
    k.run([lift, lift + 2, lift + 4], .06, .17, 'pluck', .095);
  }, { family: 'stack', rank: d => whole(d.multiplier, 2, 1, 5) }),
  stack: cue(.5, 2, (k, d) => {
    const tier = tierOf(d);
    // Follow a layer cue (frenzy, gold rush, power) instead of landing on top of it.
    const wait = k.now - k.audio._layerAt < .12 ? .2 : 0;
    if (tier <= 2) k.run([0, 4], .07, .16, 'pluck', .07, wait);
    else if (tier <= 5) k.run([0, 2, 4, 7], .06, .18, 'pluck', .085, wait);
    else if (tier <= 10) {
      k.run([0, 4, 7, 9], .065, .22, 'bell', .09, wait);
      k.air(.25, 900, .025, wait, 3200, .8, .08);
      k.duck(.3);
    } else if (tier <= 20) {
      k.run([0, 4, 7, 9, 11, 14], .055, .24, 'bell', .09, wait);
      k.tone(k.deg(0, 0), .4, 'bass', .09, wait);
      k.duck(.45);
    } else {
      // Thirty times: three pick-up notes, a held chord, then stars.
      k.run([0, 2, 4], .1, .14, 'pluck', .1, wait);
      k.tone(k.deg(7), .75, 'bell', .1, wait + .3);
      k.tone(k.deg(9), .7, 'bell', .06, wait + .3);
      k.tone(k.deg(4), .6, 'pluck', .055, wait + .3);
      k.tone(k.deg(0, 0), .6, 'bass', .1, wait + .3);
      k.extra(k.deg(11), .3, 'chime', .045, wait + .52);
      k.extra(k.deg(14), .4, 'chime', .045, wait + .62);
      k.duck(.95);
    }
  }, { family: 'stack', rank: tierOf }),
  'mega-stack': cue(1, 2, k => { k.run([2, 5, 9], .085, .24, 'pluck', .09); k.duck(.35); }),
  charged: cue(.6, 2, k => { k.run([0, 2, 4, 7], .075, .24, 'bell', .085); k.extra(k.deg(11), .25, 'chime', .03, .3); k.duck(.35); }),
  power: cue(.5, 2, k => {
    k.run([0, 2, 4, 7, 9], .055, .25, 'pluck', .09);
    k.air(.22, 900, .04, 0, 3800, .8, .06);
    k.tone(k.deg(0, 0), .3, 'bass', .08);
    k.duck(.32); k.layer();
  }),
  fever: cue(.8, 2, k => {
    k.run([0, 2, 4, 5, 7], .05, .2, 'pluck', .09);
    k.air(.3, 900, .035, 0, 3600, .8, .12);
    k.duck(.3); k.layer();
  }),
  'gold-rush': cue(.8, 2, k => {
    k.run([7, 4, 9, 7, 11], .055, .26, 'bell', .075);
    k.tone(k.deg(14), .3, 'chime', .04, .28);
    k.duck(.3); k.layer();
  }),
  'layer-end': cue(.5, 1, k => { k.tone(k.deg(4), .12, 'round', .035); k.tone(k.deg(2), .18, 'round', .035, .1); }),

  // Trouble and protection.
  hit: cue(.35, 3, k => {
    k.tone(210, .18, 'bass', .11, 0, 68);
    k.tone(330, .09, 'round', .06, 0, 170);
    k.air(.09, 780, .06);
    k.duck(.35);
  }),
  shield: cue(.2, 2, k => { k.run([7, 4, 7], .045, .19, 'bell', .075); k.air(.045, 2300, .025); }),
  heal: cue(.3, 2, k => { k.run([0, 2, 4], .08, .26, 'bell', .07); k.tone(k.deg(0, 0), .4, 'pad', .045); }),
  'near-miss': cue(.12, 2, k => { k.air(.11, 2600, .04, 0, 1100, 1.2); k.tone(560, .07, 'round', .045, 0, 840); }),
  pickup: cue(.15, 2, (k, d) => {
    if (d.kind === 'magnet') { k.tone(440, .12, 'round', .08, 0, 880); k.tone(660, .14, 'round', .06, .07, 1320); }
    else if (d.kind === 'shield') { k.run([0, 4, 7], .05, .22, 'bell', .075); k.air(.05, 2400, .02); }
    else if (d.kind === 'star') k.run([4, 7, 11, 14], .045, .2, 'chime', .05);
    else k.run([2, 7], .06, .16, 'pluck', .09);
  }),

  // Finds and goals.
  'secret-found': cue(.4, 2, k => k.run([4, 7, 9, 11, 14], .045, .2, 'chime', .06)),
  secret: cue(.4, 2, k => { k.run([0, 4, 7, 9], .07, .24, 'bell', .08); k.tone(k.deg(14), .3, 'chime', .04, .3); k.duck(.3); }),
  treasure: cue(.3, 2, (k, d) => {
    k.air(.045, 340, .06);
    k.tone(170, .08, 'bass', .08, 0, 100);
    k.run([0, 2, 4, 7], .06, .22, 'bell', .08, .06);
    k.extra(k.deg(d.secret ? 14 : 11), .3, 'chime', .045, .32);
    k.duck(.3);
  }),
  deliver: cue(.5, 2, k => {
    k.run([0, 4, 7], .09, .3, 'bell', .085);
    k.tone(k.deg(0, 0), .5, 'pad', .06, .18);
    k.tone(k.deg(9), .32, 'chime', .04, .3);
    k.duck(.4);
  }),
  checkpoint: cue(.5, 2, k => { k.run([0, 4], .1, .3, 'bell', .08); k.tone(k.deg(0, 0), .5, 'pad', .05); }),
  marker: cue(.3, 1, k => { k.tone(k.deg(4), .09, 'wood', .05); k.tone(k.deg(7), .12, 'chime', .025, .05); }),
  mission: cue(.4, 2, k => k.run([4, 2, 7], .09, .25, 'wood', .1)),
  'boss-defeated': cue(1, 2, k => {
    k.tone(170, .2, 'bass', .12, 0, 60);
    k.run([0, 4, 7, 9], .085, .3, 'bell', .09, .05);
    k.tone(k.deg(11), .5, 'bell', .08, .42);
    k.tone(k.deg(7), .5, 'pluck', .05, .42);
    k.duck(.7);
  }),
  finish: cue(1.3, 3, k => {
    k.run([0, 2, 4, 7, 4, 7], .1, .34, 'wood', .11);
    k.tone(k.deg(0, 0), .48, 'bass', .08, .3);
    k.extra(k.deg(9), .5, 'chime', .04, .6);
    k.duck(1);
  }),
  'finish-line': cue(1, 2, k => { k.air(.3, 1200, .04, 0, 4200, .8, .1); k.run([7, 9, 11], .06, .28, 'chime', .05, .1); }),
  lost: cue(1.2, 3, k => { k.run([4, 2, 0], .15, .3, 'wood', .085); k.duck(.8); }),

  // Trail Scout company.
  greet: cue(.6, 2, k => { k.tone(k.deg(4), .1, 'bell', .07); k.tone(k.deg(7), .18, 'bell', .07, .1); k.extra(k.deg(9), .2, 'chime', .03, .2); }),
  walk: cue(.15, 1, k => k.tone(k.deg(7), .035, 'wood', .035)),
  critter: cue(.2, 2, (k, d) => {
    const count = whole(d.count, 1, 1, 8);
    k.air(.05, 5000, .012);
    k.tone(k.rung(count + 6), .06, 'chime', .07);
    k.tone(k.rung(count + 8), .16, 'chime', .07, .06);
  }, { rank: d => whole(d.count, 1, 1, 8) }),
  locked: cue(.4, 2, k => { k.tone(k.deg(1), .07, 'wood', .07); k.tone(k.deg(0), .1, 'wood', .07, .1); }),
  dialog: cue(.3, 1, k => { k.tone(k.deg(4), .05, 'pluck', .05); k.tone(k.deg(2), .07, 'pluck', .05, .06); }),
  hint: cue(.4, 1, k => k.run([2, 4, 7], .07, .2, 'chime', .04)),

  // Timers and starts.
  countdown: cue(.3, 3, (k, d) => {
    if (d.count === 'go' || number(d.count, 1) <= 0) return goSound(k);
    k.tone(k.deg(7), .12, 'wood', .1);
    k.tone(k.deg(7, 0), .12, 'round', .05);
  }),
  go: cue(.5, 3, goSound),
  tick: cue(.09, 2, (k, d) => {
    const left = number(d.remaining, number(d.seconds, 9));
    k.tone(k.deg(left <= 3 ? 11 : 7), .045, 'wood', left <= 3 ? .12 : .09);
  }),
  'timer-warning': cue(1, 2, k => { k.tone(k.deg(7), .05, 'wood', .07); k.tone(k.deg(4), .07, 'wood', .07, .13); }),
  'final-push': cue(2, 2, k => { k.run([4, 5, 6, 7], .06, .16, 'pluck', .08); k.air(.3, 1200, .03, 0, 4000, .8, .1); }),
  finale: cue(2, 2, k => { k.air(.4, 700, .04, 0, 4200, .8, .16); k.run([0, 4, 7, 11], .09, .3, 'bell', .07, .1); k.duck(.5); }),
  section: cue(1, 1, k => k.run([4, 7], .08, .2, 'wood', .05)),

  // Camp Pairs.
  flip: cue(.05, 4, k => { k.air(.035, 2600, .05); k.tone(520, .05, 'round', .06, 0, 720); }),
  match: cue(.15, 2, (k, d) => {
    const streak = whole(d.streak, number(d.combo, 1), 1, 9), step = Math.min(8, streak - 1);
    k.tone(k.rung(step + 2), .12, 'bell', .09);
    k.tone(k.rung(step + 4), .24, 'bell', .09, .09);
    if (streak >= 3) k.tone(k.rung(step + 7), .2, 'chime', .04, .17);
    if (d.perfect) k.run([11, 14], .06, .28, 'chime', .04, .26);
  }),
  mismatch: cue(.2, 2, k => { k.tone(k.deg(2), .12, 'round', .07); k.tone(k.deg(1), .2, 'round', .07, .12); }),
  peek: cue(.4, 2, k => { k.run([4, 7, 9, 7], .05, .2, 'chime', .045); k.air(.2, 2600, .015, 0, 5200, .8, .08); }),

  deal: cue(1, 2, k => {
    for (let card = 0; card < 5; card++) k.air(.025, 2400 + card * 260, .03, card * .055);
    k.tone(k.deg(7), .12, 'wood', .05, .3);
  }),
  swap: cue(.4, 2, k => {
    k.tone(k.deg(4), .16, 'round', .05, 0, k.deg(7));
    k.tone(k.deg(7), .16, 'round', .05, 0, k.deg(4));
    k.air(.14, 1800, .02, 0, 3000, .8, .04);
  }),
  'time-up': cue(1, 2, k => k.run([7, 4], .18, .34, 'bell', .08)),

  // RV Rally and Snack Storm extras.
  boost: cue(.5, 2, k => {
    k.air(.45, 320, .075, 0, 2400, .8, .1);
    k.tone(140, .42, 'twang', .07, 0, 420);
    k.tone(k.deg(7), .2, 'chime', .035, .32);
    k.duck(.25);
  }),
  'steer-skid': cue(.25, 1, k => k.air(.16, 2100, .035, 0, 1700, 6, .02)),
  'convoy-start': cue(.6, 2, k => { k.tone(k.deg(7), .07, 'wood', .07); k.tone(k.deg(7), .1, 'wood', .07, .11); }),
  convoy: cue(.5, 2, k => k.run([0, 2, 4, 7], .05, .2, 'pluck', .085)),
  bloom: cue(.3, 2, k => { k.run([0, 2, 4], .018, .32, 'chime', .045, 0, 24); k.air(.12, 3600, .015); }),
  comet: cue(.5, 2, k => { k.air(.35, 4200, .035, 0, 900, 1, .04); k.tone(k.deg(14), .3, 'chime', .035, 0, k.deg(7)); }),
  gust: cue(1, 1, k => k.air(.6, 500, .035, 0, 1300, .9, .25)),

  // Menus and the result screen.
  click: cue(.045, 2, k => k.tone(590, .045, 'wood', .055)),
  'ui-open': cue(.12, 2, k => { k.tone(k.deg(4), .06, 'wood', .05); k.tone(k.deg(7), .1, 'wood', .05, .05); }),
  'ui-close': cue(.12, 2, k => { k.tone(k.deg(7), .06, 'wood', .045); k.tone(k.deg(4), .1, 'wood', .045, .05); }),
  upgrade: cue(.3, 2, k => k.run([0, 2, 4, 7], .065, .22, 'pluck', .095)),
  unlock: cue(.5, 2, k => k.run([0, 4, 2, 5, 4, 7], .07, .26, 'bell', .085)),
  medal: cue(.18, 3, (k, d) => {
    const index = whole(d.index, 1, 1, 3);
    k.tone(190, .1, 'bass', .12, 0, 85);
    k.air(.03, 1800, .05);
    k.tone(k.deg([0, 2, 4][index - 1], 24), .32, 'bell', .08, .02);
    if (index === 3) k.run([7, 11], .07, .34, 'chime', .045, .1, 24);
  }, { rank: d => whole(d.index, 1, 1, 3) }),
  'count-up': cue(.04, 1, k => {
    const audio = k.audio;
    audio._tally = k.now - audio._tallyAt > .5 ? 0 : Math.min(36, audio._tally + 1);
    audio._tallyAt = k.now;
    k.tone(700 * 2 ** (audio._tally / 36), .03, 'wood', .045);
  })
};

/** Small gesture-safe audio director. `enabled` is the accepted sound preference;
 * unlock() resolves to whether audio is actually running. Call update() per frame.
 */
export class GameAudio {
  /** Every cue name play() understands, including the older aliases. */
  static get cues() { return [...new Set([...Object.keys(CUES), ...Object.keys(ALIASES)])].sort(); }

  constructor({ enabled = false } = {}) {
    this.enabled = Boolean(enabled && audioConstructor());
    this.scene = 'menu';
    this.theme = 0;
    this._ctx = null;
    this._master = null;
    this._music = null;
    this._effects = null;
    this._filter = null;
    this._echo = null;
    this._outputNodes = [];
    this._pans = new Map();
    this._waves = new Map();
    this._noise = null;
    this._silence = null;
    this._voices = new Set();
    this._lastCue = new Map();
    this._kit = new Kit(this);
    this._destroyed = false;
    this._paused = false;
    this._epoch = 0;
    this._step = 0;
    this._nextStep = 0;
    this._musicPlaying = false;
    this._speed = 1;
    this._combo = 0;
    this._power = 0;
    this._intensity = 0;
    this._duckUntil = 0;
    this._musicLevel = -1;
    this._brightness = 0;
    this._layerAt = -Infinity;
    this._streak = 0;
    this._streakAt = -Infinity;
    this._tally = 0;
    this._tallyAt = -Infinity;
    this._noiseTurn = 0;
    this._clock = -1;
    this._still = 0;
    this._steady = 0;
    this._stalled = false;
    this._revivals = 0;
    this._onVisibility = () => {
      if (globalThis.document?.hidden) this.suspend();
    };
    globalThis.document?.addEventListener?.('visibilitychange', this._onVisibility);
  }

  /** True while sound can actually be heard (enabled, unlocked, not paused). */
  get unlocked() { return this._audible(); }

  /** The smoothed 0..1 excitement the score is currently following. */
  get intensity() { return this._intensity; }

  /** Whether play(name) has a sound for this name. */
  has(name) { return typeof name === 'string' && Object.hasOwn(CUES, ALIASES[name] || name); }

  /** Call from real user input: pointerup, touchend, click or keydown. A touch
   * pointerdown is not an activating gesture on iPhone, so calling from it is
   * harmless but may not start anything. Repeated calls are cheap. Also revives
   * a context that the phone left suspended, interrupted, or running but frozen.
   * Always resolves (never rejects) to whether audio is running.
   */
  unlock() {
    if (this._destroyed || !this.enabled || globalThis.document?.hidden) return NO;
    // UserActivation is not present in every supported browser. Where available,
    // it also protects callers that accidentally invoke unlock from a render loop.
    if (globalThis.navigator?.userActivation?.isActive === false) return this._audible() ? YES : NO;
    if (this._audible() && !this._stalled) return YES;
    const epoch = this._epoch;
    try {
      let nudge = false;
      if (this._stalled && this._ctx?.state === 'running') {
        // Running on paper but the clock is frozen (seen after iOS interruptions).
        // First nudge it with suspend/resume; if that fails, build a fresh context.
        this._stalled = false;
        this._still = 0;
        this._revivals++;
        if (this._revivals > 3) return YES;
        if (this._revivals === 1) nudge = true;
        else this._dropContext();
      }
      if (!this._ctx || this._ctx.state === 'closed') this._createContext();
      if (!this._ctx) return NO;
      const ctx = this._ctx;
      this._paused = false;
      this._still = 0;
      this._resetTransport();
      if (nudge) { try { Promise.resolve(ctx.suspend()).catch(noop); } catch {} }
      // Always request resume here: it also orders correctly after a pending
      // suspend caused by a very fast off/on toggle. The call stays in the gesture.
      const resumed = ctx.resume();
      this._prime(ctx);
      if (ctx.state === 'running') this._openMaster();
      return Promise.resolve(resumed).then(() => {
        if (epoch !== this._epoch || ctx !== this._ctx || !this._audible()) return false;
        this._openMaster();
        return true;
      }, () => false);
    } catch {
      // A partially constructed graph is unusable. Release it so a later real
      // gesture can retry cleanly (for example after a mobile audio interruption).
      this._dropContext();
      return NO;
    }
  }

  /** Returns the accepted preference; enabling does not start browser audio. */
  setEnabled(enabled) {
    const next = Boolean(enabled && !this._destroyed && audioConstructor());
    if (next === this.enabled) return this.enabled;
    this.enabled = next;
    ++this._epoch;
    if (!next) this.suspend();
    return this.enabled;
  }

  setScene(scene = 'menu', theme = 0) {
    const nextScene = ['menu', 'run', 'result'].includes(scene) ? scene : 'menu';
    const nextTheme = clamp(Math.trunc(number(theme)), 0, THEMES.length - 1);
    if (this.scene === nextScene && this.theme === nextTheme) return;
    this.scene = nextScene;
    this.theme = nextTheme;
    this._fadeVoices('music');
    this._resetTransport();
    this._intensity = 0;
    this._tuneSpace();
  }

  /** Short cues are discarded while muted/paused; none are buffered for later. */
  play(name, detail = {}) {
    if (!this._audible()) return false;
    detail = detail && typeof detail === 'object' ? detail : {};
    name = ALIASES[name] || name;
    if (name === 'jump' && detail.double) name = 'double-jump';
    if (name === 'collect') {
      if (detail.kind === 'pair') return false;           // Camp Pairs already plays 'match'
      if (detail.kind === 'key') name = 'key';
      else if (detail.gold || detail.chicken || detail.kind === 'gold' || detail.kind === 'chicken') name = 'gold';
    }
    if (!Object.hasOwn(CUES, name)) return false;
    const entry = CUES[name], now = this._ctx.currentTime;
    const family = entry.family || name, rank = entry.rank ? entry.rank(detail) : 0;
    const last = this._lastCue.get(family);
    if (last && now - last.time < entry.gap && !(rank > last.rank)) return false;
    this._lastCue.set(family, { time: now, rank });
    this._pruneVoices(now);
    const side = number(detail.side) ? clamp(number(detail.side), -1, 1) * .35 : 0;
    const kit = this._kit.begin(now, clamp(number(detail.pan, side), -.5, .5), entry.priority);
    entry.make(kit, detail);
    return kit.played;
  }

  /** speed is a ratio (1 = normal), combo is the current chain count, intensity
   * is 0..1 (how tall the bonus stack is; 1 at thirty times) and stack is the raw
   * multiplier, used when intensity is not given. The score adds players as
   * intensity rises and lets them go a moment after it falls.
   * A non-running run scene is silent; menu/result have their own softer score.
   */
  update(dt, { speed = 1, combo = 0, power = false, running = false, intensity, stack } = {}) {
    if (!this._audible()) return;
    const now = this._ctx.currentTime;
    const frame = clamp(number(dt, 1 / 60), 0, .1);
    // Watch for a context that says it is running while its clock stands still.
    if (now === this._clock) {
      this._still += frame;
      if (this._still > STALL_SECONDS) { this._stalled = true; this._steady = 0; }
    } else {
      this._clock = now;
      this._still = 0;
      this._stalled = false;
      this._steady += frame;
      if (this._steady > 3) this._revivals = 0;
    }
    this._pruneVoices(now);
    const blend = 1 - Math.exp(-frame * 5);
    this._speed += (clamp(number(speed, 1), .6, 2.4) - this._speed) * blend;
    this._combo = clamp(number(combo), 0, 10000);
    this._power += ((power ? 1 : 0) - this._power) * blend;
    const shouldPlay = this.scene !== 'run' || Boolean(running);
    const wanted = !shouldPlay || this.scene !== 'run' ? 0
      : Number.isFinite(intensity) ? clamp(intensity, 0, 1)
      : Number.isFinite(stack) ? clamp(Math.log(Math.max(1, stack)) / Math.log(30), 0, 1)
      : clamp(Math.max(this._combo / 24, power ? .5 : 0), 0, 1);
    // Layers arrive quickly and take their time leaving.
    this._intensity += (wanted - this._intensity) * (1 - Math.exp(-frame * (wanted > this._intensity ? 4 : 1.1)));
    if (!shouldPlay) {
      if (this._musicPlaying) this._fadeVoices('music');
      this._musicPlaying = false;
      this._nextStep = 0;
      return;
    }
    this._musicPlaying = true;
    const theme = THEMES[this.theme];
    const lift = this._intensity;
    const sceneLevel = this.scene === 'run' ? .72 + .24 * lift : this.scene === 'menu' ? .6 : .5;
    const level = sceneLevel * theme.level * (now < this._duckUntil ? .42 : 1);
    if (Math.abs(level - this._musicLevel) > .005) {
      this._musicLevel = level;
      try { this._music.gain.setTargetAtTime(level, now, .045); } catch {}
    }
    const brightness = theme.color * (1 + .9 * lift);
    if (Math.abs(brightness - this._brightness) > this._brightness * .04) {
      this._brightness = brightness;
      try { this._filter.frequency.setTargetAtTime(brightness, now, .12); } catch {}
    }
    // Audio-clock scheduling tolerates normal frame jitter. Long frame gaps drop
    // missed notes rather than catching up in an unpleasant burst.
    if (!this._nextStep || this._nextStep < now - .06) this._nextStep = now + .025;
    // A run plays at adventure pace: quicker than camp, and quicker again as the stack climbs.
    const pace = this.scene === 'run' ? 1.13 + (this._speed - 1) * .075 + this._power * .05 + lift * .09
      : this.scene === 'menu' ? .76 : .68;
    const sixteenth = 60 / (theme.bpm * pace) / 4;
    let scheduled = 0;
    while (this._nextStep < now + .105 && scheduled < 3) {
      this._musicStep(this._step, this._nextStep);
      this._nextStep += sixteenth * (this._step % 2 === 0 ? 1 + theme.swing : 1 - theme.swing);
      this._step = (this._step + 1) % 256;
      scheduled++;
    }
  }

  /** Silence and clear all pending notes. Resume only through unlock(). */
  suspend() {
    this._paused = true;
    ++this._epoch;
    this._stopVoices();
    this._resetTransport();
    this._lastCue.clear();
    this._streak = 0;
    this._still = 0;
    this._stalled = false;
    if (!this._ctx || this._ctx.state === 'closed') return;
    try {
      this._master.gain.cancelScheduledValues(this._ctx.currentTime);
      this._master.gain.setValueAtTime(0, this._ctx.currentTime);
      Promise.resolve(this._ctx.suspend()).catch(noop);
    } catch {}
  }

  destroy() {
    if (this._destroyed) return;
    this.suspend();
    this._destroyed = true;
    this.enabled = false;
    globalThis.document?.removeEventListener?.('visibilitychange', this._onVisibility);
    this._dropContext();
  }

  _audible() {
    return this.enabled && !this._destroyed && !this._paused && this._ctx?.state === 'running';
  }

  /** Releases the whole graph. A later gesture can build a clean one. */
  _dropContext() {
    this._stopVoices();
    const ctx = this._ctx;
    this._ctx = null;
    for (const node of this._outputNodes) { try { node.disconnect(); } catch {} }
    this._outputNodes = [];
    this._pans.clear();
    this._waves.clear();
    this._noise = this._silence = this._master = this._music = this._effects = this._filter = this._echo = null;
    if (ctx) {
      ctx.onstatechange = null;
      try { Promise.resolve(ctx.close()).catch(noop); } catch {}
    }
  }

  _createContext() {
    const Context = audioConstructor();
    if (!Context) { this.enabled = false; return; }
    this._dropContext();
    this._lastCue.clear();
    const ctx = new Context({ latencyHint: 'interactive' });
    this._ctx = ctx;
    const keep = node => { this._outputNodes.push(node); return node; };
    this._master = keep(ctx.createGain());
    this._master.gain.value = 0;
    this._music = keep(ctx.createGain());
    this._music.gain.value = 0;
    this._effects = keep(ctx.createGain());
    this._effects.gain.value = EFFECTS_LEVEL;
    this._filter = keep(ctx.createBiquadFilter());
    this._filter.type = 'lowpass';
    this._filter.frequency.value = THEMES[this.theme].color;
    this._filter.Q.value = .45;
    this._music.connect(this._filter);
    this._filter.connect(this._master);
    this._effects.connect(this._master);
    if (typeof ctx.createDelay === 'function') {
      // One shared echo gives bells and sparkles some air. Only the upper part
      // of the mix is sent to it so drums and bass stay tight.
      const input = keep(ctx.createBiquadFilter()), delay = keep(ctx.createDelay(1)), damp = keep(ctx.createBiquadFilter());
      const feedback = keep(ctx.createGain()), wet = keep(ctx.createGain());
      const musicSend = keep(ctx.createGain()), effectsSend = keep(ctx.createGain());
      input.type = 'highpass'; input.frequency.value = 480; input.Q.value = .5;
      damp.type = 'lowpass'; damp.frequency.value = 2600; damp.Q.value = .4;
      effectsSend.gain.value = .09;
      musicSend.gain.value = 0;
      feedback.gain.value = 0;
      this._filter.connect(musicSend); musicSend.connect(input);
      this._effects.connect(effectsSend); effectsSend.connect(input);
      input.connect(delay); delay.connect(damp); damp.connect(feedback); feedback.connect(delay);
      damp.connect(wet); wet.connect(this._master);
      this._echo = { delay, feedback, wet, musicSend, level: 0 };
    }
    // Rumble below what small speakers can play only eats headroom, so trim it.
    const trim = keep(ctx.createBiquadFilter());
    trim.type = 'highpass';
    trim.frequency.value = 105;
    trim.Q.value = .7;
    this._master.connect(trim);
    if (typeof ctx.createDynamicsCompressor === 'function') {
      // A firm ceiling: the mix can be loud enough for a car without clipping.
      const compressor = keep(ctx.createDynamicsCompressor());
      compressor.threshold.value = -15;
      compressor.knee.value = 10;
      compressor.ratio.value = 12;
      compressor.attack.value = .003;
      compressor.release.value = .14;
      trim.connect(compressor);
      compressor.connect(ctx.destination);
    } else {
      trim.connect(ctx.destination);
    }
    this._silence = ctx.createBuffer(1, 1, ctx.sampleRate);
    this._noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate), ctx.sampleRate);
    const noise = this._noise.getChannelData(0);
    let seed = 93247;
    for (let i = 0; i < noise.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      noise[i] = (seed / 2147483648) * .7;
    }
    this._clock = -1;
    this._still = 0;
    this._stalled = false;
    this._tuneSpace();
    ctx.onstatechange = () => {
      if (ctx !== this._ctx || this._destroyed) return;
      this._nextStep = 0;
      if (ctx.state !== 'running') this._stopVoices();
      else if (this.enabled && !this._paused) this._openMaster();
      // The phone can restart audio by itself after an interruption. If the game
      // is paused or muted, put it back to sleep rather than idle in silence.
      else { try { Promise.resolve(ctx.suspend()).catch(noop); } catch {} }
    };
  }

  /** Older iPhones only open the output when a source starts inside the gesture. */
  _prime(ctx) {
    let source = null;
    try {
      const now = ctx.currentTime;
      source = ctx.createBufferSource();
      source.buffer = this._silence;
      source.connect(ctx.destination);
      source.start(now);
      source.stop(now + .03);
      this._trackVoice({ nodes: [source], sources: [source], group: 'system', priority: 9, start: now, end: now + .05 });
    } catch {
      try { source?.disconnect(); } catch {}
    }
  }

  _openMaster() {
    if (!this._audible()) return;
    const now = this._ctx.currentTime;
    try {
      this._master.gain.cancelScheduledValues(now);
      this._master.gain.setTargetAtTime(MASTER_LEVEL, now, .018);
      if (this._echo) {
        // Let anything left in the echo from before a pause drain away unheard.
        const { feedback, wet, level } = this._echo;
        feedback.gain.cancelScheduledValues(now); wet.gain.cancelScheduledValues(now);
        feedback.gain.setValueAtTime(0, now); wet.gain.setValueAtTime(0, now);
        feedback.gain.setValueAtTime(level, now + .4); wet.gain.setValueAtTime(1, now + .4);
      }
    } catch {}
  }

  /** Matches the music filter and echo to the current world and scene. */
  _tuneSpace() {
    const ctx = this._ctx;
    if (!ctx || ctx.state === 'closed') return;
    const theme = THEMES[this.theme], now = ctx.currentTime;
    this._brightness = theme.color;
    try {
      this._filter.frequency.setTargetAtTime(theme.color, now, .08);
      if (this._echo) {
        const [steps, send, feedback] = theme.echo;
        this._echo.level = feedback;
        this._echo.delay.delayTime.setTargetAtTime(clamp(steps * 15 / theme.bpm, .05, .9), now, .05);
        this._echo.musicSend.gain.setTargetAtTime(this.scene === 'run' ? send : send * 1.5, now, .1);
        this._echo.feedback.gain.cancelScheduledValues(now);
        this._echo.feedback.gain.setTargetAtTime(feedback, now, .1);
        this._echo.wet.gain.cancelScheduledValues(now);
        this._echo.wet.gain.setTargetAtTime(1, now, .05);
      }
    } catch {}
  }

  _resetTransport() {
    this._step = 0;
    this._nextStep = 0;
    this._musicPlaying = false;
    this._musicLevel = -1;
    this._duckUntil = 0;
  }

  _scaleNote(degree, octave = 0) {
    const theme = THEMES[this.theme];
    const index = ((degree % 7) + 7) % 7;
    return theme.root + octave + Math.floor(degree / 7) * 12 + theme.scale[index];
  }

  /** Step n of the world's five-note ladder: always consonant, always upward. */
  _ladderNote(step, octave = 0) {
    const ladder = THEMES[this.theme].ladder;
    step = Math.max(0, Math.trunc(step));
    return this._scaleNote(ladder[step % 5] + 7 * Math.floor(step / 5), octave);
  }

  /** The chain a collect belongs to: the engine's count when it sends one,
   * otherwise a short run of quick pickups counted here.
   */
  _chain(detail, now) {
    const given = number(detail.combo, this._combo);
    const chain = given > 0 ? Math.trunc(given) : now - this._streakAt < 2.5 ? this._streak + 1 : 1;
    this._streak = chain;
    this._streakAt = now;
    return chain;
  }

  /** Ten treats climb two octaves; after that the top three notes keep dancing. */
  _chainRung(chain) {
    return chain <= 10 ? Math.max(0, chain - 1) : [10, 9, 11, 9, 10, 11][(chain - 11) % 6];
  }

  _musicStep(step, time) {
    const theme = THEMES[this.theme];
    const beat = step % 16;
    const bar = Math.floor(step / 16);
    const chord = theme.chords[bar % theme.chords.length];
    const calm = this.scene !== 'run';
    const lift = calm ? 0 : this._intensity;
    const power = calm ? 0 : this._power;
    const drive = lift > .74;
    const degree = theme.phrases[theme.order[bar % theme.order.length]][beat];
    const note = (offset, octave, duration, gain, kind, pan = 0, ring = .06) => this._tone({
      freq: frequency(this._scaleNote(chord + offset, octave)), time, duration, gain, kind, pan, ring, group: 'music', priority: 0 });
    const tap = (duration, cutoff, gain, pan = 0, q = .65) => this._noiseHit({
      time, duration, cutoff, gain, pan, q, group: 'music', priority: 0 });

    // The tune, then the low end, so they are never the notes that get skipped.
    if (degree !== null && (!calm || beat % 2 === 0)) {
      note(degree, theme.octave, theme.hold * (calm ? 1.5 : 1), (calm ? .08 : .1) * theme.gain, theme.lead, -.25, .09);
    }
    const low = theme.bass[beat];
    if (low !== undefined && (!calm || beat === 0)) note(low, 0, calm ? .5 : theme.pads ? .6 : .3, .07, 'bass', 0, .1);
    // On the trail the bass gallops (long, short-short) like hooves under the tune.
    else if (!calm && (beat % 8 === 3 || beat % 8 === 6 || (drive && beat % 8 === 2))) note(beat % 8 === 6 ? 4 : beat % 8 === 2 ? 7 : 0, 0, .11, .058, 'bass');
    if (!calm && (theme.kick.includes(beat) || beat % 4 === 0)) {
      this._tone({ freq: 300, end: 80, duration: .09, gain: beat % 8 === 0 ? .075 : .06, kind: 'thump', time, group: 'music', priority: 0 });
    }
    if ((beat === 0 || beat === 8) && (calm || theme.pads || lift > .2 || power > .35)) {
      note(2, 12, .9, .04, 'pad', .25, .4);
      note(4, 12, .9, .035, 'pad', .25, .4);
    }
    if (calm) {
      if (theme.twinkle && this._sparkle(step, 5)) this._twinkle(step, time, .035);
      return;
    }
    if (theme.logs && theme.logs[beat] !== undefined) note(theme.logs[beat], 12, .18, .075, 'wood', .25);
    if (theme.stabs && theme.stabs[beat] !== undefined) {
      note(theme.stabs[beat], 12, .1, .07, 'pluck', .25);
      note(theme.stabs[beat] + 2, 12, .1, .06, 'pluck', .25);
    }
    if (theme.snare.includes(beat)) {
      if (theme.click) this._tone({ freq: theme.click, duration: .04, gain: .045, kind: 'wood', time, pan: .25, group: 'music', priority: 0 });
      else tap(.06, theme.snap, .085, .25);
    }
    // The call to adventure: a strong chord on every downbeat and a crash at the top of each tune.
    if (beat === 0) {
      note(4, 12, .2, .05, 'pluck', .15, .05);
      if (bar % 8 === 0) tap(.3, 7200, .04, 0, .4);
    }
    // The tune rides with a harmony a third above, the way two horns would play it.
    if (degree !== null && lift > .7 && beat % 4 === 0) note(degree + 2, theme.octave, Math.min(.2, theme.hold * .8), .042 * theme.gain, theme.lead, .2, .05);
    // Every fourth bar ends on a drum roll down the toms; every eighth climbs into the next round.
    if (bar % 4 === 3 && beat >= 12) {
      const tom = [230, 190, 155, 125][beat - 12];
      this._tone({ freq: tom, end: tom * .6, duration: .12, gain: .062, kind: 'thump', time, pan: (beat - 13.5) * .25, group: 'music', priority: 0 });
    }
    if (bar % 8 === 7 && beat >= 8) note(beat - 8, theme.octave + 12, .09, .03 + .012 * lift, 'chime', .4);
    // The stack's own players: a bright arpeggio first, then a doubled tune
    // and a busier kit once the stack is tall.
    if (lift > .42 && beat % theme.arp.every === 0) {
      const notes = theme.arp.notes;
      note(notes[Math.floor(step / theme.arp.every) % notes.length], theme.arp.octave, .13,
        .02 + .045 * clamp((lift - .42) / .4, 0, 1), theme.arp.kind, .5);
    }
    if (drive && degree !== null && beat % 4 !== 0) note(degree, theme.octave + 12, .1, .03, 'chime', .25);
    if (power > .5 && beat % 4 === 2) note([4, 7, 5, 2][Math.floor(beat / 4)], 24, .11, .05, 'pluck', -.5);
    if (theme.hat.includes(beat) || (lift > .22 && beat % 2 === 1) || (drive && beat % 2 === 0)) {
      tap(.03, 5200, lift > .22 ? .034 : .026, -.25);
    }
    if (theme.twinkle && this._sparkle(step, lift > .42 ? 3 : 6)) this._twinkle(step, time, .04);
  }

  /** A fixed scatter of yes/no answers, so twinkles feel loose but never random. */
  _sparkle(step, rarity) {
    return (Math.imul(step + 11, 2654435761) >>> 16) % rarity === 0;
  }

  _twinkle(step, time, gain) {
    const rung = 5 + (Math.imul(step + 3, 40503) >>> 4) % 6;
    this._tone({ freq: frequency(this._ladderNote(rung, 24)), time, duration: .5, gain, kind: 'chime',
      pan: step % 2 ? .5 : -.5, group: 'music', priority: 0 });
  }

  /** Makes room for `need` more sources, or says no. Important feedback can
   * replace a lower-priority tail; ordinary notes are skipped instead of
   * building an audio backlog.
   */
  _reserve(group, priority, need) {
    const now = this._ctx.currentTime, limit = LIMITS[group];
    let total = 0, live = 0;
    for (const voice of this._voices) {
      if (voice.end < now) { this._finishVoice(voice); continue; }
      total += voice.sources.length;
      if (voice.group === group && !voice.fading) live += voice.sources.length;
    }
    while (live + need > limit || total + need > MAX_SOURCES) {
      // A full group can only make room inside itself; a full mix can take any
      // voice that is already fading or matters less than the newcomer.
      const groupFull = live + need > limit;
      let victim = null, best = Infinity;
      for (const voice of this._voices) {
        if (groupFull ? voice.fading || voice.group !== group || voice.priority >= priority
          : !voice.fading && voice.priority >= priority) continue;
        const score = voice.fading ? -1 : voice.priority;
        if (score < best || (score === best && voice.end < victim.end)) { victim = voice; best = score; }
      }
      if (!victim) return false;
      total -= victim.sources.length;
      if (victim.group === group && !victim.fading) live -= victim.sources.length;
      this._finishVoice(victim);
    }
    return true;
  }

  _tone({ freq, time, duration, gain, kind, end = 0, pan = 0, ring = 0, group, priority }) {
    const timbre = TIMBRES[kind] || TIMBRES.round;
    const second = timbre.over || timbre.fm || timbre.vibrato;
    if (!this._audible() || !this._reserve(group, priority, second ? 2 : 1)) return false;
    const ctx = this._ctx;
    const nodes = [], sources = [];
    try {
      const start = Math.max(ctx.currentTime + .001, number(time, ctx.currentTime));
      const length = clamp(number(duration, .15), .025, 1.6);
      const base = clamp(number(freq, 440), 35, 5200);
      const peak = clamp(number(gain) * (timbre.level || 1) * tilt(base), 0, .3);
      const attack = timbre.attack || .004;
      const envelope = ctx.createGain();
      nodes.push(envelope);
      let stop;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(peak, start + attack);
      if (timbre.hold) {
        // Blown notes swell, sit, then let go.
        const body = Math.max(length, attack + .06), release = Math.min(.08, body * .35);
        envelope.gain.linearRampToValueAtTime(peak * .82, start + body - release);
        envelope.gain.linearRampToValueAtTime(0, start + body);
        stop = start + body + .02;
      } else {
        // `ring` keeps part of the note alive to its end (a sung tune); without
        // it the note dies away like a struck mallet (a crisp cue).
        envelope.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * ring), start + length);
        stop = start + length + .025;
        envelope.gain.linearRampToValueAtTime(0, stop);
      }
      this._connectVoice(envelope, group, pan);
      const glide = start + length * .85;
      const carrier = ctx.createOscillator();
      nodes.push(carrier); sources.push(carrier);
      this._shape(carrier, timbre.wave);
      carrier.frequency.setValueAtTime(base, start);
      if (end > 0) carrier.frequency.exponentialRampToValueAtTime(clamp(end, 35, 8000), glide);
      carrier.connect(envelope);
      if (second) {
        const extra = ctx.createOscillator(), amount = ctx.createGain();
        nodes.push(extra, amount); sources.push(extra);
        extra.type = 'sine';
        if (timbre.over) {
          const [ratio, level, decay] = timbre.over;
          extra.frequency.setValueAtTime(Math.min(8000, base * ratio), start);
          if (end > 0) extra.frequency.exponentialRampToValueAtTime(clamp(end * ratio, 35, 8000), glide);
          amount.gain.setValueAtTime(level, start);
          amount.gain.exponentialRampToValueAtTime(.001, start + Math.min(length, decay));
          extra.connect(amount); amount.connect(envelope);
        } else if (timbre.fm) {
          const [ratio, from, to, portion] = timbre.fm;
          const rate = Math.min(8000, base * ratio);
          // Low notes get extra overtones so they still speak on a phone speaker.
          const reach = clamp(150 / base, 1, 1.6);
          extra.frequency.setValueAtTime(rate, start);
          if (end > 0) extra.frequency.exponentialRampToValueAtTime(clamp(end * ratio, 35, 8000), glide);
          amount.gain.setValueAtTime(from * reach * rate, start);
          amount.gain.exponentialRampToValueAtTime(Math.max(.01, to * reach * rate), start + Math.max(.02, length * portion));
          extra.connect(amount); amount.connect(carrier.frequency);
        } else {
          extra.frequency.setValueAtTime(timbre.vibrato, start);
          amount.gain.setValueAtTime(0, start);
          amount.gain.linearRampToValueAtTime(base * .006, start + Math.min(length, .2));
          extra.connect(amount); amount.connect(carrier.frequency);
        }
      }
      this._trackVoice({ nodes, sources, envelope, group, priority, start, end: stop });
      for (const source of sources) { source.start(start); source.stop(stop); }
      return true;
    } catch {
      for (const node of nodes) { try { node.disconnect(); } catch {} }
      for (const source of sources) { try { source.stop(); } catch {} }
      return false;
    }
  }

  /** Filtered noise: taps, whooshes and splashes. `end` sweeps the filter. */
  _noiseHit({ time, duration, cutoff, gain, end = 0, q = .65, attack = .003, pan = 0, group, priority }) {
    if (!this._audible() || !this._noise || !this._reserve(group, priority, 1)) return false;
    const ctx = this._ctx;
    const nodes = [], sources = [];
    try {
      const start = Math.max(ctx.currentTime + .001, number(time, ctx.currentTime));
      const length = clamp(number(duration, .05), .015, .7);
      const rise = clamp(number(attack, .003), .002, length * .6);
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      nodes.push(source, filter, envelope); sources.push(source);
      source.buffer = this._noise;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(clamp(number(cutoff, 1000), 60, 9000), start);
      if (end > 0) filter.frequency.exponentialRampToValueAtTime(clamp(end, 60, 9000), start + length);
      filter.Q.value = clamp(number(q, .65), .2, 12);
      // A band-pass keeps little of the noise when it is low or narrow, so make
      // up the difference: the same gain then sounds about as loud at any setting.
      const centre = clamp(end > 0 ? Math.sqrt(number(cutoff, 1000) * end) : number(cutoff, 1000), 60, 9000);
      const makeup = clamp(2.8 * Math.sqrt(filter.Q.value * 2400 / centre), 1, 9);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(clamp(number(gain) * makeup, 0, .6), start + rise);
      envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
      source.connect(filter); filter.connect(envelope);
      this._connectVoice(envelope, group, pan);
      this._trackVoice({ nodes, sources, envelope, group, priority, start, end: start + length + .015 });
      // Start each hit at a different place in the noise so repeats do not match.
      this._noiseTurn = (this._noiseTurn + 1) % 7;
      source.start(start, this._noiseTurn * .04);
      source.stop(start + length + .015);
      return true;
    } catch {
      for (const node of nodes) { try { node.disconnect(); } catch {} }
      for (const source of sources) { try { source.stop(); } catch {} }
      return false;
    }
  }

  /** Custom harmonic shapes where the browser supports them, plain ones otherwise. */
  _shape(source, wave = 'sine') {
    const recipe = WAVES[wave];
    if (!recipe) { source.type = wave; return; }
    let table = this._waves.get(wave);
    if (table === undefined) {
      table = null;
      try {
        if (typeof this._ctx.createPeriodicWave === 'function') {
          const imag = new Float32Array([0, ...recipe.partials]);
          table = this._ctx.createPeriodicWave(new Float32Array(imag.length), imag);
        }
      } catch { table = null; }
      this._waves.set(wave, table);
    }
    if (table && typeof source.setPeriodicWave === 'function') source.setPeriodicWave(table);
    else source.type = recipe.fallback;
  }

  /** Voices share a few fixed stereo positions instead of owning a panner each. */
  _connectVoice(envelope, group, pan) {
    const target = group === 'music' ? this._music : this._effects;
    const slot = Math.round(clamp(number(pan), -.5, .5) * 4);
    if (!slot || typeof this._ctx.createStereoPanner !== 'function') { envelope.connect(target); return; }
    const key = group === 'music' ? slot + 8 : slot;
    let panner = this._pans.get(key);
    if (!panner) {
      panner = this._ctx.createStereoPanner();
      panner.pan.value = slot / 4;
      panner.connect(target);
      this._pans.set(key, panner);
      this._outputNodes.push(panner);
    }
    envelope.connect(panner);
  }

  _trackVoice(voice) {
    this._voices.add(voice);
    let ended = 0;
    for (const source of voice.sources) source.onended = () => {
      if (++ended === voice.sources.length) this._finishVoice(voice);
    };
  }

  _finishVoice(voice) {
    if (!this._voices.delete(voice)) return;
    for (const source of voice.sources) {
      source.onended = null;
      try { source.stop(); } catch {}
    }
    for (const node of voice.nodes) { try { node.disconnect(); } catch {} }
  }

  _pruneVoices(now) {
    for (const voice of this._voices) if (voice.end < now) this._finishVoice(voice);
  }

  _stopVoices(group) {
    for (const voice of this._voices) if (!group || voice.group === group) this._finishVoice(voice);
  }

  /** A quick fade instead of a hard cut, so changing scenes never clicks. */
  _fadeVoices(group) {
    if (!this._audible()) { this._stopVoices(group); return; }
    const now = this._ctx.currentTime;
    for (const voice of this._voices) {
      if (voice.group !== group || voice.fading) continue;
      if (voice.start > now || !voice.envelope) { this._finishVoice(voice); continue; }
      voice.fading = true;
      voice.end = Math.min(voice.end, now + .06);
      try {
        const level = voice.envelope.gain;
        if (typeof level.cancelAndHoldAtTime === 'function') level.cancelAndHoldAtTime(now);
        else level.cancelScheduledValues(now);
        level.setTargetAtTime(0, now, .012);
        for (const source of voice.sources) source.stop(now + .05);
      } catch { this._finishVoice(voice); }
    }
  }
}
