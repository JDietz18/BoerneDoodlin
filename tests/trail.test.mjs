import test from 'node:test';
import assert from 'node:assert/strict';
import { TrailGame, TRAIL_STOPS, canAfford, restoreTrailGame } from '../dist/trail.js';

test('Kevin remains selected when an existing campaign is restored', () => {
  const restored=restoreTrailGame(JSON.stringify({
    version:1,
    state:'camp',
    captain:'kevin',
    pack:'balanced',
    pace:'steady',
    resources:{fuel:80,snacks:80,morale:80,rig:80,budget:80},
    days:0,
    legIndex:0,
    score:0,
    supplyRunsUsed:[]
  }));
  assert.equal(restored.captain,'kevin');
  assert.equal(restored.captainName(),'Kevin');
  assert.equal(restored.beginSupplyRun().outing.captain,'kevin');
});

test('campaign can complete all seven legs without negative supplies', () => {
  const trail=new TrailGame();
  trail.reset({captain:'griffin',pack:'balanced'});
  while(!trail.status().arrived) {
    const departed=trail.depart();
    assert.equal(departed.ok,true,departed.message);
    const status=trail.status();
    const choice=status.pendingEvent.choices.find(item=>canAfford(status.resources,item.effects));
    assert.ok(choice,'at least one route choice stays affordable');
    const chosen=trail.chooseEvent(choice.id);
    assert.equal(chosen.ok,true,chosen.message);
    const continued=trail.continueEvent();
    assert.equal(continued.ok,true,continued.message);
    const resources=trail.status().resources;
    for(const value of Object.values(resources)) assert.ok(value>=0);
  }
  assert.equal(trail.status().currentStop.name,'Boerne');
  assert.equal(trail.status().route.length,TRAIL_STOPS.length);
  assert.ok(trail.status().score>0);
});

test('supply runs are one per stop and interrupted runs do not duplicate rewards', () => {
  const trail=new TrailGame();
  const started=trail.beginSupplyRun('spike');
  assert.equal(started.ok,true);
  const restored=restoreTrailGame(JSON.stringify(trail.serialize()));
  assert.equal(restored.status().state,'camp');
  assert.equal(restored.status().supplyRunAvailable,false);
  const retry=restored.beginSupplyRun('spike');
  assert.equal(retry.ok,false);
});

test('Spike supply run repairs the rig once', () => {
  const trail=new TrailGame();
  trail.rig=40;
  const started=trail.beginSupplyRun('spike');
  assert.equal(started.ok,true);
  const finished=trail.finishSupplyRun({won:true,treats:12,score:500,hearts:4,captainId:'spike'});
  assert.equal(finished.ok,true);
  assert.ok(trail.rig>40);
  assert.equal(trail.status().supplyRunAvailable,false);
});

test('Kevin brings back extra snacks once and can continue the RV trip', () => {
  const trail=new TrailGame();
  trail.reset({captain:'kevin'});
  trail.snacks=30;
  trail.beginSupplyRun();
  const finished=trail.finishSupplyRun({won:true,treats:12,score:500,hearts:3});
  assert.equal(finished.result.effects.snacks,26);
  assert.equal(trail.snacks,56);
  assert.match(finished.result.outcome,/Kevin.*RV/);
  assert.equal(trail.finishSupplyRun({won:true}).ok,false);
  assert.equal(trail.snacks,56);
  assert.equal(trail.depart().ok,true);
});
