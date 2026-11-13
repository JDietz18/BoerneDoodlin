import test from 'node:test';
import assert from 'node:assert/strict';
import { Journey, WORLDS, LEVELS, QUESTS, CHARMS, MODES, UPGRADES, SAVE_KEY, loadJourney, saveJourney } from '../dist/journey.js';

let sequence=0;
const result=(overrides={})=>({runId:`test-${++sequence}`,mode:'platform',levelId:'river-1',worldIndex:0,characterId:'griffin',won:true,score:1000,treats:20,gold:3,bestCombo:12,bestMultiplier:7.5,hits:0,stomps:2,secrets:1,blocks:3,checkpoints:2,time:120,...overrides});
const storageFor=entries=>{const values=new Map(Object.entries(entries||{}));return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
const arcade=(mode,worldIndex=0,overrides={})=>result({mode,levelId:null,worldIndex,gold:0,stomps:0,secrets:0,blocks:0,checkpoints:0,...overrides});
const clearWorld=(journey,worldIndex)=>{
  const worldLevels=LEVELS.filter(level=>level.worldIndex===worldIndex);
  let report;
  for(const index of [2,0,3,4])report=journey.completeRun(result({levelId:worldLevels[index].id,worldIndex,time:100}));
  return report;
};

test('the journey catalog has thirty named levels, twenty real-action quests and twelve supported charms',()=>{
  assert.equal(WORLDS.length,5);assert.equal(LEVELS.length,30);assert.equal(QUESTS.length,20);assert.equal(CHARMS.length,12);
  for(const world of WORLDS) {
    assert.equal(LEVELS.filter(level=>level.worldIndex===world.index).length,6);
    assert.equal(QUESTS.filter(quest=>quest.worldIndex===world.index).length,4);
  }
  assert.equal(new Set(QUESTS.map(quest=>quest.id)).size,20);
  const supported=new Set(['magnet','charge','heart','stompCharge','goldDuration','comboGrace','extraJump','stompBounce','secretMagnet','shieldStart','speed','powerDuration']);
  for(const charm of CHARMS)for(const key of Object.keys(charm.effects))assert.ok(supported.has(key),`${charm.id} has a supported effect`);
  const j=new Journey();
  assert.deepEqual(j.levelGoals('canyon-6').map(goal=>goal.target),[1,3,LEVELS.find(level=>level.id==='canyon-6').parTime]);
});

test('three levels open immediately, every distinct clear opens one more, and four clears open the next world',()=>{
  const j=new Journey();
  assert.deepEqual(LEVELS.filter(level=>j.state.levels[level.id].unlocked).map(level=>level.id),['river-1','river-2','river-3']);
  const first=j.completeRun(result({levelId:'river-3'}));assert.deepEqual(first.unlockedLevels,['river-4']);
  j.completeRun(result({levelId:'river-3'}));assert.equal(j.state.worlds[0].clears,1);
  assert.equal(j.state.levels['river-5'].unlocked,false);
  j.completeRun(result({levelId:'river-1'}));assert.equal(j.state.levels['river-5'].unlocked,true);
  j.completeRun(result({levelId:'river-4'}));assert.equal(j.state.levels['river-6'].unlocked,true);assert.equal(j.state.worlds[1].unlocked,false);
  const fourth=j.completeRun(result({levelId:'river-5'}));
  assert.equal(j.state.worlds[0].completed,true);assert.equal(j.state.worlds[0].clears,4);
  assert.equal(fourth.unlockedWorlds[0].id,'redwood');assert.equal(fourth.rewards.world,50);
  assert.deepEqual(fourth.unlockedLevels,['redwood-1','redwood-2','redwood-3']);
  assert.equal(j.state.levels['river-2'].completed,false,'World progression does not require every optional detour');
  assert.equal(j.selectWorld(1),true);assert.equal(j.selectWorld(4),false);
  assert.equal(j.completeRun(result({levelId:'boerne-1'})).ok,false);
});

test('all five worlds are playable by progress alone and all thirty levels can earn their medals',()=>{
  let j=new Journey();
  for(const world of WORLDS) {
    assert.equal(j.state.worlds[world.index].unlocked,true);
    clearWorld(j,world.index);
    j=new Journey(JSON.stringify(j.serialize()));
  }
  assert.ok(j.state.worlds.every(world=>world.completed));
  assert.ok(j.state.passport.achievements.includes('family-home'));
  for(const level of LEVELS)if(!j.state.levels[level.id].completed)j.completeRun(result({levelId:level.id,time:100}));
  assert.equal(j.state.worlds.reduce((sum,world)=>sum+world.clears,0),30);
  assert.equal(j.state.worlds.reduce((sum,world)=>sum+world.medals,0),90);
  assert.ok(j.state.passport.achievements.includes('every-detour'));assert.ok(j.state.passport.achievements.includes('ninety-medals'));
  assert.equal(j.state.passport.stickers.filter(id=>id.startsWith('world-')).length,5);
  assert.equal(j.completeRun(result()).rewards.world,0,'Cleared worlds cannot pay their completion reward again');
});

test('medals accumulate by actual goal across retries, and time mastery uses the level metadata',()=>{
  const j=new Journey(),level=LEVELS[0];
  const first=j.completeRun(result({gold:0,hits:3,time:level.parTime+40}));
  assert.equal(first.medals,1);assert.equal(first.newMedals,1);assert.equal(first.rewards.firstClear,25);
  const golden=j.completeRun(result({gold:3,hits:3,time:level.parTime+40}));
  assert.equal(golden.medals,2);assert.equal(golden.newMedals,1);assert.equal(golden.rewards.firstClear,0);
  const clean=j.completeRun(result({gold:0,hits:0,time:level.parTime+40}));
  assert.equal(clean.medals,2);assert.equal(clean.newMedals,1);assert.equal(j.state.levels[level.id].medals,3);
  const speed=j.completeRun(result({levelId:'river-2',gold:0,hits:2,time:LEVELS[1].parTime}));
  assert.equal(speed.medalGoals.find(goal=>goal.id==='mastery').earned,true);
  const missingTime=j.completeRun(result({levelId:'river-3',gold:0,hits:2,time:0}));
  assert.equal(missingTime.medals,1,'A missing time cannot satisfy the timed medal');
  const failed=j.completeRun(result({levelId:'river-4',won:false,treats:14,gold:3,hits:0}));
  assert.equal(failed.medals,0);assert.equal(failed.newMedals,0);assert.ok(failed.earnedTreats>=14);
});

test('legacy v2 wallet, upgrades, settings, crew and records import exactly once while the original save remains intact',()=>{
  const old={version:2,wallet:487,selectedCharacter:'mittens',settings:{sound:true,assist:true,reducedMotion:true},upgrades:{magnet:2,charge:3,heart:1},records:{adventure:{score:9800,distance:640,bestCombo:34,bestMultiplier:7.5,runs:12,wins:8},snack:{score:7000,bestMultiplier:15,runs:3,wins:2},endless:{score:12345}},regions:{'boerne-bound':{completed:true,stars:3}},migration:{done:true,credit:90}};
  const original=JSON.stringify(old),storage=storageFor({'boerne-doodlin-adventure-v2':original});
  let j=loadJourney(storage);
  assert.equal(j.state.wallet,487);assert.deepEqual(j.state.upgrades,old.upgrades);assert.deepEqual(j.state.settings,old.settings);assert.equal(j.state.selectedCharacter,'mittens');
  assert.equal(j.state.records.platform.score,9800);assert.equal(j.state.records.platform.bestMultiplier,7.5);assert.equal(j.state.records.snack.score,7000);
  assert.deepEqual(j.state.legacy,old);assert.equal(j.state.legacy.records.endless.score,12345);
  assert.equal(j.state.worlds[4].unlocked,false);assert.equal(j.state.levels['river-1'].completed,false);
  assert.equal(j.state.counters.runs,0,'New journey actions are not fabricated from earlier runner games');
  assert.equal(storage.getItem('boerne-doodlin-adventure-v2'),original);assert.ok(storage.getItem(SAVE_KEY));
  j.state.wallet-=60;saveJourney(storage,j);storage.setItem('boerne-doodlin-adventure-v2',JSON.stringify({...old,wallet:999999}));
  j=loadJourney(storage);assert.equal(j.state.wallet,427);assert.equal(j.state.legacy.wallet,487);
  assert.equal(j.state.migration.imported,true);
});

test('a run cannot repeat currency, quest rewards, medals, stickers or charm unlocks after reload',()=>{
  let j=new Journey();const run=result({treats:60,stomps:6});
  const first=j.completeRun(run);assert.equal(first.questRewards.length,2);assert.ok(first.unlockedCharms.length>=2);
  const snapshot=j.serialize();j=new Journey(JSON.stringify(snapshot));
  const duplicate=j.completeRun(run);assert.equal(duplicate.ok,true);assert.equal(duplicate.repeat,true);assert.equal(duplicate.earnedTreats,0);
  assert.deepEqual(j.serialize(),snapshot);
  const independent=j.serialize();independent.wallet=0;assert.notEqual(j.state.wallet,0);
});

test('quests count only their real world and activity, keep progress through failure, and pay once',()=>{
  const j=new Journey();
  j.completeRun(arcade('snack',1,{pairs:8,treats:30,won:false}));
  assert.equal(j.state.quests['redwood-snack-storm'].progress,30);assert.equal(j.state.quests['redwood-matches'].progress,0);
  j.completeRun(arcade('memory',0,{pairs:8}));assert.equal(j.state.quests['redwood-matches'].progress,0);
  const matches=j.completeRun(arcade('memory',1,{pairs:8,mistakes:2}));
  assert.ok(matches.questRewards.some(quest=>quest.id==='redwood-matches'));
  const again=j.completeRun(arcade('memory',1,{pairs:8,mistakes:0}));assert.equal(again.questRewards.some(quest=>quest.id==='redwood-matches'),false);
  j.completeRun(arcade('snack',1,{treats:45}));assert.equal(j.state.quests['redwood-snack-storm'].completed,true);
  assert.equal(j.questProgress(1).length,4);assert.equal(j.questProgress().length,20);assert.deepEqual(j.questProgress(99),[]);
});

test('distinct levels and family members stay distinct; combo and multiplier quests use one-run maxima',()=>{
  const j=new Journey();
  j.completeRun(result());j.completeRun(result());assert.equal(j.state.quests['river-steady'].progress,1);
  j.completeRun(result({levelId:'river-2'}));assert.equal(j.state.quests['river-steady'].completed,true);
  j.completeRun(arcade('snack',3,{bestCombo:15}));j.completeRun(arcade('snack',3,{bestCombo:20}));
  assert.equal(j.state.quests['mesa-chain'].progress,20);
  j.completeRun(arcade('snack',3,{bestCombo:25}));assert.equal(j.state.quests['mesa-chain'].completed,true);
  j.completeRun(arcade('memory',3,{pairs:8,mistakes:0,won:true}));assert.equal(j.state.quests['mesa-memory'].completed,true);
  for(const id of ['griffin','griffin','kevin','mittens'])j.completeRun(arcade('snack',4,{characterId:id,bestMultiplier:7.5}));
  assert.equal(j.state.quests['boerne-family'].progress,3);assert.equal(j.state.quests['boerne-stack'].completed,false);
  j.completeRun(arcade('snack',4,{characterId:'spike',bestMultiplier:15}));
  assert.equal(j.state.quests['boerne-family'].completed,true);assert.equal(j.state.quests['boerne-stack'].completed,true);
  assert.ok(j.state.passport.achievements.includes('whole-crew'));
});

test('the perfect-memory quest requires a complete game with no mismatch, not perfectly found individual pairs',()=>{
  const j=new Journey();
  j.completeRun(arcade('memory',3,{won:false,pairs:8,mistakes:0,perfects:8}));
  assert.equal(j.state.quests['mesa-memory'].progress,0);assert.equal(j.state.counters.perfects,0);
  j.completeRun(arcade('memory',3,{won:true,pairs:10,mistakes:1,perfects:9}));
  assert.equal(j.state.quests['mesa-memory'].completed,false);assert.equal(j.state.counters.perfects,0);
  const finished=j.completeRun(arcade('memory',3,{won:true,pairs:10,mistakes:0,perfects:10}));
  assert.ok(finished.questRewards.some(quest=>quest.id==='mesa-memory'));assert.equal(j.state.counters.perfects,1);
});

test('earned charms produce the actual agreed engine effects and enforce a three-charm loadout',()=>{
  const j=new Journey();assert.equal(j.equipCharm('mittens-moonstep').ok,false);
  j.completeRun(result({treats:60,stomps:6}));j.completeRun(result({levelId:'river-2'}));
  j.completeRun(result({levelId:'river-3'}));j.completeRun(result({levelId:'river-4'}));
  assert.ok(j.state.charms.unlocked.includes('mittens-moonstep'));assert.ok(j.state.charms.unlocked.includes('picnic-ribbon'));assert.ok(j.state.charms.unlocked.includes('stomp-bell'));
  for(const id of ['mittens-moonstep','picnic-ribbon','stomp-bell'])assert.equal(j.equipCharm(id).ok,true);
  assert.equal(j.equipCharm('snack-tag').ok,false);
  let config=j.getRunConfig({mode:'platform',levelId:'river-1'});
  assert.deepEqual(config.charms,{extraJump:true,comboGrace:2,stompCharge:true});
  assert.equal(j.equipCharm('stomp-bell').equipped,false);assert.equal(j.equipCharm('snack-tag').ok,true);
  j.state.upgrades.magnet=3;config=j.getRunConfig({mode:'platform'});assert.equal(config.gear.magnet,3,'A charm cannot exceed the owned upgrade cap');
  j.state.upgrades.magnet=1;assert.equal(j.getRunConfig({mode:'rally'}).gear.magnet,2);
  const restored=new Journey(j.serialize());assert.deepEqual(restored.state.charms,j.state.charms);
  assert.equal(j.equipCharm('invented-charm').ok,false);
});

test('world, quest and medal conditions can unlock every charm without a purchase',()=>{
  const j=new Journey();
  for(const world of WORLDS)clearWorld(j,world.index);
  for(const world of WORLDS) {
    j.completeRun(arcade('scout',world.index,{treasures:10}));
    j.completeRun(arcade('memory',world.index,{pairs:8,mistakes:0}));
    j.completeRun(arcade('snack',world.index,{treats:150,gold:9,bestCombo:25,bestMultiplier:30}));
    j.completeRun(arcade('rally',world.index,{dodged:20,distance:3000}));
  }
  assert.ok(j.questProgress().filter(quest=>quest.completed).length>=8);
  assert.equal(j.state.charms.unlocked.length,12);assert.ok(j.state.passport.achievements.includes('full-stack'));
});

test('all arcade activities are available, keep separate records and do not bypass platform world gates',()=>{
  const j=new Journey(),before=j.serialize().worlds;
  for(const mode of ['scout','snack','memory','rally']) {
    const config=j.getRunConfig({mode,worldIndex:4});assert.equal(config.mode,mode);assert.equal(config.worldIndex,4);
    const report=j.completeRun(arcade(mode,4,{score:2500,bestMultiplier:7.5}));
    assert.equal(report.ok,true);assert.equal(report.medals,0);assert.equal(report.newMedals,0);assert.equal(report.rewards.firstClear,0);
    assert.equal(j.state.records[mode].score,2500);assert.equal(j.state.records[mode].bestMultiplier,7.5);
  }
  assert.deepEqual(j.state.worlds,before);assert.equal(j.state.records.platform.runs,0);
  j.completeRun(result());assert.ok(j.state.passport.achievements.includes('five-ways'));
});

test('normal geometry seeds stay deterministic; remix seeds change per attempt unless explicitly supplied',()=>{
  const j=new Journey();
  const first=j.getRunConfig({mode:'platform',levelId:'river-2'}),second=j.getRunConfig({mode:'platform',levelId:'river-2'});
  assert.equal(first.seed,second.seed);assert.equal(first.remix,false);
  assert.notEqual(j.getRunConfig({mode:'platform',remix:true}).seed,j.getRunConfig({mode:'platform',remix:true}).seed);
  const a=j.getRunConfig({mode:'platform',levelId:'river-2',remix:true,seed:735}),b=j.getRunConfig({mode:'platform',levelId:'river-2',remix:true,seed:735});
  assert.equal(a.seed,b.seed);assert.equal(a.remix,true);
  assert.equal(j.getRunConfig({mode:'platform',levelId:'boerne-6'}).levelId,'river-1','Locked story requests fall back to a playable level');
});

test('daily challenge is date-seeded and standardized, pays once, and can visit a locked world without opening it',()=>{
  let j=new Journey();j.state.upgrades={magnet:3,charge:3,heart:2};j.setSetting('assist',true);
  let challenge;
  for(let day=1;day<=100;day++){const candidate=j.getDailyChallenge(new Date(2026,10,day));if(candidate.mode==='platform'&&candidate.worldIndex>0){challenge=candidate;break;}}
  assert.ok(challenge);assert.deepEqual(j.getDailyChallenge(challenge.dailyDate),challenge);
  const config=j.getRunConfig({...challenge,mode:'snack',seed:123});
  assert.equal(config.mode,challenge.mode);assert.equal(config.seed,challenge.seed);assert.equal(config.remix,true);
  assert.equal(config.assist,false);assert.deepEqual(config.gear,{magnet:0,charge:0,heart:0});assert.deepEqual(config.charms,{});
  const beforeWorlds=j.serialize().worlds,beforeLevels=j.serialize().levels;
  const first=j.completeRun(result({...config,runId:'daily-first'}));
  assert.equal(first.ok,true);assert.equal(first.dailyBonus,80);assert.equal(first.newMedals,0);
  assert.deepEqual(j.state.worlds,beforeWorlds);assert.deepEqual(j.state.levels,beforeLevels);
  assert.equal(j.getDailyChallenge(challenge.dailyDate).claimed,true);
  j=new Journey(j.serialize());const second=j.completeRun(result({...config,runId:'daily-second',score:4000}));
  assert.equal(second.dailyBonus,0);assert.equal(j.getDailyChallenge(challenge.dailyDate).bestScore,4000);
  assert.equal(j.completeRun(result({...config,runId:'fake-daily',seed:1})).ok,false);
});

test('checkpoints are isolated, bounded, restored only for the matching normal level, and cleared on completion',()=>{
  let j=new Journey();const snapshot={levelId:'river-1',seed:123,checkpointId:'checkpoint-2',player:{x:850,y:480},taken:['e1','e2']};
  assert.equal(j.saveCheckpoint('river-1',snapshot),true);snapshot.player.x=9999;
  assert.equal(j.state.checkpoints['river-1'].player.x,850);
  assert.equal(j.saveCheckpoint('river-2',{levelId:'river-1'}),false);assert.equal(j.saveCheckpoint('boerne-1',{}),false);
  assert.equal(j.saveCheckpoint('river-2',{version:1,kind:'platform',config:{levelId:'river-1'}}),false,'Engine snapshots use config.levelId and must also match their slot');
  assert.equal(j.saveCheckpoint('river-1',{data:'x'.repeat(80_000)}),false);
  j=new Journey(j.serialize());const config=j.getRunConfig({mode:'platform',levelId:'river-1'});
  assert.equal(config.checkpoint.player.x,850);config.checkpoint.player.x=20;assert.equal(j.state.checkpoints['river-1'].player.x,850);
  assert.equal(j.getRunConfig({mode:'platform',levelId:'river-1',remix:true}).checkpoint,null);
  j.completeRun(result({won:false}));assert.ok(j.state.checkpoints['river-1']);
  j.completeRun(result());assert.equal(j.state.checkpoints['river-1'],undefined);
  assert.equal(j.clearCheckpoint('unknown'),false);
});

test('upgrade purchases preserve caps and balances while character/settings choices validate',()=>{
  const j=new Journey();assert.equal(j.purchaseUpgrade('magnet').ok,false);j.state.wallet=2000;let spent=0;
  for(const upgrade of UPGRADES){for(const cost of upgrade.costs){assert.equal(j.purchaseUpgrade(upgrade.id).ok,true);spent+=cost;}assert.equal(j.purchaseUpgrade(upgrade.id).ok,false);}
  assert.equal(j.state.wallet,2000-spent);assert.equal(j.purchaseUpgrade('unknown').ok,false);
  assert.equal(j.selectCharacter('kevin'),true);assert.equal(j.selectCharacter('unknown'),false);
  assert.equal(j.setSetting('sound',true),true);assert.equal(j.setSetting('sound','on'),false);assert.equal(j.setSetting('other',true),false);
  assert.equal(new Journey(j.serialize()).state.selectedCharacter,'kevin');
});

test('malformed saves, missing fields and unavailable storage recover without mutating invalid run results',()=>{
  for(const raw of ['bad','[]','null',undefined])assert.equal(new Journey(raw).state.worlds[0].unlocked,true);
  const j=new Journey({version:1,wallet:-100,selectedCharacter:'unknown',selectedWorld:99,upgrades:{heart:99},records:{snack:{bestMultiplier:7.5}},charms:{loadout:['missing','missing']},quests:{}});
  assert.equal(j.state.wallet,0);assert.equal(j.state.selectedWorld,0);assert.equal(j.state.upgrades.heart,2);assert.equal(j.state.records.snack.bestMultiplier,7.5);
  assert.deepEqual(j.state.charms.loadout,[]);assert.equal(j.questProgress().length,20);
  const before=j.serialize();assert.equal(j.completeRun(result({runId:''})).ok,false);assert.equal(j.completeRun(result({mode:'unknown'})).ok,false);assert.equal(j.completeRun(result({levelId:'unknown'})).ok,false);assert.deepEqual(j.serialize(),before);
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.doesNotThrow(()=>loadJourney(blocked));assert.equal(saveJourney(blocked,j),false);
});

test('recent receipts remain bounded and decimal stack records survive long-running play',()=>{
  let j=new Journey();
  for(let i=0;i<410;i++)j.completeRun(arcade('snack',0,{runId:`long-${i}`,bestMultiplier:7.5,score:i,treats:0,won:false}));
  assert.equal(j.state.processedRuns.length,384);assert.equal(j.state.records.snack.runs,410);
  j=new Journey(j.serialize());const before=j.state.wallet;
  assert.equal(j.completeRun(arcade('snack',0,{runId:'long-409',bestMultiplier:30})).repeat,true);
  assert.equal(j.state.wallet,before);assert.equal(j.state.records.snack.bestMultiplier,7.5);assert.equal(j.state.counters.bestMultiplier,7.5);
});

test('a daily or remix win leaves the ordinary checkpoint of the same level alone',()=>{
  for(let day=0;day<900;day++){
    const when=new Date(2026,10,1+day,12),date=`${when.getFullYear()}-${String(when.getMonth()+1).padStart(2,'0')}-${String(when.getDate()).padStart(2,'0')}`,j=new Journey(),daily=j.getDailyChallenge(date);
    if(daily.mode!=='platform'||!j.state.levels[daily.levelId].unlocked)continue;
    assert.equal(j.saveCheckpoint(daily.levelId,{version:1,kind:'platform',config:{levelId:daily.levelId}}),true);
    const report=j.completeRun({runId:`daily-${date}`,mode:'platform',levelId:daily.levelId,won:true,score:900,treats:10,gold:3,hits:0,time:60,seed:daily.seed,dailyDate:date,remix:true});
    assert.equal(report.ok,true);assert.equal(report.dailyBonus,80);
    assert.ok(j.state.checkpoints[daily.levelId],'the ordinary saved spot is still there after a daily win');
    return;
  }
  assert.fail('no unlocked platform daily found in the sampled dates');
});

test('a remix win keeps the ordinary checkpoint and an ordinary win still clears it',()=>{
  const j=new Journey();j.saveCheckpoint('river-1',{version:1,kind:'platform',config:{levelId:'river-1'}});
  j.completeRun({runId:'remix-1',mode:'platform',levelId:'river-1',won:true,score:500,treats:5,gold:1,hits:1,time:90,remix:true});
  assert.ok(j.state.checkpoints['river-1']);
  j.completeRun({runId:'plain-1',mode:'platform',levelId:'river-1',won:true,score:500,treats:5,gold:1,hits:1,time:90,remix:false});
  assert.equal(j.state.checkpoints['river-1'],undefined);
});

test('a new journey starts with music and sound on, and a saved choice to mute survives', () => {
  const j=new Journey();
  assert.equal(j.state.settings.sound,true);
  j.setSetting('sound',false);
  assert.equal(new Journey(JSON.parse(JSON.stringify(j.state))).state.settings.sound,false);
});
