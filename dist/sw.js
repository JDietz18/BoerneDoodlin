const CACHE='doodle-onward-journey-v22';
const OWNED_PREFIXES=['doodle-onward-','boerne-doodlin-','griffin-snack-patrol-'];
const CORE=[
  '/','/index.html','/style.css?v=22','/minigames.css?v=22','/manifest.webmanifest',
  '/game.js?v=22','/platform-engine.js?v=22','/world-levels.js?v=22',
  '/scout-engine.js?v=22','/journey.js?v=22','/platform-renderer.js?v=22',
  '/rally3d.js?v=22','/memory-game.js?v=22','/snack-engine.js?v=22',
  '/renderer.js?v=22','/adventure-engine.js?v=22','/characters.js?v=22',
  '/audio.js?v=22','/celebrations.js?v=22','/fx.js?v=22','/scout-view.js?v=22',
  '/hud.js?v=22','/controls.js?v=22','/haptics.js?v=22','/compat.js?v=22','/play.css?v=22','/camp.css?v=22',
  '/assets/griffin-character-atlas.png?v=22','/assets/kevin-atlas.png?v=22',
  '/assets/mittens-atlas.png?v=22','/assets/spike-atlas.png?v=22',
  '/assets/family-rv.png','/assets/route-biomes.jpg',
  '/assets/griffin-atlas.png', // Existing snack/obstacle props only.
  '/assets/bookman-bold.otf','/assets/griffin-icon.png?v=22',
  '/assets/mittens-photo.jpg','/assets/kevin-photo.jpg'
];
const ALLOWED=new Set(CORE.map(path=>new URL(path,self.location.origin).href));

self.addEventListener('install',event=>{
  // A failed asset download leaves the previous complete game active.
  // 'reload' skips the browser's HTTP cache, so an update can never be built from stale files.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE.map(path=>new Request(path,{cache:'reload'})))));
});

self.addEventListener('message',event=>{
  // The page activates an update when no run is in progress. Do not interrupt
  // a playing tab by calling skipWaiting unconditionally during installation.
  if(event.data?.type==='SKIP_WAITING'||event.data==='SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE&&OWNED_PREFIXES.some(prefix=>key.startsWith(prefix))).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function navigation(request) {
  try {
    const response=await fetch(request);
    if(response.ok&&!response.redirected) {
      try {const cache=await caches.open(CACHE);await cache.put('/index.html',response.clone());} catch {}
    }
    return response;
  } catch {
    try {const cache=await caches.open(CACHE);return await cache.match('/index.html')||Response.error();} catch {return Response.error();}
  }
}

async function asset(request) {
  try {const cache=await caches.open(CACHE),cached=await cache.match(request);if(cached)return cached;} catch {}
  const response=await fetch(request);
  if(response.ok&&!response.redirected) {
    try {const cache=await caches.open(CACHE);await cache.put(request,response.clone());} catch {}
  }
  return response;
}

self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin) return;
  if(request.mode==='navigate'&&(url.pathname==='/'||url.pathname==='/index.html')) {
    event.respondWith(navigation(request));
  } else if(ALLOWED.has(url.href)) {
    event.respondWith(asset(request));
  }
});
