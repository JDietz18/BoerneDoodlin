import test from 'node:test';
import assert from 'node:assert/strict';
import {SnackStorm} from '../dist/snack-engine.js';

const step=(run,seconds,dt=1/60)=>{for(let t=0;t<seconds-1e-8&&run.mode==='running';t+=dt)run.update(Math.min(dt,seconds-t));};
function empty(config={}){const events=[];const run=new SnackStorm({onEvent:e=>events.push(e)});run.reset(config);run._nextWave=Infinity;return {run,events};}
function drop(run,type='bone',{x=run.player.x,y=60,vy=-180,...extra}={}){const e={type,x,y,vy,w:34,h:34,hit:false,taken:false,...extra};run.entities.push(e);return e;}
function catchOne(run,type='bone'){drop(run,type);run.update(1/120);}

test('Snack Storm constructor is quiet and reset exposes the shared contract',()=>{
  const events=[];const run=new SnackStorm({onEvent:e=>events.push(e)});assert.equal(run.mode,'ready');assert.equal(events.length,0);
  run.reset({characterId:'spike',stage:4,gear:{heart:99,magnet:9,charge:-3},assist:true});
  assert.equal(events[0].type,'start');assert.equal(run.runMode,'snack');assert.equal(run.timeLimit,45);assert.equal(run.goal,Infinity);
  assert.equal(run.stage,0);assert.equal(run.regionId,'rogue-river');assert.equal(run.maxHearts,7);assert.equal(run.player.width,120);
  assert.deepEqual(run.gear,{heart:2,magnet:3,charge:0,grace:0});
  const before={...run.player};assert.equal(run.jump(),false);assert.equal(run.slide(),false);run.releaseJump();assert.deepEqual(run.player,before);
});

test('held movement is smooth and bounded; pointer movement follows a persistent faster target',()=>{
  const {run}=empty();run.move(1);step(run,.1);assert.ok(Math.abs(run.player.x-625)<.01);assert.equal(run.player.moving,1);
  const stopped=run.player.x;run.move(0);step(run,.1);assert.equal(run.player.x,stopped);assert.equal(run.player.moving,0);
  run.moveTo(900);step(run,.1);assert.ok(Math.abs(run.player.x-715)<.01);step(run,.4);assert.equal(run.player.x,900);
  run.moveTo(99999);step(run,1);assert.equal(run.player.x,1040);
  run.move(-1);step(run,3);assert.equal(run.player.x,80);assert.equal(run.player.facing,-1);
  assert.equal(run.moveTo(NaN),false);
});

test('falling treats are caught at the pet, while missed treats break only the chain',()=>{
  const {run,events}=empty();drop(run,'bone',{y:220});step(run,.65);assert.equal(run.treats,0);step(run,.2);assert.equal(run.treats,1);
  assert.equal(events.find(e=>e.type==='collect').kind,'bone');
  for(let i=0;i<7;i++)catchOne(run);const score=run.score,hearts=run.hearts;run.feverTime=5;run.goldRushTime=4;
  drop(run,'bone',{x:80,y:-33});run.update(1/60);
  assert.equal(run.missed,1);assert.equal(run.combo,0);assert.equal(run.multiplier,1);assert.equal(run.hearts,hearts);assert.equal(run.score,score);
  assert.ok(run.feverTime>4.9);assert.ok(run.goldRushTime>3.9);
});

test('mud deals one heart with grace, shields block a hit, and three later mistakes can end a run',()=>{
  const {run,events}=empty();catchOne(run,'mud');assert.equal(run.hearts,2);assert.equal(run.hits,1);
  catchOne(run,'mud');assert.equal(run.hearts,2);assert.equal(run.hits,1);
  step(run,1.3);run.shieldCharges=1;catchOne(run,'mud');assert.equal(run.hearts,2);assert.equal(run.shieldCharges,0);
  step(run,1.3);catchOne(run,'mud');assert.equal(run.hearts,1);
  step(run,1.3);catchOne(run,'mud');assert.equal(run.mode,'lost');assert.equal(run.hearts,0);
  const result=run.result();step(run,2);run.moveTo(1040);run.power();assert.deepEqual(run.result(),result);assert.equal(events.filter(e=>e.type==='lost').length,1);
});

test('four powers preserve their character identities in the catching mode',()=>{
  const make=id=>{const {run}=empty({characterId:id});run.charge=100;run.power();return run;};
  const griffin=make('griffin');catchOne(griffin);assert.equal(griffin.score,15);
  const kevin=make('kevin');drop(kevin,'bone',{x:kevin.player.x+240,y:200});kevin.update(1/60);assert.equal(kevin.treats,1);
  const {run:mittens}=empty({characterId:'mittens'});mittens.hearts=1;mittens.charge=100;mittens.power();assert.equal(mittens.hearts,2);assert.equal(mittens.shieldCharges,1);
  const spike=make('spike');catchOne(spike,'mud');assert.equal(spike.score,150);assert.equal(spike.hearts,4);
});

test('real stacked scores reach 30x and timers expire without erasing the personal peak',()=>{
  const {run,events}=empty();for(let i=0;i<24;i++)catchOne(run);assert.equal(run.multiplier,5);assert.ok(run.feverTime>0);
  run.charge=100;run.power();const before=run.score;catchOne(run,'gold');
  assert.equal(run.totalMultiplier,30);assert.equal(run.score-before,3000);assert.equal(run.bestMultiplier,30);
  const gold=events.filter(e=>e.type==='collect').at(-1);assert.equal(gold.value,3000);assert.equal(gold.totalMultiplier,30);
  const next=run.score;catchOne(run);assert.equal(run.score-next,300);
  step(run,8.1);assert.equal(run.totalMultiplier,1);assert.equal(run.goldRushTime,0);assert.equal(run.bestMultiplier,30);assert.equal(run.result().bestMultiplier,30);
});

test('gold and magnet durations stack to bounded caps; a hit keeps timed layers active',()=>{
  const {run}=empty();for(let i=0;i<4;i++)drop(run,'gold');run.update(1/120);assert.equal(run.goldRushTime,12);
  for(let i=0;i<4;i++)drop(run,'magnet');run.update(1/120);assert.equal(run.magnetTime,21);
  run.feverTime=6;run.combo=24;run.multiplier=5;run.comboTime=5;catchOne(run,'mud');
  assert.equal(run.combo,0);assert.equal(run.multiplier,1);assert.equal(run.totalMultiplier,4);assert.ok(run.goldRushTime>11.9);assert.ok(run.feverTime>5.9);
});

test('pause freezes falling objects and timers and clears held movement for a safe resume',()=>{
  const {run}=empty();drop(run,'bone',{x:200,y:400});run.move(1);step(run,.1);run.pause();
  const snapshot=JSON.stringify([run.result(),run.entities,run.player,run.charge]);for(let i=0;i<100;i++)run.update(.1);
  assert.equal(JSON.stringify([run.result(),run.entities,run.player,run.charge]),snapshot);
  const x=run.player.x;run.resume();run.update(1/60);assert.equal(run.player.x,x);assert.ok(run.entities[0].y<382);
});

test('surviving the storm finishes at exactly 45 seconds and grants one stable result',()=>{
  const {run,events}=empty({seed:42});run.invincible=999;step(run,60);
  assert.equal(run.mode,'won');assert.equal(run.time,45);assert.equal(events.filter(e=>e.type==='won').length,1);
  const result=run.result();assert.equal(result.mode,'snack');assert.match(result.runId,/^snack-/);assert.equal(result.regionId,'rogue-river');
  assert.deepEqual(JSON.parse(JSON.stringify(result)),result);result.gear.magnet=99;assert.equal(run.gear.magnet,0);
  const id=run.runId;run.reset();assert.notEqual(run.runId,id);
});

test('seeded rain is independent of player motion, catches, and powers',()=>{
  const runs=[new SnackStorm(),new SnackStorm()];for(const run of runs){run.reset({seed:6174});run.invincible=999;}
  for(let i=0;i<2701;i++){
    runs[0].update(1/60);
    runs[1].move(i%160<80?-1:1);if(i%600===0){runs[1].charge=100;runs[1].power();}runs[1].update(1/60);
  }
  assert.equal(runs[0].mode,'won');assert.equal(runs[1].mode,'won');assert.deepEqual(runs[0].spawnHistory,runs[1].spawnHistory);
  const other=new SnackStorm();other.reset({seed:7182});other.invincible=999;step(other,46);assert.notDeepEqual(other.spawnHistory,runs[0].spawnHistory);
});

test('generated waves keep a safe pickup route separate from mud and finish falling before the timer',()=>{
  for(const seed of [1,17,99,6174]){
    const run=new SnackStorm();run.reset({seed});run.invincible=999;step(run,46);const drops=run.spawnHistory;
    assert.ok(drops.filter(e=>e.type==='bone'||e.type==='gold').length>90);assert.ok(drops.filter(e=>e.type==='gold').length>=8);assert.ok(drops.some(e=>e.type==='mud'));
    for(const a of drops){
      assert.ok(a.y>=360&&a.y<=480);assert.ok(-a.vy>=130&&-a.vy<=230);assert.ok(a.spawnedAt+(a.y+44)/-a.vy<45);
      if(a.type!=='mud')continue;
      for(const b of drops)if(b.type!=='mud'&&Math.abs(a.arrival-b.arrival)<=.7)assert.ok(Math.abs(a.x-b.x)>=180,`seed ${seed}: mud obstructs pickup at same arrival time`);
    }
  }
});

test('following readable treat clusters can survive and build meaningful bonus stacks',()=>{
  const run=new SnackStorm();run.reset({seed:61});
  for(let i=0;i<2800&&run.mode==='running';i++){
    const target=run.entities.filter(e=>['bone','gold'].includes(e.type)).sort((a,b)=>a.y-b.y)[0];if(target)run.moveTo(target.x);
    if(run.charge>=100&&run.feverTime>0&&run.goldRushTime>0)run.power();run.update(1/60);
  }
  assert.equal(run.mode,'won');assert.ok(run.treats>=80);assert.ok(run.bestCombo>=24);assert.equal(run.bestMultiplier,30);
});
