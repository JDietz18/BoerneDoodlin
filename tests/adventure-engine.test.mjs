import test from 'node:test';
import assert from 'node:assert/strict';
import {AdventureRun,COURSE_PATTERNS,WORLD} from '../dist/adventure-engine.js';

const step=(run,seconds,dt=1/60)=>{for(let t=0;t<seconds-1e-8&&run.mode==='running';t+=dt)run.update(Math.min(dt,seconds-t));};
const emptyRun=(config={})=>{
  const events=[];const run=new AdventureRun({onEvent:event=>events.push(event)});
  run.reset(config);run.entities=[];run._nextChunk=1e9;return {run,events};
};
const add=(run,type,x=WORLD.playerX,y=0,w=36,h=36,extra={})=>{
  const entity={hit:false,passed:false,taken:false,closest:Infinity,...extra,type,x,y,w,h};run.entities.push(entity);return entity;
};
const apex=run=>{let peak=0;for(let i=0;i<120;i++){run.update(1/120);peak=Math.max(peak,run.player.y);}return peak;};

test('the constructor is quiet and reset emits an unambiguous event',()=>{
  const events=[];const run=new AdventureRun({onEvent:event=>events.push(event)});
  assert.equal(run.mode,'ready');assert.equal(events.length,0);
  run.reset({stage:2});assert.equal(events[0].type,'start');
  add(run,'bone',WORLD.playerX,18,30,30);run.update(1/60);
  const pickup=events.find(event=>event.type==='collect');
  assert.equal(pickup.kind,'bone');assert.equal(pickup.value,10);
});

test('held and tapped jumps have distinct heights; double jump is limited and resets on landing',()=>{
  const {run:held}=emptyRun(),{run:tapped}=emptyRun();
  held.jump();tapped.jump();step(tapped,.05);tapped.releaseJump();
  assert.ok(apex(held)>110);assert.ok(apex(tapped)<70);
  const {run}=emptyRun();assert.equal(run.jump(),true);step(run,.18);
  assert.equal(run.jump(),true);assert.equal(run.doubleJumps,1);
  const velocity=run.player.vy;assert.equal(run.jump(),false);assert.equal(run.player.vy,velocity);
  step(run,1.3);assert.equal(run.player.grounded,true);assert.equal(run.player.jumps,0);
  assert.equal(run.jump(),true);
});

test('buffered jump is consumed on landing and coyote time catches a late gap takeoff',()=>{
  const {run}=emptyRun();run.player.y=8;run.player.vy=-200;run.player.grounded=false;run.player.jumps=2;run._coyote=0;
  assert.equal(run.jump(),false);step(run,.05);
  assert.equal(run.player.grounded,false);assert.ok(run.player.vy>500);
  const {run:late}=emptyRun();add(late,'gap',WORLD.playerX+80,-22,150,22);
  step(late,.075);assert.equal(late.player.grounded,false);assert.equal(late.jump(),true);
  assert.equal(late.player.jumps,1);assert.ok(late.player.vy>600);
});

test('branches reward a slide, logs require a jump, and recovery is forgiving at the trailing edge',()=>{
  const {run:standing}=emptyRun();add(standing,'branch',WORLD.playerX+115,59,108,43);step(standing,.7);
  assert.equal(standing.hits,1);
  const {run:sliding}=emptyRun();add(sliding,'branch',WORLD.playerX+115,59,108,43);sliding.slide();step(sliding,.8);
  assert.equal(sliding.hits,0);assert.equal(sliding.dodged,1);assert.equal(sliding.nearMisses,1);
  const {run:low}=emptyRun();add(low,'log',WORLD.playerX+115,0,76,52);low.slide();step(low,.7);
  assert.equal(low.hits,1);
  const {run:jumping}=emptyRun();add(jumping,'log',WORLD.playerX+115,0,76,52);jumping.jump();step(jumping,.8);
  assert.equal(jumping.hits,0);assert.equal(jumping.dodged,1);
});

test('aerial slide drops promptly and becomes a slide on the ground',()=>{
  const {run}=emptyRun();run.jump();step(run,.2);assert.ok(run.player.y>80);
  run.slide();assert.ok(run.player.vy<=-850);step(run,.13);
  assert.equal(run.player.grounded,true);assert.equal(run.player.sliding,true);assert.equal(run.player.height,31);
});

test('a missed gap costs one heart and recovers; a spring gives a usable second jump',()=>{
  const {run}=emptyRun();add(run,'gap',WORLD.playerX+40,-22,150,22);step(run,1);
  assert.equal(run.hits,1);assert.equal(run.hearts,2);assert.equal(run.mode,'running');assert.ok(run.player.y>=0);
  const {run:spring}=emptyRun();add(spring,'spring',WORLD.playerX,0,58,18);spring.update(1/60);
  assert.equal(spring.springs,1);assert.ok(spring.player.vy>850);assert.equal(spring.player.jumps,1);
  assert.equal(spring.jump(),true);assert.equal(spring.doubleJumps,1);
});

test('shield and hit recovery prevent repeated punishment while real later mistakes can end a run',()=>{
  const {run,events}=emptyRun();run.shieldCharges=1;add(run,'log');run.update(1/60);
  assert.equal(run.hearts,3);assert.equal(run.shieldCharges,0);assert.equal(run.hits,0);
  add(run,'log');run.update(1/60);assert.equal(run.hearts,3);
  for(let i=0;i<3;i++){run.invincible=0;add(run,'log');run.update(1/60);}
  assert.equal(run.mode,'lost');assert.equal(run.hearts,0);
  const terminal=run.result();step(run,4);run.power();run.jump();run.slide();assert.deepEqual(run.result(),terminal);
  assert.equal(events.filter(event=>event.type==='lost').length,1);
});

test('each companion has a distinct useful power',()=>{
  const create=id=>{const {run}=emptyRun({characterId:id});run.charge=100;run.power();return run;};
  const griffin=create('griffin');add(griffin,'bone',WORLD.playerX,18,30,30);griffin.update(1/60);assert.equal(griffin.score,15);
  const kevin=create('kevin');add(kevin,'bone',WORLD.playerX+250,18,30,30);kevin.update(1/60);assert.equal(kevin.treats,1);
  const {run:mittens}=emptyRun({characterId:'mittens'});mittens.hearts=1;mittens.charge=100;mittens.power();assert.equal(mittens.hearts,2);
  const spike=create('spike');assert.equal(spike.maxHearts,4);add(spike,'log');spike.update(1/60);assert.equal(spike.score,150);assert.equal(spike.hits,0);
  add(griffin,'gap',WORLD.playerX,-22,200,22);step(griffin,.5);assert.equal(griffin.hits,0);assert.equal(griffin.player.grounded,true);
});

test('combos build fever and all seven distinct letter positions complete the word once per run',()=>{
  const {run,events}=emptyRun();
  for(let i=0;i<24;i++){add(run,'bone',WORLD.playerX,18,30,30);run.update(1/60);}
  assert.equal(run.bestCombo,24);assert.equal(run.multiplier,5);assert.ok(run.feverTime>0);
  for(let i=0;i<7;i++){add(run,'letter',WORLD.playerX,35,36,40,{letterIndex:i,letter:'GRIFFIN'[i]});run.update(1/60);}
  assert.equal(run.letters,7);assert.equal(run.letterMask,127);assert.equal(events.filter(event=>event.type==='word').length,1);
  add(run,'letter',WORLD.playerX,35,36,40,{letterIndex:3,letter:'F'});run.update(1/60);assert.equal(run.letters,7);
  run.reset();run.entities=[];run._nextChunk=1e9;
  for(let i=0;i<7;i++){add(run,'letter',WORLD.playerX,35,36,40,{letterIndex:i,letter:'GRIFFIN'[i]});run.update(1/60);}
  assert.equal(events.filter(event=>event.type==='word').length,2);
});

test('pause freezes all simulation and resume does not accumulate a backlog',()=>{
  const {run}=emptyRun();run.jump();step(run,.1);run.pause();const state=JSON.stringify([run.result(),run.player,run.charge]);
  for(let i=0;i<100;i++)run.update(.1);assert.equal(JSON.stringify([run.result(),run.player,run.charge]),state);
  run.resume();run.update(1/60);assert.ok(run.time<.12);assert.equal(run.mode,'running');
});

test('adventure bonus layers multiply real pickup points, expire, and preserve the peak',()=>{
  const {run,events}=emptyRun();
  for(let i=0;i<24;i++){add(run,'bone',WORLD.playerX,18,30,30);run.update(1/120);}
  assert.equal(run.multiplier,5);assert.ok(run.feverTime>0);run.charge=100;run.power();
  const before=run.score;add(run,'gold',WORLD.playerX,18,34,34);run.update(1/120);
  assert.equal(run.totalMultiplier,30);assert.equal(run.score-before,3000);assert.equal(run.bestMultiplier,30);
  assert.equal(events.filter(e=>e.type==='collect').at(-1).totalMultiplier,30);
  const next=run.score;add(run,'bone',WORLD.playerX,18,30,30);run.update(1/120);assert.equal(run.score-next,300);
  step(run,8.1);assert.equal(run.totalMultiplier,1);assert.equal(run.goldRushTime,0);assert.equal(run.result().bestMultiplier,30);
});

test('adventure gold rush and magnets extend to caps, while a hit keeps timed bonuses',()=>{
  const {run}=emptyRun();
  for(let i=0;i<4;i++)add(run,'gold',WORLD.playerX,18,34,34);run.update(1/120);assert.equal(run.goldRushTime,12);
  for(let i=0;i<4;i++)add(run,'magnet',WORLD.playerX,18,34,34);run.update(1/120);assert.equal(run.magnetTime,21);
  run.feverTime=6;run.multiplier=5;run.combo=24;run.comboTime=5;add(run,'log');run.update(1/120);
  assert.equal(run.hits,1);assert.equal(run.combo,0);assert.equal(run.totalMultiplier,4);assert.ok(run.feverTime>5.9);assert.ok(run.goldRushTime>11.9);
});

test('all five complete adventure routes have bounded durations and stable plain summaries',()=>{
  const expected=[55,58,60,62,65];
  for(let stage=0;stage<5;stage++){
    const events=[];const run=new AdventureRun({onEvent:event=>events.push(event)});run.reset({stage,seed:123});run.invincible=999;
    step(run,80);
    assert.equal(run.mode,'won');assert.ok(Math.abs(run.time-expected[stage])<.5,`stage ${stage} duration ${run.time}`);
    const result=run.result();assert.equal(result.mode,'adventure');assert.equal(result.stage,stage);assert.equal(result.won,true);assert.ok(result.runId);
    assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
    result.gear.heart=99;assert.equal(run.gear.heart,0);
    assert.equal(events.filter(event=>event.type==='won').length,1);
    const id=run.runId;run.reset({stage});assert.notEqual(run.runId,id);
  }
});

test('Daily is a seeded 90-second challenge with standardized gear and assist settings',()=>{
  const run=new AdventureRun();run.reset({mode:'daily',stage:4,seed:789,assist:true,gear:{heart:2,magnet:3,charge:3},dailyDate:'2026-11-12'});
  assert.equal(run.assist,false);assert.deepEqual(run.gear,{magnet:0,charge:0,heart:0,grace:0});assert.equal(run.stage,4);
  assert.equal(run.timeLimit,90);assert.equal(run.goal,Infinity);run.invincible=999;
  for(let i=0;i<6000&&run.mode==='running';i++){if(run.charge>=100)run.power();run.update(1/60);}
  assert.equal(run.time,90);assert.equal(run.mode,'won');assert.equal(run.result().dailyDate,'2026-11-12');
});

test('a seed yields the same course despite different actions and power usage',()=>{
  const routes=[0,1].map(index=>{
    const run=new AdventureRun();run.reset({stage:4,seed:6174});run.invincible=999;
    for(let frame=0;frame<5000&&run.mode==='running';frame++){
      if(index&&frame%80===0)run.jump();if(index&&frame%240===0){run.charge=100;run.power();}run.update(1/60);
    }
    return run.patternHistory;
  });
  assert.deepEqual(routes[0],routes[1]);
  const different=new AdventureRun();different.reset({stage:4,seed:6188});different.invincible=999;step(different,80);
  assert.notDeepEqual(routes[0],different.patternHistory);
});

test('every authored pattern has reaction space, landing space, and reachable single or double-jump routes',()=>{
  for(const pattern of COURSE_PATTERNS){
    const hazards=pattern.items.filter(item=>['log','branch','gap'].includes(item.type));
    assert.ok(hazards.every(item=>item.x-item.w/2>=250),`${pattern.id}: opening reaction space`);
    assert.ok(hazards.every(item=>pattern.length-(item.x+item.w/2)>=350),`${pattern.id}: landing space`);
    assert.ok(hazards.every((item,index)=>!index||item.x-hazards[index-1].x>=400),`${pattern.id}: successive obstacle spacing`);
    for(const speed of [295,380,530]){
      const {run}=emptyRun({stage:4});run.baseSpeed=speed;run.goal=Infinity;
      for(const entry of pattern.items)add(run,entry.type,WORLD.playerX+entry.x,entry.y,entry.w,entry.h,entry);
      for(let frame=0;frame<1200&&run.distance<pattern.length;frame++){
        const p=run.player;
        const next=run.entities.filter(e=>['log','branch','gap'].includes(e.type)&&!e.hit&&!e.passed&&e.x+e.w/2>p.x-22).sort((a,b)=>a.x-b.x)[0];
        if(next){
          const delta=next.x-p.x;
          if(next.type==='branch'&&p.grounded&&!p.sliding&&delta<next.w*.46+22+run.speed*.09)run.slide();
          if(next.type==='log'&&p.grounded&&delta<next.w*.46+22+run.speed*.13)run.jump();
          if(next.type==='gap'){
            if(p.grounded&&delta<next.w*.5+run.speed*.12)run.jump();
            else if(!p.grounded&&p.vy<100&&p.jumps<2&&delta<next.w*.5)run.jump();
          }
        }
        run.update(1/120);
      }
      assert.equal(run.hits,0,`${pattern.id} at ${speed}px/sec should have a clear route`);
    }
  }
});
