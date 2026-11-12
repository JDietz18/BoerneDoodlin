import test from 'node:test';
import assert from 'node:assert/strict';
import {PlatformRun} from '../dist/platform-engine.js';

const step=(run,seconds,dt=1/120)=>{for(let t=0;t<seconds-1e-8&&run.mode==='running';t+=dt)run.update(Math.min(dt,seconds-t));};
function empty(config={}){const events=[],run=new PlatformRun({onEvent:e=>events.push(e)});run.reset(config);run.platforms=[{id:'ground',x:0,y:480,w:2500,h:120,type:'ground',oneWay:false,active:true}];run.entities=[];run.width=2500;run.height=600;run._groundId='ground';return {run,events};}
function item(run,type,extra={}){const e={id:`test-${run.entities.length}`,type,x:run.player.x,y:run.player.y-32,w:30,h:30,taken:false,...extra};run.entities.push(e);return e;}
function catchOne(run,type='bone'){item(run,type);run.update(1/120);}
const minimumFeet=run=>{let min=run.player.y;for(let i=0;i<180;i++){run.update(1/120);min=Math.min(min,run.player.y);}return min;};

test('platform movement is free in both directions with bounded, responsive acceleration',()=>{
  const {run}=empty();run.move(1);step(run,.5);assert.ok(run.player.x>235);run.move(0);step(run,.3);assert.equal(run.player.vx,0);
  run.move(-1);step(run,2);assert.equal(run.player.x,24);assert.equal(run.player.facing,-1);
});

test('short, held, and double jumps differ and one-way ledges can be landed on from below',()=>{
  const {run:held}=empty(),{run:tapped}=empty();held.jump();tapped.jump();step(tapped,.05);tapped.releaseJump();
  assert.ok(minimumFeet(held)<377);assert.ok(minimumFeet(tapped)>415);
  const {run}=empty();run.jump();step(run,.2);assert.equal(run.jump(),true);assert.equal(run.jump(),false);assert.ok(minimumFeet(run)<315);
  const {run:ledge}=empty();ledge.player.x=200;ledge.platforms.push({id:'ledge',x:145,y:400,w:160,h:24,type:'grass',oneWay:true,active:true});ledge.jump();step(ledge,1);assert.equal(ledge.player.y,400);assert.equal(ledge._groundId,'ledge');
});

test('jump buffering and coyote time prevent lost inputs near landing and edges',()=>{
  const {run}=empty();run.player.y=468;run.player.vy=260;run.player.grounded=false;run.player.jumps=2;run._groundId=null;run._coyote=0;
  assert.equal(run.jump(),false);step(run,.07);assert.ok(run.player.vy<0);assert.equal(run.player.jumps,1);
  const {run:edge}=empty();edge.platforms[0].w=190;edge.player.x=210;edge.player.vx=200;edge.move(1);step(edge,.025);assert.equal(edge.player.grounded,false);assert.equal(edge.jump(),true);assert.equal(edge.player.jumps,1);
});

test('head hitting a snack block pays once and leaves a solid used block',()=>{
  const {run,events}=empty();run.player.x=220;run.platforms.push({id:'block',x:196,y:330,w:48,h:48,type:'block',oneWay:false,active:true,used:false});
  item(run,'block',{x:220,y:354,w:48,h:48,platformId:'block',contains:'bones'});run.jump();step(run,.4);
  assert.equal(run.blocks,1);assert.equal(run.treats,3);assert.equal(run.platforms[1].used,true);step(run,.8);run.jump();step(run,.4);assert.equal(run.blocks,1);assert.equal(events.filter(e=>e.type==='block').length,1);
});

test('stomps bounce, bosses need three distinct hits, and side contact gives damage grace',()=>{
  const {run}=empty();run.player.x=200;const enemy=item(run,'enemy',{x:200,y:459,w:44,h:42,subtype:'patrol',hp:1,vx:0,left:200,right:200,hurtTime:0});
  run.player.y=395;run.player.vy=250;run.player.grounded=false;run._groundId=null;step(run,.16);assert.equal(enemy.taken,true);assert.equal(run.stomps,1);assert.equal(run.hits,0);assert.ok(run.player.vy<0);
  const {run:boss}=empty();boss.bossDefeated=false;const b=item(boss,'enemy',{x:200,y:432,w:108,h:96,subtype:'boss',hp:3,maxHp:3,vx:0,left:200,right:200,hurtTime:0});
  for(let i=0;i<3;i++){boss.player.x=200;boss.player.y=345;boss.player.vy=250;boss.player.grounded=false;boss._groundId=null;b.hurtTime=0;step(boss,.15);}
  assert.equal(b.hp,0);assert.equal(boss.bossDefeated,true);assert.equal(boss.stomps,3);
  const {run:hit}=empty();item(hit,'enemy',{x:120,y:459,w:44,h:42,hp:1,vx:0,left:120,right:120,hurtTime:0});step(hit,.01);assert.equal(hit.hits,1);hit.player.x=120;hit.player.y=480;step(hit,.01);assert.equal(hit.hits,1);
});

test('moving platforms carry a standing player, crumbles recover, and springs preserve an air jump',()=>{
  const {run}=empty();const moving={id:'moving',x:100,y:400,w:200,h:24,type:'moving',oneWay:true,active:true,axis:'x',range:40,speed:1,phase:0,originX:100,originY:400};run.platforms.push(moving);run.player.x=200;run.player.y=400;run._groundId='moving';step(run,.5);
  assert.ok(Math.abs(run.player.x-(200+Math.sin(.5)*40))<.01);assert.equal(run.player.y,400);
  const {run:crumble}=empty();const c={id:'crumble',x:70,y:400,w:160,h:24,type:'crumble',oneWay:true,active:true,crumbleAfter:.8};crumble.platforms.push(c);crumble.player.y=400;crumble._groundId='crumble';step(crumble,.9);assert.equal(c.active,false);step(crumble,4.1);assert.equal(c.active,true);
  const {run:spring}=empty();item(spring,'spring',{x:120,y:470,w:46,h:20});spring.update(1/60);assert.ok(spring.player.vy<-800);assert.equal(spring.player.jumps,1);assert.equal(spring.jump(),true);
});

test('falls recover at an activated checkpoint without erasing collected items',()=>{
  const {run}=empty();run.player.x=220;item(run,'checkpoint',{x:220,y:438,w:34,h:84,spawnX:250,spawnY:480,active:false});run.update(1/60);assert.equal(run.checkpoints,1);
  run.treats=9;run.keys=1;run.player.y=720;run.player.grounded=false;run._groundId=null;run.update(1/60);
  assert.equal(run.hits,1);assert.equal(run.player.x,250);assert.equal(run.player.y,480);assert.equal(run.treats,9);assert.equal(run.keys,1);
});

test('chests interact once; a finish gate requires both keys and any boss',()=>{
  const {run,events}=empty();item(run,'chest',{x:140,y:448,secret:true,revealed:true,reward:8});assert.equal(run.interact(),true);assert.equal(run.treats,8);assert.equal(run.secrets,1);assert.equal(run.interact(),false);
  item(run,'goal',{x:130,y:400,w:90,h:160});run.update(1/60);assert.equal(run.mode,'running');run.keys=2;run.bossDefeated=false;run.update(1/60);assert.equal(run.mode,'running');run.bossDefeated=true;run.update(1/60);assert.equal(run.mode,'won');
  step(run,2);assert.equal(events.filter(e=>e.type==='won').length,1);
});

test('platform bonus layers multiply actual points up to 30x and survive a chain-breaking hit',()=>{
  const {run}=empty();for(let i=0;i<24;i++)catchOne(run);run.charge=100;run.power();const before=run.score;catchOne(run,'gold');
  assert.equal(run.totalMultiplier,30);assert.equal(run.score-before,3000);assert.equal(run.result().bestMultiplier,30);
  run.powerTime=0;run._damage('test');assert.equal(run.multiplier,1);assert.equal(run.totalMultiplier,4);step(run,8.1);assert.equal(run.totalMultiplier,1);assert.equal(run.bestMultiplier,30);
});

test('equipped charms affect movement, jumps, charge, reach, timing, shields, and powers',()=>{
  const {run}=empty({charms:{extraJump:true,speed:.1,shieldStart:true,comboGrace:2,goldDuration:2,powerDuration:1.5,secretMagnet:true,stompCharge:true,stompBounce:true}});
  assert.equal(run.speed,302.5);assert.equal(run.shieldCharges,1);run.jump();step(run,.1);assert.equal(run.jump(),true);assert.equal(run.jump(),true);assert.equal(run.jump(),false);
  run.player.x=120;run.player.y=480;run.player.vy=0;run.player.grounded=true;run._groundId='ground';item(run,'key',{x:235,y:448});run.update(1/120);assert.equal(run.keys,1);
  catchOne(run,'gold');assert.equal(run.goldRushTime,6);assert.equal(run.comboTime,7.4);run.charge=100;run.power();assert.equal(run.powerDuration,6.3);
  run.powerTime=0;run._damage('test');assert.equal(run.hits,0);assert.equal(run.shieldCharges,0);
  const e=item(run,'enemy',{x:120,y:459,w:44,h:42,subtype:'patrol',hp:1,vx:0,left:120,right:120,hurtTime:0});run.charge=0;run._stomp(e,false);assert.equal(run.charge,25);
});

test('compact snapshots preserve pickups, quests, receipt IDs, and signed player velocity',()=>{
  const run=new PlatformRun();run.reset({levelId:'redwood-2',seed:23,remix:true,charms:{extraJump:true},dailyDate:'2026-11-12'});
  const coin=run.entities.find(e=>e.type==='bone');run.player.x=coin.x;run.player.y=coin.y+32;run._maybeCollect(coin);
  const key=run.entities.find(e=>e.type==='key');run.player.x=key.x;run.player.y=key.y+32;run._maybeCollect(key);run.player.vx=-73;run.player.vy=-119;
  const saved=run.snapshot(),restored=new PlatformRun();assert.equal(restored.restore(JSON.parse(JSON.stringify(saved))),true);
  assert.equal(restored.runId,run.runId);assert.equal(restored.keys,1);assert.equal(restored.treats,1);assert.equal(restored.player.vx,-73);assert.equal(restored.player.vy,-119);assert.equal(restored.dailyDate,'2026-11-12');
  assert.equal(restored.entities.find(e=>e.id===coin.id).taken,true);assert.equal(restored.entities.find(e=>e.id===key.id).taken,true);
  const moving=run.platforms.find(p=>p.type==='moving');run.time=5;run._groundId=null;run._stepPlatforms(0);run.player.x=moving.x+moving.w/2;run.player.y=moving.y;run.player.grounded=true;run._groundId=moving.id;
  const position={x:run.player.x,y:run.player.y};assert.equal(restored.restore(run.snapshot()),true);assert.ok(Math.abs(restored.player.x-position.x)<.001);assert.ok(Math.abs(restored.player.y-position.y)<.001);
  assert.equal(restored.restore({version:99}),false);
});

test('pause freezes physics and timers, and the largest authored gap is clearable with a double jump',()=>{
  const {run}=empty();run.jump();step(run,.1);run.pause();const saved=JSON.stringify([run.player,run.result(),run.charge]);for(let i=0;i<100;i++)run.update(.1);assert.equal(JSON.stringify([run.player,run.result(),run.charge]),saved);
  for(const assist of [false,true]){const {run:gap}=empty({assist});gap.platforms=[{id:'a',x:0,y:480,w:450,h:120,oneWay:false,active:true,type:'ground'},{id:'b',x:635,y:480,w:900,h:120,oneWay:false,active:true,type:'ground'}];gap.player.x=375;gap._groundId='a';gap.move(1);
    for(let i=0;i<400&&gap.player.x<720;i++){if(gap.player.grounded&&gap.player.x>405&&gap.player.x<450)gap.jump();else if(!gap.player.grounded&&gap.player.vy>=0&&gap.player.jumps<2)gap.jump();gap.update(1/120);}
    assert.ok(gap.player.x>=720);assert.equal(gap.hits,0);assert.equal(gap.mode,'running');}
});

test('all three section families can actually be climbed to their high landing',()=>{
  for(const shape of ['canopy-steps','spring-bridge','moving-terraces']){
    const run=new PlatformRun();run.reset({levelId:'river-1'});run.entities=run.entities.filter(e=>e.type==='spring');
    const section=run.level.sectionShapes.find(s=>s.shape===shape),x=section.x;
    const floor=run.platforms.find(p=>p.type==='ground'&&p.x===x);run.player.x=x+30;run.player.y=floor.y;run._groundId=floor.id;
    const targets=[run.platforms.find(p=>Math.abs((p.originX??p.x)-(x+(shape==='moving-terraces'?110:125)))<1),run.platforms.find(p=>Math.abs((p.originX??p.x)-(x+(shape==='spring-bridge'?330:shape==='moving-terraces'?285:275)))<1),run.platforms.find(p=>p.x===x+435)];
    for(const target of targets){let reached=false;for(let tick=0;tick<1800;tick++){
      if(run._groundId===target.id){reached=true;break;}
      const aim=shape==='spring-bridge'&&target===targets[0]?target.x+45:target.x+target.w/2;
      const delta=aim-run.player.x;run.move(Math.abs(delta)<10?0:Math.sign(delta));
      if(run.player.grounded)run.jump();else if(run.player.vy>0&&run.player.y>target.y-4&&run.player.jumps<2)run.jump();run.update(1/120);
    }assert.ok(reached,`${shape}: must reach ${target.id}`);}
    assert.equal(run.hits,0,`${shape}: no forced damage on the high route`);
  }
});
