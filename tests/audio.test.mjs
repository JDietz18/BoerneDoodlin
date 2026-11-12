import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../dist/audio.js';

// A clock-driven browser audio stub checks lifecycle/resource behavior without
// requiring an audio device. Musical taste is intentionally not asserted here.
// `basic` leaves out the optional nodes (echo, panner, compressor, custom waves)
// the way an older phone browser might.
function browserAudio({ supported = true, basic = false } = {}) {
  const originals = new Map(['AudioContext', 'webkitAudioContext', 'navigator', 'document']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const contexts = [];
  const listeners = new Map();
  const document = {
    hidden: false,
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); }
  };
  const activation = { isActive: true };
  const hooks = { slowResume: false };
  // `first` is the first value scheduled (a note's starting pitch) and `peak` the
  // largest (an envelope's loudest point); `value` is the last one, as before.
  const param = value => ({
    value, first: null, peak: 0,
    note(v, t) {
      assert.ok(t === undefined || Number.isFinite(t));
      if (this.first === null) this.first = v;
      this.peak = Math.max(this.peak, v); this.value = v;
    },
    setValueAtTime(v, t) { assert.ok(Number.isFinite(v)); this.note(v, t); },
    linearRampToValueAtTime(v, t) { assert.ok(Number.isFinite(v)); this.note(v, t); },
    exponentialRampToValueAtTime(v, t) { assert.ok(v > 0 && Number.isFinite(v)); this.note(v, t); },
    setTargetAtTime(v, t, c) { assert.ok(Number.isFinite(v) && c > 0); this.note(v, t); },
    cancelScheduledValues() {}
  });
  class Context {
    constructor() {
      this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 8000;
      this.destination = {}; this.nodes = []; this.sources = [];
      this.resumeCalls = 0; this.suspendCalls = 0; contexts.push(this);
    }
    node(extra = {}) {
      const node = { disconnected: false, connect() {}, disconnect() { this.disconnected = true; }, ...extra };
      this.nodes.push(node); return node;
    }
    createGain() { return this.node({ gain: param(1) }); }
    createBiquadFilter() { return this.node({ frequency: param(1000), Q: param(1) }); }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    source(extra = {}) {
      const context = this;
      const source = this.node({
        startAt: null, stopAt: Infinity,
        start(time) { assert.ok(time >= context.currentTime); this.startAt = time; },
        stop(time = context.currentTime) { this.stopAt = time; },
        ...extra
      });
      this.sources.push(source); return source;
    }
    createOscillator() { return this.source({ oscillator: true, frequency: param(440), setPeriodicWave(wave) { this.wave = wave; } }); }
    createBufferSource() { return this.source(); }
    resume() {
      this.resumeCalls++;
      if (this.rejectResume) return Promise.reject(new Error('Browser declined audio'));
      // A phone starts audio a moment after the tap, not inside the call.
      if (hooks.slowResume) return new Promise(resolve => setTimeout(() => { this.state = 'running'; this.onstatechange?.(); resolve(); }, 0));
      this.state = 'running'; this.onstatechange?.(); return Promise.resolve();
    }
    suspend() { this.suspendCalls++; this.state = 'suspended'; this.onstatechange?.(); return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    advance(seconds) {
      this.currentTime += seconds;
      for (const source of this.sources) {
        if (source.stopAt <= this.currentTime && source.onended) {
          const ended = source.onended; source.onended = null; ended();
        }
      }
    }
    active() { return this.sources.filter(source => source.startAt !== null && source.stopAt > this.currentTime); }
  }
  if (!basic) Object.assign(Context.prototype, {
    createStereoPanner() { return this.node({ pan: param(0) }); },
    createDynamicsCompressor() {
      return this.node(Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(k => [k, param(0)])));
    },
    createDelay() { return this.node({ delayTime: param(0) }); },
    createPeriodicWave(real, imag) { assert.equal(real.length, imag.length); return { custom: true }; }
  });
  for (const [key, value] of Object.entries({ AudioContext: supported ? Context : undefined,
    webkitAudioContext: undefined, navigator: { userActivation: activation }, document })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  return {
    contexts, activation, document, listeners, hooks,
    restore() {
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  };
}

test('sound preference and frame updates never create audio without a gesture', async () => {
  const browser = browserAudio(); const sound = new GameAudio({ enabled: true });
  try {
    sound.setScene('run'); sound.update(1 / 60, { running: true });
    assert.equal(sound.play('jump'), false);
    assert.equal(browser.contexts.length, 0);
    browser.activation.isActive = false;
    assert.equal(await sound.unlock(), false);
    assert.equal(browser.contexts.length, 0);
    browser.activation.isActive = true;
    assert.equal(await sound.unlock(), true);
    assert.equal(browser.contexts.length, 1);
    assert.equal(sound.play('jump'), true);
  } finally { sound.destroy(); browser.restore(); }
});

test('mute cancels current and future cues and re-enable needs a fresh unlock', async () => {
  const browser = browserAudio(); const sound = new GameAudio({ enabled: true });
  try {
    await sound.unlock(); const context = browser.contexts[0];
    sound.play('finish');
    assert.ok(context.active().some(source => source.startAt > context.currentTime + .3));
    assert.equal(sound.setEnabled(false), false);
    assert.equal(context.active().length, 0);
    const sourceCount = context.sources.length;
    sound.update(10, { running: true }); sound.play('collect');
    assert.equal(context.sources.length, sourceCount);
    assert.equal(sound.setEnabled(true), true);
    assert.equal(sound.play('collect'), false);
    await sound.unlock();
    assert.equal(sound.play('click'), true);
    assert.ok(context.active().every(source => source.startAt < context.currentTime + .05));
  } finally { sound.destroy(); browser.restore(); }
});

test('long render gaps skip stale music instead of playing a catch-up burst', async () => {
  const browser = browserAudio(); const sound = new GameAudio({ enabled: true });
  try {
    await sound.unlock(); const context = browser.contexts[0];
    sound.setScene('run', 4); sound.update(.016, { running: true });
    context.advance(90);
    const count = context.sources.length;
    sound.update(90, { running: true, speed: 2, combo: 20, power: true });
    const fresh = context.sources.slice(count);
    assert.ok(fresh.length > 0 && fresh.length <= 16);
    assert.ok(fresh.every(source => source.startAt >= 90 && source.startAt < 90.2));
  } finally { sound.destroy(); browser.restore(); }
});

test('collection bursts are throttled and mixed audio remains bounded', async () => {
  const browser = browserAudio(); const sound = new GameAudio({ enabled: true });
  try {
    await sound.unlock(); const context = browser.contexts[0];
    sound.setScene('run', 2);
    assert.equal(sound.play('collect'), true);
    for (let i = 0; i < 100; i++) assert.equal(sound.play('collect'), false);
    const cues = ['jump', 'double-jump', 'slide', 'gold', 'combo', 'power', 'hit', 'shield', 'near-miss', 'finish', 'unlock'];
    for (let frame = 0; frame < 250; frame++) {
      context.advance(.016);
      sound.update(.016, { running: true, speed: 2, combo: 30, power: true });
      for (const cue of cues) sound.play(cue);
      assert.ok(context.active().length <= 48, 'at most 24 two-partial voices may remain scheduled');
    }
    sound.suspend();
    assert.equal(context.active().length, 0);
  } finally { sound.destroy(); browser.restore(); }
});

test('visibility suspension and destroy remove queued sound and listeners', async () => {
  const browser = browserAudio(); const sound = new GameAudio({ enabled: true });
  try {
    await sound.unlock(); const context = browser.contexts[0];
    sound.play('unlock'); browser.document.hidden = true;
    browser.listeners.get('visibilitychange')();
    assert.equal(context.active().length, 0);
    assert.equal(await sound.unlock(), false);
    browser.document.hidden = false;
    sound.update(1, { running: true });
    assert.equal(sound.play('jump'), false);
    await sound.unlock(); assert.equal(sound.play('jump'), true);
    sound.destroy(); sound.destroy();
    assert.equal(context.state, 'closed');
    assert.equal(context.active().length, 0);
    assert.equal(browser.listeners.size, 0);
    assert.equal(sound.setEnabled(true), false);
    assert.equal(await sound.unlock(), false);
    assert.ok(context.nodes.every(node => node.disconnected));
  } finally { sound.destroy(); browser.restore(); }
});

test('repeated unlocks are idempotent while playing and unsupported devices stay quiet', async () => {
  const browser = browserAudio(); const sound = new GameAudio({ enabled: true });
  try {
    await sound.unlock(); const context = browser.contexts[0];
    sound.play('click');
    for (let i = 0; i < 5; i++) assert.equal(await sound.unlock(), true);
    assert.equal(context.resumeCalls, 1);
    assert.equal(browser.contexts.length, 1);
  } finally { sound.destroy(); browser.restore(); }
  const unsupported = browserAudio({ supported: false }); const quiet = new GameAudio({ enabled: true });
  try {
    assert.equal(quiet.enabled, false);
    assert.equal(quiet.setEnabled(true), false);
    assert.equal(await quiet.unlock(), false);
    quiet.update(.016, { running: true });
    assert.equal(quiet.play('hit'), false);
  } finally { quiet.destroy(); unsupported.restore(); }
});

test('all cue families schedule finite audio and a declined resume never rejects', async () => {
  const browser = browserAudio(); const sound = new GameAudio({ enabled: true });
  try {
    await sound.unlock(); const context = browser.contexts[0];
    const cues = ['jump', 'double-jump', 'slide', 'collect', 'gold', 'combo', 'charged',
      'power', 'hit', 'shield', 'near-miss', 'spring', 'finish', 'lost', 'click', 'upgrade', 'unlock', 'mission',
      'gold-rush', 'mega-stack'];
    for (const cue of cues) {
      context.advance(2);
      assert.equal(sound.play(cue, { combo: 15, pan: .2 }), true, cue);
    }
    assert.equal(sound.play('unknown'), false);
    sound.suspend(); context.rejectResume = true;
    assert.equal(await sound.unlock(), false);
    assert.equal(sound.play('jump'), false);
  } finally { sound.destroy(); browser.restore(); }
});

// --- Reactive cues, iPhone recovery and the intensity layer ----------------

async function ready(theme = 0, scene = 'run', options) {
  const browser = browserAudio(options); const sound = new GameAudio({ enabled: true });
  sound.setScene(scene, theme);
  assert.equal(await sound.unlock(), true);
  return { browser, sound, context: browser.contexts[0], done() { sound.destroy(); browser.restore(); } };
}
// Everything a cue schedules, after leaving `wait` seconds for rate limits to clear.
function fresh(context, sound, name, data, wait = 3) {
  context.advance(wait);
  const mark = context.sources.length, nodes = context.nodes.length;
  const played = sound.play(name, data);
  const sources = context.sources.slice(mark);
  const tones = sources.filter(source => source.oscillator).map(source => source.frequency.first);
  // Envelopes start from silence; the loudest point is the cue's level.
  const levels = context.nodes.slice(nodes).filter(node => node.gain && node.gain.first === 0).map(node => node.gain.peak);
  return { played, sources, tones, first: tones[0], top: Math.max(0, ...tones), level: Math.max(0, ...levels),
    starts: Math.min(...sources.map(source => source.startAt)) - context.currentTime,
    length: Math.max(0, ...sources.map(source => source.stopAt)) - context.currentTime };
}
function frames(context, sound, seconds, state) {
  const mark = context.sources.length;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    context.advance(1 / 60); sound.update(1 / 60, state);
    assert.ok(context.active().length <= 48, 'scheduled audio stays inside the budget');
  }
  return context.sources.length - mark;
}
const rising = list => list.every((value, i) => i === 0 || value > list[i - 1]);

test('every cue the controller can ask for exists, plays once, and is rate limited', async () => {
  const { sound, context, done } = await ready();
  try {
    const wanted = ['land', 'pop', 'vent', 'splash', 'crumble', 'respawn', 'secret-found', 'pickup', 'shield', 'stack',
      'chain-lost', 'countdown', 'go', 'tick', 'flip', 'match', 'mismatch', 'peek', 'near-miss', 'boost', 'steer-skid',
      'treasure', 'deliver', 'ui-open', 'ui-close', 'medal', 'count-up', 'marker',
      // engine event names the controller tries before its own aliases
      'stomp', 'smash', 'key', 'chest', 'checkpoint', 'secret', 'block', 'fever', 'gold-rush', 'boss-defeated', 'heal',
      'spring', 'slide', 'hit', 'charged', 'power', 'combo', 'dodge', 'parcel', 'bump', 'miss', 'section', 'ramp',
      'landing', 'convoy', 'convoy-start', 'final-push', 'final-tick', 'finish-line', 'timer-warning', 'bounce',
      'bloom', 'bloom-seed', 'comet', 'gust', 'finale', 'fizzle', 'fever-end', 'gold-rush-end', 'power-end', 'step',
      'greet', 'walk', 'critter', 'critter-back', 'paw', 'paw-reveal', 'trail', 'trail-fade', 'trail-complete', 'locked',
      'dialog', 'hint', 'deal', 'ready', 'swap', 'golden', 'streak', 'streak-lost', 'timer-low', 'time-up',
      'perfect-game', 'crash',
      // names that existed before this release
      'jump', 'double-jump', 'collect', 'gold', 'finish', 'lost', 'click', 'upgrade', 'unlock', 'mission', 'mega-stack',
      'double', 'chicken', 'zoom', 'won', 'win', 'lose', 'clean'];
    for (const name of wanted) {
      assert.equal(sound.has(name), true, `has ${name}`);
      assert.ok(GameAudio.cues.includes(name), `listed ${name}`);
      const cue = fresh(context, sound, name, {});
      assert.equal(cue.played, true, name);
      assert.ok(cue.sources.length >= 1 && cue.sources.length <= 20, `${name} uses a sensible number of voices`);
      assert.ok(cue.starts >= 0 && cue.length > 0 && cue.length < 2.2, `${name} is short`);
      assert.ok(cue.level > 0 && cue.level <= .6, `${name} has a sane level`);
      assert.equal(sound.play(name, {}), false, `${name} is rate limited`);
    }
    for (const name of ['nope', '', undefined, null, 42, 'constructor', 'toString', '__proto__']) {
      assert.equal(sound.has(name), false);
      assert.equal(sound.play(name), false);
    }
    assert.equal(new Set(GameAudio.cues).size, GameAudio.cues.length);
    // Odd payloads never throw and never schedule nonsense.
    for (const name of GameAudio.cues) {
      context.advance(3);
      for (const data of [null, 'x', { combo: NaN, chain: -4, tier: 'big', speed: Infinity, count: {}, index: 99, streak: null, keys: 1e9 }]) {
        assert.equal(typeof sound.play(name, data), 'boolean');
      }
    }
  } finally { done(); }
});

test('collect climbs a ladder with the chain and resets when the chain drops', async () => {
  const { sound, context, done } = await ready(0);
  try {
    const at = (combo, extra) => fresh(context, sound, 'collect', { combo, multiplier: 1, ...extra }, 2);
    const ladder = []; for (let combo = 1; combo <= 10; combo++) ladder.push(at(combo).first);
    assert.ok(rising(ladder), 'ten treats, ten rising notes');
    assert.ok(ladder[9] > ladder[0] * 3, 'the climb spans about two octaves');
    for (let combo = 11; combo <= 40; combo++) assert.ok(at(combo).first >= ladder[8], 'a long chain stays up high');
    assert.equal(at(1).first, ladder[0], 'a dropped chain starts again from the bottom');
    assert.equal(at(4).first, ladder[3]);
    // The same climb works in every world's own key.
    for (const theme of [1, 2, 3, 4]) {
      sound.setScene('run', theme);
      const steps = []; for (let combo = 1; combo <= 10; combo++) steps.push(at(combo).first);
      assert.ok(rising(steps), `world ${theme} ladder rises`);
    }
    sound.setScene('run', 0);
    // No count from the engine: the chain passed to update() is used.
    sound.update(1 / 60, { running: true, combo: 6 });
    assert.equal(fresh(context, sound, 'collect', {}, 2).first, ladder[5]);
    // No count at all: quick pickups climb by themselves...
    sound.update(1 / 60, { running: true, combo: 0 });
    const loose = [0, 1, 2].map(() => fresh(context, sound, 'collect', {}, 2).first);
    assert.ok(rising(loose));
    // ...until the chain is lost or the player dawdles.
    assert.equal(fresh(context, sound, 'chain-lost', {}, 1).played, true);
    assert.equal(fresh(context, sound, 'collect', {}, 1).first, ladder[0]);
    assert.ok(fresh(context, sound, 'collect', {}, 1).first > ladder[0]);
    assert.equal(fresh(context, sound, 'collect', {}, 6).first, ladder[0]);
    // A tall stack adds a glint on top of the same note.
    const plain = at(3, { totalMultiplier: 1 }), tall = at(3, { totalMultiplier: 30 });
    assert.equal(tall.first, plain.first);
    assert.ok(tall.sources.length > plain.sources.length && tall.top > plain.top);
  } finally { done(); }
});

test('gold, keys, stomps, pops and pairs sound distinct and escalate', async () => {
  const { sound, context, done } = await ready(0);
  try {
    const collect = fresh(context, sound, 'collect', { combo: 1 });
    const gold = fresh(context, sound, 'collect', { combo: 1, kind: 'gold', gold: true, multiplier: 1 });
    assert.ok(gold.first > collect.first * 2 && gold.sources.length > collect.sources.length, 'gold rings higher and fuller');
    assert.deepEqual(fresh(context, sound, 'gold', { multiplier: 1 }).tones, gold.tones, 'gold is also a cue of its own');
    assert.ok(rising([1, 2, 3, 4, 5].map(multiplier => fresh(context, sound, 'gold', { multiplier }).first)));
    // Trail Scout sends keys as a kind of collect; platform levels send a key event.
    const key = fresh(context, sound, 'collect', { kind: 'key', value: 75 });
    assert.deepEqual(key.tones, fresh(context, sound, 'key', { keys: 1, requiredKeys: 3 }).tones);
    assert.notDeepEqual(key.tones, collect.tones);
    assert.ok(rising([1, 2, 3].map(keys => fresh(context, sound, 'key', { keys, requiredKeys: 9 }).top)));
    assert.ok(fresh(context, sound, 'key', { keys: 2, requiredKeys: 2 }).sources.length >
      fresh(context, sound, 'key', { keys: 2, requiredKeys: 3 }).sources.length, 'the last key resolves');
    // Camp Pairs reports each pair twice (match and collect); only the match sings.
    assert.equal(sound.play('collect', { kind: 'pair', combo: 2 }), false);
    for (const [name, field] of [['stomp', 'chain'], ['pop', 'chain'], ['match', 'streak']]) {
      const steps = [1, 2, 3, 4, 5, 6].map(value => fresh(context, sound, name, { [field]: value }));
      assert.ok(rising(steps.map(step => step.top)), `${name} rises with ${field}`);
      assert.ok(steps[5].sources.length > steps[0].sources.length, `${name} gains sparkle`);
    }
    assert.ok(rising([1, 2, 3].map(index => fresh(context, sound, 'medal', { index }).top)));
    // A growing chain is never swallowed by the rate limit; a repeat is.
    context.advance(3);
    assert.equal(sound.play('stomp', { chain: 1 }), true);
    assert.equal(sound.play('stomp', { chain: 2 }), true);
    assert.equal(sound.play('stomp', { chain: 2 }), false);
    const stomp = fresh(context, sound, 'stomp', { chain: 2 }), smash = fresh(context, sound, 'smash', {});
    assert.notDeepEqual(stomp.tones, smash.tones);
    assert.ok(smash.level >= stomp.level);
  } finally { done(); }
});

test('stack stingers grow tier by tier and thirty is a fanfare', async () => {
  const { sound, context, done } = await ready(4);
  try {
    const tiers = [2, 5, 10, 20, 30].map(tier => fresh(context, sound, 'stack', { tier, total: tier }));
    assert.ok(tiers.every(tier => tier.played));
    assert.ok(rising(tiers.map(tier => tier.sources.length)), 'each tier is bigger than the last');
    assert.ok(tiers[0].length < .4 && tiers[4].length > .9, 'two is a blip, thirty takes its time');
    assert.ok(tiers[4].sources.length >= 16 && tiers[4].sources.some(source => source.startAt > context.currentTime + .5));
    // In-between numbers settle on the tier below; other engines' numbering is understood.
    assert.equal(fresh(context, sound, 'stack', { tier: 12 }).sources.length, tiers[2].sources.length);
    assert.equal(fresh(context, sound, 'stack', { tier: 2, level: 20, totalMultiplier: 20 }).sources.length, tiers[3].sources.length);
    assert.equal(fresh(context, sound, 'stack', {}).sources.length, tiers[0].sources.length);
    // A taller tier is let through the rate limit; the same or a smaller one is not.
    context.advance(3);
    assert.equal(sound.play('stack', { tier: 5 }), true);
    context.advance(.05);
    assert.equal(sound.play('stack', { tier: 5 }), false);
    assert.equal(sound.play('combo', { multiplier: 5 }), false, 'the chain milestone shares the moment');
    assert.equal(sound.play('stack', { tier: 10 }), true);
    assert.equal(sound.play('stack', { tier: 2 }), false);
    context.advance(3);
    assert.equal(sound.play('combo', { multiplier: 2 }), true);
    assert.equal(sound.play('stack', { tier: 2 }), false);
    assert.equal(sound.play('combo', { multiplier: 3 }), true);
    // After frenzy, gold rush or power starts, the stinger follows instead of piling on.
    for (const layer of ['fever', 'gold-rush', 'power']) {
      context.advance(3);
      assert.equal(sound.play(layer), true);
      assert.ok(fresh(context, sound, 'stack', { tier: 10 }, 0).starts >= .2, `after ${layer}`);
    }
    assert.ok(fresh(context, sound, 'stack', { tier: 10 }).starts < .05);
    assert.ok(fresh(context, sound, 'chain-lost').played);
  } finally { done(); }
});

test('landings, countdowns, ticks and the tally react to their data', async () => {
  const { sound, context, done } = await ready(0);
  try {
    assert.equal(fresh(context, sound, 'land', { speed: 40 }).played, false, 'a feather landing is silent');
    const thuds = [200, 450, 700, 950].map(speed => fresh(context, sound, 'land', { speed, drop: false }));
    assert.ok(thuds.every(thud => thud.played) && rising(thuds.map(thud => thud.level)), 'harder landings are louder');
    assert.equal(fresh(context, sound, 'land', { speed: 5000 }).level, thuds[3].level, 'but never past a soft thud');
    assert.ok(thuds[3].level < fresh(context, sound, 'hit').level / 2);
    assert.ok(thuds[3].length < .2);
    const counts = [3, 2, 1].map(count => fresh(context, sound, 'countdown', { count }));
    assert.ok(counts.every(count => count.first === counts[0].first), 'three, two and one share a note');
    const go = fresh(context, sound, 'go');
    assert.ok(go.top > counts[0].top && go.length > counts[0].length * 2, 'go is higher and longer');
    assert.deepEqual(fresh(context, sound, 'countdown', { count: 0 }).tones, go.tones);
    assert.deepEqual(fresh(context, sound, 'countdown', { count: 'go' }).tones, go.tones);
    const late = fresh(context, sound, 'tick', { remaining: 2 }), early = fresh(context, sound, 'tick', { remaining: 8 });
    assert.ok(late.first > early.first && late.level > early.level, 'the last seconds tick higher');
    assert.deepEqual(fresh(context, sound, 'final-tick', { seconds: 2 }).tones, late.tones);
    // The result tally rises while it runs and starts over next time.
    const tally = []; for (let i = 0; i < 20; i++) tally.push(fresh(context, sound, 'count-up', {}, .07).first);
    assert.ok(rising(tally) && tally[19] < tally[0] * 2.1);
    assert.equal(fresh(context, sound, 'count-up', {}, 2).first, tally[0]);
    let ticks = 0; context.advance(1);
    for (let i = 0; i < 300; i++) { context.advance(.004); if (sound.play('count-up')) ticks++; }
    assert.ok(ticks >= 20 && ticks <= 31, 'a fast tally cannot machine-gun');
    // A near miss can lean to the side it happened on.
    assert.ok(fresh(context, sound, 'near-miss', { side: -1 }).played && fresh(context, sound, 'near-miss', { side: 1, pan: 9 }).played);
    const pickups = ['magnet', 'shield', 'star', 'other'].map(kind => fresh(context, sound, 'pickup', { kind }).tones.join());
    assert.equal(new Set(pickups).size, 4);
  } finally { done(); }
});

test('several unlock calls in one gesture agree and repeated calls are free', async () => {
  const browser = browserAudio(); const sound = new GameAudio({ enabled: true });
  try {
    // pointerup, touchend and click all arrive for one tap, before audio has started.
    browser.hooks.slowResume = true;
    const calls = [sound.unlock(), sound.unlock(), sound.unlock()];
    assert.equal(sound.unlocked, false);
    assert.deepEqual(await Promise.all(calls), [true, true, true]);
    assert.equal(browser.contexts.length, 1);
    const context = browser.contexts[0];
    assert.equal(sound.unlocked, true);
    assert.equal(sound.play('click'), true);
    // Once running, every further call returns the same settled promise and touches nothing.
    const resumes = context.resumeCalls, nodes = context.nodes.length;
    assert.equal(sound.unlock(), sound.unlock());
    for (let i = 0; i < 2000; i++) sound.unlock();
    assert.equal(context.resumeCalls, resumes);
    assert.equal(context.nodes.length, nodes);
    assert.equal(await sound.unlock(), true);
    // A touch pointerdown is not an activating gesture on a phone: nothing happens,
    // nothing breaks, and the pointerup that follows starts the sound.
    sound.suspend();
    browser.activation.isActive = false;
    assert.equal(await sound.unlock(), false);
    assert.equal(context.resumeCalls, resumes);
    browser.activation.isActive = true;
    const again = [sound.unlock(), sound.unlock()];
    assert.deepEqual(await Promise.all(again), [true, true]);
    // A pause that lands between the tap and the audio starting wins.
    sound.suspend();
    const racing = sound.unlock();
    sound.suspend();
    assert.equal(await racing, false);
    assert.equal(sound.unlocked, false);
    assert.equal(sound.play('click'), false);
    assert.equal(await sound.unlock(), true);
    // Browsers without the activation API simply try.
    delete globalThis.navigator.userActivation;
    sound.suspend();
    assert.equal(await sound.unlock(), true);
    assert.equal(browser.contexts.length, 1);
  } finally { sound.destroy(); browser.restore(); }
});

test('an interrupted or suspended context recovers on the next gesture', async () => {
  const { browser, sound, context, done } = await ready(2);
  try {
    frames(context, sound, 1, { running: true });
    sound.play('finish');
    // A phone call, Siri or the lock screen: iOS reports "interrupted".
    context.state = 'interrupted'; context.onstatechange();
    assert.equal(context.active().length, 0, 'nothing keeps playing or queued');
    assert.equal(sound.unlocked, false);
    assert.equal(sound.play('jump'), false);
    const quiet = context.sources.length;
    sound.update(1 / 60, { running: true }); sound.update(5, { running: true, intensity: 1 });
    assert.equal(context.sources.length, quiet, 'frames never restart audio by themselves');
    // While the call is still going the phone refuses: no throw, no rejection.
    context.rejectResume = true;
    assert.equal(await sound.unlock(), false);
    assert.equal(await sound.unlock(), false);
    // Call over: the first tap brings the same context back.
    context.rejectResume = false;
    assert.equal(await sound.unlock(), true);
    assert.equal(context.state, 'running');
    assert.equal(browser.contexts.length, 1);
    assert.equal(sound.play('jump'), true);
    assert.ok(frames(context, sound, 1, { running: true }) > 0, 'the music picks up again');
    // iOS may also leave it "suspended" after an app switch.
    context.state = 'suspended'; context.onstatechange();
    assert.equal(sound.play('jump'), false);
    assert.equal(await sound.unlock(), true);
    context.advance(1);
    assert.equal(sound.play('jump'), true);
    // The phone may restart audio by itself. Fine while playing...
    context.state = 'interrupted'; context.onstatechange();
    context.state = 'running'; context.onstatechange();
    context.advance(1);
    assert.equal(sound.play('jump'), true);
    // ...but a paused or muted game puts it back to sleep.
    sound.suspend();
    const sleeps = context.suspendCalls;
    context.state = 'running'; context.onstatechange();
    assert.equal(context.suspendCalls, sleeps + 1);
    assert.equal(context.state, 'suspended');
    assert.equal(sound.play('jump'), false);
    // A context the system closed is replaced.
    context.state = 'closed'; context.onstatechange();
    assert.equal(await sound.unlock(), true);
    assert.equal(browser.contexts.length, 2);
    assert.equal(sound.play('jump'), true);
  } finally { done(); }
});

test('a context that claims to run with a frozen clock is nudged, then rebuilt, within limits', async () => {
  const { browser, sound, context, done } = await ready(1);
  try {
    frames(context, sound, 1, { running: true });
    const freeze = seconds => { for (let i = 0; i < seconds * 60; i++) { sound.update(1 / 60, { running: true, intensity: 1 }); assert.ok(browser.contexts.at(-1).active().length <= 48); } };
    // A slow start (a car's Bluetooth can take a second or two) is not a stall.
    freeze(2);
    const resumes = context.resumeCalls, sleeps = context.suspendCalls;
    assert.equal(sound.unlock(), sound.unlock());
    assert.equal(context.resumeCalls, resumes);
    frames(context, sound, .5, { running: true });
    // Four seconds of frames with no audio time passing: the next tap nudges it.
    freeze(4);
    assert.equal(await sound.unlock(), true);
    assert.equal(context.suspendCalls, sleeps + 1);
    assert.equal(context.resumeCalls, resumes + 1);
    assert.equal(browser.contexts.length, 1);
    // Still frozen: the tap after that builds a fresh context and closes the old one.
    freeze(4);
    assert.equal(await sound.unlock(), true);
    assert.equal(browser.contexts.length, 2);
    assert.equal(context.state, 'closed');
    assert.ok(context.nodes.every(node => node.disconnected));
    assert.equal(browser.contexts[1].state, 'running');
    // A phone that never recovers cannot make the game churn through contexts.
    for (let tap = 0; tap < 8; tap++) { freeze(4); assert.equal(await sound.unlock(), true); }
    assert.ok(browser.contexts.length <= 3);
    assert.equal(browser.contexts.filter(item => item.state !== 'closed').length, 1);
    // Once time moves again everything is normal, and a later stall starts with a nudge.
    const live = browser.contexts.at(-1);
    assert.ok(frames(live, sound, 4, { running: true }) > 0);
    live.advance(1);
    assert.equal(sound.play('jump'), true);
    const before = live.suspendCalls;
    freeze(4);
    assert.equal(await sound.unlock(), true);
    assert.equal(live.suspendCalls, before + 1);
    assert.equal(browser.contexts.at(-1), live);
  } finally { done(); }
});

test('the score adds players as the stack grows and lets them go when it drops', async () => {
  const { sound, context, done } = await ready(0);
  try {
    const run = (seconds, state) => frames(context, sound, seconds, { running: true, ...state });
    const calm = run(9, { intensity: 0 });
    assert.equal(sound.intensity, 0);
    const some = run(9, { intensity: .32 }), more = run(9, { intensity: .6 }), most = run(9, { intensity: 1 });
    assert.ok(some > calm * 1.15, `a small stack adds a little (${calm} -> ${some})`);
    assert.ok(more > some * 1.25, `the arpeggio joins in (${some} -> ${more})`);
    assert.ok(most > more * 1.15, `a full stack is the busiest (${more} -> ${most})`);
    assert.ok(sound.intensity > .98);
    // It leaves more slowly than it arrives...
    run(.5, { intensity: 0 });
    assert.ok(sound.intensity > .45 && sound.intensity < .7);
    run(8, { intensity: 0 });
    assert.ok(sound.intensity < .01);
    const settled = run(9, { intensity: 0 });
    assert.ok(Math.abs(settled - calm) <= calm * .2, `and settles back (${calm} vs ${settled})`);
    run(.5, { intensity: 1 });
    assert.ok(sound.intensity > .8, 'a new layer arrives within half a second');
    // The raw multiplier works too (30x is full), as do chain and power on their own.
    run(8, { intensity: 0 });
    run(3, { stack: 30 });
    assert.ok(sound.intensity > .95);
    run(8, { stack: 1 });
    assert.ok(sound.intensity < .01);
    run(3, { stack: 5 });
    assert.ok(sound.intensity > .4 && sound.intensity < .55);
    run(8, {}); run(3, { combo: 24 });
    assert.ok(sound.intensity > .95);
    run(8, {}); run(3, { power: true });
    assert.ok(sound.intensity > .45 && sound.intensity < .55);
    run(3, { intensity: 7, stack: NaN });
    assert.ok(sound.intensity <= 1);
    // Paused runs and the camp screen ignore it.
    run(2, { intensity: 1 });
    const mark = context.sources.length;
    frames(context, sound, 2, { running: false, intensity: 1 });
    assert.equal(context.sources.length, mark, 'a paused run is silent');
    assert.ok(sound.intensity < .2);
    sound.setScene('menu', 0);
    assert.equal(sound.intensity, 0);
    const menu = frames(context, sound, 9, { running: false, intensity: 1, stack: 30 });
    assert.equal(sound.intensity, 0);
    assert.ok(menu > 0 && menu < calm, 'the camp tune is gentler than a run');
  } finally { done(); }
});

test('a full stack with every cue firing stays bounded and a jump still sounds', async () => {
  const { sound, context, done } = await ready(4);
  try {
    const cues = GameAudio.cues.filter(name => !['jump', 'double-jump', 'double'].includes(name));
    for (let frame = 0; frame < 420; frame++) {
      context.advance(1 / 60);
      sound.update(1 / 60, { running: true, speed: 2, combo: 60, power: true, intensity: 1, stack: 30 });
      for (const name of cues) sound.play(name, { combo: frame, chain: frame % 9, tier: 30, total: 30, count: frame % 4, index: 3, streak: frame % 7, speed: 900, totalMultiplier: 30 });
      assert.ok(context.active().length <= 48);
      // The player's own actions cut through whatever else is ringing.
      if (frame % 30 === 29) assert.equal(sound.play('jump'), true, `jump at frame ${frame}`);
    }
    // A long frame after all that still cannot burst.
    context.advance(30);
    const mark = context.sources.length;
    sound.update(30, { running: true, intensity: 1, power: true });
    const late = context.sources.slice(mark);
    assert.ok(late.length > 0 && late.length <= 16);
    assert.ok(late.every(source => source.startAt >= context.currentTime && source.startAt < context.currentTime + .2));
    sound.suspend();
    assert.equal(context.active().length, 0);
  } finally { done(); }
});

test('each world has its own tempo, key and instruments', async () => {
  const signatures = [], custom = [], counts = [];
  for (let theme = 0; theme < 5; theme++) {
    const { sound, context, done } = await ready(theme);
    try {
      counts.push(frames(context, sound, 10, { running: true, intensity: 0 }));
      const tones = context.sources.filter(source => source.oscillator);
      signatures.push(tones.slice(0, 40).map(source => Math.round(source.frequency.first)).join());
      custom.push(tones.some(source => source.wave?.custom));
      // Changing scene fades the old tune instead of cutting it.
      sound.setScene('result', theme);
      assert.ok(context.active().every(source => source.stopAt <= context.currentTime + .06));
      assert.ok(frames(context, sound, 6, { running: false }) > 0);
    } finally { done(); }
  }
  assert.equal(new Set(signatures).size, 5, 'five different tunes');
  assert.equal(new Set(counts).size, 5, 'five different amounts of movement');
  assert.deepEqual(custom, [false, true, false, false, true], 'the flute and the squeezebox are their own shapes');
});

test('older browsers without echo, panner, compressor or custom waves still play everything', async () => {
  const { sound, context, done } = await ready(1, 'run', { basic: true });
  try {
    assert.ok(frames(context, sound, 6, { running: true, intensity: 1, power: true }) > 0);
    for (const theme of [4, 3]) { sound.setScene('run', theme); assert.ok(frames(context, sound, 3, { running: true, intensity: .6 }) > 0); }
    for (const name of GameAudio.cues) assert.equal(fresh(context, sound, name, { pan: -.4 }, 2).played, true, name);
    sound.destroy();
    assert.equal(context.active().length, 0);
    assert.ok(context.nodes.every(node => node.disconnected));
  } finally { done(); }
});
