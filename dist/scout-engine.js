// Trail Scout simulation: a seeded top-down maze with three chests, a gate key,
// a parcel for the neighbour, and the RV to return to. No DOM, so it runs in tests.
//
// Input, as the gesture controller uses it (all of it is driven by simulation
// time through update(dt), so pause freezes everything):
//   move(dx,dy)   a held direction from a swipe, drag, or key. The first step
//                 lands at once, then it repeats; move(0,0) on release.
//   step(dx,dy)   exactly one step, right now.
//   walkTo(x,y)   tap to walk: follow the shortest path through tiles already
//                 seen, one step per beat. A tap in the mist walks to the nearest
//                 known tile; a tap on the buddy uses whatever is in reach. Any
//                 move() or step() takes over. It never steps into bubbling mud.
//   hint(), power(), interact()
// Walking into a chest, the neighbour, or the RV uses it, so touch players never
// need an interact button; interact() still works from the next tile.
import {WORLDS} from './world-levels.js?v=23';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const copy=value=>JSON.parse(JSON.stringify(value));
const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const randomFor=seed=>{let n=seed>>>0;return()=>{n=(n+0x6d2b79f5)>>>0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};};
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
const cellKey=(x,y)=>`${x},${y}`;
let instanceSequence=0;
// Mud bubbles for 1.2 s of every 2.8 s and warns for the last 0.6 s before that.
const MUD_CYCLE=2.8,MUD_ACTIVE=1.2,MUD_WARN=.6;
const CRITTER_STEP=.46,CRITTER_AWAY=7,CRITTER_LIMIT=3;
const USABLE=['chest','npc','exit'],SIGHT=6;

export function scoutPath(grid,start,target){
  const queue=[{x:start.x,y:start.y}],seen=new Map([[cellKey(start.x,start.y),null]]);
  for(let i=0;i<queue.length;i++){
    const c=queue[i];if(c.x===target.x&&c.y===target.y){const path=[];let key=cellKey(c.x,c.y);while(key){const [x,y]=key.split(',').map(Number);path.push({x,y});key=seen.get(key);}return path.reverse();}
    for(const [dx,dy] of DIRS){const x=c.x+dx,y=c.y+dy,key=cellKey(x,y);if(grid[y]?.[x]===0&&!seen.has(key)){seen.set(key,cellKey(c.x,c.y));queue.push({x,y});}}
  }
  return [];
}

export function createScoutMap(worldIndex=0,seed){
  const world=Math.round(clamp(worldIndex,0,4)),cols=world<2?11:13,rows=world<2?9:11;
  const actualSeed=(Number(seed)>>>0)||hash(`onward-scout-${world}`),random=randomFor(actualSeed);
  const grid=Array.from({length:rows},()=>Array(cols).fill(1)),stack=[{x:1,y:1}];grid[1][1]=0;
  while(stack.length){const cell=stack.at(-1),options=DIRS.filter(([dx,dy])=>{const x=cell.x+dx*2,y=cell.y+dy*2;return x>0&&x<cols-1&&y>0&&y<rows-1&&grid[y][x]===1;});if(!options.length){stack.pop();continue;}const [dx,dy]=options[Math.floor(random()*options.length)],next={x:cell.x+dx*2,y:cell.y+dy*2};grid[cell.y+dy][cell.x+dx]=0;grid[next.y][next.x]=0;stack.push(next);}
  // A few loops give route choices and keep revisiting the delivery NPC pleasant.
  const loopWalls=[];for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++)if(grid[y][x]===1&&((grid[y][x-1]===0&&grid[y][x+1]===0)||(grid[y-1][x]===0&&grid[y+1][x]===0)))loopWalls.push({x,y});
  for(let i=0;i<2+world&&loopWalls.length;i++){const at=Math.floor(random()*loopWalls.length),c=loopWalls.splice(at,1)[0];grid[c.y][c.x]=0;}
  const start={x:1,y:1},rooms=[];for(let y=1;y<rows-1;y+=2)for(let x=1;x<cols-1;x+=2)rooms.push({x,y,distance:scoutPath(grid,start,{x,y}).length});
  rooms.sort((a,b)=>b.distance-a.distance);const exit={x:rooms[0].x,y:rooms[0].y},used=new Set([cellKey(start.x,start.y),cellKey(exit.x,exit.y)]);
  const npcRoom=[...rooms].reverse().find(c=>c.distance>=3&&!used.has(cellKey(c.x,c.y)));used.add(cellKey(npcRoom.x,npcRoom.y));
  const chests=[];
  for(let i=0;i<3;i++){
    const candidates=rooms.filter(c=>!used.has(cellKey(c.x,c.y)));
    candidates.sort((a,b)=>{const rank=c=>c.distance+(chests.length?Math.min(...chests.map(e=>Math.abs(e.x-c.x)+Math.abs(e.y-c.y)))*3:0);return rank(b)-rank(a);});
    const chosen=candidates[0];used.add(cellKey(chosen.x,chosen.y));chests.push({id:`chest-${i}`,type:'chest',kind:'treasure',x:chosen.x,y:chosen.y,taken:false,opened:false,parcel:i===0,ordinal:i+1});
  }
  const keyCell=rooms.find(c=>!used.has(cellKey(c.x,c.y)));used.add(cellKey(keyCell.x,keyCell.y));
  const npcNames=['Pip the river guide','Fern the trail keeper','Sunny the canyon scout','The starlight keeper','Mara from the neighborhood'];
  const entities=[...chests,{id:'key',type:'key',x:keyCell.x,y:keyCell.y,taken:false},{id:'npc',type:'npc',x:npcRoom.x,y:npcRoom.y,name:npcNames[world],delivered:false,taken:false},{id:'exit',type:'exit',...exit,taken:false}];
  let id=0;const free=[];for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++)if(grid[y][x]===0&&!used.has(cellKey(x,y)))free.push({x,y});
  for(const c of free)if(random()<.23){entities.push({id:`bone-${++id}`,type:'bone',...c,taken:false});used.add(cellKey(c.x,c.y));}
  const hazards=free.filter(c=>!used.has(cellKey(c.x,c.y))&&Math.abs(c.x-1)+Math.abs(c.y-1)>5);
  for(let i=0;i<2+Math.floor(world/2)&&hazards.length;i++){const c=hazards.splice(Math.floor(random()*hazards.length),1)[0];entities.push({id:`hazard-${i}`,type:'hazard',...c,phase:random()*2.8,active:false,taken:false});}
  // Optional extras draw from their own random stream, so the course above is
  // exactly what it always was for a given seed.
  const extra=randomFor(hash(`scout-extras-${world}-${actualSeed}`)),open=(x,y)=>grid[y]?.[x]===0,taken=new Set(entities.map(e=>cellKey(e.x,e.y)));
  const spare=free.filter(c=>!taken.has(cellKey(c.x,c.y))).map(c=>({...c,distance:scoutPath(grid,start,c).length,exits:DIRS.filter(([dx,dy])=>open(c.x+dx,c.y+dy)).length}));
  // A hidden golden paw waits off the beaten path: a quiet dead end if there is
  // one, otherwise anywhere the quest's own routes do not cross.
  const quest=entities.filter(e=>e.type!=='bone'&&e.type!=='hazard'),beaten=new Set(),tread=(from,to)=>{for(const c of scoutPath(grid,from,to))beaten.add(cellKey(c.x,c.y));};
  for(const e of quest){tread(start,e);if(e.type==='chest')tread(e,npcRoom);if(e.type==='key')tread(e,exit);}
  const quiet=spare.filter(c=>c.distance>=6&&!beaten.has(cellKey(c.x,c.y))),far=spare.filter(c=>c.distance>=7);
  const pawSpots=[quiet.filter(c=>c.exits===1),quiet,far.filter(c=>c.exits===1),far].find(list=>list.length);
  if(pawSpots){const c=pawSpots[Math.floor(extra()*pawSpots.length)];entities.push({id:'paw',type:'paw',x:c.x,y:c.y,taken:false,revealed:false});}
  // A butterfly flutters along a fixed loop, so where it is depends only on the clock.
  const critterRoute=[],floor=[];for(let y=1;y<rows-1;y++)for(let x=1;x<cols-1;x++)if(open(x,y)&&Math.abs(x-1)+Math.abs(y-1)>4)floor.push({x,y});
  if(floor.length){
    let at=floor[Math.floor(extra()*floor.length)],last=null;
    for(let i=0;i<70;i++){
      critterRoute.push({x:at.x,y:at.y});if(extra()<.16)for(let rest=0;rest<3;rest++)critterRoute.push({x:at.x,y:at.y});
      const ways=DIRS.map(([dx,dy])=>({x:at.x+dx,y:at.y+dy})).filter(c=>open(c.x,c.y)),onward=ways.filter(c=>!last||c.x!==last.x||c.y!==last.y),choice=onward.length?onward:ways;
      last=at;at=choice[Math.floor(extra()*choice.length)];
    }
    // Out and back again makes a seamless loop.
    for(let i=critterRoute.length-2;i>0;i--)critterRoute.push({...critterRoute[i]});
    entities.push({id:'critter',type:'critter',x:critterRoute[0].x,y:critterRoute[0].y,renderX:critterRoute[0].x,renderY:critterRoute[0].y,hidden:false,taken:false});
  }
  return {worldIndex:world,seed:actualSeed,cols,rows,grid,start,exit,entities,critterRoute};
}

export class ScoutRun {
  constructor({onEvent=()=>{}}={}){this.onEvent=onEvent;this._instance=++instanceSequence;this._runs=0;this._silent=true;this.reset();this._silent=false;this.mode='ready';}
  emit(type,data={}){if(!this._silent)this.onEvent({...data,type});}
  reset({worldIndex=0,characterId='griffin',seed,assist=false,gear={},charms={},dailyDate='',checkpoint}={}){
    const map=createScoutMap(worldIndex,seed);Object.assign(this,map);this.width=map.cols;this.height=map.rows;this.world=WORLDS[this.worldIndex];
    this.runMode='scout';this.mode='running';this.finished=false;this.stage=this.worldIndex;this.levelId=`scout-${this.world.id}`;this.goal=Infinity;this.timeLimit=0;
    this.characterId=['griffin','kevin','mittens','spike'].includes(characterId)?characterId:'griffin';this.assist=Boolean(assist);this.dailyDate=String(dailyDate||'');
    this.gear={magnet:Math.round(clamp(gear.magnet,0,3)),charge:Math.round(clamp(gear.charge,0,3)),heart:Math.round(clamp(gear.heart,0,2))};
    this.charms={shieldStart:!!charms.shieldStart,comboGrace:clamp(charms.comboGrace,0,5),goldDuration:clamp(charms.goldDuration,0,4),powerDuration:clamp(charms.powerDuration,0,4),speed:clamp(charms.speed,0,.25)};
    this.runId=`scout-${Date.now().toString(36)}-${this._instance}-${++this._runs}`;
    this.player={x:1,y:1,renderX:1,renderY:1,previousX:1,previousY:1,facing:1,moving:0};this._dx=0;this._dy=0;this._moveTimer=0;this._route=[];this.walkTarget=null;
    this.time=0;this.steps=0;this.distance=0;this.score=0;this.treats=0;this.gold=0;this.keys=0;this.treasures=0;this.secrets=0;this.chests=0;this.stomps=0;this.blocks=0;this.checkpoints=0;
    this.parcel=false;this.deliveryDone=false;this.questStarted=false;this.hintsRemaining=3;this.hintPath=[];this.hintTime=0;this.interaction=null;
    this.critters=0;this.trailTreats=0;this.trails=0;this.goldenPaw=0;this._critterAway=0;
    this.maxHearts=3+(this.characterId==='spike'?1:0)+this.gear.heart+(this.assist?1:0);this.hearts=this.maxHearts;this.hits=0;this.invincible=0;this.shieldCharges=this.charms.shieldStart?1:0;
    this.charge=50+this.gear.charge*10;this.powerTime=0;this.powerDuration=0;this.powersUsed=0;this.combo=0;this.bestCombo=0;this.multiplier=1;this.bestMultiplier=1;this.comboTime=0;this.feverTime=0;this.goldRushTime=0;this.magnetTime=0;this._feverCooldown=0;
    this.seen=Array.from({length:this.rows},()=>Array(this.cols).fill(false));this.visited=Array.from({length:this.rows},()=>Array(this.cols).fill(false));this.explored=0;this._visit();
    this._config={worldIndex:this.worldIndex,characterId:this.characterId,seed:this.seed,assist:this.assist,gear:{...this.gear},charms:{...this.charms},dailyDate:this.dailyDate};
    if(checkpoint?.kind==='scout'&&this.restore(checkpoint))return this;
    this.emit('start',{runId:this.runId,mode:'scout',worldIndex:this.worldIndex});return this;
  }
  get totalMultiplier(){return this.multiplier*(this.feverTime>0?2:1)*(this.goldRushTime>0?2:1)*(this.powerTime>0&&this.characterId==='griffin'?1.5:1);}
  _gainCharge(n){const before=this.charge;this.charge=Math.min(this.powerTime>0?90:100,this.charge+n*(1+this.gear.charge*.12));if(before<100&&this.charge===100)this.emit('charged');}
  move(dx=0,dy=0){
    if(this.mode!=='running'&&(dx||dy))return false;
    let x=Math.sign(Number(dx)||0),y=Math.sign(Number(dy)||0);if(x&&y)x=0;
    const changed=x!==this._dx||y!==this._dy;this._dx=x;this._dy=y;
    if(!x&&!y){if(!this._route.length)this.player.moving=0;return true;}
    // Commit a tap at input time. A press and release between animation frames
    // must still move once; the cooldown then owns all held-key repeats.
    if(changed){this.step(x,y);this._moveTimer=this._moveDelay();}
    return true;
  }
  _moveDelay(){return (this.assist?.19:.15)/(1+this.charms.speed);}
  // One step, right now. Any step the player makes by hand ends a tap-to-walk route.
  step(dx,dy){if(this.mode!=='running')return false;this._endWalk('manual');return this._go(dx,dy);}
  _go(dx,dy,auto=false){
    if(this.mode!=='running')return false;const x=Math.sign(Number(dx)||0),y=x?0:Math.sign(Number(dy)||0);if(!x&&!y)return false;
    const p=this.player,nextX=p.x+x,nextY=p.y+y;if(x)p.facing=x;p.moving=x||y;
    if(this.grid[nextY]?.[nextX]!==0){this.emit('bump',{x:p.x,y:p.y,dx:x,dy:y});return false;}
    p.previousX=p.x;p.previousY=p.y;p.x=nextX;p.y=nextY;this.steps++;this.distance=this.steps*48;this._visit();this._collectCell();this._interaction();
    this.emit('step',{x:p.x,y:p.y,dx:x,dy:y,steps:this.steps,auto});this._meetCritter();this._arrive();return true;
  }
  // There is no interact button on a phone: walking into a chest, the neighbour,
  // or the RV uses it. Passing the neighbour again later is only a friendly wave.
  _arrive(){
    if(this.mode!=='running')return false;const p=this.player,e=this.entities.find(e=>!e.taken&&USABLE.includes(e.type)&&e.x===p.x&&e.y===p.y);if(!e)return false;
    if(e.type==='npc'&&this.questStarted&&!(this.parcel&&!this.deliveryDone)){this.emit('greet',{x:e.x,y:e.y,name:e.name,delivered:this.deliveryDone});return false;}
    // A tap-to-walk that merely passes the parked RV on its way elsewhere keeps going.
    const ready=this.treasures>=3&&this.keys>=1&&this.deliveryDone,goal=this.walkTarget;if(e.type==='exit'&&!ready&&goal&&(goal.x!==e.x||goal.y!==e.y))return false;
    this._use(e);this._endWalk('interact');return true;
  }
  // --- tap to walk ------------------------------------------------------
  // Follows the shortest path through places the buddy has already seen, one
  // step per move beat of simulation time. Tapping into the mist walks to the
  // nearest known spot on the way. Returns false when there is nowhere to go.
  walkTo(x,y){
    if(this.mode!=='running')return false;x=Math.round(Number(x));y=Math.round(Number(y));if(!Number.isFinite(x)||!Number.isFinite(y))return false;
    const p=this.player;if(x===p.x&&y===p.y){this._endWalk('manual');return this.interact();}
    const route=this._routeTo(x,y);
    if(!route.length){this._endWalk('manual');this.emit('bump',{x:p.x,y:p.y,dx:Math.abs(x-p.x)>=Math.abs(y-p.y)?Math.sign(x-p.x):0,dy:Math.abs(x-p.x)>=Math.abs(y-p.y)?0:Math.sign(y-p.y),blocked:true});return false;}
    this._dx=0;this._dy=0;this._route=route;this.walkTarget={...route.at(-1)};this.emit('walk',{x:this.walkTarget.x,y:this.walkTarget.y,steps:route.length});
    if(this._moveTimer<=0)this._walkStep();return true;
  }
  get route(){return this._route;}
  get walking(){return this._route.length>0;}
  _routeTo(tx,ty){
    const p=this.player,known=(x,y)=>this.grid[y]?.[x]===0&&this.seen[y][x],queue=[{x:p.x,y:p.y}],from=new Map([[cellKey(p.x,p.y),null]]);
    let best=null,bestGap=Math.abs(tx-p.x)+Math.abs(ty-p.y);
    for(let i=0;i<queue.length&&bestGap;i++){
      const c=queue[i],gap=Math.abs(tx-c.x)+Math.abs(ty-c.y);if(gap<bestGap){best=c;bestGap=gap;}
      for(const [dx,dy] of DIRS){const x=c.x+dx,y=c.y+dy,key=cellKey(x,y);if(known(x,y)&&!from.has(key)){from.set(key,c);queue.push({x,y});}}
    }
    const route=[];for(let c=best;c&&from.get(cellKey(c.x,c.y));c=from.get(cellKey(c.x,c.y)))route.push({x:c.x,y:c.y});return route.reverse();
  }
  _mudAhead(cell){const e=this.entities.find(e=>e.type==='hazard'&&!e.taken&&e.x===cell.x&&e.y===cell.y);return Boolean(e&&((this.time+e.phase)%MUD_CYCLE)<MUD_ACTIVE&&this.invincible<=0&&this.powerTime<=0);}
  _walkStep(){
    const next=this._route[0],p=this.player;if(!next)return;
    // Never walk a child into bubbling mud. Easygoing waits it out; otherwise the walk stops there.
    if(this._mudAhead(next)){if(this.assist){this._moveTimer=.05;if(!this._waiting){this._waiting=true;this.emit('walk-wait',{x:next.x,y:next.y});}}else this._endWalk('hazard',next);return;}
    this._waiting=false;this._route.shift();
    if(!this._go(next.x-p.x,next.y-p.y,true)){this._endWalk('blocked');return;}
    this._moveTimer=this._moveDelay();if(!this._route.length)this._endWalk('arrived');
  }
  // Exactly one 'walk-end' per walk: arrived, interact, hazard, blocked, or manual.
  _endWalk(reason,at=this.walkTarget){const target=this.walkTarget;this._route=[];this.walkTarget=null;this._waiting=false;if(target)this.emit('walk-end',{reason,x:at.x,y:at.y});}
  _visit(){const p=this.player;if(!this.visited[p.y][p.x]){this.visited[p.y][p.x]=true;this.explored++;}const radius=this.characterId==='kevin'&&this.powerTime>0?5:2;for(let y=p.y-radius;y<=p.y+radius;y++)for(let x=p.x-radius;x<=p.x+radius;x++)if(this.seen[y]?.[x]!==undefined&&Math.abs(x-p.x)+Math.abs(y-p.y)<=radius)this.seen[y][x]=true;
    // The buddy also sees straight down an open trail, hedges and all, up to six tiles.
    for(const [dx,dy] of DIRS){let x=p.x+dx,y=p.y+dy;for(let n=0;n<SIGHT&&this.grid[y]?.[x]===0;n++,x+=dx,y+=dy)for(const side of [-1,0,1])if(this.seen[y+dx*side]?.[x+dy*side]!==undefined)this.seen[y+dx*side][x+dy*side]=true;if(this.seen[y]?.[x]!==undefined)this.seen[y][x]=true;}
    // The golden paw only shows itself to a nose that is right beside it (or to Kevin's radar).
    for(const e of this.entities)if(e.type==='paw'&&!e.taken&&!e.revealed&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=(radius>2?radius:1)){e.revealed=true;this.emit('paw-reveal',{x:e.x,y:e.y});}
  }
  _collectCell(){
    const p=this.player;for(const e of this.entities){if(e.taken||e.x!==p.x||e.y!==p.y)continue;
      if(e.type==='bone'){e.taken=true;this._snack('bone',e);}
      else if(e.type==='key'){e.taken=true;this.keys++;this.score+=75;this._gainCharge(12);this.emit('collect',{kind:'key',value:75,x:e.x,y:e.y});}
      else if(e.type==='hazard'&&((this.time+e.phase)%MUD_CYCLE)<MUD_ACTIVE)this._damage(e);
      else if(e.type==='trail'){
        e.taken=true;this.trailTreats++;this._snack('bone',e,{trail:e.trail});
        const group=this.entities.filter(t=>t.type==='trail'&&t.trail===e.trail);
        // Every treat of a trail before it fades: the Gold Rush runs a little longer.
        if(group.every(t=>t.taken&&!t.expired)){this.trails++;this.goldRushTime=Math.min(12+this.charms.goldDuration*2,this.goldRushTime+3);this.bestMultiplier=Math.max(this.bestMultiplier,this.totalMultiplier);const value=Math.round(100*this.totalMultiplier);this.score+=value;this.emit('trail-complete',{x:e.x,y:e.y,value,count:group.length,totalMultiplier:this.totalMultiplier});this.emit('gold-rush',{duration:this.goldRushTime});}
      }
      else if(e.type==='paw'){
        e.taken=true;e.revealed=true;this.goldenPaw=1;this.treats+=5;this._gainCharge(20);this.goldRushTime=Math.min(12+this.charms.goldDuration*2,this.goldRushTime+4+this.charms.goldDuration);
        this.bestMultiplier=Math.max(this.bestMultiplier,this.totalMultiplier);const value=Math.round(150*this.totalMultiplier);this.score+=value;
        this.emit('paw',{x:e.x,y:e.y,value,totalMultiplier:this.totalMultiplier});this.emit('gold-rush',{duration:this.goldRushTime});
      }
    }
  }
  // Catching the butterfly adds a whole link to the chain. Three visits per outing.
  _meetCritter(){
    if(this.mode!=='running')return;const p=this.player,e=this.entities.find(e=>e.type==='critter'&&!e.hidden&&e.x===p.x&&e.y===p.y);if(!e)return;
    this.critters++;this._critterAway=this.time+CRITTER_AWAY;e.hidden=true;this.treats+=2;this._gainCharge(10);
    this.combo+=6;this.bestCombo=Math.max(this.bestCombo,this.combo);this.multiplier=Math.min(5,1+Math.floor(this.combo/6));this.comboTime=8+this.charms.comboGrace;
    if(this.combo>=18&&this._feverCooldown===0){this.feverTime=8;this._feverCooldown=22;this.emit('fever',{duration:8});}
    this.bestMultiplier=Math.max(this.bestMultiplier,this.totalMultiplier);const value=Math.round(50*this.totalMultiplier);this.score+=value;
    this.emit('critter',{x:e.x,y:e.y,count:this.critters,left:CRITTER_LIMIT-this.critters,value,combo:this.combo,multiplier:this.multiplier,totalMultiplier:this.totalMultiplier});
  }
  // After a chest, a short line of treats points the way to what comes next.
  _spawnTrail(chest){
    const choice=this._targets().map(target=>scoutPath(this.grid,chest,target)).filter(path=>path.length>1).sort((a,b)=>a.length-b.length)[0];if(!choice)return;
    const busy=new Set(this.entities.filter(e=>!e.taken&&e.type!=='critter').map(e=>cellKey(e.x,e.y))),cells=choice.slice(1).filter(c=>!busy.has(cellKey(c.x,c.y))).slice(0,6);if(cells.length<3)return;
    const life=this.assist?10:7;cells.forEach((c,i)=>this.entities.push({id:`trail-${chest.ordinal}-${i}`,type:'trail',x:c.x,y:c.y,taken:false,expired:false,trail:chest.ordinal,order:i,born:this.time,expires:this.time+life+i*.6}));
    this.emit('trail',{x:chest.x,y:chest.y,count:cells.length,cells:copy(cells),duration:life});
  }
  // What the quest wants next, in the order the trail keeper explains it.
  _targets(){
    if(this.parcel&&!this.deliveryDone)return this.entities.filter(e=>e.type==='npc');
    if(this.treasures<3)return this.entities.filter(e=>e.type==='chest'&&!e.taken);
    if(this.keys<1)return this.entities.filter(e=>e.type==='key'&&!e.taken);
    if(!this.deliveryDone)return this.entities.filter(e=>e.type==='npc');
    return this.entities.filter(e=>e.type==='exit');
  }
  _snack(kind,e,extra){
    this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.multiplier=Math.min(5,1+Math.floor(this.combo/6));this.comboTime=8+this.charms.comboGrace;
    this.treats+=kind==='gold'?3:1;if(kind==='gold'){this.gold++;this.goldRushTime=Math.min(12+this.charms.goldDuration*2,this.goldRushTime+4+this.charms.goldDuration);this.emit('gold-rush',{duration:this.goldRushTime});}
    if(this.combo>=18&&this._feverCooldown===0){this.feverTime=8;this._feverCooldown=22;this.emit('fever',{duration:8});}
    if(this.combo%6===0)this.emit('combo',{combo:this.combo,multiplier:this.multiplier});this._gainCharge(kind==='gold'?15:5);
    this.bestMultiplier=Math.max(this.bestMultiplier,this.totalMultiplier);const value=Math.round((kind==='gold'?100:10)*this.totalMultiplier);this.score+=value;this.emit('collect',{kind,value,x:e.x,y:e.y,multiplier:this.multiplier,totalMultiplier:this.totalMultiplier,combo:this.combo,...extra});
  }
  _damage(e){
    if(this.invincible>0||this.powerTime>0)return;if(this.shieldCharges>0){this.shieldCharges--;this.invincible=1.3;this.emit('shield',{x:e.x,y:e.y});return;}
    this.hearts--;this.hits++;this.invincible=1.3;this.combo=0;this.multiplier=1;this.comboTime=0;this.emit('hit',{hearts:this.hearts,reason:'mud',x:e.x,y:e.y});if(this.hearts<=0)this._finish(false);
  }
  _interaction(){
    const p=this.player,e=this.entities.filter(e=>!e.taken&&['chest','npc','exit'].includes(e.type)&&Math.abs(e.x-p.x)+Math.abs(e.y-p.y)<=1).sort((a,b)=>(Math.abs(a.x-p.x)+Math.abs(a.y-p.y))-(Math.abs(b.x-p.x)+Math.abs(b.y-p.y)))[0];
    const previous=this.interaction?.id;this.interaction=e?{id:e.id,type:e.type,x:e.x,y:e.y,text:e.type==='chest'?'Open the treasure chest':e.type==='npc'?(this.parcel?'Deliver the picnic bundle':'Talk to the trail keeper'):'Head onward'}:null;
    if(previous!==this.interaction?.id)this.emit('prompt',this.interaction||{id:null,text:''});
  }
  interact(){
    if(this.mode!=='running')return false;this._interaction();const e=this.entities.find(e=>e.id===this.interaction?.id);if(!e)return false;
    return this._use(e);
  }
  _use(e){
    if(e.type==='chest'){
      e.taken=true;e.opened=true;this.chests++;this.treasures++;this.secrets++;for(let i=0;i<8;i++)this._snack('bone',e);this._snack('gold',e);
      if(e.parcel){this.parcel=true;this.emit('parcel',{x:e.x,y:e.y,text:'The picnic bundle! Bring it back to the trail keeper.'});}
      this.emit('chest',{x:e.x,y:e.y,treasures:this.treasures,parcel:!!e.parcel});this._spawnTrail(e);this._interaction();return true;
    }
    if(e.type==='npc'){
      this.questStarted=true;
      if(this.parcel&&!this.deliveryDone){this.parcel=false;this.deliveryDone=true;e.delivered=true;this.score+=250;this.treats+=5;this.hearts=Math.min(this.maxHearts,this.hearts+1);this.emit('deliver',{x:e.x,y:e.y,name:e.name,value:250});}
      this.emit('dialog',{name:e.name,text:this.deliveryDone?'The picnic is saved. Find all three treasures and the gate key, then head onward!':'Three snack chests are hidden along the paths. One holds our picnic bundle. Bring it back to me, then use the gate key to head onward.'});return true;
    }
    if(e.type==='exit'){
      if(this.treasures>=3&&this.keys>=1&&this.deliveryDone){this._finish(true);return true;}
      this.emit('locked',{text:!this.deliveryDone?'Bring the picnic bundle back to the trail keeper first.':this.keys<1?'Find the gate key before heading onward.':'Find all three treasure chests before heading onward.',treasures:this.treasures,keys:this.keys,deliveryDone:this.deliveryDone});return false;
    }
    return false;
  }
  hint(){
    if(this.mode!=='running'||this.hintsRemaining<=0)return null;const targets=this._targets();
    const choices=targets.map(target=>({target,path:scoutPath(this.grid,this.player,target)})).filter(e=>e.path.length).sort((a,b)=>a.path.length-b.path.length);if(!choices.length)return null;
    const {target,path}=choices[0],next=path[1]||path[0];this.hintsRemaining--;this.hintPath=path;this.hintTime=7;for(const c of path)this.seen[c.y][c.x]=true;
    const hint={dx:next.x-this.player.x,dy:next.y-this.player.y,target:{id:target.id,type:target.type,x:target.x,y:target.y},path:copy(path),remaining:this.hintsRemaining};this.emit('hint',hint);return hint;
  }
  power(){
    if(this.mode!=='running'||this.charge<100||this.powerTime>0)return false;this.charge=0;this.powersUsed++;this.powerDuration=5+this.charms.powerDuration;this.powerTime=this.powerDuration;
    if(this.characterId==='mittens')this.hearts=Math.min(this.maxHearts,this.hearts+1);if(this.characterId==='spike')this.shieldCharges=Math.min(2,this.shieldCharges+1);if(this.characterId==='kevin')this._visit();
    this.bestMultiplier=Math.max(this.bestMultiplier,this.totalMultiplier);this.emit('power',{characterId:this.characterId,duration:this.powerDuration});return true;
  }
  jump(){return false;}
  releaseJump(){}
  slide(){return false;}
  pause(){if(this.mode!=='running')return;this.mode='paused';this._dx=0;this._dy=0;this._route=[];this.walkTarget=null;this._waiting=false;this.player.moving=0;this.emit('pause');}
  resume(){if(this.mode!=='paused')return;this.mode='running';this.emit('resume');}
  update(dt){if(this.mode!=='running')return;let left=clamp(dt,0,.1);while(left>1e-8&&this.mode==='running'){const t=Math.min(1/120,left);left-=t;this._step(t);}}
  _step(dt){
    this.time+=dt;for(const key of ['invincible','powerTime','feverTime','goldRushTime','comboTime','hintTime','_feverCooldown'])this[key]=Math.max(0,this[key]-dt);
    if(!this.comboTime&&this.combo){this.combo=0;this.multiplier=1;}if(!this.hintTime)this.hintPath=[];this._gainCharge(dt);
    for(const e of this.entities){
      if(e.type==='hazard'){const t=(this.time+e.phase)%MUD_CYCLE;e.active=t<MUD_ACTIVE;e.warn=t>=MUD_CYCLE-MUD_WARN;}
      else if(e.type==='trail'){if(!e.taken&&this.time>=e.expires){e.taken=true;e.expired=true;this.emit('trail-fade',{x:e.x,y:e.y});}}
      else if(e.type==='critter')this._flutter(e);
    }
    this._moveTimer-=dt;
    if(this._dx||this._dy){if(this._moveTimer<=0){this.step(this._dx,this._dy);this._moveTimer=this._moveDelay();}}
    else if(this._route.length){if(this._moveTimer<=0)this._walkStep();}
    else this.player.moving=0;
    const blend=Math.min(1,dt*24);this.player.renderX+=(this.player.x-this.player.renderX)*blend;this.player.renderY+=(this.player.y-this.player.renderY)*blend;
  }
  // The butterfly's place is a pure function of the clock, so pausing, saving,
  // and whatever the player does never change where it will be.
  _flutter(e){
    const route=this.critterRoute,n=route?.length;if(!n)return;
    const beat=this.time/CRITTER_STEP,i=Math.floor(beat),f=beat-i,a=route[i%n],b=route[(i+1)%n],glide=f*f*(3-2*f),was=e.hidden;
    e.renderX=a.x+(b.x-a.x)*glide;e.renderY=a.y+(b.y-a.y)*glide;const at=f<.5?a:b;e.x=at.x;e.y=at.y;
    e.hidden=this.critters>=CRITTER_LIMIT||this.time<this._critterAway;if(was&&!e.hidden)this.emit('critter-back',{x:e.x,y:e.y});
    if(!e.hidden&&e.x===this.player.x&&e.y===this.player.y)this._meetCritter();
  }
  _finish(won){if(this.mode!=='running'||this.finished)return;this.finished=true;this.mode=won?'won':'lost';this._dx=0;this._dy=0;this._route=[];this.walkTarget=null;if(won)this.score+=300+this.hearts*80;this.emit(won?'won':'lost',{result:this.result()});}
  result(){return {runId:this.runId,mode:'scout',state:this.mode,worldIndex:this.worldIndex,stage:this.worldIndex,levelId:this.levelId,characterId:this.characterId,won:this.mode==='won',score:Math.round(this.score),treats:this.treats,gold:this.gold,keys:this.keys,treasures:this.treasures,secrets:this.secrets,chests:this.chests,deliveryDone:this.deliveryDone,steps:this.steps,explored:this.explored,hintsUsed:3-this.hintsRemaining,hits:this.hits,hearts:this.hearts,maxHearts:this.maxHearts,bestCombo:this.bestCombo,bestMultiplier:this.bestMultiplier,stomps:0,blocks:0,checkpoints:0,powersUsed:this.powersUsed,time:Number(this.time.toFixed(3)),distance:this.distance,seed:this.seed,assist:this.assist,dailyDate:this.dailyDate,letters:0,dodged:0,nearMisses:0,critters:this.critters,trailTreats:this.trailTreats,trails:this.trails,goldenPaw:this.goldenPaw>0};}
  snapshot(){const state={};for(const key of ['time','steps','distance','score','treats','gold','keys','treasures','secrets','chests','parcel','deliveryDone','questStarted','hintsRemaining','hearts','hits','invincible','shieldCharges','charge','powerTime','powerDuration','powersUsed','combo','bestCombo','multiplier','bestMultiplier','comboTime','feverTime','goldRushTime','_feverCooldown','explored','critters','trailTreats','trails','goldenPaw','_critterAway'])state[key]=this[key];return copy({version:1,kind:'scout',mode:this.mode,config:this._config,runId:this.runId,state,player:this.player,entities:this.entities,seen:this.seen,visited:this.visited});}
  restore(saved){
    if(saved?.version!==1||saved.kind!=='scout'||!['running','paused'].includes(saved.mode)||!saved.config||!saved.state||!saved.player)return false;
    this.reset({...saved.config,checkpoint:undefined});const {x,y}=saved.player;if(!Number.isInteger(x)||!Number.isInteger(y)||this.grid[y]?.[x]!==0)return false;
    for(const [key,value] of Object.entries(saved.state))if(Object.hasOwn(this,key)){if(typeof this[key]==='number')this[key]=clamp(value,0,1e9);else if(typeof this[key]==='boolean')this[key]=!!value;}
    this.hearts=clamp(this.hearts,1,this.maxHearts);this.hintsRemaining=clamp(this.hintsRemaining,0,3);this.player={...this.player,...saved.player,x,y,renderX:x,renderY:y};
    for(const change of Array.isArray(saved.entities)?saved.entities:[]){const e=this.entities.find(e=>e.id===change.id);if(e)for(const key of ['taken','opened','delivered','revealed'])if(change[key]!==undefined)e[key]=!!change[key];}
    for(const name of ['seen','visited'])if(Array.isArray(saved[name])&&saved[name].length===this.rows&&saved[name].every(row=>Array.isArray(row)&&row.length===this.cols))this[name]=saved[name].map(row=>row.map(Boolean));
    this.runId=typeof saved.runId==='string'?saved.runId.slice(0,150):this.runId;this.mode='running';this.finished=false;this._interaction();this.emit('restore',{worldIndex:this.worldIndex,x,y});return true;
  }
}
