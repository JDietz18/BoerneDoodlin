import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { CHARACTER_ART } from '../dist/characters.js';
import { Renderer } from '../dist/renderer.js';

const ORIGIN='https://griffin-snack-patrol.jdietz.chatgpt.site';
const workerSource=fs.readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8');

function workerHarness() {
  const listeners={},stores=new Map(),deleted=[],network=[];
  const state={offline:false,cacheBlocked:false,claimed:0,skipped:0,installed:[]};
  for(const name of ['boerne-doodlin-adventure-v14','griffin-snack-patrol-v3','doodle-onward-journey-v22','unrelated-app-cache']) stores.set(name,new Map());
  const key=input=>new URL(typeof input==='string'?input:input.url,ORIGIN).href;
  const caches={
    async open(name) {
      if(state.cacheBlocked) throw new Error('CacheStorage unavailable');
      if(!stores.has(name)) stores.set(name,new Map());
      const entries=stores.get(name);
      return {
        async addAll(requests) {
          // The worker asks for each file with cache:'reload' so updates bypass the HTTP cache.
          for(const request of requests)assert.equal(request.cache,'reload',`Precache request for ${request.url} skips the HTTP cache`);
          const paths=requests.map(request=>request.url);
          state.installed=[...paths];
          for(const path of paths) {
            const pathname=new URL(path,ORIGIN).pathname;
            const file=new URL(`../dist${pathname==='/'?'/index.html':pathname}`,import.meta.url);
            assert.ok(fs.existsSync(fileURLToPath(file)),`Precache file exists: ${path}`);
          }
          for(const path of paths) entries.set(key(path),new Response(`cached:${path}`));
        },
        async match(request) { return entries.get(key(request))?.clone(); },
        async put(request,response) { entries.set(key(request),response); }
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name);return stores.delete(name); }
  };
  const self={
    location:{origin:ORIGIN},
    addEventListener:(type,handler)=>listeners[type]=handler,
    skipWaiting:async()=>{state.skipped++;},
    clients:{claim:async()=>{state.claimed++;}}
  };
  class Request {constructor(url,init={}){this.url=url;this.cache=init.cache;}}
  vm.runInNewContext(workerSource,{
    self,caches,URL,Response,Request,
    fetch:async request=>{
      const url=typeof request==='string'?request:request.url;
      network.push(url);
      if(state.offline) throw new Error('Network unavailable');
      return new Response(`online:${url}`);
    }
  });
  return {
    state,stores,deleted,network,
    async lifecycle(type,data={}) {
      const waits=[];
      listeners[type]({...data,waitUntil:promise=>waits.push(promise)});
      await Promise.all(waits);
    },
    async request(path,{mode='cors',method='GET'}={}) {
      let pending;
      listeners.fetch({request:{url:new URL(path,ORIGIN).href,mode,method},respondWith:promise=>pending=promise});
      return pending ? {handled:true,response:await pending} : {handled:false,response:null};
    }
  };
}

// Exercise the actual loader, instead of duplicating its URL-building logic in
// the test. Tiny opaque images are enough to run atlas cleanup and frame bounds.
async function rendererImageRequests() {
  const requests=[],oldImage=globalThis.Image,oldDocument=globalThis.document;
  globalThis.Image=class {
    width=8;height=8;
    set src(value) {requests.push(value);queueMicrotask(()=>this.onload());}
  };
  globalThis.document={
    createElement(type) {
      assert.equal(type,'canvas');
      return {width:0,height:0,getContext:()=>({
        drawImage(){},putImageData(){},
        getImageData(x,y,width,height) {
          const data=new Uint8ClampedArray(width*height*4);
          for(let i=3;i<data.length;i+=4)data[i]=255;
          return {data};
        }
      })};
    }
  };
  try {await Renderer.prototype.load.call({sprites:{}});}
  finally {
    if(oldImage===undefined)delete globalThis.Image;else globalThis.Image=oldImage;
    if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  }
  return requests;
}

test('every actual renderer image request, including versioned character atlases, boots offline',async()=>{
  const harness=workerHarness();await harness.lifecycle('install');
  const requests=await rendererImageRequests();
  for(const art of Object.values(CHARACTER_ART)) {
    const request=requests.find(url=>new URL(url,ORIGIN).pathname===art.src);
    assert.ok(request,`Renderer requests ${art.src}`);
    assert.equal(new URL(request,ORIGIN).search,'?v=23');
  }
  harness.state.offline=true;
  for(const request of requests) {
    assert.ok(harness.state.installed.includes(request),`Exact renderer URL is precached: ${request}`);
    const fetched=await harness.request(request);
    assert.equal(fetched.handled,true,`Worker intercepts ${request}`);
    assert.equal(await fetched.response.text(),`cached:${request}`);
  }
  assert.equal(harness.network.length,0,'Offline artwork never falls through to the network');
  for(const module of ['game','platform-engine','world-levels','scout-engine','journey','platform-renderer','rally3d','memory-game','snack-engine','renderer','adventure-engine','characters','audio','celebrations']) {
    const fetched=await harness.request(`/${module}.js?v=23`);
    assert.equal(fetched.handled,true);assert.equal(fetched.response.ok,true);
  }
});

test('navigation falls back offline while unrelated requests pass through and cache failures preserve online use',async()=>{
  const harness=workerHarness();await harness.lifecycle('install');
  harness.state.offline=true;
  let result=await harness.request('/?source=homescreen',{mode:'navigate'});
  assert.equal(await result.response.text(),'cached:/index.html');
  harness.state.offline=false;
  result=await harness.request('/',{mode:'navigate'});
  assert.equal(await result.response.text(),`online:${ORIGIN}/`);
  harness.state.offline=true;
  result=await harness.request('/index.html?reopened=1',{mode:'navigate'});
  assert.equal(await result.response.text(),`online:${ORIGIN}/`,'Fresh entry is retained for offline reopening');
  assert.equal((await harness.request('/private-data.json')).handled,false);
  assert.equal((await harness.request('/game.js?v=23',{method:'POST'})).handled,false);
  assert.equal((await harness.request('https://example.com/game.js?v=23')).handled,false);
  harness.state.offline=false;harness.state.cacheBlocked=true;
  result=await harness.request('/',{mode:'navigate'});
  assert.equal(await result.response.text(),`online:${ORIGIN}/`);
});

test('updates wait for an explicit activation message and delete only obsolete owned caches',async()=>{
  const harness=workerHarness();await harness.lifecycle('install');
  assert.equal(harness.state.skipped,0,'Installing a new version cannot interrupt a run');
  await harness.lifecycle('message',{data:{type:'IGNORED'}});assert.equal(harness.state.skipped,0);
  await harness.lifecycle('message',{data:{type:'SKIP_WAITING'}});assert.equal(harness.state.skipped,1);
  await harness.lifecycle('activate');
  assert.deepEqual(harness.deleted,['boerne-doodlin-adventure-v14','griffin-snack-patrol-v3','doodle-onward-journey-v22']);
  assert.equal(harness.stores.has('unrelated-app-cache'),true);
  assert.equal(harness.stores.has('doodle-onward-journey-v23'),true);
  assert.equal(harness.state.claimed,1);
});

test('the active module graph, stylesheet assets and installed-app icon are all in the exact offline bundle',async()=>{
  const harness=workerHarness();await harness.lifecycle('install');
  const installed=new Set(harness.state.installed);
  const assertBundled=(specifier,base)=>{
    if(/^(data:|#)/.test(specifier))return;
    const resolved=new URL(specifier,new URL(base,ORIGIN));
    if(resolved.origin!==ORIGIN)return;
    assert.ok(installed.has(resolved.pathname+resolved.search),`${base} requires cached ${resolved.pathname+resolved.search}`);
  };
  for(const path of installed) {
    const pathname=new URL(path,ORIGIN).pathname;
    if(pathname.endsWith('.js')) {
      const source=fs.readFileSync(new URL(`../dist${pathname}`,import.meta.url),'utf8');
      for(const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g))assertBundled(match[1],path);
    } else if(pathname.endsWith('.css')) {
      const source=fs.readFileSync(new URL(`../dist${pathname}`,import.meta.url),'utf8');
      for(const match of source.matchAll(/url\(\s*['"]?([^'"\)\s]+)['"]?\s*\)/g))assertBundled(match[1],path);
    }
  }
  const manifest=JSON.parse(fs.readFileSync(new URL('../dist/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/?source=homescreen');
  for(const icon of manifest.icons)assertBundled(icon.src,'/manifest.webmanifest');
  assert.ok(installed.has('/style.css?v=23'));assert.ok(installed.has('/minigames.css?v=23'));
  assert.equal(installed.has('/progression.js?v=23'),false,'Legacy progression is retained in source, not loaded by the new entry');
});
