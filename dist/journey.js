import { WORLDS, LEVELS } from './world-levels.js?v=22';
export { WORLDS, LEVELS };

export const SAVE_KEY='doodle-onward-journey-v1';
export const MODES=['platform','scout','snack','memory','rally'];
const LEGACY_KEY='boerne-doodlin-adventure-v2';
const VERSION=1,LIMIT=1_000_000_000,RECEIPT_LIMIT=384;
const CREW=['griffin','kevin','mittens','spike'];
const NAMES={griffin:'Griffin',kevin:'Pumpkin',mittens:'Mittens',spike:'Spike'};

export const UPGRADES=[
  {id:'magnet',name:'Snack magnet',description:'Bring nearby treats within reach.',maxLevel:3,costs:[60,120,200]},
  {id:'charge',name:'Extra zoom',description:'Fill character powers faster.',maxLevel:3,costs:[75,140,240]},
  {id:'heart',name:'Big heart',description:'Start with an extra heart per level.',maxLevel:2,costs:[150,300]}
];

export const CHARMS=[
  {id:'snack-tag',name:'Griffin’s snack tag',description:'Add one Snack Magnet level, up to level three.',effects:{magnet:1},unlock:{type:'medals',target:1},unlockLabel:'Earn your first medal.'},
  {id:'kevins-compass',name:'Kevin’s compass',description:'Add one Extra Zoom level, up to level three.',effects:{charge:1},unlock:{type:'quests',target:1},unlockLabel:'Finish one family quest.'},
  {id:'pocket-shell',name:'Spike’s pocket shell',description:'Add one Big Heart level, up to level two.',effects:{heart:1},unlock:{type:'medals',target:6},unlockLabel:'Earn six medals.'},
  {id:'stomp-bell',name:'Stomp bell',description:'Platform stomps give 15 extra power charge.',effects:{stompCharge:true},unlock:{type:'quests',target:3},unlockLabel:'Finish three family quests.'},
  {id:'picnic-ribbon',name:'Picnic ribbon',description:'Keep snack chains alive for two extra seconds.',effects:{comboGrace:2},unlock:{type:'world',target:0},unlockLabel:'Clear four Rogue River levels.'},
  {id:'mittens-moonstep',name:'Mittens’ moonstep',description:'Take a third jump in the platform adventure.',effects:{extraJump:true},unlock:{type:'medals',target:12},unlockLabel:'Earn twelve medals.'},
  {id:'golden-hour',name:'Golden hour',description:'Gold Rush lasts two seconds longer.',effects:{goldDuration:2},unlock:{type:'world',target:1},unlockLabel:'Clear four Redwood Run levels.'},
  {id:'bounce-button',name:'Bounce button',description:'Bounce higher after a platform stomp.',effects:{stompBounce:true},unlock:{type:'quests',target:8},unlockLabel:'Finish eight family quests.'},
  {id:'secret-sniffer',name:'Secret sniffer',description:'Reach hidden keys and chests from farther away.',effects:{secretMagnet:true},unlock:{type:'medals',target:24},unlockLabel:'Earn twenty-four medals.'},
  {id:'travel-shield',name:'Travel shield',description:'Begin with one protective shield.',effects:{shieldStart:true},unlock:{type:'world',target:2},unlockLabel:'Clear four Painted Canyon levels.'},
  {id:'happy-paws',name:'Happy paws',description:'Move 10% faster on platforms; steer faster in the RV.',effects:{speed:.1},unlock:{type:'world',target:3},unlockLabel:'Clear four Starlight Mesa levels.'},
  {id:'home-light',name:'Home light',description:'Character power lasts 1.5 seconds longer.',effects:{powerDuration:1.5},unlock:{type:'world',target:4},unlockLabel:'Clear four Boerne Hills levels.'}
];

export const QUESTS=[
  {id:'river-snack-count',worldIndex:0,character:'griffin',name:'A very important snack count',description:'Griffin needs 60 treats counted. Eating a few is part of the process.',metric:'treats',target:60,reward:35},
  {id:'river-clear-path',worldIndex:0,character:'kevin',name:'Make a little room',description:'Kevin asks for six platform stomps to clear a friendly path.',metric:'stomps',mode:'platform',target:6,reward:35},
  {id:'river-treasure',worldIndex:0,character:'mittens',name:'Obviously, that belongs to us',description:'Find three treasures while exploring Rogue River.',metric:'treasures',mode:'scout',target:3,reward:40},
  {id:'river-steady',worldIndex:0,character:'spike',name:'Two good arrivals',description:'Finish two different Rogue River platform levels. Spike has time.',metric:'levelClears',mode:'platform',target:2,reward:40},
  {id:'redwood-snack-storm',worldIndex:1,character:'griffin',name:'The sky brought snacks',description:'Catch 75 treats in Redwood Snack Storm games.',metric:'treats',mode:'snack',target:75,reward:45},
  {id:'redwood-scout',worldIndex:1,character:'kevin',name:'A trail worth following',description:'Let Kevin’s hunch lead you to five Redwood treasures.',metric:'treasures',mode:'scout',target:5,reward:45},
  {id:'redwood-matches',worldIndex:1,character:'mittens',name:'Mittens remembers everything',description:'Find eight matching pairs in Redwood memory games.',metric:'pairs',mode:'memory',target:8,reward:40},
  {id:'redwood-blocks',worldIndex:1,character:'spike',name:'A thorough inspection',description:'Open ten platform blocks. Spike believes in checking the corners.',metric:'blocks',mode:'platform',target:10,reward:45},
  {id:'canyon-gold',worldIndex:2,character:'griffin',name:'A golden sort of afternoon',description:'Collect nine golden snacks around Painted Canyon.',metric:'gold',target:9,reward:50},
  {id:'canyon-rally',worldIndex:2,character:'kevin',name:'Room for the whole RV',description:'Dodge twenty obstacles on Painted Canyon rallies.',metric:'dodged',mode:'rally',target:20,reward:50},
  {id:'canyon-secrets',worldIndex:2,character:'mittens',name:'The better hiding place',description:'Find three secret chests in Painted Canyon platform levels.',metric:'secrets',mode:'platform',target:3,reward:55},
  {id:'canyon-stomps',worldIndex:2,character:'spike',name:'Shell-tested',description:'Land twelve platform stomps. Spike calls that quality assurance.',metric:'stomps',mode:'platform',target:12,reward:50},
  {id:'mesa-chain',worldIndex:3,character:'griffin',name:'A proper snack chorus',description:'Build one chain of 25 treats under the Starlight Mesa sky.',metric:'bestCombo',aggregation:'max',target:25,reward:55},
  {id:'mesa-miles',worldIndex:3,character:'kevin',name:'The lights ahead',description:'Travel 2,500 distance units in Starlight Mesa rallies.',metric:'distance',mode:'rally',target:2500,reward:55},
  {id:'mesa-memory',worldIndex:3,character:'mittens',name:'Not one little mistake',description:'Finish a Starlight Mesa memory game without a mismatched pair.',metric:'perfects',mode:'memory',target:1,reward:60},
  {id:'mesa-checkpoints',worldIndex:3,character:'spike',name:'A good place to pause',description:'Activate four platform checkpoints. Every good journey has a rest stop.',metric:'checkpoints',mode:'platform',target:4,reward:55},
  {id:'boerne-feast',worldIndex:4,character:'griffin',name:'A welcome-home feast',description:'Gather 150 treats around Boerne Hills. Guests may include everyone.',metric:'treats',target:150,reward:65},
  {id:'boerne-scout',worldIndex:4,character:'kevin',name:'Something for everyone',description:'Discover ten treasures while exploring Boerne Hills.',metric:'treasures',mode:'scout',target:10,reward:65},
  {id:'boerne-stack',worldIndex:4,character:'mittens',name:'A very fine bonus blanket',description:'Stack your score multiplier to at least 10× in one Boerne activity.',metric:'bestMultiplier',aggregation:'max',target:10,reward:70},
  {id:'boerne-family',worldIndex:4,character:'spike',name:'Everyone, all together',description:'Take Griffin, Pumpkin, Mittens, and Spike on a Boerne activity.',metric:'crew',target:4,reward:75}
];

export const ACHIEVEMENTS=[
  {id:'first-pawprints',name:'First pawprints',description:'Finish a platform level.'},
  {id:'whole-crew',name:'The whole crew',description:'Play as every family member.'},
  {id:'five-ways',name:'Five ways to play',description:'Finish each of the five activity modes.'},
  {id:'full-stack',name:'Full stack of good things',description:'Reach a 30× score multiplier.'},
  {id:'family-home',name:'Everyone home',description:'Clear all five worlds.'},
  {id:'every-detour',name:'Every little detour',description:'Finish all thirty platform levels.'},
  {id:'ninety-medals',name:'A very shiny passport',description:'Earn all ninety level medals.'},
  {id:'family-favors',name:'Twenty family favors',description:'Complete all twenty quests.'},
  {id:'secret-friend',name:'Friend of the hidden path',description:'Find ten platform secrets.'}
];
export const STICKERS=[
  ...WORLDS.map(world=>({id:`world-${world.id}`,name:world.name,description:`Clear four ${world.name} levels.`,kind:'world',worldIndex:world.index})),
  ...CREW.map(id=>({id:`crew-${id}`,name:NAMES[id],description:`Play an activity with ${NAMES[id]}.`,kind:'crew',characterId:id})),
  ...MODES.map(mode=>({id:`mode-${mode}`,name:({platform:'Pawprints',scout:'Treasure nose',snack:'Snack Storm',memory:'Memory keeper',rally:'Home on wheels'})[mode],description:'Finish this activity.',kind:'mode',mode}))
];

const int=(value,max=LIMIT)=>Number.isFinite(Number(value))?Math.max(0,Math.min(max,Math.floor(Number(value)))):0;
const decimal=(value,max=LIMIT)=>Number.isFinite(Number(value))?Math.max(0,Math.min(max,Number(value))):0;
const multiplier=value=>Math.max(1,decimal(value,30));
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const clone=value=>JSON.parse(JSON.stringify(value));
const character=id=>CREW.includes(id)?id:'griffin';
const levelFor=id=>LEVELS.find(level=>level.id===id)||null;
const worldFor=value=>WORLDS.find(world=>world.index===Number(value)||world.id===value)||null;
const seedValue=value=>(Number(value)>>>0)||1;
function parse(raw,maxBytes=1_500_000) {
  try {const text=typeof raw==='string'?raw:JSON.stringify(raw);if(!text||text.length>maxBytes)return null;const parsed=JSON.parse(text);return object(parsed)?parsed:null;}catch{return null;}
}
function hash(value) {let seed=2166136261;for(const char of String(value))seed=Math.imul(seed^char.charCodeAt(0),16777619);return seed>>>0;}
function validDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d,12);
  return y>=2000&&y<=9999&&date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d;
}
export function localDateKey(value=new Date()) {
  if(validDate(value))return value;
  let date=value instanceof Date?value:new Date(value);if(!Number.isFinite(date.getTime()))date=new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
const blankRecord=()=>({score:0,distance:0,bestCombo:0,bestMultiplier:1,runs:0,wins:0,bestTime:null});
function readRecord(raw) {
  const result=blankRecord();
  for(const key of ['score','distance','bestCombo','runs','wins'])result[key]=int(raw?.[key]);
  result.bestMultiplier=multiplier(raw?.bestMultiplier);result.bestTime=decimal(raw?.bestTime)>0?decimal(raw.bestTime):null;
  return result;
}
const ACTIONS=['runs','wins','treats','score','distance','hits','dodged','powersUsed','gold','letters','stomps','secrets','blocks','checkpoints','treasures','steps','pairs','mistakes','perfects','time'];
function blankCounters(){return {...Object.fromEntries(ACTIONS.map(key=>[key,0])),bestCombo:0,bestMultiplier:1,characters:Object.fromEntries(CREW.map(id=>[id,{runs:0,wins:0,bestScore:0}]))};}
function blankLevel(){return {unlocked:false,completed:false,medals:0,awards:{finish:false,gold:false,mastery:false},runs:0,bestScore:0,bestTreats:0,bestGold:0,bestCombo:0,bestMultiplier:1,bestTime:null};}
function blankState(){return {
  version:VERSION,wallet:0,selectedCharacter:'griffin',selectedWorld:0,settings:{sound:false,assist:false,reducedMotion:false},upgrades:{magnet:0,charge:0,heart:0},
  worlds:WORLDS.map(world=>({id:world.id,index:world.index,unlocked:world.index===0,completed:false,clears:0,medals:0,rewarded:false})),
  levels:Object.fromEntries(LEVELS.map(level=>[level.id,blankLevel()])),
  quests:Object.fromEntries(QUESTS.map(quest=>[quest.id,{progress:0,completed:false,rewarded:false,seen:[]}])),
  charms:{unlocked:[],loadout:[]},passport:{stickers:[],achievements:[]},
  records:Object.fromEntries(MODES.map(mode=>[mode,blankRecord()])),counters:blankCounters(),daily:{history:{}},
  checkpoints:{},processedRuns:[],migration:{done:true,imported:false,sourceKey:LEGACY_KEY,importedAt:null},legacy:null
};}

function syncWorlds(state) {
  for(const world of WORLDS) {
    const entry=state.worlds[world.index],levels=LEVELS.filter(level=>level.worldIndex===world.index);
    entry.clears=levels.filter(level=>state.levels[level.id].completed).length;
    entry.medals=levels.reduce((sum,level)=>sum+state.levels[level.id].medals,0);
    entry.completed=entry.clears>=4;
    entry.unlocked=world.index===0||entry.unlocked||entry.clears>0||state.worlds[world.index-1].completed;
    const available=Math.min(6,3+entry.clears);
    for(const level of levels)state.levels[level.id].unlocked=entry.unlocked&&(level.index<available||state.levels[level.id].completed);
  }
  if(!state.worlds[state.selectedWorld]?.unlocked)state.selectedWorld=0;
}
function totals(state){return {medals:state.worlds.reduce((sum,world)=>sum+world.medals,0),clears:state.worlds.reduce((sum,world)=>sum+world.clears,0),quests:QUESTS.filter(quest=>state.quests[quest.id].completed).length};}
function charmEarned(state,charm) {
  const count=totals(state),rule=charm.unlock;
  return rule.type==='world'?state.worlds[rule.target].completed:count[rule.type]>=rule.target;
}
function refreshCharms(state) {
  const added=[];
  for(const charm of CHARMS)if(!state.charms.unlocked.includes(charm.id)&&charmEarned(state,charm)){state.charms.unlocked.push(charm.id);added.push(charm);}
  state.charms.loadout=[...new Set(state.charms.loadout.filter(id=>state.charms.unlocked.includes(id)))].slice(0,3);
  return added;
}
function refreshPassport(state) {
  const stickers=[],achievements=[],count=totals(state);
  for(const sticker of STICKERS) {
    const earned=sticker.kind==='world'?state.worlds[sticker.worldIndex].completed:sticker.kind==='crew'?state.counters.characters[sticker.characterId].runs>0:state.records[sticker.mode].wins>0;
    if(earned&&!state.passport.stickers.includes(sticker.id)){state.passport.stickers.push(sticker.id);stickers.push(sticker);}
  }
  const earned={
    'first-pawprints':count.clears>0,'whole-crew':CREW.every(id=>state.counters.characters[id].runs>0),
    'five-ways':MODES.every(mode=>state.records[mode].wins>0),'full-stack':state.counters.bestMultiplier>=30,
    'family-home':state.worlds.every(world=>world.completed),'every-detour':count.clears===30,
    'ninety-medals':count.medals===90,'family-favors':count.quests===20,'secret-friend':state.counters.secrets>=10
  };
  for(const achievement of ACHIEVEMENTS)if(earned[achievement.id]&&!state.passport.achievements.includes(achievement.id)){state.passport.achievements.push(achievement.id);achievements.push(achievement);}
  return {stickers,achievements};
}

function hydrate(raw) {
  const state=blankState();state.wallet=int(raw.wallet);state.selectedCharacter=character(raw.selectedCharacter);state.selectedWorld=int(raw.selectedWorld,4);
  for(const key of Object.keys(state.settings))state.settings[key]=raw.settings?.[key]===true;
  for(const upgrade of UPGRADES)state.upgrades[upgrade.id]=int(raw.upgrades?.[upgrade.id],upgrade.maxLevel);
  for(const world of WORLDS){const saved=raw.worlds?.[world.index];state.worlds[world.index].unlocked=saved?.unlocked===true||world.index===0;state.worlds[world.index].rewarded=saved?.rewarded===true;}
  for(const level of LEVELS) {
    const saved=raw.levels?.[level.id],target=state.levels[level.id];
    target.completed=saved?.completed===true;
    for(const key of ['finish','gold','mastery'])target.awards[key]=saved?.awards?.[key]===true;
    if(target.awards.finish)target.completed=true;
    if(target.completed)target.awards.finish=true;
    target.medals=Object.values(target.awards).filter(Boolean).length;
    for(const key of ['runs','bestScore','bestTreats','bestGold','bestCombo'])target[key]=int(saved?.[key]);
    target.bestMultiplier=multiplier(saved?.bestMultiplier);target.bestTime=decimal(saved?.bestTime)>0?decimal(saved.bestTime):null;
  }
  for(const quest of QUESTS) {
    const saved=raw.quests?.[quest.id],target=state.quests[quest.id];
    target.progress=Math.min(quest.target,decimal(saved?.progress));
    target.seen=[...new Set((Array.isArray(saved?.seen)?saved.seen:[]).filter(id=>quest.metric==='crew'?CREW.includes(id):LEVELS.some(level=>level.id===id&&level.worldIndex===quest.worldIndex)))];
    if(['crew','levelClears'].includes(quest.metric))target.progress=Math.min(quest.target,target.seen.length);
    target.completed=saved?.completed===true||target.progress>=quest.target;
    if(target.completed)target.progress=quest.target;
    target.rewarded=target.completed&&saved?.rewarded===true;
  }
  state.charms.unlocked=[...new Set((Array.isArray(raw.charms?.unlocked)?raw.charms.unlocked:[]).filter(id=>CHARMS.some(charm=>charm.id===id)))];
  state.charms.loadout=Array.isArray(raw.charms?.loadout)?raw.charms.loadout:[];
  state.passport.stickers=[...new Set((Array.isArray(raw.passport?.stickers)?raw.passport.stickers:[]).filter(id=>STICKERS.some(sticker=>sticker.id===id)))];
  state.passport.achievements=[...new Set((Array.isArray(raw.passport?.achievements)?raw.passport.achievements:[]).filter(id=>ACHIEVEMENTS.some(achievement=>achievement.id===id)))];
  for(const mode of MODES)state.records[mode]=readRecord(raw.records?.[mode]);
  for(const key of ACTIONS)state.counters[key]=decimal(raw.counters?.[key]);
  state.counters.bestCombo=int(raw.counters?.bestCombo);state.counters.bestMultiplier=multiplier(raw.counters?.bestMultiplier);
  for(const id of CREW)for(const key of ['runs','wins','bestScore'])state.counters.characters[id][key]=int(raw.counters?.characters?.[id]?.[key]);
  for(const date of object(raw.daily?.history)?Object.keys(raw.daily.history).filter(validDate).sort().slice(-45):[]) {
    const saved=raw.daily.history[date];
    state.daily.history[date]={...readRecord(saved),bonusClaimed:saved?.bonusClaimed===true,mode:MODES.includes(saved?.mode)?saved.mode:'platform',worldIndex:int(saved?.worldIndex,4),levelId:levelFor(saved?.levelId)?.id||null};
  }
  for(const level of LEVELS){const snapshot=parse(raw.checkpoints?.[level.id],75_000);if(snapshot&&(!snapshot.levelId||snapshot.levelId===level.id)&&(!snapshot.config?.levelId||snapshot.config.levelId===level.id))state.checkpoints[level.id]=snapshot;}
  state.processedRuns=[...new Set((Array.isArray(raw.processedRuns)?raw.processedRuns:[]).filter(id=>typeof id==='string'&&id.length>0&&id.length<=180))].slice(-RECEIPT_LIMIT);
  state.migration={done:true,imported:raw.migration?.imported===true,sourceKey:LEGACY_KEY,importedAt:decimal(raw.migration?.importedAt)>0?decimal(raw.migration.importedAt):null};
  state.legacy=parse(raw.legacy);
  syncWorlds(state);refreshCharms(state);refreshPassport(state);
  return state;
}
function migrate(state,input) {
  const legacy=parse(object(input)&&Object.hasOwn(input,'progression')?input.progression:input);
  if(legacy?.version!==2){syncWorlds(state);return;}
  state.wallet=int(legacy.wallet);state.selectedCharacter=character(legacy.selectedCharacter);
  for(const key of Object.keys(state.settings))state.settings[key]=legacy.settings?.[key]===true;
  for(const upgrade of UPGRADES)state.upgrades[upgrade.id]=int(legacy.upgrades?.[upgrade.id],upgrade.maxLevel);
  state.records.platform=readRecord(legacy.records?.adventure);state.records.snack=readRecord(legacy.records?.snack);
  state.counters.bestCombo=Math.max(state.records.platform.bestCombo,state.records.snack.bestCombo);
  state.counters.bestMultiplier=Math.max(state.records.platform.bestMultiplier,state.records.snack.bestMultiplier);
  state.legacy=legacy;state.migration={done:true,imported:true,sourceKey:LEGACY_KEY,importedAt:Date.now()};
  syncWorlds(state);refreshPassport(state);
}
function updateRecord(record,run) {
  record.score=Math.max(record.score,run.score);record.distance=Math.max(record.distance,run.distance);record.bestCombo=Math.max(record.bestCombo,run.bestCombo);record.bestMultiplier=Math.max(record.bestMultiplier,run.bestMultiplier);
  record.runs=Math.min(LIMIT,record.runs+1);record.wins=Math.min(LIMIT,record.wins+(run.won?1:0));
  if(run.won&&run.time>0)record.bestTime=record.bestTime===null?run.time:Math.min(record.bestTime,run.time);
}

export class Journey {
  constructor(raw,legacy) {
    const saved=parse(raw);this.state=saved?.version===VERSION?hydrate(saved):blankState();this._seedSequence=0;
    if(saved?.version!==VERSION)migrate(this.state,legacy);
  }
  serialize(){return clone(this.state);}
  selectCharacter(id){if(!CREW.includes(id))return false;this.state.selectedCharacter=id;return true;}
  selectWorld(index){const world=worldFor(index);if(!world||!this.state.worlds[world.index].unlocked)return false;this.state.selectedWorld=world.index;return true;}
  setSetting(key,value){if(!Object.hasOwn(this.state.settings,key)||typeof value!=='boolean')return false;this.state.settings[key]=value;return true;}
  levelGoals(levelId){
    const level=levelFor(levelId);if(!level)return [];
    return [{id:'finish',label:'Reach the RV',metric:'won',target:1},{id:'gold',label:`Find all ${level.goldTarget} gold`,metric:'gold',target:level.goldTarget},{id:'mastery',label:`No hits or under ${level.parTime}s`,metric:'cleanOrTime',target:level.parTime,maxHits:0}];
  }
  getDailyChallenge(date) {
    const dailyDate=localDateKey(date??new Date()),seed=seedValue(hash(`doodle-onward-daily-v1:${dailyDate}`)),mode=MODES[seed%MODES.length],worldIndex=(seed>>>5)%WORLDS.length;
    const level=LEVELS.filter(item=>item.worldIndex===worldIndex)[(seed>>>12)%6],saved=this.state.daily.history[dailyDate];
    return {id:`daily-${dailyDate}`,title:'Today’s family adventure',description:`${({platform:'Platform adventure',scout:'Treasure scout',snack:'Snack Storm',memory:'Memory match',rally:'RV rally'})[mode]} in ${WORLDS[worldIndex].name}`,mode,worldIndex,levelId:mode==='platform'?level.id:null,seed,remix:mode==='platform',dailyDate,bonus:80,claimed:saved?.bonusClaimed===true,bestScore:saved?.score||0};
  }
  getRunConfig({mode='platform',levelId,worldIndex,seed,remix=false,dailyDate,characterId}={}) {
    if(!MODES.includes(mode))mode='platform';
    const daily=dailyDate?this.getDailyChallenge(dailyDate):null;
    let world=worldFor(worldIndex)||WORLDS[this.state.selectedWorld],level=levelFor(levelId);
    if(daily){mode=daily.mode;world=WORLDS[daily.worldIndex];level=levelFor(daily.levelId);seed=daily.seed;remix=daily.remix;}
    else if(mode==='platform') {
      if(level)world=WORLDS[level.worldIndex];
      if(!this.state.worlds[world.index].unlocked)world=WORLDS[this.state.selectedWorld];
      if(!level||!this.state.levels[level.id].unlocked)level=LEVELS.find(item=>item.worldIndex===world.index&&this.state.levels[item.id].unlocked);
      world=WORLDS[level.worldIndex];
    }
    const chosenSeed=seed!==undefined&&Number.isFinite(Number(seed))?seedValue(seed):mode==='platform'&&!remix?seedValue(hash(level.id+':onward')):seedValue(Date.now()+Math.floor(Math.random()*4294967296)+Math.imul(++this._seedSequence,2654435761));
    const gear={...this.state.upgrades},effects={};
    for(const id of this.state.charms.loadout)for(const [key,value] of Object.entries(CHARMS.find(charm=>charm.id===id).effects)){
      if(Object.hasOwn(gear,key))gear[key]+=value;else effects[key]=typeof value==='boolean'?value:(effects[key]||0)+value;
    }
    for(const upgrade of UPGRADES)gear[upgrade.id]=Math.min(upgrade.maxLevel,gear[upgrade.id]);
    const actualLevel=mode==='platform'?level.id:null;
    return {mode,levelId:actualLevel,worldIndex:world.index,stage:world.index,characterId:character(characterId||this.state.selectedCharacter),gear:daily?{magnet:0,charge:0,heart:0}:gear,charms:daily?{}:effects,assist:daily?false:this.state.settings.assist,seed:chosenSeed,remix:Boolean(remix),dailyDate:daily?.dailyDate||null,checkpoint:actualLevel&&!daily&&!remix?clone(this.state.checkpoints[actualLevel]||null):null,medalGoals:this.levelGoals(actualLevel)};
  }
  questProgress(worldIndex) {
    const world=worldIndex===undefined?null:worldFor(worldIndex);
    return QUESTS.filter(quest=>worldIndex===undefined||quest.worldIndex===world?.index).map(quest=>({...quest,title:quest.name,...clone(this.state.quests[quest.id]),ratio:this.state.quests[quest.id].progress/quest.target}));
  }
  purchaseUpgrade(id) {
    const upgrade=UPGRADES.find(item=>item.id===id);if(!upgrade)return {ok:false,message:'Choose an upgrade.'};
    const level=this.state.upgrades[id],cost=upgrade.costs[level];
    if(level>=upgrade.maxLevel)return {ok:false,message:'Fully upgraded.',level};
    if(this.state.wallet<cost)return {ok:false,message:`${cost-this.state.wallet} more treats needed.`,cost,level};
    this.state.wallet-=cost;this.state.upgrades[id]++;
    return {ok:true,cost,level:level+1,message:`${upgrade.name} upgraded.`};
  }
  equipCharm(id) {
    if(!CHARMS.some(charm=>charm.id===id))return {ok:false,message:'Choose a charm.'};
    if(!this.state.charms.unlocked.includes(id))return {ok:false,message:'Earn this charm through the family adventure.'};
    if(this.state.charms.loadout.includes(id)){this.state.charms.loadout=this.state.charms.loadout.filter(item=>item!==id);return {ok:true,equipped:false,message:'Charm returned to the backpack.'};}
    if(this.state.charms.loadout.length>=3)return {ok:false,message:'Choose up to three charms. Remove one to make room.'};
    this.state.charms.loadout.push(id);return {ok:true,equipped:true,message:'Charm equipped.'};
  }
  saveCheckpoint(levelId,snapshot) {
    if(!levelFor(levelId)||!this.state.levels[levelId].unlocked)return false;
    const safe=parse(snapshot,75_000);if(!safe||(safe.levelId&&safe.levelId!==levelId)||(safe.config?.levelId&&safe.config.levelId!==levelId))return false;
    this.state.checkpoints[levelId]=safe;return true;
  }
  clearCheckpoint(levelId){if(!levelFor(levelId))return false;delete this.state.checkpoints[levelId];return true;}

  completeRun(summary={}) {
    const empty={ok:false,repeat:false,earnedTreats:0,rewards:{},medals:0,medalGoals:[],newMedals:0,unlockedLevels:[],unlockedWorlds:[],questRewards:[],unlockedCharms:[],stickers:[],achievements:[],newBest:false,bestMultiplier:1,dailyBonus:0,home:this.state.worlds.every(world=>world.completed)};
    const runId=typeof summary.runId==='string'?summary.runId:'';
    if(!runId||runId.length>180||!MODES.includes(summary.mode))return {...empty,message:'This activity has no valid result.'};
    if(this.state.processedRuns.includes(runId))return {...empty,ok:true,repeat:true};
    const level=summary.mode==='platform'?levelFor(summary.levelId):null;
    if(summary.mode==='platform'&&!level)return {...empty,message:'This level could not be found.'};
    const worldIndex=level?level.worldIndex:(worldFor(summary.worldIndex??summary.stage)?.index??this.state.selectedWorld);
    const daily=validDate(summary.dailyDate)?this.getDailyChallenge(summary.dailyDate):null;
    const dailyMatches=Boolean(daily&&daily.mode===summary.mode&&daily.worldIndex===worldIndex&&(daily.mode!=='platform'||daily.levelId===level?.id)&&(summary.seed===undefined||seedValue(summary.seed)===daily.seed));
    if(level&&!this.state.levels[level.id].unlocked&&!dailyMatches)return {...empty,message:'Open this trail before starting the level.'};
    const run={mode:summary.mode,worldIndex,levelId:level?.id||null,characterId:character(summary.characterId),won:summary.won===true,bestMultiplier:multiplier(summary.bestMultiplier)};
    for(const key of [...ACTIONS.filter(key=>!['runs','wins'].includes(key)),'bestCombo','hearts'])run[key]=decimal(summary[key],key==='score'||key==='distance'?10_000_000:100_000);
    if(run.mode==='memory')run.perfects=run.won&&run.mistakes===0?1:0;
    if(run.mode==='platform')run.gold=Math.min(level.goldTarget,run.gold);
    const beforeLevels=new Set(LEVELS.filter(item=>this.state.levels[item.id].unlocked).map(item=>item.id));
    const beforeWorlds=new Set(this.state.worlds.filter(world=>world.unlocked).map(world=>world.id));
    const goals=this.levelGoals(level?.id).map(goal=>({...goal,earned:run.won&&(goal.id==='finish'||goal.id==='gold'&&run.gold>=level.goldTarget||goal.id==='mastery'&&(run.hits===0||run.time>0&&run.time<=level.parTime))}));
    const medals=goals.filter(goal=>goal.earned).length;
    let newMedals=0,firstClear=0,worldReward=0;
    const storyEligible=level&&this.state.levels[level.id].unlocked;
    if(storyEligible) {
      const saved=this.state.levels[level.id];saved.runs++;
      saved.bestScore=Math.max(saved.bestScore,run.score);saved.bestTreats=Math.max(saved.bestTreats,run.treats);saved.bestGold=Math.max(saved.bestGold,run.gold);saved.bestCombo=Math.max(saved.bestCombo,run.bestCombo);saved.bestMultiplier=Math.max(saved.bestMultiplier,run.bestMultiplier);
      if(run.won) {
        firstClear=saved.completed?0:25;saved.completed=true;
        if(run.time>0)saved.bestTime=saved.bestTime===null?run.time:Math.min(saved.bestTime,run.time);
        for(const goal of goals)if(goal.earned&&!saved.awards[goal.id]){saved.awards[goal.id]=true;newMedals++;}
        saved.medals=Object.values(saved.awards).filter(Boolean).length;
        // A daily or remix win is a different course: it leaves the saved spot in the ordinary level alone.
        if(!dailyMatches&&summary.remix!==true)this.clearCheckpoint(level.id);
      }
      syncWorlds(this.state);
      for(const world of this.state.worlds)if(world.completed&&!world.rewarded){world.rewarded=true;worldReward+=50;}
    }
    const record=this.state.records[run.mode],newBest=run.score>record.score;
    updateRecord(record,run);
    const counters=this.state.counters;counters.runs=Math.min(LIMIT,counters.runs+1);counters.wins=Math.min(LIMIT,counters.wins+(run.won?1:0));
    for(const key of ACTIONS)if(!['runs','wins'].includes(key))counters[key]=Math.min(LIMIT,counters[key]+run[key]);
    counters.bestCombo=Math.max(counters.bestCombo,run.bestCombo);counters.bestMultiplier=Math.max(counters.bestMultiplier,run.bestMultiplier);
    const crew=counters.characters[run.characterId];crew.runs++;crew.wins+=run.won?1:0;crew.bestScore=Math.max(crew.bestScore,run.score);
    const questRewards=[];
    for(const quest of QUESTS) {
      const state=this.state.quests[quest.id];
      if(!state.completed&&quest.worldIndex===worldIndex&&(!quest.mode||quest.mode===run.mode)) {
        if(quest.metric==='crew'){if(!state.seen.includes(run.characterId))state.seen.push(run.characterId);state.progress=state.seen.length;}
        else if(quest.metric==='levelClears'){if(run.won&&run.levelId&&!state.seen.includes(run.levelId))state.seen.push(run.levelId);state.progress=state.seen.length;}
        else if(quest.aggregation==='max')state.progress=Math.max(state.progress,run[quest.metric]||0);
        else state.progress+=run[quest.metric]||0;
        state.progress=Math.min(quest.target,state.progress);state.completed=state.progress>=quest.target;
      }
      if(state.completed&&!state.rewarded){state.rewarded=true;questRewards.push(quest);}
    }
    let dailyBonus=0;
    if(dailyMatches) {
      const history=this.state.daily.history[summary.dailyDate]||{...blankRecord(),mode:run.mode,worldIndex,levelId:run.levelId,bonusClaimed:false};
      updateRecord(history,run);
      if(run.won&&!history.bonusClaimed){history.bonusClaimed=true;dailyBonus=daily.bonus;}
      this.state.daily.history[summary.dailyDate]=history;
      for(const old of Object.keys(this.state.daily.history).sort().slice(0,-45))delete this.state.daily.history[old];
    }
    const unlockedCharms=refreshCharms(this.state),passport=refreshPassport(this.state);
    const rewards={treats:Math.floor(run.treats),gold:Math.floor(run.gold)*5,finish:run.won?20:0,medals:newMedals*12,firstClear,world:worldReward,quests:questRewards.reduce((sum,quest)=>sum+quest.reward,0),daily:dailyBonus};
    const earnedTreats=Object.values(rewards).reduce((sum,value)=>sum+value,0);this.state.wallet=Math.min(LIMIT,this.state.wallet+earnedTreats);
    this.state.processedRuns.push(runId);this.state.processedRuns=this.state.processedRuns.slice(-RECEIPT_LIMIT);
    return {ok:true,repeat:false,earnedTreats,rewards,medals,medalGoals:goals,newMedals,unlockedLevels:LEVELS.filter(item=>this.state.levels[item.id].unlocked&&!beforeLevels.has(item.id)).map(item=>item.id),unlockedWorlds:WORLDS.filter(world=>this.state.worlds[world.index].unlocked&&!beforeWorlds.has(world.id)),questRewards,unlockedCharms,...passport,newBest,bestMultiplier:run.bestMultiplier,dailyBonus,home:this.state.worlds.every(world=>world.completed)};
  }
}

function get(storage,key){try{return storage?.getItem(key)??null;}catch{return null;}}
export function loadJourney(storage) {
  const raw=get(storage,SAVE_KEY),journey=new Journey(raw,get(storage,LEGACY_KEY));
  if(parse(raw)?.version!==VERSION)saveJourney(storage,journey);
  return journey;
}
export function saveJourney(storage,journey){try{storage.setItem(SAVE_KEY,JSON.stringify(journey.serialize()));return true;}catch{return false;}}
