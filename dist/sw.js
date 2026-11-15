const CACHE='doodle-onward-journey-v27';
const OWNED_PREFIXES=['doodle-onward-','boerne-doodlin-','griffin-snack-patrol-'];
const CORE=[
  '/','/index.html','/style.css?v=27','/minigames.css?v=27','/manifest.webmanifest',
  '/game.js?v=27','/platform-engine.js?v=27','/world-levels.js?v=27',
  '/scout-engine.js?v=27','/journey.js?v=27','/platform-renderer.js?v=27',
  '/rally3d.js?v=27','/memory-game.js?v=27','/snack-engine.js?v=27','/bubble-engine.js?v=27','/bubble-view.js?v=27',
  '/renderer.js?v=27','/adventure-engine.js?v=27','/characters.js?v=27',
  '/audio.js?v=27','/celebrations.js?v=27','/fx.js?v=27','/scout-view.js?v=27',
  '/hud.js?v=27','/controls.js?v=27','/haptics.js?v=27','/compat.js?v=27','/play.css?v=27','/camp.css?v=27',
  '/assets/griffin-character-atlas.png?v=27','/assets/pumpkin-atlas.png?v=27',
  '/assets/mittens-atlas.png?v=27','/assets/spike-atlas.png?v=27',
  '/assets/family-rv.png','/assets/route-biomes.jpg',
  '/assets/griffin-atlas.png', // Existing snack/obstacle props only.
  '/assets/bookman-bold.otf','/assets/griffin-icon.png?v=27',
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
