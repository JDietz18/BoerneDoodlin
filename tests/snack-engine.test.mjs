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

// ---- run arc, touch dragging, stack milestones, and the five world twists ----
import {SNACK_TWISTS,SNACK_TIMING} from '../dist/snack-engine.js';
const HEAD=82;
function full(config={},play){
  const events=[];const run=new SnackStorm({onEvent:e=>events.push({...e,at:run.time})});run.reset(config);run.invincible=999;
  for(let i=0;i<2760&&run.mode==='running';i++){play?.(run,i);run.update(1/60);}
  return {run,events};
}
const follow=run=>{const target=run.entities.filter(e=>['bone','gold'].includes(e.type)&&!(e.fountain&&e.vy>0)).sort((a,b)=>a.y-b.y)[0];if(target)run.dragTo(target.x);};

test('the run opens with a 3-2-1-GO count on simulation time and still lasts exactly 45 seconds',()=>{
  const {run,events}=full({seed:7});
  const count=events.filter(e=>e.type==='countdown');
  assert.deepEqual(count.map(e=>e.count),[3,2,1,0]);
  count.forEach((e,i)=>assert.ok(e.at>=SNACK_TIMING.countdown[i]&&e.at<SNACK_TIMING.countdown[i]+.02));
  // The first treats are already falling during the count and reach the pet just after GO.
  const first=run.spawnHistory[0];assert.ok(first.spawnedAt<1&&first.arrival>SNACK_TIMING.countdown[3]&&first.arrival<3);
  assert.equal(run.mode,'won');assert.equal(run.time,45);assert.equal(run.intro,0);
  const paused=new SnackStorm();paused.reset({seed:7});paused.update(.5);paused.pause();const intro=paused.intro;for(let i=0;i<50;i++)paused.update(.1);assert.equal(paused.intro,intro);
});

test('the final ten seconds tick once a second, fill out the waves, and end on a golden goodbye',()=>{
  const {run,events}=full({seed:99});
  assert.equal(events.filter(e=>e.type==='final-push').length,1);assert.ok(Math.abs(events.find(e=>e.type==='final-push').at-35)<.02);
  const ticks=events.filter(e=>e.type==='tick');assert.deepEqual(ticks.map(e=>e.remaining),[10,9,8,7,6,5,4,3,2,1]);
  ticks.forEach(e=>assert.ok(Math.abs(e.at-(45-e.remaining))<.02));
  const perWave=from=>{const waves=new Map();for(const d of run.spawnHistory)if(['bone','gold'].includes(d.type)&&d.spawnedAt>=from&&d.spawnedAt<from+7)waves.set(d.wave,(waves.get(d.wave)||0)+1);return [...waves.values()];};
  assert.ok(Math.max(...perWave(20))<=3);assert.ok(Math.min(...perWave(35))>=3);assert.ok(perWave(35).includes(5));
  const finale=events.find(e=>e.type==='finale');assert.ok(finale&&finale.arrival>44&&finale.arrival<45);
  const last=run.spawnHistory.filter(d=>d.spawnedAt>=SNACK_TIMING.finale-.02);assert.deepEqual(last.map(d=>d.type),['bone','gold','bone']);
  assert.equal(events.filter(e=>e.type==='won').length,1);assert.equal(run.time,45);
});

test('dragging keeps the pet under the finger while a single tap still trots',()=>{
  const {run}=empty();let finger=560;
  for(let i=0;i<40;i++){finger+=i<20?60:-75;run.dragTo(finger);run.update(1/60);assert.ok(Math.abs(run.player.x-Math.max(80,Math.min(1040,finger)))<1e-6,`frame ${i}`);}
  // The controller's existing moveTo stream is recognised as a drag too.
  const {run:stream}=empty();finger=560;for(let i=0;i<20;i++){finger+=50;stream.moveTo(finger);stream.update(1/60);if(i)assert.ok(Math.abs(stream.player.x-Math.min(1040,finger))<1e-6);}
  const {run:tap}=empty();tap.moveTo(1000);tap.update(1/60);assert.ok(Math.abs(tap.player.x-575)<.01);
  assert.equal(tap.dragTo('nope'),false);tap.pause();assert.equal(tap.dragTo(300),false);
});

test('losing a chain and climbing the stack are announced once each',()=>{
  const {run,events}=empty();for(let i=0;i<8;i++)catchOne(run);
  drop(run,'bone',{x:80,y:-33});run.update(1/60);
  const lost=events.filter(e=>e.type==='chain-lost');assert.equal(lost.length,1);assert.deepEqual([lost[0].combo,lost[0].multiplier,lost[0].reason],[8,2,'miss']);assert.equal(run.chainsLost,1);
  drop(run,'bone',{x:80,y:-33});run.update(1/60);assert.equal(events.filter(e=>e.type==='chain-lost').length,1,'no chain, nothing to lose');
  catchOne(run);catchOne(run,'mud');assert.equal(events.filter(e=>e.type==='chain-lost').at(-1).reason,'hit');
  catchOne(run);step(run,5.5);assert.equal(events.filter(e=>e.type==='chain-lost').at(-1).reason,'timeout');
  const climb=empty(),r=climb.run;for(let i=0;i<24;i++)catchOne(r);
  assert.deepEqual(climb.events.filter(e=>e.type==='stack').map(e=>e.level),[10]);
  catchOne(r,'gold');assert.deepEqual(climb.events.filter(e=>e.type==='stack').map(e=>e.level),[10,20]);
  r.charge=100;r.power();assert.deepEqual(climb.events.filter(e=>e.type==='stack').map(e=>[e.level,e.totalMultiplier]),[[10,10],[20,20],[30,30]]);
  catchOne(r);assert.equal(climb.events.filter(e=>e.type==='stack').length,3);
  for(const type of ['fever-end','gold-rush-end','power-end'])assert.equal(climb.events.filter(e=>e.type===type).length,0);
  step(r,13);for(const type of ['fever-end','gold-rush-end','power-end'])assert.equal(climb.events.filter(e=>e.type===type).length,1,type);
});

test('each world plays one seeded twist that ignores the player and keeps every landing honest',()=>{
  assert.deepEqual([...SNACK_TWISTS],['bounce','sway','gust','comet','bloom']);
  const schedule=events=>events.filter(e=>['gust','comet','bloom-seed','bloom','finale','countdown','tick','section'].includes(e.type)).map(e=>[e.type,Number(e.at.toFixed(3)),e.x??e.direction??e.count??e.remaining??e.section]);
  for(let world=0;world<5;world++){
    const idle=full({seed:6174,worldIndex:world}),busy=full({seed:6174,worldIndex:world},(run,i)=>{follow(run);if(i%500===0){run.charge=100;run.power();}});
    assert.equal(idle.run.twist,SNACK_TWISTS[world]);assert.equal(idle.run.mode,'won');assert.equal(busy.run.mode,'won');
    assert.deepEqual(idle.run.spawnHistory,busy.run.spawnHistory,`world ${world}: same course for an idle and a busy player`);
    assert.deepEqual(schedule(idle.events),schedule(busy.events),`world ${world}: same weather for an idle and a busy player`);
    const other=full({seed:7182,worldIndex:world});assert.notDeepEqual(other.run.spawnHistory,idle.run.spawnHistory);
    const drops=idle.run.spawnHistory;
    for(const a of drops)if(a.type==='mud')for(const b of drops)if(b.type!=='mud'&&Math.abs(a.arrival-b.arrival)<=.7)assert.ok(Math.abs(a.x-b.x)>=180,`world ${world}: mud lands clear of every pickup`);
  }
  // The base rain is the same storm in every world; only the weather differs.
  const rain=world=>full({seed:321,worldIndex:world}).run.spawnHistory.filter(d=>!d.comet&&d.type!=='bloom'&&d.type!=='mud').map(d=>[d.type,d.x,d.y,d.spawnedAt]);
  assert.deepEqual(rain(1),rain(2));assert.deepEqual(rain(1),rain(3));
});

test('anything a twist pushes sideways is back on its landing column by the time it can be caught',()=>{
  for(const world of [1,2,3]){
    const run=new SnackStorm();run.reset({seed:17,worldIndex:world});run.invincible=999;run.player.x=80;run._targetX=null;
    const columns=new Map(run.spawnHistory.map(d=>[d.id,d.x]));let drifted=0,checked=0;
    for(let i=0;i<2760&&run.mode==='running';i++){
      run.update(1/60);for(const d of run.spawnHistory)columns.set(d.id,d.x);
      for(const e of run.entities){
        if(!columns.has(e.id)||e.fountain)continue;const column=columns.get(e.id);
        if(e.y>HEAD+60&&Math.abs(e.x-column)>12)drifted++;
        if(e.y<=HEAD){checked++;assert.ok(Math.abs(e.x-column)<1e-6,`world ${world}: ${e.type} is on its column at head height`);}
      }
    }
    assert.ok(checked>200);assert.ok(drifted>100,`world ${world}: the twist visibly moves things in the air`);
    if(world===2)assert.equal(run.wind,0,'the last gust has blown itself out');
  }
});

test('Rogue River tennis balls hop once for a second chance, then count as a miss',()=>{
  const {run,events}=full({seed:61,worldIndex:0});
  const bouncy=run.spawnHistory.filter(d=>d.bouncy);assert.ok(bouncy.length>=10&&bouncy.every(d=>d.type==='bone'));
  assert.equal(events.filter(e=>e.type==='bounce').length,run.bounces);assert.ok(run.bounces>=8);assert.equal(run.result().bounces,run.bounces);
  // Standing still: a bouncing ball leaves the grass again before it is finally missed.
  const {run:one,events:log}=empty({worldIndex:0});one.player.x=80;drop(one,'bone',{x:600,baseX:600,y:60,vy:-180,bouncy:true,bounceDir:1});
  step(one,.4);assert.equal(log.filter(e=>e.type==='bounce').length,1);assert.equal(one.missed,0);assert.ok(one.entities[0].vy>0);
  step(one,.5);assert.ok(one.entities[0].y>100);assert.ok(one.entities[0].x>600);
  one.moveTo(one.entities[0].x+40);step(one,1.2);assert.equal(one.treats,1,'caught on the way back down');
  const {run:two,events:log2}=empty({worldIndex:0});two.player.x=80;for(let i=0;i<7;i++)catchOne(two);
  drop(two,'bone',{x:600,baseX:600,y:20,vy:-180,bouncy:true,bounceDir:-1});step(two,.3);assert.equal(two.combo,7,'the first landing keeps the chain');
  step(two,1.6);assert.equal(two.missed,1);assert.equal(two.combo,0);assert.equal(log2.filter(e=>e.type==='miss')[0].bouncy,true);
  // A bounce never crosses a mud landing.
  for(const d of bouncy){const land=d.spawnedAt+d.y/-d.vy;for(const m of run.spawnHistory)if(m.type==='mud'&&m.arrival>land-.7&&m.arrival<land+2.2)assert.ok(Math.abs(m.x-d.x)>=135,'mud keeps away from a bounce');}
});

test('Starlight Mesa comets and Boerne bluebonnet bursts are free bonuses',()=>{
  const mesa=full({seed:61,worldIndex:3});
  const comets=mesa.run.spawnHistory.filter(d=>d.comet);assert.ok(comets.length>=3&&comets.length<=5);assert.equal(mesa.run.comets,comets.length);assert.ok(comets.every(d=>d.type==='gold'));
  const count=(events,match)=>events.filter(match).length;
  assert.equal(count(mesa.events,e=>e.type==='fizzle'&&e.kind==='gold')+count(mesa.events,e=>e.type==='collect'&&e.comet),comets.length,'an unclaimed comet just fizzles');
  assert.ok(count(mesa.events,e=>e.type==='fizzle')>=1);
  const chased=full({seed:61,worldIndex:3},follow);assert.ok(chased.run.gold>=full({seed:61,worldIndex:0},follow).run.gold+3);
  assert.ok(chased.events.some(e=>e.type==='collect'&&e.comet));
  const boerne=full({seed:61,worldIndex:4});
  assert.ok(boerne.run.blooms>=3&&boerne.run.blooms<=5);assert.equal(boerne.events.filter(e=>e.type==='bloom').length,boerne.run.blooms);
  assert.equal(count(boerne.events,e=>e.type==='fizzle')+count(boerne.events,e=>e.type==='collect'&&e.bonus),boerne.run.blooms*5,'five treats per burst');
  assert.ok(count(boerne.events,e=>e.type==='fizzle')>=5);
  const regular=boerne.run.spawnHistory.filter(d=>d.type==='bone'||d.type==='gold').length;
  assert.equal(boerne.run.missed+count(boerne.events,e=>e.type==='collect'&&!e.bonus&&['bone','gold'].includes(e.kind)),regular,'burst treats never count as missed');
  for(const seedDrop of boerne.run.spawnHistory.filter(d=>d.type==='bloom')){const land=seedDrop.spawnedAt+seedDrop.y/-seedDrop.vy;for(const m of boerne.run.spawnHistory)if(m.type==='mud'&&m.arrival>land-.7&&m.arrival<land+2.2)assert.ok(Math.abs(m.x-seedDrop.x)>=280,'mud keeps away from a burst');}
  // A burst falls back around where it bloomed, never interrupts a chain, and feeds it when caught.
  const {run,events}=empty({worldIndex:4});for(let i=0;i<3;i++)catchOne(run);
  run.entities.push({id:900,type:'bloom',x:560,baseX:560,y:30,w:40,h:40,vy:-150,vx:0,taken:false,hit:false});step(run,.3);
  assert.equal(events.filter(e=>e.type==='bloom').length,1);assert.equal(run.entities.filter(e=>e.fountain).length,5);assert.equal(run.treats,3,'nothing is caught on the way up');
  step(run,1.8);assert.ok(run.treats>=6);assert.equal(run.missed,0);assert.ok(run.combo>=6);assert.equal(events.filter(e=>e.type==='chain-lost').length,0);
});

test('worlds, twists, and extra result fields leave the shared contract alone',()=>{
  const run=new SnackStorm();run.reset({worldIndex:9});assert.equal(run.worldIndex,4);run.reset({worldIndex:-3});assert.equal(run.worldIndex,0);run.reset();assert.equal(run.worldIndex,0);
  run.reset({seed:5,worldIndex:2});run.worldIndex=4;assert.equal(run.twist,'bloom','the controller may set the world after reset');
  const result=run.result();for(const key of ['runId','mode','state','stage','regionId','characterId','won','score','treats','distance','time','hits','dodged','nearMisses','bestCombo','bestMultiplier','gold','letters','letterMask','powersUsed','hearts','maxHearts','seed','assist','gear','dailyDate','missed','springs','slides','doubleJumps'])assert.ok(key in result,key);
  assert.deepEqual([result.bounces,result.blooms,result.comets],[0,0,0]);assert.equal(result.stage,0);
  // Easygoing mode slows the fall but the golden goodbye still reaches the pet in time.
  const easy=full({seed:8,assist:true});const finale=easy.events.find(e=>e.type==='finale');assert.ok(finale.arrival>44&&finale.arrival<45);assert.equal(easy.run.time,45);
});

// ---- the Snack Storm view: layout contract and event handling (no browser needed) ----
import {Renderer} from '../dist/renderer.js';
import {Juice} from '../dist/fx.js';
function view({width=390,height=750,insets={top:96,bottom:150,left:0,right:0},reducedMotion=false}={}){
  const v=Object.create(Renderer.prototype);
  Object.assign(v,{width,height,dpr:1,insets,sprites:{},props:null,juice:new Juice(),reducedMotion,_mouth:{x:width/2,y:height/2}});
  v.juice.reducedMotion=reducedMotion;return v;
}
// Enough of a canvas for the sprite painters to run; nothing is ever read back.
function withFakeCanvas(work){
  const before=globalThis.document,gradient={addColorStop(){}};
  const context=()=>new Proxy({},{get:(target,key)=>key in target?target[key]:()=>gradient,set:(target,key,value)=>{target[key]=value;return true;}});
  globalThis.document={createElement:()=>({width:0,height:0,getContext:context})};
  try{return work();}finally{if(before===undefined)delete globalThis.document;else globalThis.document=before;}
}

test('the storm layout keeps the pet above the touch controls and maps a finger straight onto the lane',()=>{
  for(const [width,height,insets] of [[390,750,{top:96,bottom:150}],[844,390,{top:64,bottom:84}],[844,390,{top:64,bottom:84,left:47,right:47}],[374,569,{}],[1100,572,{top:0,bottom:0}]]){
    const v=view({width,height,insets}),run=new SnackStorm();run.reset({seed:3});const L=v._stormLayout(run,insets),label=`${width}x${height}`;
    assert.ok(L.ground<=height-(insets.bottom||0)-20,`${label}: the pet and its meter stand clear of the bottom inset`);
    assert.ok(L.skyTop>=(insets.top||0)&&L.playH>=180,`${label}: the fall has room under the HUD`);
    assert.ok(L.ground-L.petH>L.skyTop+L.playH*.3,`${label}: most of the fall is visible above the pet`);
    const left=L.x0+80*L.sx,right=L.x0+1040*L.sx;
    assert.ok(left-L.petW/2>=(insets.left||0)-1&&right+L.petW/2<=width-(insets.right||0)+1,`${label}: the pet never hangs off the side`);
    for(const px of [left,width/2,right])assert.ok(Math.abs(L.x0+v.stormWorldX(px)*L.sx-px)<1e-9,`${label}: stormWorldX inverts the lane mapping`);
    assert.ok(Math.abs(v.stormWorldX(width/2)-560)<1,`${label}: the middle of the screen is the middle of the lane`);
    if(!insets.left)assert.ok(Math.abs(L.sx-width/1120)/(width/1120)<.06,`${label}: dragging stays close to 1:1`);
    assert.ok(L.size>=26&&L.size<=44);
  }
  const fresh=view();assert.equal(fresh._L,undefined);assert.ok(Math.abs(fresh.stormWorldX(195)-560)<1e-9,'before the first frame the lane fills the canvas');
});

test('every Snack Storm event is handled in every world, and reduced motion stays still',()=>{
  const seen=new Set();
  for(const reducedMotion of [true,false])withFakeCanvas(()=>{
    for(let world=0;world<5;world++){
      const v=view({reducedMotion}),j=v.juice;let popups=0,moved=0;
      const run=new SnackStorm({onEvent:e=>{seen.add(e.type);v.addEvent(e,run);}});
      run.reset({seed:61+world,worldIndex:world,characterId:['griffin','kevin','mittens','spike'][world%4]});v._stormLayout(run,v.insets);
      // hit-stops and slow motion stretch real time, so allow a generous number of frames
      for(let i=0;i<4200&&run.mode==='running';i++){
        // chase treats most of the time, stand still now and then, and walk into the odd mud ball
        const lazy=Math.floor(run.time/3)%4===3,target=run.entities.filter(e=>(lazy?e.type==='mud':['bone','gold','magnet','shield','heart'].includes(e.type))&&!(e.fountain&&e.vy>0)).sort((a,b)=>a.y-b.y)[0];
        if(target&&(!lazy||run.hearts>1))run.dragTo(target.x);if(run.charge>=100&&run.feverTime>0)run.power();
        run.update(j.step(1/60));j.update(1/60);popups=Math.max(popups,j.popups.length);
        moved=Math.max(moved,j.particles.length+j.fliers.length+j.rings.length);
        assert.ok(j.particles.length<=j.maxParticles&&j.popups.length<=j.maxPopups&&j.fliers.length<=40);
        if(reducedMotion){assert.equal(j.trauma,0);assert.equal(j._flash,null);assert.equal(j.frozen,false);assert.deepEqual(j.offset,{x:0,y:0,rot:0,zoom:1});}
      }
      assert.ok(['won','lost'].includes(run.mode));assert.ok(popups>=2,'catches always answer back with a number');
      if(reducedMotion)assert.equal(moved,0,'no flying pieces under reduced motion');else assert.ok(moved>20,'the full effects layer is in play');
    }
  });
  for(const type of ['start','countdown','collect','combo','stack','fever','gold-rush','power','charged','dodge','hit','chain-lost','miss','section','final-push','tick','finale','bounce','gust','comet','bloom','fizzle','won'])assert.ok(seen.has(type),`${type} was exercised`);
  // The legacy trail runner still gets its simple sparks from the same entry point.
  const old=view();old.particles=[];old.labels=[];old.shake=0;old.addEvent({type:'hit',x:100,y:40},{runMode:'adventure'});assert.ok(old.particles.length>0&&old.shake>0);
});

// ---- frame pacing, and a controller that announces the stack itself ----
test('the seeded course is identical at any frame pacing, through hit-stops and slow motion',()=>{
  const noise=seed=>{let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};};
  const paced=(world,seed,pacing,busy)=>{
    const weather=[],run=new SnackStorm({onEvent:e=>{if(['gust','comet','bloom-seed','finale'].includes(e.type))weather.push([e.type,run.time,e.x??e.direction,e.arrival??e.duration]);}});
    run.reset({seed,worldIndex:world});run.invincible=999;const r=noise(seed+pacing);
    for(let i=0;i<60000&&run.mode==='running';i++){
      if(busy){follow(run);if(run.charge>=100)run.power();}
      // steady 60 fps; frozen, slowed, dropped and uneven frames; a 120 Hz screen; a crawl of tiny steps
      const k=r(),dt=pacing===0?1/60:pacing===1?(k<.1?0:k<.2?.45/60:k<.35?1/30:k<.5?k*.1:1/60-k*.004):pacing===2?1/120:k*.004;
      run.update(dt);
    }
    assert.equal(run.mode,'won');assert.equal(run.time,45);
    return {course:run.spawnHistory,weather};
  };
  for(let world=0;world<5;world++){
    const steady=paced(world,4242+world,0,false);
    assert.ok(steady.course.length>150);if(world>=2)assert.ok(steady.weather.length>=3);
    for(const [pacing,busy] of [[1,true],[2,true],[3,false]]){
      const other=paced(world,4242+world,pacing,busy);
      assert.deepEqual(other.course,steady.course,`world ${world}: same course at pacing ${pacing}`);
      assert.deepEqual(other.weather,steady.weather,`world ${world}: same weather at pacing ${pacing}`);
    }
  }
  // Waves start on their own clock, not on whichever frame happened to notice them.
  const run=new SnackStorm();run.reset({seed:9});for(let i=0;i<200;i++)run.update(.0031);
  assert.equal(run.spawnHistory[0].spawnedAt,.45);
  // Bluebonnet treats are numbered apart from the course, so a burst never renumbers the rain.
  const boerne=full({seed:61,worldIndex:4}).run;assert.deepEqual(boerne.spawnHistory.map(d=>d.id),boerne.spawnHistory.map((d,i)=>boerne.spawnHistory[0].id+i));
});

test('the view reads a stack announcement by its multiplier, whoever sends it',()=>{
  withFakeCanvas(()=>{
    const v=view(),run=new SnackStorm({onEvent:e=>v.addEvent(e,run)});run.reset({seed:3});v._stormLayout(run,v.insets);run._nextWave=Infinity;run.update(1/60);
    // the newest headline (a fresh one waits a beat behind the one on screen), and a way to let it play out
    const banner=()=>(v._sv.bannerNext||v._sv.banner)?.text,sub=()=>v._sv.sub?.text,rings=()=>v.juice.rings.length;
    const later=()=>{v._sv.banner=v._sv.bannerNext=v._sv.sub=null;for(let i=0;i<120;i++)run.update(1/60);};
    // A controller that watches the live total announces every tier from 2x up as {total,tier}.
    v.addEvent({type:'stack',total:2,tier:2},run);v.addEvent({type:'stack',total:5,tier:5},run);
    assert.equal(banner(),undefined,'small steps belong to the chain, gold and frenzy lines');assert.equal(rings(),0);assert.equal(v.juice.frozen,false);
    // The engine's own rung, then the controller's echo of it in the same frame: one party.
    v.addEvent({type:'stack',tier:1,level:10,totalMultiplier:10},run);assert.equal(banner(),'10x STACK!');const after=rings();assert.ok(after>0);
    v.addEvent({type:'stack',total:10,tier:10},run);assert.equal(banner(),'10x STACK!');assert.equal(sub(),undefined);assert.equal(rings(),after);
    // Either shape alone is enough, and the top rung is only ever 30x.
    later();v.addEvent({type:'stack',total:20,tier:20},run);assert.equal(banner(),'20x STACK!');
    later();v.addEvent({type:'stack',tier:3,level:30,totalMultiplier:30},run);assert.equal(banner(),'30x MAX STACK!');assert.equal(v._sv.maxed,true);
    // Dropping a rung and climbing straight back is a quieter line, not a second headline.
    later();v.addEvent({type:'stack',tier:3,level:30,totalMultiplier:30},run);assert.equal(banner(),undefined);assert.equal(sub(),'30x MAX STACK!');
    // A controller's echo of a broken chain is not a second break.
    for(let i=0;i<8;i++){run.entities.push({type:'bone',x:run.player.x,y:60,vy:-180,w:34,h:34,hit:false,taken:false});run.update(1/120);}
    v.juice.clear();run.entities.push({type:'bone',x:run.player.x>500?80:1040,y:-33,vy:-180,w:34,h:34,hit:false,taken:false});run.update(1/60);
    const popups=v.juice.popups.filter(p=>p.text==='CHAIN LOST').length,bits=v.juice.particles.length;assert.equal(popups,1);
    v.addEvent({type:'chain-lost',combo:8},run);assert.equal(v.juice.popups.filter(p=>p.text==='CHAIN LOST').length,1);assert.equal(v.juice.particles.length,bits);
  });
});
