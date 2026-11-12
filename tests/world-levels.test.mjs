import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLDS,LEVELS,getLevel} from '../dist/world-levels.js';

test('five worlds contain thirty named, distinct, deterministic courses',()=>{
  assert.equal(WORLDS.length,5);assert.equal(LEVELS.length,30);assert.equal(new Set(LEVELS.map(l=>l.title)).size,30);
  for(const world of WORLDS)assert.equal(LEVELS.filter(l=>l.worldIndex===world.index).length,6);
  const first=getLevel('river-1'),again=getLevel('river-1');assert.deepEqual(first,again);
  first.platforms[0].w=1;first.entities[0].taken=true;assert.notEqual(getLevel('river-1').platforms[0].w,1);assert.equal(getLevel('river-1').entities[0].taken,false);
  assert.deepEqual(getLevel('mesa-4',{remix:true,seed:55}),getLevel('mesa-4',{remix:true,seed:55}));
  assert.notDeepEqual(getLevel('mesa-4',{remix:true,seed:55}),getLevel('mesa-4',{remix:true,seed:56}));
});

test('each course offers three branch shapes, two keys, three big gold bones, secrets, and safe recovery',()=>{
  for(const meta of LEVELS){const level=getLevel(meta.id);
    assert.ok(level.width>=11000);assert.equal(level.height,600);assert.equal(new Set(level.sectionShapes.map(s=>s.shape)).size,3);
    assert.equal(level.entities.filter(e=>e.type==='gold').length,3);assert.equal(level.entities.filter(e=>e.type==='key').length,2);
    assert.ok(level.entities.some(e=>e.type==='chest'&&e.secret));assert.ok(level.entities.filter(e=>e.type==='checkpoint').length>=4);
    assert.equal(level.entities.filter(e=>e.type==='enemy'&&e.subtype==='boss').length,meta.boss?1:0);
    assert.ok(level.platforms.every(p=>p.x>=0&&p.x+p.w<=level.width&&p.y>=100&&p.y+p.h<=600));
    assert.ok(level.zones.every(z=>z.w<=185));
  }
});

test('every key, gold bone, secret, checkpoint, and goal has a reachable platform path in all courses',()=>{
  // A conservative jump graph uses the actual single-jump velocity/gravity and
  // reserves ten pixels at each platform edge. Moving terraces are checked at
  // both extremes and at their midpoint; double jump is not needed by the graph.
  for(const meta of LEVELS)for(const phase of [-1,0,1]){
    const level=getLevel(meta.id),surfaces=level.platforms.filter(p=>p.type!=='block').map(p=>({...p,x:p.type==='moving'?p.originX+(p.axis==='x'?phase*p.range:0):p.x,y:p.type==='moving'?p.originY+(p.axis==='y'?phase*p.range:0):p.y}));
    const visited=new Set([surfaces[0].id]);let changed=true;
    while(changed){changed=false;for(const a of surfaces){if(!visited.has(a.id))continue;for(const b of surfaces){if(visited.has(b.id))continue;const delta=b.y-a.y,discriminant=610**2+2*1750*delta;if(discriminant<0)continue;const flight=(610+Math.sqrt(discriminant))/1750,gap=Math.max(0,b.x-a.x-a.w,a.x-b.x-b.w);if(gap+20<=275*flight){visited.add(b.id);changed=true;}}}}
    for(const entity of level.entities.filter(e=>['gold','key','checkpoint','goal'].includes(e.type)||(e.type==='chest'&&e.secret))){
      const supports=surfaces.filter(p=>entity.x>=p.x-20&&entity.x<=p.x+p.w+20&&p.y>=entity.y&&p.y-entity.y<=100);
      assert.ok(supports.some(p=>visited.has(p.id)),`${meta.id}/${phase}: ${entity.type} ${entity.id} must be reachable`);
    }
  }
});
