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
    walk(run,run.exit);assert.equal(run.interact(),false);assert.equal(run.mode,'running');
    for(const chest of run.entities.filter(e=>e.type==='chest')){walk(run,chest);assert.equal(run.interact(),true);const treasures=run.treasures;run.interact();assert.equal(run.treasures,treasures);}
    assert.equal(run.treasures,3);assert.equal(run.gold,3);assert.equal(run.parcel,true);
    walk(run,run.entities.find(e=>e.type==='npc'));assert.equal(run.interact(),true);assert.equal(run.deliveryDone,true);assert.equal(run.parcel,false);
    walk(run,run.entities.find(e=>e.type==='key'));assert.equal(run.keys,1);walk(run,run.exit);assert.equal(run.interact(),true);
    assert.equal(run.mode,'won');assert.equal(run.hits,0);assert.ok(run.steps>25);assert.equal(events.filter(e=>e.type==='won').length,1);
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
  assert.equal(restored.runId,run.runId);assert.equal(restored.parcel,true);assert.equal(restored.treasures,1);assert.equal(restored.hintsRemaining,2);assert.equal(restored.dailyDate,'2026-11-12');assert.deepEqual(restored.visited,run.visited);assert.equal(restored.entities.find(e=>e.id===chest.id).taken,true);
  walk(restored,restored.entities.find(e=>e.type==='npc'));restored.interact();assert.equal(restored.deliveryDone,true);assert.equal(restored.restore({version:7}),false);
});

test('scout treasure scoring uses the same real bonus multiplication',()=>{
  const run=new ScoutRun();run.reset();const position={x:1,y:1};for(let i=0;i<24;i++)run._snack('bone',position);run.charge=100;run.power();const before=run.score;run._snack('gold',position);
  assert.equal(run.totalMultiplier,30);assert.equal(run.score-before,3000);assert.equal(run.bestMultiplier,30);stepTime(run,8.1);assert.equal(run.totalMultiplier,1);assert.equal(run.result().bestMultiplier,30);
});
