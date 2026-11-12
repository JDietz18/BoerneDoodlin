// Snack Storm: catch falling treats with the same scoring and result vocabulary
// as the trail runner. Rendering, input devices, audio, and storage stay outside.
export const SNACK_WORLD=Object.freeze({width:1120,height:630,ground:492,minX:80,maxX:1040});
const WIDTH=120,HEIGHT=82,LIMIT=45;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const level=(value,max=3)=>Math.round(clamp(value,0,max));
const rngFor=seed=>{let n=(Number(seed)>>>0)||1;return()=>{n=(n+0x6d2b79f5)>>>0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};};
let instanceSequence=0;

export class SnackStorm {
  constructor({onEvent=()=>{},random,seed=1}={}){
    this.onEvent=onEvent;this._providedRandom=typeof random==='function'?random:null;this._defaultSeed=Number(seed)>>>0;
    this._instance=++instanceSequence;this._runs=0;this._silent=true;this.reset();this._silent=false;this.mode='ready';
  }
  emit(type,data={}){if(!this._silent)this.onEvent({...data,type});}
  reset({characterId='griffin',gear={},assist=false,seed}={}){
    this.runMode='snack';this.mode='running';this.stage=0;this.regionId='rogue-river';this.dailyDate='';
    this.characterId=['griffin','kevin','mittens','spike'].includes(characterId)?characterId:'griffin';
    this.gear={magnet:level(gear.magnet),charge:level(gear.charge),heart:level(gear.heart,2),grace:level(gear.grace)};
    this.assist=Boolean(assist);this.seed=(Number(seed??this._defaultSeed)>>>0)||1;
    this._random=seed===undefined&&this._providedRandom?this._providedRandom:rngFor(this.seed);
    this.runId=`snack-${Date.now().toString(36)}-${this._instance}-${++this._runs}`;
    this.time=0;this.timeLimit=LIMIT;this.goal=Infinity;this.distance=0;this.speed=165;
    this.player={x:560,y:0,vy:0,vx:0,grounded:true,sliding:false,width:WIDTH,height:HEIGHT,moving:0,facing:1,jumps:0};
    this._moveDirection=0;this._targetX=null;
    this.score=0;this.treats=0;this.gold=0;this.letters=0;this.letterMask=0;
    this.maxHearts=3+(this.characterId==='spike'?1:0)+this.gear.heart+(this.assist?1:0);this.hearts=this.maxHearts;
    this.charge=50+this.gear.charge*10;this.powerTime=0;this.powerDuration=0;this.powersUsed=0;
    this.invincible=0;this.shieldCharges=0;this.magnetTime=0;this.feverTime=0;this.goldRushTime=0;this._feverCooldown=0;
    this.combo=0;this.bestCombo=0;this.multiplier=1;this.bestMultiplier=1;this.comboTime=0;
    this.hits=0;this.dodged=0;this.nearMisses=0;this.missed=0;this.sections=0;this.finished=false;
    this.entities=[];this.spawnHistory=[];this._entitySequence=0;this._wave=0;this._nextWave=.45;this._rainCenter=560;
    this.emit('start',{runId:this.runId,mode:this.runMode,stage:0});return this;
  }
  get totalMultiplier(){return this.multiplier*(this.feverTime>0?2:1)*(this.goldRushTime>0?2:1)*(this.powerTime>0&&this.characterId==='griffin'?1.5:1);}
  _recordMultiplier(){this.bestMultiplier=Math.max(this.bestMultiplier,this.totalMultiplier);}
  move(direction=0){
    const dir=Math.sign(Number(direction)||0);if(this.mode!=='running'&&dir)return false;
    this._moveDirection=dir;this._targetX=null;return true;
  }
  moveTo(x){if(this.mode!=='running'||!Number.isFinite(Number(x)))return false;this._targetX=clamp(x,80,1040);this._moveDirection=0;return true;}
  jump(){return false;}
  releaseJump(){}
  slide(){return false;}
  pause(){if(this.mode!=='running')return;this.mode='paused';this._moveDirection=0;this._targetX=null;this.player.moving=0;this.player.vx=0;this.emit('pause');}
  resume(){if(this.mode!=='paused')return;this.mode='running';this.emit('resume');}
  power(){
    if(this.mode!=='running'||this.charge<100||this.powerTime>0)return false;
    this.charge=0;this.powersUsed++;this.powerDuration=({griffin:4.6,kevin:5.2,mittens:3.9,spike:5})[this.characterId];this.powerTime=this.powerDuration;
    if(this.characterId==='mittens'){
      const healed=this.hearts<this.maxHearts;this.hearts=Math.min(this.maxHearts,this.hearts+1);this.shieldCharges=Math.min(2,this.shieldCharges+1);
      this.emit('heal',{hearts:this.hearts,healed});
    }
    this._recordMultiplier();this.emit('power',{characterId:this.characterId,duration:this.powerDuration});return true;
  }
  _gainCharge(amount){
    const before=this.charge;this.charge=Math.min(this.powerTime>0?90:100,this.charge+amount*(1+this.gear.charge*.12));
    if(before<100&&this.charge>=100)this.emit('charged');
  }
  _safeFor(type,x,arrival){
    // Historical arrivals, rather than live entities, keep the seeded rain
    // independent of what the player catches, misses, or clears with a power.
    return !this.spawnHistory.some(e=>{
      if(Math.abs(e.arrival-arrival)>.7)return false;
      if(type==='mud')return Math.abs(e.x-x)<(e.type==='mud'?120:180);
      return e.type==='mud'&&Math.abs(e.x-x)<180;
    });
  }
  _spawn(type,x,y,fallSpeed,wave){
    const size=type==='mud'?44:type==='gold'?38:34;
    const arrival=this.time+(y-HEIGHT)/fallSpeed;
    if(!this._safeFor(type,x,arrival))return false;
    const entity={id:++this._entitySequence,type,x,y,w:size,h:size,vy:-fallSpeed,vx:0,wave,spawnedAt:this.time,arrival,taken:false,hit:false,passed:false};
    this.entities.push(entity);this.spawnHistory.push({id:entity.id,type,x,y,vy:entity.vy,arrival,wave,spawnedAt:this.time});
    if(this.spawnHistory.length>320)this.spawnHistory.shift();return true;
  }
  _spawnWave(){
    const wave=this._wave++,r=this._random,progress=this.time/LIMIT;
    this.speed=(165+this.time*1.3)*(this.assist?.84:1);
    const proposed=wave<2?560:clamp(this._rainCenter+(r()*2-1)*230,150,970);
    const y=410+r()*60,fallSpeed=this.speed;
    const arrival=this.time+(y-HEIGHT)/fallSpeed;
    const centers=[proposed,560,180,940,370,750];
    const center=centers.find(x=>[-48,0,48].every(offset=>this._safeFor('bone',x+offset,arrival)))??proposed;
    this._rainCenter=center;
    const offsets=wave%4===3?[-48,0,48]:[-34,34];
    offsets.forEach((offset,index)=>this._spawn(wave%5===4&&index===offsets.length-1?'gold':'bone',center+offset,y+index*5,fallSpeed,wave));
    if(wave%7===5){const specials=['magnet','shield','heart'];this._spawn(specials[Math.floor(wave/7)%3],center,y-35,fallSpeed,wave);}
    if(wave>=3){
      const preferRight=r()>.5,candidates=[100,280,460,640,820,1020].sort((a,b)=>(preferRight?b-a:a-b));
      const mudY=400+r()*65,mudSpeed=fallSpeed+8,when=this.time+(mudY-HEIGHT)/mudSpeed;
      let spawned=0,wanted=progress>.55&&wave%3===0?2:1;
      for(const x of candidates){if(Math.abs(x-center)<190||!this._safeFor('mud',x,when))continue;if(this._spawn('mud',x,mudY,mudSpeed,wave))spawned++;if(spawned>=wanted)break;}
    }
    this._nextWave+=.98-.34*progress;
  }
  update(dt){
    if(this.mode!=='running')return;let remaining=clamp(dt,0,.1);
    while(remaining>1e-8&&this.mode==='running'){
      const step=Math.min(1/120,remaining,this.timeLimit-this.time);remaining-=step;
      if(step<=1e-8){this.time=this.timeLimit;this._finish(true);break;}this._step(step);
    }
  }
  _step(dt){
    this.time+=dt;
    for(const key of ['invincible','powerTime','magnetTime','feverTime','goldRushTime','_feverCooldown','comboTime'])this[key]=Math.max(0,this[key]-dt);
    if(!this.comboTime&&this.combo)this._breakCombo();this._gainCharge(dt*1.6);if(this.mode!=='running')return;
    const p=this.player,oldX=p.x;
    if(this._targetX!==null){const delta=this._targetX-p.x;p.x+=Math.sign(delta)*Math.min(Math.abs(delta),900*dt);}
    else p.x+=this._moveDirection*650*dt;
    p.x=clamp(p.x,80,1040);p.vx=(p.x-oldX)/dt;p.moving=Math.sign(p.vx);if(p.moving)p.facing=p.moving;
    this.distance+=Math.abs(p.x-oldX);
    // The final three seconds let the last visible wave reach the family.
    while(this.time>=this._nextWave&&this._nextWave<42)this._spawnWave();
    for(const e of this.entities){
      if(e.taken||e.hit)continue;e.y+=e.vy*dt;
      const dx=Math.abs(e.x-p.x);
      if(e.type==='mud'){
        if(e.y<=HEIGHT-8&&e.y+e.h>=8&&dx<WIDTH*.32+e.w*.43){this._mudHit(e);if(this.mode!=='running')return;}
      }else{
        const pullable=e.type==='bone'||e.type==='gold';
        let radius=this.gear.magnet*18+(this.magnetTime>0?95:0)+(this.feverTime>0?55:0);
        if(this.powerTime>0)radius+=this.characterId==='kevin'?195:50;
        if(!pullable)radius*=.2;
        if(e.y<=HEIGHT+radius&&e.y+e.h>=0&&dx<=WIDTH*.5+e.w*.5+radius)this._collect(e);
        if(this.mode!=='running')return;
      }
      if(!e.taken&&!e.hit&&e.y+e.h<0){
        e.passed=true;e.taken=true;
        if(e.type==='mud'){
          this.dodged++;this.score+=10;this._gainCharge(2);this.emit('dodge',{kind:'mud',x:e.x,y:0});
          if(dx<WIDTH*.5+e.w*.5+60){this.nearMisses++;this.score+=35;this.emit('near-miss',{kind:'mud',value:35,x:e.x,y:40});}
        }else if(e.type==='bone'||e.type==='gold'){
          this.missed++;this._breakCombo();this.emit('miss',{kind:e.type,x:e.x,y:0});
        }
      }
      if(this.mode!=='running')return;
    }
    this.entities=this.entities.filter(e=>!e.hit&&!e.taken);
    const section=Math.min(2,Math.floor(this.time/15));if(section!==this.sections){this.sections=section;this.emit('section',{section,index:section,stage:0});}
    if(this.time>=this.timeLimit-1e-8){this.time=this.timeLimit;this._finish(true);}
  }
  _breakCombo(){this.combo=0;this.multiplier=1;this.comboTime=0;}
  _mudHit(e){
    e.hit=true;
    if(this.powerTime>0){const value=this.characterId==='spike'?150:50;this.score+=value;this.emit('smash',{kind:'mud',value,x:e.x,y:e.y});return;}
    if(this.invincible>0)return;
    if(this.shieldCharges>0){this.shieldCharges--;this.invincible=1.2;this.emit('shield',{kind:'mud',x:e.x,y:e.y});return;}
    this.hearts=Math.max(0,this.hearts-1);this.hits++;this.invincible=1.2+this.gear.grace*.15;this._breakCombo();this.charge=Math.max(0,this.charge-8);
    this.emit('hit',{hearts:this.hearts,reason:'mud',x:this.player.x,y:30});if(this.hearts===0)this._finish(false);
  }
  _collect(e){
    e.taken=true;let value=0;
    if(e.type==='bone'||e.type==='gold'){
      this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.comboTime=5.4;this.multiplier=Math.min(5,1+Math.floor(this.combo/6));
      this.treats+=e.type==='gold'?3:1;if(e.type==='gold')this.gold++;
      this._gainCharge(e.type==='gold'?15:5);
      if(this.combo%6===0)this.emit('combo',{combo:this.combo,multiplier:this.multiplier});
      if(this.combo>=18&&this._feverCooldown===0){this.feverTime=8;this._feverCooldown=20;this.emit('fever',{duration:8});}
      if(e.type==='gold'){this.goldRushTime=Math.min(12,this.goldRushTime+4);this.emit('gold-rush',{duration:this.goldRushTime,totalMultiplier:this.totalMultiplier});}
      this._recordMultiplier();value=Math.round((e.type==='gold'?100:10)*this.totalMultiplier);
    }else if(e.type==='magnet'){this.magnetTime=Math.min(21,this.magnetTime+7);value=30;this.emit('pickup',{kind:'magnet',duration:this.magnetTime});}
    else if(e.type==='shield'){this.shieldCharges=Math.min(2,this.shieldCharges+1);value=30;this.emit('pickup',{kind:'shield',charges:this.shieldCharges});}
    else if(e.type==='heart'){const healed=this.hearts<this.maxHearts;this.hearts=Math.min(this.maxHearts,this.hearts+1);value=healed?25:80;this.emit('heal',{hearts:this.hearts,healed});}
    this.score+=value;this.emit('collect',{kind:e.type,value,x:e.x,y:e.y,combo:this.combo,multiplier:this.multiplier,totalMultiplier:this.totalMultiplier});
  }
  _finish(won){
    if(this.mode!=='running'||this.finished)return;this.finished=true;this.mode=won?'won':'lost';this.player.moving=0;this.player.vx=0;
    if(won)this.score+=this.hearts*80+(this.hits===0?200:0);this.emit(won?'won':'lost',{result:this.result()});
  }
  result(){
    return {runId:this.runId,mode:'snack',state:this.mode,stage:0,regionId:this.regionId,characterId:this.characterId,won:this.mode==='won',score:Math.round(this.score),treats:this.treats,distance:Math.round(this.distance),time:Number(this.time.toFixed(3)),hits:this.hits,dodged:this.dodged,nearMisses:this.nearMisses,bestCombo:this.bestCombo,bestMultiplier:this.bestMultiplier,gold:this.gold,letters:0,letterMask:0,powersUsed:this.powersUsed,hearts:this.hearts,maxHearts:this.maxHearts,seed:this.seed,assist:this.assist,gear:{...this.gear},dailyDate:'',missed:this.missed,springs:0,slides:0,doubleJumps:0};
  }
}
