import test from 'node:test';
import assert from 'node:assert/strict';
import {PlatformRun} from '../dist/platform-engine.js';
import {LEVELS,getLevel} from '../dist/world-levels.js';

const step=(run,seconds,each)=>{for(let t=0;t<seconds;t+=1/120){each?.();run.update(1/120);}};
const AUTHORED=new Set(['bone','sign','block','spring','gold','chest','enemy','magnet','key','checkpoint','shield','goal']);

test('optional extras come after the authored course, so saved ids and positions never shift',()=>{
  for(const meta of LEVELS){
    const level=getLevel(meta.id),goal=level.entities.findIndex(e=>e.type==='goal');
    assert.ok(goal>0,meta.id);
    assert.ok(level.entities.slice(0,goal+1).every(e=>AUTHORED.has(e.type)),`${meta.id}: authored entities stay first`);
    assert.ok(level.entities.slice(goal+1).every(e=>['balloon','vent','bone','marker'].includes(e.type)),`${meta.id}: only extras follow the goal`);
    assert.deepEqual(level.entities.map(e=>e.id),level.entities.map((_,i)=>`e${i+1}`),`${meta.id}: ids stay sequential`);
    assert.ok(level.entities.some(e=>e.type==='balloon'),`${meta.id} has an air route`);
    for(const vent of level.entities.filter(e=>e.type==='vent')){
      const zone=level.zones.find(z=>vent.x>z.x&&vent.x<z.x+z.w);
      assert.ok(zone&&vent.w<=zone.w-30&&vent.duty>0&&vent.duty<.6&&vent.period>3,`${meta.id}: vents sit inside a gap`);
    }
  }
  // The tutorial keeps its opening sections plain.
  const first=getLevel('river-1');
  assert.ok(first.entities.filter(e=>e.type==='vent').every(e=>e.x>first.sectionShapes[5].x));
  assert.deepEqual(getLevel('canyon-3',{remix:true,seed:9}).entities,getLevel('canyon-3',{remix:true,seed:9}).entities);
});

test('every skyway and finish staircase can be crossed by simply holding right, with or without Easygoing mode',()=>{
  let lanes=0,stairs=0;
  for(const meta of LEVELS){
    const level=getLevel(meta.id);
    for(const s of level.sectionShapes){
      const lane=level.entities.filter(e=>e.type==='balloon'&&e.x>=s.x+700&&e.x<=s.x+742+3*168+5&&e.y<s.floorY-200);
      if(lane.length!==4)continue;
      for(const assist of [false,true]){
        const run=new PlatformRun();run.reset({levelId:meta.id,assist});
        const top=run.platforms.find(p=>p.x===s.x+435&&p.y===s.floorY-234);
        Object.assign(run.player,{x:top.x+60,y:top.y,grounded:true});run._groundId=top.id;run.move(1);
        let jumped=false;step(run,5,()=>{if(!jumped&&run.player.x>=top.x+top.w-(assist?22:50)){run.jump();jumped=true;}});
        assert.ok(run.pops>=4&&run.bestStompChain>=4,`${meta.id} section ${s.index}${assist?' (Easygoing)':''}: popped ${run.pops}`);
        assert.equal(run.hits,0);lanes++;
      }
    }
    if(meta.boss){assert.equal(level.entities.filter(e=>e.type==='balloon'&&e.x>level.width-1500).length,0);continue;}
    const run=new PlatformRun();run.reset({levelId:meta.id});
    const first=level.entities.filter(e=>e.type==='balloon').slice(-5)[0],floor=run.platforms.filter(p=>p.type==='ground').at(-1);
    Object.assign(run.player,{x:first.x-150,y:480,grounded:true});run._groundId=floor.id;run.move(1);
    let jumped=false;step(run,4,()=>{if(!jumped&&run.player.x>=first.x-118){run.jump();jumped=true;}});
    assert.ok(run.pops>=5,`${meta.id}: the finish staircase popped ${run.pops}`);stairs++;
  }
  assert.ok(lanes>=60);assert.equal(stairs,25);
});

test('balloons bounce only from above, pay treats into the chain, and never block or hurt',()=>{
  const events=[],run=new PlatformRun({onEvent:e=>events.push(e)});run.reset({levelId:'river-1'});
  const balloon={id:'test-balloon',type:'balloon',x:300,y:330,w:56,h:50,taken:false,reward:2,skin:0};run.entities.push(balloon);
  // Rising through it from below does nothing.
  Object.assign(run.player,{x:300,y:400,vy:-500,grounded:false});run._groundId=null;step(run,.12);
  assert.equal(balloon.taken,false);assert.equal(run.pops,0);
  // Falling onto its top pops it and bounces with the air jump restored.
  Object.assign(run.player,{x:300,y:290,vy:200,grounded:false,jumps:2});const treats=run.treats;step(run,.1);
  assert.equal(balloon.taken,true);assert.equal(run.pops,1);assert.equal(run.treats,treats+2);assert.ok(run.player.vy<0);assert.equal(run.player.jumps,1);
  assert.equal(run.hits,0);assert.equal(run.stomps,0,'balloons are not snack bandits');
  const pop=events.find(e=>e.type==='pop');assert.equal(pop.chain,1);assert.ok(pop.value>=20);
  assert.equal(run.result().pops,1);
  // Landing ends the air chain.
  step(run,2);assert.equal(run.player.grounded,true);assert.equal(run.airStomps,0);assert.equal(run.bestStompChain,1);
});

test('consecutive air stomps earn a growing bonus without changing a single stomp',()=>{
  const events=[],run=new PlatformRun({onEvent:e=>events.push(e)});run.reset({levelId:'river-1'});run.entities=[];
  const enemy=x=>{const e={id:`foe-${x}`,type:'enemy',subtype:'patrol',x,y:459,w:44,h:42,hp:1,vx:0,left:x,right:x,hurtTime:0,taken:false};run.entities.push(e);return e;};
  enemy(300);enemy(300);
  Object.assign(run.player,{x:300,y:420,vy:300,grounded:false});run._groundId=null;step(run,.05);
  const first=events.filter(e=>e.type==='stomp');assert.equal(first.length,1);assert.equal(first[0].value,70);assert.equal(first[0].chain,1);
  Object.assign(run.player,{x:300,y:420,vy:300});step(run,.05);
  const second=events.filter(e=>e.type==='stomp')[1];assert.equal(second.chain,2);assert.equal(second.value,105);
  assert.equal(run.bestStompChain,2);assert.equal(run.stomps,2);
});

test('an erupting vent lifts a fallen player back up; a resting vent leaves the fall alone',()=>{
  const level=getLevel('river-2'),vent=level.entities.find(e=>e.type==='vent');assert.ok(vent);
  const drop=time=>{const events=[],run=new PlatformRun({onEvent:e=>events.push(e)});run.reset({levelId:'river-2'});run.time=time;
    Object.assign(run.player,{x:vent.x,y:500,vy:300,grounded:false});run._groundId=null;step(run,.6);return {run,events};};
  const erupting=vent.period-vent.phase%vent.period+.05,resting=erupting+vent.period*(vent.duty+.25);
  const saved=drop(erupting);
  assert.equal(saved.run.vents,1);assert.equal(saved.run.hits,0);assert.ok(saved.events.some(e=>e.type==='vent'));
  assert.ok(saved.run.player.y<480,'the lift carries the player back above the trail');assert.equal(saved.run.player.jumps,1);
  const fell=drop(resting);
  assert.equal(fell.run.vents,0);assert.equal(fell.run.hits,1);assert.ok(fell.events.some(e=>e.type==='respawn'));
  // A player crossing above the gap is never touched.
  const run=new PlatformRun();run.reset({levelId:'river-2'});run.time=erupting;Object.assign(run.player,{x:vent.x,y:440,vy:0,grounded:false});run._groundId=null;step(run,.05);
  assert.equal(run.vents,0);
});

test('a frenzy starts a bounded snack shower whose treats rest on the ground and survive a checkpoint',()=>{
  const run=new PlatformRun();run.reset({levelId:'river-1'});const authored=run.entities.length;
  for(let i=0;i<18;i++)run._collect({type:'bone',x:run.player.x,y:run.player.y,taken:false});
  assert.ok(run.feverTime>0);step(run,1);
  // Saved one second in: the rest of the shower and the treats in the air carry over.
  const saved=JSON.parse(JSON.stringify(run.snapshot())),live=run.entities.filter(e=>e.rain&&!e.taken).length;
  assert.ok(live>=3);assert.equal(saved.entities.filter(e=>String(e.id).startsWith('rain-')).length,live);
  const restored=new PlatformRun();restored.reset({levelId:'river-1',checkpoint:saved});
  assert.equal(restored.entities.filter(e=>e.rain).length,live);assert.equal(restored._rain,run._rain);assert.equal(restored._rainSeed,run._rainSeed);
  step(run,3);step(restored,3);
  const rain=run.entities.filter(e=>e.rain);
  assert.equal(run.entities.length-authored,rain.length);assert.ok(rain.length>=14&&rain.length<=16);
  assert.equal(restored._rainCount,run._rainCount,'the restored shower drops the same treats');
  assert.deepEqual(restored.entities.filter(e=>e.rain).map(e=>[e.id,Math.round(e.x)]),rain.map(e=>[e.id,Math.round(e.x)]));
  assert.ok(rain.every(e=>e.type==='bone'&&e.x>=30&&e.x<=run.width-30&&Number.isFinite(e.y)));
  // Nothing sinks into the soil: a treat over solid ground stops on top of it.
  const grounded=rain.filter(e=>!e.taken&&e.floor!==undefined);assert.ok(grounded.length>0);
  step(run,2.2);assert.ok(grounded.filter(e=>!e.taken).every(e=>e.y<=e.floor));
  step(run,8);assert.ok(run.entities.filter(e=>e.rain&&!e.taken).length===0,'uncaught treats expire');
  // A tampered save cannot conjure a flood or break the seed.
  const junk=JSON.parse(JSON.stringify(saved));junk.state._rain=1e9;junk.state._rainSeed='x';
  for(let i=0;i<60;i++)junk.entities.push({id:`rain-${900+i}`,spawn:{type:'bone',rain:true,x:1e9,y:NaN,vy:1e9,life:1e9}});
  const safe=new PlatformRun();safe.reset({levelId:'river-1',checkpoint:junk});
  assert.ok(safe._rain<=16);assert.ok(Number.isInteger(safe._rainSeed));assert.ok(safe.entities.filter(e=>e.rain).length<=16);
  assert.ok(safe.entities.filter(e=>e.rain).every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&e.vy<=260&&e.life<=6.5));
});

test('landing reports impact for feedback and dropping into a gap splashes once',()=>{
  const events=[],run=new PlatformRun({onEvent:e=>events.push(e)});run.reset({levelId:'river-1'});
  run.jump();step(run,1.2);const land=events.find(e=>e.type==='land');
  assert.ok(land.speed>200&&land.surface==='ground'&&land.drop===false);
  const zone=run.zones[0];Object.assign(run.player,{x:zone.x+zone.w/2,y:470,vy:100,grounded:false});run._groundId=null;step(run,.5);
  assert.equal(events.filter(e=>e.type==='splash').length,1);assert.equal(events.find(e=>e.type==='splash').kind,'water');
});

test('a held jump button never clips a bounce, and a low lip is walked up',()=>{
  const run=new PlatformRun();run.reset({levelId:'river-1'});run.entities=[{id:'foe',type:'enemy',subtype:'patrol',x:300,y:459,w:44,h:42,hp:1,vx:0,left:300,right:300,hurtTime:0,taken:false}];
  Object.assign(run.player,{x:300,y:420,vy:300,grounded:false,jumpHeld:true});run._groundId=null;
  for(let i=0;i<40&&!run.stomps;i++)run.update(1/120);
  assert.equal(run.stomps,1);assert.ok(run.player.vy<-380);run.releaseJump();assert.ok(run.player.vy<-380,'releasing after a stomp keeps the full bounce');
  const lip=new PlatformRun();lip.reset({levelId:'river-1'});lip.entities=[];
  lip.platforms=[{id:'low',x:0,y:480,w:400,h:120,type:'ground',oneWay:false,active:true},{id:'high',x:400,y:456,w:600,h:144,type:'ground',oneWay:false,active:true},{id:'wall',x:1000,y:380,w:200,h:220,type:'ground',oneWay:false,active:true}];
  lip.width=1400;Object.assign(lip.player,{x:300,y:480,grounded:true});lip._groundId='low';lip.move(1);step(lip,1.2);
  assert.equal(lip.player.y,456);assert.ok(lip.player.x>500);assert.equal(lip.player.grounded,true);
  step(lip,3);assert.ok(lip.player.x<=1000-24+.5,'a real wall still stops the buddy');assert.equal(lip.player.y,456);
});

test('trail markers move the respawn point forward without healing or counting as checkpoints',()=>{
  const events=[],run=new PlatformRun({onEvent:e=>events.push(e)});run.reset({levelId:'river-2'});
  const s=run.level.sectionShapes[1],marker=run.entities.find(e=>e.type==='marker'&&e.x===s.x+500);assert.ok(marker);
  run.hearts=2;Object.assign(run.player,{x:marker.x,y:s.floorY,grounded:true});run._groundId=run.platforms.find(p=>p.type==='ground'&&p.x===s.x).id;step(run,.05);
  assert.equal(marker.active,true);assert.equal(run.checkpoints,0);assert.equal(run.hearts,2);assert.equal(run.checkpoint.x,marker.spawnX);
  assert.equal(events.filter(e=>e.type==='marker').length,1);
  run.entities=run.entities.filter(e=>e.type!=='vent');
  Object.assign(run.player,{x:s.x+570+s.gap/2,y:720,grounded:false});run._groundId=null;step(run,.05);
  assert.equal(run.hits,1);assert.equal(run.player.x,marker.spawnX);assert.equal(run.player.y,s.floorY);
  // An earlier marker never pulls the respawn point backward.
  const earlier=run.entities.find(e=>e.type==='marker'&&e.x<marker.x);Object.assign(run.player,{x:earlier.x,y:480});step(run,.05);
  assert.equal(run.checkpoint.x,marker.spawnX);
  const restored=new PlatformRun();restored.reset({levelId:'river-2',checkpoint:run.snapshot()});assert.equal(restored.checkpoint.x,marker.spawnX);
});

test('long air chains and secret stashes add Gold Rush time without changing the 30x ceiling',()=>{
  const run=new PlatformRun();run.reset({levelId:'river-1'});
  for(let i=0;i<4;i++){const b={id:`b${i}`,type:'balloon',x:300,y:330,w:56,h:50,taken:false,reward:1};run.entities.push(b);Object.assign(run.player,{x:300,y:296,vy:200,grounded:false});run._groundId=null;step(run,.05);assert.equal(b.taken,true);}
  assert.equal(run.bestStompChain,4);assert.ok(run.goldRushTime>2.5&&run.goldRushTime<=3);
  for(let i=0;i<30;i++)run._goldRush(5);assert.ok(run.goldRushTime<=12);
  for(let i=0;i<40;i++)run._collect({type:'bone',x:0,y:0,taken:false});run.charge=100;run.power();
  assert.equal(run.totalMultiplier,30);assert.equal(run.result().bestMultiplier,30);
});

test('bandit habits keep ids and spots, stay stompable, and the first levels stay gentle',()=>{
  for(const id of ['river-1','river-2','river-3','river-4'])assert.ok(getLevel(id).entities.filter(e=>e.type==='enemy').every(e=>['patrol','boss'].includes(e.subtype)),id);
  const kinds=new Set();
  for(const meta of LEVELS){
    const level=getLevel(meta.id);
    for(const e of level.entities.filter(e=>e.type==='enemy')){kinds.add(e.subtype);assert.ok(['patrol','hopper','roller','floater','boss'].includes(e.subtype));assert.ok(e.left<e.right&&e.hp>=1);if(e.subtype!=='patrol'&&e.subtype!=='boss')assert.ok(Number.isFinite(e.baseY)&&Number.isFinite(e.phase));}
  }
  assert.deepEqual([...kinds].sort(),['boss','floater','hopper','patrol','roller']);
  for(const subtype of ['hopper','floater','roller']){
    const run=new PlatformRun();run.reset({levelId:'river-1'});
    const foe={id:'foe',type:'enemy',subtype,x:600,y:459,baseY:459,phase:0,w:44,h:42,hp:1,vx:60,left:500,right:700,hurtTime:0,taken:false};run.entities=[foe];
    let low=foe.y,high=foe.y;Object.assign(run.player,{x:200,y:480});for(let i=0;i<480;i++){run.update(1/120);low=Math.max(low,foe.y);high=Math.min(high,foe.y);assert.ok(foe.x>=500&&foe.x<=700);}
    if(subtype==='roller')assert.equal(high,459);else assert.ok(low-high>60,`${subtype} moves through the air`);
    Object.assign(run.player,{x:foe.x,y:foe.y-foe.h/2-6,vy:260,grounded:false});run._groundId=null;step(run,.05);
    assert.equal(foe.taken,true,`${subtype} can be stomped`);assert.equal(run.hits,0);
  }
});

test('a remix reshuffles climbs, raised sections, and bandits while every goal stays reachable',()=>{
  const signature=level=>level.sectionShapes.map(s=>`${s.shape[0]}${s.floorY}`).join('')+'|'+level.entities.filter(e=>e.type==='enemy').map(e=>Math.round(e.x)).join(',');
  const base=signature(getLevel('canyon-2')),seen=new Set();
  for(let seed=1;seed<=12;seed++)seen.add(signature(getLevel('canyon-2',{remix:true,seed})));
  assert.ok(seen.size>=8,'different seeds give different courses');assert.ok(!seen.has(base)||seen.size>8);
  assert.equal(signature(getLevel('canyon-2')),base,'the authored course never changes');
  for(const meta of LEVELS)for(const seed of [3,77,4242]){
    const level=getLevel(meta.id,{remix:true,seed});
    assert.equal(level.entities.filter(e=>e.type==='gold').length,3);assert.equal(level.entities.filter(e=>e.type==='key').length,2);
    for(const phase of [-1,1]){
      const surfaces=level.platforms.filter(p=>p.type!=='block').map(p=>({...p,x:p.type==='moving'?p.originX+(p.axis==='x'?phase*p.range:0):p.x,y:p.type==='moving'?p.originY+(p.axis==='y'?phase*p.range:0):p.y}));
      const visited=new Set([surfaces[0].id]);let changed=true;
      while(changed){changed=false;for(const a of surfaces){if(!visited.has(a.id))continue;for(const b of surfaces){if(visited.has(b.id))continue;const delta=b.y-a.y,d=610**2+2*1750*delta;if(d<0)continue;const flight=(610+Math.sqrt(d))/1750,gap=Math.max(0,b.x-a.x-a.w,a.x-b.x-b.w);if(gap+20<=275*flight){visited.add(b.id);changed=true;}}}}
      for(const entity of level.entities.filter(e=>['gold','key','checkpoint','goal'].includes(e.type)||(e.type==='chest'&&e.secret))){
        const supports=surfaces.filter(p=>entity.x>=p.x-20&&entity.x<=p.x+p.w+20&&p.y>=entity.y&&p.y-entity.y<=100);
        assert.ok(supports.some(p=>visited.has(p.id)),`${meta.id} remix ${seed}/${phase}: ${entity.type} must be reachable`);
      }
    }
  }
});

test('a jump tapped and let go just before landing is a short hop; one still held is a full leap',()=>{
  const flight=release=>{
    const run=new PlatformRun();run.reset({levelId:'river-1'});run.entities=[];
    run.platforms=[{id:'floor',x:0,y:480,w:1200,h:120,type:'ground',oneWay:false,active:true}];run.width=1200;
    Object.assign(run.player,{x:300,y:455,vy:260,grounded:false,jumps:2});run._groundId=null;run._coyote=0;
    assert.equal(run.jump(),false,'no jumps left in the air, so the tap is remembered');
    if(release)run.releaseJump();
    let top=480,jumped=false;
    for(let i=0;i<240;i++){run.update(1/120);if(!run.player.grounded&&run.player.vy<0)jumped=true;top=Math.min(top,run.player.y);}
    assert.ok(jumped,'the remembered tap still jumps on landing');assert.equal(run.player.grounded,true);
    return 480-top;
  };
  const hop=flight(true),leap=flight(false);
  assert.ok(hop>40&&hop<leap*.7,`a released tap hops ${hop.toFixed(0)}px, a held one leaps ${leap.toFixed(0)}px`);
  assert.ok(leap>95);
});

test('a stomped boss leaps away dazed and cannot hurt until it has landed',()=>{
  for(const id of ['river-6','mesa-6']){
    const run=new PlatformRun();run.reset({levelId:id});const boss=run.entities.find(e=>e.subtype==='boss');assert.ok(boss,id);
    const hearts=run.hearts;let stomps=0;
    for(let round=0;round<3;round++){
      // Drop straight onto the boss and do nothing else, the way a first-time player would.
      Object.assign(run.player,{x:boss.x,y:boss.y-boss.h/2-60,vx:0,vy:200,grounded:false,jumps:1});run._groundId=null;run._coyote=0;run.invincible=0;
      for(let i=0;i<120&&run.stomps===stomps;i++)run.update(1/120);
      assert.equal(run.stomps,++stomps,`${id}: stomp ${stomps} lands`);
      for(let i=0;i<200&&boss.hurtTime>0&&!boss.taken&&run.mode==='running';i++){run.invincible=0;run.update(1/120);}
      assert.equal(run.hearts,hearts,`${id}: stomp ${stomps} costs nothing while the boss is dazed`);
    }
    assert.equal(run.bossDefeated,true);assert.equal(run.hits,0);
  }
});

test('lively bandits never reach a buddy standing on the steps, and a marker never returns the buddy into a lane',()=>{
  const layouts=[];for(const meta of LEVELS){layouts.push({levelId:meta.id});layouts.push({levelId:meta.id,remix:true,seed:7});}
  let lively=0,stands=0,returns=0;
  // The worst case: the bandit is held at the point of its lane nearest the buddy, who waits with no grace at all.
  const wait=(run,foe,seconds)=>{const hits=run.hits;for(let i=0;i<seconds*60&&run.mode==='running';i++){run.invincible=0;foe.x=Math.max(foe.left,Math.min(foe.right,run.player.x));run.update(1/60);}return run.hits-hits;};
  for(const config of layouts){
    const run=new PlatformRun();run.reset(config);const level=run.level;
    for(const foe of run.entities.filter(e=>e.type==='enemy'&&e.subtype!=='boss')){
      const s=level.sectionShapes.find(s=>foe.right===s.x+535);assert.ok(s,`${config.levelId}: every bandit belongs to a section`);
      const marker=run.entities.find(e=>e.type==='marker'&&e.x===s.x+500);assert.ok(marker);
      assert.ok(foe.left-marker.spawnX>44,`${config.levelId} section ${s.index}: the marker returns the buddy ${foe.left-marker.spawnX}px from a ${foe.subtype}`);returns++;
      if(!['hopper','floater'].includes(foe.subtype))continue;
      lively++;assert.notEqual(s.shape,'spring-bridge',`${config.levelId}: no hopping under a bridge`);
      // Stand on the overhanging lip of each low step through two hops or a whole bob.
      for(const plat of run.platforms.filter(p=>!['ground','block','secret'].includes(p.type)&&p.x>=s.x+100&&p.x<=s.x+300&&p.y<s.floorY-50&&p.y>s.floorY-170)){
        plat.type='grass';plat.active=true;Object.assign(run.player,{x:plat.x+plat.w+20,y:plat.y,vx:0,vy:0,grounded:true,jumps:0});run._groundId=plat.id;
        assert.equal(wait(run,foe,4),0,`${config.levelId} section ${s.index}: a ${foe.subtype} reached the buddy on a step`);
        assert.equal(run.player.grounded,true);stands++;
      }
      // And on the ground where the marker brings the buddy back.
      const ground=run.platforms.find(p=>p.type==='ground'&&p.x===s.x);
      Object.assign(run.player,{x:marker.spawnX,y:marker.spawnY,vx:0,vy:0,grounded:true,jumps:0});run._groundId=ground.id;
      assert.equal(wait(run,foe,4),0,`${config.levelId} section ${s.index}: the marker spot is inside a ${foe.subtype}'s reach`);
    }
  }
  assert.ok(lively>20&&stands>40&&returns>150,`${lively} lively bandits, ${stands} stands, ${returns} returns`);
});
