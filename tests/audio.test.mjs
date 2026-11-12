import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio } from '../dist/audio.js';

// A clock-driven browser audio stub checks lifecycle/resource behavior without
// requiring an audio device. Musical taste is intentionally not asserted here.
function browserAudio({ supported = true } = {}) {
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
  const param = value => ({
    value,
    setValueAtTime(v) { assert.ok(Number.isFinite(v)); this.value = v; },
    linearRampToValueAtTime(v) { assert.ok(Number.isFinite(v)); this.value = v; },
    exponentialRampToValueAtTime(v) { assert.ok(v > 0 && Number.isFinite(v)); this.value = v; },
    setTargetAtTime(v) { assert.ok(Number.isFinite(v)); this.value = v; },
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
    createStereoPanner() { return this.node({ pan: param(0) }); }
    createDynamicsCompressor() {
      return this.node(Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(k => [k, param(0)])));
    }
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
    createOscillator() { return this.source({ frequency: param(440) }); }
    createBufferSource() { return this.source(); }
    resume() {
      this.resumeCalls++;
      if (this.rejectResume) return Promise.reject(new Error('Browser declined audio'));
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
  for (const [key, value] of Object.entries({ AudioContext: supported ? Context : undefined,
    webkitAudioContext: undefined, navigator: { userActivation: activation }, document })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  return {
    contexts, activation, document, listeners,
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
