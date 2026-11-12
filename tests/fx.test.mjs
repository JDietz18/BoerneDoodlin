import test from 'node:test';
import assert from 'node:assert/strict';
import { Juice, hash01, ease } from '../dist/fx.js';

function drawingContext() {
  const saved = [], calls = [];
  const keys = ['globalAlpha', 'fillStyle', 'strokeStyle', 'lineWidth', 'font', 'textAlign', 'textBaseline', 'lineJoin', 'lineCap'];
  const number = (...values) => values.forEach(value => assert.ok(Number.isFinite(value), `non-finite drawing value ${value}`));
  const ctx = {
    calls, globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic',
    save() { saved.push(Object.fromEntries(keys.map(key => [key, this[key]]))); },
    restore() { assert.ok(saved.length, 'unbalanced restore'); Object.assign(this, saved.pop()); },
    translate(x, y) { number(x, y); }, rotate(a) { number(a); }, scale(x, y) { number(x, y); },
    beginPath() {}, closePath() {}, moveTo(x, y) { number(x, y); }, lineTo(x, y) { number(x, y); },
    bezierCurveTo(...v) { number(...v); }, arc(x, y, r) { number(x, y, r); assert.ok(r >= 0); },
    ellipse(x, y, rx, ry, rot) { number(x, y, rx, ry, rot); assert.ok(rx >= 0 && ry >= 0); },
    fill() { assert.ok(this.globalAlpha >= 0 && this.globalAlpha <= 1); calls.push('fill'); },
    stroke() { assert.ok(this.globalAlpha >= 0 && this.globalAlpha <= 1); calls.push('stroke'); },
    fillRect(x, y, w, h) { number(x, y, w, h); calls.push('rect'); },
    fillText(text, x, y) { number(x, y); calls.push(['text', text]); }, strokeText(text, x, y) { number(x, y); },
    clearRect() { throw new Error('effects must not clear the caller’s canvas'); },
    setTransform() { throw new Error('effects must keep the caller’s transform'); },
    get depth() { return saved.length; }
  };
  return ctx;
}

test('bursts, rings, popups and fliers stay bounded and all expire', () => {
  const fx = new Juice({ random: () => .5 });
  for (let i = 0; i < 80; i++) {
    for (const kind of ['dust', 'land', 'spark', 'star', 'gold', 'stomp', 'hit', 'splash', 'debris', 'leaf', 'confetti', 'heart', 'poof', 'power', 'bubble', 'crumb', 'unknown-kind'])
      fx.burst(kind, 100 + i, 200);
    fx.ring(10, 10); fx.popup(`+${i}`, 50, 50);
    fx.fly({ x: 0, y: 0, target: () => ({ x: 50, y: 50 }), draw() {} });
    assert.ok(fx.particles.length <= 260 && fx.popups.length <= 26 && fx.rings.length <= 14 && fx.fliers.length <= 40);
  }
  assert.ok(fx.busy);
  const ctx = drawingContext();
  fx.draw(ctx); fx.drawOverlay(ctx, 300, 200);
  assert.equal(ctx.depth, 0, 'drawing restores every saved state');
  assert.ok(ctx.calls.length > 50);
  for (let i = 0; i < 200; i++) fx.update(.05);
  assert.equal(fx.particles.length + fx.popups.length + fx.rings.length + fx.fliers.length, 0);
  assert.equal(fx.busy, false);
});

test('hit-stop freezes simulation time, slow motion scales it, and both run out', () => {
  const fx = new Juice();
  assert.equal(fx.step(.016), .016);
  fx.hitStop(.05);
  assert.equal(fx.step(.016), 0); assert.equal(fx.frozen, true);
  assert.equal(fx.step(.016), 0);
  assert.ok(Math.abs(fx.step(.03) - .012) < 1e-9, 'the remainder of a frame after the freeze still advances');
  assert.equal(fx.frozen, false);
  fx.slowMo(.5, .1);
  assert.ok(Math.abs(fx.step(.05) - .025) < 1e-9);
  assert.ok(Math.abs(fx.step(.05) - .025) < 1e-9);
  assert.equal(fx.step(.05), .05, 'normal speed returns after the slow window');
  fx.hitStop(99); for (let i = 0; i < 20; i++) fx.step(.016);
  assert.equal(fx.frozen, false, 'a freeze is capped so the game can never lock up');
  assert.equal(fx.step(NaN), 0); assert.equal(fx.step(-1), 0); assert.equal(fx.step(5), .1);
});

test('shake decays to rest and stays within a small bound', () => {
  const fx = new Juice();
  fx.shake(5); fx.kick(500, -500); fx.zoomPunch(9);
  for (let i = 0; i < 30; i++) {
    fx.update(.016); const o = fx.offset;
    assert.ok(Math.abs(o.x) < 60 && Math.abs(o.y) < 60 && Math.abs(o.rot) < .05 && o.zoom > .85 && o.zoom < 1.15);
  }
  for (let i = 0; i < 200; i++) fx.update(.016);
  assert.deepEqual(fx.offset, { x: 0, y: 0, rot: 0, zoom: 1 });
});

test('reduced motion removes shake, freezes, flight, bursts and flashes', () => {
  const fx = new Juice({ random: () => .5 }); fx.reducedMotion = true;
  fx.shake(1); fx.kick(20, 20); fx.zoomPunch(.1); fx.hitStop(.1); fx.slowMo(.2, 1);
  assert.deepEqual(fx.offset, { x: 0, y: 0, rot: 0, zoom: 1 });
  assert.equal(fx.step(.016), .016);
  assert.equal(fx.burst('confetti', 10, 10), 0);
  assert.equal(fx.burst('gold', 10, 10), 0); assert.equal(fx.particles.length, 0);
  let arrived = 0; fx.fly({ x: 0, y: 0, target: () => ({ x: 9, y: 9 }), draw() {}, onArrive: () => arrived++ });
  assert.equal(arrived, 1); assert.equal(fx.fliers.length, 0);
  const popup = fx.popup('+10', 5, 5); assert.equal(popup.rise, 0);
  // No full-screen flashes at all.
  let painted = 0; fx.flash('#ffffff', .8, .5); fx.drawOverlay({ save() {}, restore() {}, fillRect() { painted++; } }, 100, 100); assert.equal(painted, 0);
});

test('bad inputs and bad random values never create non-finite state', () => {
  const values = [NaN, Infinity, -1, 2, undefined]; let n = 0;
  const fx = new Juice({ random: () => values[n++ % values.length] });
  fx.burst('gold', NaN, 5); fx.burst('gold', 5, Infinity); fx.ring(NaN, 1); fx.popup('x', NaN, 2); fx.popup('', 1, 2);
  fx.emit({ x: NaN, y: 1 }); fx.emit(null); fx.fly({ x: 1, y: 1, target: null, draw() {} });
  assert.equal(fx.particles.length + fx.rings.length + fx.popups.length + fx.fliers.length, 0);
  fx.burst('star', 10, 10, { count: 9999, speed: NaN }); fx.emit({ x: 1, y: 1, vx: NaN, size: Infinity, life: -4 });
  fx.fly({ x: 1, y: 1, target: () => null, draw() {} }); fx.fly({ x: 1, y: 1, target: () => ({ x: NaN }), draw() {} });
  assert.ok(fx.particles.length <= 81);
  const ctx = drawingContext();
  for (let i = 0; i < 40; i++) { fx.update(i % 2 ? NaN : .03); fx.draw(ctx); }
  for (const p of fx.particles) for (const key of ['x', 'y', 'vx', 'vy', 'size', 'life']) assert.ok(Number.isFinite(p[key]));
});

test('scenery hashing is stable and easing stays in range', () => {
  assert.equal(hash01(12, 7), hash01(12, 7));
  assert.notEqual(hash01(12, 7), hash01(13, 7));
  for (let i = 0; i < 500; i++) { const v = hash01(i, i * 3); assert.ok(v >= 0 && v < 1); }
  for (const fn of Object.values(ease)) { assert.ok(Math.abs(fn(0)) < 1e-9); assert.ok(Math.abs(fn(1) - 1) < 1e-9); }
});

test('labels lift clear of fresh neighbours, following or not, and never draw above the ceiling', () => {
  const fx = new Juice({ random: () => .5 }), buddy = { x: 100, y: 200 };
  const first = fx.popup('10× STACK', 0, -70, { size: 20, follow: () => buddy });
  const second = fx.popup('+160', 100, 130, { size: 16 });            // in the world, at the same spot on screen
  const third = fx.popup('GOLD RUSH ×2', 0, -70, { size: 18, follow: () => buddy });
  const at = p => ({ x: (p.follow ? p.follow().x : 0) + p.x, y: (p.follow ? p.follow().y : 0) + p.y - p.lift });
  const apart = (a, b) => Math.abs(at(a).y - at(b).y) >= (a.size + b.size) * .55 || Math.abs(at(a).x - at(b).x) >= (a.text.length * a.size + b.text.length * b.size) * .3;
  assert.ok(apart(first, second) && apart(first, third) && apart(second, third), 'no two fresh labels share a spot');
  assert.ok(at(second).y < at(first).y, 'the newer label goes above when there is room');
  const far = fx.popup('+10', 600, 130, { size: 16 }); assert.equal(far.y, 130, 'a label with room is left where it was asked for');
  // A view can say where its HUD ends. Right under it, new labels stack downward instead of piling up.
  const low = new Juice({ random: () => .5 }); low.ceiling = 100;
  const pile = ['5× STACK', 'GOLD RUSH ×2', 'SNACK FRENZY ×2', '+160'].map(text => low.popup(text, 200, 110, { size: 16 }));
  for (let i = 0; i < pile.length; i++) for (let k = i + 1; k < pile.length; k++) assert.ok(Math.abs(pile[i].y - pile[k].y) >= 16 * 1.1, `${pile[i].text} and ${pile[k].text} are apart`);
  assert.ok(pile.every(p => p.y - p.size >= 100 || p === pile[0]), 'none of them was pushed above the ceiling');
  fx.ceiling = 150; const drawn = [];
  fx.draw({ save() {}, restore() {}, strokeText() {}, fillText(text, x, y) { drawn.push([text, y]); }, beginPath() {}, arc() {}, fill() {}, stroke() {}, drawImage() {}, translate() {}, rotate() {}, scale() {}, fillRect() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {}, setTransform() {} });
  assert.equal(drawn.length, 4); assert.ok(drawn.every(([, y]) => y >= 150), 'nothing is drawn under the band');
});
