import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { build, bundleFiles, rewrite } from '../scripts/build-portable.mjs';

const dist = new URL('../dist/', import.meta.url);
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'doodle-portable-'));
const read = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8');

test('the portable build has no root paths left and every reference resolves inside it', () => {
  const out = temp();
  try {
    const files = build(out);
    assert.ok(files.includes('index.html') && files.includes('game.js') && files.includes('sw.js') && files.includes('assets/griffin-character-atlas.png'));
    for (const file of files.filter(name => /\.(html|css|js)$/.test(name))) {
      const text = read(out, file);
      assert.doesNotMatch(text, /(?:href|src)="\/(?!\/)/, `${file} keeps a root link`);
      assert.doesNotMatch(text, /url\(\s*['"]?\/(?!\/)/, `${file} keeps a root url()`);
      assert.doesNotMatch(text, /['"`]\/(?:assets\/|sw\.js|index\.html|[a-z-]+\.(?:js|css|webmanifest))/, `${file} keeps a root path string`);
    }
    const exists = reference => { const clean = reference.split(/[?#]/)[0]; return clean === '' || clean === './' || fs.existsSync(path.join(out, clean)); };
    for (const match of read(out, 'index.html').matchAll(/(?:href|src)="([^"#][^"]*)"/g)) assert.ok(exists(match[1]), `index.html -> ${match[1]}`);
    for (const file of files.filter(name => name.endsWith('.css'))) for (const match of read(out, file).matchAll(/url\(\s*['"]?([^'")\s]+)/g)) if (!match[1].startsWith('data:')) assert.ok(exists(match[1]), `${file} -> ${match[1]}`);
    for (const file of files.filter(name => name.endsWith('.js') && name !== 'sw.js')) for (const match of read(out, file).matchAll(/from\s*['"]\.\/([^'"]+)['"]|import\s*['"]\.\/([^'"]+)['"]/g)) assert.ok(exists(match[1] || match[2]), `${file} imports ${match[1] || match[2]}`);
    const manifest = JSON.parse(read(out, 'manifest.webmanifest'));
    assert.equal(manifest.scope, './'); assert.equal(manifest.start_url, './?source=homescreen'); assert.ok(manifest.icons.every(icon => exists(icon.src)));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('the portable worker precaches the same bundle relative to its own folder', async () => {
  const out = temp();
  try {
    build(out);
    const base = 'https://example.test/family/doodle/', installed = [];
    const self = { location: { origin: 'https://example.test', href: `${base}sw.js` }, addEventListener: (type, handler) => { self[type] = handler; }, skipWaiting: async () => {}, clients: { claim: async () => {} } };
    const stored = new Map();
    const caches = { open: async () => ({ addAll: async paths => { installed.push(...paths); for (const p of paths) stored.set(new URL(p, base).href, `cached:${p}`); }, match: async request => { const hit = stored.get(new URL(typeof request === 'string' ? request : request.url, base).href); return hit ? new Response(hit) : undefined; }, put: async () => {} }), keys: async () => [], delete: async () => true };
    vm.runInNewContext(read(out, 'sw.js'), { self, caches, URL, Response, fetch: async () => { throw new Error('offline'); } });
    const waits = []; self.install({ waitUntil: promise => waits.push(promise) }); await Promise.all(waits);
    assert.deepEqual([...installed].sort(), [...new Set(['./', ...bundleFiles().map((file, i) => installed.find(entry => entry.split('?')[0] === file) || file)])].sort());
    for (const entry of installed) assert.ok(!entry.startsWith('/'), `${entry} is relative`);
    const ask = (url, mode = 'cors') => { let answer; self.fetch({ request: { url, mode, method: 'GET' }, respondWith: promise => { answer = promise; } }); return answer; };
    assert.equal(await (await ask(`${base}?source=homescreen`, 'navigate')).text(), 'cached:index.html', 'the folder itself opens offline');
    assert.equal(await (await ask(`${base}${installed.find(entry => entry.startsWith('game.js'))}`)).text().then(text => text.startsWith('cached:game.js')), true);
    assert.equal(ask('https://example.test/', 'navigate'), undefined, 'the site root above the folder is left alone');
    assert.equal(ask('https://example.test/family/other/app.js'), undefined);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});

test('a sandbox preview build drops the worker and manifest, and the production site is untouched', () => {
  const before = fs.readFileSync(new URL('index.html', dist), 'utf8') + fs.readFileSync(new URL('sw.js', dist), 'utf8') + fs.readFileSync(new URL('manifest.webmanifest', dist), 'utf8');
  const out = temp();
  try {
    const files = build(out, { serviceWorker: false, lean: true });
    assert.ok(!files.includes('sw.js') && !files.includes('manifest.webmanifest') && !files.includes('assets/kevin-photo.jpg'));
    assert.doesNotMatch(read(out, 'index.html'), /rel="manifest"/);
    assert.match(read(out, 'game.js'), /if\(false&&'serviceWorker' in navigator/);
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
  const after = fs.readFileSync(new URL('index.html', dist), 'utf8') + fs.readFileSync(new URL('sw.js', dist), 'utf8') + fs.readFileSync(new URL('manifest.webmanifest', dist), 'utf8');
  assert.equal(after, before);
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.webmanifest', dist), 'utf8'));
  assert.equal(manifest.id, '/'); assert.equal(manifest.scope, '/');
  assert.equal(rewrite('x.css', "src:url('/assets/a.otf')"), "src:url('assets/a.otf')");
  assert.equal(rewrite('x.js', "load('/assets/a.png');share(location.origin+'/')"), "load('assets/a.png');share(new URL('./',location.href).href)");
});
