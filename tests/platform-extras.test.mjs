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
    assert.ok(level.entities.slice(goal+1).every(e=>['balloon','vent','bone'].includes(e.type)),`${meta.id}: only extras follow the goal`);
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

test('a frenzy starts a bounded snack shower that is never written into a checkpoint',()=>{
  const run=new PlatformRun();run.reset({levelId:'river-1'});const authored=run.entities.length;
  for(let i=0;i<18;i++)run._collect({type:'bone',x:run.player.x,y:run.player.y,taken:false});
  assert.ok(run.feverTime>0);step(run,4);
  const rain=run.entities.filter(e=>e.rain);
  assert.equal(run.entities.length-authored,rain.length);assert.ok(rain.length>=14&&rain.length<=16);
  assert.ok(rain.every(e=>e.type==='bone'&&e.x>=30&&e.x<=run.width-30&&Number.isFinite(e.y)));
  const saved=run.snapshot();assert.ok(saved.entities.every(e=>!String(e.id).startsWith('rain-')));
  const restored=new PlatformRun();restored.reset({levelId:'river-1',checkpoint:saved});
  assert.equal(restored.entities.filter(e=>e.rain).length,0);assert.equal(restored.entities.length,authored);
  step(run,8);assert.ok(run.entities.filter(e=>e.rain&&!e.taken).length===0,'uncaught treats expire');
});

test('landing reports impact for feedback and dropping into a gap splashes once',()=>{
  const events=[],run=new PlatformRun({onEvent:e=>events.push(e)});run.reset({levelId:'river-1'});
  run.jump();step(run,1.2);const land=events.find(e=>e.type==='land');
  assert.ok(land.speed>200&&land.surface==='ground'&&land.drop===false);
  const zone=run.zones[0];Object.assign(run.player,{x:zone.x+zone.w/2,y:470,vy:100,grounded:false});run._groundId=null;step(run,.5);
  assert.equal(events.filter(e=>e.type==='splash').length,1);assert.equal(events.find(e=>e.type==='splash').kind,'water');
});
