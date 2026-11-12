import test from 'node:test';
import assert from 'node:assert/strict';
import { Progression, REGIONS, UPGRADES, SAVE_KEY, createSeededRandom, localDateKey, loadProgression, saveProgression } from '../dist/progression.js';

const storageFor = entries => {
  const values=new Map(Object.entries(entries||{}));
  return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
};
const result = (overrides={}) => ({runId:'run-1',mode:'adventure',stage:0,characterId:'griffin',won:true,score:1000,distance:550,treats:30,bestCombo:12,hits:1,dodged:10,powersUsed:2,hearts:2,time:55,gold:2,letters:4,...overrides});

test('adventure unlocks on completion; mastery remains optional and improvements pay once',()=>{
  const p=new Progression();
  assert.equal(p.isUnlocked(REGIONS[1].id),false);
  const first=p.completeRun(result({treats:0,hits:3,dodged:0,powersUsed:0}));
  assert.equal(first.stars,1);assert.equal(first.newStars,1);
  assert.equal(first.unlockedRegion.id,REGIONS[1].id);
  assert.equal(p.isUnlocked(REGIONS[1].id),true);
  const better=p.completeRun(result({runId:'run-2'}));
  assert.equal(better.stars,3);assert.equal(better.newStars,2);
  const replay=p.completeRun(result({runId:'run-3'}));
  assert.equal(replay.newStars,0);assert.equal(replay.rewards.firstClear,0);
  const failed=p.completeRun(result({runId:'run-4',stage:1,won:false,score:2500,treats:20}));
  assert.equal(failed.stars,0);assert.equal(failed.rewards.finish,0);
  assert.ok(failed.earnedTreats>=20,'An unsuccessful run still banks collected treats');
  assert.equal(p.isUnlocked(REGIONS[2].id),false);
  assert.equal(p.completeRun(result({runId:'skip',stage:4})).ok,false);
});

test('run reward, missions, unlock, and records are idempotent across save/reload',()=>{
  let p=new Progression();
  const first=p.completeRun(result());
  assert.equal(first.missionRewards.length,3);
  assert.equal(p.missionProgress().length,3);
  assert.ok(p.missionProgress().every(mission=>mission.progress===0),'Replacement missions do not consume the just-finished run');
  const saved=p.serialize();p=new Progression(JSON.stringify(saved));
  const duplicate=p.completeRun(result());
  assert.equal(duplicate.repeat,true);assert.equal(duplicate.earnedTreats,0);
  assert.deepEqual(p.serialize(),saved);
  const snapshot=p.serialize();snapshot.wallet=0;
  assert.notEqual(p.state.wallet,0,'Snapshots cannot mutate the live state');
});

test('legacy migration preserves original saves, selection and memories, and never reapplies credit',()=>{
  const campaign={version:1,legIndex:5,state:'outing',captain:'kevin',completed:false,score:3200,upgrades:{tires:2,pantry:1,battery:1},resources:{fuel:38,snacks:50}};
  const journal={badges:['first-outing','desert'],postcards:[{leg:3,stars:3}],arcadeBest:2400,bestCombo:17,runs:9};
  const oldEntries={
    'boerne-doodlin-campaign-v1':JSON.stringify(campaign),'boerne-doodlin-journal-v1':JSON.stringify(journal),
    'boerne-doodlin-trip-best':'3600','boerne-doodlin-character':'mittens','boerne-doodlin-sound':'on'
  };
  const storage=storageFor(oldEntries);let p=loadProgression(storage);
  assert.equal(p.state.selectedCharacter,'mittens');assert.equal(p.state.settings.sound,true);
  assert.equal(p.state.unlocks.stage,3);assert.equal(p.state.migration.miles,1460);
  assert.deepEqual(p.state.legacy.campaign,campaign);assert.deepEqual(p.state.legacy.journal,journal);
  assert.deepEqual(p.state.records.legacy,{tripScore:3600,arcadeScore:2400,bestCombo:17});
  assert.equal(p.state.regions['rogue-river'].stars,0,'Legacy completion does not invent new mastery stars');
  assert.ok(p.state.wallet>0&&p.state.wallet<=150);
  for(const [key,value] of Object.entries(oldEntries)) assert.equal(storage.getItem(key),value);
  const wallet=p.state.wallet;p.state.wallet-=10;saveProgression(storage,p);
  storage.setItem('boerne-doodlin-campaign-v1',JSON.stringify({...campaign,completed:true}));
  p=loadProgression(storage);assert.equal(p.state.wallet,wallet-10);assert.equal(p.state.unlocks.stage,3);
  assert.ok(storage.getItem(SAVE_KEY),'Migration is persisted immediately');
  const home=new Progression(null,{campaign:{...campaign,completed:true}});
  assert.equal(home.state.unlocks.stage,4);assert.equal(home.state.unlocks.home,true);
});

test('daily route is deterministic by local date and ignores owned gear and assist',()=>{
  const p=new Progression();p.state.upgrades={magnet:3,charge:3,heart:2};p.setSetting('assist',true);
  const a=p.getRunConfig({mode:'daily',date:new Date(2026,10,12,0,3),characterId:'kevin'});
  const b=p.getRunConfig({mode:'daily',date:'2026-11-12',characterId:'griffin'});
  const tomorrow=p.getRunConfig({mode:'daily',date:'2026-11-13'});
  assert.equal(localDateKey(new Date(2026,10,12,23,59)),'2026-11-12');
  assert.equal(a.seed,b.seed);assert.equal(a.stage,b.stage);assert.equal(a.dailyDate,'2026-11-12');
  assert.notEqual(a.seed,tomorrow.seed);assert.deepEqual(a.gear,{magnet:0,charge:0,heart:0});assert.equal(a.assist,false);
  const rngA=createSeededRandom(a.seed),rngB=createSeededRandom(b.seed);
  assert.deepEqual(Array.from({length:30},rngA),Array.from({length:30},rngB));
  const normal=p.getRunConfig({mode:'adventure'});assert.deepEqual(normal.gear,p.state.upgrades);assert.equal(normal.assist,true);
  normal.gear.heart=0;assert.equal(p.state.upgrades.heart,2);
});

test('daily completion bonus is once per day and daily records stay separate from story unlocks',()=>{
  let p=new Progression();
  const config=p.getRunConfig({mode:'daily',date:'2026-11-12'});
  const daily=result({...config,runId:'daily-one'});
  const first=p.completeRun(daily);assert.equal(first.rewards.daily,60);assert.equal(first.newBest,true);
  assert.equal(p.state.unlocks.stage,0);
  p=new Progression(p.serialize());
  const second=p.completeRun({...daily,runId:'daily-two',score:1500});
  assert.equal(second.rewards.daily,0);assert.equal(second.newBest,true);
  const third=p.completeRun({...daily,runId:'daily-three',score:900});
  assert.equal(third.newBest,false);assert.equal(p.state.records.dailyByDate['2026-11-12'].score,1500);
  const next=p.getRunConfig({mode:'daily',date:'2026-11-13'});
  assert.equal(p.completeRun(result({...next,runId:'next-day'})).rewards.daily,60);
  assert.equal(p.completeRun({...daily,runId:'bad-date',dailyDate:'2026-02-31'}).ok,false);
});

test('upgrades charge once, enforce caps, persist and never spend more than the wallet',()=>{
  let p=new Progression();
  assert.equal(p.purchaseUpgrade('magnet').ok,false);assert.equal(p.state.wallet,0);
  p.state.wallet=2000;let total=0;
  for(const upgrade of UPGRADES) {
    for(const cost of upgrade.costs) {const bought=p.purchaseUpgrade(upgrade.id);assert.equal(bought.ok,true);assert.equal(bought.cost,cost);total+=cost;}
    assert.equal(p.purchaseUpgrade(upgrade.id).ok,false);
  }
  assert.equal(p.state.wallet,2000-total);
  p=new Progression(p.serialize());assert.deepEqual(p.state.upgrades,{magnet:3,charge:3,heart:2});
  assert.equal(p.purchaseUpgrade('invented').ok,false);
  assert.equal(p.selectCharacter('spike'),true);assert.equal(p.selectCharacter('unknown'),false);
  assert.equal(p.setSetting('sound',true),true);assert.equal(p.setSetting('sound','true'),false);
});

test('three automatic missions advance over runs including distinct crew, then persist safely',()=>{
  const p=new Progression();p.completeRun(result());
  assert.deepEqual(p.missionProgress().map(item=>item.metric),['gold','letters','crew']);
  p.completeRun(result({runId:'two',characterId:'griffin',gold:4,letters:7}));
  assert.equal(p.missionProgress().find(item=>item.metric==='crew').progress,1);
  p.completeRun(result({runId:'three',characterId:'griffin',gold:0,letters:0}));
  assert.equal(p.missionProgress().find(item=>item.metric==='crew').progress,1);
  p.completeRun(result({runId:'four',characterId:'kevin',gold:0,letters:0}));
  const after=p.completeRun(result({runId:'five',characterId:'spike',gold:0,letters:0}));
  assert.ok(after.missionRewards.some(item=>item.name==='Family outing'));
  assert.equal(p.missionProgress().length,3);
  const restored=new Progression(JSON.stringify(p.serialize()));assert.deepEqual(restored.missionProgress(),p.missionProgress());
});

test('malformed saves and blocked storage recover without negative balances or exceptions',()=>{
  for(const raw of ['broken','null','[]',undefined]) assert.equal(new Progression(raw).state.wallet,0);
  const p=new Progression({version:2,wallet:-50,upgrades:{magnet:99,heart:-1},settings:{assist:'yes'},selectedCharacter:'nope',regions:{'rogue-river':{stars:99}},records:{dailyByDate:{'2026-02-31':{score:999}}}});
  assert.equal(p.state.wallet,0);assert.equal(p.state.upgrades.magnet,3);assert.equal(p.state.upgrades.heart,0);
  assert.equal(p.state.settings.assist,false);assert.equal(p.state.selectedCharacter,'griffin');
  assert.equal(p.state.regions['rogue-river'].stars,3);assert.deepEqual(p.state.records.dailyByDate,{});
  assert.equal(p.missionProgress().length,3);
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.doesNotThrow(()=>loadProgression(blocked));assert.equal(saveProgression(blocked,p),false);
  const before=p.serialize();assert.equal(p.completeRun(result({runId:''})).ok,false);assert.deepEqual(p.serialize(),before);
});

test('endless records, full-letter bonus and bounded receipt history survive repeated runs',()=>{
  let p=new Progression();
  const first=p.completeRun(result({mode:'endless',won:false,runId:'endless-one',distance:1200,letters:7}));
  assert.equal(first.letterBonus,true);assert.equal(first.rewards.letters,20);assert.equal(first.stars,0);
  assert.equal(p.state.records.endless.distance,1200);assert.equal(p.state.unlocks.stage,0);
  for(let i=0;i<300;i++) p.completeRun(result({mode:'endless',won:false,runId:`loop-${i}`,score:i,distance:i,treats:0,dodged:0,powersUsed:0,gold:0,letters:0}));
  assert.equal(p.state.processedRuns.length,256);
  p=new Progression(p.serialize());assert.equal(p.completeRun(result({mode:'endless',won:false,runId:'loop-299'})).repeat,true);
  assert.equal(p.state.records.endless.distance,1200);assert.ok(p.state.missions.completed.length<=96);
});

test('Snack Storm uses owned gear, banks rewards and missions, and cannot alter adventure mastery',()=>{
  let p=new Progression();
  p.state.upgrades={magnet:1,charge:2,heart:1};p.setSetting('assist',true);p.selectCharacter('spike');
  const config=p.getRunConfig({mode:'snack',regionId:'boerne-bound'});
  assert.equal(config.mode,'snack');assert.equal(config.stage,0);assert.equal(config.regionId,'rogue-river');
  assert.equal(config.characterId,'spike');assert.equal(config.assist,true);assert.deepEqual(config.gear,p.state.upgrades);assert.equal(config.dailyDate,null);
  const regions=p.serialize().regions,unlocks=p.serialize().unlocks;
  const first=p.completeRun(result({...config,runId:'snack-one',time:45,letters:7}));
  assert.equal(first.ok,true);assert.equal(first.newBest,true);assert.equal(first.stars,0);assert.equal(first.newStars,0);
  assert.equal(first.unlockedRegion,null);assert.equal(first.rewards.firstClear,0);assert.equal(first.rewards.mastery,0);
  assert.equal(first.rewards.finish,20);assert.equal(first.letterBonus,false);assert.equal(first.rewards.letters,0);
  assert.equal(first.missionRewards.length,3,'Catch results advance the ordinary mission counters');
  assert.ok(first.earnedTreats>30);assert.equal(p.state.wallet,first.earnedTreats);
  assert.deepEqual(p.state.regions,regions);assert.deepEqual(p.state.unlocks,unlocks);
  assert.equal(p.state.records.snack.score,1000);assert.equal(p.state.records.snack.runs,1);assert.equal(p.state.records.snack.wins,1);
  assert.equal(p.state.records.adventure.runs,0);assert.equal(p.state.counters.letters,0);
  const saved=p.serialize();p=new Progression(saved);
  assert.equal(p.completeRun(result({...config,runId:'snack-one'})).repeat,true);assert.deepEqual(p.serialize(),saved);
  const failed=p.completeRun(result({...config,runId:'snack-two',won:false,score:1500,treats:12,letters:0}));
  assert.equal(failed.newBest,true);assert.equal(failed.rewards.finish,0);assert.ok(failed.earnedTreats>=12);
  assert.equal(p.state.records.snack.score,1500);assert.equal(p.state.records.snack.wins,1);
});

test('v2 saves from before Snack Storm gain its record without resetting progress or repeating migration',()=>{
  const original=new Progression();original.completeRun(result());
  original.state.wallet=222;original.state.upgrades={magnet:2,charge:1,heart:1};original.selectCharacter('mittens');
  const oldSave=original.serialize();delete oldSave.records.snack;
  const storage=storageFor({[SAVE_KEY]:JSON.stringify(oldSave),'boerne-doodlin-campaign-v1':JSON.stringify({version:1,completed:true,upgrades:{tires:3,pantry:3,battery:3}})});
  let p=loadProgression(storage);
  assert.deepEqual(p.state.records.snack,{score:0,distance:0,bestCombo:0,bestMultiplier:1,runs:0,wins:0});
  assert.equal(p.state.wallet,222);assert.deepEqual(p.state.upgrades,oldSave.upgrades);assert.equal(p.state.selectedCharacter,'mittens');
  assert.deepEqual(p.state.regions,oldSave.regions);assert.deepEqual(p.state.missions,oldSave.missions);assert.deepEqual(p.state.migration,oldSave.migration);
  p.completeRun(result({mode:'snack',runId:'first-catch',score:1800,letters:0}));assert.equal(saveProgression(storage,p),true);
  p=loadProgression(storage);assert.equal(p.state.records.snack.score,1800);assert.equal(p.state.records.snack.runs,1);
  assert.equal(p.state.records.adventure.runs,1);
});

test('best multiplier preserves fractional stacks per mode and across runs, including older v2 saves',()=>{
  const original=new Progression();original.completeRun(result());
  const oldSave=original.serialize();delete oldSave.counters.bestMultiplier;
  for(const mode of ['adventure','endless','daily','snack']) delete oldSave.records[mode].bestMultiplier;
  let p=new Progression(oldSave);
  assert.equal(p.state.counters.bestMultiplier,1);assert.equal(p.state.records.adventure.bestMultiplier,1);
  const fraction=p.completeRun(result({runId:'fractional-stack',bestMultiplier:7.5}));
  assert.equal(fraction.bestMultiplier,7.5);assert.equal(p.state.records.adventure.bestMultiplier,7.5);assert.equal(p.state.counters.bestMultiplier,7.5);
  p.completeRun(result({runId:'small-stack',mode:'endless',won:false,bestMultiplier:1.5}));
  assert.equal(p.state.records.endless.bestMultiplier,1.5);assert.equal(p.state.counters.bestMultiplier,7.5);
  p.completeRun(result({runId:'big-stack',mode:'snack',bestMultiplier:15}));
  assert.equal(p.state.records.snack.bestMultiplier,15);assert.equal(p.state.counters.bestMultiplier,15);
  p=new Progression(p.serialize());assert.equal(p.state.records.adventure.bestMultiplier,7.5);
  assert.equal(p.completeRun(result({runId:'big-stack',mode:'snack',bestMultiplier:30})).repeat,true);
  assert.equal(p.state.counters.bestMultiplier,15,'Duplicate receipts cannot inflate multiplier records');
  const bounded=new Progression({version:2,records:{adventure:{bestMultiplier:999},endless:{bestMultiplier:-2},daily:{bestMultiplier:'7.5'}},counters:{bestMultiplier:null}});
  assert.equal(bounded.state.records.adventure.bestMultiplier,30);assert.equal(bounded.state.records.endless.bestMultiplier,1);
  assert.equal(bounded.state.records.daily.bestMultiplier,7.5);assert.equal(bounded.state.counters.bestMultiplier,1);
});
