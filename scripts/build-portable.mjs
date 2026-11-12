#!/usr/bin/env node
// Builds a copy of the game that runs from ANY folder, not only the site root.
//
// dist/ is the production site and deliberately uses root paths ("/game.js",
// manifest scope "/") because that is the identity of the published game.
// Hosts that serve from a subfolder (a GitHub Pages project site, a preview
// sandbox, a folder on a file server) need relative paths instead. This script
// copies the active offline bundle and rewrites only those paths.
//
//   node scripts/build-portable.mjs [outDir] [--no-sw] [--lean]
//
//   --no-sw     leave out the service worker and manifest (for sandboxed previews)
//   --lean      skip files that only the retired campaign used
//   --fragment  write index.html as a body fragment with plain file names, for
//               preview hosts that supply their own page shell (implies --no-sw)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

// The service worker's precache list is the single source of truth for what
// the game needs, so read it rather than keeping a second list here.
export function bundleFiles() {
  let core = [];
  const self = { location: { origin: 'https://example.invalid', href: 'https://example.invalid/sw.js' }, addEventListener() {} };
  const context = { self, URL, caches: {}, Response: class {}, Request: class {}, fetch() {} };
  vm.runInNewContext(`${fs.readFileSync(path.join(dist, 'sw.js'), 'utf8')}\nself.__core = CORE;`, context);
  core = [...self.__core];
  return [...new Set(core.map(entry => entry.split('?')[0]).filter(entry => entry !== '/').map(entry => entry.replace(/^\//, '')))];
}

const LEGACY_ONLY = new Set(['assets/kevin-photo.jpg', 'assets/mittens-photo.jpg']);

export function rewrite(file, text, { serviceWorker = true } = {}) {
  if (file.endsWith('.html')) return text.replace(/\b(href|src)="\/(?!\/)/g, '$1="');
  if (file.endsWith('.css')) return text.replace(/url\(\s*(['"]?)\/(?!\/)/g, 'url($1');
  if (file.endsWith('.webmanifest')) {
    const manifest = JSON.parse(text);
    manifest.id = './'; manifest.scope = './'; manifest.start_url = './?source=homescreen';
    for (const icon of manifest.icons || []) icon.src = icon.src.replace(/^\//, '');
    return `${JSON.stringify(manifest, null, 2)}\n`;
  }
  if (file === 'sw.js') {
    return text
      .replace("(url.pathname==='/'||url.pathname==='/index.html')", "[SCOPE,SCOPE+'index.html'].includes(url.pathname)")
      .replace("new URL(path,self.location.origin)", "new URL(path,self.location.href)")
      .replace("const CACHE=", "const SCOPE=new URL('./',self.location.href).pathname;\nconst CACHE=")
      // '/' becomes './' and '/file' becomes 'file', both relative to the worker.
      .replace(/'\/'/g, "'./'").replace(/'\/(?=[a-z])/g, "'");
  }
  if (file.endsWith('.js')) {
    let out = text
      .replace(/(['"`])\/assets\//g, '$1assets/')
      .replaceAll("location.origin+'/'", "new URL('./',location.href).href");
    out = serviceWorker
      ? out.replace("navigator.serviceWorker.register('/sw.js'", "navigator.serviceWorker.register('sw.js'")
      : out.replace("if('serviceWorker' in navigator&&", "if(false&&'serviceWorker' in navigator&&");
    return out;
  }
  return text;
}

// Preview hosts that wrap the page themselves want only the title, styles,
// script, and body content, and serve files by plain name.
export function fragment(html) {
  const title = '<title>Doodle Onward</title>';
  const links = [...html.matchAll(/<link rel="stylesheet"[^>]*>/g)].map(match => match[0]).join('\n');
  const script = html.match(/<script type="module"[^>]*><\/script>/)?.[0] || '';
  const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
  return `${title}\n${links}\n<style>html,body{background:#f6efdf;color:#183d37}</style>\n${script}\n${body.trim()}\n`;
}
const unversion = text => text.replace(/\?v=\d+/g, '');

export function build(outDir, { serviceWorker = true, lean = false, asFragment = false } = {}) {
  if (asFragment) serviceWorker = false;
  const files = bundleFiles().filter(file => !(lean && LEGACY_ONLY.has(file)));
  if (serviceWorker) files.push('sw.js');
  else files.splice(files.indexOf('manifest.webmanifest'), 1);
  fs.rmSync(outDir, { recursive: true, force: true });
  for (const file of files) {
    const from = path.join(dist, file), to = path.join(outDir, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (/\.(html|css|js|webmanifest)$/.test(file)) {
      let text = rewrite(file, fs.readFileSync(from, 'utf8'), { serviceWorker });
      if (file === 'index.html' && !serviceWorker) text = text.replace(/<link rel="manifest"[^>]*>/, '');
      if (asFragment) text = unversion(file === 'index.html' ? fragment(text) : text);
      if (file === 'sw.js' && lean) for (const legacy of LEGACY_ONLY) text = text.replace(new RegExp(`,?\\s*'${legacy.replace('.', '\\.')}'`), '');
      fs.writeFileSync(to, text);
    } else fs.copyFileSync(from, to);
  }
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), outDir = path.resolve(args.find(arg => !arg.startsWith('--')) || path.join(root, 'build', 'portable'));
  const files = build(outDir, { serviceWorker: !args.includes('--no-sw'), lean: args.includes('--lean'), asFragment: args.includes('--fragment') });
  console.log(`Portable build: ${files.length} files in ${outDir}`);
}
