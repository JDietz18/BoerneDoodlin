// Persistent progression for the adventure rebuild. The original campaign and
// journal keys remain untouched so the family's earlier journey is recoverable.
export const SAVE_KEY = 'boerne-doodlin-adventure-v2';
const VERSION = 2;
const CHARACTERS = ['griffin', 'kevin', 'mittens', 'spike'];
const MODES = ['adventure', 'endless', 'daily', 'snack'];
const MAX_RUN_IDS = 256;
const LIMIT = 1_000_000_000;

export const REGIONS = [
  {id:'rogue-river', index:0, name:'Rogue River', tagline:'One good boy. A very big adventure.', theme:'river', location:'Oregon', targetTreats:30, maxHits:1, storyMile:0},
  {id:'redwood-trail', index:1, name:'Redwood Trail', tagline:'Tall trees. Important smells.', theme:'redwoods', location:'California', targetTreats:35, maxHits:1, storyMile:180},
  {id:'painted-canyon', index:2, name:'Painted Canyon', tagline:'Take the scenic snack route.', theme:'canyon', location:'Arizona', targetTreats:40, maxHits:1, storyMile:800},
  {id:'starlight-mesa', index:3, name:'Starlight Mesa', tagline:'Kevin knows the way.', theme:'night', location:'New Mexico', targetTreats:45, maxHits:0, storyMile:1080},
  {id:'boerne-bound', index:4, name:'Boerne Bound', tagline:'A new yard. The whole family.', theme:'texas', location:'Texas', targetTreats:50, maxHits:0, storyMile:1740}
].map(region => ({
  ...region,
  goalDescription:`Reach the RV, collect ${region.targetTreats} treats, and ${region.maxHits ? 'take no more than one hit' : 'finish without a hit'}.`,
  goals:[
    {id:'finish', label:'Reach the RV', metric:'won', target:1},
    {id:'treats', label:`Collect ${region.targetTreats} treats`, metric:'treats', target:region.targetTreats},
    {id:'clean', label:region.maxHits ? 'One hit or fewer' : 'A clean run', metric:'hits', target:region.maxHits}
  ]
}));

export const UPGRADES = [
  {id:'magnet', name:'Snack magnet', description:'Pull nearby treats into your path.', maxLevel:3, costs:[60,120,200]},
  {id:'charge', name:'Extra zoom', description:'Charge your character power faster.', maxLevel:3, costs:[75,140,240]},
  {id:'heart', name:'Big heart', description:'Start each run with an extra heart per level.', maxLevel:2, costs:[150,300]}
];

// Three missions are active at a time. New missions start after a run, so one
// result cannot cash in an entire sequence of newly unlocked missions.
export const MISSIONS = [
  {id:'snack-stash', name:'Snack stash', metric:'treats', target:30, step:15, cap:120, reward:20, text:'Collect {target} treats.'},
  {id:'clear-path', name:'Happy landings', metric:'dodged', target:10, step:5, cap:40, reward:20, text:'Clear {target} obstacles.'},
  {id:'zoom-crew', name:'Born to zoom', metric:'powersUsed', target:2, step:1, cap:6, reward:25, text:'Use a character power {target} times.'},
  {id:'golden-snacks', name:'Golden opportunity', metric:'gold', target:4, step:2, cap:16, reward:25, text:'Find {target} golden treats.'},
  {id:'name-game', name:'The name game', metric:'letters', target:7, step:4, cap:28, reward:25, text:'Collect {target} letters.'},
  {id:'family-outing', name:'Family outing', metric:'crew', target:3, step:0, cap:3, reward:35, text:'Take {target} different family members on a run.'},
  {id:'snack-chain', name:'Snack symphony', metric:'bestCombo', target:12, step:3, cap:27, reward:30, text:'Build a chain of {target} treats in one run.'},
  {id:'homeward', name:'Happy campers', metric:'wins', target:2, step:1, cap:5, reward:30, text:'Reach the RV {target} times.'}
];

const number = (value, max=LIMIT) => {
  const n=Number(value);
  return Number.isFinite(n) ? Math.max(0,Math.min(max,Math.floor(n))) : 0;
};
const copy = value => JSON.parse(JSON.stringify(value));
const object = value => value && typeof value==='object' && !Array.isArray(value);
const character = id => CHARACTERS.includes(id) ? id : 'griffin';
const stackMultiplier = value => Number.isFinite(Number(value)) ? Math.max(1,Math.min(30,Number(value))) : 1;
const blankRecord = () => ({score:0,distance:0,bestCombo:0,bestMultiplier:1,runs:0,wins:0});
const record = raw => Object.fromEntries(Object.keys(blankRecord()).map(key=>[key,key==='bestMultiplier'?stackMultiplier(raw?.[key]):number(raw?.[key])]));

function parse(raw) {
  try {
    if(typeof raw==='string') return raw.length<500_000 ? JSON.parse(raw) : null;
    if(object(raw)) return copy(raw);
  } catch {}
  return null;
}

function validDateKey(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year,month,day]=value.split('-').map(Number);
  if(year<2000||year>9999) return false;
  const date=new Date(year,month-1,day,12);
  return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day;
}

export function localDateKey(input=new Date()) {
  if(validDateKey(input)) return input;
  let date=input instanceof Date ? input : new Date(input);
  if(!Number.isFinite(date.getTime())) date=new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function hash(value) {
  let seed=2166136261;
  for(const char of String(value)) seed=Math.imul(seed^char.charCodeAt(0),16777619);
  return seed>>>0;
}

export function createSeededRandom(seed) {
  let state=typeof seed==='number' ? seed>>>0 : hash(seed);
  return () => {
    state=(state+0x6D2B79F5)>>>0;
    let value=Math.imul(state^(state>>>15),1|state);
    value^=value+Math.imul(value^(value>>>7),61|value);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
}

function newMission(serial) {
  const index=number(serial,10_000_000),template=MISSIONS[index%MISSIONS.length],tier=Math.floor(index/MISSIONS.length);
  return {
    id:`${template.id}:${index}`,serial:index,templateId:template.id,tier,
    target:Math.min(template.cap,template.target+template.step*tier),
    reward:template.reward+Math.min(30,tier*5),progress:0,characters:[]
  };
}

function blankState() {
  return {
    version:VERSION,wallet:0,upgrades:{magnet:0,charge:0,heart:0},selectedCharacter:'griffin',
    settings:{sound:false,assist:false,reducedMotion:false},
    regions:Object.fromEntries(REGIONS.map(region=>[region.id,{unlocked:region.index===0,completed:false,imported:false,stars:0,bestScore:0,bestTreats:0,bestCombo:0,runs:0}])),
    unlocks:{stage:0,regions:[REGIONS[0].id],home:false},
    records:{adventure:blankRecord(),endless:blankRecord(),daily:blankRecord(),snack:blankRecord(),dailyByDate:{},legacy:{tripScore:0,arcadeScore:0,bestCombo:0}},
    counters:{runs:0,wins:0,treats:0,score:0,distance:0,bestCombo:0,bestMultiplier:1,hits:0,dodged:0,powersUsed:0,time:0,gold:0,letters:0,characters:Object.fromEntries(CHARACTERS.map(id=>[id,{runs:0,wins:0,bestScore:0}]))},
    missions:{active:[newMission(0),newMission(1),newMission(2)],completed:[],totalCompleted:0,nextIndex:3},
    processedRuns:[],
    migration:{done:true,legacyFound:false,credit:0,miles:0},
    legacy:{campaign:null,journal:null,tripBest:0,selectedCharacter:null}
  };
}

function syncUnlocks(state) {
  let highest=number(state.unlocks?.stage,REGIONS.length-1);
  for(const region of REGIONS) if(state.regions[region.id].unlocked) highest=Math.max(highest,region.index);
  state.unlocks={stage:highest,regions:REGIONS.slice(0,highest+1).map(region=>region.id),home:state.regions[REGIONS.at(-1).id].completed};
  for(const region of REGIONS) state.regions[region.id].unlocked=region.index<=highest;
}

function hydrate(raw) {
  const state=blankState();
  state.wallet=number(raw.wallet);
  for(const upgrade of UPGRADES) state.upgrades[upgrade.id]=number(raw.upgrades?.[upgrade.id],upgrade.maxLevel);
  state.selectedCharacter=character(raw.selectedCharacter);
  for(const key of Object.keys(state.settings)) state.settings[key]=raw.settings?.[key]===true;
  state.unlocks.stage=number(raw.unlocks?.stage,4);
  for(const region of REGIONS) {
    const saved=raw.regions?.[region.id],target=state.regions[region.id];
    for(const key of ['completed','imported']) target[key]=saved?.[key]===true;
    target.unlocked=region.index===0||saved?.unlocked===true||target.completed;
    target.stars=number(saved?.stars,3);
    for(const key of ['bestScore','bestTreats','bestCombo','runs']) target[key]=number(saved?.[key]);
    if(target.stars>0) target.completed=true;
    if(target.completed) state.unlocks.stage=Math.max(state.unlocks.stage,Math.min(4,region.index+1));
  }
  for(const mode of MODES) state.records[mode]=record(raw.records?.[mode]);
  const dates=object(raw.records?.dailyByDate) ? Object.keys(raw.records.dailyByDate).filter(validDateKey).sort().slice(-35) : [];
  for(const date of dates) {
    const saved=raw.records.dailyByDate[date];
    state.records.dailyByDate[date]={...record(saved),stars:number(saved?.stars,3),bonusClaimed:saved?.bonusClaimed===true};
  }
  for(const key of Object.keys(state.records.legacy)) state.records.legacy[key]=number(raw.records?.legacy?.[key]);
  for(const key of Object.keys(state.counters)) if(key!=='characters') state.counters[key]=key==='bestMultiplier'?stackMultiplier(raw.counters?.[key]):number(raw.counters?.[key]);
  for(const id of CHARACTERS) for(const key of ['runs','wins','bestScore']) state.counters.characters[id][key]=number(raw.counters?.characters?.[id]?.[key]);
  const used=new Set();
  state.missions.active=[];
  for(const saved of Array.isArray(raw.missions?.active) ? raw.missions.active.slice(0,3) : []) {
    if(!Number.isInteger(saved?.serial)||saved.serial<0||used.has(saved.serial)) continue;
    const mission=newMission(saved.serial);used.add(mission.serial);
    mission.characters=[...new Set((Array.isArray(saved.characters)?saved.characters:[]).filter(id=>CHARACTERS.includes(id)))];
    mission.progress=number(saved.progress,mission.target);
    if(MISSIONS[mission.serial%MISSIONS.length].metric==='crew') mission.progress=mission.characters.length;
    state.missions.active.push(mission);
  }
  state.missions.nextIndex=Math.max(number(raw.missions?.nextIndex,10_000_000),...state.missions.active.map(item=>item.serial+1),0);
  while(state.missions.active.length<3) state.missions.active.push(newMission(state.missions.nextIndex++));
  state.missions.completed=(Array.isArray(raw.missions?.completed)?raw.missions.completed:[]).filter(id=>typeof id==='string'&&id.length<100).slice(-96);
  state.missions.totalCompleted=Math.max(state.missions.completed.length,number(raw.missions?.totalCompleted));
  state.processedRuns=[...new Set((Array.isArray(raw.processedRuns)?raw.processedRuns:[]).filter(id=>typeof id==='string'&&id.length>0&&id.length<=160))].slice(-MAX_RUN_IDS);
  state.migration={done:true,legacyFound:raw.migration?.legacyFound===true,credit:number(raw.migration?.credit,150),miles:number(raw.migration?.miles,2050)};
  if(object(raw.legacy)) state.legacy={campaign:parse(raw.legacy.campaign),journal:parse(raw.legacy.journal),tripBest:number(raw.legacy.tripBest),selectedCharacter:CHARACTERS.includes(raw.legacy.selectedCharacter)?raw.legacy.selectedCharacter:null};
  syncUnlocks(state);
  return state;
}

function migrate(state,legacy={}) {
  const candidate=parse(legacy.campaign),campaign=candidate?.version===1 ? candidate : null;
  const journal=parse(legacy.journal);
  const tripBest=number(legacy.tripBest??legacy.best);
  const selected=legacy.selectedCharacter||legacy.character||campaign?.captain;
  const miles=campaign ? (campaign.completed||campaign.state==='arrived' ? 2050 : [0,180,510,800,1080,1460,1740,2050][number(campaign.legIndex,7)]) : 0;
  const oldUpgrades=campaign ? ['tires','pantry','battery'].reduce((total,key)=>total+number(campaign.upgrades?.[key],3),0) : 0;
  const credit=Math.min(150,Math.floor(miles/100)+oldUpgrades*8+(campaign?.completed?35:0));
  state.wallet=credit;
  state.selectedCharacter=character(selected);
  state.settings.sound=legacy.sound==='on'||legacy.sound===true;
  state.migration={done:true,legacyFound:Boolean(campaign||journal||tripBest||selected),credit,miles};
  state.legacy={campaign,journal,tripBest,selectedCharacter:CHARACTERS.includes(selected)?selected:null};
  state.records.legacy={tripScore:Math.max(tripBest,number(campaign?.score)),arcadeScore:number(journal?.arcadeBest),bestCombo:number(journal?.bestCombo)};
  const unlocked=REGIONS.filter(region=>region.storyMile<=miles).at(-1).index;
  state.unlocks.stage=unlocked;
  for(const region of REGIONS) {
    const imported=region.index<unlocked||(miles===2050);
    Object.assign(state.regions[region.id],{unlocked:region.index<=unlocked,completed:imported,imported});
  }
  syncUnlocks(state);
}

function updateRecord(target,run) {
  target.score=Math.max(target.score,run.score);
  target.distance=Math.max(target.distance,run.distance);
  target.bestCombo=Math.max(target.bestCombo,run.bestCombo);
  target.bestMultiplier=Math.max(target.bestMultiplier,run.bestMultiplier);
  target.runs=Math.min(LIMIT,target.runs+1);
  target.wins=Math.min(LIMIT,target.wins+(run.won?1:0));
}

/** Public state is JSON only. Use serialize() for an independent save snapshot. */
export class Progression {
  constructor(raw,legacy) {
    const saved=parse(raw);
    this.state=saved?.version===VERSION ? hydrate(saved) : blankState();
    if(saved?.version!==VERSION) migrate(this.state,legacy);
  }

  serialize() { return copy(this.state); }
  getRegion(id) { return typeof id==='number' ? REGIONS[id]||null : REGIONS.find(region=>region.id===id)||null; }
  isUnlocked(id) { const region=this.getRegion(id);return Boolean(region&&this.state.regions[region.id].unlocked); }
  selectCharacter(id) { if(!CHARACTERS.includes(id))return false;this.state.selectedCharacter=id;return true; }
  setSetting(key,value) { if(!Object.hasOwn(this.state.settings,key)||typeof value!=='boolean')return false;this.state.settings[key]=value;return true; }

  getRunConfig({mode='adventure',regionId,characterId,date}={}) {
    if(!MODES.includes(mode)) mode='adventure';
    const dailyDate=mode==='daily'?localDateKey(date??new Date()):null;
    const seed=dailyDate ? hash(`boerne-doodlin-daily-v2:${dailyDate}`) : Math.floor(Math.random()*4294967296)>>>0;
    let region=this.getRegion(regionId)||(mode==='endless'?REGIONS[0]:REGIONS[this.state.unlocks.stage]);
    if(mode==='snack') region=REGIONS[0];
    else if(mode==='daily') region=REGIONS[seed%REGIONS.length];
    else if(mode==='adventure'&&!this.isUnlocked(region.id)) region=REGIONS[this.state.unlocks.stage];
    return {mode,stage:region.index,regionId:region.id,characterId:character(characterId||this.state.selectedCharacter),gear:mode==='daily'?{magnet:0,charge:0,heart:0}:{...this.state.upgrades},assist:mode==='daily'?false:this.state.settings.assist,seed,dailyDate};
  }

  missionProgress() {
    return this.state.missions.active.map(mission=>{
      const template=MISSIONS[mission.serial%MISSIONS.length];
      return {...copy(mission),name:template.name,title:template.name,description:template.text.replace('{target}',String(mission.target)),metric:template.metric,complete:mission.progress>=mission.target};
    });
  }

  purchaseUpgrade(id) {
    const upgrade=UPGRADES.find(item=>item.id===id);
    if(!upgrade) return {ok:false,message:'Choose an upgrade.'};
    const level=this.state.upgrades[id];
    if(level>=upgrade.maxLevel) return {ok:false,message:'Fully upgraded.',level};
    const cost=upgrade.costs[level];
    if(this.state.wallet<cost) return {ok:false,message:`${cost-this.state.wallet} more treats needed.`,cost,level};
    this.state.wallet-=cost;this.state.upgrades[id]=level+1;
    return {ok:true,cost,level:level+1,message:`${upgrade.name} upgraded.`};
  }

  completeRun(summary={}) {
    const empty={ok:false,earnedTreats:0,stars:0,newStars:0,missionRewards:[],unlockedRegion:null,newBest:false,repeat:false};
    const runId=typeof summary.runId==='string'?summary.runId:'';
    if(!runId||runId.length>160||!MODES.includes(summary.mode)) return {...empty,message:'This run has no valid result.'};
    if(this.state.processedRuns.includes(runId)) return {...empty,ok:true,repeat:true};
    const region=this.getRegion(summary.regionId)||this.getRegion(summary.stage);
    if(!region) return {...empty,message:'This route could not be found.'};
    if(summary.mode==='adventure'&&!this.isUnlocked(region.id)) return {...empty,message:'Finish the previous region first.'};
    if(summary.mode==='daily'&&!validDateKey(summary.dailyDate)) return {...empty,message:'This daily run has no valid date.'};
    const run={mode:summary.mode,characterId:character(summary.characterId),won:summary.won===true};
    for(const key of ['score','distance','treats','bestCombo','hits','dodged','powersUsed','hearts','time','gold']) run[key]=number(summary[key],key==='score'||key==='distance'?10_000_000:100_000);
    run.bestMultiplier=stackMultiplier(summary.bestMultiplier);
    run.letters=run.mode==='snack'?0:number(summary.letters,7);
    const stars=run.won&&['adventure','daily'].includes(run.mode) ? 1+(run.treats>=region.targetTreats?1:0)+(run.hits<=region.maxHits?1:0) : 0;
    const modeRecord=this.state.records[run.mode];
    let newBest=run.score>modeRecord.score;
    const newDistanceBest=run.distance>modeRecord.distance;
    updateRecord(modeRecord,run);
    let newStars=0,unlockedRegion=null,firstClear=0;
    if(run.mode==='adventure') {
      const progress=this.state.regions[region.id];
      newBest=run.score>progress.bestScore;
      progress.runs=Math.min(LIMIT,progress.runs+1);
      progress.bestScore=Math.max(progress.bestScore,run.score);
      progress.bestTreats=Math.max(progress.bestTreats,run.treats);
      progress.bestCombo=Math.max(progress.bestCombo,run.bestCombo);
      newStars=Math.max(0,stars-progress.stars);progress.stars=Math.max(progress.stars,stars);
      if(run.won) {
        firstClear=progress.completed?0:(region.index===4?60:20);
        progress.completed=true;
        const next=REGIONS[region.index+1];
        if(next&&!this.isUnlocked(next.id)) {this.state.regions[next.id].unlocked=true;unlockedRegion=next;}
        syncUnlocks(this.state);
      }
    }
    let dailyBonus=0;
    if(run.mode==='daily') {
      const date=summary.dailyDate;
      const day=this.state.records.dailyByDate[date]||{...blankRecord(),stars:0,bonusClaimed:false};
      newBest=run.score>day.score;
      updateRecord(day,run);day.stars=Math.max(day.stars,stars);
      if(run.won&&!day.bonusClaimed) {dailyBonus=60;day.bonusClaimed=true;}
      this.state.records.dailyByDate[date]=day;
      for(const oldDate of Object.keys(this.state.records.dailyByDate).sort().slice(0,-35)) delete this.state.records.dailyByDate[oldDate];
    }
    const counters=this.state.counters;
    counters.runs=Math.min(LIMIT,counters.runs+1);counters.wins=Math.min(LIMIT,counters.wins+(run.won?1:0));
    for(const key of ['treats','score','distance','hits','dodged','powersUsed','time','gold','letters']) counters[key]=Math.min(LIMIT,counters[key]+run[key]);
    counters.bestCombo=Math.max(counters.bestCombo,run.bestCombo);
    counters.bestMultiplier=Math.max(counters.bestMultiplier,run.bestMultiplier);
    const crew=counters.characters[run.characterId];
    crew.runs=Math.min(LIMIT,crew.runs+1);crew.wins=Math.min(LIMIT,crew.wins+(run.won?1:0));crew.bestScore=Math.max(crew.bestScore,run.score);
    const missionRewards=[];
    for(const mission of this.state.missions.active) {
      const template=MISSIONS[mission.serial%MISSIONS.length];
      if(template.metric==='crew') {
        if(!mission.characters.includes(run.characterId)) mission.characters.push(run.characterId);
        mission.progress=mission.characters.length;
      } else if(template.metric==='bestCombo') mission.progress=Math.max(mission.progress,run.bestCombo);
      else mission.progress+=template.metric==='wins'?(run.won?1:0):run[template.metric];
      mission.progress=Math.min(mission.target,mission.progress);
      if(mission.progress>=mission.target) {
        missionRewards.push({id:mission.id,name:template.name,title:template.name,reward:mission.reward});
        this.state.missions.completed.push(mission.id);this.state.missions.totalCompleted++;
      }
    }
    const claimed=new Set(missionRewards.map(mission=>mission.id));
    this.state.missions.active=this.state.missions.active.filter(mission=>!claimed.has(mission.id));
    while(this.state.missions.active.length<3) this.state.missions.active.push(newMission(this.state.missions.nextIndex++));
    this.state.missions.completed=this.state.missions.completed.slice(-96);
    const rewards={treats:run.treats,gold:run.gold*3,finish:run.won?20:0,letters:run.letters===7?20:0,mastery:newStars*8,firstClear,daily:dailyBonus,missions:missionRewards.reduce((total,mission)=>total+mission.reward,0)};
    const earnedTreats=Object.values(rewards).reduce((total,value)=>total+value,0);
    this.state.wallet=Math.min(LIMIT,this.state.wallet+earnedTreats);
    this.state.processedRuns.push(runId);this.state.processedRuns=this.state.processedRuns.slice(-MAX_RUN_IDS);
    return {ok:true,earnedTreats,stars,newStars,missionRewards,unlockedRegion,newBest,newDistanceBest,repeat:false,rewards,letterBonus:run.letters===7,home:this.state.unlocks.home,bestMultiplier:run.bestMultiplier};
  }
}

function get(storage,key) { try{return storage?.getItem(key)??null;}catch{return null;} }

export function loadProgression(storage) {
  const raw=get(storage,SAVE_KEY);
  const progression=new Progression(raw,{
    campaign:get(storage,'boerne-doodlin-campaign-v1'),journal:get(storage,'boerne-doodlin-journal-v1'),
    tripBest:get(storage,'boerne-doodlin-trip-best'),
    selectedCharacter:get(storage,'boerne-doodlin-character')||get(storage,'griffin-snack-patrol-character'),
    sound:get(storage,'boerne-doodlin-sound')||get(storage,'griffin-snack-patrol-sound')
  });
  // Commit a fresh save or completed migration immediately; never change old keys.
  if(parse(raw)?.version!==VERSION) saveProgression(storage,progression);
  return progression;
}

export function saveProgression(storage,progression) {
  try{storage.setItem(SAVE_KEY,JSON.stringify(progression.serialize()));return true;}catch{return false;}
}
