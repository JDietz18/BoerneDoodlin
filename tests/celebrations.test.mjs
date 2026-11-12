import test from 'node:test';
import assert from 'node:assert/strict';
import { Celebrations } from '../dist/celebrations.js';

function drawingContext() {
  const commands = [], saved = [];
  const keys = ['globalAlpha', 'globalCompositeOperation', 'lineJoin', 'strokeStyle',
    'fillStyle', 'lineWidth', 'shadowBlur', 'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'filter'];
  const ctx = {
    commands, globalAlpha: .4, fillStyle: '#123456', strokeStyle: '#ABCDEF', shadowBlur: 4,
    save() { saved.push(Object.fromEntries(keys.map(key => [key, this[key]]))); },
    restore() { assert.ok(saved.length, 'unbalanced canvas restore'); Object.assign(this, saved.pop()); },
    translate(x, y) { assert.ok(Number.isFinite(x) && Number.isFinite(y)); commands.push(['position', x, y]); },
    rotate(angle) { assert.ok(Number.isFinite(angle)); commands.push(['rotation', angle]); },
    fill() { assert.ok(this.globalAlpha >= 0 && this.globalAlpha <= 1); commands.push(['fill', this.globalAlpha, this.fillStyle]); },
    stroke() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, ellipse() {},
    fillRect() { this.fill(); }, strokeRect() {}, setLineDash() {},
    clearRect() { throw new Error('The celebration layer must not clear its caller’s canvas'); },
    setTransform() { throw new Error('The celebration layer must preserve the caller’s DPR transform'); }
  };
  return ctx;
}

test('rapid celebrations stay bounded and all effects expire or clear', () => {
  const effects = new Celebrations({ random: () => .5 });
  for (let i = 0; i < 50; i++) {
    effects.burst({ kind: ['win', 'star', 'power', 'combo', 'record', 'stack'][i % 6] });
    assert.ok(effects.particles.length > 0 && effects.particles.length <= 120);
  }
  effects.update(.8); effects.update(.8); effects.update(.8); effects.update(.8);
  assert.equal(effects.particles.length, 0);
  effects.burst({ kind: 'record' }); effects.update(20);
  assert.equal(effects.particles.length, 0, 'backgrounded frames must not replay a stale celebration');
  effects.burst(); effects.clear(); effects.clear();
  assert.equal(effects.particles.length, 0);
});

test('reduced motion uses a small stationary cluster instead of flying or spinning pieces', () => {
  const effects = new Celebrations({ random: () => .5 });
  effects.burst({ x: .3, y: .4, kind: 'win' });
  const first = drawingContext(); effects.draw(first, 400, 700, { reducedMotion: true });
  effects.update(.2);
  const second = drawingContext(); effects.draw(second, 400, 700, { reducedMotion: true });
  const positions = ctx => ctx.commands.filter(command => command[0] === 'position');
  assert.deepEqual(positions(first), positions(second));
  assert.ok(positions(first).length > 0 && positions(first).length <= 5);
  assert.ok(second.commands.filter(command => command[0] === 'rotation').every(command => command[1] === 0));
  effects.update(.7);
  const finished = drawingContext(); effects.draw(finished, 400, 700, { reducedMotion: true });
  assert.equal(positions(finished).length, 0, 'the reduced-motion mark should be brief');
});

test('the power accent uses the normalized origin and drawing preserves caller state', () => {
  const effects = new Celebrations({ random: () => .5 });
  effects.burst({ x: .25, y: .6, kind: 'power', color: '#ABC123' });
  const ctx = drawingContext();
  effects.draw(ctx, 1000, 500);
  assert.deepEqual(ctx.commands.find(command => command[0] === 'position'), ['position', 250, 300]);
  assert.equal(ctx.globalAlpha, .4);
  assert.equal(ctx.fillStyle, '#123456');
  assert.equal(ctx.strokeStyle, '#ABCDEF');
  assert.equal(ctx.shadowBlur, 4);
  assert.ok(ctx.commands.filter(command => command[0] === 'fill').every(command => command[2] === '#ABC123'));
});

test('bad random values and invalid frame inputs cannot generate non-finite drawing', () => {
  const effects = new Celebrations({ random: () => NaN });
  effects.burst({ x: Infinity, y: -50, kind: 'stack', color: 'transparent' });
  effects.update(NaN); effects.update(-1);
  const ctx = drawingContext(); effects.draw(ctx, 390, 750);
  assert.ok(ctx.commands.some(command => command[0] === 'fill'));
  assert.ok(ctx.commands.filter(command => command[0] === 'fill').every(command => /^#[A-F\d]{6}$/i.test(command[2])));
  const count = ctx.commands.length;
  effects.draw(ctx, 0, 750); effects.draw(ctx, Infinity, 750);
  assert.equal(ctx.commands.length, count);
});
