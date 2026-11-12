import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Hud, stackLayers, tierOf, STACK_TIERS, animateResult } from '../dist/hud.js';
import { Controls } from '../dist/controls.js';

const dist = new URL('../dist/', import.meta.url);
const read = name => fs.readFileSync(new URL(name, dist), 'utf8');

test('every script in the site parses as a module', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'doodle-parse-'));
  try {
    for (const name of fs.readdirSync(dist).filter(file => file.endsWith('.js'))) {
      const copy = path.join(temp, name.replace(/\.js$/, '.mjs'));
      fs.writeFileSync(copy, read(name).replace(/(from\s*|import\s*)(['"])\.\/([^'"]+)\2/g, (m, lead, quote, file) => `${lead}${quote}./${file.split('?')[0].replace(/\.js$/, '.mjs')}${quote}`));
      try { execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' }); }
      catch (error) { assert.fail(`${name} does not parse: ${String(error.stderr).split('\n').slice(0, 6).join(' | ')}`); }
    }
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('the page, the modules, and the offline cache all carry one release version', () => {
  const worker = read('sw.js'), cache = worker.match(/const CACHE='doodle-onward-journey-v(\d+)'/);
  assert.ok(cache, 'the cache name carries a version');
  const version = cache[1], html = read('index.html');
  const versions = new Set([...html.matchAll(/\?v=(\d+)/g)].map(match => match[1]));
  assert.deepEqual([...versions], [version], 'index.html uses the cache version');
  for (const match of html.matchAll(/(?:href|src)="\/([^"?#]+)(\?v=\d+)?"/g)) {
    assert.ok(fs.existsSync(new URL(match[1], dist)), `index.html links ${match[1]}`);
    assert.ok(worker.includes(`'/${match[1]}${match[2] || ''}'`), `${match[1]}${match[2] || ''} is precached exactly as the page requests it`);
  }
  for (const entry of worker.matchAll(/'\/([a-z0-9-]+\.(?:js|css))\?v=(\d+)'/g)) {
    assert.equal(entry[2], version, `${entry[1]} is cached at the release version`);
    if (entry[1].endsWith('.js')) for (const used of read(entry[1]).matchAll(/\?v=(\d+)/g)) assert.equal(used[1], version, `${entry[1]} refers to version ${used[1]}`);
  }
  const manifest = JSON.parse(read('manifest.webmanifest'));
  for (const icon of manifest.icons) assert.equal(icon.src.match(/\?v=(\d+)/)?.[1], version);
});

test('the stack meter describes each layer and never invents a multiplier', () => {
  const idle = stackLayers({ multiplier: 1, combo: 0, charge: 40 });
  assert.equal(idle.total, 1); assert.equal(idle.chain.on, false); assert.equal(idle.power.fill, .4); assert.equal(idle.frenzy.fill, 0);
  const building = stackLayers({ multiplier: 2, combo: 9, comboTime: 2.7, totalMultiplier: 2 });
  assert.equal(building.chain.on, true); assert.equal(building.chain.value, 2); assert.equal(building.chain.fill, .5); assert.equal(building.frenzy.fill, .5); assert.equal(building.chain.next, .5);
  const max = stackLayers({ multiplier: 5, combo: 40, comboTime: 5.4, feverTime: 4, goldRushTime: 6, powerTime: 2.4, powerDuration: 4.8, totalMultiplier: 30 }, 'griffin');
  assert.equal(max.total, 30); assert.equal(max.chain.value * max.frenzy.value * max.gold.value * max.power.value, 30);
  assert.ok(max.frenzy.on && max.gold.on && max.power.on); assert.equal(max.power.fill, .5); assert.equal(max.gold.fill, .5);
  const kevin = stackLayers({ multiplier: 5, combo: 40, feverTime: 4, goldRushTime: 6, powerTime: 2, totalMultiplier: 20 }, 'kevin');
  assert.equal(kevin.power.value, 1); assert.equal(kevin.power.counts, false); assert.equal(kevin.total, 20);
  assert.equal(stackLayers({ multiplier: 3, totalMultiplier: 7.5 }).total, 7.5, 'fractional stacks are kept');
  assert.deepEqual(STACK_TIERS, [2, 5, 10, 20, 30]);
  assert.deepEqual([1, 2, 4.5, 5, 9, 10, 19.9, 20, 29, 30].map(tierOf), [0, 2, 2, 5, 5, 10, 10, 20, 20, 30]);
});

function fakeNode() {
  const classes = new Set(), node = {
    textContent: '', hidden: false, innerHTML: '', dataset: {}, style: { values: {}, setProperty(key, value) { this.values[key] = value; } }, attributes: {}, children: [], offsetWidth: 1,
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), toggle: (name, on) => { const value = on === undefined ? !classes.has(name) : on; if (value) classes.add(name); else classes.delete(name); return value; }, contains: name => classes.has(name) },
    setAttribute(key, value) { this.attributes[key] = value; }, querySelector() { return fakeNode(); }, querySelectorAll() { return []; }, animate() {}, get parentElement() { return fakeNode(); }
  };
  return node;
}

test('the HUD rolls the score, lights stack layers, and shows a countdown without rebuilding itself', () => {
  const nodes = {}, hud = new Hud(id => nodes[id] ||= fakeNode());
  hud.begin({ mode: 'snack', region: 'Rogue River', powerName: 'Good-boy zoomies', characterId: 'griffin', maxHearts: 3 });
  assert.equal(nodes['run-timer'].hidden, false); assert.equal(nodes['bonus-stack'].hidden, false); assert.match(nodes['bonus-stack'].innerHTML, /ZOOMIES/);
  const built = nodes['bonus-stack'].innerHTML, run = { score: 1200, hearts: 3, maxHearts: 3, time: 37.2, timeLimit: 45, treats: 14, gold: 1, multiplier: 2, combo: 7, comboTime: 5, totalMultiplier: 2 };
  hud.update(run, .016, {}); assert.notEqual(nodes.score.textContent, '1,200', 'the score climbs instead of jumping');
  for (let i = 0; i < 80; i++) hud.update(run, .016, {});
  assert.equal(nodes.score.textContent, '1,200'); assert.equal(nodes['run-timer'].textContent, '8'); assert.equal(nodes['run-timer'].classList.contains('urgent'), true);
  assert.equal(nodes['bonus-stack'].dataset.tier, 2); assert.equal(nodes['bonus-stack'].innerHTML, built, 'the meter is updated in place');
  run.time = 41.5; hud.update(run, .016, {}); assert.equal(nodes['run-timer'].classList.contains('final'), true);
  hud.update({ ...run, score: 5000 }, .016, { reduced: true }); assert.equal(nodes.score.textContent, '5,000', 'reduced motion shows the number at once');
  hud.begin({ mode: 'memory', region: 'Redwood Run', characterId: 'kevin' });
  assert.equal(nodes['bonus-stack'].hidden, true); assert.equal(nodes['run-timer'].hidden, true);
  hud.update({ score: 10, pairs: 2, totalPairs: 6, mistakes: 1 }, .016, {}); assert.equal(nodes['progress-text'].textContent, '2/6');
});

test('result numbers count up to their exact totals and every medal is stamped once', () => {
  const counters = [{ dataset: { count: '1100' }, textContent: '' }, { dataset: { count: '96' }, textContent: '' }];
  const medals = [0, 1, 2].map(() => { const classes = new Set(); return { classes, classList: { add: name => classes.add(name), remove: name => classes.delete(name) } }; });
  const root = { querySelectorAll: selector => selector === '[data-count]' ? counters : medals };
  let ticks = 0; const stamped = [], step = animateResult(root, { onTick: () => ticks++, onMedal: index => stamped.push(index) });
  assert.equal(counters[0].textContent, '0'); assert.ok(medals.every(medal => medal.classes.has('pending')));
  let frames = 0; while (!step(1 / 60) && frames++ < 600);
  assert.ok(frames < 200); assert.equal(counters[0].textContent, '1,100'); assert.equal(counters[1].textContent, '96');
  assert.deepEqual(stamped, [1, 2, 3]); assert.ok(ticks > 5 && ticks < 30); assert.ok(medals.every(medal => medal.classes.has('stamp') && !medal.classes.has('pending')));
  const still = animateResult({ querySelectorAll: selector => selector === '[data-count]' ? counters : medals }, { reduced: true });
  assert.equal(counters[0].textContent, '1,100'); assert.equal(typeof still, 'function');
});

function fakeField(width = 400, height = 700) {
  const listeners = {};
  return { listeners, addEventListener: (type, handler) => { (listeners[type] ||= []).push(handler); }, getBoundingClientRect: () => ({ left: 0, top: 0, width, height, right: width, bottom: height }), setPointerCapture() {},
    fire(type, event = {}) { for (const handler of listeners[type] || []) handler({ preventDefault() {}, pointerId: 1, clientX: 0, clientY: 0, type, ...event }); } };
}

test('the play field is the controller: thumbs are tracked alone and every gesture reports one clear intent', () => {
  const calls = [], field = fakeField(), road = fakeField(); let clock = 0;
  const log = name => (...args) => calls.push([name, ...args]);
  const controls = new Controls({ canvas: field, rallyCanvas: road, now: () => clock, on: { direction: log('dir'), jump: log('jump'), releaseJump: log('release'), drop: log('drop'), power: log('power'), hint: log('hint'), tap: log('tap'), steer: log('steer'), brake: log('brake'), fieldX: log('field') } });
  const names = () => calls.map(call => call[0]);
  // Nothing happens while the field is inactive (paused, results, camp).
  controls.configure('platform'); field.fire('pointerdown', { pointerId: 1, clientX: 300, clientY: 400 }); assert.deepEqual(calls, []);
  controls.active = true;
  // Platform: left thumb slides to run and reverses without lifting.
  field.fire('pointerdown', { pointerId: 1, clientX: 80, clientY: 500 }); assert.deepEqual(controls.dir, { x: 0, y: 0 }, 'resting a thumb does not move the buddy');
  field.fire('pointermove', { pointerId: 1, clientX: 110, clientY: 500 }); assert.deepEqual(controls.dir, { x: 1, y: 0 });
  field.fire('pointermove', { pointerId: 1, clientX: 180, clientY: 502 }); field.fire('pointermove', { pointerId: 1, clientX: 172, clientY: 502 }); assert.deepEqual(controls.dir, { x: 1, y: 0 }, 'a wobble does not reverse');
  field.fire('pointermove', { pointerId: 1, clientX: 140, clientY: 502 }); assert.deepEqual(controls.dir, { x: -1, y: 0 }, 'a short pull back reverses, however far the thumb has travelled');
  // Right thumb taps to jump while the left keeps running.
  field.fire('pointerdown', { pointerId: 2, clientX: 320, clientY: 480 }); assert.deepEqual(controls.dir, { x: -1, y: 0 }); assert.equal(calls.at(-1)[0], 'jump');
  field.fire('pointerup', { pointerId: 2 }); assert.equal(calls.at(-1)[0], 'release');
  // A quick upward flick of the steering thumb is the power; a pull down is a drop.
  clock = 1000; field.fire('pointermove', { pointerId: 1, clientX: 140, clientY: 502 }); clock = 1080; field.fire('pointermove', { pointerId: 1, clientX: 142, clientY: 440 });
  assert.equal(names().filter(name => name === 'power').length, 1);
  field.fire('pointermove', { pointerId: 1, clientX: 142, clientY: 380 }); assert.equal(names().filter(name => name === 'power').length, 1, 'one flick is one power');
  field.fire('pointermove', { pointerId: 1, clientX: 142, clientY: 560 }); assert.equal(names().filter(name => name === 'drop').length, 1);
  field.fire('pointerup', { pointerId: 1 }); assert.deepEqual(controls.dir, { x: 0, y: 0 });
  assert.deepEqual(controls.used, { move: true, action: true, power: true });
  // Two thumbs on the right: the jump is released only when the last one lifts.
  calls.length = 0; field.fire('pointerdown', { pointerId: 3, clientX: 300, clientY: 300 }); field.fire('pointerdown', { pointerId: 4, clientX: 340, clientY: 300 }); field.fire('pointerup', { pointerId: 3 });
  assert.deepEqual(names(), ['jump', 'jump']); field.fire('pointerup', { pointerId: 4 }); assert.equal(calls.at(-1)[0], 'release');

  // Trail Scout: drag to walk, tap a tile, hold for a hint, two fingers for power.
  controls.configure('scout'); controls.active = true; calls.length = 0; clock = 5000;
  field.fire('pointerdown', { pointerId: 1, clientX: 200, clientY: 300 }); field.fire('pointermove', { pointerId: 1, clientX: 204, clientY: 332 }); assert.deepEqual(controls.dir, { x: 0, y: 1 });
  field.fire('pointermove', { pointerId: 1, clientX: 240, clientY: 336 }); assert.deepEqual(controls.dir, { x: 1, y: 0 }, 'turning mid-drag changes direction');
  field.fire('pointerup', { pointerId: 1 }); assert.deepEqual(controls.dir, { x: 0, y: 0 }); assert.ok(!names().includes('tap'), 'a drag is not also a tap');
  field.fire('pointerdown', { pointerId: 2, clientX: 90, clientY: 120 }); field.fire('pointerup', { pointerId: 2, clientX: 91, clientY: 120 }); assert.deepEqual(calls.at(-1), ['tap', 90, 120]);
  calls.length = 0; field.fire('pointerdown', { pointerId: 3, clientX: 90, clientY: 120 }); clock += 300; controls.update(.3); assert.deepEqual(calls, []); clock += 300; controls.update(.3); controls.update(.3);
  assert.deepEqual(names(), ['hint'], 'holding still asks for one hint'); field.fire('pointerup', { pointerId: 3 }); assert.deepEqual(names(), ['hint'], 'and the release is not a tap');
  calls.length = 0; field.fire('pointerdown', { pointerId: 4, clientX: 90, clientY: 120 }); field.fire('pointerdown', { pointerId: 5, clientX: 190, clientY: 120 }); field.fire('pointerup', { pointerId: 4 }); field.fire('pointerup', { pointerId: 5 });
  assert.deepEqual(names().filter(name => name !== 'dir'), ['power']);

  // RV Rally: drag steers, pulling back brakes, a second finger brakes, a flick boosts.
  controls.configure('rally'); controls.active = true; calls.length = 0; clock = 9000;
  road.fire('pointerdown', { pointerId: 1, clientX: 200, clientY: 400 }); road.fire('pointermove', { pointerId: 1, clientX: 240, clientY: 400 }); assert.equal(controls.steering, .5);
  road.fire('pointermove', { pointerId: 1, clientX: 900, clientY: 400 }); assert.equal(controls.steering, 1);
  road.fire('pointermove', { pointerId: 1, clientX: 240, clientY: 460 }); assert.equal(controls.braking, true); road.fire('pointermove', { pointerId: 1, clientX: 240, clientY: 405 }); assert.equal(controls.braking, false);
  road.fire('pointerdown', { pointerId: 2, clientX: 60, clientY: 500 }); assert.equal(controls.braking, true); road.fire('pointerup', { pointerId: 2 }); assert.equal(controls.braking, false);
  clock = 9500; road.fire('pointermove', { pointerId: 1, clientX: 240, clientY: 405 }); clock = 9560; road.fire('pointermove', { pointerId: 1, clientX: 242, clientY: 340 }); assert.ok(names().includes('power'));
  road.fire('pointerup', { pointerId: 1 }); assert.equal(controls.steering, null);

  // Snack Storm: the buddy follows the finger; a flick is the power.
  controls.configure('snack'); controls.active = true; calls.length = 0;
  field.fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 600 }); field.fire('pointermove', { pointerId: 1, clientX: 300, clientY: 600 });
  assert.deepEqual(calls.filter(call => call[0] === 'field').map(call => call[1]), [.25, .75]);
  // Clearing releases every finger, and drawing the touch echo is balanced.
  assert.equal(controls.busy, true); let depth = 0;
  controls.draw({ save() { depth++; }, restore() { depth--; }, beginPath() {}, arc() {}, stroke() {}, fill() {}, moveTo() {}, lineTo() {} });
  assert.equal(depth, 0); controls.clear(); assert.equal(controls.busy, false); assert.deepEqual(controls.dir, { x: 0, y: 0 });
});
