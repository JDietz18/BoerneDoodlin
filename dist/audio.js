/* Original, locally synthesized score for Boerne Doodlin’. No audio files or timers.
 * Call unlock() directly in a Start / Resume / Sound button gesture. Nothing in
 * update(), play(), or setEnabled() creates or resumes an AudioContext.
 */

const THEMES = [
  { // Rogue River: a little water-wheel melody.
    root: 50, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 108, swing: .07,
    chords: [0, 3, 5, 4], tone: 'wood', color: 3300,
    phrases: [
      [0, null, 2, null, 4, 2, null, 1, 0, null, 2, 4, null, 1, null, null],
      [2, null, 4, 5, null, 4, null, 2, 1, null, 0, null, 2, null, 0, null]
    ]
  },
  { // Redwood Trail: lower, rounder wooden notes and a lazy skip.
    root: 43, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 104, swing: .13,
    chords: [0, 5, 3, 4], tone: 'wood', color: 2500,
    phrases: [
      [0, null, null, 2, 4, null, 2, null, 3, null, null, 2, 0, null, 1, null],
      [4, null, 2, null, 0, null, null, 1, 2, null, 4, null, 3, 2, null, null]
    ]
  },
  { // Painted Canyon: sunny syncopation, using a warm Dorian color.
    root: 45, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 116, swing: .16,
    chords: [0, 3, 0, 4], tone: 'pluck', color: 3700,
    phrases: [
      [0, null, 4, 2, null, 0, null, 3, 4, null, null, 2, 1, null, 0, null],
      [2, null, 0, null, 4, null, 5, 4, null, 2, null, 1, 0, null, null, null]
    ]
  },
  { // Starlight Mesa: more space between soft glass-and-wood notes.
    root: 52, scale: [0, 2, 3, 5, 7, 9, 10], bpm: 96, swing: .02,
    chords: [0, 5, 3, 0], tone: 'bell', color: 2800,
    phrases: [
      [0, null, null, null, 4, null, 2, null, null, null, 5, null, 4, null, null, null],
      [2, null, null, 4, null, null, 5, null, 4, null, 2, null, 0, null, null, null]
    ]
  },
  { // Boerne Bound: a bright, gently swung homecoming.
    root: 48, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 112, swing: .11,
    chords: [0, 3, 4, 0], tone: 'wood', color: 3500,
    phrases: [
      [0, null, 2, 4, null, 2, null, 0, 4, null, 5, null, 4, 2, null, null],
      [2, null, 4, null, 5, null, 4, 2, 0, null, 1, null, 2, null, 0, null]
    ]
  }
];

const CUE_GAPS = {
  jump: .09, 'double-jump': .09, slide: .18, collect: .065, gold: .12,
  combo: .4, charged: .6, power: .5, hit: .35, shield: .2,
  'near-miss': .12, spring: .16, finish: 1.3, lost: 1.2,
  click: .045, upgrade: .3, unlock: .5, mission: .4,
  'gold-rush': .8, 'mega-stack': 1
};
const ALIASES = {
  double: 'double-jump', chicken: 'gold', zoom: 'power', won: 'finish',
  win: 'finish', lose: 'lost', smash: 'shield', heal: 'shield',
  dodge: 'near-miss', clean: 'near-miss'
};
const MAX_VOICES = 24;
const MAX_MUSIC_VOICES = 12;
const MAX_EFFECT_VOICES = 12;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const number = (n, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
const audioConstructor = () => globalThis.AudioContext || globalThis.webkitAudioContext;

/** Small gesture-safe audio director. `enabled` is the accepted sound preference;
 * unlock() resolves to whether audio is actually running. Call update() per frame.
 */
export class GameAudio {
  constructor({ enabled = false } = {}) {
    this.enabled = Boolean(enabled && audioConstructor());
    this.scene = 'menu';
    this.theme = 0;
    this._ctx = null;
    this._master = null;
    this._music = null;
    this._effects = null;
    this._filter = null;
    this._outputNodes = [];
    this._noise = null;
    this._voices = new Set();
    this._lastCue = new Map();
    this._destroyed = false;
    this._paused = false;
    this._epoch = 0;
    this._step = 0;
    this._nextStep = 0;
    this._musicPlaying = false;
    this._speed = 1;
    this._combo = 0;
    this._power = 0;
    this._duckUntil = 0;
    this._musicLevel = -1;
    this._onVisibility = () => {
      if (globalThis.document?.hidden) this.suspend();
    };
    globalThis.document?.addEventListener?.('visibilitychange', this._onVisibility);
  }

  /** Only call directly in a trusted user gesture; no gesture, no context work.
   * Rejected/unsupported audio resolves false instead of breaking gameplay.
   */
  unlock() {
    if (this._destroyed || !this.enabled || globalThis.document?.hidden) {
      return Promise.resolve(false);
    }
    // UserActivation is not present in every supported browser. Where available,
    // it also protects callers that accidentally invoke unlock from a render loop.
    if (globalThis.navigator?.userActivation?.isActive === false) {
      return Promise.resolve(this._audible());
    }
    if (this._audible()) return Promise.resolve(true);
    const epoch = ++this._epoch;
    try {
      if (!this._ctx || this._ctx.state === 'closed') this._createContext();
      if (!this._ctx) return Promise.resolve(false);
      const ctx = this._ctx;
      this._paused = false;
      this._resetTransport();
      // Always request resume here: it also orders correctly after a pending
      // suspend caused by a very fast off/on toggle. The call stays in the gesture.
      const resumed = ctx.resume();
      if (ctx.state === 'running') this._openMaster();
      return Promise.resolve(resumed).then(() => {
        if (epoch !== this._epoch || ctx !== this._ctx || !this._audible()) return false;
        this._openMaster();
        return true;
      }).catch(() => false);
    } catch {
      // A partially constructed graph is unusable. Release it so a later real
      // gesture can retry cleanly (for example after a mobile audio interruption).
      this._stopVoices();
      const failed = this._ctx;
      this._ctx = null;
      for (const node of this._outputNodes) { try { node.disconnect(); } catch {} }
      this._outputNodes = [];
      if (failed) {
        failed.onstatechange = null;
        try { Promise.resolve(failed.close()).catch(() => {}); } catch {}
      }
      return Promise.resolve(false);
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
    this._stopVoices('music');
    this._resetTransport();
    if (this._filter && this._ctx?.state === 'running') {
      try { this._filter.frequency.setTargetAtTime(THEMES[this.theme].color, this._ctx.currentTime, .08); } catch {}
    }
  }

  /** Short cues are discarded while muted/paused; none are buffered for later. */
  play(name, detail = {}) {
    if (!this._audible()) return false;
    detail = detail && typeof detail === 'object' ? detail : {};
    name = ALIASES[name] || name;
    if (name === 'jump' && detail.double) name = 'double-jump';
    if (name === 'collect' && (detail.gold || detail.chicken || detail.kind === 'gold')) name = 'gold';
    if (!Object.hasOwn(CUE_GAPS, name)) return false;
    const now = this._ctx.currentTime;
    if (now - (this._lastCue.get(name) ?? -Infinity) < CUE_GAPS[name]) return false;
    this._lastCue.set(name, now);
    this._pruneVoices(now);
    const pan = clamp(number(detail.pan), -.5, .5);
    const root = this._scaleNote(0, 12);
    const combo = Math.max(0, Math.trunc(number(detail.combo, this._combo)));
    const start = now + .005;
    const priority = ['hit', 'finish', 'lost', 'power', 'charged'].includes(name) ? 3 : 2;
    let played = false;
    const tone = (freq, duration, kind = 'wood', gain = .12, delay = 0, end = 0) => {
      played = this._tone({ freq, duration, kind, gain, time: start + delay,
        end, pan, group: 'effects', priority }) || played;
    };
    const notes = (degrees, gap = .065, duration = .19, kind = 'wood', gain = .1) => {
      degrees.forEach((degree, i) => tone(frequency(this._scaleNote(degree, 12)), duration, kind, gain, i * gap));
    };
    const air = (duration, cutoff, gain = .045, delay = 0) => {
      played = this._noiseHit(start + delay, duration, cutoff, gain, 'effects', priority, pan) || played;
    };

    switch (name) {
      case 'jump':
        tone(220, .115, 'round', .13, 0, 440);
        break;
      case 'double-jump':
        tone(380, .14, 'round', .12, 0, 760);
        tone(950, .08, 'wood', .04, .035);
        break;
      case 'slide':
        air(.13, 1050, .055);
        tone(145, .1, 'round', .065, 0, 88);
        break;
      case 'collect': {
        const degree = [0, 2, 4, 5, 7][combo % 5];
        tone(frequency(this._scaleNote(degree, 12)), .13, 'wood', .105);
        break;
      }
      case 'gold':
        notes([0, 2, 4], .045, .18, 'bell', .085);
        break;
      case 'combo':
        notes(combo >= 15 ? [4, 5, 7] : [0, 2, 4], .065, .17, 'pluck', .095);
        break;
      case 'charged':
        notes([0, 2, 4, 7], .075, .24, 'bell', .085);
        this._duckUntil = Math.max(this._duckUntil, now + .35);
        break;
      case 'power':
        notes([0, 2, 4, 7, 9], .055, .25, 'pluck', .09);
        air(.18, 1650, .035);
        this._duckUntil = Math.max(this._duckUntil, now + .32);
        break;
      case 'hit':
        tone(138, .17, 'round', .16, 0, 62);
        air(.09, 780, .085);
        this._duckUntil = Math.max(this._duckUntil, now + .35);
        break;
      case 'shield':
        notes([7, 4, 7], .045, .19, 'bell', .075);
        air(.045, 2300, .025);
        break;
      case 'near-miss':
        tone(540, .065, 'round', .045, 0, 810);
        air(.055, 1850, .03);
        break;
      case 'spring':
        tone(135, .22, 'pluck', .115, 0, 700);
        tone(430, .13, 'wood', .055, .11, 590);
        break;
      case 'finish':
        notes([0, 2, 4, 7, 4, 7], .1, .34, 'wood', .11);
        tone(frequency(root - 12), .48, 'round', .08, .3);
        this._duckUntil = Math.max(this._duckUntil, now + 1);
        break;
      case 'lost':
        notes([4, 2, 0], .15, .3, 'wood', .085);
        this._duckUntil = Math.max(this._duckUntil, now + .8);
        break;
      case 'click':
        tone(590, .045, 'wood', .055);
        break;
      case 'upgrade':
        notes([0, 2, 4, 7], .065, .22, 'pluck', .095);
        break;
      case 'unlock':
        notes([0, 4, 2, 5, 4, 7], .07, .26, 'bell', .085);
        break;
      case 'mission':
        notes([4, 2, 7], .09, .25, 'wood', .1);
        break;
      case 'gold-rush':
        notes([0, 4, 7], .075, .25, 'bell', .085);
        this._duckUntil = Math.max(this._duckUntil, now + .3);
        break;
      case 'mega-stack':
        notes([2, 5, 9], .085, .24, 'pluck', .09);
        this._duckUntil = Math.max(this._duckUntil, now + .35);
        break;
    }
    return played;
  }

  /** speed is a ratio (1 = normal), combo is the current chain count.
   * A non-running run scene is silent; menu/result have their own softer score.
   */
  update(dt, { speed = 1, combo = 0, power = false, running = false } = {}) {
    if (!this._audible()) return;
    const now = this._ctx.currentTime;
    this._pruneVoices(now);
    const blend = 1 - Math.exp(-clamp(number(dt, 1 / 60), 0, .1) * 5);
    this._speed += (clamp(number(speed, 1), .6, 2.4) - this._speed) * blend;
    this._combo = clamp(number(combo), 0, 10000);
    this._power += ((power ? 1 : 0) - this._power) * blend;
    const shouldPlay = this.scene !== 'run' || Boolean(running);
    if (!shouldPlay) {
      if (this._musicPlaying) this._stopVoices('music');
      this._musicPlaying = false;
      this._nextStep = 0;
      return;
    }
    this._musicPlaying = true;
    const night = this.theme === 3 ? .82 : 1;
    const sceneLevel = this.scene === 'run' ? .38 : this.scene === 'menu' ? .22 : .18;
    const level = sceneLevel * night * (now < this._duckUntil ? .42 : 1);
    if (Math.abs(level - this._musicLevel) > .005) {
      this._musicLevel = level;
      try { this._music.gain.setTargetAtTime(level, now, .045); } catch {}
    }
    // Audio-clock scheduling tolerates normal frame jitter. Long frame gaps drop
    // missed notes rather than catching up in an unpleasant burst.
    if (!this._nextStep || this._nextStep < now - .06) this._nextStep = now + .025;
    const theme = THEMES[this.theme];
    const pace = this.scene === 'run' ? 1 + (this._speed - 1) * .075 + this._power * .045
      : this.scene === 'menu' ? .76 : .68;
    const sixteenth = 60 / (theme.bpm * pace) / 4;
    let scheduled = 0;
    while (this._nextStep < now + .105 && scheduled < 4) {
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
    if (!this._ctx || this._ctx.state === 'closed') return;
    try {
      this._master.gain.cancelScheduledValues(this._ctx.currentTime);
      this._master.gain.setValueAtTime(0, this._ctx.currentTime);
      Promise.resolve(this._ctx.suspend()).catch(() => {});
    } catch {}
  }

  destroy() {
    if (this._destroyed) return;
    this.suspend();
    this._destroyed = true;
    this.enabled = false;
    globalThis.document?.removeEventListener?.('visibilitychange', this._onVisibility);
    const ctx = this._ctx;
    this._ctx = null;
    if (ctx) {
      ctx.onstatechange = null;
      try { Promise.resolve(ctx.close()).catch(() => {}); } catch {}
    }
    for (const node of this._outputNodes) { try { node.disconnect(); } catch {} }
    this._outputNodes = [];
    this._noise = this._master = this._music = this._effects = this._filter = null;
  }

  _audible() {
    return this.enabled && !this._destroyed && !this._paused && this._ctx?.state === 'running';
  }

  _createContext() {
    const Context = audioConstructor();
    if (!Context) { this.enabled = false; return; }
    this._stopVoices();
    this._lastCue.clear();
    for (const node of this._outputNodes) { try { node.disconnect(); } catch {} }
    this._outputNodes = [];
    const ctx = new Context({ latencyHint: 'interactive' });
    this._ctx = ctx;
    this._master = ctx.createGain();
    this._master.gain.value = 0;
    this._music = ctx.createGain();
    this._music.gain.value = 0;
    this._effects = ctx.createGain();
    this._effects.gain.value = .64;
    this._filter = ctx.createBiquadFilter();
    this._filter.type = 'lowpass';
    this._filter.frequency.value = THEMES[this.theme].color;
    this._filter.Q.value = .45;
    this._music.connect(this._filter);
    this._filter.connect(this._master);
    this._effects.connect(this._master);
    this._outputNodes = [this._music, this._effects, this._filter, this._master];
    if (typeof ctx.createDynamicsCompressor === 'function') {
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 16;
      compressor.ratio.value = 3;
      compressor.attack.value = .004;
      compressor.release.value = .14;
      this._master.connect(compressor);
      compressor.connect(ctx.destination);
      this._outputNodes.push(compressor);
    } else {
      this._master.connect(ctx.destination);
    }
    this._noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .3), ctx.sampleRate);
    const noise = this._noise.getChannelData(0);
    let seed = 93247;
    for (let i = 0; i < noise.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      noise[i] = (seed / 2147483648) * .7;
    }
    ctx.onstatechange = () => {
      if (ctx !== this._ctx || this._destroyed) return;
      this._nextStep = 0;
      if (ctx.state !== 'running') this._stopVoices();
      else if (this.enabled && !this._paused) this._openMaster();
    };
  }

  _openMaster() {
    if (!this._audible()) return;
    const now = this._ctx.currentTime;
    try {
      this._master.gain.cancelScheduledValues(now);
      this._master.gain.setTargetAtTime(.7, now, .018);
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

  _musicStep(step, time) {
    const theme = THEMES[this.theme];
    const beat = step % 16;
    const bar = Math.floor(step / 16);
    const chord = theme.chords[bar % theme.chords.length];
    const calm = this.scene !== 'run';
    const phrase = theme.phrases[Math.floor(bar / 2) % theme.phrases.length];
    const degree = phrase[beat];
    const note = (degree, offset, duration, gain, kind = theme.tone, pan = 0) => {
      this._tone({ freq: frequency(this._scaleNote(degree, offset)), time, duration,
        gain, kind, pan, group: 'music', priority: 0 });
    };
    if (degree !== null && (!calm || beat % 4 === 0)) {
      note(chord + degree, 12, calm ? .32 : .2, calm ? .075 : .095, theme.tone, -.15);
    }
    if (beat === 0 || (!calm && beat === 8)) {
      note(chord + (beat === 8 ? 4 : 0), theme.root >= 48 ? -12 : 0, .25, .12, 'round');
    }
    if ((beat === 0 || beat === 8) && (calm || this._combo >= 5 || this._power > .35)) {
      note(chord + 2, 0, .38, .035, 'pad', .14);
      note(chord + 4, 0, .38, .03, 'pad', .14);
    }
    if (!calm) {
      if (beat === 0 || beat === 8) {
        this._tone({ freq: 110, end: 52, duration: .085, gain: .11, kind: 'round', time,
          group: 'music', priority: 0 });
      }
      if (beat === 4 || beat === 12) this._noiseHit(time, .045, 1600, .04, 'music', 0, .1);
      if (beat % 4 === 2 || (this._combo >= 10 && beat % 2 === 1)) {
        this._noiseHit(time, .025, 3900, this._combo >= 10 ? .022 : .017, 'music', 0, -.12);
      }
      if (this._power > .5 && beat % 4 === 2) note(chord + [4, 7, 5, 2][Math.floor(beat / 4)], 12, .11, .038, 'pluck', .18);
    }
  }

  _reserve(group, priority) {
    this._pruneVoices(this._ctx.currentTime);
    const groupCount = [...this._voices].filter(voice => voice.group === group).length;
    const limit = group === 'music' ? MAX_MUSIC_VOICES : MAX_EFFECT_VOICES;
    if (this._voices.size < MAX_VOICES && groupCount < limit) return true;
    // Important feedback can replace a lower-priority tail. Ordinary collection
    // chains and music simply skip notes instead of growing an audio backlog.
    const victims = [...this._voices].filter(voice => voice.priority < priority &&
      (groupCount < limit || voice.group === group));
    victims.sort((a, b) => a.priority - b.priority || a.end - b.end);
    if (!victims.length) return false;
    this._finishVoice(victims[0]);
    return true;
  }

  _tone({ freq, time, duration, gain, kind, end = 0, pan = 0, group, priority }) {
    if (!this._audible() || !this._reserve(group, priority)) return false;
    const ctx = this._ctx;
    const nodes = [], sources = [];
    try {
      const start = Math.max(ctx.currentTime + .001, number(time, ctx.currentTime));
      const length = clamp(number(duration, .15), .025, .8);
      const stop = start + length + .025;
      const envelope = ctx.createGain();
      nodes.push(envelope);
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(clamp(number(gain), 0, .2), start + (kind === 'pad' ? .045 : .004));
      envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
      envelope.gain.linearRampToValueAtTime(0, stop);
      this._connectVoice(envelope, group, pan, nodes);
      const base = clamp(number(freq, 440), 35, 4500);
      const partials = kind === 'wood' ? [[1, 1, 'sine'], [3, .16, 'sine']]
        : kind === 'bell' ? [[1, 1, 'sine'], [2.01, .18, 'sine']]
        : kind === 'pluck' ? [[1, .85, 'triangle'], [2, .08, 'sine']]
        : [[1, 1, kind === 'pad' ? 'triangle' : 'sine']];
      for (const [ratio, level, type] of partials) {
        const source = ctx.createOscillator();
        const partial = ctx.createGain();
        nodes.push(source, partial); sources.push(source);
        source.type = type;
        source.frequency.setValueAtTime(Math.min(8000, base * ratio), start);
        if (end > 0) source.frequency.exponentialRampToValueAtTime(clamp(end * ratio, 35, 8000), start + length * .85);
        partial.gain.setValueAtTime(level, start);
        if (ratio > 1) partial.gain.exponentialRampToValueAtTime(.001, start + Math.min(length, .085));
        source.connect(partial); partial.connect(envelope);
      }
      this._trackVoice({ nodes, sources, group, priority, start, end: stop });
      for (const source of sources) { source.start(start); source.stop(stop); }
      return true;
    } catch {
      for (const node of nodes) { try { node.disconnect(); } catch {} }
      for (const source of sources) { try { source.stop(); } catch {} }
      return false;
    }
  }

  _noiseHit(time, duration, cutoff, gain, group, priority, pan = 0) {
    if (!this._audible() || !this._noise || !this._reserve(group, priority)) return false;
    const ctx = this._ctx;
    const nodes = [], sources = [];
    try {
      const start = Math.max(ctx.currentTime + .001, time);
      const length = clamp(duration, .015, .25);
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      nodes.push(source, filter, envelope); sources.push(source);
      source.buffer = this._noise;
      filter.type = 'bandpass';
      filter.frequency.value = cutoff;
      filter.Q.value = .65;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(gain, start + .003);
      envelope.gain.exponentialRampToValueAtTime(.0001, start + length);
      source.connect(filter); filter.connect(envelope);
      this._connectVoice(envelope, group, pan, nodes);
      this._trackVoice({ nodes, sources, group, priority, start, end: start + length + .015 });
      source.start(start); source.stop(start + length + .015);
      return true;
    } catch {
      for (const node of nodes) { try { node.disconnect(); } catch {} }
      for (const source of sources) { try { source.stop(); } catch {} }
      return false;
    }
  }

  _connectVoice(envelope, group, pan, nodes) {
    const target = group === 'music' ? this._music : this._effects;
    if (typeof this._ctx.createStereoPanner === 'function' && pan) {
      const panner = this._ctx.createStereoPanner();
      panner.pan.value = clamp(pan, -.5, .5);
      nodes.push(panner);
      envelope.connect(panner); panner.connect(target);
    } else envelope.connect(target);
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
}
