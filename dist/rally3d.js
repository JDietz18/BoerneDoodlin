// Doodle Onward · deterministic RV Rally simulation and native WebGL scenery.
// No network, third-party renderer, textures, or saved-state side effects.
// RallyRun is the seeded 60-second drive; RallyRenderer draws it with WebGL or
// a software 3D fallback, and layers shared game feel (fx.js) over either.
import { Juice, hash01 } from './fx.js?v=21';

export const RALLY_WORLD = Object.freeze({ lanes: Object.freeze([-3, 0, 3]), halfWidth: 4.8, viewDistance: 175 });
// Simulation-time beats shared by the engine and the view, so pause freezes them.
export const RALLY_TIMING = Object.freeze({ countdown: Object.freeze([0, .8, 1.6]), go: 2.4, finalPush: 10, finishGlide: .6 });
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(Number(v)) ? Number(v) : a));
const copy = value => JSON.parse(JSON.stringify(value));
const CHARACTERS = ['griffin', 'kevin', 'mittens', 'spike'];
const TURN = Math.PI * 2;
const TIMERS = ['powerTime', 'invincible', 'magnetTime', 'goldRushTime', 'feverTime', '_feverCooldown', 'comboTime', 'splashTime'];
const SIZES = { barrier: [1.9, .7], cone: [1, .6], ramp: [2.2, 3], splash: [2.6, 4] };
const JUMP = Object.freeze({ length: 26, height: 2.7, lead: .6 });
const NEAR_MISS_GAP = .75;
// Share of the RV's sideways travel the camera follows. The rest shows as movement on screen.
const CAMERA_FOLLOW = .4;
// One course twist per world. `bend`/`lift` shape the road ahead (a sine with
// the heading removed, so the road is always straight under the RV).
const TWISTS = Object.freeze([
  { id: 'spray', bend: 3.2, wave: 270, lift: 0, liftWave: 160, drift: 0, convoyEvery: 6 },
  { id: 'bends', bend: 6.5, wave: 185, lift: 0, liftWave: 160, drift: 1.5, convoyEvery: 6 },
  { id: 'ramps', bend: 2.4, wave: 330, lift: 0, liftWave: 160, drift: 0, convoyEvery: 6 },
  { id: 'stars', bend: 2, wave: 420, lift: 0, liftWave: 160, drift: 0, convoyEvery: 6 },
  { id: 'hills', bend: 3, wave: 300, lift: 2.2, liftWave: 150, drift: 0, convoyEvery: 4 }
]);
let sequence = 0;
function seeded(seed) {
  let state = Number(seed) >>> 0;
  return () => { state = (state + 0x6d2b79f5) >>> 0; let n = Math.imul(state ^ state >>> 15, state | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}

export class RallyRun {
  constructor({ onEvent = () => {} } = {}) {
    this.onEvent = onEvent; this._quiet = true; this.reset(); this._quiet = false; this.mode = 'ready';
  }
  emit(type, detail = {}) { if (!this._quiet) this.onEvent({ ...detail, type }); }
  reset({ worldIndex = 0, characterId = 'griffin', seed = 1, gear = {}, assist = false, charms = {}, dailyDate = '' } = {}) {
    this.worldIndex = Math.round(clamp(worldIndex, 0, 4)); this.stage = this.worldIndex;
    this.characterId = CHARACTERS.includes(characterId) ? characterId : 'griffin';
    this.seed = Number(seed) >>> 0; this._random = seeded(this.seed);
    this.dailyDate = String(dailyDate || ''); this.assist = Boolean(assist && !this.dailyDate);
    this.gear = { magnet: 0, charge: 0, heart: 0 };
    for (const key of Object.keys(this.gear)) this.gear[key] = this.dailyDate ? 0 : Math.round(clamp(gear?.[key] || 0, 0, key === 'heart' ? 2 : 3));
    this.charms = this.dailyDate ? {} : {
      shieldStart: Boolean(charms?.shieldStart), comboGrace: clamp(charms?.comboGrace || 0, 0, 4),
      goldDuration: clamp(charms?.goldDuration || 0, 0, 4), speed: clamp(charms?.speed || 0, 0, .3),
      powerDuration: clamp(charms?.powerDuration || 0, 0, 3)
    };
    this.runId = `rally-${Date.now().toString(36)}-${++sequence}`;
    this.mode = 'running'; this.runMode = 'rally'; this.time = 0; this.timeLimit = 60;
    this.score = 0; this.treats = 0; this.gold = 0; this.distance = 0; this.hits = 0; this.dodged = 0;
    this.combo = 0; this.bestCombo = 0; this.multiplier = 1; this.totalMultiplier = 1; this.bestMultiplier = 1; this.comboTime = 0;
    this.maxHearts = 3 + this.gear.heart + (this.characterId === 'spike' ? 1 : 0) + (this.assist ? 1 : 0); this.hearts = this.maxHearts;
    this.charge = 45 + this.gear.charge * 10; this.powerTime = 0; this.powerDuration = 0; this.powersUsed = 0;
    this.invincible = 0; this.magnetTime = 0; this.goldRushTime = 0; this.feverTime = 0; this._feverCooldown = 0;
    this.shieldCharges = this.charms.shieldStart ? 1 : 0;
    this.player = { x: 0, y: 0, z: 0, vx: 0, width: 1.35, length: 2.8 };
    this.speed = 21 + this.worldIndex * 1.2; this.steering = 0; this.steerTarget = null; this.braking = false;
    // The twist stream is separate from the obstacle stream: adding scenery
    // never moves a cone, so every seed keeps its familiar course.
    const twist = TWISTS[this.worldIndex]; this._twist = twist; this.twist = twist.id; this._twistRandom = seeded((this.seed ^ 0x5bd1e995) >>> 0);
    this.road = {
      bend: twist.bend, bendFreq: TURN / twist.wave, bendPhase: this._twistRandom() * TURN,
      lift: twist.lift, liftFreq: TURN / twist.liftWave, liftPhase: this._twistRandom() * TURN,
      drift: twist.drift * (this.assist ? .5 : 1)
    };
    this.jump = null; this.splashTime = 0; this.nearMisses = 0; this.jumps = 0; this.splashes = 0; this.convoys = 0;
    this._cleared = 0; this._convoys = []; this._convoyNext = 0;
    this.entities = []; this.courseHistory = []; this._nextRow = 74; this._row = 0; this._id = 0; this._safeLane = 1; this._summary = null;
    for (const z of [22, 31, 40, 49]) this._add('bone', 0, z);
    this._ensureCourse(); this.emit('start', { mode: 'rally', runId: this.runId, worldIndex: this.worldIndex }); return this;
  }
  /** Digital or analog steering, -1 (left) to 1 (right). Lets go of any drag target. */
  move(direction) { if (this.mode === 'running') { this.steerTarget = null; this.steering = clamp(direction, -1, 1); } }
  /** Analog steering for a thumb drag or device tilt. Same range as move(). */
  steer(value) { this.move(value); }
  /** Drag steering: glide to a road position (-3.9 to 3.9) and settle there. Pass null to let go. */
  steerTo(x) {
    if (this.mode !== 'running') return;
    if (x === null || x === undefined || !Number.isFinite(Number(x))) { this.steerTarget = null; this.steering = 0; }
    else this.steerTarget = clamp(x, -3.9, 3.9);
  }
  brake(held) { if (this.mode === 'running') this.braking = Boolean(held); }
  power() {
    if (this.mode !== 'running' || this.charge < 100 || this.powerTime > 0) return false;
    this.charge = 0; this.powersUsed++;
    this.powerDuration = (this.characterId === 'kevin' ? 5.5 : 4.5) + (this.charms.powerDuration || 0);
    this.powerTime = this.powerDuration;
    if (this.characterId === 'mittens' && this.hearts < this.maxHearts) { this.hearts++; this.emit('heal', { hearts: this.hearts }); }
    this._multipliers(); this.emit('power', { characterId: this.characterId, duration: this.powerDuration }); return true;
  }
  pause() { if (this.mode === 'running') { this.mode = 'paused'; this.steering = 0; this.steerTarget = null; this.braking = false; this.player.vx = 0; this.emit('pause'); } }
  resume() { if (this.mode === 'paused') { this.mode = 'running'; this.emit('resume'); } }
  /** 3, 2, 1 during the rolling start, then 0. */
  get countdown() { const t = this.time, beats = RALLY_TIMING.countdown; return t >= RALLY_TIMING.go ? 0 : t >= beats[2] ? 1 : t >= beats[1] ? 2 : 3; }
  /** -1 to 1: positive while the road ahead sweeps to the right. */
  get curvature() { return -Math.sin(this.road.bendFreq * this.distance + this.road.bendPhase); }
  /** Sideways shift of the road centre `ahead` units in front of the RV. */
  roadOffset(ahead) { const r = this.road, t = r.bendFreq * this.distance + r.bendPhase; if (!r.bend || !ahead) return 0; return r.bend * (Math.sin(t + r.bendFreq * ahead) - Math.sin(t) - r.bendFreq * ahead * Math.cos(t)); }
  /** Rise or fall of the road `ahead` units in front of the RV. */
  roadLift(ahead) { const r = this.road, t = r.liftFreq * this.distance + r.liftPhase; if (!r.lift || !ahead) return 0; return r.lift * (Math.sin(t + r.liftFreq * ahead) - Math.sin(t) - r.liftFreq * ahead * Math.cos(t)); }
  _add(type, x, worldZ, extra = null) {
    const size = SIZES[type];
    const entity = { id: ++this._id, type, x, z: worldZ - this.distance, worldZ,
      width: size ? size[0] : .55, depth: size ? size[1] : .6, hit: false, taken: false, passed: false };
    if (extra) Object.assign(entity, extra);
    this.entities.push(entity); return entity;
  }
  _ensureCourse() {
    while (this._nextRow < this.distance + RALLY_WORLD.viewDistance + 32) {
      const rowZ = this._nextRow;
      const step = this._random() < .5 ? -1 : 1;
      this._safeLane = this._row === 0 ? 1 : Math.max(0, Math.min(2, this._safeLane + step));
      const safe = this._safeLane;
      const other = [0, 1, 2].filter(lane => lane !== safe);
      const blocked = this.worldIndex >= 2 && this._row % 3 === 2 ? other : [other[this._random() < .5 ? 0 : 1]];
      for (const lane of blocked) this._add(this._row % 4 === 3 ? 'barrier' : 'cone', RALLY_WORLD.lanes[lane], rowZ);
      for (const offset of [-11, 0, 10]) this._add(this._row % 5 === 4 && offset === 0 ? 'gold' : 'bone', RALLY_WORLD.lanes[safe], rowZ + offset);
      if (this._row % 5 === 2) this._add(['shield', 'magnet', 'heart'][Math.floor(this._row / 5) % 3], RALLY_WORLD.lanes[safe], rowZ + 18);
      this._decorate(rowZ, safe, blocked, this.courseHistory.at(-1));
      this.courseHistory.push({ z: rowZ, safeLane: safe, blocked: [...blocked] });
      if (this.courseHistory.length > 80) this.courseHistory.shift();
      this._nextRow += 44 + this._random() * 9; this._row++;
    }
  }
  // Seeded extras layered on top of a row: snack convoys everywhere, plus the
  // world's own twist. Nothing here ever blocks the open lane.
  _decorate(rowZ, safe, blocked, previous) {
    const twist = this._twist, random = this._twistRandom, row = this._row, lanes = RALLY_WORLD.lanes;
    if (previous && row % twist.convoyEvery === 4 % twist.convoyEvery && (row - 1) % 5 !== 2) {
      const from = previous.z + 14, to = rowZ - 15, count = Math.max(5, Math.min(9, Math.floor((to - from) / 2.7) + 1));
      const x0 = lanes[previous.safeLane], x1 = lanes[safe], side = x0 !== x1 ? 0 : x0 > 0 ? -1 : x0 < 0 ? 1 : random() < .5 ? -1 : 1;
      const id = this._convoys.length + 1;
      for (let i = 0; i < count; i++) {
        const u = i / (count - 1), ease = u * u * (3 - 2 * u);
        this._add('bone', x0 + (x1 - x0) * ease + side * 1.7 * Math.sin(Math.PI * u), from + (to - from) * u, { convoy: id });
      }
      this._convoys.push({ id, z: from, total: count, taken: 0 });
    }
    if (twist.id === 'spray' && row % 3 === 1) this._add('splash', lanes[Math.floor(random() * 3)], rowZ + 24);
    // A ramp every fourth row. Where a convoy starts right behind the landing,
    // the ramp waits two rows, so a jump never costs a perfect line.
    if (twist.id === 'ramps' && (row % 12 === 9 ? false : row % 12 === 11 || row % 4 === 1)) {
      const beside = blocked.filter(lane => Math.abs(lane - safe) === 1), choices = beside.length ? beside : blocked;
      const x = lanes[choices[Math.floor(random() * choices.length)]], z = rowZ - 12;
      this._add('ramp', x, z);
      [7, 13, 19].forEach((ahead, i) => { const u = (ahead + JUMP.lead) / JUMP.length; this._add(i === 1 && row % 8 === 1 ? 'gold' : 'bone', x, z + ahead, { y: JUMP.height * 4 * u * (1 - u) }); });
    }
    if (twist.id === 'stars' && row % 5 === 1) {
      const beside = [safe - 1, safe + 1].filter(lane => lane >= 0 && lane <= 2);
      this._add('star', lanes[beside[Math.floor(random() * beside.length)]], rowZ + 26);
    }
  }
  update(dt) {
    if (this.mode !== 'running') return;
    let remaining = clamp(dt || 0, 0, .1);
    while (remaining > 1e-8 && this.mode === 'running') { const step = Math.min(1 / 120, remaining); remaining -= step; this._step(step); }
  }
  // Countdown, final stretch, and finish beats, all on simulation time.
  _timeline(before) {
    const now = this.time, end = this.timeLimit, beats = RALLY_TIMING.countdown, crossed = at => before < at && now >= at;
    if (before === 0 && now > 0) this.emit('countdown', { count: 3 });
    if (crossed(beats[1])) this.emit('countdown', { count: 2 });
    if (crossed(beats[2])) this.emit('countdown', { count: 1 });
    if (crossed(RALLY_TIMING.go)) this.emit('go');
    if (crossed(end - RALLY_TIMING.finalPush)) this.emit('final-push', { seconds: RALLY_TIMING.finalPush });
    for (let seconds = 3; seconds >= 1; seconds--) if (crossed(end - seconds)) this.emit('final-tick', { seconds });
    if (crossed(end - RALLY_TIMING.finishGlide)) this.emit('finish-line', { score: Math.round(this.score), hearts: this.hearts });
  }
  _step(dt) {
    dt = Math.min(dt, this.timeLimit - this.time); const before = this.time; this.time += dt;
    for (const key of TIMERS) this[key] = Math.max(0, this[key] - dt);
    if (!this.comboTime) { this.combo = 0; this.multiplier = 1; }
    const beforeCharge = this.charge;
    this.charge = Math.min(this.powerTime > 0 ? 90 : 100, this.charge + dt * (1.8 + this.gear.charge * .35));
    if (beforeCharge < 100 && this.charge >= 100) this.emit('charged');
    this._timeline(before);
    if (this.mode !== 'running') return;
    const targetSpeed = (21 + this.worldIndex * 1.2 + this.time * .035) * (this.assist ? .82 : 1) * (this.braking ? .58 : 1) * (this.powerTime > 0 ? 1.18 : 1) * (this.splashTime > 0 ? 1.2 : 1);
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 4);
    this.distance += this.speed * dt;
    const p = this.player;
    // A ramp arc is measured in road distance, so braking or boosting in the
    // air never changes where the RV comes down.
    if (this.jump) {
      const u = (this.distance - this.jump.from) / JUMP.length;
      if (u >= 1) {
        const cleared = this._cleared, value = cleared * 50; this._cleared = 0; this.jump = null; p.y = 0; this.score += value;
        this.emit('landing', { cleared, value, x: p.x });
      } else p.y = JUMP.height * 4 * Math.max(0, u) * (1 - u);
    }
    if (this.steerTarget !== null) this.steering = clamp((this.steerTarget - p.x) * .7, -1, 1);
    const targetVx = this.steering * (this.assist ? 7.5 : 7) * (1 + (this.charms.speed || 0)) * (p.y > 0 ? .6 : 1);
    p.vx += (targetVx - p.vx) * Math.min(1, dt * 13);
    const drift = this.road.drift ? this.curvature * this.road.drift : 0;
    p.x = Math.max(-3.9, Math.min(3.9, p.x + (p.vx - drift) * dt));
    if (Math.abs(p.x) === 3.9 && Math.sign(p.vx) === Math.sign(p.x)) p.vx = 0;
    this._ensureCourse(); this._multipliers();
    const convoy = this._convoys[this._convoyNext];
    if (convoy && convoy.z - this.distance < 70) { this._convoyNext++; if (this.timeLimit - this.time > 4) this.emit('convoy-start', { count: convoy.total }); }
    // After the finish line the last moments are a victory roll: nothing can hurt.
    const gliding = this.time > this.timeLimit - RALLY_TIMING.finishGlide, airborne = p.y > .9;
    for (const e of this.entities) {
      e.z = e.worldZ - this.distance;
      if (e.taken || e.passed) continue;
      if (e.type === 'cone' || e.type === 'barrier') {
        const close = e.z < 1.4 + e.depth * .5 && e.z > -1.5 - e.depth * .5;
        if (close && !e.hit) {
          const gap = Math.abs(e.x - p.x) - (e.width + p.width) * .42;
          if (airborne) { if (gap < .4) e.jumped = true; }
          else if (gap < 0 && !gliding) {
            e.hit = true;
            if (this.powerTime > 0) { const value = this.characterId === 'spike' ? 90 : 40; this.score += value; this.emit('smash', { kind: e.type, value, x: e.x, z: e.z }); }
            else if (!this.invincible) {
              if (this.shieldCharges > 0) { this.shieldCharges--; this.invincible = 1; this.emit('shield', { x: e.x, z: e.z }); }
              else {
                this.hearts--; this.hits++; this.combo = 0; this.multiplier = 1; this.comboTime = 0; this.charge = Math.max(0, this.charge - 10);
                this.invincible = this.assist ? 2 : 1.5; this._multipliers(); this.emit('hit', { hearts: this.hearts, x: p.x, z: 0, kind: e.type });
                if (this.hearts <= 0) { this._finish(false); return; }
              }
            }
          } else if (gap >= 0 && !(e.gap <= gap)) e.gap = gap;
        }
        if (e.z < -2.1) {
          e.passed = true;
          if (!e.hit) {
            this.dodged++; this.score += 20; this._charge(4); this.emit('dodge', { kind: e.type, value: 20, x: e.x, z: e.z, air: Boolean(e.jumped) });
            if (e.jumped) this._cleared++;
            else if (e.gap < NEAR_MISS_GAP) {
              this.nearMisses++; this.score += 30; this._charge(5);
              this.emit('near-miss', { kind: e.type, value: 30, gap: Number(e.gap.toFixed(3)), side: e.x < p.x ? -1 : 1, x: e.x, z: e.z });
            }
          }
        }
      } else if (e.type === 'ramp') {
        if (!this.jump && e.z < JUMP.lead && e.z > -1.5 && Math.abs(e.x - p.x) < 1.25) {
          e.passed = true; e.used = true; this.jumps++; this._cleared = 0; this.jump = { from: e.worldZ - JUMP.lead };
          this.emit('ramp', { x: e.x, z: e.z });
        } else if (e.z < -3) e.passed = true;
      } else if (e.type === 'splash') {
        if (p.y < .5 && Math.abs(e.z) < 2 && Math.abs(e.x - p.x) < 1.6) {
          e.passed = true; e.used = true; this.splashes++; this.splashTime = 1.3; this.score += 25;
          this.emit('splash', { value: 25, x: e.x, z: e.z });
        } else if (e.z < -3) e.passed = true;
      } else {
        const reach = .72 + this.gear.magnet * .16 + (this.magnetTime > 0 ? .85 : 0) + (this.powerTime > 0 ? this.characterId === 'kevin' ? 2.4 : .5 : 0);
        if (e.z < 1.7 && e.z > -1.8 && Math.abs(e.x - p.x) < reach && Math.abs((e.y || 0) - p.y) < 1.4) this._collect(e);
        else if (e.z < -2.1) e.passed = true;
      }
      if (this.mode !== 'running') return;
    }
    this.entities = this.entities.filter(e => e.z > -16 && !e.taken);
    if (this.time >= this.timeLimit - 1e-8) { this.time = this.timeLimit; this._finish(true); }
  }
  _charge(amount) { const old = this.charge; this.charge = Math.min(this.powerTime > 0 ? 90 : 100, this.charge + amount * (1 + this.gear.charge * .1)); if (old < 100 && this.charge >= 100) this.emit('charged'); }
  _multipliers() {
    this.totalMultiplier = Math.min(30, this.multiplier * (this.goldRushTime > 0 ? 2 : 1) * (this.feverTime > 0 ? 2 : 1) * (this.powerTime > 0 && this.characterId === 'griffin' ? 1.5 : 1));
    this.bestMultiplier = Math.max(this.bestMultiplier, this.totalMultiplier);
  }
  _collect(e) {
    e.taken = true; let value = 30;
    if (e.type === 'bone' || e.type === 'gold') {
      this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo); this.comboTime = 5 + (this.charms.comboGrace || 0);
      this.multiplier = Math.min(5, 1 + Math.floor(this.combo / 5));
      if (e.type === 'gold') { this.gold++; this.goldRushTime = Math.min(14, this.goldRushTime + 7 + (this.charms.goldDuration || 0)); this.emit('gold-rush', { duration: this.goldRushTime }); }
      if (this.combo >= 20 && !this._feverCooldown) { this.feverTime = 7; this._feverCooldown = 24; this.emit('fever', { duration: 7 }); }
      this._multipliers(); value = Math.round((e.type === 'gold' ? 100 : 15) * this.totalMultiplier);
      this.treats += e.type === 'gold' ? 3 : 1; this._charge(e.type === 'gold' ? 15 : 6);
      if (this.combo % 5 === 0) this.emit('combo', { combo: this.combo, multiplier: this.multiplier, totalMultiplier: this.totalMultiplier });
    } else if (e.type === 'shield') { this.shieldCharges = Math.min(2, this.shieldCharges + 1); this.emit('pickup', { kind: 'shield' }); }
    else if (e.type === 'magnet') { this.magnetTime = Math.min(16, this.magnetTime + 8); this.emit('pickup', { kind: 'magnet', duration: this.magnetTime }); }
    else if (e.type === 'heart') { this.hearts = Math.min(this.maxHearts, this.hearts + 1); this.emit('heal', { hearts: this.hearts }); }
    else if (e.type === 'star') { value = 50; this._charge(40); this.emit('pickup', { kind: 'star' }); }
    this.score += value; this.emit('collect', { kind: e.type, value, combo: this.combo, multiplier: this.multiplier, totalMultiplier: this.totalMultiplier, x: e.x, y: e.y || 0, z: e.z, convoy: Boolean(e.convoy) });
    const convoy = e.convoy ? this._convoys[e.convoy - 1] : null;
    if (convoy && ++convoy.taken === convoy.total) {
      const bonus = Math.round(100 * this.totalMultiplier); this.convoys++; this.score += bonus;
      this.emit('convoy', { count: convoy.total, value: bonus, x: e.x, z: e.z });
    }
  }
  _snapshot() { return { runId: this.runId, mode: 'rally', state: this.mode, won: this.mode === 'won', worldIndex: this.worldIndex, stage: this.worldIndex, characterId: this.characterId, seed: this.seed, dailyDate: this.dailyDate, assist: this.assist, gear: { ...this.gear }, charms: { ...this.charms }, score: Math.round(this.score), treats: this.treats, gold: this.gold, distance: Math.round(this.distance), dodged: this.dodged, hits: this.hits, bestCombo: this.bestCombo, bestMultiplier: this.bestMultiplier, powersUsed: this.powersUsed, hearts: this.hearts, maxHearts: this.maxHearts, time: Number(this.time.toFixed(3)), twist: this.twist, nearMisses: this.nearMisses, jumps: this.jumps, splashes: this.splashes, convoys: this.convoys }; }
  _finish(won) { if (this.mode !== 'running' || this._summary) return; this.mode = won ? 'won' : 'lost'; this.steering = 0; this.steerTarget = null; this.braking = false; if (won) this.score += this.hearts * 80 + (this.hits === 0 ? 200 : 0); this._summary = this._snapshot(); this.emit(this.mode, { result: this.result() }); }
  result() { return copy(this._summary || this._snapshot()); }
}

// --- palettes -------------------------------------------------------------
// zenith and fog shape the sky; `sun` is [x, y, radius]; `night` turns on headlights.
const THEMES = [
  { zenith: [.34, .64, .82], fog: [.76, .9, .86], ground: [.33, .58, .36], shoulder: [.5, .66, .4], road: [.3, .36, .38], edge: [.93, .42, .3],
    tree: [.14, .38, .27], trunk: [.38, .27, .19], rock: [.55, .58, .56], far: [.3, .52, .5], accent: [.22, .6, .76], sun: [-70, 62, 12], sunColor: [1, .96, .78], dust: '#efe6cc', night: 0, clouds: 1 },
  { zenith: [.33, .52, .42], fog: [.66, .79, .63], ground: [.22, .37, .24], shoulder: [.3, .42, .25], road: [.31, .33, .3], edge: [.86, .62, .26],
    tree: [.1, .27, .18], trunk: [.5, .25, .17], rock: [.36, .42, .33], far: [.2, .36, .27], accent: [.36, .6, .3], sun: [44, 74, 10], sunColor: [1, .97, .8], dust: '#cdbf9f', night: 0, clouds: 0 },
  { zenith: [.25, .55, .86], fog: [.97, .82, .64], ground: [.8, .5, .3], shoulder: [.86, .6, .38], road: [.37, .32, .31], edge: [.9, .32, .2],
    tree: [.3, .5, .3], trunk: [.56, .24, .2], rock: [.72, .35, .23], far: [.75, .42, .32], accent: [.92, .66, .4], sun: [80, 54, 14], sunColor: [1, .93, .7], dust: '#ecc59c', night: 0, clouds: 1 },
  { zenith: [.02, .04, .12], fog: [.15, .15, .33], ground: [.17, .17, .28], shoulder: [.21, .2, .33], road: [.15, .16, .23], edge: [.95, .75, .3],
    tree: [.1, .16, .2], trunk: [.16, .14, .24], rock: [.24, .21, .36], far: [.1, .1, .22], accent: [1, .82, .45], sun: [-56, 72, 9], sunColor: [.98, .96, .86], dust: '#9d96c4', night: 1, clouds: 0 },
  { zenith: [.36, .64, .92], fog: [.98, .89, .72], ground: [.52, .64, .31], shoulder: [.36, .42, .84], road: [.33, .36, .34], edge: [.93, .42, .3],
    tree: [.26, .42, .22], trunk: [.36, .27, .2], rock: [.88, .84, .72], far: [.45, .6, .38], accent: [.32, .38, .85], sun: [-44, 36, 16], sunColor: [1, .86, .55], dust: '#f1e3b4', night: 0, clouds: 1 }
];
const CREAM = [.95, .91, .76], GOLD = [1, .77, .26], MINT = [.49, .77, .63], DARK = [.1, .15, .17], WHITE = [1, 1, 1];
const CONE = [.98, .44, .18], CRATE = [.96, .56, .2], HEART = [.96, .43, .42], SHIELD = [.44, .72, .96], STAR = [1, .9, .5], BUBBLE = [.55, .82, 1], HUB = [.7, .72, .68], RACK = [.37, .48, .43], HURT = [1, .72, .62], BODY = [.95, .94, .85];
const CORAL = [.94, .45, .32], PINK = [1, .52, .72], SKY = [.45, .8, 1], WOOD = [.55, .38, .24], SHADOW = [.03, .06, .08], WINDOW = [.13, .3, .36];
const WATER = [.3, .68, .82], FOAM = [.9, .98, 1], STEEL = [.5, .57, .56], TAIL = [.78, .2, .14], BRAKE = [1, .25, .15], EMBER = [1, .55, .2];
// Lane dashes and roof crates climb through these as the snack chain grows.
const CHAIN_COLORS = [CREAM, MINT, SKY, PINK, GOLD], CRATE_COLORS = [[.87, .57, .33], MINT, CREAM, PINK, GOLD];
const FLAG_COLORS = { griffin: GOLD, kevin: [.66, .91, .98], mittens: [1, .76, .87], spike: [.68, .87, .5] };
const LIGHT = [-.4 / Math.hypot(.4, .85, .3), .85 / Math.hypot(.4, .85, .3), .3 / Math.hypot(.4, .85, .3)];
const INK = '#143c3e', CSS_CREAM = '#fff4d7', CSS_GOLD = '#ffd96d', CSS_CORAL = '#ff8f6b', CSS_MINT = '#9fe3d4', CSS_SKY = '#a8e3ff', CSS_PINK = '#ffb0d2';
const DISPLAY_FONT = 'Roadbook, Georgia, serif';

// --- math -----------------------------------------------------------------
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function multiplyInto(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}
// An off-centre perspective: `ox`/`oy` slide the picture in clip space so the
// action sits between the HUD and the touch controls.
function projectionInto(out, focal, aspect, near, far, ox, oy) {
  const n = 1 / (near - far); out.fill(0);
  out[0] = focal / aspect; out[5] = focal; out[8] = -ox; out[9] = -oy; out[10] = (far + near) * n; out[11] = -1; out[14] = 2 * far * near * n; return out;
}
function lookAtInto(out, ex, ey, ez, tx, ty, tz, ux, uy, uz) {
  let zx = ex - tx, zy = ey - ty, zz = ez - tz, n = Math.hypot(zx, zy, zz) || 1; zx /= n; zy /= n; zz /= n;
  let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx; n = Math.hypot(xx, xy, xz) || 1; xx /= n; xy /= n; xz /= n;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0; out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0; out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * ex + xy * ey + xz * ez); out[13] = -(yx * ex + yy * ey + yz * ez); out[14] = -(zx * ex + zy * ey + zz * ez); out[15] = 1; return out;
}
// Scale, then roll (Z), pitch (X), yaw (Y), then translate.
function model(x, y, z, sx, sy, sz, yaw = 0, roll = 0, pitch = 0, out = new Float32Array(16)) {
  const c = Math.cos(yaw), s = Math.sin(yaw), a = Math.cos(roll), b = Math.sin(roll), e = Math.cos(pitch), f = Math.sin(pitch);
  out[0] = (c * a + s * f * b) * sx; out[1] = e * b * sx; out[2] = (c * f * b - s * a) * sx; out[3] = 0;
  out[4] = (s * f * a - c * b) * sy; out[5] = e * a * sy; out[6] = (s * b + c * f * a) * sy; out[7] = 0;
  out[8] = s * e * sz; out[9] = -f * sz; out[10] = c * e * sz; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1; return out;
}
const normalize = a => { const n = Math.hypot(...a) || 1; return a.map(x => x / n); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix3 = (out, a, b, t) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; return out; };
function geometry(kind) {
  const data = [];
  const triangle = (a, b, c) => { const n = normalize(cross(b.map((v, i) => v - a[i]), c.map((v, i) => v - a[i]))); for (const p of [a, b, c]) data.push(...p, ...n); };
  if (kind === 'cube') {
    const v = [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];
    for (const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]) { triangle(v[a],v[b],v[c]); triangle(v[a],v[c],v[d]); }
  } else if (kind === 'gem') {
    const top = [0,.5,0], bottom = [0,-.5,0], ring = [[.5,0,0],[0,0,.5],[-.5,0,0],[0,0,-.5]];
    for (let i = 0; i < 4; i++) { triangle(top,ring[(i+1)%4],ring[i]); triangle(bottom,ring[i],ring[(i+1)%4]); }
  } else if (kind === 'quad') {
    // A road decal: flat on the ground, facing up.
    triangle([-.5,0,.5],[.5,0,.5],[.5,0,-.5]); triangle([-.5,0,.5],[.5,0,-.5],[-.5,0,-.5]);
  } else if (kind === 'card') {
    // An upright sign facing the driver.
    triangle([-.5,-.5,0],[.5,-.5,0],[.5,.5,0]); triangle([-.5,-.5,0],[.5,.5,0],[-.5,.5,0]);
  } else if (kind === 'disc') {
    for (let i = 0; i < 12; i++) { const a = i / 12 * TURN, b = (i + 1) / 12 * TURN; triangle([0,0,0],[Math.cos(a)*.5,Math.sin(a)*.5,0],[Math.cos(b)*.5,Math.sin(b)*.5,0]); }
  } else {
    // cone, cylinder, and their low-polygon cousins: pyr (4 sides) and hex (6 sides).
    const sides = kind === 'pyr' ? 4 : kind === 'hex' ? 6 : 12, pointed = kind === 'cone' || kind === 'pyr', turn = kind === 'pyr' ? Math.PI / 4 : 0;
    const radius = kind === 'pyr' ? Math.SQRT1_2 : .5;
    for (let i = 0; i < sides; i++) {
      const a = i / sides * TURN + turn, b = (i + 1) / sides * TURN + turn;
      const p = [Math.cos(a) * radius,-.5,Math.sin(a) * radius], q = [Math.cos(b) * radius,-.5,Math.sin(b) * radius];
      triangle([0,-.5,0],p,q);
      if (pointed) triangle(p,[0,.5,0],q);
      else { const u = [p[0],.5,p[2]], v = [q[0],.5,q[2]]; triangle(p,u,v); triangle(p,v,q); triangle([0,.5,0],v,u); }
    }
  }
  return new Float32Array(data);
}
const MESH_KINDS = ['cube', 'cone', 'cylinder', 'gem', 'quad', 'card', 'disc', 'pyr', 'hex'];

// Homogeneous clipping keeps nearby scenery and the ground plane finite before
// the perspective divide. The same world-space meshes drive both renderers.
const CLIP_PLANES = [v=>v[3]+v[0],v=>v[3]-v[0],v=>v[3]+v[1],v=>v[3]-v[1],v=>v[3]+v[2],v=>v[3]-v[2]];
function clipTriangle(vertices) {
  let polygon=vertices;
  for(const plane of CLIP_PLANES){
    if(!polygon.length)break;
    const output=[];let previous=polygon.at(-1),previousDistance=plane(previous);
    for(const current of polygon){
      const distance=plane(current),inside=distance>=0,wasInside=previousDistance>=0;
      if(inside!==wasInside){const t=previousDistance/(previousDistance-distance);output.push(previous.map((value,i)=>value+(current[i]-value)*t));}
      if(inside)output.push(current);
      previous=current;previousDistance=distance;
    }
    polygon=output;
  }
  return polygon;
}
function transformPoint(matrix,x,y,z,w=1) {
  return [matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12]*w,matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13]*w,matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14]*w,matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15]*w];
}

// Every shape is one instance: a model matrix, a colour with glow in alpha, and
// (opacity, fog scale). The vertex stage bends the world along the road and
// does the lighting and fog, so the fragment stage stays cheap on a phone GPU.
// uBend and uLift are (amplitude, frequency, phase). A glow of 2 marks the sky.
const VERTEX = `attribute vec3 aPosition; attribute vec3 aNormal; attribute vec4 aM0; attribute vec4 aM1; attribute vec4 aM2; attribute vec4 aM3; attribute vec4 aColor; attribute vec2 aMisc;
uniform mat4 uViewProjection; uniform vec4 uBend; uniform vec4 uLift; uniform mediump vec3 uFog; uniform vec3 uZenith; uniform vec3 uCamera;
varying vec4 vColor; varying float vFog; varying vec2 vRoad;
void main(){ mat4 m=mat4(aM0,aM1,aM2,aM3); vec4 p=m*vec4(aPosition,1.0); vRoad=vec2(p.x,-p.z);
if(aColor.a>1.5){ float h=clamp(aColor.r+(aPosition.y+.5)*aColor.g,0.0,1.0); vColor=vec4(mix(uFog,uZenith,h),1.0); vFog=0.0; }
else{ float d=clamp(-p.z,-20.0,200.0);
p.x+=uBend.x*(sin(uBend.z+uBend.y*d)-sin(uBend.z)-uBend.y*d*cos(uBend.z));
p.y+=uLift.x*(sin(uLift.z+uLift.y*d)-sin(uLift.z)-uLift.y*d*cos(uLift.z));
vec3 n=normalize((m*vec4(aNormal,0.0)).xyz); float light=.48+.52*max(dot(n,vec3(-.39,.83,.29)),0.0);
vColor=vec4(aColor.rgb*mix(light,1.0,aColor.a),aMisc.x); vFog=smoothstep(55.0,175.0,uCamera.z-p.z)*aMisc.y; }
gl_Position=uViewProjection*p; }`;
const FRAGMENT = `precision mediump float; uniform vec3 uFog; uniform vec4 uBeam; varying vec4 vColor; varying float vFog; varying vec2 vRoad;
void main(){ vec3 color=vColor.rgb;
if(uBeam.y>0.0){ float side=abs(vRoad.x-uBeam.x); float beam=uBeam.y*smoothstep(-1.0,3.0,vRoad.y)*(1.0-smoothstep(8.0,uBeam.z,vRoad.y))*(1.0-smoothstep(.5+vRoad.y*.03,2.6+vRoad.y*.1,side)); color+=(color*.75+vec3(.2,.17,.08))*beam; }
gl_FragColor=vec4(mix(color,uFog,vFog),vColor.a); }`;
const UNIFORMS = ['uViewProjection', 'uFog', 'uZenith', 'uCamera', 'uBeam', 'uBend', 'uLift'];
const INSTANCE_FLOATS = 22, INSTANCE_BYTES = INSTANCE_FLOATS * 4;
// Solid shapes go front-most kinds first so the big road and sky fills are depth-rejected.
const SOLID_ORDER = ['cube', 'cone', 'cylinder', 'gem', 'pyr', 'hex', 'disc', 'quad', 'card'], SHEER_ORDER = ['quad', 'disc', 'card', 'cube', 'cone', 'cylinder', 'pyr', 'hex', 'gem'];
const SKY_GRADIENT = [0, 1, 0], SKY_TOP = [1, 0, 0], TINTED = ['zenith', 'fog', 'ground', 'shoulder', 'road'];
const OVERLAY_METHODS = ['save', 'restore', 'translate', 'rotate', 'scale', 'arc', 'ellipse', 'rect', 'bezierCurveTo', 'fillText', 'strokeText', 'clearRect', 'drawImage'];

/** The supplied canvas is always the 2D presentation surface, so a software
 * fallback is ready the moment a WebGL context is lost. On a real GPU the
 * WebGL scene is shown directly underneath it (no per-frame copy, nothing
 * blocking the main thread) and the supplied canvas only carries effects and
 * in-view text. Where the page cannot host that, or WebGL itself is a software
 * rasteriser, the scene is copied in with one drawImage, as before.
 * `layered`: 'auto' (default), true to force direct presentation, false to always copy.
 */
export class RallyRenderer {
  constructor(canvas, { layered = 'auto' } = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.gl = null; this.is3D = false; this.destroyed = false;
    this.backend='software-3d';this.backendReason='initializing';this.softwareStats={triangles:0,polygons:0};
    this.meshData=Object.fromEntries(MESH_KINDS.map(kind=>[kind,geometry(kind)]));
    this._softwareState=null;this._softwareLastFrame=-Infinity;this._softwareLastRun='';
    // Shared game feel. The controller steps `juice` for hit-stop and slow motion.
    this.juice = new Juice({ maxParticles: 220 });
    /** CSS pixels covered by the HUD and by on-screen controls. */
    this.insets = { top: 0, right: 0, bottom: 0, left: 0 };
    /** Optional {x, y} in CSS pixels where collected snacks fly to. Defaults to the top right. */
    this.hudTarget = null;
    this.stats = { drawCalls: 0, shapes: 0, presentation: 'software' };
    this.pixelsPerUnit = 40;
    this._canOverlay = Boolean(this.ctx) && OVERLAY_METHODS.every(name => typeof this.ctx[name] === 'function');
    this._local = new Float32Array(16); this._world = new Float32Array(16); this._rvMatrix = new Float32Array(16); this._parent = null;
    this._view = new Float32Array(16); this._projection = new Float32Array(16); this._vp = new Float32Array(IDENTITY); this._eye = [0, 7, 12];
    this._bend = { amp: 0, freq: 0, theta: 0, sin: 0, cos: 1 }; this._lift = { amp: 0, freq: 0, theta: 0, sin: 0, cos: 1 };
    this._palette = { zenith: [0, 0, 0], fog: [0, 0, 0], ground: [0, 0, 0], shoulder: [0, 0, 0], road: [0, 0, 0], dash: [0, 0, 0] };
    this._horizon = { x: 0, y: 0, ux: 0, uy: 1 }; this._point = { x: 0, y: 0, scale: 1, visible: false }; this._anchor = { x: 0, y: 0, scale: 1, visible: false };
    this._hud = { x: 0, y: 0 }; this._decalBias = 0; this._calls = 0; this._shapes = 0; this._fogScale = 1; this._sceneLayer = 0; this._fit = null; this._fitKey = '';
    this._state = null; this._lastTime = undefined; this._sprites = new Map(); this._tmp = [0, 0, 0]; this._tmp2 = [0, 0, 0];
    this._flyBone = (c, x, y, t) => this._drawTreat(c, x, y, 9 - t * 3, CSS_CREAM);
    this._flyGold = (c, x, y, t) => this._drawTreat(c, x, y, 12 - t * 4, CSS_GOLD);
    this._hudPoint = () => this._hud;
    this._wantLayered = layered; this._layered = false; this.softwareGL = false;
    // Share of full sharpness the WebGL scene is drawn at. It steps down if frames run long.
    this.renderScale = 1; this._load = 1 / 60; this._loadFrames = 0; this._resizeDue = false; this._regained = 0; this._lastRun = null; this._lastReduced = false;
    this.surface = canvas.ownerDocument?.createElement('canvas') || null;
    this._lost = event => { event.preventDefault(); this.is3D = false;this._setBackend('webgl-context-lost');this._softwareLastFrame=-Infinity;this._backendChanged();this._repaint(); };
    this._restored = () => { if (!this.destroyed) { this._initGL(); this._backendChanged(); this._repaint(); } };
    this.surface?.addEventListener('webglcontextlost', this._lost);
    this.surface?.addEventListener('webglcontextrestored', this._restored);
    this._initGL(); this._layered = this.is3D && (layered === true || (layered === 'auto' && !this.softwareGL)) && this._attachSurface(); this.resize();
    if (typeof ResizeObserver !== 'undefined') { this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); }
    if (this._layered && typeof MutationObserver !== 'undefined') { this.watcher = new MutationObserver(() => this._syncSurface()); this.watcher.observe(canvas, { attributes: true, attributeFilter: ['hidden', 'class'] }); }
  }
  _initGL() {
    try {
      const gl = this.surface?.getContext('webgl', { alpha: false, antialias: true, depth: true, powerPreference: 'low-power' });
      if (!gl) {this.is3D=false;this._setBackend('webgl-context-unavailable');return;}
      this.gl = gl;
      const shader = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const info=gl.getShaderInfoLog(s)||'';gl.deleteShader(s);throw new Error(`webgl-${type===gl.VERTEX_SHADER?'vertex':'fragment'}-compile-failed: ${info.slice(0,180)}`); } return s; };
      const vertex = shader(gl.VERTEX_SHADER, VERTEX), fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT);
      const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.bindAttribLocation(program, 0, 'aPosition'); gl.linkProgram(program);
      gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { const info=gl.getProgramInfoLog(program)||'';gl.deleteProgram(program);throw new Error(`webgl-link-failed: ${info.slice(0,180)}`); }
      this.program = program; this.locations = {};
      // A CPU rasteriser composites slowly too, so it keeps the single-layer copy.
      try { const info = gl.getExtension('WEBGL_debug_renderer_info'); this.softwareGL = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))); } catch { this.softwareGL = false; }
      for (const name of UNIFORMS) this.locations[name] = gl.getUniformLocation(program, name);
      this.position = gl.getAttribLocation(program, 'aPosition'); this.normal = gl.getAttribLocation(program, 'aNormal');
      this.slots = ['aM0', 'aM1', 'aM2', 'aM3', 'aColor', 'aMisc'].map(name => gl.getAttribLocation(program, name));
      // One instanced call per mesh kind where the browser allows it; otherwise
      // the same shader takes each shape's values as constant attributes.
      this.instancing = gl.getExtension('ANGLE_instanced_arrays') || null;
      this.meshes = {}; this.batches = {};
      for (const [kind,data] of Object.entries(this.meshData)) {
        const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); this.meshes[kind] = { buffer, count: data.length / 6 };
        this.batches[kind] = { solid: new Float32Array(INSTANCE_FLOATS * 96), solidCount: 0, sheer: new Float32Array(INSTANCE_FLOATS * 32), sheerCount: 0, solidBuffer: this.instancing ? gl.createBuffer() : null, sheerBuffer: this.instancing ? gl.createBuffer() : null };
      }
      gl.enableVertexAttribArray(this.position); gl.enableVertexAttribArray(this.normal);
      if (this.instancing) for (const slot of this.slots) { gl.enableVertexAttribArray(slot); this.instancing.vertexAttribDivisorANGLE(slot, 1); }
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); this.is3D = true;this._setBackend('webgl-ready');
    } catch(error) { this.is3D = false;this._setBackend(String(error?.message||'webgl-context-request-failed').startsWith('webgl-')?error.message:`webgl-initialization-failed: ${String(error?.message||error).slice(0,180)}`); }
  }
  _setBackend(reason){this.backend=this.is3D?'webgl':'software-3d';this.backendReason=reason;if(this.canvas.dataset){this.canvas.dataset.renderer=this.backend;this.canvas.dataset.renderStatus=reason;}}
  // Shows the WebGL canvas directly under the supplied one. Returns false (and
  // the renderer keeps copying frames) wherever the page cannot host it.
  _attachSurface() {
    try {
      const canvas = this.canvas, surface = this.surface, parent = canvas.parentNode, view = canvas.ownerDocument?.defaultView;
      if (!surface?.style || typeof parent?.insertBefore !== 'function' || typeof view?.getComputedStyle !== 'function') return false;
      const position = view.getComputedStyle(canvas).position;
      if (position !== 'absolute' && position !== 'fixed') return false;
      surface.setAttribute('aria-hidden', 'true'); surface.dataset.rallySurface = 'webgl';
      Object.assign(surface.style, { position, display: 'none', margin: '0', padding: '0', border: '0', pointerEvents: 'none', touchAction: 'none' });
      parent.insertBefore(surface, canvas); return true;
    } catch { return false; }
  }
  _syncSurface(measure = false) {
    if (!this._layered || !this.surface?.style) return;
    const canvas = this.canvas, style = this.surface.style, show = this.is3D && !canvas.hidden, display = show ? 'block' : 'none', back = this.is3D ? 'transparent' : '';
    if (style.display !== display) style.display = display;
    // The 2D layer must be see-through while the scene shows underneath it.
    if (canvas.style && canvas.style.background !== back) canvas.style.background = back;
    if (measure && show && canvas.offsetWidth) {
      style.left = `${canvas.offsetLeft}px`; style.top = `${canvas.offsetTop}px`; style.width = `${canvas.offsetWidth}px`; style.height = `${canvas.offsetHeight}px`;
      style.borderRadius = canvas.ownerDocument.defaultView.getComputedStyle(canvas).borderRadius;
      // If the page's layout keeps the two canvases from lining up, go back to copying.
      const mine = canvas.getBoundingClientRect(), under = this.surface.getBoundingClientRect?.();
      if (under && ['left', 'top', 'width', 'height'].some(edge => Math.abs(mine[edge] - under[edge]) > 1.5)) { this._wantLayered = false; this._layered = false; style.display = 'none'; canvas.style.background = ''; this.resize(); }
    }
  }
  /** Diagnostics and tuning: turn direct WebGL presentation on or off. */
  setLayered(on) {
    if (this.destroyed) return this._layered;
    if (on && !this._layered) { this._wantLayered = true; this._layered = this.is3D && (this.surface?.parentNode ? true : this._attachSurface()); }
    else if (!on && this._layered) { this._wantLayered = false; this._layered = false; if (this.surface?.style) this.surface.style.display = 'none'; if (this.canvas.style) this.canvas.style.background = ''; }
    this.resize(); return this._layered;
  }
  _backendChanged() { this._syncSurface(); this.resize(); }
  resize() {
    if (this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect(); this.width = Math.max(1, rect.width || 800); this.height = Math.max(1, rect.height || 500);
    this._left = rect.left || 0;
    const device = globalThis.devicePixelRatio || 1, direct = this.is3D && this._layered;
    // The 2D layer (software fill, effects, text) stays light; a directly shown
    // WebGL scene can afford sharper pixels.
    const dpr = Math.min(1.5, device, 1400 / this.width), sharp = (direct ? Math.min(2, device, 1800 / this.width) : dpr) * this.renderScale;
    const width = Math.round(this.width * dpr), height = Math.round(this.height * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height;this._softwareLastFrame=-Infinity; }
    const surfaceWidth = Math.round(this.width * sharp), surfaceHeight = Math.round(this.height * sharp);
    if (this.surface && (this.surface.width !== surfaceWidth || this.surface.height !== surfaceHeight)) { this.surface.width = surfaceWidth; this.surface.height = surfaceHeight; }
    this._syncSurface(true);
  }

  // --- frame --------------------------------------------------------------
  draw(run, { time = run.time || 0, dt, simDt, reducedMotion = false, insets } = {}) {
    if (this.destroyed || !this.ctx) return;
    const real = clamp(dt === undefined ? time - (this._lastTime ?? time) : dt, 0, .1); this._lastTime = time; this._lastRun = run; this._lastReduced = Boolean(reducedMotion);
    if (insets && typeof insets === 'object') this.insets = insets;
    // A change of scene resolution waits for the top of a frame, so no blank frame is ever shown.
    if (this._resizeDue) { this._resizeDue = false; this.resize(); }
    this.juice.reducedMotion = Boolean(reducedMotion); this.juice.update(real);
    this._advance(run, real, simDt === undefined ? real : clamp(simDt, 0, .1), Boolean(reducedMotion));
    this._camera(run, Boolean(reducedMotion));
    if (this.is3D && !this.gl.isContextLost()) {
      let drawn = false;
      try { this._draw3D(run, time, reducedMotion); drawn = true; }
      catch(error) { this.is3D = false;this._setBackend(`webgl-draw-failed: ${String(error?.message||error).slice(0,180)}`);this._parent=null;this._backendChanged(); }
      if (drawn) { this._present(run, reducedMotion); this._pace(real); return; }
    }
    else if(this.is3D){this.is3D=false;this._setBackend('webgl-context-lost');this._backendChanged();}
    this._drawSoftware(run, time, reducedMotion);
  }
  // A struggling GPU gets fewer pixels rather than a slideshow: sustained long
  // frames step the scene resolution down (never below half). A steady 30 fps
  // is not a struggle: iPhone Low Power Mode caps every page there.
  _pace(real) {
    if (!(real > 0)) return;
    this._load += (real - this._load) * .06;
    if (++this._loadFrames < 45 || this._load < .042 || this.renderScale <= .5) return;
    this.renderScale = Math.max(.5, this.renderScale * (this._load > .055 ? .6 : .8)); this._loadFrames = 0; this._load = 1 / 60; this._resizeDue = true;
  }
  // Redraws the last frame as a still, so a paused picture survives losing or regaining WebGL.
  _repaint() { if (this._lastRun && !this.destroyed) this.draw(this._lastRun, { time: this._lastTime, dt: 0, simDt: 0, reducedMotion: this._lastReduced }); }
  _present(run, reducedMotion) {
    const c = this.ctx; c.setTransform(1,0,0,1,0,0);
    if (this._layered) { this.stats.presentation = 'layered'; c.clearRect(0, 0, this.canvas.width, this.canvas.height); }
    else { this.stats.presentation = 'copy'; c.drawImage(this.surface, 0, 0, this.canvas.width, this.canvas.height); }
    this._overlay(run, reducedMotion);
  }
  _resetRun(run) {
    this._state = { runId: run.runId, ready: false, clock: 0, camX: 0, camRoll: 0, camRollV: 0, camLift: 0, yaw: 0, sway: 0, swayV: 0, pitch: 0, bounce: 0, bounceV: 0,
      boost: 0, gold: 0, fever: 0, urgency: 0, hurt: 0, shieldPop: 0, pulse: 0, near: 0, startGate: null, finishGate: null, banner: '', bannerColor: CSS_CREAM, bannerUntil: -1,
      dust: 0, flame: 0, side: 1, drops: [], debris: [], broken: new Set(), star: 0, starSeed: 0 };
    this._softwareLastFrame = -Infinity; this._loadFrames = 0;
    // A slowdown that has passed gives its sharpness back, one step per new run and twice at most.
    if (this.renderScale < 1 && this._load < .02 && this._regained < 2) { this._regained++; this.renderScale = Math.min(1, this.renderScale * 1.25); this._resizeDue = true; }
  }
  // Camera springs, body sway, debris and wheel dust. `dt` is real time (zero
  // while paused); `simDt` follows hit-stop and slow motion.
  _advance(run, dt, simDt, reducedMotion) {
    if (!this._state || this._state.runId !== run.runId) this._resetRun(run);
    const s = this._state, p = run.player, snap = reducedMotion || !s.ready, live = run.mode === 'running';
    const ease = rate => snap ? 1 : 1 - Math.exp(-dt * rate);
    s.clock += simDt;
    s.boost += ((run.powerTime > 0 ? 1 : run.splashTime > 0 ? .55 : 0) - s.boost) * ease(6);
    s.gold += ((run.goldRushTime > 0 ? 1 : 0) - s.gold) * ease(4);
    s.fever += ((run.feverTime > 0 ? 1 : 0) - s.fever) * ease(4);
    const left = run.timeLimit - run.time;
    s.urgency += ((left <= RALLY_TIMING.finalPush && left > 0 && run.mode !== 'ready' ? 1 : 0) - s.urgency) * ease(3);
    s.hurt = Math.max(0, s.hurt - dt * 1.6); s.shieldPop = Math.max(0, s.shieldPop - dt * 2.4); s.pulse = Math.max(0, s.pulse - dt * 5); s.near = Math.max(0, s.near - dt * 2.5);
    const air = p.y || 0;
    s.camX += (p.x * CAMERA_FOLLOW - s.camX) * ease(9); s.camLift += (air * .45 - s.camLift) * ease(7);
    if (snap) { s.camRoll = 0; s.camRollV = 0; s.sway = 0; s.swayV = 0; s.yaw = 0; s.pitch = 0; s.bounce = 0; s.bounceV = 0; }
    else {
      // Slightly under-damped so the view leans into a turn and settles.
      s.camRollV += ((-p.vx * .008 - s.camRoll) * 70 - s.camRollV * 10) * dt; s.camRoll += s.camRollV * dt;
      s.swayV += ((p.vx * .013 + Math.sin(s.clock * 30) * s.hurt * .12 - s.sway) * 110 - s.swayV * 9) * dt; s.sway += s.swayV * dt;
      s.yaw += (-p.vx * .024 - s.yaw) * ease(12);
      const slope = run.jump ? Math.atan(4 * 2.7 / 26 * (1 - 2 * Math.max(0, Math.min(1, (run.distance - run.jump.from) / 26)))) * .8 : 0;
      s.pitch += ((run.braking ? -.055 : 0) + (run.powerTime > 0 ? .05 : 0) + slope - s.pitch) * ease(8);
      s.bounceV += (-s.bounce * 180 - s.bounceV * 11) * dt; s.bounce += s.bounceV * dt;
    }
    // Start and finish gates glide in so they arrive exactly on their beat.
    const toGo = RALLY_TIMING.go - run.time, toFinish = left - RALLY_TIMING.finishGlide;
    s.startGate = this._glide(s.startGate, toGo > -1.4 ? run.speed * toGo : null, run.speed * simDt, snap, ease);
    s.finishGate = this._glide(s.finishGate, toFinish < 8.5 ? run.speed * toFinish : null, run.speed * simDt, snap, ease);
    for (const d of s.debris) {
      d.life -= dt; d.vy -= 24 * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.ahead += d.vz * dt - run.speed * simDt; d.rot += d.spin * dt;
      if (d.y < d.size * .5 && d.vy < 0) { d.y = d.size * .5; d.vy *= -.42; d.vx *= .65; d.vz *= .65; d.spin *= .6; }
    }
    if (s.debris.length) s.debris = s.debris.filter(d => d.life > 0 && d.ahead > -14);
    for (const d of s.drops) { d.life -= dt; d.y += d.vy * dt; }
    if (s.drops.length) s.drops = s.drops.filter(d => d.life > 0);
    if (reducedMotion || !s.ready || !live || simDt <= 0) return;
    // Mesa: a wishing star crosses the sky now and then.
    s.star -= simDt; if (s.star < -1.1) { s.star = 4 + Math.random() * 5; s.starSeed = Math.random(); }
    const grounded = air < .05, hard = Math.abs(p.vx) > 3.4;
    s.dust += simDt * (grounded ? 8 + (hard ? 22 : 0) + (run.braking ? 14 : 0) : 0) * Math.min(1.4, run.speed / 22);
    while (s.dust >= 1) {
      s.dust--; s.side = -s.side;
      const at = this.project(p.x + s.side * .82, .14, -1.7, this._point); if (!at.visible) continue;
      const k = at.scale;
      this.juice.emit({ x: at.x, y: at.y, vx: this.juice.rand(-.3, .3) * k + s.side * .22 * k - p.vx * .05 * k, vy: this.juice.rand(.7, 1.5) * k, drag: 1.7, life: this.juice.rand(.3, .55), size: this.juice.rand(.07, .12) * k * (hard ? 1.5 : 1), grow: .35 * k, color: THEMES[run.worldIndex || 0].dust + 'b8', shape: 'puff' });
    }
    if (run.powerTime > 0) {
      s.flame += simDt * 30;
      while (s.flame >= 1) {
        s.flame--; const at = this.project(p.x + this.juice.rand(-.5, .5), .35 + air, -1.8, this._point); if (!at.visible) continue;
        this.juice.emit({ x: at.x, y: at.y, vx: this.juice.rand(-.5, .5) * at.scale, vy: this.juice.rand(2.4, 4.2) * at.scale, drag: 1.2, life: this.juice.rand(.2, .4), size: this.juice.rand(2.5, 4), color: Math.random() < .5 ? CSS_GOLD : '#fff3b8', shape: 'spark' });
      }
    }
  }
  _glide(current, target, travelled, snap, ease) {
    if (target === null) return null;
    if (current === null || snap) return target;
    const coasting = current - travelled; return coasting + (target - coasting) * ease(3);
  }
  // Chooses a focal length and picture offset so the horizon clears the HUD
  // and the RV (with every row ahead of it) clears the touch controls.
  _fitView(road) {
    const w = this.width, h = this.height, ins = this.insets || {}, top = clamp(ins.top || 0, 0, h * .4), bottom = clamp(ins.bottom || 0, 0, h * .45), left = clamp(ins.left || 0, 0, w * .3), right = clamp(ins.right || 0, 0, w * .3);
    const hill = road?.lift || 0, hillFreq = road?.liftFreq || 0;
    const key = `${w}|${h}|${top}|${bottom}|${left}|${right}|${hill}|${hillFreq}`; if (key === this._fitKey) return this._fit;
    const aspect = w / h, wide = smooth(.62, 1.5, aspect);
    // Tall screens look down from higher up; wide screens sit low behind the RV.
    const eyeY = 10.4 - 5.3 * wide, eyeZ = 9.4 + 1 * wide, lookY = .2 + .5 * wide, lookZ = -15 - 15 * wide;
    lookAtInto(this._view, 0, eyeY, eyeZ, 0, lookY, lookZ, 0, 1, 0);
    // On rolling hills the road can climb above eye level: find how far the
    // next two rows could rise so they too stay under the HUD.
    let rise = 0;
    if (hill) for (let i = 0; i < 24; i++) for (let d = 30; d <= 110; d += 10) { const t = i / 24 * TURN; rise = Math.max(rise, (hill * (Math.sin(t + hillFreq * d) - Math.sin(t) - hillFreq * d * Math.cos(t)) + 1.2 - eyeY) / (d + eyeZ)); }
    const far = transformPoint(this._view, 0, 0, -1, 0), rear = transformPoint(this._view, 0, 0, 1.9, 1), horizon = far[1] / -far[2] + rise, wheels = rear[1] / -rear[2];
    // With no insets reported, leave room for a HUD anyway.
    const high = 1 - 2 * Math.max(top + h * .025, h * .12) / h, low = -1 + 2 * Math.max(bottom + h * .035, h * .13) / h;
    const tall = Math.max(.5, high - low) / (horizon - wheels), fitWidth = .98 * (1 - (left + right) / w) * aspect * -rear[2] / 4.9;
    const focal = clamp(Math.min(tall, fitWidth), .7, 3.4);
    this._fitKey = key; this._fit = { focal, oy: low - focal * wheels, ox: (left - right) / w, eyeY, eyeZ, lookY, lookZ, aspect };
    return this._fit;
  }
  _camera(run, reducedMotion) {
    const s = this._state, fit = this._fitView(run.road), w = this.width, h = this.height, shake = this.juice.offset, road = run.road, p = run.player;
    const kick = reducedMotion ? 0 : s.boost * .12 + s.near * .03, focal = fit.focal * shake.zoom / (1 + kick), roll = s.camRoll + shake.rot;
    const eye = this._eye; eye[0] = s.camX; eye[1] = fit.eyeY + s.camLift + s.boost * .35 * (reducedMotion ? 0 : 1); eye[2] = fit.eyeZ + s.boost * 1.1 * (reducedMotion ? 0 : 1);
    lookAtInto(this._view, eye[0], eye[1], eye[2], s.camX * .82 + p.vx * .05 * (reducedMotion ? 0 : 1), fit.lookY + s.camLift * .6, fit.lookZ, Math.sin(roll), Math.cos(roll), 0);
    projectionInto(this._projection, focal, fit.aspect, .5, 260, fit.ox + shake.x * 2 / w, fit.oy - shake.y * 2 / h);
    multiplyInto(this._vp, this._projection, this._view);
    const bend = this._bend, lift = this._lift;
    bend.amp = road?.bend || 0; bend.freq = road?.bendFreq || 0; bend.theta = ((road?.bendFreq || 0) * run.distance + (road?.bendPhase || 0)) % TURN; bend.sin = Math.sin(bend.theta); bend.cos = Math.cos(bend.theta);
    lift.amp = road?.lift || 0; lift.freq = road?.liftFreq || 0; lift.theta = ((road?.liftFreq || 0) * run.distance + (road?.liftPhase || 0)) % TURN; lift.sin = Math.sin(lift.theta); lift.cos = Math.cos(lift.theta);
    // Where the horizon sits on screen, and which way is up there (the camera rolls).
    const vp = this._vp, hz = this._horizon, a3 = -vp[11] || 1e-6, ax = (-vp[8] / a3 * .5 + .5) * w, ay = (.5 - -vp[9] / a3 * .5) * h;
    const b3 = vp[7] * .2 - vp[11] || 1e-6, bx = ((vp[4] * .2 - vp[8]) / b3 * .5 + .5) * w, by = (.5 - (vp[5] * .2 - vp[9]) / b3 * .5) * h, n = Math.hypot(bx - ax, by - ay) || 1;
    hz.x = ax; hz.y = ay; hz.ux = (bx - ax) / n; hz.uy = (by - ay) / n;
    this._tintPalette(run, reducedMotion);
    const rv = this.project(p.x, 0, 0, this._point), beside = this.project(p.x + 1, 0, 0, this._anchor);
    this.pixelsPerUnit = Math.max(1, beside.x - rv.x);
    const target = this.hudTarget; this._hud.x = Number.isFinite(target?.x) ? target.x : w - (this.insets?.right || 0) - 62; this._hud.y = Number.isFinite(target?.y) ? target.y : Math.max(30, (this.insets?.top || 0) * .42);
    s.ready = true;
  }
  // The active bonus layers recolour the world itself: gold rush warms the sky,
  // frenzy blushes it, the final stretch slides toward sunset.
  _tintPalette(run, reducedMotion) {
    const theme = THEMES[run.worldIndex || 0], pal = this._palette, s = this._state, beat = reducedMotion ? .5 : .5 + .5 * Math.sin(s.clock * 9);
    const gold = s.gold * .34, fever = s.fever * (.16 + .1 * beat), dusk = s.urgency * (theme.night ? .22 : .3);
    for (const key of TINTED) {
      const out = pal[key], weight = key === 'zenith' || key === 'fog' ? 1 : .22;
      mix3(out, theme[key], GOLD, gold * weight); mix3(out, out, PINK, fever * weight); mix3(out, out, CORAL, dusk * weight);
    }
    mix3(pal.dash, CHAIN_COLORS[Math.max(0, Math.min(4, (run.multiplier || 1) - 1))], GOLD, s.gold * .6);
  }
  /** World point (x across the road, y up, `ahead` of the RV) to canvas CSS pixels. */
  project(x, y, ahead, out = { x: 0, y: 0, scale: 1, visible: false }) {
    const vp = this._vp, px = x + this._bendX(ahead), py = y + this._liftY(ahead), pz = -ahead;
    const cw = vp[3] * px + vp[7] * py + vp[11] * pz + vp[15];
    if (!(cw > .05)) { out.visible = false; out.x = this.width / 2; out.y = this.height / 2; out.scale = 1; return out; }
    out.x = ((vp[0] * px + vp[4] * py + vp[8] * pz + vp[12]) / cw * .5 + .5) * this.width;
    out.y = (.5 - (vp[1] * px + vp[5] * py + vp[9] * pz + vp[13]) / cw * .5) * this.height;
    out.scale = this._projection[5] * this.height * .5 / cw; out.visible = true; return out;
  }
  /** Road position that puts the RV under a finger at this clientX (for drag steering with steerTo). */
  roadXAt(clientX) { return clamp((clientX - (this._left || 0) - this.width * (.5 + (this._fit?.ox || 0) * .5)) / (this.pixelsPerUnit * (1 - CAMERA_FOLLOW)), -3.9, 3.9); }
  _bendX(ahead) { const b = this._bend; if (!b.amp) return 0; const d = Math.max(-20, Math.min(200, ahead)); return b.amp * (Math.sin(b.theta + b.freq * d) - b.sin - b.freq * d * b.cos); }
  _liftY(ahead) { const b = this._lift; if (!b.amp) return 0; const d = Math.max(-20, Math.min(200, ahead)); return b.amp * (Math.sin(b.theta + b.freq * d) - b.sin - b.freq * d * b.cos); }

  // --- drawing primitives ---------------------------------------------------
  _shape(kind, x, y, z, sx, sy, sz, color, yaw = 0, roll = 0, glow = 0, alpha = 1, pitch = 0) {
    let matrix = model(x, y, z, sx, sy, sz, yaw, roll, pitch, this._local);
    if (this._parent) matrix = multiplyInto(this._world, this._parent, matrix);
    if (this._softwareState) this._softwareShape(kind, matrix, color, glow, alpha);
    else this._instance(kind, matrix, color, glow, alpha, this._fogScale);
  }
  // Queues one shape. See-through pieces wait in their own list until the solid scene is down.
  _instance(kind, matrix, color, glow, alpha, fog) {
    const batch = this.batches[kind], sheer = alpha < 1, count = sheer ? batch.sheerCount : batch.solidCount;
    let data = sheer ? batch.sheer : batch.solid;
    if ((count + 1) * INSTANCE_FLOATS > data.length) { const grown = new Float32Array(data.length * 2); grown.set(data); data = grown; if (sheer) batch.sheer = data; else batch.solid = data; }
    const at = count * INSTANCE_FLOATS; data.set(matrix, at);
    data[at + 16] = color[0]; data[at + 17] = color[1]; data[at + 18] = color[2]; data[at + 19] = glow; data[at + 20] = alpha; data[at + 21] = fog;
    if (sheer) batch.sheerCount = count + 1; else batch.solidCount = count + 1;
  }
  _flush(order, sheer) {
    const gl = this.gl, ext = this.instancing, slots = this.slots;
    for (const kind of order) {
      const batch = this.batches[kind], count = sheer ? batch.sheerCount : batch.solidCount; if (!count) continue;
      const data = sheer ? batch.sheer : batch.solid, mesh = this.meshes[kind];
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer); gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,24,0); gl.vertexAttribPointer(this.normal,3,gl.FLOAT,false,24,12);
      if (ext) {
        gl.bindBuffer(gl.ARRAY_BUFFER, sheer ? batch.sheerBuffer : batch.solidBuffer); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * INSTANCE_FLOATS), gl.DYNAMIC_DRAW);
        for (let i = 0; i < 5; i++) gl.vertexAttribPointer(slots[i],4,gl.FLOAT,false,INSTANCE_BYTES,i*16);
        gl.vertexAttribPointer(slots[5],2,gl.FLOAT,false,INSTANCE_BYTES,80);
        ext.drawArraysInstancedANGLE(gl.TRIANGLES,0,mesh.count,count); this._calls++;
      } else for (let i = 0; i < count; i++) {
        const at = i * INSTANCE_FLOATS;
        for (let k = 0; k < 5; k++) gl.vertexAttrib4f(slots[k],data[at+k*4],data[at+k*4+1],data[at+k*4+2],data[at+k*4+3]);
        gl.vertexAttrib2f(slots[5],data[at+20],data[at+21]); gl.drawArrays(gl.TRIANGLES,0,mesh.count); this._calls++;
      }
      this._shapes += count;
    }
  }
  _box(x, y, z, sx, sy, sz, color, yaw, roll, glow, alpha, pitch) { this._shape('cube', x, y, z, sx, sy, sz, color, yaw, roll, glow, alpha, pitch); }
  _flat(x, y, z, sx, sz, color, glow = 0, alpha = 1) { this._shape('quad', x, this._sceneLayer === 3 ? y + this._decalBias : y, z, sx, 1, sz, color, 0, 0, glow, alpha); }
  _draw3D(run, time, reducedMotion) {
    const gl = this.gl, at = this.locations, pal = this._palette, bend = this._bend, lift = this._lift, eye = this._eye;
    gl.viewport(0,0,this.surface.width,this.surface.height); gl.clearColor(pal.fog[0],pal.fog[1],pal.fog[2],1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); gl.useProgram(this.program);
    let sheer = 0;
    for (const kind of MESH_KINDS) { const batch = this.batches[kind]; batch.solidCount = 0; batch.sheerCount = 0; }
    this._calls = 0; this._shapes = 0; this._fogScale = 1; this._parent = null;
    gl.uniformMatrix4fv(at.uViewProjection,false,this._vp); gl.uniform3fv(at.uFog,pal.fog); gl.uniform3fv(at.uZenith,pal.zenith); gl.uniform3fv(at.uCamera,eye);
    gl.uniform4f(at.uBend,bend.amp,bend.freq,bend.theta,1); gl.uniform4f(at.uLift,lift.amp,lift.freq,lift.theta,1);
    gl.uniform4f(at.uBeam,run.player.x,THEMES[run.worldIndex||0].night?1:0,64,0);
    this._drawScene(run,time,reducedMotion);
    // Sky: a gradient card rising from the horizon haze, with the zenith above it.
    this._instance('card',model(eye[0],eye[1]+45,-238,1500,90,1,0,0,0,this._local),SKY_GRADIENT,2,1,0);
    this._instance('card',model(eye[0],eye[1]+290,-238,1500,400,1,0,0,0,this._local),SKY_TOP,2,1,0);
    this._flush(SOLID_ORDER,false);
    for (const kind of MESH_KINDS) sheer += this.batches[kind].sheerCount;
    if (sheer) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      this._flush(SHEER_ORDER,true);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    this.stats.drawCalls = this._calls; this.stats.shapes = this._shapes; gl.flush();
  }

  // --- the world --------------------------------------------------------------
  _drawScene(run,time,reducedMotion){
    const soft=Boolean(this._softwareState),world=run.worldIndex||0,theme=THEMES[world],pal=this._palette,s=this._state,t=reducedMotion?0:s.clock,D=run.distance;
    this._parent=null;this._fogScale=1;
    this._sceneLayer=0;this._backdrop(run,theme,pal,t,soft,reducedMotion);
    // Ground, shoulders and road are short strips so the bend can curve them.
    // Tighter bends and hills get shorter strips so every layer shares the same curve.
    const strip=!soft&&(this._lift.amp||this._bend.amp>5)?10:20,lap=strip+.3;
    this._decalBias=this._lift.amp?.05:0;
    this._sceneLayer=1;
    for(let z=-20;z<200;z+=strip)this._flat(0,-.03,-(z+strip/2),300,lap,pal.ground);
    this._sceneLayer=2;
    if(world===0)for(let z=-20;z<180;z+=strip)this._flat(-11.5,-.012,-(z+strip/2),8.6,lap,WATER,.25);
    for(let z=-20;z<180;z+=strip){
      const at=-(z+strip/2);
      this._flat(0,0,at,9.7,lap,pal.road);
      this._flat(-6.2,-.006,at,2.9,lap,pal.shoulder,world===4?.12:0);this._flat(6.2,-.006,at,2.9,lap,pal.shoulder,world===4?.12:0);
    }
    this._sceneLayer=3;
    for(let z=-20;z<180;z+=strip){this._flat(-5.05,.012,-(z+strip/2),.5,lap,CREAM);this._flat(5.05,.012,-(z+strip/2),.5,lap,CREAM);}
    // Rumble blocks and lane dashes are the speedometer: they strobe past.
    const blockFrom=Math.floor((D-14)/8),blockCount=soft?16:21;
    for(let i=0;i<blockCount;i++){const z=(blockFrom+i)*8-D;this._flat(-5.05,.02,-(z+2),.52,4,theme.edge,.15);this._flat(5.05,.02,-(z+2),.52,4,theme.edge,.15);}
    const dashGlow=.35+.35*s.gold+(run.multiplier>1?.2:0),dashFrom=Math.floor((D-12)/8),dashCount=soft?18:23;
    for(let i=0;i<dashCount;i++){const z=(dashFrom+i)*8-D;this._flat(-1.5,.022,-(z+1.9),.17,3.8,pal.dash,dashGlow);this._flat(1.5,.022,-(z+1.9),.17,3.8,pal.dash,dashGlow);}
    this._roadGlow(run,s,t,soft,reducedMotion);
    this._sceneLayer=4;
    this._props(run,theme,pal,t,soft);
    this._gates(run,theme,s,t,soft);
    this._entities(run,theme,s,t,soft,reducedMotion);
    for(const d of s.debris)this._shape(d.kind,d.x,d.y,-d.ahead,d.size,d.size*d.tall,d.size,d.color,d.rot,d.rot*.7,d.glow,1,d.rot*.5);
    this._rv(run,theme,s,t,soft,reducedMotion);
  }
  // Sun or moon, clouds, stars and the far range. They slide with the bends,
  // which reads as the RV turning.
  _backdrop(run,theme,pal,t,soft,reducedMotion){
    const s=this._state,seed=run.seed|0,world=run.worldIndex||0,far=mix3(this._tmp,theme.far,pal.fog,.55);
    this._fogScale=0;
    const [sunX,sunY,sunR]=theme.sun;
    this._shape('disc',sunX,sunY,-232,sunR*2,sunR*2,1,theme.sunColor,0,0,1);
    if(!soft)this._shape('disc',sunX,sunY,-233,sunR*3.6,sunR*3.6,1,theme.sunColor,0,0,1,.16);
    if(theme.night){
      this._shape('disc',sunX+sunR*.55,sunY+sunR*.3,-231.5,sunR*1.7,sunR*1.7,1,pal.zenith,0,0,1);
      const count=soft?14:34;
      for(let i=0;i<count;i++){
        const x=(hash01(i,seed+11)-.5)*460,y=26+hash01(i,seed+12)*130,size=.9+hash01(i,seed+13)*1.5,twinkle=.55+.45*Math.sin(t*(2+hash01(i,7)*3)+i);
        this._shape('gem',x,y,-236,size,size,size,mix3(this._tmp2,pal.zenith,WHITE,twinkle),0,0,1);
      }
      // A shooting star, drawn as a short bright streak with a soft tail.
      if(!reducedMotion&&s.star<0&&s.star>-1.1){
        const u=-s.star/1.1,x=-150+s.starSeed*220+u*90,y=120-u*46-s.starSeed*20;
        this._shape('cube',x,y,-235,13,.5,.5,WHITE,0,-.47,1,1-u*.6);this._shape('cube',x-9,y+4.6,-235,22,.28,.28,theme.accent,0,-.47,1,.45*(1-u));
      }
    }
    if(theme.clouds){
      const count=soft?2:4;
      for(let i=0;i<count;i++){
        const x=((hash01(i,seed+21)*520+t*1.4)%520)-260,y=58+hash01(i,seed+22)*46,w=34+hash01(i,seed+23)*30;
        this._shape('cube',x,y,-226,w,5,2,WHITE,0,0,.92,.9);this._shape('cube',x+w*.16,y+3.6,-226,w*.55,5,2,WHITE,0,0,.92,.9);
      }
    }
    // Far range: flat-topped mesas in the desert, peaks and rounded hills elsewhere.
    const peaks=soft?6:9;
    for(let i=0;i<peaks;i++){
      const x=-240+i*(480/(peaks-1))+(hash01(i,seed+31)-.5)*30,wide=70+hash01(i,seed+32)*60,tall=(world===1?26:world===4?16:30)+hash01(i,seed+33)*26;
      if(world===2||world===3){this._box(x,tall*.3,-222,wide*.62,tall*.6,8,far);if(i%2)this._box(x+wide*.12,tall*.72,-222,wide*.3,tall*.3,8,far);}
      else if(world===4)this._shape('gem',x,-2,-222,wide*1.7,tall*1.6,10,far);
      else this._shape('pyr',x,tall*.5,-222,wide,tall,10,far);
    }
    this._fogScale=1;
  }
  // Light strips along the road for each bonus layer that is running.
  _roadGlow(run,s,t,soft,reducedMotion){
    const pulse=reducedMotion?.75:.6+.4*Math.sin(t*10),step=soft?40:20,length=soft?160:180;
    if(s.gold>.03)for(let z=-20;z<length;z+=step)for(let side=-1;side<=1;side+=2)this._flat(side*4.45,.03,-(z+step/2),.32,step+.3,GOLD,1,.75*s.gold);
    if(s.fever>.03)for(let z=-20;z<length;z+=step)for(let side=-1;side<=1;side+=2)this._flat(side*5.6,.03,-(z+step/2),.5,step+.3,PINK,1,.8*s.fever*pulse);
    if(s.boost>.03&&!reducedMotion){
      // Boost: bright chevrons race back along the lanes.
      const from=Math.floor((run.distance*2.2-10)/26);
      for(let i=0;i<(soft?4:7);i++){const z=(from+i)*26-run.distance*2.2;if(z<-10||z>150)continue;for(let lane=-1;lane<=1;lane++)this._flat(lane*3,.034,-z,.5,9,GOLD,1,.42*s.boost);}
    }
    if(s.urgency>.03){
      // Final stretch: coral arrows count the road down.
      const from=Math.floor((run.distance-6)/16);
      for(let i=0;i<(soft?5:9);i++){const z=(from+i)*16-run.distance;this._flat(0,.028,-(z+1.2),1.5,2.4,CORAL,.9,.5*s.urgency*pulse);}
    }
  }
  _props(run,theme,pal,t,soft){
    const D=run.distance,step=16,first=Math.floor((D-14)/step),count=soft?9:12,seed=run.seed|0,world=run.worldIndex||0;
    for(let i=0;i<count;i++){
      const k=first+i;
      for(let side=-1;side<=1;side+=2){
        const slot=k*2+(side>0?1:0),a=hash01(slot,seed),b=hash01(slot,seed+77),ahead=k*step-D+step*.5+(b-.5)*5,z=-ahead;
        // Reflector posts on every stretch: the closest, fastest speed cue.
        this._box(side*5.75,.45,-(k*step-D),.14,.9,.14,CREAM);this._box(side*5.75,.82,-(k*step-D),.2,.2,.2,side>0?GOLD:CORAL,0,0,theme.night?1:.5);
        if(world===0)this._riverProp(side,z,a,b,k,theme,t,soft);
        else if(world===1)this._redwoodProp(side,z,a,b,k,theme,soft);
        else if(world===2)this._canyonProp(side,z,a,b,k,theme,soft);
        else if(world===3)this._mesaProp(side,z,a,b,k,theme,t,soft);
        else this._boerneProp(side,z,a,b,k,theme,t,soft);
      }
    }
  }
  _pine(x,z,scale,theme){
    this._box(x,.8*scale,z,.42*scale,1.6*scale,.42*scale,theme.trunk);
    this._shape('pyr',x,2.7*scale,z,3.1*scale,2.9*scale,3.1*scale,theme.tree);this._shape('pyr',x,4.5*scale,z,2.2*scale,2.6*scale,2.2*scale,theme.tree);
  }
  // Rogue River: water with drifting rapids on the left, pines and a fence on the right.
  _riverProp(side,z,a,b,k,theme,t,soft){
    if(side<0){
      this._flat(-9.5-a*3.5,.0,z+((t*5+b*16)%16)-8,1.6+a,.5,FOAM,.7);
      this._shape('gem',-6.9-b*.5,.3,z,1.2+a,.9+a*.5,1+b,theme.rock,a*6);
      if(!soft||k%2===0)this._pine(-17.5-a*8,z,1+b*.6,theme);
    }else{
      this._pine(8+a*9,z,.9+b*.8,theme);
      if(!soft)this._shape('gem',6.9+b,.25,z+5,.9,.6,.8,theme.rock,b*5);
      if(k%2===0){this._box(6.5,.5,z,.18,1,.18,WOOD);this._box(6.5,.78,z-4,.1,.14,8,WOOD);}
    }
  }
  // Redwood Run: giant trunks close to the road, ferns, and a dark canopy overhead.
  _redwoodProp(side,z,a,b,k,theme,soft){
    const girth=2.1+a*2,x=side*(8.4+girth+b*5.5);
    this._shape('hex',x,13,z,girth,26,girth,theme.trunk,a*3);this._shape('pyr',x,.9,z,girth*1.7,1.8,girth*1.7,theme.trunk,a*3);
    this._shape('pyr',side*(6.5+a),.4,z+6,1.3,.8,1.3,theme.accent,b*4);
    if(!soft){
      this._shape('pyr',side*(6.9+b*2),.5,z-4,1.6,1,1.6,theme.accent,a*4);
      this._box(side*17,19+a*3,z,24,1.2,16.5,theme.tree);
      if(a>.72)this._shape('card',side*(3+b*4),8,z,2.6,18,1,theme.sunColor,0,side*.22,1,.1);
    }
  }
  // Painted Canyon: banded mesas, spires, cactus, and a stone arch now and then.
  _canyonProp(side,z,a,b,k,theme,soft){
    const x=side*(13+b*13),wide=6+a*6;
    this._box(x,1.1,z,wide,2.2,wide*.9,theme.rock,a);this._box(x,3.2,z,wide*.8,2,wide*.72,theme.accent,a);
    if(!soft||a>.5)this._box(x,5,z,wide*.6,1.6,wide*.54,theme.trunk,a);
    this._shape('hex',side*(6.7+a*.8),1.2,z+6,.5,2.4,.5,theme.tree);
    if(!soft){this._box(side*(6.7+a*.8)+.5,1.5,z+6,.6,.2,.2,theme.tree);this._box(side*(6.7+a*.8)+.75,1.85,z+6,.2,.8,.2,theme.tree);}
    if(k%5===0){
      // Tall enough to stay in the sky from every camera.
      this._box(side*8.2,6.8,z,2.4,13.6,2.8,theme.rock);
      if(side>0){this._box(0,14.6,z,18.8,2.2,3,theme.rock);this._box(0,13.3,z,6,.8,2.6,theme.accent);}
    }else if(a>.6)this._shape('hex',side*(8.5+b*3),4,z-3,1.6,8,1.6,theme.rock,b*2);
  }
  // Starlight Mesa: lanterns that whip past in the dark, saguaros, and a far campfire.
  _mesaProp(side,z,a,b,k,theme,t,soft){
    if(k%2===0){this._box(side*6.5,1.3,z,.16,2.6,.16,theme.trunk);this._shape('gem',side*6.5,2.8,z,.55,.7,.55,theme.accent,t,0,1);if(!soft)this._flat(side*6.1,.03,z,2.6,2.6,theme.accent,1,.16);}
    const x=side*(8+a*9);
    this._shape('hex',x,1.7,z+5,.7,3.4,.7,theme.tree);
    if(!soft){this._box(x+.7,1.9,z+5,.8,.24,.24,theme.tree);this._box(x+1,2.5,z+5,.24,1.2,.24,theme.tree);}
    const wide=7+b*8;
    this._box(side*(22+a*12),2,z,wide,4+a*3,wide,theme.rock,b);
    if(a>.8&&!soft){this._shape('pyr',side*11,.9,z-5,2.2,1.8,2.2,theme.trunk);this._shape('gem',side*12.6,.4,z-5,.5,.6+.25*Math.sin(t*13+k),.5,EMBER,0,0,1);}
  }
  // Boerne Hills: live oaks, a limestone wall, bluebonnets, and a windmill.
  _boerneProp(side,z,a,b,k,theme,t,soft){
    const x=side*(9.5+a*10);
    this._box(x,.9,z,.7,1.8,.7,theme.trunk);this._shape('gem',x,3,z,6+b*2,3.4,6+b*2,theme.tree,a*3);
    if(!soft)this._shape('gem',x+1.2,3.9,z+.8,3.6,2.6,3.6,theme.tree,b*3);
    this._box(side*7.75,.3,z,.5,.6,15.6,theme.rock);
    const blooms=soft?1:3;
    for(let i=0;i<blooms;i++){
      const bx=side*(5.55+hash01(k*8+i,side+5)*1.7),bz=z+(i-1)*5+a*3;
      this._shape('pyr',bx,.33,bz,.34,.66,.34,theme.accent,0,0,.3);this._shape('pyr',bx,.7,bz,.16,.22,.16,WHITE,0,0,.6);
    }
    if(k%6===0&&side>0){
      this._shape('pyr',14,5,z,1.8,10,1.8,STEEL);this._shape('cube',14,10,z+.6,.5,.5,.5,DARK);
      const blades=soft?2:4;for(let i=0;i<blades;i++)this._box(14,10,z+.95,.4,6.4,.06,CREAM,0,t*1.8+i*Math.PI/blades);
    }else if(a>.75&&!soft)this._shape('cylinder',side*(7.2+b),.55,z-5,1.1,1.3,1.1,GOLD,0,Math.PI/2);
  }
  // Start lights and a checkered finish arch. Both stand taller than any camera,
  // so they sweep overhead instead of through the view.
  _gates(run,theme,s,t,soft){
    if(s.startGate!==null&&s.startGate>-14&&s.startGate<178){
      const z=-s.startGate,count=run.countdown,go=count===0;
      this._box(0,13.5,z,12.3,1.5,.4,DARK);
      for(let side=-1;side<=1;side+=2){
        this._box(side*5.9,6.6,z,.45,13.2,.45,CREAM);this._box(side*5.9,3.5,z+.12,.95,3.5,.3,DARK);
        for(let i=0;i<3;i++){const lit=go||4-count>=i+1;this._shape('disc',side*5.9,2.4+i*1.1,z+.3,.8,.8,1,go?MINT:lit?CORAL:STEEL,0,0,lit?1:.1);}
      }
      for(let i=0;i<3;i++){const lit=go||4-count>=i+1;this._shape('disc',(i-1)*1.6,13.5,z+.22,.9,.9,1,go?MINT:lit?CORAL:STEEL,0,0,lit?1:.1);}
      this._sceneLayer=3;this._flat(0,.03,z,9.6,.7,WHITE,.6);this._sceneLayer=4;
    }
    if(s.finishGate!==null&&s.finishGate>-14&&s.finishGate<178){
      const z=-s.finishGate;
      for(let side=-1;side<=1;side+=2){
        this._box(side*5.9,6.6,z,.5,13.2,.5,CREAM);this._shape('gem',side*5.9,13.9,z,.9,1.2,.9,GOLD,t*2,0,1);
        this._shape('card',side*6.9,4.6,z+.1,1.7,1.1,1,GOLD,0,0,.6);this._shape('card',side*6.9,3.2,z+.1,1.7,1.1,1,CORAL,0,0,.6);
      }
      this._box(0,12.4,z,12.3,1.9,.3,CREAM);
      const squares=soft?6:12;
      for(let i=0;i<squares;i++)for(let row=0;row<2;row++)if((i+row)%2===0)this._shape('card',(i+.5)*(12/squares)-6,11.95+row*.9,z+.17,12/squares,.9,1,DARK);
      this._sceneLayer=3;this._flat(0,.03,z,9.6,1.5,WHITE,.8);
      for(let i=0;i<(soft?4:8);i++)this._flat((i-(soft?1.5:3.5))*(soft?2.4:1.2),.034,z,soft?1.2:.6,1.5,DARK,.2);
      this._sceneLayer=4;
    }
  }
  _entities(run,theme,s,t,soft,reducedMotion){
    const p=run.player,finish=s.finishGate,golden=run.goldRushTime>0,pull=run.magnetTime>0||(run.powerTime>0&&run.characterId==='kevin');
    const blink=reducedMotion?1:.5+.5*Math.sin(t*9);
    for (const e of run.entities) {
      if (e.taken || e.z < -10 || e.z > 178) continue;
      if (finish !== null && e.z > finish + 1.5) continue;
      const z = -e.z, far = e.z > (soft ? 80 : 130), bob = reducedMotion ? 0 : Math.sin(t*2.5+e.id)*.07, turn = reducedMotion ? .2 : t*.9+e.id;
      if (e.type === 'cone' || e.type === 'barrier') {
        if (e.hit) { if (!s.broken.has(e.id)) { s.broken.add(e.id); if (!reducedMotion) this._shatter(e, run); } continue; }
        // A warm patch on the road warns of the blocked lane long before the cone is readable.
        if (e.z > 2 && e.z < 130) { this._sceneLayer = 3; this._flat(e.x,.026,z+5.2,e.width+.9,8.6,CORAL,.7,.2+.1*blink); this._sceneLayer = 4; }
        if (e.type === 'cone') {
          this._box(e.x,.08,z,1.25,.16,1.25,DARK); this._shape('cone',e.x,.72,z,.95,1.3,.95,CONE,0,0,theme.night?.45:.1);
          if (!far) this._shape('cone',e.x,.72,z,.62,.44,.62,CREAM,0,0,theme.night?1:.4);
        } else {
          this._box(e.x,.56,z,2.1,.8,.6,CRATE,0,0,theme.night?.4:.05);
          for (let i = -1; i <= 1; i++) this._box(e.x+i*.66,.56,z+.31,.3,.62,.03,CREAM,0,-.3,theme.night?1:.3);
          if (!far) for (let side = -1; side <= 1; side += 2) { this._box(e.x+side*.86,.2,z,.16,.4,.7,DARK); this._shape('gem',e.x+side*.86,1.12,z,.3,.36,.3,GOLD,0,0,side>0?blink:1-blink); }
        }
      } else if (e.type === 'ramp') {
        this._sceneLayer = 3; for (let i = 0; i < 2; i++) this._flat(e.x,.03,z+3.4+i*2.4,1.4,.9,GOLD,1,.55+.3*blink); this._sceneLayer = 4;
        this._box(e.x,.43,z,2.2,.14,3.2,CREAM,0,0,.1,1,.26); this._box(e.x,.42,z-1.3,2.2,.84,.5,CRATE);
        for (let side = -1; side <= 1; side += 2) this._box(e.x+side*1.1,.5,z,.14,.3,3.2,CORAL,0,0,.3,1,.26);
        this._box(e.x,.53,z-.2,1.3,.05,.5,GOLD,0,0,1,1,.26);
      } else if (e.type === 'splash') {
        this._sceneLayer = 3; const ripple = reducedMotion ? .5 : (t*.9+e.id*.37)%1;
        this._flat(e.x,.028,z,2.7,4.4,WATER,.5,.85); this._flat(e.x,.032,z,1.5+ripple,2.4+ripple*1.6,FOAM,.8,.5*(1-ripple)); this._sceneLayer = 4;
        if (!far) for (let i = -1; i <= 1; i += 2) this._shape('gem',e.x+i*.7,.5+bob*2,z+i*.8,.24,.5,.24,FOAM,turn,0,.9,.7);
      } else {
        // Snacks lean toward a magnet before they are caught.
        const tug = pull && e.z < 13 && e.z > -2 ? Math.pow(1 - Math.max(0, e.z) / 13, 2) * .8 : 0, x = e.x + (p.x - e.x) * tug, y = (e.y || 0) + bob;
        if (e.type === 'bone') {
          const color = golden || e.convoy ? GOLD : CREAM, glow = golden ? 1 : .65;
          if (e.convoy || golden) { this._sceneLayer = 3; this._flat(x,.03,z,1.1,1.1,GOLD,1,.4); this._sceneLayer = 4; }
          if (far) { this._shape('gem',x,.8+y,z,.7,.36,.36,color,turn,0,glow); continue; }
          this._box(x,.8+y,z,.74,.16,.2,color,turn,0,glow); const dx = Math.cos(turn)*.31, dz = -Math.sin(turn)*.31;
          this._shape('gem',x+dx,.8+y,z+dz,.28,.4,.34,color,turn,0,glow); this._shape('gem',x-dx,.8+y,z-dz,.28,.4,.34,color,turn,0,glow);
        } else {
          const color = e.type==='gold'?GOLD:e.type==='heart'?HEART:e.type==='shield'?SHIELD:e.type==='star'?STAR:MINT;
          // A tall beam makes every pickup readable from far down the road.
          if (!soft || e.z < 90) this._shape('card',x,3.4+y,z,.5,5,1,color,0,0,1,.22);
          if (e.type === 'star') { this._shape('gem',x,1+y,z,1.2,.5,.5,color,turn,0,1); this._shape('gem',x,1+y,z,.5,1.2,.5,color,turn,0,1); this._shape('gem',x,1+y,z,.5,.5,1.2,color,turn,0,1); }
          else if (e.type === 'shield') { this._shape('gem',x,.95+y,z,.6,.75,.6,WHITE,turn,0,.9); this._shape('gem',x,.95+y,z,1,1.15,1,color,-turn,0,.9,.45); }
          else this._shape('gem',x,.95+y,z,.86,1,.86,color,turn,0,.75);
          this._sceneLayer = 3; this._flat(x,.03,z,1.2,1.2,color,.9,.4); this._sceneLayer = 4;
        }
      }
    }
  }
  // A struck cone or crate tumbles away in real pieces.
  _shatter(e, run) {
    const s = this._state, crate = e.type === 'barrier', pieces = crate ? 6 : 4;
    for (let i = 0; i < pieces && s.debris.length < 18; i++) {
      const size = crate ? .32 + Math.random() * .3 : i === 0 ? .7 : .22 + Math.random() * .2;
      s.debris.push({ kind: crate ? 'cube' : i === 0 ? 'cone' : 'cube', x: e.x + (Math.random() - .5) * e.width, y: .5 + Math.random() * .5, ahead: e.z + 1, vx: (Math.random() - .5) * 9 + (e.x - run.player.x) * 4, vy: 5 + Math.random() * 6, vz: run.speed * (.9 + Math.random() * .5),
        rot: Math.random() * 6, spin: (Math.random() - .5) * 16, size, tall: !crate && i === 0 ? 1.3 : 1, color: i % 2 ? CREAM : CONE, glow: 0, life: 1.6 });
    }
  }
  _scatterCrates(run, count) {
    const s = this._state;
    for (let i = 0; i < count && s.debris.length < 18; i++) s.debris.push({ kind: 'cube', x: run.player.x, y: 2 + i * .3, ahead: .2, vx: (Math.random() - .5) * 10, vy: 6 + Math.random() * 5, vz: run.speed * (.5 + Math.random() * .5), rot: Math.random() * 6, spin: (Math.random() - .5) * 14, size: .5, tall: .6, color: CRATE_COLORS[i % 5], glow: 0, life: 1.4 });
  }
  // The RV is built in its own space so it can yaw into a turn, sway on its
  // springs, squat under boost, and fly off a ramp as one body.
  _rv(run,theme,s,t,soft,reducedMotion){
    const p=run.player,air=p.y||0,boosting=run.powerTime>0,night=theme.night;
    const idle=reducedMotion?0:Math.sin(t*13)*.012+Math.sin(t*7.3)*.01,shadow=1/(1+air*.4);
    this._sceneLayer=3;this._flat(p.x,.04,.1,2.3*shadow,3.9*shadow,SHADOW,0,.36*shadow);
    if(night){this._flat(p.x-.55,.036,-14,2.2,24,theme.sunColor,1,.1);this._flat(p.x+.55,.036,-14,2.2,24,theme.sunColor,1,.1);}
    if(boosting)this._flat(p.x,.038,.2,2.5,4.4,GOLD,1,.5);
    this._sceneLayer=4;
    const blinkOn=s.hurt>0&&run.invincible>0&&(reducedMotion||Math.sin(t*34)>0),body=blinkOn?HURT:BODY,trim=boosting?GOLD:MINT;
    this._parent=model(p.x,air+s.bounce+idle,0,1,1,1,s.yaw,s.sway,s.pitch,this._rvMatrix);
    this._box(0,.86,0,1.7,1.16,3.1,body);this._box(0,.6,0,1.75,.22,3.14,trim,0,0,boosting?.5:0);
    this._box(0,1.5,.12,1.62,.2,2.72,CREAM);this._box(0,1.6,-1.2,1.68,.4,.72,body);
    this._box(0,1.1,1.56,.92,.42,.05,WINDOW);this._box(0,.27,1.62,1.8,.17,.14,STEEL);
    this._box(0,.48,1.585,.5,.2,.03,CREAM);
    const round=soft?'hex':'cylinder';
    this._shape(round,0,.68,1.66,.62,.17,.62,DARK,0,0,0,1,Math.PI/2);if(!soft)this._shape(round,0,.68,1.76,.27,.04,.27,CREAM,0,0,0,1,Math.PI/2);
    for(let side=-1;side<=1;side+=2){
      this._box(side*.66,.5,1.575,.25,.2,.06,run.braking?BRAKE:TAIL,0,0,run.braking||night?1:.75);
      this._box(side*.856,1.12,-.3,.03,.42,1.15,WINDOW);
      this._shape(round,side*.86,.3,.95,.6,.27,.6,DARK,0,Math.PI/2);this._shape(round,side*.86,.3,-.95,.6,.27,.6,DARK,0,Math.PI/2);
      if(!soft)this._shape(round,side*1,.3,.95,.3,.04,.3,HUB,0,Math.PI/2);
      if(boosting&&!reducedMotion)this._shape('gem',side*.42,.32,1.95,.3,.3,.7+.5*Math.abs(Math.sin(t*31+side)),EMBER,0,0,1);
    }
    if(!soft)this._shape(round,.9,1.5,.1,.17,2.3,.17,CORAL,0,0,0,1,Math.PI/2);
    this._box(0,1.64,.35,1.22,.07,1.34,RACK);
    // The snack stack on the roof: one crate per chain level, golden in a gold rush.
    const crates=Math.max(1,Math.min(5,run.multiplier||1)),frenzy=run.feverTime>0,lean=-s.sway*2.2;
    for(let i=0;i<crates;i++){
      const top=i===crates-1,squash=top?1+s.pulse*.35:1,size=.6-i*.035;
      this._box(lean*(i+1)*.1+(hash01(i,3)-.5)*.08,1.82+i*.3+(top?s.pulse*.1:0),.35,size*squash,.28/squash,size*squash,run.goldRushTime>0?GOLD:CRATE_COLORS[i],(hash01(i,9)-.5)*.5,0,run.goldRushTime>0?.6:frenzy?.45+.3*Math.sin(t*12+i):.05);
    }
    if(run.totalMultiplier>=10){const top=1.9+crates*.3,size=run.totalMultiplier>=30?.62:.44;this._shape('gem',lean*crates*.1,top+.25,.35,size,size*1.3,size,frenzy?PINK:GOLD,t*4,0,1);}
    this._box(-.62,2,-.95,.04,.8,.04,DARK);this._box(-.44,2.3,-.95,.36,.2,.02,FLAG_COLORS[run.characterId]||GOLD,reducedMotion?0:Math.sin(t*9)*.3,0,.4);
    if(run.magnetTime>0)for(let i=0;i<3;i++){const a=t*3+i*TURN/3;this._shape('gem',Math.cos(a)*1.5,1+Math.sin(a*2)*.2,Math.sin(a)*2.2,.26,.34,.26,MINT,a,0,1);}
    // Shield: a faceted bubble that bursts outward when it takes a hit.
    if(run.shieldCharges>0){this._shape('gem',0,1.15,0,3.4,3.4,4.6,BUBBLE,t*.6,0,.9,.2);this._shape('gem',0,1.15,0,3.4,3.4,4.6,BUBBLE,t*.6+Math.PI/4,0,.9,.14);if(run.shieldCharges>1)this._shape('gem',0,1.15,0,4.1,4.1,5.4,WHITE,-t*.5,0,.9,.12);}
    if(s.shieldPop>0){const grow=1+(1-s.shieldPop)*1.6;this._shape('gem',0,1.15,0,3.3*grow,3.3*grow,5*grow,BUBBLE,t,0,1,.4*s.shieldPop);}
    this._parent=null;
  }

  // --- software fallback -----------------------------------------------------
  _softwareShape(kind,matrix,color,glow,alpha=1){
    const state=this._softwareState,data=this.meshData[kind],light=state.light,fogScale=this._fogScale;
    for(let at=0;at<data.length;at+=18){
      state.triangles++;
      const a=transformPoint(matrix,data[at],data[at+1],data[at+2]),b=transformPoint(matrix,data[at+6],data[at+7],data[at+8]),d=transformPoint(matrix,data[at+12],data[at+13],data[at+14]);
      const flatX=(a[0]+b[0]+d[0])/3,ahead=-(a[2]+b[2]+d[2])/3;
      for(const v of [a,b,d]){v[0]+=this._bendX(-v[2]);v[1]+=this._liftY(-v[2]);}
      const normal=normalize(cross([b[0]-a[0],b[1]-a[1],b[2]-a[2]],[d[0]-a[0],d[1]-a[1],d[2]-a[2]]));
      const center=[(a[0]+b[0]+d[0])/3,(a[1]+b[1]+d[1])/3,(a[2]+b[2]+d[2])/3];
      if(normal.reduce((n,v,i)=>n+v*(state.camera[i]-center[i]),0)<=0)continue;
      const polygon=clipTriangle([a,b,d].map(v=>transformPoint(state.vp,v[0],v[1],v[2])));
      if(polygon.length<3)continue;
      const points=polygon.map(v=>[(v[0]/v[3]*.5+.5)*state.width,(.5-v[1]/v[3]*.5)*state.height]);
      if(points.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])))continue;
      const shade=(.48+.52*Math.max(0,normal.reduce((n,v,i)=>n+v*light[i],0)))*(1-glow)+glow;
      const beam=state.beam?smooth(-1,3,ahead)*(1-smooth(8,64,ahead))*(1-smooth(.5+ahead*.03,2.6+ahead*.1,Math.abs(flatX-state.beamX))):0;
      const distance=Math.hypot(...center.map((v,i)=>v-state.camera[i])),t=Math.max(0,Math.min(1,(distance-55)/120)),fog=t*t*(3-2*t)*fogScale;
      const rgb=color.map((v,i)=>Math.round(Math.max(0,Math.min(1,(v*shade+(v*.75+(i===0?.2:i===1?.17:.08))*beam)*(1-fog)+state.fog[i]*fog))*255));
      state.faces.push({points,depth:polygon.reduce((n,v)=>n+v[3],0)/polygon.length,layer:this._sceneLayer,alpha,color:`rgb(${rgb.join(',')})`});
    }
  }
  _drawSoftware(run,time,reducedMotion){
    // 30 fps bounds CPU paint work on devices without a graphics context.
    if(run.runId===this._softwareLastRun&&time>=this._softwareLastFrame&&time-this._softwareLastFrame<1/30)return;
    this._softwareLastRun=run.runId;this._softwareLastFrame=time;this.stats.presentation='software';
    const c=this.ctx,w=this.canvas.width,h=this.canvas.height,pal=this._palette,css=v=>`rgb(${v.map(n=>Math.round(Math.max(0,Math.min(1,n))*255)).join(',')})`;
    const state={faces:[],triangles:0,camera:this._eye,vp:this._vp,fog:pal.fog,light:LIGHT,width:w,height:h,beam:THEMES[run.worldIndex||0].night===1,beamX:run.player.x};
    this._softwareState=state;
    try{this._drawScene(run,time,reducedMotion);}finally{this._softwareState=null;this._parent=null;this._fogScale=1;}
    c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.fillStyle=css(pal.fog);c.fillRect(0,0,w,h);
    if(typeof c.createLinearGradient==='function'){
      // Sky gradient from the zenith down to the horizon haze.
      const horizon=this._horizon.y*h/this.height,sky=c.createLinearGradient(0,horizon-.36*this._projection[5]*h*.5,0,horizon);sky.addColorStop(0,css(pal.zenith));sky.addColorStop(1,css(pal.fog));
      c.fillStyle=sky;c.fillRect(0,0,w,Math.max(0,Math.min(h,horizon+1)));
    }
    state.faces.sort((a,b)=>a.layer-b.layer||b.depth-a.depth);c.lineWidth=.65;c.lineJoin='round';
    let alpha=1;
    for(const face of state.faces){
      if(face.alpha!==alpha){alpha=face.alpha;c.globalAlpha=alpha;}
      c.beginPath();c.moveTo(...face.points[0]);for(let i=1;i<face.points.length;i++)c.lineTo(...face.points[i]);c.closePath();c.fillStyle=face.color;c.fill();
      if(alpha===1){c.strokeStyle=face.color;c.stroke();}
    }
    c.globalAlpha=1;
    this.softwareStats={triangles:state.triangles,polygons:state.faces.length};
    this._overlay(run,reducedMotion);
  }

  // --- effects and in-view text (shared by both back ends) --------------------
  _sprite(color) {
    let sprite = this._sprites.get(color);
    if (sprite === undefined) {
      sprite = null;
      try {
        const canvas = this.canvas.ownerDocument.createElement('canvas'); canvas.width = canvas.height = 96;
        const g = canvas.getContext('2d'), glow = g.createRadialGradient(48, 48, 31, 48, 48, 68); glow.addColorStop(0, `${color}00`); glow.addColorStop(1, color);
        g.fillStyle = glow; g.fillRect(0, 0, 96, 96); sprite = canvas;
      } catch { sprite = null; }
      this._sprites.set(color, sprite);
    }
    return sprite;
  }
  _edgeGlow(c, color, alpha, w, h) { const sprite = alpha > .01 ? this._sprite(color) : null; if (!sprite) return; c.globalAlpha = Math.min(1, alpha); c.drawImage(sprite, 0, 0, w, h); c.globalAlpha = 1; }
  _drawTreat(c, x, y, size, color) {
    c.fillStyle = color; c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath();
    c.rect(x - size, y - size * .26, size * 2, size * .52);
    for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) { c.moveTo(x + sx * size + size * .4, y + sy * size * .32); c.arc(x + sx * size, y + sy * size * .32, size * .4, 0, TURN); }
    c.fill();
  }
  _text(c, text, x, y, size, color, alpha = 1, font = DISPLAY_FONT) {
    if (alpha <= .01) return; c.globalAlpha = Math.min(1, alpha); c.font = `900 ${Math.round(size)}px ${font}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = Math.max(4, size * .16); c.strokeStyle = INK; c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y); c.globalAlpha = 1;
  }
  _overlay(run, reducedMotion) {
    if (!this._canOverlay) return;
    const c = this.ctx, w = this.width, h = this.height, dpr = this.canvas.width / w, s = this._state, juice = this.juice, shake = juice.offset, ins = this.insets || {};
    const top = ins.top || 0, bottom = ins.bottom || 0, safeH = Math.max(120, h - top - bottom), cx = w / 2 + ((ins.left || 0) - (ins.right || 0)) / 2, t = run.time, left = run.timeLimit - t;
    const beat = reducedMotion ? .6 : .5 + .5 * Math.sin(s.clock * 9);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalAlpha = 1;
    // Bonus layers and danger tint the edges of the view.
    this._edgeGlow(c, '#ffc94f', s.gold * .26, w, h);
    this._edgeGlow(c, '#ff7db8', s.fever * (.18 + .16 * beat), w, h);
    if (left <= RALLY_TIMING.finalPush && run.mode === 'running') this._edgeGlow(c, '#ff6a3d', s.urgency * (reducedMotion ? .18 : .12 + .22 * Math.pow(1 - (left % 1), 3)), w, h);
    if (s.hurt > 0) this._edgeGlow(c, '#ff4a3a', s.hurt * .5, w, h);
    c.save(); c.translate(shake.x, shake.y);
    // Speed streaks pour out of the vanishing point while boosting.
    if (s.boost > .05 && !reducedMotion) {
      const vx = this._horizon.x, vy = this._horizon.y + 8, reach = Math.hypot(w, h) * .6;
      c.strokeStyle = CSS_CREAM; c.lineCap = 'round'; c.lineWidth = 2.2; c.globalAlpha = .34 * s.boost; c.beginPath();
      for (let i = 0; i < 18; i++) {
        const angle = hash01(i, 5) * TURN, phase = (s.clock * (1.6 + hash01(i, 6)) + hash01(i, 7)) % 1, from = reach * (.25 + phase * .7), to = from + reach * (.08 + phase * .2);
        c.moveTo(vx + Math.cos(angle) * from, vy + Math.sin(angle) * from * .8); c.lineTo(vx + Math.cos(angle) * to, vy + Math.sin(angle) * to * .8);
      }
      c.stroke(); c.globalAlpha = 1;
    }
    // The finish banner carries words; they ride on the projected gate.
    if (s.finishGate !== null && s.finishGate > 3 && s.finishGate < 150) {
      const at = this.project(0, 14.6, s.finishGate, this._point);
      const size = Math.min(40, at.scale * 1.3);
      if (at.visible && size >= 12) this._text(c, run.worldIndex === 4 ? 'WELCOME TO BOERNE' : 'FINISH', at.x, at.y, size, CSS_GOLD, 1);
    }
    juice.draw(c);
    c.restore();
    for (const d of s.drops) { c.globalAlpha = Math.min(.5, d.life); c.fillStyle = '#d9f6f4'; c.beginPath(); c.ellipse(d.x * w, d.y * h, d.r, d.r * 1.35, 0, 0, TURN); c.fill(); }
    c.globalAlpha = 1;
    // Rolling start: 3, 2, 1, GO on simulation time, so pause holds the count.
    const midY = top + safeH * .47, big = Math.min(w * .3, safeH * .34), T = RALLY_TIMING;
    if (run.mode !== 'ready' && t < T.go + .9) {
      const go = t >= T.go, index = go ? 3 : t >= T.countdown[2] ? 2 : t >= T.countdown[1] ? 1 : 0, phase = go ? (t - T.go) / .9 : (t - T.countdown[index]) / .8;
      const pop = reducedMotion ? 1 : 1.5 - .5 * smooth(0, .22, phase);
      // A digit is narrow and sits over the open middle lane. GO! is wide and the
      // first cones arrive while it is still up, so it sits high, about on the
      // banner line, and smaller on a short screen where the road ahead is squeezed.
      const goSize = Math.min(60, w * .15, safeH * .12);
      if (go) this._text(c, 'GO!', cx, top + goSize * .6 + safeH * .07 + Math.max(0, safeH - 400) * .1, goSize * pop, CSS_MINT, 1 - smooth(.5, 1, phase));
      else this._text(c, String(3 - index), cx, midY, big * pop, CSS_CREAM, 1 - smooth(.62, 1, phase));
    }
    if (run.mode === 'running' && left <= 3.02 && left > T.finishGlide) {
      const phase = 1 - (left % 1 || 1), pop = reducedMotion ? 1 : 1.35 - .35 * smooth(0, .2, phase);
      this._text(c, String(Math.ceil(left - 1e-6)), cx, top + safeH * .2, big * .7 * pop, CSS_CORAL, .9 * (1 - smooth(.6, 1, phase)));
    }
    if (s.banner && t < s.bannerUntil) {
      const age = 1.9 - (s.bannerUntil - t), size = Math.min(32, w * .074, safeH * .12) * (reducedMotion ? 1 : 1.25 - .25 * smooth(0, .18, age));
      this._text(c, s.banner, cx, this._bannerY(), size, s.bannerColor, Math.min(1, (s.bannerUntil - t) * 3));
    }
    if (left <= T.finishGlide && run.mode !== 'lost' && run.time > 1) this._text(c, 'FINISH!', cx, top + safeH * .36, big * .62, CSS_GOLD, 1);
    juice.drawOverlay(c, w, h);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }
  _banner(run, text, color = CSS_CREAM) { const s = this._state; if (!s) return; s.banner = text; s.bannerColor = color; s.bannerUntil = run.time + 1.9; }
  // Height of the line that banners and GO! share, just under the HUD.
  _bannerY() { const ins = this.insets || {}, top = clamp(ins.top || 0, 0, this.height * .4), bottom = clamp(ins.bottom || 0, 0, this.height * .45); return top + Math.max(120, this.height - top - bottom) * .14 + 14; }
  // A popup that stays whole on screen however far the RV has steered, and
  // under the banner line however short the screen is.
  _say(text, x, y, options) {
    const w = this.width, room = w - 12, wide = text.length * options.size * .62;
    if (wide > room) options.size = Math.max(11, options.size * room / wide);
    const half = Math.min(room, text.length * options.size * .62) / 2 + 6;
    return this.juice.popup(text, Math.max(half, Math.min(w - half, x)), Math.max(y, this._bannerY() + 16 + options.size * .5), options);
  }
  /** Engine events become impact: hit-stop, shake, flashes, debris, popups, and snacks flying to the HUD. */
  addEvent(e, run) {
    if (!e || !run || this.destroyed) return;
    if (!this._state || this._state.runId !== run.runId) this._resetRun(run);
    const s = this._state, juice = this.juice, p = run.player, still = juice.reducedMotion;
    const rv = this.project(p.x, 1.3 + (p.y || 0), 0, this._anchor), k = Math.max(10, Math.min(90, rv.scale));
    switch (e.type) {
      case 'start': juice.clear(); break;
      case 'countdown': juice.ring(rv.x, rv.y, { color: CSS_CREAM, radius: k * 2.4, life: .45, width: 5 }); break;
      case 'go': juice.flash('#eafff4', .22, .25); juice.zoomPunch(.05); juice.ring(rv.x, rv.y, { color: CSS_MINT, radius: k * 4, life: .5, width: 7 }); juice.burst('dust', rv.x, rv.y + k * .6, { count: 10, scale: k / 30 }); break;
      case 'collect': {
        const at = this.project(e.x ?? p.x, .9 + (e.y || 0), e.z || 0, this._point), gold = e.kind === 'gold', snack = gold || e.kind === 'bone', stack = e.totalMultiplier || 1;
        juice.burst(gold ? 'gold' : snack ? 'crumb' : 'spark', at.x, at.y, { scale: k / 34 });
        this._say(`+${e.value}`, at.x, at.y - k * .5, { color: gold ? CSS_GOLD : stack >= 10 ? CSS_PINK : stack > 1 ? CSS_GOLD : CSS_CREAM, size: Math.min(30, (gold ? 22 : 15) + Math.min(8, stack * .6)), life: .75, rise: 52 });
        if (snack) { juice.fly({ x: at.x, y: at.y, target: this._hudPoint, life: .46, arc: 44, draw: gold ? this._flyGold : this._flyBone, onArrive: () => juice.ring(this._hud.x, this._hud.y, { color: gold ? CSS_GOLD : CSS_CREAM, radius: 16, life: .22, width: 3 }) }); s.pulse = 1; }
        if (gold) juice.zoomPunch(.03);
        break;
      }
      case 'combo': juice.ring(rv.x, rv.y, { color: CSS_GOLD, radius: k * 2.6, life: .4, width: 5 }); this._say(`CHAIN ×${e.multiplier}`, rv.x, rv.y - k * 2.2, { color: CSS_GOLD, size: 22, life: 1 }); s.bounceV += 1.2; break;
      case 'gold-rush': juice.flash('#ffd66b', .26, .35); juice.burst('gold', rv.x, rv.y, { count: 18, scale: k / 30 }); juice.ring(rv.x, rv.y, { color: CSS_GOLD, radius: k * 5, life: .6, width: 8 }); break;
      case 'fever': juice.flash('#ff8fc4', .28, .4); juice.shake(.18); juice.zoomPunch(.05); juice.burst('confetti', rv.x, rv.y - k, { count: 22 }); juice.ring(rv.x, rv.y, { color: CSS_PINK, radius: k * 6, life: .7, width: 9 }); break;
      case 'power': juice.flash('#fff3b8', .3, .3); juice.zoomPunch(-.06); juice.kick(0, 8); juice.burst('power', rv.x, rv.y + k * .4, { scale: k / 34 }); s.bounceV -= 1.6; break;
      case 'charged': juice.ring(rv.x, rv.y, { color: CSS_MINT, radius: k * 2.8, life: .5, width: 5 }); juice.burst('spark', rv.x, rv.y, { count: 8, color: CSS_MINT }); break;
      case 'hit':
        juice.hitStop(.09); juice.shake(.6); juice.flash('#ff5a3c', .3, .28); juice.kick(0, 10);
        juice.burst('hit', rv.x, rv.y - k * .3, { scale: k / 30 }); juice.burst('debris', rv.x, rv.y, { scale: k / 34 });
        this._say('BONK!', rv.x, rv.y - k * 2, { color: CSS_CORAL, size: 26, life: .9 });
        s.hurt = 1; s.bounceV += 3; if (!still && run.multiplier >= 1) this._scatterCrates(run, 3);
        break;
      case 'smash': { const at = this.project(e.x ?? p.x, .8, e.z || 0, this._point); juice.hitStop(.04); juice.shake(.28); juice.burst('stomp', at.x, at.y, { scale: k / 30 }); this._say(`SMASH! +${e.value}`, at.x, at.y - k, { color: CSS_GOLD, size: 22 }); s.bounceV += 1.5; break; }
      case 'shield':
        juice.hitStop(.06); juice.shake(.32); juice.flash('#9fdcff', .3, .3);
        juice.ring(rv.x, rv.y, { color: CSS_SKY, radius: k * 4.5, life: .5, width: 8 }); juice.ring(rv.x, rv.y, { color: '#ffffff', radius: k * 3, life: .35, width: 4 });
        juice.burst('bubble', rv.x, rv.y, { count: 14, scale: k / 30 }); juice.burst('spark', rv.x, rv.y, { count: 14, color: CSS_SKY });
        this._say('SHIELD SAVE!', rv.x, rv.y - k * 2, { color: CSS_SKY, size: 24, life: 1 }); s.shieldPop = 1; s.bounceV += 2;
        break;
      case 'near-miss': {
        const side = e.side || 1, at = this.project(p.x + side * 1.2, 1, 0, this._point);
        juice.slowMo(.5, .16); juice.kick(-side * 7, 0); juice.zoomPunch(.03); s.near = 1;
        juice.burst('spark', at.x, at.y, { count: 10, angle: side > 0 ? 0 : Math.PI, spread: [0, 1.2] });
        this._say('SO CLOSE!', rv.x + side * k * .6, rv.y - k * 1.9, { color: CSS_CREAM, size: 24, life: .9 }); this._say(`+${e.value}`, rv.x + side * k * .6, rv.y - k * 1.2, { color: CSS_GOLD, size: 17, life: .8 });
        break;
      }
      case 'heal': juice.burst('heart', rv.x, rv.y - k * .5, { scale: k / 34 }); this._say('+1 HEART', rv.x, rv.y - k * 2, { color: '#ffb4a3', size: 20 }); break;
      case 'pickup': {
        const star = e.kind === 'star', color = star ? CSS_GOLD : e.kind === 'shield' ? CSS_SKY : CSS_MINT;
        juice.ring(rv.x, rv.y, { color, radius: k * 3.4, life: .45, width: 6 });
        this._say(star ? 'WISH GRANTED! BOOST UP' : e.kind === 'shield' ? 'SHIELD UP!' : 'SNACK MAGNET!', rv.x, rv.y - k * 2.1, { color, size: 20, life: 1 });
        if (star) { juice.burst('star', rv.x, rv.y, { count: 12, scale: k / 30 }); juice.flash('#fff0a8', .2, .25); }
        break;
      }
      case 'ramp': juice.kick(0, 12); juice.burst('land', rv.x, rv.y + k * .7, { scale: k / 30 }); this._say('BIG AIR!', rv.x, rv.y - k * 2.2, { color: CSS_GOLD, size: 26, life: 1 }); s.bounceV += 2.4; break;
      case 'landing':
        juice.shake(.3); juice.kick(0, 12); juice.burst('land', rv.x - k * .7, rv.y + k * .7, { scale: k / 28 }); juice.burst('land', rv.x + k * .7, rv.y + k * .7, { scale: k / 28 }); s.bounceV -= 4;
        if (e.cleared > 0) this._say(`CLEARED IT! +${e.value}`, rv.x, rv.y - k * 2, { color: CSS_GOLD, size: 22, life: 1 });
        break;
      case 'splash': {
        juice.flash('#bfeeff', .2, .25); juice.kick(0, -6); juice.burst('splash', rv.x - k * .7, rv.y + k * .5, { scale: k / 26 }); juice.burst('splash', rv.x + k * .7, rv.y + k * .5, { scale: k / 26 });
        this._say(`SPLASH! +${e.value}`, rv.x, rv.y - k * 2, { color: CSS_SKY, size: 22, life: .9 }); s.bounceV += 1.5;
        if (!still) for (let i = 0; i < 7; i++) s.drops.push({ x: Math.random(), y: .15 + Math.random() * .6, r: 4 + Math.random() * 7, vy: .05 + Math.random() * .12, life: .7 + Math.random() * .7 });
        break;
      }
      case 'convoy-start': this._banner(run, 'SNACK CONVOY!', CSS_GOLD); break;
      case 'convoy': juice.flash('#fff0a8', .24, .3); juice.burst('confetti', rv.x, rv.y - k, { count: 24 }); this._say(`PERFECT CONVOY! +${e.value}`, rv.x, rv.y - k * 2.4, { color: CSS_GOLD, size: 24, life: 1.3 }); juice.zoomPunch(.04); break;
      case 'final-push': this._banner(run, 'FINAL STRETCH!', CSS_CORAL); juice.flash('#ff8f6b', .22, .35); juice.zoomPunch(.04); break;
      case 'final-tick': juice.zoomPunch(.02); break;
      case 'finish-line':
        // The last moments play in slow motion under falling confetti.
        juice.slowMo(.3, 1.3); juice.flash('#ffffff', .4, .5); juice.zoomPunch(.07);
        juice.burst('confetti', this.width * .2, this.height * .35, { count: 30 }); juice.burst('confetti', this.width * .8, this.height * .35, { count: 30 }); juice.burst('gold', rv.x, rv.y, { count: 16, scale: k / 28 });
        break;
      case 'won': juice.burst('confetti', this.width * .5, this.height * .3, { count: 30 }); break;
      case 'lost': juice.shake(.5); break;
      default: break;
    }
  }
  destroy() {
    if (this.destroyed) return; this.destroyed = true; this.observer?.disconnect(); this.watcher?.disconnect();
    this.surface?.removeEventListener('webglcontextlost',this._lost);this.surface?.removeEventListener('webglcontextrestored',this._restored);
    if(this.gl){for(const mesh of Object.values(this.meshes||{}))this.gl.deleteBuffer(mesh.buffer);for(const batch of Object.values(this.batches||{})){if(batch.solidBuffer)this.gl.deleteBuffer(batch.solidBuffer);if(batch.sheerBuffer)this.gl.deleteBuffer(batch.sheerBuffer);}if(this.program)this.gl.deleteProgram(this.program);}
    this.surface?.parentNode?.removeChild?.(this.surface);this.juice.clear();
    this.is3D=false;this.gl=null;this.surface=null;
  }
}
