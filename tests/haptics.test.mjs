import test from 'node:test';
import assert from 'node:assert/strict';
import { Haptics } from '../dist/haptics.js';

test('vibration devices get bounded patterns, throttled repeats, and silence when disabled', () => {
  const calls = []; let clock = 0;
  const haptics = new Haptics({ navigatorRef: { vibrate: pattern => { calls.push(pattern); return true; } }, documentRef: null, now: () => clock });
  assert.equal(haptics.supported, true);
  assert.equal(haptics.pulse('stomp'), true);
  assert.equal(haptics.pulse('stomp'), false, 'an immediate repeat is dropped');
  clock += 100; assert.equal(haptics.pulse('unknown'), true);
  assert.deepEqual(calls, [[22], [8]]);
  for (const pattern of calls) assert.ok(pattern.reduce((a, b) => a + b, 0) < 400);
  haptics.setEnabled(false); clock += 100;
  assert.equal(haptics.pulse('hit'), false);
  assert.deepEqual(calls.at(-1), 0, 'disabling cancels any running vibration');
});

test('the iPhone switch fallback ticks once per beat and is hidden from assistive tech', () => {
  let clicks = 0, clock = 0; const appended = [];
  const element = tag => ({ tag, style: {}, attributes: {}, children: [], setAttribute(k, v) { this.attributes[k] = v; }, appendChild(child) { this.children.push(child); }, click() { clicks++; }, ...(tag === 'input' ? { switch: false } : {}) });
  const documentRef = { createElement: element, body: { appendChild: node => appended.push(node) } };
  const haptics = new Haptics({ navigatorRef: {}, documentRef, now: () => clock });
  assert.equal(haptics.canVibrate, false); assert.equal(haptics.supported, true);
  assert.equal(haptics.pulse('tap'), true);
  assert.equal(clicks, 1); assert.equal(appended.length, 1);
  assert.equal(appended[0].attributes['aria-hidden'], 'true');
  assert.equal(appended[0].children[0].tabIndex, -1);
  clock += 200; haptics.pulse('tap');
  assert.equal(appended.length, 1, 'the hidden switch is created once');
  haptics.cancel();
});

test('unsupported and failing devices stay quiet without throwing', () => {
  const none = new Haptics({ navigatorRef: {}, documentRef: { createElement: () => ({}) } });
  assert.equal(none.supported, false); assert.equal(none.pulse('hit'), false);
  const broken = new Haptics({ navigatorRef: { vibrate() { throw new Error('blocked'); } }, documentRef: null, now: () => 1000 });
  assert.equal(broken.pulse('hit'), false); broken.cancel();
  const noDom = new Haptics({ navigatorRef: undefined, documentRef: undefined });
  assert.equal(noDom.pulse('tap'), false);
});
