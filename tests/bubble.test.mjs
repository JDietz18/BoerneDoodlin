import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BubblePop,BUBBLE_HIT,BUBBLE_TWISTS,BUBBLE_COLUMNS} from '../dist/bubble-engine.js';
import {Journey,MODES,SAVE_KEY} from '../dist/journey.js';
import {stackLayers} from '../dist/hud.js';

const make=(options={})=>{const events=[],run=new BubblePop({onEvent:e=>events.push(e)});run.reset({seed:11,...options});run.setField(400,700);events.length=0;return {run,events};};
// A bubble that sits still where a test wants it.
let placed=0;
const place=(run,{kind='bone',x=.5,y=.5,r=.07,id=++placed+5000,variant=0}={})=>{const e={id,kind,x,baseX:x,y,r,vy:0,vx:0,phase:0,age:1,variant,splits:false,bloom:false,popped:false,gone:false,bonus:false};run.entities.push(e);return e;};
const clear=run=>{run.entities.length=0;};
const play=(run,seconds,dt=1/60)=>{for(let t=0;t<seconds;t+=dt)run.update(dt);};

test('the same seed gives the same sky whatever the player does and at any frame rate',()=>{
  const quiet=make({seed:9001}).run,busy=make({seed:9001,characterId:'kevin'}).run,coarse=make({seed:9001}).run;
  play(quiet,45,1/60);
  // the busy player taps all over the field, drags, and fires a power as soon as it is ready
  for(let t=0;t<45;t+=1/30){
    busy.update(1/30);
    if(Math.round(t*30)%7===0){busy.touchStart('a',(t*.37)%1,.3+(t*.11)%.6);busy.touchMove('a',((t*.37)+.4)%1,.4);busy.touchEnd('a');}
    busy.charge=100;busy.power();
  }
  play(coarse,45,.1);
  assert.ok(quiet.spawnLog.length>60,'a full run has plenty of bubbles');
  assert.deepEqual(busy.spawnLog,quiet.spawnLog,'input and powers never move the schedule');
  assert.deepEqual(coarse.spawnLog,quiet.spawnLog,'nor does the frame rate');
  const other=make({seed:9002}).run;play(other,45);assert.notDeepEqual(other.spawnLog,quiet.spawnLog,'a different seed is a different sky');
  const kinds=new Set(quiet.spawnLog.map(s=>s.kind));assert.ok(kinds.has('bone')&&kinds.has('gold')&&kinds.has('burr'));
});

test('things the player causes draw from their own stream and never shift the base schedule',()=>{
  for(const [worldIndex,twist,characterId] of [[3,'glow','griffin'],[4,'bloom','kevin']]){
    assert.equal(BUBBLE_TWISTS[worldIndex],twist);
    const quiet=make({seed:77,worldIndex,characterId}).run,busy=make({seed:77,worldIndex,characterId}).run;
    play(quiet,45);
    for(let t=0;t<45;t+=1/60){busy.update(1/60);if(Math.round(t*60)%5===0){busy.setField(400,700);for(const e of busy.entities.slice())if(e.y<.8&&e.y>.3){busy.touchStart('p',e.x,e.y);busy.touchEnd('p');}}if(Math.round(t*60)%240===0){busy.charge=100;busy.power();}}
    assert.deepEqual(busy.spawnLog,quiet.spawnLog);
    assert.ok((twist==='glow'?quiet:busy).extraLog.length>0,`${twist} made extras`);
    assert.equal(quiet.extraLog.filter(x=>x.kind==='bloom').length,0,'nobody popped a bluebonnet, so nothing burst');
  }
  const {run}=make({characterId:'kevin'});run.charge=100;run.power();assert.equal(run.entities.filter(e=>e.summoned&&e.kind==='gold').length,3,'Pumpkin summons three golden bubbles');
  assert.equal(run.spawnLog.length,0,'summoned bubbles are not part of the schedule');
});

test('pause freezes time, bubbles, strokes and the clock',()=>{
  const {run,events}=make({seed:5});play(run,3);const before={time:run.time,y:run.entities.map(e=>e.y),score:run.score,comboTime:run.comboTime};
  run.pause();assert.equal(run.mode,'paused');play(run,5);
  assert.equal(run.time,before.time);assert.deepEqual(run.entities.map(e=>e.y),before.y);assert.equal(run.touchStart('x',.5,.5),0,'no popping while paused');
  assert.equal(run.power(),false);run.resume();play(run,.5);assert.ok(run.time>before.time);
  assert.ok(events.some(e=>e.type==='pause')&&events.some(e=>e.type==='resume'));
});

test('the stack is the documented product: 5x chain, 2x frenzy, 2x Gold Rush, 1.5x Griffin power, never above 30x',()=>{
  const {run}=make({characterId:'griffin'});
  assert.equal(run.totalMultiplier,1);
  run.combo=40;run.multiplier=5;assert.equal(run.totalMultiplier,5);
  run.feverTime=3;assert.equal(run.totalMultiplier,10);
  run.goldRushTime=3;assert.equal(run.totalMultiplier,20);
  run.powerTime=3;assert.equal(run.totalMultiplier,30);
  const layers=stackLayers(run,'griffin');assert.equal(layers.total,30);assert.equal(layers.chain.value,5);assert.equal(layers.frenzy.value,2);assert.equal(layers.gold.value,2);assert.equal(layers.power.value,1.5);
  const pumpkin=make({characterId:'kevin'}).run;pumpkin.multiplier=5;pumpkin.feverTime=3;pumpkin.goldRushTime=3;pumpkin.powerTime=3;assert.equal(pumpkin.totalMultiplier,20,'only Griffin carries the 1.5x layer');
  // and in a hard-played run the number never leaves 1..30
  const play2=make({seed:3,characterId:'griffin'}).run;let top=1;
  for(let t=0;t<45;t+=1/30){play2.update(1/30);for(const e of play2.entities.slice())if(e.kind!=='burr'&&e.y<.85&&e.y>.1)play2.touchStart('s',e.x,e.y);play2.touchEnd('s');if(play2.charge>=100)play2.power();top=Math.max(top,play2.totalMultiplier);assert.ok(play2.totalMultiplier<=30);}
  assert.ok(top>=10,`a hard-played run reaches a big stack (${top}x)`);assert.ok(play2.bestMultiplier<=30);
});

test('each treat pays its flat value times the stack, and chain steps arrive every six pops up to 5x',()=>{
  const {run,events}=make();
  for(let i=0;i<30;i++){clear(run);const b=place(run,{x:.5,y:.5});run.touchStart('t',.5,.5);run.touchEnd('t');assert.ok(b.popped);}
  assert.equal(run.multiplier,5);assert.equal(run.combo,30);assert.equal(events.filter(e=>e.type==='combo').length,5);
  const last=events.filter(e=>e.type==='collect').at(-1);assert.equal(last.value,Math.round(10*last.totalMultiplier));
  assert.ok(events.some(e=>e.type==='fever'),'long chains start a frenzy');
  const gold=make();place(gold.run,{kind:'gold'});gold.run.touchStart('g',.5,.5);assert.equal(gold.run.goldRushTime,4);assert.equal(gold.run.gold,1);assert.equal(gold.run.treats,3);assert.equal(gold.events.find(e=>e.type==='collect').value,200,'100 points, doubled by the Gold Rush it starts');
});

test('a burr breaks the chain, a drag never touches one, and Spike makes burrs harmless',()=>{
  const {run,events}=make();run.combo=14;run.multiplier=3;run.comboTime=5;
  place(run,{kind:'burr',x:.3,y:.5});
  const b2=place(run,{kind:'bone',x:.6,y:.5});
  // a drag across the burr and the treat pops only the treat
  run.touchStart('d',.1,.5);run.touchMove('d',.9,.5);run.touchEnd('d');
  assert.ok(b2.popped);assert.equal(run.entities.filter(e=>e.kind==='burr'&&!e.popped).length,1,'the burr was left alone');assert.equal(run.burrs,0);assert.equal(run.combo,15);
  // a deliberate tap on the burr breaks the chain
  run.touchStart('t',.3,.5);run.touchEnd('t');
  assert.equal(run.combo,0);assert.equal(run.multiplier,1);assert.equal(run.hits,1);
  assert.ok(events.some(e=>e.type==='chain-lost'&&e.reason==='burr'&&e.multiplier===3));
  // a treat in reach wins over a burr at the edge of reach
  clear(run);const treat=place(run,{kind:'bone',x:.5,y:.5}),burr=place(run,{kind:'burr',x:.5,y:.5});run.touchStart('t',.5,.5);assert.ok(treat.popped&&!burr.popped);
  // Spike's shell
  const spike=make({characterId:'spike'}).run;spike.combo=10;spike.multiplier=2;spike.comboTime=5;spike.charge=100;assert.equal(spike.power(),true);
  const before=spike.score,smashEvents=[];spike.onEvent=e=>{if(e.type==='smash')smashEvents.push(e);};place(spike,{kind:'burr'});spike.touchStart('t',.5,.5);
  assert.equal(spike.combo,11,'the chain survives and the smash is a link in it');assert.equal(spike.hits,0);assert.equal(spike.burrs,1);
  assert.equal(smashEvents.length,1);assert.equal(smashEvents[0].value,Math.round(60*spike.totalMultiplier),'a smash pays a treat-sized 60 times the stack the player already has');assert.equal(spike.score,before+smashEvents[0].value);
  // while the shell is up a drag rolls over burrs too; without it a drag still leaves them alone
  const roll=make({characterId:'spike'}).run;roll.charge=100;roll.power();const rb=place(roll,{kind:'burr',x:.5,y:.5});roll.touchStart('d',.1,.5);roll.touchMove('d',.9,.5);assert.ok(rb.popped,'the shell rolls over a burr on a drag');assert.equal(roll.hits,0);assert.equal(roll.smashed,1);
  const bare=make({characterId:'spike'}).run;const bb=place(bare,{kind:'burr',x:.5,y:.5});bare.touchStart('d',.1,.5);bare.touchMove('d',.9,.5);assert.ok(!bb.popped);
  // Griffin's bark and Mittens' pounce clear burrs without hurting either
  const dog=make({characterId:'griffin'}).run;dog.combo=7;dog.multiplier=2;dog.comboTime=5;dog.charge=100;place(dog,{kind:'burr',x:.2,y:.4});place(dog,{kind:'bone',x:.8,y:.4});dog.power();
  assert.ok(dog.entities.every(e=>e.popped),'the big bark pops everything on screen');assert.equal(dog.hits,0);assert.equal(dog.combo,8);
  const cat=make({characterId:'mittens'}).run;cat.charge=100;place(cat,{kind:'burr',x:.5,y:.4});place(cat,{kind:'bone',x:.52,y:.6});const far=place(cat,{kind:'bone',x:.95,y:.4});cat.power();
  assert.equal(cat.hits,0);assert.equal(cat.gold,1,'the panther turns the treat she lands on golden');assert.equal(cat.treats,3);assert.ok(!far.popped,'only the pounced column pops');
});

test('a sweep reports the whole path: a fast drag cannot skip a bubble',()=>{
  const {run}=make();const mid=place(run,{x:.5,y:.5,r:.05}),off=place(run,{x:.5,y:.2,r:.05});
  run.touchStart('s',.05,.5);const n=run.touchMove('s',.95,.5);
  assert.equal(n,1);assert.ok(mid.popped);assert.ok(!off.popped,'a bubble well off the path stays');
  assert.equal(run.touchMove('nobody',.5,.5),0);
});

test('every treat bubble is a thumb-sized target: at least 44 CSS px of reach',()=>{
  const {run}=make();run.setField(320,300); // a short landscape field
  const tiny=place(run,{x:.5,y:.5,r:.02});
  assert.ok(run.hitPx(tiny)>=44,`effective reach ${run.hitPx(tiny)} px`);assert.equal(BUBBLE_HIT.minRadius+BUBBLE_HIT.slop,44);
  // 40 px away from the centre of a small bubble on a 320 px wide field still pops it
  assert.equal(run.touchStart('t',.5+40/320,.5),1);
  const burr=place(run,{kind:'burr',x:.2,y:.5,r:.02});assert.ok(run.hitPx(burr)<run.hitPx(tiny),'burrs get no extra slop, so a thumb that misses a treat does not hit one');
});

test('a string of three or more pays a small flat bonus that no layer of the stack multiplies',()=>{
  const bonusFor=(boost)=>{
    const {run,events}=make({characterId:'kevin'});
    if(boost){run.combo=40;run.multiplier=5;run.feverTime=9;run.goldRushTime=9;run.comboTime=5;}
    for(const x of [.2,.35,.5,.65])place(run,{x,y:.5,r:.05});
    run.touchStart('s',.1,.5);run.touchMove('s',.9,.5);run.touchEnd('s');
    const strings=events.filter(e=>e.type==='string'),collects=events.filter(e=>e.type==='collect');
    assert.equal(collects.length,4);
    return {strings,gained:run.score-collects.reduce((sum,e)=>sum+e.value,0),total:run.totalMultiplier,run};
  };
  const plain=bonusFor(false),boosted=bonusFor(true);
  assert.deepEqual(plain.strings.map(e=>[e.count,e.bonus]),[[3,10],[4,15]]);
  assert.deepEqual(boosted.strings.map(e=>[e.count,e.bonus]),[[3,10],[4,15]],'identical at 20x: flat, not a multiplier');
  assert.equal(plain.gained,25);assert.equal(boosted.gained,25);assert.ok(boosted.total>plain.total);
  assert.equal(plain.run.strings,1);assert.equal(plain.run.bestString,4);assert.equal(plain.run.stringBonus,25);
  // two taps are not a string, and a pause in the drag ends it
  const {run,events}=make();for(const x of [.3,.6])place(run,{x,y:.5,r:.05});run.touchStart('a',.3,.5);run.touchEnd('a');run.touchStart('b',.6,.5);run.touchEnd('b');assert.equal(events.filter(e=>e.type==='string').length,0);
});

test('bubbles that float away cost nothing: no score, no hearts, no broken chain',()=>{
  const {run,events}=make({seed:21});play(run,30);
  assert.equal(run.score,0);assert.equal(run.hits,0);assert.equal(run.combo,0);assert.ok(run.escaped>20,'plenty floated away');
  assert.ok(events.filter(e=>e.type==='escape').length===run.escaped);
  assert.ok(!events.some(e=>['hit','chain-lost','miss'].includes(e.type)),'no punishing events at all');
  assert.equal(run.hearts,undefined,'there are no hearts to lose');
  // a chain being built is not broken by escapes: hold the window open, wait until bubbles really float away, and look
  const chain=make({seed:21});chain.run.combo=7;chain.run.multiplier=2;chain.run.comboTime=40;
  for(let t=0;t<14&&!chain.run.escaped;t+=1/60){chain.run.update(1/60);chain.run.comboTime=40;}
  assert.ok(chain.run.escaped>0,'bubbles floated away during the check');
  assert.equal(chain.run.combo,7,'the chain holds while bubbles escape');assert.equal(chain.run.multiplier,2);assert.equal(chain.run.score,0);assert.equal(chain.run.hits,0);
  assert.ok(!chain.events.some(e=>e.type==='chain-lost'),'an escape never breaks the chain');
  // with nothing popped, the chain simply times out after its 5.4 s window
  const timing=make({seed:21});timing.run.combo=7;timing.run.multiplier=2;timing.run.comboTime=5.4;play(timing.run,5.2);assert.equal(timing.run.combo,7);play(timing.run,.4);assert.equal(timing.run.combo,0,'it times out after the 5.4 s window');
  assert.ok(timing.events.some(e=>e.type==='chain-lost'&&e.reason==='timeout'));
  // an idle run is not a win worth a bonus: the clean-run bonus needs ten pops
  const full=make({seed:21});play(full.run,46);assert.equal(full.run.mode,'won');assert.equal(full.run.score,0,'an untouched run earns nothing');
  const tidy=make({seed:21});for(let i=0;i<10;i++){clear(tidy.run);place(tidy.run,{x:.5,y:.5});tidy.run.touchStart('t',.5,.5);tidy.run.touchEnd('t');}
  const kept=tidy.run.score;play(tidy.run,46);assert.equal(tidy.run.hits,0);assert.equal(tidy.run.score,kept+150,'ten pops and no prickles earn the clean-run bonus');
  const short=make({seed:21});for(let i=0;i<9;i++){clear(short.run);place(short.run,{x:.5,y:.5});short.run.touchStart('t',.5,.5);short.run.touchEnd('t');}
  const kept9=short.run.score;play(short.run,46);assert.equal(short.run.score,kept9,'nine pops are not enough');
});

test('the finished run is a Snack Storm shaped summary the journey accepts exactly once',()=>{
  const {run}=make({seed:31,characterId:'griffin'});
  for(let t=0;t<45;t+=1/30){run.update(1/30);for(const e of run.entities.slice())if(e.kind!=='burr'&&e.y<.8&&e.y>.2&&Math.round(t*30)%3===0)run.touchStart('p',e.x,e.y);}
  assert.equal(run.mode,'won');
  const summary={...run.result(),mode:'bubble',worldIndex:2},journey=new Journey();
  const before=journey.state.wallet,first=journey.completeRun(summary);
  assert.equal(first.ok,true);assert.equal(first.repeat,false);assert.ok(first.earnedTreats>=summary.treats,'treats pay out');
  assert.equal(journey.state.wallet,before+first.earnedTreats);
  const again=journey.completeRun(summary);assert.equal(again.repeat,true);assert.equal(again.earnedTreats,0);assert.equal(journey.state.wallet,before+first.earnedTreats,'a second call with the same runId gives nothing more');
  assert.equal(journey.state.records.bubble.runs,1);assert.equal(journey.state.records.bubble.wins,1);assert.equal(journey.state.records.bubble.score,summary.score);
  assert.ok(journey.state.passport.stickers.includes('mode-bubble'));
  assert.equal(journey.state.records.snack.runs,0,'it does not borrow the Snack Storm record');
  // counters that quests read are shared, so Bubble Pop moves the generic quests (but not the snack-only one)
  assert.equal(journey.state.counters.treats,summary.treats);
  const q=id=>journey.state.quests[id].progress;assert.ok(q('canyon-gold')>=0&&q('redwood-snack-storm')===0);
});

test('an older save with no bubble data loads cleanly and gains an empty record',()=>{
  const fresh=new Journey().serialize();
  const old=JSON.parse(JSON.stringify(fresh));delete old.records.bubble;
  for(const day of ['2026-01-02'])old.daily.history[day]={score:5,mode:'rally',worldIndex:1,levelId:null,bonusClaimed:true};
  old.passport.stickers=old.passport.stickers.filter(id=>id!=='mode-bubble');
  const journey=new Journey(JSON.stringify(old));
  assert.deepEqual(journey.state.records.bubble,{score:0,distance:0,bestCombo:0,bestMultiplier:1,runs:0,wins:0,bestTime:null});
  assert.equal(journey.state.daily.history['2026-01-02'].mode,'rally');
  for(const mode of MODES)assert.ok(journey.state.records[mode]);
  assert.equal(SAVE_KEY,'doodle-onward-journey-v1','the save key did not change');
  // the unknown mode in a save from a newer build is repaired rather than trusted
  const odd=JSON.parse(JSON.stringify(fresh));odd.daily.history['2026-01-03']={mode:'nope',worldIndex:0};assert.equal(new Journey(JSON.stringify(odd)).state.daily.history['2026-01-03'].mode,'platform');
  // and the old five-mode records round trip untouched
  const played=new Journey();played.completeRun({runId:'snack-x',mode:'snack',worldIndex:0,won:true,score:900,treats:20,bestCombo:12,bestMultiplier:5});
  const reloaded=new Journey(JSON.stringify(played.serialize()));assert.equal(reloaded.state.records.snack.score,900);assert.equal(reloaded.state.records.bubble.runs,0);
});

test('the daily adventure rotation is exactly what it was: Bubble Pop is not part of it',()=>{
  const journey=new Journey(),seen=new Set();
  for(let day=1;day<=400;day++){const date=`2027-${String(1+(day%12)).padStart(2,'0')}-${String(1+(day%27)).padStart(2,'0')}`,daily=journey.getDailyChallenge(date);seen.add(daily.mode);assert.notEqual(daily.mode,'bubble');}
  assert.deepEqual([...seen].sort(),['memory','platform','rally','scout','snack']);
  // These dates produced exactly these dailies before Bubble Pop existed (recorded from the release before this one).
  const before={'2026-03-14':'scout:1','2026-11-15':'memory:2','2027-01-01':'rally:0','2025-07-04':'snack:3','2026-12-25':'snack:3','2026-02-09':'platform:0'};
  for(const [date,expected] of Object.entries(before)){const d=journey.getDailyChallenge(date);assert.equal(`${d.mode}:${d.worldIndex}`,expected,date);}
  // a bubble run can never be mistaken for the daily
  const cfg=journey.getRunConfig({mode:'bubble',worldIndex:1});assert.equal(cfg.mode,'bubble');assert.equal(cfg.dailyDate,null);assert.equal(cfg.levelId,null);
});

test('worlds each add one twist, and the twists only change what is seen, never the layers of the stack',()=>{
  assert.deepEqual([...BUBBLE_TWISTS],['wobble','breeze','columns','glow','bloom']);
  const columns=make({seed:4,worldIndex:2}).run;play(columns,20);assert.ok(columns.spawnLog.every(s=>BUBBLE_COLUMNS.includes(s.x)),'canyon bubbles rise in five columns');
  const wobble=make({seed:4,worldIndex:0}).run;play(wobble,6);const lean=wobble.entities.map(e=>Math.abs(e.x-e.baseX));assert.ok(Math.max(...lean)>.005,'river bubbles wobble');
  const breeze=make({seed:4,worldIndex:1}).run;play(breeze,8);assert.ok(Math.abs(breeze.wind)>0);
  const mesa=make({seed:4,worldIndex:3}).run;play(mesa,45);assert.ok(mesa.splits>0,'Starlight Mesa bubbles split as they climb');
  // splitting really happens to a bubble left alone, and the children are small bonus bubbles
  const split=make({seed:4,worldIndex:3}).run;place(split,{y:.56});split.entities[0].splits=true;split.entities[0].vy=.2;play(split,.3);
  assert.equal(split.splits,1);assert.equal(split.entities.filter(e=>e.bonus&&e.kind==='bone').length,2);
  // a bluebonnet bursts into two small bonus bubbles
  const bloom=make({seed:4,worldIndex:4}).run;const flower=place(bloom,{y:.5});flower.bloom=true;flower.vy=.2;bloom.touchStart('b',.5,.5);
  assert.equal(bloom.entities.filter(e=>e.bonus).length,2);const kids=bloom.entities.filter(e=>e.bonus);assert.ok(Math.abs(kids[0].x-kids[1].x)>.1&&kids[0].vy!==kids[1].vy,'the little ones fan out instead of starting as one stack');assert.equal(bloom.bloomed,1);
  for(const [index,run] of [[0,wobble],[2,columns],[4,bloom]])assert.equal(run.totalMultiplier<=30,true,`world ${index}`);
});

test('the engine speaks the events the controller already understands, and uses no Math.random',()=>{
  const {run,events}=make({seed:8,characterId:'griffin'});
  for(let t=0;t<45;t+=1/60){run.update(1/60);for(const e of run.entities.slice())if(e.kind!=='burr'&&e.y<.8&&e.y>.3)run.touchStart('p',e.x,e.y);if(run.charge>=100)run.power();}
  const known=new Set(['start','pause','resume','won','section','charged','countdown','final-push','tick','finale','collect','string','burr','smash','escape','chain-lost','combo','stack','fever','fever-end','gold-rush','gold-rush-end','power','power-end','bark','summon','pounce','split','bloom']);
  for(const e of events)assert.ok(known.has(e.type),`unexpected event ${e.type}`);
  const types=new Set(events.map(e=>e.type));for(const need of ['collect','combo','power','bark','stack','tick','final-push','won','section','countdown','fever','gold-rush','charged'])assert.ok(types.has(need),`${need} was emitted`);
  assert.deepEqual(events.filter(e=>e.type==='countdown').map(e=>e.count),[3,2,1,0]);
  const won=events.find(e=>e.type==='won');assert.equal(won.result.mode,'bubble');assert.equal(won.result.won,true);
  for(const field of ['runId','score','treats','gold','bestCombo','bestMultiplier','powersUsed','time','seed','characterId'])assert.ok(field in won.result,field);
  assert.doesNotMatch(readFileSync(new URL('../dist/bubble-engine.js',import.meta.url),'utf8'),/Math\.random/);
});

test('the keyboard can play: a marker moves, Space pops, and the power fires',()=>{
  const {run}=make({characterId:'spike'});place(run,{x:.5,y:.55});
  assert.equal(run.keyboard,false);run.interact();assert.equal(run.keyboard,true);assert.equal(run.treats,1,'the marker starts over the middle of the field');
  const bubble=place(run,{x:.8,y:.3});run.step(1,0);run.step(1,0);run.step(1,0);run.step(0,-1);run.step(0,-1);run.step(0,-1);
  run.move(1,0);play(run,.6);run.move(0,0);assert.ok(run.reticle.x>.6);
  run.reticle.x=.8;run.reticle.y=.3;assert.equal(run.interact(),true);assert.ok(bubble.popped);
  run.charge=100;assert.equal(run.power(),true);assert.equal(run.power(),false,'already running');
});

test('Reduced motion keeps bubbles rising but stops the sway and the breeze, without touching the schedule', ()=>{
  for(const [worldIndex,sway] of [[0,'wobble'],[1,'breeze']]){
    const calm=make({seed:4,worldIndex}).run,lively=make({seed:4,worldIndex}).run;calm.setReducedMotion(true);
    play(calm,8);play(lively,8);
    assert.equal(BUBBLE_TWISTS[worldIndex],sway);
    assert.ok(calm.entities.length>0&&calm.entities.every(e=>e.x===e.baseX),`${sway}: nothing sways when motion is reduced`);
    assert.ok(calm.entities.every(e=>e.vx===0||Math.abs(e.baseX-e.x)<1e-9));
    if(sway==='wobble')assert.ok(lively.entities.some(e=>Math.abs(e.x-e.baseX)>.005),'it does sway otherwise');
    assert.equal(calm.wind,0);assert.deepEqual(calm.spawnLog,lively.spawnLog,'same sky either way');
    assert.ok(calm.entities.every(e=>e.y<1.08),'they still rise');
  }
});

test('a landscape notch is respected: bubbles keep to the safe width and the schedule does not move',()=>{
  const wide=make({seed:6,worldIndex:1}).run,plain=make({seed:6,worldIndex:1}).run;wide.setField(844,260,59,47);
  play(wide,30);play(plain,30);
  assert.ok(wide.entities.length>0);for(const e of wide.entities){assert.ok(e.x*844>=59+29,`left ${e.x*844}`);assert.ok(e.x*844<=844-47-29,`right ${e.x*844}`);}
  assert.deepEqual(wide.spawnLog,plain.spawnLog);
});

test('the powers pay off without any of them overshadowing the others, and none changes a multiplier',()=>{
  // Pumpkin: three golden bubbles worth 50 points each (a Gold Rush still starts), not a 100 point jackpot.
  const pumpkin=make({characterId:'kevin'}).run;pumpkin.charge=100;pumpkin.power();
  const summoned=pumpkin.entities.filter(e=>e.summoned);assert.equal(summoned.length,3);
  const evs=[];pumpkin.onEvent=e=>{if(e.type==='collect')evs.push(e);};for(const e of summoned){e.y=.5;e.x=.5;}
  pumpkin.touchStart('s',.5,.5);assert.equal(evs[0].value,Math.round(50*pumpkin.totalMultiplier/(1)),'summoned gold uses the smaller 50 base value');assert.ok(pumpkin.goldRushTime>0);
  assert.equal(pumpkin.totalMultiplier,2,'only the Gold Rush layer is on');
  // Mittens' column pop never decreases the chain and never breaks it
  const cat=make({characterId:'mittens'}).run;cat.combo=5;cat.multiplier=1;cat.comboTime=5;cat.charge=100;for(const y of [.3,.5,.7])place(cat,{x:.5,y});cat.power();
  assert.equal(cat.combo,8);assert.equal(cat.gold,3);assert.ok(cat.totalMultiplier<=30);
  // none of them can reach past 30x: every character, everything on at once
  for(const id of ['griffin','kevin','mittens','spike']){const r=make({characterId:id}).run;r.multiplier=5;r.combo=40;r.feverTime=9;r.goldRushTime=9;r.charge=100;r.power();assert.ok(r.totalMultiplier<=30,id);}
});
