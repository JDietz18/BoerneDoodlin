import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryGame } from '../dist/memory-game.js';

function advance(game,seconds){for(let elapsed=0;elapsed<seconds-1e-8;elapsed+=.1)game.update(Math.min(.1,seconds-elapsed));}
function game(options={}){const instance=new MemoryGame(null,options);instance.reset({seed:831});advance(instance,2);return instance;}
function pairIndices(instance,key){return instance.cards.flatMap((card,index)=>card.key===key?[index]:[]);}
function match(instance,key){const pair=pairIndices(instance,key);assert.equal(instance.flip(pair[0]),true);assert.equal(instance.flip(pair[1]),true);advance(instance,.4);}

test('seeded boards have exactly two of each symbol at the three intended sizes',()=>{
  for(let worldIndex=0;worldIndex<5;worldIndex++){
    const a=new MemoryGame(null).reset({worldIndex,seed:54321}),b=new MemoryGame(null).reset({worldIndex,seed:54321});
    assert.equal(a.totalPairs,[6,8,8,10,10][worldIndex]);assert.equal(a.cards.length,a.totalPairs*2);assert.deepEqual(a.cards,b.cards);
    const counts=new Map();for(const card of a.cards)counts.set(card.key,(counts.get(card.key)||0)+1);
    assert.ok([...counts.values()].every(count=>count===2));assert.notEqual(a.runId,b.runId);
  }
  const a=new MemoryGame(null).reset({seed:1}),b=new MemoryGame(null).reset({seed:2});assert.notDeepEqual(a.cards,b.cards);
});

test('reveal and mismatch use simulation time, block a third card, and freeze while paused',()=>{
  const g=new MemoryGame(null).reset();assert.equal(g.flip(0),false);advance(g,2);
  const other=g.cards.findIndex(card=>card.key!==g.cards[0].key);assert.equal(g.flip(0),true);assert.equal(g.flip(0),false);assert.equal(g.flip(other),true);
  assert.equal(g.flip((other+1)%g.cards.length),false);assert.equal(g.peek(),false);
  g.pause();const paused=g.result();advance(g,4);assert.deepEqual(g.result(),paused);assert.equal(g.cards[0].faceUp,true);
  g.resume();advance(g,.8);assert.equal(g.mistakes,1);assert.equal(g.combo,0);assert.equal(g.cards[0].faceUp,false);assert.equal(g.cards[other].faceUp,false);
});

test('matches award real streak bonuses, with perfect-pair credit only before a mistake involving that symbol',()=>{
  const events=[],g=game({onEvent:e=>events.push(e)}),keys=[...new Set(g.cards.map(c=>c.key))];
  match(g,keys[0]);assert.equal(g.score,60);assert.equal(g.treats,3);assert.equal(g.perfects,1);
  match(g,keys[1]);match(g,keys[2]);assert.equal(g.score,240);assert.equal(g.multiplier,2);assert.equal(g.combo,3);assert.equal(g.perfects,3);
  const first=pairIndices(g,keys[3])[0],second=pairIndices(g,keys[4])[0];g.flip(first);g.flip(second);advance(g,.8);
  assert.equal(g.combo,0);assert.equal(g.multiplier,1);match(g,keys[3]);assert.equal(g.perfects,3);assert.equal(g.treats,11);
  assert.equal(events.filter(e=>e.type==='match').length,4);assert.equal(events.filter(e=>e.type==='mismatch').length,1);
});

test('Peek is a limited help action; assist and charge gear help without contaminating daily boards',()=>{
  const g=new MemoryGame(null).reset({assist:true,gear:{charge:2}});assert.equal(g.timeLimit,150);assert.equal(g.hints,4);
  advance(g,3);assert.equal(g.peek(),true);assert.equal(g.hints,3);assert.equal(g.hintsUsed,1);assert.equal(g.peek(),false);assert.equal(g.flip(0),false);
  advance(g,2.1);assert.equal(g.flip(0),true);assert.equal(g.peek(),false);
  g.reset({dailyDate:'2026-11-12',assist:true,gear:{charge:3,magnet:3,heart:2},charms:{shieldStart:true}});
  assert.equal(g.timeLimit,90);assert.equal(g.hints,1);assert.equal(g.assist,false);assert.deepEqual(g.charms,{});assert.deepEqual(g.gear,{magnet:0,charge:0,heart:0});assert.equal(g.result().dailyDate,'2026-11-12');
});

test('a complete board ends once and gives a detached stable summary before a fresh attempt',()=>{
  const results=[],events=[],g=game({onFinish:r=>results.push(r),onEvent:e=>events.push(e)});
  for(const key of new Set(g.cards.map(c=>c.key)))match(g,key);
  assert.equal(g.mode,'won');assert.equal(g.pairs,6);assert.equal(g.perfects,6);assert.equal(g.bestCombo,6);assert.equal(results.length,1);
  assert.equal(events.filter(e=>e.type==='won').length,1);assert.ok(g.score>720);const summary=g.result();
  advance(g,100);assert.equal(g.flip(0),false);assert.equal(g.peek(),false);assert.deepEqual(g.result(),summary);assert.equal(results.length,1);
  const detached=g.result();detached.gear.charge=99;assert.equal(g.result().gear.charge,0);
  g.reset();assert.notEqual(g.runId,summary.runId);assert.equal(g.pairs,0);assert.equal(g.mode,'running');
});

test('time-out ends once, while destroying an abandoned board does not award completion',()=>{
  const results=[],g=game({onFinish:r=>results.push(r)});advance(g,95);assert.equal(g.mode,'lost');assert.equal(g.time,90);assert.equal(g.hearts,0);assert.equal(results.length,1);assert.equal(results[0].won,false);
  advance(g,20);assert.equal(results.length,1);g.destroy();g.destroy();assert.equal(results.length,1);
  const abandoned=[];const a=game({onFinish:r=>abandoned.push(r)});a.destroy();advance(a,100);assert.equal(a.mode,'destroyed');assert.equal(abandoned.length,0);
});
