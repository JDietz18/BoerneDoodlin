const CACHE='doodle-onward-journey-v26';
const OWNED_PREFIXES=['doodle-onward-','boerne-doodlin-','griffin-snack-patrol-'];
const CORE=[
  '/','/index.html','/style.css?v=26','/minigames.css?v=26','/manifest.webmanifest',
  '/game.js?v=26','/platform-engine.js?v=26','/world-levels.js?v=26',
  '/scout-engine.js?v=26','/journey.js?v=26','/platform-renderer.js?v=26',
  '/rally3d.js?v=26','/memory-game.js?v=26','/snack-engine.js?v=26',
  '/renderer.js?v=26','/adventure-engine.js?v=26','/characters.js?v=26',
  '/audio.js?v=26','/celebrations.js?v=26','/fx.js?v=26','/scout-view.js?v=26',
  '/hud.js?v=26','/controls.js?v=26','/haptics.js?v=26','/compat.js?v=26','/play.css?v=26','/camp.css?v=26',
  '/assets/griffin-character-atlas.png?v=26','/assets/pumpkin-atlas.png?v=26',
  '/assets/mittens-atlas.png?v=26','/assets/spike-atlas.png?v=26',
  '/assets/family-rv.png','/assets/route-biomes.jpg',
  '/assets/griffin-atlas.png', // Existing snack/obstacle props only.
  '/assets/bookman-bold.otf','/assets/griffin-icon.png?v=26',
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
