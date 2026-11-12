// Snack Storm: catch falling treats with the same scoring and result vocabulary
// as the trail runner. Rendering, input devices, audio, and storage stay outside.
//
// A run is always 45 seconds of simulation time:
//   0.00-2.25  a 3-2-1-GO count while the first treats are already on their way
//   15 and 30  the storm steps up (the existing `section` event)
//   35-45      the final push: fuller waves and a tick every second
//   43         one golden goodbye that lands inside the last second
// Each world adds one small seeded twist. A twist never reads player input,
// and anything that slides sideways in the air still lands on the column the
// seeded course gave it, so the landing markers and the mud spacing stay true.
// The course is the same for a seed at any frame rate and through any hit-stop
// or slow motion: update() lands exactly on every scheduled wave and twist.
//
// Events (every payload also carries `type`; x is world x 0..1120, y is height above the grass):
//   start pause resume won{result} lost{result} section{section} charged
//   countdown{count 3|2|1|0}      final-push{remaining}      tick{remaining 10..1}      finale{x,arrival}
//   collect{kind,value,x,y,combo,multiplier,totalMultiplier,bonus,comet,bouncy,bounced,finale}
//   miss{kind,x,combo,bouncy}     fizzle{kind,x} (an unclaimed bonus treat)     chain-lost{combo,multiplier,reason}
//   combo{combo,multiplier}       stack{tier 1|2|3,level 10|20|30,totalMultiplier}
//   fever{duration} fever-end     gold-rush{duration,totalMultiplier} gold-rush-end     power{characterId,duration} power-end
//   hit{hearts,x,y} shield{x,y,charges} smash{value,x,y} dodge{x} near-miss{value,x} pickup{kind} heal{hearts,healed}
//   bounce{kind,x} (river)   gust{direction,duration} (canyon)   comet{x,direction,arrival} (mesa)   bloom-seed{x,arrival} bloom{x,count} (Boerne)
export const SNACK_WORLD=Object.freeze({width:1120,height:630,ground:492,minX:80,maxX:1040});
export const SNACK_TWISTS=Object.freeze(['bounce','sway','gust','comet','bloom']);
export const SNACK_TIMING=Object.freeze({limit:45,countdown:Object.freeze([0,.75,1.5,2.25]),finalPush:35,finale:43});
const WIDTH=120,HEIGHT=82,LIMIT=45,PUSH_AT=35,FINALE_AT=43;
const DRAG_SPEED=5200,GUST_PUSH=135,BOUNCE_VY=400,BOUNCE_G=520,BOUNCE_VX=45,FOUNTAIN_G=560,BONUS_ID=100000;
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
  reset({characterId='griffin',gear={},assist=false,seed,worldIndex=0}={}){
    this.runMode='snack';this.mode='running';this.stage=0;this.regionId='rogue-river';this.dailyDate='';
    // The controller may set worldIndex again after reset; the twist reads it when play begins.
    this.worldIndex=level(worldIndex,4);
    this.characterId=['griffin','kevin','mittens','spike'].includes(characterId)?characterId:'griffin';
    this.gear={magnet:level(gear.magnet),charge:level(gear.charge),heart:level(gear.heart,2),grace:level(gear.grace)};
    this.assist=Boolean(assist);this.seed=(Number(seed??this._defaultSeed)>>>0)||1;
    this._random=seed===undefined&&this._providedRandom?this._providedRandom:rngFor(this.seed);
    this.runId=`snack-${Date.now().toString(36)}-${this._instance}-${++this._runs}`;
    this.time=0;this.timeLimit=LIMIT;this.goal=Infinity;this.distance=0;this.speed=165;
    this.player={x:560,y:0,vy:0,vx:0,grounded:true,sliding:false,width:WIDTH,height:HEIGHT,moving:0,facing:1,jumps:0};
    this._moveDirection=0;this._targetX=null;this._dragging=false;this._lastTarget=-1;
    this.score=0;this.treats=0;this.gold=0;this.letters=0;this.letterMask=0;
    this.maxHearts=3+(this.characterId==='spike'?1:0)+this.gear.heart+(this.assist?1:0);this.hearts=this.maxHearts;
    this.charge=50+this.gear.charge*10;this.powerTime=0;this.powerDuration=0;this.powersUsed=0;
    this.invincible=0;this.shieldCharges=0;this.magnetTime=0;this.feverTime=0;this.goldRushTime=0;this._feverCooldown=0;
    this.combo=0;this.bestCombo=0;this.multiplier=1;this.bestMultiplier=1;this.comboTime=0;this._stackTier=0;
    this.hits=0;this.dodged=0;this.nearMisses=0;this.missed=0;this.sections=0;this.finished=false;
    this.bounces=0;this.blooms=0;this.comets=0;this.chainsLost=0;
    this.entities=[];this.spawnHistory=[];this._entitySequence=0;this._bonusSequence=0;this._wave=0;this._nextWave=.45;this._rainCenter=560;
    this._reserved=[];this._countStep=0;this._lastTick=11;this._finale=false;
    this._twistRandom=null;this._twistWorld=-1;this._nextTwist=Infinity;this.wind=0;this.gust=null;
    this.emit('start',{runId:this.runId,mode:this.runMode,stage:0});return this;
  }
  get totalMultiplier(){return this.multiplier*(this.feverTime>0?2:1)*(this.goldRushTime>0?2:1)*(this.powerTime>0&&this.characterId==='griffin'?1.5:1);}
  // Which of the five world twists this run plays with.
  get twist(){return SNACK_TWISTS[level(this.worldIndex,4)];}
  // Seconds of the opening count still to go (0 once the storm is live).
  get intro(){return Math.max(0,SNACK_TIMING.countdown[3]-this.time);}
  get finalPush(){return this.time>=PUSH_AT&&this.mode==='running';}
  // 0..1 through the six catches that earn the next chain step (1 at the 5x cap).
  get chainProgress(){return this.multiplier>=5?1:(this.combo%6)/6;}
  _recordMultiplier(){this.bestMultiplier=Math.max(this.bestMultiplier,this.totalMultiplier);}
  _trackStack(){
    const total=this.totalMultiplier,tier=total>=30?3:total>=20?2:total>=10?1:0;
    if(tier>this._stackTier)this.emit('stack',{tier,level:[10,20,30][tier-1],totalMultiplier:total});
    this._stackTier=tier;
  }
  move(direction=0){
    const dir=Math.sign(Number(direction)||0);if(this.mode!=='running'&&dir)return false;
    this._moveDirection=dir;this._targetX=null;this._dragging=false;return true;
  }
  // A single target glides at a steady trot. A stream of targets is a finger
  // on the glass, so the pet stays under it instead of trailing behind.
  moveTo(x){
    if(this.mode!=='running'||!Number.isFinite(Number(x)))return false;
    this._targetX=clamp(x,80,1040);this._moveDirection=0;
    this._dragging=this.time-this._lastTarget<.12;this._lastTarget=this.time;return true;
  }
  // Touch dragging: follow the finger 1:1 from the first contact.
  dragTo(x){if(!this.moveTo(x))return false;this._dragging=true;return true;}
  jump(){return false;}
  releaseJump(){}
  slide(){return false;}
  pause(){if(this.mode!=='running')return;this.mode='paused';this._moveDirection=0;this._targetX=null;this._dragging=false;this.player.moving=0;this.player.vx=0;this.emit('pause');}
  resume(){if(this.mode!=='paused')return;this.mode='running';this.emit('resume');}
  power(){
    if(this.mode!=='running'||this.charge<100||this.powerTime>0)return false;
    this.charge=0;this.powersUsed++;this.powerDuration=({griffin:4.6,kevin:5.2,mittens:3.9,spike:5})[this.characterId];this.powerTime=this.powerDuration;
    if(this.characterId==='mittens'){
      const healed=this.hearts<this.maxHearts;this.hearts=Math.min(this.maxHearts,this.hearts+1);this.shieldCharges=Math.min(2,this.shieldCharges+1);
      this.emit('heal',{hearts:this.hearts,healed});
    }
    this._recordMultiplier();this.emit('power',{characterId:this.characterId,duration:this.powerDuration,totalMultiplier:this.totalMultiplier});this._trackStack();return true;
  }
  _gainCharge(amount){
    const before=this.charge;this.charge=Math.min(this.powerTime>0?90:100,this.charge+amount*(1+this.gear.charge*.12));
    if(before<100&&this.charge>=100)this.emit('charged');
  }
  _fallSpeed(){return (165+this.time*1.3)*(this.assist?.84:1);}
  _twistRng(){
    const world=level(this.worldIndex,4);
    if(!this._twistRandom||this._twistWorld!==world){
      this._twistWorld=world;this._twistRandom=rngFor(((this.seed^0x2545f491)>>>0)+world*7919+1);
      const first={gust:[4.5,2.5],comet:[7,2],bloom:[6,2]}[this.twist];
      this._nextTwist=first?first[0]+this._twistRandom()*first[1]:Infinity;
    }
    return this._twistRandom;
  }
  _safeFor(type,x,arrival){
    // Historical arrivals, rather than live entities, keep the seeded rain
    // independent of what the player catches, misses, or clears with a power.
    if(type==='mud'&&this._reserved.some(r=>arrival>r.from-.7&&arrival<r.to+.7&&Math.abs(r.x-x)<r.radius+135))return false;
    return !this.spawnHistory.some(e=>{
      if(Math.abs(e.arrival-arrival)>.7)return false;
      if(type==='mud')return Math.abs(e.x-x)<(e.type==='mud'?120:180);
      return e.type==='mud'&&Math.abs(e.x-x)<180;
    });
  }
  // True when no mud already on the course lands near x while a bonus is in play there.
  _clearOfMud(x,from,to,radius){return !this.spawnHistory.some(e=>e.type==='mud'&&e.arrival>from-.7&&e.arrival<to+.7&&Math.abs(e.x-x)<radius+135);}
  _reserve(x,radius,from,to){this._reserved.push({x,radius,from,to});if(this._reserved.length>48)this._reserved.shift();}
  _spawn(type,x,y,fallSpeed,wave,extra){
    const size=type==='mud'?44:type==='gold'?38:type==='bloom'?40:34;
    const arrival=this.time+(y-HEIGHT)/fallSpeed;
    if(!this._safeFor(type,x,arrival))return false;
    // x is where the item lands. baseX carries that column while a twist moves it in the air.
    const entity={id:++this._entitySequence,type,x,baseX:x,y,w:size,h:size,vy:-fallSpeed,vx:0,wave,spawnedAt:this.time,arrival,taken:false,hit:false,passed:false,...extra};
    const record={id:entity.id,type,x,y,vy:entity.vy,arrival,wave,spawnedAt:this.time};
    if(type==='bone'&&this.twist==='bounce'&&this._twistRng()()<.3){
      // Rogue River: a tennis ball that hops once if it reaches the grass.
      const land=this.time+y/fallSpeed,flight=2*BOUNCE_VY/BOUNCE_G,dir=x<240?1:x>880?-1:(entity.id%2?1:-1),mid=x+dir*BOUNCE_VX*flight/2;
      if(land+flight+.2<LIMIT&&this._clearOfMud(mid,land,land+flight,40)){entity.bouncy=true;entity.bounceDir=dir;record.bouncy=true;this._reserve(mid,40,land,land+flight);}
    }
    if(type!=='mud'&&type!=='bloom'&&this.twist==='sway'){entity.sway=(wave%2?1:-1)*(40+this._twistRng()()*24);record.sway=entity.sway;}
    if(entity.slant){entity.x=x+this._offset(entity);record.comet=true;}
    this.entities.push(entity);this.spawnHistory.push(record);
    if(this.spawnHistory.length>320)this.spawnHistory.shift();return entity;
  }
  _spawnWave(){
    const wave=this._wave++,r=this._random,progress=this.time/LIMIT,push=this.time>=PUSH_AT;
    this.speed=this._fallSpeed();
    const proposed=wave<2?560:clamp(this._rainCenter+(r()*2-1)*230,150,970);
    const y=410+r()*60,fallSpeed=this.speed;
    const arrival=this.time+(y-HEIGHT)/fallSpeed;
    // The final push trades pairs for threes and threes for a ribbon of five.
    const wide=wave%4===3;let offsets=push?(wide?[-96,-48,0,48,96]:[-48,0,48]):(wide?[-48,0,48]:[-34,34]);
    if(offsets.length===5&&wave%8===7)offsets=offsets.slice().reverse();
    const centers=[proposed,560,180,940,370,750];
    const center=centers.find(x=>offsets.every(offset=>this._safeFor('bone',x+offset,arrival)))??centers.find(x=>[-48,0,48].every(offset=>this._safeFor('bone',x+offset,arrival)))??proposed;
    this._rainCenter=center;
    const ribbon=offsets.length===5,baseY=ribbon?Math.min(y,440):y,stagger=ribbon?10:5;
    offsets.forEach((offset,index)=>this._spawn(wave%5===4&&index===offsets.length-1?'gold':'bone',center+offset,baseY+index*stagger,fallSpeed,wave));
    if(wave%7===5){const specials=['magnet','shield','heart'];this._spawn(specials[Math.floor(wave/7)%3],center,y-35,fallSpeed,wave);}
    if(wave>=3){
      const preferRight=r()>.5,candidates=[100,280,460,640,820,1020].sort((a,b)=>(preferRight?b-a:a-b));
      const mudY=400+r()*65,mudSpeed=fallSpeed+8,when=this.time+(mudY-HEIGHT)/mudSpeed;
      let spawned=0,wanted=progress>.55&&wave%3===0?2:1;
      for(const x of candidates){if(Math.abs(x-center)<(ribbon?240:190)||!this._safeFor('mud',x,when))continue;if(this._spawn('mud',x,mudY,mudSpeed,wave))spawned++;if(spawned>=wanted)break;}
    }
    this._nextWave+=.98-.34*progress;
  }
  // One last golden treat, timed to land inside the final second.
  _spawnFinale(){
    this._finale=true;const fallSpeed=this._fallSpeed(),wave=this._wave++,y=362,arrival=this.time+(y-HEIGHT)/fallSpeed,offsets=[-60,0,60];
    const center=[560,370,750,180,940].find(x=>offsets.every(offset=>this._safeFor('bone',x+offset,arrival)));
    if(center===undefined)return;
    offsets.forEach((offset,index)=>this._spawn(index===1?'gold':'bone',center+offset,y+index*6,fallSpeed,wave,{finale:true}));
    this.emit('finale',{x:center,arrival});
  }
  _twistStep(){
    const twist=this.twist,r=this._twistRng();
    if(twist==='gust'){
      // Painted Canyon: gusts lean everything in the air, then let it settle.
      if(this.gust&&this.time>=this.gust.end)this.gust=null;
      if(!this.gust&&this.time>=this._nextTwist&&this.time<LIMIT-4){
        const duration=2.6+r()*1,direction=r()>.5?1:-1;this.gust={start:this.time,end:this.time+duration,direction};
        this._nextTwist=this.time+duration+3+r()*2.5;this.emit('gust',{direction,duration});
      }
      const g=this.gust;this.wind=g?g.direction*Math.sin(Math.PI*clamp((this.time-g.start)/(g.end-g.start),0,1))**2:0;
    }else if(twist==='comet'){
      // Starlight Mesa: a golden streak crosses the sky on a slant.
      if(this.time>=this._nextTwist){
        this._nextTwist+=8+r()*2;const direction=r()>.5?1:-1,start=Math.floor(r()*5);
        if(this.time<40){
          const fallSpeed=this._fallSpeed()*1.35,y=470,arrival=this.time+(y-HEIGHT)/fallSpeed,columns=[200,380,560,740,920];
          for(let i=0;i<5;i++){
            const x=columns[(start+i)%5];if(!this._safeFor('gold',x,arrival))continue;
            if(this._spawn('gold',x,y,fallSpeed,this._wave,{slant:direction*.85,comet:true,bonus:true})){this.comets++;this.emit('comet',{x,direction,arrival});}
            break;
          }
        }
      }
    }else if(twist==='bloom'){
      // Boerne Hills: a bluebonnet drifts down, lands, and bursts into a fountain of treats.
      if(this.time>=this._nextTwist){
        this._nextTwist+=7.5+r()*2.5;const start=Math.floor(r()*5);
        if(this.time<38){
          const fallSpeed=this._fallSpeed()*.8,y=455,land=this.time+y/fallSpeed,flight=2*430/FOUNTAIN_G,columns=[260,410,560,710,860];
          for(let i=0;i<5;i++){
            const x=columns[(start+i)%5];if(!this._clearOfMud(x,land,land+flight,150))continue;
            if(this._spawn('bloom',x,y,fallSpeed,this._wave)){this._reserve(x,150,land,land+flight);this.emit('bloom-seed',{x,arrival:land});}
            break;
          }
        }
      }
    }
  }
  // Sideways drift for an item still in the air. Always zero at head height and below.
  _offset(e){
    const above=Math.max(0,e.y-HEIGHT);let offset=0;
    if(e.slant)offset+=e.slant*above;
    if(e.sway)offset+=e.sway*Math.sin(2.2*above/Math.max(60,-e.vy));
    if(this.wind)offset+=this.wind*GUST_PUSH*Math.min(1,above/340);
    return offset;
  }
  _burst(seed,born){
    const count=5;this.blooms++;
    for(let i=0;i<count;i++){
      const k=i-(count-1)/2,vy=430-Math.abs(k)*28;
      born.push({id:BONUS_ID+ ++this._bonusSequence,type:'bone',x:seed.x,baseX:seed.x,y:0,w:34,h:34,vy,vx:k*54,g:FOUNTAIN_G,wave:seed.wave,spawnedAt:this.time,arrival:this.time+2*vy/FOUNTAIN_G,taken:false,hit:false,passed:false,fountain:true,bonus:true});
    }
    this.emit('bloom',{x:seed.x,y:0,count});
  }
  _arc(){
    const beats=SNACK_TIMING.countdown;
    while(this._countStep<beats.length&&this.time>=beats[this._countStep]){this.emit('countdown',{count:3-this._countStep});this._countStep++;}
    while(this._lastTick>1&&this.time>=LIMIT-(this._lastTick-1)){
      this._lastTick--;if(this._lastTick===10)this.emit('final-push',{remaining:10});
      this.emit('tick',{remaining:this._lastTick});
    }
  }
  // The next moment the seeded course has something scheduled: a wave, the golden goodbye, or a twist.
  _due(){
    const t=this.time;let due=Infinity;
    if(this._nextWave<42&&this._nextWave>t)due=this._nextWave;
    if(!this._finale&&FINALE_AT>t&&FINALE_AT<due)due=FINALE_AT;
    if(this._nextTwist>t&&this._nextTwist<due)due=this._nextTwist;
    return due;
  }
  update(dt){
    if(this.mode!=='running')return;let remaining=clamp(dt,0,.1);
    while(remaining>1e-8&&this.mode==='running'){
      const left=this.timeLimit-this.time;
      if(left<=1e-8){this.time=this.timeLimit;this._finish(true);break;}
      // Steps stop exactly on each scheduled moment, so the course is worked out from the same clock
      // value at any frame rate and through any hit-stop or slow motion the view asks for.
      const due=this._due(),gap=due-this.time,step=Math.min(1/120,remaining,left,gap);remaining-=step;
      this._step(step,step===gap?due:undefined);
    }
  }
  _step(dt,land){
    this.time=land===undefined?this.time+dt:land;
    const fever=this.feverTime>0,rush=this.goldRushTime>0,power=this.powerTime>0;
    for(const key of ['invincible','powerTime','magnetTime','feverTime','goldRushTime','_feverCooldown','comboTime'])this[key]=Math.max(0,this[key]-dt);
    if(fever&&!this.feverTime)this.emit('fever-end');
    if(rush&&!this.goldRushTime)this.emit('gold-rush-end');
    if(power&&!this.powerTime)this.emit('power-end',{characterId:this.characterId});
    if(!this.comboTime&&this.combo)this._breakCombo('timeout');this._gainCharge(dt*1.6);if(this.mode!=='running')return;
    const p=this.player,oldX=p.x;
    if(this._targetX!==null){const delta=this._targetX-p.x;p.x+=Math.sign(delta)*Math.min(Math.abs(delta),(this._dragging?DRAG_SPEED:900)*dt);}
    else p.x+=this._moveDirection*650*dt;
    p.x=clamp(p.x,80,1040);p.vx=(p.x-oldX)/dt;p.moving=Math.sign(p.vx);if(p.moving)p.facing=p.moving;
    this.distance+=Math.abs(p.x-oldX);
    this._arc();if(this.mode!=='running')return;
    // The final three seconds let the last visible wave reach the family.
    while(this.time>=this._nextWave&&this._nextWave<42)this._spawnWave();
    if(!this._finale&&this.time>=FINALE_AT)this._spawnFinale();
    this._twistStep();
    let born=null;
    for(const e of this.entities){
      if(e.taken||e.hit)continue;
      if(e.g)e.vy-=e.g*dt;
      e.y+=e.vy*dt;
      if(e.baseX!==undefined){if(e.vx)e.baseX=clamp(e.baseX+e.vx*dt,40,1080);e.x=e.baseX+this._offset(e);}
      if(e.type==='bloom'){if(e.y<=0){e.taken=true;this._burst(e,born||(born=[]));}continue;}
      if(e.bouncy&&!e.bounced&&e.y<=0){e.bounced=true;e.y=0;e.vy=BOUNCE_VY;e.g=BOUNCE_G;e.vx=e.bounceDir*BOUNCE_VX;this.bounces++;this.emit('bounce',{kind:e.type,x:e.x,y:0});}
      const dx=Math.abs(e.x-p.x);
      if(e.type==='mud'){
        if(e.y<=HEIGHT-8&&e.y+e.h>=8&&dx<WIDTH*.32+e.w*.43){this._mudHit(e);if(this.mode!=='running')return;}
      }else if(!(e.fountain&&e.vy>0)){
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
          // Bonus treats (comets, bluebonnet fountains) are a gift: letting one go costs nothing.
          if(e.bonus)this.emit('fizzle',{kind:e.type,x:e.x,y:0});
          else{this.missed++;this.emit('miss',{kind:e.type,x:e.x,y:0,combo:this.combo,bouncy:Boolean(e.bouncy)});this._breakCombo('miss');}
        }
      }
      if(this.mode!=='running')return;
    }
    if(born)this.entities.push(...born);
    this.entities=this.entities.filter(e=>!e.hit&&!e.taken);
    this._trackStack();
    const section=Math.min(2,Math.floor(this.time/15));if(section!==this.sections){this.sections=section;this.emit('section',{section,index:section,stage:0});}
    if(this.time>=this.timeLimit-1e-8){this.time=this.timeLimit;this._finish(true);}
  }
  _breakCombo(reason=''){
    const combo=this.combo,multiplier=this.multiplier;this.combo=0;this.multiplier=1;this.comboTime=0;
    if(combo>0){if(multiplier>1)this.chainsLost++;this.emit('chain-lost',{combo,multiplier,reason,x:this.player.x,y:HEIGHT});}
  }
  _mudHit(e){
    e.hit=true;
    if(this.powerTime>0){const value=this.characterId==='spike'?150:50;this.score+=value;this.emit('smash',{kind:'mud',value,x:e.x,y:e.y});return;}
    if(this.invincible>0)return;
    if(this.shieldCharges>0){this.shieldCharges--;this.invincible=1.2;this.emit('shield',{kind:'mud',x:e.x,y:e.y,charges:this.shieldCharges});return;}
    this.hearts=Math.max(0,this.hearts-1);this.hits++;this.invincible=1.2+this.gear.grace*.15;this.charge=Math.max(0,this.charge-8);
    this.emit('hit',{hearts:this.hearts,reason:'mud',x:this.player.x,y:30});this._breakCombo('hit');if(this.hearts===0)this._finish(false);
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
    this.score+=value;
    this.emit('collect',{kind:e.type,value,x:e.x,y:e.y,combo:this.combo,multiplier:this.multiplier,totalMultiplier:this.totalMultiplier,bonus:Boolean(e.bonus),comet:Boolean(e.comet),bouncy:Boolean(e.bouncy),bounced:Boolean(e.bounced),finale:Boolean(e.finale)});
    this._trackStack();
  }
  _finish(won){
    if(this.mode!=='running'||this.finished)return;this.finished=true;this.mode=won?'won':'lost';this.player.moving=0;this.player.vx=0;
    if(won)this.score+=this.hearts*80+(this.hits===0?200:0);this.emit(won?'won':'lost',{result:this.result()});
  }
  result(){
    return {runId:this.runId,mode:'snack',state:this.mode,stage:0,regionId:this.regionId,characterId:this.characterId,won:this.mode==='won',score:Math.round(this.score),treats:this.treats,distance:Math.round(this.distance),time:Number(this.time.toFixed(3)),hits:this.hits,dodged:this.dodged,nearMisses:this.nearMisses,bestCombo:this.bestCombo,bestMultiplier:this.bestMultiplier,gold:this.gold,letters:0,letterMask:0,powersUsed:this.powersUsed,hearts:this.hearts,maxHearts:this.maxHearts,seed:this.seed,assist:this.assist,gear:{...this.gear},dailyDate:'',missed:this.missed,springs:0,slides:0,doubleJumps:0,bounces:this.bounces,blooms:this.blooms,comets:this.comets};
  }
}
