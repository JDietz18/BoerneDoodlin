import test from 'node:test';
import assert from 'node:assert/strict';
import { RoadGame } from '../dist/road.js';
import { SnackGame } from '../dist/engine.js';
import { CHARACTERS } from '../dist/characters.js';
import { TrailGame, canAfford, restoreTrailGame } from '../dist/trail.js';
import { Journal } from '../dist/journal.js';

function completeRoad(road) {
  for(let frame=0;frame<4000&&road.mode==='running';frame++) {
    const next=road.entities.find(item=>item.type!=='cone'&&!item.checked);
    if(next&&next.z<.6)road.steer(next.lane-road.lane);
    road.update(.0334);
  }
  assert.equal(road.mode,'won');
  return road.result();
}

function chooseAndContinue(trail) {
  const choice=trail.pendingEvent.choices.find(choice=>canAfford(trail.status().resources,choice.effects));
  assert.ok(choice,'An affordable story choice remains available');
  assert.equal(trail.chooseEvent(choice.id).ok,true);
  assert.equal(trail.continueEvent().ok,true);
}

test('all four captains can drive seven legs, restore every stop, and complete a scrapbook',()=>{
  for(const captain of Object.keys(CHARACTERS)) {
    let trail=new TrailGame();trail.reset({captain});
    const journal=new Journal();
    for(let leg=1;leg<=7;leg++) {
      const started=trail.beginDrive();assert.equal(started.ok,true);
      const road=new RoadGame({random:()=>.45});
      road.reset({leg:started.leg.index,captain,upgrades:started.upgrades});
      const result=completeRoad(road);
      assert.equal(result.hits,0,'Every road has a usable safe lane');
      assert.ok(result.fuel>0);assert.ok(result.souvenirs>0);
      const finished=trail.finishDrive(result);assert.equal(finished.ok,true);
      assert.equal(finished.report.stars,3);journal.road(finished.report);
      assert.equal(trail.finishDrive(result).ok,false,'Road rewards cannot be collected twice');
      trail=restoreTrailGame(JSON.stringify(trail.serialize()));
      assert.equal(trail.status().legIndex,leg);
      assert.equal(trail.state,'event','Reload preserves the pending road decision, including the final one');
      chooseAndContinue(trail);
      for(const amount of Object.values(trail.status().resources))assert.ok(amount>=0);
    }
    assert.equal(trail.status().currentStop.name,'Boerne');assert.equal(trail.completed,true);
    assert.equal(journal.postcards.length,7);assert.ok(journal.badges.includes('postcards'));
    assert.equal(trail.complete().bonus,0,'Homecoming bonus is paid only once');
  }
});

test('abandoning or reloading an RV drive restores the campsite with no charges or rewards',()=>{
  const trail=new TrailGame(),resources=trail.status().resources;
  assert.equal(trail.beginDrive().ok,true);
  assert.equal(trail.beginDrive().ok,false);
  const restored=restoreTrailGame(JSON.stringify(trail.serialize()));
  assert.equal(restored.state,'camp');assert.equal(restored.legIndex,0);
  assert.deepEqual(restored.status().resources,resources);assert.equal(restored.score,0);
  assert.equal(restored.finishDrive({score:500}).ok,false);
  assert.equal(restored.beginDrive().ok,true);
});

test('steering, braking, turbo, pause, collisions and arrival remain consistent',()=>{
  const events=[],road=new RoadGame({onEvent:event=>events.push(event.type)});
  road.reset();road.steer(1);road.steer(1);assert.equal(road.lane,1);
  road.steer(-1);road.entities=[{type:'cone',lane:0,z:.88,checked:false}];
  road.update(.01);assert.equal(road.hits,1);assert.equal(road.integrity,4);
  road.entities=[{type:'fuel',lane:0,z:.88,checked:false}];
  road.update(.01);assert.equal(road.fuel,1);
  road.brake(true);road.update(.01);assert.equal(road.speed,.54);
  road.pause();const distance=road.distance;road.update(.0334);
  assert.equal(road.distance,distance);assert.equal(road.braking,false);
  road.resume();road.charge=100;assert.equal(road.boost(),true);assert.equal(road.boost(),false);
  road.update(.01);assert.equal(road.speed,1.55);
  road.distance=road.goal-.001;road.update(.01);road.end();
  assert.equal(events.filter(type=>type==='won').length,1);
});

test('RV upgrades cost cash, survive reload, and cannot be refunded by repacking',()=>{
  const trail=new TrailGame(),budget=trail.budget;
  assert.equal(trail.upgrade('battery').ok,true);assert.equal(trail.budget,budget-20);
  const after=trail.budget;assert.equal(trail.selectPack('balanced').ok,false);assert.equal(trail.budget,after);
  const restored=restoreTrailGame(JSON.stringify(trail.serialize()));assert.equal(restored.upgrades.battery,1);
  const road=new RoadGame();road.reset({upgrades:restored.upgrades});assert.equal(road.charge,50);
  for(let i=0;i<2;i++){restored.budget=100;assert.equal(restored.upgrade('battery').ok,true);}
  assert.equal(restored.upgrade('battery').ok,false);assert.equal(restored.upgrade('toString').ok,false);
  restored.budget=0;assert.equal(restored.upgrade('tires').ok,false);
  restored.beginDrive();assert.equal(restored.upgrade('pantry').ok,false);
});

test('tires reduce bump damage and pantry levels increase returned snacks',()=>{
  const base=new TrailGame(),upgraded=new TrailGame();
  upgraded.upgrades.tires=3;upgraded.upgrades.pantry=2;
  for(const trail of [base,upgraded]){trail.beginDrive();trail.finishDrive({hits:2});chooseAndContinue(trail);trail.beginSupplyRun();}
  assert.equal(upgraded.rig-base.rig,6);
  const a=base.finishSupplyRun({won:true,treats:6,hearts:3});
  const b=upgraded.finishSupplyRun({won:true,treats:6,hearts:3});
  assert.equal(b.result.effects.snacks-a.result.effects.snacks,6);
});

function runner(id) {
  const game=new SnackGame();game.setCharacter(CHARACTERS[id].stats);game.reset();game.spawnIn=99;return game;
}
function snack(game,offset=0) {
  game.entities.push({type:'bone',x:game.player.x+offset,y:game.ground-60,w:54,h:54,taken:false});
  const before=game.score;game.update(.016);return game.score-before;
}

test('snack chains raise points, expire, and reset on an obstacle hit',()=>{
  const game=runner('griffin');
  for(let i=0;i<10;i++)snack(game);
  assert.equal(game.bestCombo,10);assert.equal(game.multiplier,3);
  game.entities.push({type:'log',x:game.player.x,y:game.ground,w:100,h:90,hit:false});game.update(.016);
  assert.equal(game.combo,0);assert.equal(game.multiplier,1);
  snack(game);assert.equal(game.combo,1);
  for(let i=0;i<110;i++)game.update(.0334);
  assert.equal(game.combo,0);assert.equal(game.bestCombo,10);
});

test('each character power has its promised distinct effect',()=>{
  const griffin=runner('griffin');assert.equal(snack(griffin),10);griffin.charge=100;griffin.zoom();assert.equal(snack(griffin),15);
  const kevin=runner('kevin');kevin.charge=100;kevin.zoom();assert.equal(snack(kevin,240),10);
  const other=runner('griffin');other.charge=100;other.zoom();assert.equal(snack(other,240),0);
  const mittens=runner('mittens');mittens.hearts=1;mittens.charge=100;mittens.zoom();assert.equal(mittens.hearts,2);
  const spike=runner('spike');spike.charge=100;spike.zoom();
  spike.entities.push({type:'log',x:spike.player.x,y:spike.ground,w:100,h:90,hit:false});spike.update(.016);
  assert.equal(spike.score,75);assert.equal(spike.hearts,4);
});

test('journal retains records and awards each family badge once',()=>{
  const journal=new Journal();
  for(const captain of Object.keys(CHARACTERS))journal.outing({captain,combo:12,score:400,arcade:true});
  assert.ok(journal.badges.includes('crew'));assert.equal(journal.earn('crew'),null);
  const restored=new Journal(JSON.stringify(journal.serialize()));
  assert.equal(restored.arcadeBest,400);assert.equal(restored.bestCombo,12);assert.equal(restored.runs,4);
  restored.outing({captain:'griffin',score:200,arcade:true});assert.equal(restored.arcadeBest,400);
  restored.road({leg:1,stars:3,hits:0});restored.road({leg:1,stars:1,hits:4});
  assert.equal(restored.postcards[0].stars,3);assert.equal(restored.postcards.length,1);
  assert.doesNotThrow(()=>new Journal('{invalid'));
  assert.doesNotThrow(()=>new Journal({badges:2,crew:{},postcards:[{leg:1,stars:10}]}));
});
