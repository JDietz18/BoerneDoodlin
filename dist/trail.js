import { PLAYABLE_IDS } from './characters.js?v=10';

export const TRAIL_TOTAL_MILES = 2050;
export const CAMPAIGN_STORAGE_KEY = 'boerne-doodlin-campaign-v1';

export const TRAIL_STOPS = [
  {name:'Grants Pass',state:'OR',mile:0,biome:'Southern Oregon',biomeIndex:0,summary:'The RV is packed. Everyone is aboard, and Griffin thinks this is a vacation.'},
  {name:'Redding',state:'CA',mile:180,biome:'Southern Oregon',biomeIndex:0,summary:'Last evergreen push before California opens up.'},
  {name:'Bakersfield',state:'CA',mile:510,biome:'Mojave Desert',biomeIndex:1,summary:'Heat, snacks, and many fuel receipts.'},
  {name:'Needles',state:'CA',mile:800,biome:'Mojave Desert',biomeIndex:1,summary:'The desert starts taking the move personally.'},
  {name:'Flagstaff',state:'AZ',mile:1080,biome:'Red Mesa Country',biomeIndex:2,summary:'High country air and big red-rock skies.'},
  {name:'Las Cruces',state:'NM',mile:1460,biome:'Red Mesa Country',biomeIndex:2,summary:'A long southwest stretch before a quiet night in the RV.'},
  {name:'Fort Stockton',state:'TX',mile:1740,biome:'Texas Hill Country',biomeIndex:3,summary:'Texas miles get wide and honest.'},
  {name:'Boerne',state:'TX',mile:TRAIL_TOTAL_MILES,biome:'Texas Hill Country',biomeIndex:3,summary:'Home stretch. Yard inspection pending.'}
];

export const PACK_OPTIONS = [
  {id:'balanced',label:'Balanced Pack',detail:'A steady setup for the family RV.',resources:{fuel:86,snacks:72,morale:92,rig:84,budget:78}},
  {id:'snack-heavy',label:'Snack Heavy',detail:'More morale, less spending room.',resources:{fuel:78,snacks:92,morale:98,rig:82,budget:64}},
  {id:'fuel-first',label:'Fuel First',detail:'Fewer snack stops, more highway range.',resources:{fuel:96,snacks:60,morale:86,rig:80,budget:74}},
  {id:'cash-cushion',label:'Cash Cushion',detail:'Lean supplies with extra wiggle room.',resources:{fuel:80,snacks:62,morale:88,rig:76,budget:98}}
];

export const PACE_OPTIONS = [
  {id:'scenic',label:'Scenic',detail:'Gentler on morale and the RV.',fuel:0.9,snacks:1.08,morale:0.75,rig:0.75,days:1,score:55},
  {id:'steady',label:'Steady',detail:'Reliable progress, predictable costs.',fuel:1,snacks:1,morale:1,rig:1,days:0,score:85},
  {id:'hustle',label:'Hustle',detail:'Faster route score, rougher on everyone.',fuel:1.22,snacks:1.1,morale:1.55,rig:1.35,days:0,score:145}
];

export const SERVICE_ACTIONS = [
  {id:'fuel',label:'Top Off Fuel',detail:'Add highway range.',effects:{budget:-10,fuel:16},result:'The tank looks happier.'},
  {id:'snacks',label:'Snack Restock',detail:'Refill the treat bag.',effects:{budget:-8,snacks:15},result:'The snack stash gains real authority.'},
  {id:'repair',label:'Check The RV',detail:'Tires, fluids, and RV essentials.',effects:{budget:-12,rig:13},result:'The RV sounds less dramatic.'},
  {id:'rest',label:'RV Camp Night',detail:'Spend snacks, gain morale.',effects:{snacks:-6,morale:16,days:1},result:'The RV settles into camp. Mittens claims a cushion, Spike settles in, and Griffin approves everyone.'}
];

const ROUTE_EVENTS = {
  1: {
    place:'Siskiyou Pass',
    title:'The mountains have opinions.',
    story:'The family RV climbs out of Oregon. Griffin is delighted by the hills, the air, and every person still trapped in the adventure with him.',
    choices:[
      {id:'steady-climb',label:'Take The Steady Climb',effects:{fuel:-8,rig:-2,morale:4},score:80,outcome:'The family eases through the pass. Griffin treats the patient driving as a personal compliment.'},
      {id:'stretch-stop',label:'Pet-Friendly Stretch',effects:{snacks:-6,morale:12,days:1},score:60,outcome:'Paws stretch, shoulders drop, and Griffin greets the whole parking lot like a reunion.'},
      {id:'griffin-scout',label:"Trust Griffin's Nose",effects:{fuel:-10,snacks:-3,morale:16},score:120,outcome:'Griffin finds a scenic pullout and three important smells. The detour becomes official family lore.'}
    ]
  },
  2: {
    place:'Central Valley',
    title:'Snack math meets a hot highway.',
    story:'The route flattens out. Mittens claims the RV window, Spike settles into his travel spot, and Griffin believes this is going perfectly. Kevin has a little road wisdom ready.',
    choices:[
      {id:'bakersfield-topoff',label:'Top Off Early',effects:{budget:-12,fuel:18,snacks:8},score:50,outcome:'The stop costs a little cash, but the next stretch feels less tense.'},
      {id:'steady-valley',label:'Roll Steady',effects:{fuel:-9,snacks:-7,morale:-2},score:115,outcome:'The RV keeps its rhythm. Griffin naps with total faith in the plan.'},
      {id:'kevin-restarea',label:"Use Kevin's Rest-Area Intel",effects:{fuel:-7,snacks:10,morale:6},score:110,outcome:'Kevin picks a surprisingly perfect stop. Nobody questions the source of his confidence.'}
    ]
  },
  3: {
    place:'Mojave Crossing',
    title:'The desert turns up the heat.',
    story:'The road shimmers. Griffin is still smiling because he has never met a situation that could not become a good time.',
    choices:[
      {id:'coolant',label:'Buy Coolant And Ice',effects:{budget:-16,rig:18,fuel:-5},score:70,outcome:'The RV cools down and the crew cools off. Responsible choices can still involve snacks.'},
      {id:'slow-heat',label:'Slow Through The Heat',effects:{fuel:-8,rig:-2,morale:4,days:1},score:90,outcome:'It takes longer, but the family arrives calm and intact.'},
      {id:'mittens-campground',label:"Accept Mittens' Campground Ruling",effects:{budget:-8,snacks:-8,morale:18,rig:4,days:1},score:80,outcome:'Mittens votes for a shaded RV campground. Everyone rests aboard; Griffin interprets this as a surprise vacation.'}
    ]
  },
  4: {
    place:'Flagstaff',
    title:'High-country weather enters the chat.',
    story:'The air gets cool, the road climbs, and the RV would like everyone to know it has been working very hard.',
    choices:[
      {id:'patient-climb',label:'Climb Patiently',effects:{fuel:-10,rig:-4,morale:6},score:100,outcome:'The RV grumbles, then settles in. Griffin considers every switchback inspirational.'},
      {id:'weather-detour',label:'Take The Weather Detour',effects:{fuel:-8,snacks:-8,rig:6,days:1},score:75,outcome:'The route adds time, but the RV gets a safer stretch of road.'},
      {id:'diner-signal',label:"Follow Kevin's Diner Signal",effects:{fuel:-10,snacks:16,morale:6},score:120,outcome:'Kevin leads the crew to takeout and shade. It is difficult to argue with results.'}
    ]
  },
  5: {
    place:'New Mexico Night',
    title:'A long stretch asks for judgment.',
    story:'The sky goes big and dark. The family can push on, reset, or let Griffin do what Griffin does best: make strangers into friends.',
    choices:[
      {id:'night-drive',label:'Keep The Night Drive',effects:{fuel:-12,morale:-8,rig:-2},score:160,outcome:'The miles fall away fast. Griffin stays awake just long enough to be emotionally supportive.'},
      {id:'family-reset',label:'Park For An RV Camp Night',effects:{budget:-10,snacks:-6,morale:18,days:1},score:75,outcome:'The RV becomes a tiny home for the night. The family sleeps, the pets settle in, and the highway can wait.'},
      {id:'griffin-friends',label:'Let Griffin Make Friends',effects:{fuel:-8,snacks:8,morale:12},score:115,outcome:'Griffin finds a friendly stop and immediately assumes everyone has been waiting for him.'}
    ]
  },
  6: {
    place:'West Texas',
    title:'Fuel signs get serious.',
    story:'Texas opens wide. The next stop is far enough away that the family starts respecting every gas station sign.',
    choices:[
      {id:'early-fuel',label:'Top Off Before The Basin',effects:{budget:-14,fuel:22},score:65,outcome:'The receipt stings, but the range feels good.'},
      {id:'basin-push',label:'Push Across The Basin',effects:{fuel:-16,rig:-5,morale:-4},score:175,outcome:'The RV gains serious ground. Griffin would like a note added that snacks were still possible.'},
      {id:'spike-pace',label:"Use Spike's Slow-And-Steady Rule",effects:{fuel:-8,rig:10,morale:4,days:1},score:95,outcome:'Spike sets the pace. Nothing rattles, nothing rushes, and somehow everyone relaxes.'}
    ]
  },
  7: {
    place:'Hill Country',
    title:'Boerne is close enough to feel real.',
    story:'Green hills fill the RV windows. Griffin senses a yard, Mittens senses sunbeams, and Spike senses a fine place to take his time. Kevin guides the family through the final miles.',
    choices:[
      {id:'backroads',label:'Take The Hill Country Back Roads',effects:{fuel:-8,morale:16},score:120,outcome:'The final miles turn scenic. Griffin looks out the window like he personally invented Texas.'},
      {id:'final-sweep',label:'Final Supply Sweep',effects:{budget:-8,snacks:14,morale:8},score:85,outcome:'The family arrives prepared for unpacking, which is mostly snacks with boxes nearby.'},
      {id:'goodboy-compass',label:"Trust Griffin's Good-Boy Compass",effects:{fuel:-10,snacks:-4,morale:20},score:150,outcome:'Griffin chooses joy as a navigation strategy. Against all odds, it works beautifully.'}
    ]
  }
};

const RESOURCE_LIMITS = {fuel:120,snacks:120,morale:120,rig:120,budget:140};
const RESOURCE_LABELS = {fuel:'Fuel',snacks:'Snacks',morale:'Morale',rig:'RV',budget:'Cash',days:'Days'};
const VALID_STATES = new Set(['camp','event','result','outing','driving','arrived']);
const VALID_CAPTAINS = new Set(PLAYABLE_IDS);

const clamp = (value,min=0,max=120) => Math.max(min,Math.min(max,Math.round(Number(value)||0)));
const clone = value => JSON.parse(JSON.stringify(value));
const byId = (items,id,fallback=items[0]) => items.find(item=>item.id===id)||fallback;

function clampResources(resources) {
  const next={};
  for(const key of Object.keys(RESOURCE_LIMITS)) next[key]=clamp(resources?.[key],0,RESOURCE_LIMITS[key]);
  return next;
}

function currentResources(game) {
  return {fuel:game.fuel,snacks:game.snacks,morale:game.morale,rig:game.rig,budget:game.budget};
}

function applyEffects(game,effects={}) {
  for(const [key,value] of Object.entries(effects)) {
    if(key==='days') game.days=Math.max(0,Math.round(game.days+(Number(value)||0)));
    else if(key in RESOURCE_LIMITS) game[key]=clamp(game[key]+value,0,RESOURCE_LIMITS[key]);
  }
}

export function canAfford(resources,effects={}) {
  for(const [key,value] of Object.entries(effects)) {
    if(value<0 && key in RESOURCE_LIMITS && (resources[key]||0)+value<0) return false;
  }
  return true;
}

export function formatEffects(effects={}) {
  return Object.entries(effects).map(([key,value])=>{
    const label=RESOURCE_LABELS[key]||key;
    const prefix=value>0?'+':'';
    return `${label} ${prefix}${value}`;
  }).join(' / ');
}

function driveEffects(leg,pace) {
  const miles=leg.miles;
  return {
    fuel:-Math.ceil(miles/45*pace.fuel),
    snacks:-Math.ceil(miles/125*pace.snacks),
    morale:-Math.ceil(miles/220*pace.morale),
    rig:-Math.ceil(miles/430*pace.rig),
    days:Math.max(1,Math.ceil(miles/330))+pace.days
  };
}

function scoreForLeg(leg,pace) {
  return Math.round(leg.miles*.22+pace.score);
}

export class TrailGame {
  constructor({random=Math.random}={}) {
    this.random=random;
    this.reset();
  }

  reset({captain='griffin',pack='balanced'}={}) {
    const selectedPack=byId(PACK_OPTIONS,pack);
    const resources=clampResources(selectedPack.resources);
    this.captain=VALID_CAPTAINS.has(captain)?captain:'griffin';
    this.pack=selectedPack.id;
    this.pace='steady';
    this.fuel=resources.fuel;this.snacks=resources.snacks;this.morale=resources.morale;this.rig=resources.rig;this.budget=resources.budget;
    this.days=0;this.legIndex=0;this.state='camp';this.score=0;this.arrivalBonus=0;this.completed=false;this.rescueCount=0;
    this.pendingEvent=null;this.pendingResult=null;this.activeOuting=null;this.supplyRunsUsed=[];this.lastNotice='';
    this.activeDrive=null;this.upgrades={tires:0,pantry:0,battery:0};this.driveReports=[];
    return this.status();
  }

  selectPack(id) {
    if(!this.status().packAvailable) return {ok:false,message:'The RV is already packed. Start a fresh trip to choose a new setup.'};
    const selectedPack=byId(PACK_OPTIONS,id,null);
    if(!selectedPack) return {ok:false,message:'Pick an RV setup.'};
    const resources=clampResources(selectedPack.resources);
    this.pack=selectedPack.id;
    this.fuel=resources.fuel;this.snacks=resources.snacks;this.morale=resources.morale;this.rig=resources.rig;this.budget=resources.budget;
    this.pendingResult={type:'service',outcome:`${selectedPack.label} loaded.`,effects:{},score:0};
    return {ok:true,status:this.status(),message:`${selectedPack.label} loaded.`};
  }

  setCaptain(id) {
    if(!VALID_CAPTAINS.has(id)) return {ok:false,message:'Choose a road captain.'};
    this.captain=id;
    return {ok:true,status:this.status()};
  }

  setPace(id) {
    const pace=byId(PACE_OPTIONS,id,null);
    if(!pace) return {ok:false,message:'Choose a travel pace.'};
    this.pace=pace.id;
    return {ok:true,status:this.status()};
  }

  service(id) {
    if(this.state!=='camp') return {ok:false,message:'Use services from a road stop.'};
    const action=byId(SERVICE_ACTIONS,id,null);
    if(!action) return {ok:false,message:'Choose a stop action.'};
    const resources=currentResources(this);
    if(!canAfford(resources,action.effects)) return {ok:false,message:'Not enough supplies for that move.',action};
    applyEffects(this,action.effects);
    this.pendingResult={type:'service',outcome:action.result,effects:action.effects,score:0};
    this.assistIfCritical('after-stop');
    return {ok:true,action,status:this.status()};
  }

  depart() {
    if(this.state!=='camp') return {ok:false,message:'Finish the current road moment first.'};
    const leg=this.currentLeg();
    if(!leg) return this.complete();
    const pace=byId(PACE_OPTIONS,this.pace);
    let effects=driveEffects(leg,pace);
    if(!canAfford(currentResources(this),effects)) {
      this.rescue('pre-departure');
      effects=driveEffects(leg,pace);
    }
    if(!canAfford(currentResources(this),effects)) return {ok:false,message:'Roadside help topped up the RV. Pick one stop action before leaving.'};
    applyEffects(this,effects);
    const legScore=scoreForLeg(leg,pace);
    this.score+=legScore;
    this.legIndex++;
    this.pendingEvent=clone(ROUTE_EVENTS[this.legIndex]);
    this.pendingResult=null;
    this.state='event';
    this.assistIfCritical('after-drive');
    return {ok:true,leg,effects,score:legScore,event:this.pendingEvent,status:this.status()};
  }

  previewDepart() {
    const leg=this.currentLeg();
    if(!leg) return null;
    const pace=byId(PACE_OPTIONS,this.pace);
    return {leg,pace,effects:driveEffects(leg,pace),score:scoreForLeg(leg,pace),affordable:canAfford(currentResources(this),driveEffects(leg,pace))};
  }

  beginDrive(){
    if(this.state!=='camp'||!this.currentLeg())return {ok:false,message:'Finish this stop first.'};
    const leg=this.currentLeg();
    this.activeDrive={legIndex:this.legIndex,captain:this.captain,pace:this.pace};
    this.state='driving';
    return {ok:true,leg,upgrades:{...this.upgrades},captain:this.captain,pace:this.pace};
  }

  finishDrive({hits=0,fuel=0,souvenirs=0,score=0,nearMisses=0}={}){
    if(this.state!=='driving'||!this.activeDrive)return {ok:false,message:'No RV drive to finish.'};
    const drive=this.activeDrive;this.activeDrive=null;this.state='camp';
    const departed=this.depart();
    if(!departed.ok)return departed;
    const bumps=clamp(hits,0,30),stars=bumps===0?3:bumps<=2?2:1;
    const effects={fuel:Math.min(18,clamp(fuel,0,30)*2),rig:-bumps*Math.max(2,5-this.upgrades.tires),budget:4+clamp(souvenirs,0,10)*3,morale:bumps===0?8:-Math.min(8,bumps)};
    if(drive.captain==='griffin'&&bumps===0)effects.morale+=4;
    applyEffects(this,effects);this.assistIfCritical('after-rv-drive');
    const bonus=clamp(score,0,10000);this.score+=bonus;
    const report={leg:this.legIndex,captain:drive.captain,stars,hits:bumps,score:bonus,souvenirs:clamp(souvenirs,0,10),nearMisses:clamp(nearMisses,0,50)};
    this.driveReports.push(report);
    return {...departed,report,effects};
  }

  upgrade(id){
    if(this.state!=='camp'||!Object.hasOwn(this.upgrades,id))return {ok:false,message:'Upgrade the RV at a campsite.'};
    const level=this.upgrades[id],cost=20+level*15;
    if(level>=3)return {ok:false,message:'Fully upgraded.'};
    if(this.budget<cost)return {ok:false,message:'A little more road cash needed.'};
    this.budget-=cost;this.upgrades[id]++;
    return {ok:true,level:this.upgrades[id],cost};
  }

  chooseEvent(id) {
    if(this.state!=='event'||!this.pendingEvent) return {ok:false,message:'There is no road decision waiting.'};
    const choice=this.pendingEvent.choices.find(item=>item.id===id);
    if(!choice) return {ok:false,message:'Choose one of the road options.'};
    if(!canAfford(currentResources(this),choice.effects)) return {ok:false,message:'Not enough supplies for that choice.',choice};
    applyEffects(this,choice.effects);
    this.score+=choice.score||0;
    const rescue=this.assistIfCritical('after-choice');
    this.pendingResult={type:'event',place:this.pendingEvent.place,title:choice.label,outcome:choice.outcome+(rescue?` ${rescue.outcome}`:''),effects:choice.effects,score:choice.score||0};
    this.state='result';
    return {ok:true,choice,result:this.pendingResult,status:this.status()};
  }

  continueEvent() {
    if(this.state!=='result') return {ok:false,message:'There is no result to continue.'};
    this.pendingEvent=null;
    if(this.legIndex>=TRAIL_STOPS.length-1) return this.complete();
    this.state='camp';
    return {ok:true,status:this.status()};
  }

  beginSupplyRun(captain=this.captain) {
    if(this.state!=='camp') return {ok:false,message:'Park the RV at a stop before starting a supply outing.'};
    if(this.legIndex>=TRAIL_STOPS.length-1) return {ok:false,message:'The family is already in Boerne.'};
    if(this.supplyRunsUsed.includes(this.legIndex)) return {ok:false,message:'This stop has already been searched.'};
    this.supplyRunsUsed.push(this.legIndex);
    this.captain=VALID_CAPTAINS.has(captain)?captain:this.captain;
    const stop=this.currentStop();
    const goal=Math.min(430,300+this.legIndex*24);
    const difficulty=Math.min(1.42,.9+this.legIndex*.07);
    this.activeOuting={id:`${this.legIndex}-${Date.now().toString(36)}-${Math.round(this.random()*9999)}`,stopIndex:this.legIndex,captain:this.captain,goal,difficulty,biomeIndex:stop.biomeIndex,place:stop.name};
    this.state='outing';
    this.pendingResult=null;
    return {ok:true,outing:this.activeOuting,status:this.status()};
  }

  finishSupplyRun({won=false,treats=0,score=0,hearts=0,captainId=this.captain}={}) {
    if(!this.activeOuting) return {ok:false,message:'There is no supply run to finish.'};
    const captain=VALID_CAPTAINS.has(captainId)?captainId:this.activeOuting.captain;
    const foundTreats=Math.max(0,Math.round(Number(treats)||0));
    const effects={
      snacks:(won?12:5)+Math.min(18,Math.floor(foundTreats/2)),
      budget:(won?8:3)+Math.min(12,Math.floor(foundTreats/5)),
      morale:won?8:-4
    };
    if(captain==='griffin'&&won) effects.morale+=6;
    if(captain==='kevin'&&won) effects.snacks+=8;
    if(captain==='mittens'&&won) effects.budget+=9;
    if(captain==='spike'&&won) {effects.rig=10;effects.morale+=2;}
    effects.snacks+=(this.upgrades.pantry||0)*3;
    applyEffects(this,effects);
    const runScore=Math.round((Number(score)||0)*.35+(won?120:40)+Math.max(0,hearts)*22);
    this.score+=runScore;
    const outcome=won?`${this.captainName(captain)} brought supplies back to the RV.`:`${this.captainName(captain)} made it back with a lighter haul, and the family kept moving.`;
    this.pendingResult={type:'supply',title:'Supply Run',outcome,effects,score:runScore};
    this.activeOuting=null;
    this.state='camp';
    this.assistIfCritical('after-supply');
    return {ok:true,result:this.pendingResult,status:this.status()};
  }

  recoverInterruptedRun() {
    if(this.state==='driving'){
      this.state='camp';this.activeDrive=null;this.lastNotice='Your RV is back at the last campsite. Ready when you are.';
    }
    if(this.state==='outing') {
      this.state='camp';
      this.activeOuting=null;
      this.lastNotice='The interrupted supply run returned safely to the RV.';
    }
    return this.status();
  }

  rescue(reason='critical') {
    this.rescueCount++;
    const effects={fuel:22,snacks:16,morale:14,rig:12,budget:-Math.min(12,this.budget),days:1};
    applyEffects(this,effects);
    const penalty=125+this.rescueCount*45;
    this.score=Math.max(0,this.score-penalty);
    return {outcome:'Roadside friends helped the family regroup. It cost a day and a few points, but nobody gets stranded.',effects,penalty,reason};
  }

  assistIfCritical(reason) {
    if(this.fuel>0&&this.snacks>0&&this.morale>0&&this.rig>0) return null;
    return this.rescue(reason);
  }

  complete() {
    if(this.completed) return {ok:true,bonus:0,status:this.status(),message:'Already home in Boerne.'};
    this.completed=true;
    this.state='arrived';
    this.legIndex=TRAIL_STOPS.length-1;
    this.pendingEvent=null;
    this.arrivalBonus=Math.round((this.fuel+this.snacks+this.morale+this.rig+this.budget)*1.8+Math.max(0,35-this.days)*18-this.rescueCount*60);
    this.score+=Math.max(0,this.arrivalBonus);
    this.pendingResult={type:'arrival',title:'Welcome To Boerne',outcome:'The RV rolls into Boerne with the whole family. Griffin inspects the yard, Mittens claims a sunbeam, and Spike takes his time. Kevin will always be part of the journey.',effects:{},score:this.arrivalBonus};
    return {ok:true,bonus:this.arrivalBonus,status:this.status()};
  }

  currentStop() {
    return TRAIL_STOPS[Math.max(0,Math.min(TRAIL_STOPS.length-1,this.legIndex))];
  }

  nextStop() {
    return TRAIL_STOPS[Math.min(TRAIL_STOPS.length-1,this.legIndex+1)];
  }

  currentLeg() {
    if(this.legIndex>=TRAIL_STOPS.length-1) return null;
    const from=TRAIL_STOPS[this.legIndex],to=TRAIL_STOPS[this.legIndex+1];
    return {index:this.legIndex+1,from,to,miles:to.mile-from.mile,biomeIndex:to.biomeIndex};
  }

  captainName(id=this.captain) {
    return ({griffin:'Griffin',kevin:'Kevin',mittens:'Mittens',spike:'Spike'})[id]||'Griffin';
  }

  serialize() {
    return {
      version:1,state:this.state,captain:this.captain,pack:this.pack,pace:this.pace,
      resources:currentResources(this),days:this.days,legIndex:this.legIndex,score:this.score,
      arrivalBonus:this.arrivalBonus,completed:this.completed,rescueCount:this.rescueCount,
      pendingEvent:this.pendingEvent,pendingResult:this.pendingResult,activeOuting:this.activeOuting,
      supplyRunsUsed:this.supplyRunsUsed,lastNotice:this.lastNotice
      ,upgrades:this.upgrades,driveReports:this.driveReports,activeDrive:this.activeDrive
    };
  }

  status() {
    const stop=this.currentStop(),next=this.nextStop(),leg=this.currentLeg(),resources=currentResources(this);
    return {
      state:this.state,captain:this.captain,pack:this.pack,pace:this.pace,days:this.days,score:this.score,legIndex:this.legIndex,
      arrivalBonus:this.arrivalBonus,completed:this.completed,rescueCount:this.rescueCount,
      route:TRAIL_STOPS,currentStop:stop,nextStop:next,currentLeg:leg,totalMiles:TRAIL_TOTAL_MILES,
      miles:stop.mile,progress:stop.mile/TRAIL_TOTAL_MILES,resources,
      fuel:this.fuel,snacks:this.snacks,morale:this.morale,rig:this.rig,budget:this.budget,
      pendingEvent:this.pendingEvent,pendingResult:this.pendingResult,activeOuting:this.activeOuting,
      supplyRunAvailable:this.state==='camp'&&this.legIndex<TRAIL_STOPS.length-1&&!this.supplyRunsUsed.includes(this.legIndex),
      supplyRunUsed:this.supplyRunsUsed.includes(this.legIndex),
      packAvailable:this.legIndex===0&&this.state==='camp'&&this.days===0&&this.supplyRunsUsed.length===0&&!Object.values(this.upgrades).some(Boolean),
      atStart:this.legIndex===0,arrived:this.state==='arrived',biome:stop.biome,biomeIndex:stop.biomeIndex,lastNotice:this.lastNotice
    };
  }

  static restore(data,{random=Math.random}={}) {
    const raw=typeof data==='string'?JSON.parse(data):data;
    if(!raw||raw.version!==1) return null;
    const game=new TrailGame({random});
    const resources=clampResources(raw.resources);
    game.state=VALID_STATES.has(raw.state)?raw.state:'camp';
    game.captain=VALID_CAPTAINS.has(raw.captain)?raw.captain:'griffin';
    game.pack=PACK_OPTIONS.some(item=>item.id===raw.pack)?raw.pack:'balanced';
    game.pace=PACE_OPTIONS.some(item=>item.id===raw.pace)?raw.pace:'steady';
    game.fuel=resources.fuel;game.snacks=resources.snacks;game.morale=resources.morale;game.rig=resources.rig;game.budget=resources.budget;
    game.days=clamp(raw.days,0,99);game.legIndex=clamp(raw.legIndex,0,TRAIL_STOPS.length-1);game.score=clamp(raw.score,0,999999);
    game.arrivalBonus=clamp(raw.arrivalBonus,0,999999);game.completed=Boolean(raw.completed);game.rescueCount=clamp(raw.rescueCount,0,20);
    game.pendingEvent=raw.pendingEvent&&typeof raw.pendingEvent==='object'?raw.pendingEvent:null;
    game.pendingResult=raw.pendingResult&&typeof raw.pendingResult==='object'?raw.pendingResult:null;
    game.activeOuting=raw.activeOuting&&typeof raw.activeOuting==='object'?raw.activeOuting:null;
    game.supplyRunsUsed=Array.isArray(raw.supplyRunsUsed)?raw.supplyRunsUsed.map(value=>clamp(value,0,TRAIL_STOPS.length-1)).filter((value,index,self)=>self.indexOf(value)===index):[];
    game.lastNotice=typeof raw.lastNotice==='string'?raw.lastNotice:'';
    game.upgrades={tires:clamp(raw.upgrades?.tires,0,3),pantry:clamp(raw.upgrades?.pantry,0,3),battery:clamp(raw.upgrades?.battery,0,3)};
    game.driveReports=Array.isArray(raw.driveReports)?raw.driveReports.filter(r=>r&&Number.isInteger(r.leg)&&r.leg>0&&r.leg<8).slice(0,7):[];
    game.activeDrive=raw.activeDrive&&typeof raw.activeDrive==='object'?raw.activeDrive:null;
    game.recoverInterruptedRun();
    if(game.completed||game.state==='arrived') {
      game.completed=true;
      game.legIndex=TRAIL_STOPS.length-1;
      game.state='arrived';
    }
    return game;
  }
}

export function restoreTrailGame(data,options) {
  try{return TrailGame.restore(data,options);}
  catch{return null;}
}
