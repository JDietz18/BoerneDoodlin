import test from 'node:test';
import assert from 'node:assert/strict';
import {ScoutRun,createScoutMap,scoutPath} from '../dist/scout-engine.js';

const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const stepTime=(run,seconds)=>{for(let t=0;t<seconds-1e-8&&run.mode==='running';t+=1/120)run.update(Math.min(1/120,seconds-t));};
function walk(run,target){
  const path=scoutPath(run.grid,run.player,target);assert.ok(path.length,'Target must have a walkable route');
  for(const cell of path.slice(1)){
    const hazard=run.entities.find(e=>e.type==='hazard'&&e.x===cell.x&&e.y===cell.y);
    while(hazard&&((run.time+hazard.phase)%2.8)<1.2)stepTime(run,.1);
    assert.equal(run.step(cell.x-run.player.x,cell.y-run.player.y),true);stepTime(run,.16);
  }
}

test('five seeded maze worlds have connected, reachable treasure, keys, NPC, and exits',()=>{
  for(let world=0;world<5;world++)for(const seed of [1,9,55]){
    const map=createScoutMap(world,seed);assert.equal(map.cols,world<2?11:13);assert.equal(map.rows,world<2?9:11);
    assert.equal(map.entities.filter(e=>e.type==='chest').length,3);assert.equal(map.entities.filter(e=>e.type==='chest'&&e.parcel).length,1);
    assert.ok(map.grid[0].every(v=>v===1));assert.ok(map.grid.at(-1).every(v=>v===1));
    for(const entity of map.entities)assert.ok(scoutPath(map.grid,map.start,entity).length,`world${world} seed${seed} ${entity.id} must be reachable`);
    for(let y=0;y<map.rows;y++)for(let x=0;x<map.cols;x++)if(map.grid[y][x]===0)assert.ok(scoutPath(map.grid,map.start,{x,y}).length);
    assert.deepEqual(map,createScoutMap(world,seed));
  }
  assert.notDeepEqual(createScoutMap(4,55).grid,createScoutMap(4,56).grid);
});

test('grid input moves immediately, repeats at a bounded pace, and respects walls without diagonals',()=>{
  const run=new ScoutRun();run.reset({seed:17});const [dx,dy]=DIRS.find(([x,y])=>run.grid[1+y]?.[1+x]===0);
  run.move(dx,dy);assert.equal(run.steps,1);run.update(.01);assert.equal(run.steps,1);const pos={x:run.player.x,y:run.player.y};stepTime(run,.1);assert.equal(run.steps,1);assert.deepEqual({x:run.player.x,y:run.player.y},pos);
  run.move(0,0);const oldSteps=run.steps;stepTime(run,1);assert.equal(run.steps,oldSteps);
  const wall=DIRS.find(([x,y])=>run.grid[run.player.y+y]?.[run.player.x+x]!==0);assert.equal(run.step(...wall),false);
  run.player.x=1;run.player.y=1;const before=run.steps;run.move(1,1);run.update(.01);assert.ok(run.steps-before<=1);assert.ok(Math.abs(run.player.x-1)+Math.abs(run.player.y-1)<=1);
});

test('press and release between frames moves once, and changed directions do not duplicate on update',()=>{
  const run=new ScoutRun();run.reset({seed:17});const [dx,dy]=DIRS.find(([x,y])=>run.grid[1+y]?.[1+x]===0);
  run.move(dx,dy);run.move(0,0);
  assert.equal(run.steps,1);assert.deepEqual({x:run.player.x,y:run.player.y},{x:1+dx,y:1+dy});
  run.update(.01);assert.equal(run.steps,1);
  run.move(-dx,-dy);assert.equal(run.steps,2);assert.deepEqual({x:run.player.x,y:run.player.y},{x:1,y:1});
  run.move(dx,dy);assert.equal(run.steps,3);run.update(.01);assert.equal(run.steps,3);
  run.move(dx,dy);assert.equal(run.steps,3,'Repeated held-state calls do not make extra taps');
  stepTime(run,.15);assert.equal(run.steps,4,'The held direction repeats once after the cooldown');
  run.move(0,0);const steps=run.steps;stepTime(run,.3);assert.equal(run.steps,steps);
});

test('all five scout quests can actually collect three chests, return the parcel, obtain the key, and exit',()=>{
  for(let worldIndex=0;worldIndex<5;worldIndex++){
    const events=[],run=new ScoutRun({onEvent:e=>events.push(e)});run.reset({worldIndex,seed:61+worldIndex});
    // Reaching the RV too early explains what is missing and keeps the outing going.
    walk(run,run.exit);assert.equal(run.mode,'running');assert.ok(events.some(e=>e.type==='locked'&&e.text));assert.equal(run.interact(),false);assert.equal(run.mode,'running');
    // Walking into a chest opens it: there is no interact button on a phone. It never pays twice.
    for(const chest of run.entities.filter(e=>e.type==='chest')){walk(run,chest);assert.equal(chest.opened,true);assert.equal(chest.taken,true);const treasures=run.treasures;run.interact();assert.equal(run.treasures,treasures);}
    assert.equal(run.treasures,3);assert.equal(run.gold,3);assert.equal(events.filter(e=>e.type==='chest').length,3);assert.equal(events.filter(e=>e.type==='parcel').length,1);
    assert.ok(run.parcel||run.deliveryDone,'The bundle is carried until a walk passes the neighbour');
    walk(run,run.entities.find(e=>e.type==='npc'));assert.equal(run.deliveryDone,true);assert.equal(run.parcel,false);assert.equal(events.filter(e=>e.type==='deliver').length,1);
    assert.equal(run.interact(),true,'The neighbour still chats when asked');assert.equal(events.filter(e=>e.type==='deliver').length,1);
    walk(run,run.entities.find(e=>e.type==='key'));assert.equal(run.keys,1);walk(run,run.exit);
    assert.equal(run.mode,'won','Walking into the RV with everything done heads onward');assert.equal(run.interact(),false);
    assert.equal(run.hits,0);assert.ok(run.steps>25);assert.equal(events.filter(e=>e.type==='won').length,1);
    const result=run.result();assert.equal(result.mode,'scout');assert.equal(result.worldIndex,worldIndex);assert.equal(result.treasures,3);assert.ok(result.won);assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
  }
});

test('three hint charges reveal legal paths toward an unfinished objective',()=>{
  const run=new ScoutRun();run.reset({seed:89});
  for(let i=0;i<3;i++){
    const hint=run.hint();assert.ok(hint);assert.equal(hint.remaining,2-i);assert.deepEqual(hint.path[0],{x:run.player.x,y:run.player.y});assert.ok(hint.path.every(p=>run.grid[p.y][p.x]===0));assert.ok(hint.path.every(p=>run.seen[p.y][p.x]));assert.equal(Math.abs(hint.dx)+Math.abs(hint.dy),1);
  }
  assert.equal(run.hint(),null);assert.equal(run.hintsRemaining,0);
});

test('timed mud damages only on dangerous entry and respects grace and shields',()=>{
  const run=new ScoutRun();run.reset({seed:17});const [dx,dy]=DIRS.find(([x,y])=>run.grid[1+y]?.[1+x]===0);run.entities=[{id:'test-mud',type:'hazard',x:1+dx,y:1+dy,phase:0,taken:false}];
  run.step(dx,dy);assert.equal(run.hearts,2);assert.equal(run.hits,1);run.step(-dx,-dy);run.step(dx,dy);assert.equal(run.hits,1);
  run.step(-dx,-dy);stepTime(run,2.9);run.shieldCharges=1;run.step(dx,dy);assert.equal(run.shieldCharges,0);assert.equal(run.hearts,2);
  run.step(-dx,-dy);stepTime(run,1.4);run.step(dx,dy);assert.equal(run.hearts,2,'An inactive puddle is safe');
});

test('pause freezes quest state, movement, hazards, and timers',()=>{
  const run=new ScoutRun();run.reset({seed:17});run.hint();run.move(1,0);stepTime(run,.2);run.pause();const state=JSON.stringify(run.snapshot());for(let i=0;i<100;i++)run.update(.1);assert.equal(JSON.stringify(run.snapshot()),state);
  const steps=run.steps;run.resume();stepTime(run,.3);assert.equal(run.steps,steps);
});

test('scout snapshots preserve the delivery quest, consumed hints, exploration, and receipt ID',()=>{
  const run=new ScoutRun();run.reset({worldIndex:2,seed:818,dailyDate:'2026-11-12'});run.hint();const chest=run.entities.find(e=>e.type==='chest'&&e.parcel);walk(run,chest);run.interact();
  const saved=JSON.parse(JSON.stringify(run.snapshot())),restored=new ScoutRun();assert.equal(restored.restore(saved),true);
  assert.equal(restored.runId,run.runId);assert.equal(restored.parcel,true);assert.ok(run.treasures>=1);assert.equal(restored.treasures,run.treasures);assert.equal(restored.hintsRemaining,2);assert.equal(restored.dailyDate,'2026-11-12');assert.deepEqual(restored.visited,run.visited);assert.equal(restored.entities.find(e=>e.id===chest.id).taken,true);
  for(const name of ['critters','trailTreats','trails','goldenPaw'])assert.equal(restored[name],run[name]);
  walk(restored,restored.entities.find(e=>e.type==='npc'));restored.interact();assert.equal(restored.deliveryDone,true);assert.equal(restored.restore({version:7}),false);
});

test('scout treasure scoring uses the same real bonus multiplication',()=>{
  const run=new ScoutRun();run.reset();const position={x:1,y:1};for(let i=0;i<24;i++)run._snack('bone',position);run.charge=100;run.power();const before=run.score;run._snack('gold',position);
  assert.equal(run.totalMultiplier,30);assert.equal(run.score-before,3000);assert.equal(run.bestMultiplier,30);stepTime(run,8.1);assert.equal(run.totalMultiplier,1);assert.equal(run.result().bestMultiplier,30);
});

// --- touch-first movement, arrival interactions, and bonus goals -------------

const collect=()=>{const events=[];return {events,run:new ScoutRun({onEvent:e=>events.push(e)}),of:type=>events.filter(e=>e.type===type)};};
const reveal=run=>{for(const row of run.seen)row.fill(true);};
const clearExtras=run=>{run.entities=run.entities.filter(e=>!['critter','hazard','bone','paw'].includes(e.type));};
// Only the RV stays, so nothing on the way interrupts a walk.
const emptyTrail=run=>{run.entities=run.entities.filter(e=>e.type==='exit');};
const mudIsActive=(run,e)=>((run.time+e.phase)%2.8)<1.2;
// The course fingerprints below were taken from the release 13 generator.
const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const course=map=>hash(JSON.stringify([map.cols,map.rows,map.grid,map.start,map.exit,map.entities.filter(e=>!['paw','critter'].includes(e.type))]));

test('bonus goals are seeded extras that leave the original course untouched',()=>{
  const original={'0:default':3776027748,'0:55':1924050122,'0:20261112':272660861,'1:default':3944203022,'1:55':2127554483,'1:20261112':763666724,'2:default':2752470453,'2:55':2757115779,'2:20261112':642919924,'3:default':3258491548,'3:55':2638482436,'3:20261112':428738965,'4:default':4108685066,'4:55':2726479134,'4:20261112':3393735871};
  for(const [key,print] of Object.entries(original)){const [world,seed]=key.split(':');assert.equal(course(createScoutMap(Number(world),seed==='default'?undefined:Number(seed))),print,`course ${key} must not move`);}
  let onTheWay=0;
  for(let world=0;world<5;world++)for(let seed=1;seed<=40;seed++){
    const map=createScoutMap(world,seed),paw=map.entities.filter(e=>e.type==='paw'),critter=map.entities.filter(e=>e.type==='critter'),others=map.entities.filter(e=>!['paw','critter'].includes(e.type));
    assert.equal(paw.length,1);assert.equal(critter.length,1);assert.ok(scoutPath(map.grid,map.start,paw[0]).length>=6,'The paw is a real detour');
    assert.ok(!others.some(e=>e.x===paw[0].x&&e.y===paw[0].y),'The paw has its own tile');
    if(others.filter(e=>['chest','key','npc','exit'].includes(e.type)).some(goal=>scoutPath(map.grid,map.start,goal).some(c=>c.x===paw[0].x&&c.y===paw[0].y)))onTheWay++;
    assert.ok(map.critterRoute.length>20);map.critterRoute.forEach((cell,i)=>{const next=map.critterRoute[(i+1)%map.critterRoute.length];assert.equal(map.grid[cell.y][cell.x],0);assert.ok(Math.abs(cell.x-next.x)+Math.abs(cell.y-next.y)<=1,'The butterfly never jumps');});
  }
  assert.ok(onTheWay<=20,`The paw is hidden off the quest's own routes in nearly every course (${onTheWay} of 200 are on the way)`);
});

test('interact still works from the next tile for keyboard and switch players',()=>{
  const {run,of}=collect();run.reset({seed:61});clearExtras(run);const chests=run.entities.filter(e=>e.type==='chest');
  // Pick a chest whose approach does not walk through another chest first.
  const chest=chests.find(chest=>!scoutPath(run.grid,run.player,chest).some(c=>chests.some(other=>other!==chest&&other.x===c.x&&other.y===c.y)));assert.ok(chest);
  const path=scoutPath(run.grid,run.player,chest),beside=path.at(-2);
  walk(run,beside);assert.equal(chest.opened,false);assert.equal(run.interaction.id,chest.id);assert.equal(run.interact(),true);assert.equal(chest.opened,true);assert.equal(of('chest').length,1);
  assert.deepEqual({x:run.player.x,y:run.player.y},beside,'Opening from beside the chest does not move the buddy');
});

test('passing the neighbour again is a wave, not a repeated conversation',()=>{
  const {run,of}=collect();run.reset({seed:61});clearExtras(run);const npc=run.entities.find(e=>e.type==='npc'),start={x:1,y:1};
  walk(run,npc);assert.equal(of('dialog').length,1,'The first meeting explains the quest');assert.equal(run.questStarted,true);
  walk(run,start);walk(run,npc);assert.equal(of('dialog').length,1);assert.equal(of('greet').length,1);assert.equal(of('greet')[0].name,npc.name);
  assert.equal(run.interact(),true);assert.equal(of('dialog').length,2,'Asking on purpose still gets an answer');
});

test('tap to walk takes the first step at once and then one step per move beat of simulation time',()=>{
  const {run,of}=collect();run.reset({seed:17});emptyTrail(run);reveal(run);
  const path=scoutPath(run.grid,run.player,run.exit);assert.ok(path.length>4);
  const goal=path[3];assert.equal(run.walkTo(goal.x,goal.y),true);
  assert.equal(run.steps,1,'The first step lands at input time');assert.deepEqual({x:run.player.x,y:run.player.y},path[1]);assert.equal(run.walking,true);assert.deepEqual(run.walkTarget,goal);
  assert.deepEqual(run.route,path.slice(2,4));assert.equal(of('walk').length,1);assert.equal(of('walk')[0].steps,3);
  stepTime(run,.1);assert.equal(run.steps,1,'No second step before the beat');stepTime(run,.1);assert.equal(run.steps,2);stepTime(run,.15);assert.equal(run.steps,3);
  assert.deepEqual({x:run.player.x,y:run.player.y},goal);assert.equal(run.walking,false);assert.equal(run.walkTarget,null);
  assert.deepEqual(of('walk-end').map(e=>e.reason),['arrived']);stepTime(run,1);assert.equal(run.steps,3);
  assert.ok(of('step').every(e=>e.auto===true&&Math.abs(e.dx)+Math.abs(e.dy)===1));
});

test('a walk is frozen by pause and replaced or cancelled by the player',()=>{
  const {run,of}=collect();run.reset({seed:17});emptyTrail(run);reveal(run);const far=scoutPath(run.grid,run.player,run.exit),goal=far[6];assert.ok(goal);
  run.walkTo(goal.x,goal.y);stepTime(run,.2);assert.equal(run.steps,2);
  run.move(0,0);stepTime(run,.15);assert.equal(run.steps,3,'Lifting a finger does not cancel the walk');
  // A manual step in any direction takes over at once.
  const back=far[2];run.step(back.x-run.player.x,back.y-run.player.y);assert.equal(run.walking,false);assert.deepEqual(of('walk-end').map(e=>e.reason),['manual']);
  const after=run.steps;stepTime(run,.6);assert.equal(run.steps,after);
  // Pause drops the route; nothing moves while paused or after resuming.
  run.walkTo(goal.x,goal.y);const walking=run.steps;run.pause();for(let i=0;i<50;i++)run.update(.1);assert.equal(run.steps,walking);run.resume();stepTime(run,.6);assert.equal(run.steps,walking);
  // A held direction also takes over, and a fresh tap replaces the old route.
  run.walkTo(goal.x,goal.y);run.walkTo(far[1].x,far[1].y);assert.deepEqual(run.walkTarget,far[1]);
  run.walkTo(goal.x,goal.y);const [dx,dy]=DIRS.find(([x,y])=>run.grid[run.player.y+y]?.[run.player.x+x]===0);run.move(dx,dy);assert.equal(run.walking,false);run.move(0,0);
});

test('tap to walk only uses places the buddy has seen, and a tap in the mist heads to the nearest known tile',()=>{
  const {run,of}=collect();run.reset({seed:17});clearExtras(run);
  const far=run.exit;assert.equal(run.seen[far.y][far.x],false);const before=Math.abs(far.x-1)+Math.abs(far.y-1);
  const known=run.seen.map(row=>[...row]);
  assert.equal(run.walkTo(far.x,far.y),true);assert.ok(run.route.every(c=>run.grid[c.y][c.x]===0));
  const end=run.walkTarget;assert.ok(Math.abs(far.x-end.x)+Math.abs(far.y-end.y)<before,'The walk ends nearer to the tap');
  assert.ok(known[end.y][end.x]&&[...run.route].every(c=>known[c.y][c.x]),'It stays inside what was seen from camp');
  stepTime(run,2);assert.deepEqual({x:run.player.x,y:run.player.y},end);
  // A hedge beside the path walks to the path next to it; a spot with no way closer is refused with a bump.
  run.reset({seed:17});clearExtras(run);const [dx,dy]=DIRS.find(([x,y])=>run.grid[1+y]?.[1+x]===0);
  assert.equal(run.walkTo(1-dx,1-dy),false,'A wall directly behind the buddy offers nowhere nearer');assert.equal(run.steps,0);
  assert.equal(run.walkTo(1,1),false,'A tap on the buddy with nothing in reach does nothing');assert.equal(run.walkTo(NaN,2),false);assert.equal(run.walkTo(99,99),run.walking);
});

test('tap to walk never steps into bubbling mud: it stops, or waits in Easygoing',()=>{
  for(const assist of [false,true]){
    const {run,of}=collect();run.reset({seed:17,assist});emptyTrail(run);reveal(run);const path=scoutPath(run.grid,run.player,run.exit),mudCell=path[2],goal=path[4];
    const mud={id:'test-mud',type:'hazard',x:mudCell.x,y:mudCell.y,phase:0,taken:false};run.entities.push(mud);
    assert.equal(mudIsActive(run,mud),true);run.walkTo(goal.x,goal.y);assert.equal(run.steps,1);stepTime(run,.5);
    assert.deepEqual({x:run.player.x,y:run.player.y},path[1],'The buddy holds one tile short of the mud');assert.equal(run.hits,0);
    if(!assist){assert.equal(run.walking,false);assert.deepEqual(of('walk-end').map(e=>e.reason),['hazard']);stepTime(run,3);assert.equal(run.steps,1);}
    else{assert.equal(run.walking,true);assert.equal(of('walk-wait').length,1);stepTime(run,1.2);assert.deepEqual({x:run.player.x,y:run.player.y},goal);assert.equal(run.hits,0);assert.deepEqual(of('walk-end').map(e=>e.reason),['arrived']);}
    assert.equal(run.hearts,run.maxHearts);
  }
});

test('mud warns before it bubbles, on simulation time only',()=>{
  const run=new ScoutRun();run.reset({seed:17});const mud={id:'test-mud',type:'hazard',x:1,y:1,phase:0,taken:false};run.entities=[mud];
  const states=[];for(let i=0;i<70;i++){stepTime(run,.05);states.push(mud.active?'A':mud.warn?'W':'-');}
  const line=states.join('');assert.match(line,/A+-+W+A+/,'calm, then a warning, then danger');
  assert.ok(Math.abs(line.match(/W+/)[0].length*.05-.6)<.11,'The warning lasts about six tenths of a second');
  run.pause();const frozen=`${mud.active}${mud.warn}`;for(let i=0;i<40;i++)run.update(.1);assert.equal(`${mud.active}${mud.warn}`,frozen);
});

test('the hidden golden paw shows itself only up close and starts a Gold Rush without counting as chest gold',()=>{
  const {run,of}=collect();run.reset({seed:61});const paw=run.entities.find(e=>e.type==='paw');run.entities=run.entities.filter(e=>!['critter','hazard'].includes(e.type));
  assert.equal(paw.revealed,false);const path=scoutPath(run.grid,run.player,paw);walk(run,path.at(-3));assert.equal(paw.revealed,false,'Two tiles away it is still hidden');
  walk(run,path.at(-2));assert.equal(paw.revealed,true);assert.equal(of('paw-reveal').length,1);assert.equal(run.goldenPaw,0);
  const gold=run.gold,treats=run.treats,score=run.score;
  walk(run,paw);assert.equal(paw.taken,true);assert.equal(run.goldenPaw,1);assert.equal(run.gold,gold,'Chest gold still means chest gold');assert.equal(run.treats,treats+5);
  assert.ok(run.goldRushTime>=4);assert.equal(of('paw').length,1);assert.equal(run.score-score,of('paw')[0].value);assert.equal(of('paw')[0].value,Math.round(150*run.totalMultiplier));
  assert.equal(run.result().goldenPaw,true);
  // Kevin's radar finds it from farther away.
  const kevin=new ScoutRun();kevin.reset({seed:61,characterId:'kevin'});const hidden=kevin.entities.find(e=>e.type==='paw');kevin.entities=kevin.entities.filter(e=>!['critter','hazard'].includes(e.type));
  const route=scoutPath(kevin.grid,kevin.player,hidden),spot=route.find(c=>{const d=Math.abs(c.x-hidden.x)+Math.abs(c.y-hidden.y);return d>=3&&d<=5;});assert.ok(spot);
  walk(kevin,spot);assert.equal(hidden.revealed,false);kevin.charge=100;assert.equal(kevin.power(),true);assert.equal(hidden.revealed,true);
});

test('the butterfly follows the clock, not the player, and each catch adds a link to the chain',()=>{
  const position=run=>{const e=run.entities.find(e=>e.type==='critter');return [e.x,e.y,Number(e.renderX.toFixed(4)),Number(e.renderY.toFixed(4))];};
  const still=new ScoutRun(),busy=new ScoutRun();still.reset({worldIndex:1,seed:404});busy.reset({worldIndex:1,seed:404});
  for(const run of [still,busy])run.entities=run.entities.filter(e=>!['hazard','bone','paw','chest','npc'].includes(e.type));
  // Move the busy run so it never meets the butterfly; both must still agree at every moment.
  for(let i=0;i<120;i++){const critter=busy.entities.find(e=>e.type==='critter'),[dx,dy]=DIRS.find(([x,y])=>busy.grid[busy.player.y+y]?.[busy.player.x+x]===0&&!(critter.x===busy.player.x+x&&critter.y===busy.player.y+y))||[0,0];if(i%3===0)busy.step(dx,dy);stepTime(still,.1);stepTime(busy,.1);if(busy.critters===0)assert.deepEqual(position(busy),position(still));}
  assert.ok(busy.steps>10);
  const {run,of}=collect();run.reset({worldIndex:1,seed:404});run.entities=run.entities.filter(e=>!['hazard','bone','paw','chest','npc','key','exit'].includes(e.type));reveal(run);
  const critter=run.entities.find(e=>e.type==='critter');let guard=0;
  for(let caught=1;caught<=3;caught++){
    while(run.critters<caught&&guard++<4000){if(!critter.hidden&&!run.walking)run.walkTo(critter.x,critter.y);stepTime(run,.05);}
    assert.equal(run.critters,caught);assert.equal(critter.hidden,true);assert.equal(run.combo%6,0);assert.ok(run.combo>=6);assert.equal(of('critter').at(-1).count,caught);assert.equal(of('critter').at(-1).left,3-caught);
    if(caught<3){const away=run.time;while(critter.hidden&&guard++<4000)stepTime(run,.05);assert.ok(run.time-away>=6.9,'It stays away for a while');assert.equal(of('critter-back').length,caught);}
  }
  assert.equal(run.multiplier,Math.min(5,1+Math.floor(run.combo/6)));assert.ok(run.bestCombo>=6);stepTime(run,12);assert.equal(critter.hidden,true,'Three catches and it has gone home');assert.equal(run.critters,3);
  assert.equal(run.result().critters,3);assert.ok(of('fever').length<=1);
});

test('a chest lays a short timed treat trail toward the next goal, and finishing it stretches the Gold Rush',()=>{
  const {run,of}=collect();run.reset({worldIndex:2,seed:818});run.entities=run.entities.filter(e=>!['critter','hazard','paw'].includes(e.type));
  const chest=run.entities.find(e=>e.type==='chest'&&e.parcel),npc=run.entities.find(e=>e.type==='npc');walk(run,chest);assert.equal(chest.opened,true);
  const laid=of('trail').at(-1),trail=run.entities.filter(e=>e.type==='trail'&&e.trail===chest.ordinal);assert.ok(laid);assert.equal(trail.length,laid.count);assert.ok(trail.length>=3&&trail.length<=6);
  const toNeighbour=scoutPath(run.grid,chest,npc);
  for(const treat of trail){assert.equal(run.grid[treat.y][treat.x],0);assert.ok(toNeighbour.some(c=>c.x===treat.x&&c.y===treat.y),'The trail points at the neighbour who wants the bundle');assert.ok(treat.expires>run.time+6);}
  assert.ok(!run.entities.some(e=>e.type!=='trail'&&!e.taken&&trail.some(t=>t.x===e.x&&t.y===e.y)),'Trail treats never sit on top of something else');
  const before={trails:run.trails,gold:run.goldRushTime,trailTreats:run.trailTreats,treats:run.treats};
  for(const treat of trail)walk(run,treat);
  assert.equal(run.trailTreats,before.trailTreats+trail.length);assert.ok(run.treats>=before.treats+trail.length);assert.equal(run.trails,before.trails+1);
  const done=of('trail-complete').at(-1);assert.ok(done&&done.value===Math.round(100*done.totalMultiplier));assert.ok(of('collect').some(e=>e.trail===chest.ordinal));
  assert.ok(run.goldRushTime>0,'The Gold Rush is still running after the dash');assert.ok(run.goldRushTime<=12);
  assert.equal(run.result().trails,run.trails);assert.equal(run.result().trailTreats,run.trailTreats);
});

test('an ignored treat trail fades on simulation time and pays nothing',()=>{
  const {run,of}=collect();run.reset({worldIndex:2,seed:818});run.entities=run.entities.filter(e=>!['critter','hazard','paw'].includes(e.type)&&!(e.type==='chest'&&!e.parcel));
  const chest=run.entities.find(e=>e.type==='chest'&&e.parcel);walk(run,chest);const trail=run.entities.filter(e=>e.type==='trail'&&e.trail===chest.ordinal);assert.ok(trail.length>=3);
  run.pause();for(let i=0;i<200;i++)run.update(.1);assert.ok(trail.every(e=>!e.taken),'Paused treats do not fade');run.resume();
  const score=run.score;stepTime(run,11);assert.ok(trail.every(e=>e.taken&&e.expired));assert.equal(of('trail-fade').length,trail.length);assert.equal(run.trails,0);assert.equal(run.trailTreats,0);assert.equal(run.score,score);
  assert.equal(of('trail-complete').length,0);
});

test('the result keeps every original field and only adds bonus-goal fields',()=>{
  const run=new ScoutRun();run.reset({worldIndex:3,seed:5,dailyDate:'2026-11-12'});const result=run.result();
  for(const key of ['runId','mode','state','worldIndex','stage','levelId','characterId','won','score','treats','gold','keys','treasures','secrets','chests','deliveryDone','steps','explored','hintsUsed','hits','hearts','maxHearts','bestCombo','bestMultiplier','stomps','blocks','checkpoints','powersUsed','time','distance','seed','assist','dailyDate','letters','dodged','nearMisses'])assert.ok(Object.hasOwn(result,key),`${key} is still reported`);
  assert.deepEqual({critters:result.critters,trailTreats:result.trailTreats,trails:result.trails,goldenPaw:result.goldenPaw},{critters:0,trailTreats:0,trails:0,goldenPaw:false});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
});

test('the bonus stack is still exactly 5 x 2 x 2 x 1.5 with every bonus goal in play',()=>{
  const run=new ScoutRun();run.reset({seed:61});const at={x:1,y:1};
  for(let i=0;i<40;i++)run._snack('bone',at);run.critters=0;run.entities.find(e=>e.type==='critter').x=1;run.entities.find(e=>e.type==='critter').y=1;run._meetCritter();
  run.charge=100;run.power();run._snack('gold',at);assert.equal(run.multiplier,5);assert.equal(run.totalMultiplier,30);assert.equal(run.bestMultiplier,30);
});

test('the buddy sees a little way around and straight down an open trail, never through hedges',()=>{
  for(const seed of [3,17,61,404]){
    const run=new ScoutRun();run.reset({worldIndex:2,seed});const p=run.player;
    for(let y=0;y<run.rows;y++)for(let x=0;x<run.cols;x++){
      const near=Math.abs(x-p.x)+Math.abs(y-p.y)<=2;let lined=false;
      // In line means: same row or column with open trail all the way, or a hedge directly beside or ending that line.
      for(const [dx,dy] of DIRS){let cx=p.x+dx,cy=p.y+dy;for(let n=0;n<6&&run.grid[cy]?.[cx]===0;n++,cx+=dx,cy+=dy)if(Math.abs(cx-x)*Math.abs(dy)+Math.abs(cy-y)*Math.abs(dx)<=1&&(dx?cx===x:cy===y))lined=true;if(cx===x&&cy===y)lined=true;}
      assert.equal(run.seen[y][x],near||lined,`seed ${seed} tile ${x},${y}`);
    }
  }
});

test('a walk that only passes the parked RV keeps going, and a walk to the RV asks what is missing',()=>{
  // Find a course where some tile lies beyond the RV, so a route can pass through it.
  let found=null;
  for(let seed=1;seed<400&&!found;seed++){const run=new ScoutRun();run.reset({seed});const beyond=DIRS.map(([dx,dy])=>({x:run.exit.x+dx,y:run.exit.y+dy})).filter(c=>run.grid[c.y]?.[c.x]===0);if(beyond.length>=2){const path=scoutPath(run.grid,run.player,run.exit),other=beyond.find(c=>!path.some(q=>q.x===c.x&&q.y===c.y));if(other&&scoutPath(run.grid,run.player,other).some(q=>q.x===run.exit.x&&q.y===run.exit.y))found={seed,other};}}
  assert.ok(found,'Some seeded course has a way through the RV tile');
  const {run,of}=collect();run.reset({seed:found.seed});emptyTrail(run);reveal(run);
  run.walkTo(found.other.x,found.other.y);stepTime(run,12);assert.deepEqual({x:run.player.x,y:run.player.y},found.other);assert.equal(of('locked').length,0,'Passing by is not asking');
  assert.deepEqual(of('walk-end').map(e=>e.reason),['arrived']);
  run.walkTo(run.exit.x,run.exit.y);stepTime(run,3);assert.deepEqual({x:run.player.x,y:run.player.y},run.exit);assert.equal(of('locked').length,1);assert.equal(run.mode,'running');
  // By hand, stepping onto the RV tile always asks.
  const [dx,dy]=DIRS.find(([x,y])=>run.grid[run.exit.y+y]?.[run.exit.x+x]===0);run.step(dx,dy);run.step(-dx,-dy);assert.equal(of('locked').length,2);
});
