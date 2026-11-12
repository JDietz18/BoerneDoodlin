// Doodle Onward · deterministic RV Rally simulation and native WebGL scenery.
// No network, third-party renderer, textures, or saved-state side effects.
export const RALLY_WORLD = Object.freeze({ lanes: Object.freeze([-3, 0, 3]), halfWidth: 4.8, viewDistance: 175 });
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(Number(v)) ? Number(v) : a));
const copy = value => JSON.parse(JSON.stringify(value));
const CHARACTERS = ['griffin', 'kevin', 'mittens', 'spike'];
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
    this.player = { x: 0, z: 0, vx: 0, width: 1.35, length: 2.8 };
    this.speed = 21 + this.worldIndex * 1.2; this.steering = 0; this.braking = false;
    this.entities = []; this.courseHistory = []; this._nextRow = 74; this._row = 0; this._id = 0; this._safeLane = 1; this._summary = null;
    for (const z of [22, 31, 40, 49]) this._add('bone', 0, z);
    this._ensureCourse(); this.emit('start', { mode: 'rally', runId: this.runId, worldIndex: this.worldIndex }); return this;
  }
  move(direction) { if (this.mode === 'running') this.steering = clamp(direction, -1, 1); }
  brake(held) { if (this.mode === 'running') this.braking = Boolean(held); }
  power() {
    if (this.mode !== 'running' || this.charge < 100 || this.powerTime > 0) return false;
    this.charge = 0; this.powersUsed++;
    this.powerDuration = (this.characterId === 'kevin' ? 5.5 : 4.5) + (this.charms.powerDuration || 0);
    this.powerTime = this.powerDuration;
    if (this.characterId === 'mittens' && this.hearts < this.maxHearts) { this.hearts++; this.emit('heal', { hearts: this.hearts }); }
    this._multipliers(); this.emit('power', { characterId: this.characterId, duration: this.powerDuration }); return true;
  }
  pause() { if (this.mode === 'running') { this.mode = 'paused'; this.steering = 0; this.braking = false; this.player.vx = 0; this.emit('pause'); } }
  resume() { if (this.mode === 'paused') { this.mode = 'running'; this.emit('resume'); } }
  _add(type, x, worldZ) {
    this.entities.push({ id: ++this._id, type, x, z: worldZ - this.distance, worldZ,
      width: type === 'barrier' ? 1.9 : type === 'cone' ? 1.0 : .55,
      depth: type === 'barrier' ? .7 : .6, hit: false, taken: false, passed: false });
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
      this.courseHistory.push({ z: rowZ, safeLane: safe, blocked: [...blocked] });
      if (this.courseHistory.length > 80) this.courseHistory.shift();
      this._nextRow += 44 + this._random() * 9; this._row++;
    }
  }
  update(dt) {
    if (this.mode !== 'running') return;
    let remaining = clamp(dt || 0, 0, .1);
    while (remaining > 1e-8 && this.mode === 'running') { const step = Math.min(1 / 120, remaining); remaining -= step; this._step(step); }
  }
  _step(dt) {
    dt = Math.min(dt, this.timeLimit - this.time); this.time += dt;
    for (const key of ['powerTime', 'invincible', 'magnetTime', 'goldRushTime', 'feverTime', '_feverCooldown', 'comboTime']) this[key] = Math.max(0, this[key] - dt);
    if (!this.comboTime) { this.combo = 0; this.multiplier = 1; }
    const beforeCharge = this.charge;
    this.charge = Math.min(this.powerTime > 0 ? 90 : 100, this.charge + dt * (1.8 + this.gear.charge * .35));
    if (beforeCharge < 100 && this.charge >= 100) this.emit('charged');
    if (this.mode !== 'running') return;
    const targetSpeed = (21 + this.worldIndex * 1.2 + this.time * .035) * (this.assist ? .82 : 1) * (this.braking ? .58 : 1) * (this.powerTime > 0 ? 1.18 : 1);
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 4);
    this.distance += this.speed * dt;
    const p = this.player;
    const targetVx = this.steering * (this.assist ? 7.5 : 7) * (1 + (this.charms.speed || 0));
    p.vx += (targetVx - p.vx) * Math.min(1, dt * 13);
    p.x = Math.max(-3.9, Math.min(3.9, p.x + p.vx * dt));
    if (Math.abs(p.x) === 3.9 && Math.sign(p.vx) === Math.sign(p.x)) p.vx = 0;
    this._ensureCourse(); this._multipliers();
    for (const e of this.entities) {
      e.z = e.worldZ - this.distance;
      if (e.taken || e.passed) continue;
      const obstacle = e.type === 'cone' || e.type === 'barrier';
      if (obstacle) {
        const close = e.z < 1.4 + e.depth * .5 && e.z > -1.5 - e.depth * .5;
        if (close && !e.hit && Math.abs(e.x - p.x) < (e.width + p.width) * .42) {
          e.hit = true;
          if (this.powerTime > 0) { const value = this.characterId === 'spike' ? 90 : 40; this.score += value; this.emit('smash', { kind: e.type, value, x: e.x, z: e.z }); }
          else if (!this.invincible) {
            if (this.shieldCharges > 0) { this.shieldCharges--; this.invincible = 1; this.emit('shield', { x: e.x, z: e.z }); }
            else {
              this.hearts--; this.hits++; this.combo = 0; this.multiplier = 1; this.comboTime = 0; this.charge = Math.max(0, this.charge - 10);
              this.invincible = this.assist ? 2 : 1.5; this._multipliers(); this.emit('hit', { hearts: this.hearts, x: p.x, z: 0 });
              if (this.hearts <= 0) { this._finish(false); return; }
            }
          }
        }
        if (e.z < -2.1) { e.passed = true; if (!e.hit) { this.dodged++; this.score += 20; this._charge(4); this.emit('dodge', { kind: e.type, value: 20 }); } }
      } else {
        const reach = .72 + this.gear.magnet * .16 + (this.magnetTime > 0 ? .85 : 0) + (this.powerTime > 0 ? this.characterId === 'kevin' ? 2.4 : .5 : 0);
        if (e.z < 1.7 && e.z > -1.8 && Math.abs(e.x - p.x) < reach) this._collect(e);
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
    this.score += value; this.emit('collect', { kind: e.type, value, combo: this.combo, multiplier: this.multiplier, totalMultiplier: this.totalMultiplier, x: e.x, z: e.z });
  }
  _snapshot() { return { runId: this.runId, mode: 'rally', state: this.mode, won: this.mode === 'won', worldIndex: this.worldIndex, stage: this.worldIndex, characterId: this.characterId, seed: this.seed, dailyDate: this.dailyDate, assist: this.assist, gear: { ...this.gear }, charms: { ...this.charms }, score: Math.round(this.score), treats: this.treats, gold: this.gold, distance: Math.round(this.distance), dodged: this.dodged, hits: this.hits, bestCombo: this.bestCombo, bestMultiplier: this.bestMultiplier, powersUsed: this.powersUsed, hearts: this.hearts, maxHearts: this.maxHearts, time: Number(this.time.toFixed(3)) }; }
  _finish(won) { if (this.mode !== 'running' || this._summary) return; this.mode = won ? 'won' : 'lost'; this.steering = 0; this.braking = false; if (won) this.score += this.hearts * 80 + (this.hits === 0 ? 200 : 0); this._summary = this._snapshot(); this.emit(this.mode, { result: this.result() }); }
  result() { return copy(this._summary || this._snapshot()); }
}

const THEMES = [
  { sky: [0.64, .84, .86], ground: [.32, .56, .36], tree: [.14, .38, .27], road: [.3, .37, .38] },
  { sky: [.67, .77, .69], ground: [.27, .43, .26], tree: [.12, .29, .2], road: [.32, .34, .3] },
  { sky: [.59, .79, .88], ground: [.76, .49, .3], tree: [.68, .34, .22], road: [.39, .34, .32] },
  { sky: [.1, .15, .29], ground: [.29, .27, .37], tree: [.23, .2, .32], road: [.22, .24, .3] },
  { sky: [.65, .84, .91], ground: [.55, .64, .3], tree: [.28, .45, .25], road: [.34, .38, .34] }
];
const CREAM = [.95, .91, .76], GOLD = [1, .77, .26], MINT = [.49, .77, .63], DARK = [.1, .15, .17];
function multiply(a, b) { const out = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return out; }
function perspective(fov, aspect, near, far) { const f = 1 / Math.tan(fov / 2), n = 1 / (near - far); return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * n, -1, 0, 0, 2 * far * near * n, 0]); }
const normalize = a => { const n = Math.hypot(...a) || 1; return a.map(x => x / n); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function lookAt(eye, target) { const z = normalize(eye.map((x, i) => x - target[i])), x = normalize(cross([0, 1, 0], z)), y = cross(z, x); const dot = a => -(a[0] * eye[0] + a[1] * eye[1] + a[2] * eye[2]); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, dot(x), dot(y), dot(z), 1]); }
function model(x, y, z, sx, sy, sz, yaw = 0, roll = 0) { const c = Math.cos(yaw), s = Math.sin(yaw), a = Math.cos(roll), b = Math.sin(roll); return new Float32Array([c * a * sx, b * sx, -s * a * sx, 0, -c * b * sy, a * sy, s * b * sy, 0, s * sz, 0, c * sz, 0, x, y, z, 1]); }
function geometry(kind) {
  const data = [];
  const triangle = (a, b, c) => { const n = normalize(cross(b.map((v, i) => v - a[i]), c.map((v, i) => v - a[i]))); for (const p of [a, b, c]) data.push(...p, ...n); };
  if (kind === 'cube') {
    const v = [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];
    for (const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]) { triangle(v[a],v[b],v[c]); triangle(v[a],v[c],v[d]); }
  } else if (kind === 'gem') {
    const top = [0,.5,0], bottom = [0,-.5,0], ring = [[.5,0,0],[0,0,.5],[-.5,0,0],[0,0,-.5]];
    for (let i = 0; i < 4; i++) { triangle(top,ring[(i+1)%4],ring[i]); triangle(bottom,ring[i],ring[(i+1)%4]); }
  } else {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, b = (i + 1) / 12 * Math.PI * 2;
      const p = [Math.cos(a) * .5,-.5,Math.sin(a) * .5], q = [Math.cos(b) * .5,-.5,Math.sin(b) * .5];
      triangle([0,-.5,0],p,q);
      if (kind === 'cone') triangle(p,[0,.5,0],q);
      else { const u = [p[0],.5,p[2]], v = [q[0],.5,q[2]]; triangle(p,u,v); triangle(p,v,q); triangle([0,.5,0],v,u); }
    }
  }
  return new Float32Array(data);
}

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

const VERTEX = `attribute vec3 aPosition; attribute vec3 aNormal; uniform mat4 uModel; uniform mat4 uViewProjection; varying vec3 vNormal; varying vec3 vPosition; void main(){ vec4 p=uModel*vec4(aPosition,1.0); vPosition=p.xyz; vNormal=normalize(mat3(uModel)*aNormal); gl_Position=uViewProjection*p; }`;
const FRAGMENT = `precision mediump float; uniform vec3 uColor; uniform vec3 uFog; uniform vec3 uCamera; uniform float uGlow; varying vec3 vNormal; varying vec3 vPosition; void main(){ float light=.48+.52*max(dot(normalize(vNormal),normalize(vec3(-.4,.85,.3))),0.0); vec3 color=uColor*mix(light,1.0,uGlow); float fog=smoothstep(55.0,175.0,distance(uCamera,vPosition)); gl_FragColor=vec4(mix(color,uFog,fog),1.0); }`;

/** The supplied canvas remains a 2D presentation surface, allowing a reliable
 * fallback even if a WebGL context is lost. The scene is rendered by native
 * WebGL into an internal canvas, then presented in one drawImage operation.
 */
export class RallyRenderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.gl = null; this.is3D = false; this.destroyed = false;
    this.backend='software-3d';this.backendReason='initializing';this.softwareStats={triangles:0,polygons:0};
    this.meshData=Object.fromEntries(['cube','cone','cylinder','gem'].map(kind=>[kind,geometry(kind)]));
    this._softwareState=null;this._softwareLastFrame=-Infinity;this._softwareLastRun='';
    this.surface = canvas.ownerDocument?.createElement('canvas') || null;
    this._lost = event => { event.preventDefault(); this.is3D = false;this._setBackend('webgl-context-lost');this._softwareLastFrame=-Infinity; };
    this._restored = () => { if (!this.destroyed) this._initGL(); };
    this.surface?.addEventListener('webglcontextlost', this._lost);
    this.surface?.addEventListener('webglcontextrestored', this._restored);
    this._initGL(); this.resize();
    if (typeof ResizeObserver !== 'undefined') { this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); }
  }
  _initGL() {
    try {
      const gl = this.surface?.getContext('webgl', { alpha: false, antialias: true, depth: true, powerPreference: 'low-power' });
      if (!gl) {this.is3D=false;this._setBackend('webgl-context-unavailable');return;}
      this.gl = gl;
      const shader = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const info=gl.getShaderInfoLog(s)||'';gl.deleteShader(s);throw new Error(`webgl-${type===gl.VERTEX_SHADER?'vertex':'fragment'}-compile-failed: ${info.slice(0,180)}`); } return s; };
      const vertex = shader(gl.VERTEX_SHADER, VERTEX), fragment = shader(gl.FRAGMENT_SHADER, FRAGMENT);
      const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { const info=gl.getProgramInfoLog(program)||'';gl.deleteProgram(program);throw new Error(`webgl-link-failed: ${info.slice(0,180)}`); }
      this.program = program; this.locations = {};
      for (const name of ['uModel', 'uViewProjection', 'uColor', 'uFog', 'uCamera', 'uGlow']) this.locations[name] = gl.getUniformLocation(program, name);
      this.position = gl.getAttribLocation(program, 'aPosition'); this.normal = gl.getAttribLocation(program, 'aNormal');
      this.meshes = {};
      for (const [kind,data] of Object.entries(this.meshData)) { const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); this.meshes[kind] = { buffer, count: data.length / 6 }; }
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); this.is3D = true;this._setBackend('webgl-ready');
    } catch(error) { this.is3D = false;this._setBackend(String(error?.message||'webgl-context-request-failed').startsWith('webgl-')?error.message:`webgl-initialization-failed: ${String(error?.message||error).slice(0,180)}`); }
  }
  _setBackend(reason){this.backend=this.is3D?'webgl':'software-3d';this.backendReason=reason;if(this.canvas.dataset){this.canvas.dataset.renderer=this.backend;this.canvas.dataset.renderStatus=reason;}}
  resize() {
    if (this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect(); this.width = Math.max(1, rect.width || 800); this.height = Math.max(1, rect.height || 500);
    const dpr = Math.min(1.5, globalThis.devicePixelRatio || 1, 1400 / this.width);
    const width = Math.round(this.width * dpr), height = Math.round(this.height * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height;this._softwareLastFrame=-Infinity; }
    if (this.surface && (this.surface.width !== width || this.surface.height !== height)) { this.surface.width = width; this.surface.height = height; }
  }
  draw(run, { time = run.time || 0, reducedMotion = false } = {}) {
    if (this.destroyed || !this.ctx) return;
    if (this.is3D && !this.gl.isContextLost()) {
      try { this._draw3D(run, time, reducedMotion); this.ctx.setTransform(1,0,0,1,0,0); this.ctx.drawImage(this.surface,0,0); return; }
      catch(error) { this.is3D = false;this._setBackend(`webgl-draw-failed: ${String(error?.message||error).slice(0,180)}`); }
    }
    else if(this.is3D){this.is3D=false;this._setBackend('webgl-context-lost');}
    this._drawSoftware(run, time, reducedMotion);
  }
  _shape(kind, x, y, z, sx, sy, sz, color, yaw = 0, roll = 0, glow = 0) {
    if(this._softwareState){this._softwareShape(kind,model(x,y,z,sx,sy,sz,yaw,roll),color,glow);return;}
    const gl = this.gl, mesh = this.meshes[kind];
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer); gl.vertexAttribPointer(this.position,3,gl.FLOAT,false,24,0); gl.vertexAttribPointer(this.normal,3,gl.FLOAT,false,24,12);
    gl.uniformMatrix4fv(this.locations.uModel,false,model(x,y,z,sx,sy,sz,yaw,roll)); gl.uniform3fv(this.locations.uColor,color); gl.uniform1f(this.locations.uGlow,glow); gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }
  _box(...args) { this._shape('cube', ...args); }
  _draw3D(run, time, reducedMotion) {
    const gl = this.gl, theme = THEMES[run.worldIndex || 0], aspect = this.surface.width / this.surface.height;
    gl.viewport(0,0,this.surface.width,this.surface.height); gl.clearColor(...theme.sky,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); gl.useProgram(this.program);
    gl.enableVertexAttribArray(this.position); gl.enableVertexAttribArray(this.normal);
    const camera = [run.player.x * .16, 6.8, 12.5];
    const projection = perspective((aspect < .9 ? 68 : 56) * Math.PI / 180, aspect, .1, 260);
    gl.uniformMatrix4fv(this.locations.uViewProjection,false,multiply(projection,lookAt(camera,[run.player.x * .04,.5,-30])));
    gl.uniform3fv(this.locations.uCamera,camera); gl.uniform3fv(this.locations.uFog,theme.sky);
    this._drawScene(run,time,reducedMotion);gl.flush();
  }
  _drawScene(run,time,reducedMotion){
    const theme=THEMES[run.worldIndex||0];
    this._sceneLayer=0;
    this._box(0,-.2,-100,280,.3,260,theme.ground);
    this._sceneLayer=1;
    if(this._softwareState){
      // Short ground segments give the flat-shaded software renderer depth fog.
      for(let z=-10;z<190;z+=20){this._box(0,-.025,-z,9.6,.12,20,theme.road);this._box(-5.1,-.02,-z,.55,.13,20,CREAM);this._box(5.1,-.02,-z,.55,.13,20,CREAM);}
    }else{this._box(0,-.025,-95,9.6,.12,220,theme.road);this._box(-5.1,-.02,-95,.55,.13,220,CREAM);this._box(5.1,-.02,-95,.55,.13,220,CREAM);}
    this._sceneLayer=2;
    const stripes = run.distance % 8;
    for (let z = -8; z < 175; z += 8) for (const x of [-1.5,1.5]) this._box(x,.046,-z+stripes,.075,.015,3.4,CREAM,0,0,.35);
    this._sceneLayer=3;
    const segment = Math.floor(run.distance / 18), offset = run.distance % 18;
    for (let i = 0; i < (this._softwareState?9:11); i++) for (const side of [-1,1]) {
      const hash = Math.sin((segment+i+run.seed*.01)*12.9898+side*78.233)*43758.5453;
      const variation = hash - Math.floor(hash); const x = side*(8.5+variation*12), z = -(i*18+8-offset);
      if (run.worldIndex === 2 || run.worldIndex === 3) {
        this._shape('cone',x,1.3+variation,z,3+variation*4,3+variation*3,3+variation*3,theme.tree,variation);
        this._box(x+side*2,.6,z-1,2.5,1.2,2,theme.tree,variation);
      } else {
        this._box(x,1.2,z,.4,2.4,.4,[.38,.27,.19]);
        this._shape('cone',x,3.1+variation,z,2.8,4.3+variation*2,2.8,theme.tree);
        if (run.worldIndex === 4) { this._shape('gem',side*6.2,.15,z+3,.28,.35,.28,i%2?GOLD:[.73,.57,.8],0,0,.5); }
      }
      this._box(side*5.65,.42,z,.13,.85,.13,CREAM);
      this._box(side*5.65,.72,z,.16,.17,.16,side===1?GOLD:[.9,.4,.28],0,0,.3);
    }
    for (const e of run.entities) {
      if (e.taken || e.z < -10 || e.z > 175 || e.hit) continue;
      const z = -e.z, bob = reducedMotion ? 0 : Math.sin(time*2.5+e.id)*.07, turn = reducedMotion ? .2 : time*.7;
      if (e.type === 'cone') { this._box(e.x,.07,z,1,.14,1,[.28,.24,.22]); this._shape('cone',e.x,.52,z,.7,.95,.7,[.96,.42,.2]); this._shape('cone',e.x,.54,z,.43,.2,.43,CREAM); }
      else if (e.type === 'barrier') { this._box(e.x,.48,z,1.9,.75,.7,[.94,.55,.2]); for (let i = -1; i <= 1; i++) this._box(e.x+i*.6,.49,z+.36,.28,.55,.035,CREAM,0,-.2); }
      else if (e.type === 'bone') { this._box(e.x,.72+bob,z,.6,.13,.16,CREAM,turn,0,.65); for (const s of [-1,1]) this._shape('gem',e.x+s*.25,.72+bob,z,.23,.32,.27,CREAM,turn,0,.65); }
      else { const color = e.type==='gold'?GOLD:e.type==='heart'?[.96,.43,.42]:e.type==='shield'?[.44,.72,.96]:MINT; this._shape(e.type==='shield'?'cylinder':'gem',e.x,.85+bob,z,.75,.85,.75,color,turn,0,.7); this._box(e.x,.14,z,.45,.035,.45,color,turn,0,.2); }
    }
    const x = run.player.x, lean = reducedMotion ? 0 : -run.player.vx*.012, rv = run.invincible>0?[1,.77,.64]:[.94,.93,.84];
    if (run.powerTime > 0) this._box(x,.03,0,2.1,.03,3.7,GOLD,0,0,.9);
    this._box(x,.72,0,1.65,1.28,3.05,rv,0,lean);
    this._box(x,1.51,-.12,1.67,.35,2.7,CREAM,0,lean);
    this._box(x,.8,1.54,1.45,.25,.045,run.powerTime>0?GOLD:MINT,0,0,.2);
    this._box(x,1.2,1.56,.85,.43,.055,[.13,.3,.36]);
    this._box(x,.28,1.64,1.75,.16,.13,[.5,.57,.56]);
    this._box(x,1.01,-1.55,1.4,.54,.065,[.16,.36,.42]);
    for (const side of [-1,1]) {
      this._box(x+side*.83,1.12,-.42,.035,.45,.8,[.2,.39,.42]);
      this._box(x+side*.84,.78,0,.035,.17,2.7,run.powerTime>0?GOLD:MINT);
      this._box(x+side*.57,.48,1.62,.22,.18,.08,run.braking?[1,.19,.12]:[.75,.22,.15],0,0,.8);
      for (const z of [-.91,.9]) { this._shape('cylinder',x+side*.85,.27,z,.55,.25,.55,DARK,0,Math.PI/2); this._shape('cylinder',x+side*1,.27,z,.26,.035,.26,[.7,.72,.68],0,Math.PI/2); }
    }
    this._box(x,1.76,.3,1.15,.13,1.2,[.37,.48,.43]); this._box(x-.2,1.94,.3,.55,.28,.68,[.87,.57,.33]);
    if (run.shieldCharges>0) { this._shape('gem',x,2.3,.5,.35,.45,.35,[.55,.82,1],0,0,.9); }
  }
  _softwareShape(kind,matrix,color,glow){
    const state=this._softwareState,data=this.meshData[kind],light=state.light;
    for(let at=0;at<data.length;at+=18){
      state.triangles++;
      const a=transformPoint(matrix,data[at],data[at+1],data[at+2]),b=transformPoint(matrix,data[at+6],data[at+7],data[at+8]),d=transformPoint(matrix,data[at+12],data[at+13],data[at+14]);
      const normal=normalize(cross([b[0]-a[0],b[1]-a[1],b[2]-a[2]],[d[0]-a[0],d[1]-a[1],d[2]-a[2]]));
      const center=[(a[0]+b[0]+d[0])/3,(a[1]+b[1]+d[1])/3,(a[2]+b[2]+d[2])/3];
      if(normal.reduce((n,v,i)=>n+v*(state.camera[i]-center[i]),0)<=0)continue;
      const polygon=clipTriangle([a,b,d].map(v=>transformPoint(state.vp,v[0],v[1],v[2])));
      if(polygon.length<3)continue;
      const points=polygon.map(v=>[(v[0]/v[3]*.5+.5)*state.width,(.5-v[1]/v[3]*.5)*state.height]);
      if(points.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])))continue;
      const shade=(.48+.52*Math.max(0,normal.reduce((n,v,i)=>n+v*light[i],0)))*(1-glow)+glow;
      const distance=Math.hypot(...center.map((v,i)=>v-state.camera[i])),t=Math.max(0,Math.min(1,(distance-55)/120)),fog=t*t*(3-2*t);
      const rgb=color.map((v,i)=>Math.round(Math.max(0,Math.min(1,v*shade*(1-fog)+state.fog[i]*fog))*255));
      state.faces.push({points,depth:polygon.reduce((n,v)=>n+v[3],0)/polygon.length,layer:this._sceneLayer,color:`rgb(${rgb.join(',')})`});
    }
  }
  _drawSoftware(run,time,reducedMotion){
    // 30 fps bounds CPU paint work on devices without a graphics context.
    if(run.runId===this._softwareLastRun&&time>=this._softwareLastFrame&&time-this._softwareLastFrame<1/30)return;
    this._softwareLastRun=run.runId;this._softwareLastFrame=time;
    const c=this.ctx,w=this.canvas.width,h=this.canvas.height,theme=THEMES[run.worldIndex||0],aspect=w/h;
    const camera=[run.player.x*.16,6.8,12.5],vp=multiply(perspective((aspect<.9?68:56)*Math.PI/180,aspect,.1,260),lookAt(camera,[run.player.x*.04,.5,-30]));
    const state={faces:[],triangles:0,camera,vp,fog:theme.sky,light:normalize([-.4,.85,.3]),width:w,height:h};
    this._softwareState=state;
    try{this._drawScene(run,time,reducedMotion);}finally{this._softwareState=null;}
    c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.fillStyle=`rgb(${theme.sky.map(v=>Math.round(v*255)).join(',')})`;c.fillRect(0,0,w,h);
    state.faces.sort((a,b)=>a.layer-b.layer||b.depth-a.depth);c.lineWidth=.65;c.lineJoin='round';
    for(const face of state.faces){c.beginPath();c.moveTo(...face.points[0]);for(let i=1;i<face.points.length;i++)c.lineTo(...face.points[i]);c.closePath();c.fillStyle=face.color;c.strokeStyle=face.color;c.fill();c.stroke();}
    this.softwareStats={triangles:state.triangles,polygons:state.faces.length};
  }
  destroy() {
    if (this.destroyed) return; this.destroyed = true; this.observer?.disconnect();
    this.surface?.removeEventListener('webglcontextlost',this._lost);this.surface?.removeEventListener('webglcontextrestored',this._restored);
    if(this.gl){for(const mesh of Object.values(this.meshes||{}))this.gl.deleteBuffer(mesh.buffer);if(this.program)this.gl.deleteProgram(this.program);}
    this.is3D=false;this.gl=null;this.surface=null;
  }
}
