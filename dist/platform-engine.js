import {LEVELS,getLevel} from './world-levels.js?v=24';

export const PLATFORM_WORLD=Object.freeze({width:960,height:600,tile:48,ground:480});
const W=48,H=64,GRAVITY=1750;
const RESTING=['ground','grass','bridge'];
const TIMERS=['invincible','powerTime','magnetTime','feverTime','goldRushTime','_feverCooldown','comboTime','_jumpBuffer','_springCooldown','_ventCooldown'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const finite=(n,fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;
const approach=(n,target,amount)=>n<target?Math.min(target,n+amount):Math.max(target,n-amount);
const clone=value=>JSON.parse(JSON.stringify(value));
const validChar=id=>['griffin','kevin','mittens','spike'].includes(id)?id:'griffin';
const overlapX=(p,s,padding=0)=>p.x+W/2>s.x+padding&&p.x-W/2<s.x+s.w-padding;
let sequence=0;

export class PlatformRun {
  constructor({onEvent=()=>{}}={}){this.onEvent=onEvent;this._instance=++sequence;this._runs=0;this._silent=true;this.reset();this._silent=false;this.mode='ready';}
  emit(type,data={}){if(!this._silent)this.onEvent({...data,type});}
  reset({levelId='river-1',characterId='griffin',gear={},assist=false,seed,remix=false,charms={},dailyDate='',checkpoint}={}){
    this.level=getLevel(levelId,{seed,remix});this.levelId=this.level.id;this.worldIndex=this.level.worldIndex;this.stage=this.worldIndex;
    this.runMode='platform';this.mode='running';this.finished=false;this.characterId=validChar(characterId);
    this.gear={magnet:Math.round(clamp(gear.magnet,0,3)),charge:Math.round(clamp(gear.charge,0,3)),heart:Math.round(clamp(gear.heart,0,2)),grace:Math.round(clamp(gear.grace,0,3))};
    this.charms={stompCharge:!!charms.stompCharge,goldDuration:clamp(charms.goldDuration,0,4),comboGrace:clamp(charms.comboGrace,0,5),extraJump:!!charms.extraJump,stompBounce:!!charms.stompBounce,secretMagnet:!!charms.secretMagnet,shieldStart:!!charms.shieldStart,speed:clamp(charms.speed,0,.25),springBoost:!!charms.springBoost,powerDuration:clamp(charms.powerDuration,0,4)};
    this.assist=Boolean(assist);this.seed=this.level.seed;this.remix=Boolean(remix);this.dailyDate=String(dailyDate||'');
    this.runId=`platform-${Date.now().toString(36)}-${this._instance}-${++this._runs}`;
    this.width=this.level.width;this.height=this.level.height;this.platforms=this.level.platforms;this.entities=this.level.entities;this.zones=this.level.zones;
    this.player={x:this.level.spawn.x,y:this.level.spawn.y,vx:0,vy:0,w:W,h:H,width:W,height:H,grounded:true,jumps:0,facing:1,moving:0,jumpHeld:false,sliding:false,drop:false};
    this._groundId=this.platforms[0].id;this._move=0;this._coyote=.12;this._jumpBuffer=0;this._tapBuffered=false;this._hopCut=0;this._springCooldown=0;this._promptId=null;this._goalMessageAt=-10;
    this.time=0;this.distance=0;this.farthest=this.player.x;this.speed=275*(1+this.charms.speed)*(this.assist?.92:1);this.goal=this.width-175;
    this.score=0;this.treats=0;this.gold=0;this.keys=0;this.requiredKeys=this.level.requiredKeys;this.letters=0;this.letterMask=0;
    this.maxHearts=3+(this.characterId==='spike'?1:0)+this.gear.heart+(this.assist?1:0);this.hearts=this.maxHearts;
    this.charge=50+this.gear.charge*10;this.powerTime=0;this.powerDuration=0;this.powersUsed=0;this.invincible=0;
    this.shieldCharges=this.charms.shieldStart?1:0;this.magnetTime=0;this.feverTime=0;this.goldRushTime=0;this._feverCooldown=0;
    this.combo=0;this.bestCombo=0;this.multiplier=1;this.bestMultiplier=1;this.comboTime=0;
    this.hits=0;this.stomps=0;this.blocks=0;this.secrets=0;this.chests=0;this.checkpoints=0;this.dodged=0;this.nearMisses=0;this.springs=0;this.doubleJumps=0;
    this.airStomps=0;this.bestStompChain=0;this.pops=0;this.vents=0;this._ventCooldown=0;this._rain=0;this._rainTimer=0;this._rainCount=0;this._rainSeed=(this.seed^0x9e3779b9)>>>0;this._wet=false;
    this.bossDefeated=!this.level.boss;this.checkpoint={id:'start',x:this.level.spawn.x,y:this.level.spawn.y};this.interaction=null;this.camera={x:0,y:0};
    this._config={levelId:this.levelId,characterId:this.characterId,gear:{...this.gear},assist:this.assist,seed:this.seed,remix:this.remix,charms:{...this.charms},dailyDate:this.dailyDate};
    this._stepPlatforms(0);
    if(checkpoint?.kind==='platform'&&this.restore(checkpoint))return this;
    this.emit('start',{runId:this.runId,mode:this.runMode,levelId:this.levelId,worldIndex:this.worldIndex});return this;
  }
  get totalMultiplier(){return this.multiplier*(this.feverTime>0?2:1)*(this.goldRushTime>0?2:1)*(this.powerTime>0&&this.characterId==='griffin'?1.5:1);}
  _recordMultiplier(){this.bestMultiplier=Math.max(this.bestMultiplier,this.totalMultiplier);}
  move(direction=0){const value=Math.sign(Number(direction)||0);if(this.mode!=='running'&&value)return false;this._move=value;return true;}
  jump(){
    if(this.mode!=='running')return false;const p=this.player;
    if(p.grounded||this._coyote>0){p.jumps=1;return this._launch(false);}
    if(p.jumps<2+(this.charms.extraJump?1:0)){p.jumps++;this.doubleJumps++;return this._launch(true);}
    this._jumpBuffer=.14;this._tapBuffered=false;return false;
  }
  _launch(double){const p=this.player;p.vy=-(double?565:610)*(this.characterId==='mittens'?1.06:1);p.grounded=false;p.jumpHeld=true;p.drop=false;this._groundId=null;this._coyote=0;this._jumpBuffer=0;this._hopCut=0;this.emit(double?'double-jump':'jump',{x:p.x,y:p.y});return true;}
  // A tap that was let go before the buddy landed still becomes a short hop, not a full leap.
  releaseJump(){const p=this.player;if(this._jumpBuffer>0)this._tapBuffered=true;if(p.jumpHeld&&p.vy<-220)p.vy=Math.max(-260,p.vy*.47);p.jumpHeld=false;}
  drop(){if(this.mode!=='running'||this.player.grounded)return false;this.player.vy=Math.max(850,this.player.vy);this.player.drop=true;this.emit('slide',{airborne:true});return true;}
  slide(){return this.drop();}
  pause(){if(this.mode!=='running')return;this.mode='paused';this._move=0;this.player.jumpHeld=false;this.emit('pause');}
  resume(){if(this.mode!=='paused')return;this.mode='running';this.emit('resume');}
  power(){
    if(this.mode!=='running'||this.charge<100||this.powerTime>0)return false;
    this.charge=0;this.powersUsed++;this.powerDuration=({griffin:4.8,kevin:5.4,mittens:4.2,spike:5.1})[this.characterId]+this.charms.powerDuration;this.powerTime=this.powerDuration;
    if(this.characterId==='mittens'){const healed=this.hearts<this.maxHearts;this.hearts=Math.min(this.maxHearts,this.hearts+1);this.shieldCharges=Math.min(2,this.shieldCharges+1);this.emit('heal',{hearts:this.hearts,healed});}
    this._recordMultiplier();this.emit('power',{characterId:this.characterId,duration:this.powerDuration});return true;
  }
  _gainCharge(amount){const before=this.charge;this.charge=Math.min(this.powerTime>0?90:100,this.charge+amount*(1+this.gear.charge*.12));if(before<100&&this.charge>=100)this.emit('charged');}
  _stepPlatforms(dt){
    for(const s of this.platforms){
      const oldX=s.x,oldY=s.y;
      if(s.type==='moving'){
        const offset=Math.sin(this.time*(s.speed||1)+(s.phase||0))*(s.range||42);
        s.x=s.originX+(s.axis==='y'?0:offset);s.y=s.originY+(s.axis==='y'?offset:0);
        if(this._groundId===s.id&&this.player.grounded){this.player.x+=s.x-oldX;this.player.y+=s.y-oldY;}
      }
      if(s.type==='crumble'){
        if(s.active===false){s.respawnIn=Math.max(0,(s.respawnIn||0)-dt);if(!s.respawnIn){s.active=true;s.crumbleTimer=0;}}
        else if(s.crumbleTimer>0||this._groundId===s.id){s.crumbleTimer=(s.crumbleTimer||0)+dt;if(s.crumbleTimer>=(s.crumbleAfter||1.1)){s.active=false;s.respawnIn=4;this.emit('crumble',{x:s.x+s.w/2,y:s.y});}}
      }
    }
  }
  update(dt){
    if(this.mode!=='running')return;let remaining=clamp(dt,0,.1);
    while(remaining>1e-8&&this.mode==='running'){const step=Math.min(1/120,remaining);remaining-=step;this._step(step);}
    if(this.mode==='running')this._updateInteraction();
  }
  _step(dt){
    this.time+=dt;
    for(const key of TIMERS)this[key]=Math.max(0,this[key]-dt);
    if(!this.comboTime&&this.combo){this.combo=0;this.multiplier=1;}
    if(this._hopCut>0){this._hopCut-=dt;if(this._hopCut<=0){this._hopCut=0;this.releaseJump();}}
    this._gainCharge(dt*1.4);if(this.mode!=='running')return;
    this._stepPlatforms(dt);const p=this.player,oldX=p.x,wasGrounded=p.grounded;let oldFeet=p.y;
    const support=this.platforms.find(s=>s.id===this._groundId&&s.active!==false&&overlapX(p,s)&&Math.abs(p.y-s.y)<4);
    if(p.grounded&&!support){p.grounded=false;this._groundId=null;this._coyote=.12;}
    this._coyote=Math.max(0,this._coyote-dt);if(!p.grounded&&this._coyote===0&&p.jumps===0)p.jumps=1;
    const maxSpeed=this.speed*(this.powerTime>0?1.12:1);p.vx=approach(p.vx,this._move*maxSpeed,(p.grounded?2100:1450)*dt);
    p.x=clamp(p.x+p.vx*dt,W/2,this.width-W/2);p.moving=Math.abs(p.vx)>8?Math.sign(p.vx):0;if(this._move)p.facing=this._move;
    for(const s of this.platforms){
      if(s.active===false||s.oneWay||p.y<=s.y+2||p.y-H>=s.y+s.h-2||!overlapX(p,s))continue;
      // A low lip (the 24 px rise into a raised section) is walked up, not bumped into.
      if(wasGrounded&&s.type==='ground'&&p.y-s.y<=28){p.y=s.y;oldFeet=s.y;continue;}
      if(oldX+W/2<=s.x+2){p.x=s.x-W/2;p.vx=0;}else if(oldX-W/2>=s.x+s.w-2){p.x=s.x+s.w+W/2;p.vx=0;}
    }
    p.vy=Math.min(1100,p.vy+GRAVITY*dt);p.y+=p.vy*dt;p.grounded=false;this._groundId=null;
    if(p.vy>=0){
      let landing=null;for(const s of this.platforms)if(s.active!==false&&overlapX(p,s,2)&&oldFeet<=s.y+5&&p.y>=s.y&&(!landing||s.y<landing.y))landing=s;
      if(landing){const impact=p.vy,dropped=p.drop;p.y=landing.y;p.vy=0;p.grounded=true;p.jumps=0;p.drop=false;this._groundId=landing.id;this._coyote=.12;this.airStomps=0;if(!wasGrounded){this.emit('land',{x:p.x,y:p.y,speed:impact,drop:dropped,surface:landing.type});if(this.mode!=='running')return;}if(this._jumpBuffer>0){const tapped=this._tapBuffered;this.jump();if(tapped)this._hopCut=.08;}}
    }else{
      for(const s of this.platforms){if(s.active===false||s.oneWay||!overlapX(p,s,3))continue;const bottom=s.y+s.h;if(oldFeet-H>=bottom-3&&p.y-H<=bottom){p.y=bottom+H;p.vy=70;this._hitBlock(s);break;}}
    }
    if(p.y>528&&!this._wet){this._wet=true;this.emit('splash',{x:p.x,y:516,kind:this.zones.find(z=>p.x>=z.x&&p.x<=z.x+z.w)?.type||'water'});}else if(p.y<500)this._wet=false;
    if(p.y>this.height+110){this._damage('fall');if(this.mode!=='running')return;this._respawn();}
    this._stepRain(dt);
    for(const e of this.entities){
      if(e.taken)continue;
      if(e.type==='enemy'){this._enemyStep(e,dt,oldFeet);}
      else if(e.type==='spring'){
        if(this._springCooldown===0&&Math.abs(e.x-p.x)<W/2+e.w/2&&p.vy>=0&&p.y>=e.y-e.h/2&&p.y<=e.y+e.h/2+8){p.vy=-860*(this.charms.springBoost?1.2:1);p.jumpHeld=false;p.grounded=false;p.jumps=1;this._groundId=null;this._coyote=0;this._springCooldown=.3;this.springs++;this.emit('spring',{x:e.x,y:e.y});}
      }else if(e.type==='checkpoint'){
        if(!e.active&&Math.abs(e.x-p.x)<48&&Math.abs(e.y-(p.y-H/2))<70){e.active=true;this.checkpoints++;this.checkpoint={id:e.id,x:e.spawnX,y:e.spawnY};this.score+=50;this.hearts=Math.min(this.maxHearts,this.hearts+1);this.emit('checkpoint',{x:e.x,y:e.y,checkpoints:this.checkpoints});}
      }else if(e.type==='goal'){if(Math.abs(e.x-p.x)<55&&Math.abs(e.y-(p.y-H/2))<110)this._tryGoal(e);}
      else if(e.type==='marker'){if(!e.active&&p.x>=e.x-30&&p.x<=e.x+160&&e.spawnX>this.checkpoint.x){e.active=true;this.checkpoint={id:e.id,x:e.spawnX,y:e.spawnY};this.emit('marker',{x:e.x,y:e.y});}}
      else if(e.type==='balloon')this._balloonStep(e,oldFeet);
      else if(e.type==='vent')this._ventStep(e);
      else if(e.type==='chest'){if(e.secret&&!e.revealed&&Math.abs(e.x-p.x)<250&&Math.abs(e.y-(p.y-H/2))<145){e.revealed=true;this.emit('secret-found',{x:e.x,y:e.y});}}
      else if(e.type!=='block'&&e.type!=='sign'){if(e.rain){e.age=(e.age||0)+dt;e.y=Math.min(e.floor??1e9,e.y+e.vy*dt);e.life-=dt;if(e.life<=0||e.y>this.height+40){e.taken=true;continue;}}this._maybeCollect(e);}
      if(this.mode!=='running')return;
    }
    this.farthest=Math.max(this.farthest,p.x);this.distance=Math.max(0,this.farthest-this.level.spawn.x);this.camera.x=clamp(p.x-340,0,this.width-960);
  }
  _hitBlock(s){
    if(s.type!=='block'||s.used)return;s.used=true;this.blocks++;const e=this.entities.find(e=>e.platformId===s.id);if(e)e.used=true;
    if(e?.contains==='heart')this.entities.push({id:`block-heart-${s.id}`,type:'heart',x:s.x+s.w/2,y:s.y-30,w:28,h:28,taken:false});
    else for(let i=0;i<3;i++)this._collect({type:'bone',x:s.x+s.w/2,y:s.y,taken:false});
    this._gainCharge(6);this.emit('block',{x:s.x+s.w/2,y:s.y,blocks:this.blocks});
  }
  _enemyStep(e,dt,oldFeet){
    const p=this.player;e.hurtTime=Math.max(0,(e.hurtTime||0)-dt);
    // Hoppers leap along, floaters bob through the air, rollers are simply quick.
    if(e.subtype==='hopper'){const t=(this.time+(e.phase||0))%1.7,air=t<.62;e.y=e.baseY-(air?Math.sin(Math.PI*t/.62)*74:0);e.airborne=air;e.x+=(air?e.vx*1.5:0)*dt;}
    else if(e.subtype==='boss'){
      // A stomped boss leaps away in an arc and comes back a little faster each time.
      if(e.baseY===undefined)e.baseY=e.y;const leaping=e.hurtTime>0;
      e.y=e.baseY-(leaping?Math.sin(Math.PI*(1-e.hurtTime/.8))*130:0);e.airborne=leaping;e.x+=e.vx*(leaping?2.4:1+((e.maxHp||3)-e.hp)*.3)*dt;
    }
    else{if(e.subtype==='floater')e.y=e.baseY-59+Math.sin(this.time*1.7+(e.phase||0))*28;e.x+=e.vx*dt;}
    if(e.x<e.left){e.x=e.left;e.vx=Math.abs(e.vx);}if(e.x>e.right){e.x=e.right;e.vx=-Math.abs(e.vx);}
    const top=e.y-e.h/2,bottom=e.y+e.h/2;
    if(Math.abs(e.x-p.x)>W*.42+e.w*.43||p.y<=top||p.y-H>=bottom)return;
    if(p.vy>0&&oldFeet<=top+18){p.y=top-2;p.vy=this.charms.stompBounce?-560:-420;p.jumpHeld=false;p.grounded=false;p.jumps=1;this._groundId=null;this._coyote=0;if(!(e.hurtTime>0)){this.airStomps++;this.bestStompChain=Math.max(this.bestStompChain,this.airStomps);if(this.airStomps===4||(this.airStomps>4&&this.airStomps%2===0))this._goldRush(this.airStomps===4?3:2,'air');}this._stomp(e,false);}
    else if(this.powerTime>0)this._stomp(e,true);
    // A boss that has just been stomped is leaping away dazed: it cannot hurt.
    else if(!(e.subtype==='boss'&&e.hurtTime>0))this._damage('enemy',e);
  }
  _stomp(e,powered){
    if(e.hurtTime>0)return;e.hp--;e.hurtTime=.8;this.stomps++;this._gainCharge(10+(this.charms.stompCharge?15:0));
    const chain=powered?1:Math.max(1,this.airStomps),value=(e.subtype==='boss'?150:70)*(powered&&this.characterId==='spike'?3:1)+35*Math.min(5,chain-1);this.score+=value;
    this.emit(powered?'smash':'stomp',{x:e.x,y:e.y,kind:e.subtype,value,hp:e.hp,chain});
    if(e.hp<=0){e.taken=true;e.dead=true;if(e.subtype==='boss'){this.bossDefeated=true;this.score+=500;this.emit('boss-defeated',{x:e.x,y:e.y,name:e.name});}}
  }
  _damage(reason,entity){
    if(this.invincible>0||this.powerTime>0)return false;
    if(this.shieldCharges>0){this.shieldCharges--;this.invincible=1.4;this.emit('shield',{x:this.player.x,y:this.player.y-H/2,reason});return false;}
    this.hearts=Math.max(0,this.hearts-1);this.hits++;this.combo=0;this.multiplier=1;this.comboTime=0;this.charge=Math.max(0,this.charge-8);this.invincible=1.6+this.gear.grace*.15;
    if(entity){this.player.vx=(this.player.x<entity.x?-1:1)*230;this.player.vy=-310;this.player.grounded=false;this._groundId=null;}
    this.emit('hit',{hearts:this.hearts,reason,x:this.player.x,y:this.player.y-H/2});if(this.hearts===0)this._finish(false);return true;
  }
  _respawn(){const p=this.player;p.x=this.checkpoint.x;p.y=this.checkpoint.y;p.vx=0;p.vy=0;p.grounded=true;p.jumps=0;p.drop=false;this._groundId=this.platforms.find(s=>s.active!==false&&overlapX(p,s)&&Math.abs(s.y-p.y)<4)?.id||null;this._coyote=.12;this.invincible=Math.max(this.invincible,1.8);this.emit('respawn',{x:p.x,y:p.y});}
  _maybeCollect(e){
    const p=this.player,pullable=e.type==='bone'||e.type==='gold';let radius=0;
    if(pullable)radius=this.gear.magnet*18+(this.magnetTime>0?90:0)+(this.feverTime>0?50:0)+(this.powerTime>0?(this.characterId==='kevin'?190:45):0);
    if(e.type==='key'&&this.charms.secretMagnet)radius=110;
    if(Math.abs(e.x-p.x)<=W*.5+e.w*.5+radius&&Math.abs(e.y-(p.y-H/2))<=H*.43+e.h*.5+radius)this._collect(e);
  }
  _collect(e){
    e.taken=true;let value=0;
    if(e.type==='bone'||e.type==='gold'){
      this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.comboTime=5.4+this.charms.comboGrace;this.multiplier=Math.min(5,1+Math.floor(this.combo/6));
      this.treats+=e.type==='gold'?3:1;if(e.type==='gold')this.gold++;this._gainCharge(e.type==='gold'?15:5);
      if(this.combo%6===0)this.emit('combo',{combo:this.combo,multiplier:this.multiplier});
      if(this.combo>=18&&this._feverCooldown===0){this.feverTime=8;this._feverCooldown=22;this._rain=16;this._rainTimer=.35;this.emit('fever',{duration:8});}
      if(e.type==='gold'){this.goldRushTime=Math.min(12+this.charms.goldDuration*2,this.goldRushTime+4+this.charms.goldDuration);this.emit('gold-rush',{duration:this.goldRushTime,totalMultiplier:this.totalMultiplier});}
      this._recordMultiplier();value=Math.round((e.type==='gold'?100:10)*this.totalMultiplier);
    }else if(e.type==='key'){this.keys++;value=75;this._gainCharge(12);this.emit('key',{keys:this.keys,requiredKeys:this.requiredKeys,x:e.x,y:e.y});}
    else if(e.type==='magnet'){this.magnetTime=Math.min(21,this.magnetTime+7);value=30;this.emit('pickup',{kind:'magnet',duration:this.magnetTime});}
    else if(e.type==='shield'){this.shieldCharges=Math.min(2,this.shieldCharges+1);value=30;this.emit('pickup',{kind:'shield',charges:this.shieldCharges});}
    else if(e.type==='heart'){const healed=this.hearts<this.maxHearts;this.hearts=Math.min(this.maxHearts,this.hearts+1);value=healed?25:80;this.emit('heal',{hearts:this.hearts,healed});}
    this.score+=value;this.emit('collect',{kind:e.type,value,x:e.x,y:e.y,combo:this.combo,multiplier:this.multiplier,totalMultiplier:this.totalMultiplier});
  }
  // Gold Rush is always the same 2x layer; this only adds time to it.
  _goldRush(seconds,source='gold'){this.goldRushTime=Math.min(12+this.charms.goldDuration*2,this.goldRushTime+seconds);this._recordMultiplier();this.emit('gold-rush',{duration:this.goldRushTime,totalMultiplier:this.totalMultiplier,source});}
  // Treat balloons are one-way bounce pads: landing on one from above pops it,
  // pays its treats, and keeps an air chain going. They never block or hurt.
  _balloonStep(e,oldFeet){
    const p=this.player,top=e.y-e.h/2;
    if(p.vy<=0||Math.abs(e.x-p.x)>W*.5+e.w*.45||oldFeet>top+10||p.y<top)return;
    p.y=top-1;p.vy=this.charms.stompBounce?-640:-560;p.jumpHeld=false;p.grounded=false;p.jumps=1;p.drop=false;this._groundId=null;this._coyote=0;
    e.taken=true;this.pops++;this.airStomps++;this.bestStompChain=Math.max(this.bestStompChain,this.airStomps);
    const before=this.score,bonus=25*Math.min(6,this.airStomps-1);
    for(let i=0;i<(e.reward||2);i++)this._collect({type:'bone',x:e.x,y:e.y,taken:false});
    this.score+=bonus;this._gainCharge(4);if(this.airStomps===4||(this.airStomps>4&&this.airStomps%2===0))this._goldRush(this.airStomps===4?3:2,'air');
    this.emit('pop',{x:e.x,y:e.y,chain:this.airStomps,value:this.score-before,skin:e.skin||0});
  }
  // Vents erupt on a steady rhythm inside some gaps. One that is erupting
  // lifts anyone who has dropped below the trail, so it only ever helps.
  _ventStep(e){
    const p=this.player,phase=((this.time+(e.phase||0))%e.period)/e.period;e.erupting=phase<e.duty;e.cycle=phase;
    if(!e.erupting||this._ventCooldown>0||p.y<486||Math.abs(p.x-e.x)>e.w/2+W*.3)return;
    p.vy=-(e.lift||880);p.jumpHeld=false;p.grounded=false;p.jumps=1;p.drop=false;this._groundId=null;this._coyote=0;this._ventCooldown=.6;this._wet=false;this.vents++;
    this.emit('vent',{x:e.x,y:Math.min(p.y,520),skin:e.skin||0});
  }
  // A frenzy starts a short snack shower around the player.
  _stepRain(dt){
    if(this._rain<=0)return;this._rainTimer-=dt;if(this._rainTimer>0)return;
    this._rainTimer=.17;this._rain--;this._rainSeed=(Math.imul(this._rainSeed,1664525)+1013904223)>>>0;
    const r=this._rainSeed/4294967296,p=this.player;
    if(this._rain===15)this.entities=this.entities.filter(e=>!(e.rain&&e.taken));
    const x=clamp(p.x+p.vx*.9+(r-.42)*560,30,this.width-30),y=Math.max(-40,p.y-470);
    // A treat comes to rest on the first solid ground beneath it; over a gap it falls away.
    let floor;for(const s of this.platforms)if(s.active!==false&&RESTING.includes(s.type)&&x>=s.x&&x<=s.x+s.w&&s.y>y+40&&(floor===undefined||s.y<floor))floor=s.y;
    this.entities.push({id:`rain-${++this._rainCount}`,type:'bone',x,y,w:26,h:24,taken:false,rain:true,vy:150+((r*7919)%1)*80,life:6.5,age:0,...(floor===undefined?{}:{floor:floor-14})});
  }
  _updateInteraction(){
    const p=this.player,reach=this.charms.secretMagnet?150:95;
    // The nearest chest, sign, or goal within reach. Runs every step, so it allocates only when the answer changes.
    let e=null,best=reach;
    for(const item of this.entities){if(item.taken||(item.type!=='chest'&&item.type!=='goal'&&item.type!=='sign'))continue;const far=Math.abs(item.x-p.x);if(far<best&&Math.abs(item.y-(p.y-H/2))<125){best=far;e=item;}}
    const text=!e?'':e.type==='chest'?'Open the snack chest':e.type==='goal'?(this.keys>=this.requiredKeys&&this.bossDefeated?'Head onward':'Find both keys and clear the trail'):e.text;
    if(!e)this.interaction=null;else if(this.interaction?.id!==e.id||this.interaction.text!==text||this.interaction.x!==e.x||this.interaction.y!==e.y)this.interaction={id:e.id,type:e.type,text,x:e.x,y:e.y};
    if((e?.id||null)!==this._promptId){this._promptId=e?.id||null;this.emit('prompt',this.interaction||{text:'',id:null});}
  }
  interact(){
    if(this.mode!=='running')return false;this._updateInteraction();const e=this.entities.find(e=>e.id===this.interaction?.id);if(!e)return false;
    if(e.type==='goal')return this._tryGoal(e);
    if(e.type==='sign'){this.emit('dialog',{text:e.text,x:e.x,y:e.y});return true;}
    if(e.type==='chest'){
      e.taken=true;e.revealed=true;this.chests++;const before=this.score;
      for(let i=0;i<(e.reward||8);i++)this._collect({type:'bone',x:e.x,y:e.y,taken:false});
      if(e.secret){this.secrets++;this.score+=150;this._goldRush(5,'secret');this.emit('secret',{x:e.x,y:e.y,secrets:this.secrets});}
      this.emit('chest',{x:e.x,y:e.y,value:this.score-before,secret:!!e.secret});this._updateInteraction();return true;
    }
    return false;
  }
  _tryGoal(e){
    if(this.keys>=this.requiredKeys&&this.bossDefeated){this._finish(true);return true;}
    if(this.time-this._goalMessageAt>2){this._goalMessageAt=this.time;this.emit('locked',{keys:this.keys,requiredKeys:this.requiredKeys,bossDefeated:this.bossDefeated,text:this.keys<this.requiredKeys?'Two high-path keys open the snack stop.':'The snack guardian needs three stomps.',x:e.x,y:e.y});}return false;
  }
  _finish(won){if(this.mode!=='running'||this.finished)return;this.finished=true;this.mode=won?'won':'lost';this._move=0;if(won)this.score+=500+this.hearts*100+(this.hits===0?300:0);this.emit(won?'won':'lost',{result:this.result()});}
  result(){return {runId:this.runId,mode:'platform',state:this.mode,levelId:this.levelId,worldIndex:this.worldIndex,stage:this.worldIndex,characterId:this.characterId,won:this.mode==='won',score:Math.round(this.score),treats:this.treats,gold:this.gold,keys:this.keys,bestCombo:this.bestCombo,bestMultiplier:this.bestMultiplier,hits:this.hits,stomps:this.stomps,secrets:this.secrets,blocks:this.blocks,checkpoints:this.checkpoints,chests:this.chests,dodged:this.dodged,nearMisses:this.nearMisses,powersUsed:this.powersUsed,hearts:this.hearts,maxHearts:this.maxHearts,time:Number(this.time.toFixed(3)),distance:Math.round(this.distance),letters:0,seed:this.seed,remix:this.remix,assist:this.assist,dailyDate:this.dailyDate,bossDefeated:this.bossDefeated,springs:this.springs,doubleJumps:this.doubleJumps,pops:this.pops,vents:this.vents,bestStompChain:this.bestStompChain};}
  snapshot(){
    const fields=['time','distance','farthest','score','treats','gold','keys','hearts','charge','powerTime','powerDuration','powersUsed','invincible','shieldCharges','magnetTime','feverTime','goldRushTime','_feverCooldown','combo','bestCombo','multiplier','bestMultiplier','comboTime','hits','stomps','blocks','secrets','chests','checkpoints','dodged','nearMisses','springs','doubleJumps','pops','vents','bestStompChain','airStomps','_rain','_rainTimer','_rainCount','_rainSeed','bossDefeated','_groundId','_coyote'];
    const state=Object.fromEntries(fields.map(key=>[key,this[key]]));
    return clone({version:1,kind:'platform',mode:this.mode,config:this._config,runId:this.runId,player:this.player,checkpoint:this.checkpoint,state,
      entities:this.entities.filter(e=>e.rain?!e.taken:(e.taken||e.used||e.active||e.type==='enemy'||e.id.startsWith('block-heart-')||e.revealed)).map(e=>({id:e.id,taken:!!e.taken,used:!!e.used,active:!!e.active,revealed:!!e.revealed,hp:e.hp,x:e.x,y:e.y,vx:e.vx,hurtTime:e.hurtTime,...(e.rain||e.id.startsWith('block-heart-')?{spawn:e}:{})})),
      platforms:this.platforms.filter(s=>s.used||s.active===false||s.crumbleTimer).map(s=>({id:s.id,used:!!s.used,active:s.active,crumbleTimer:s.crumbleTimer||0,respawnIn:s.respawnIn||0}))});
  }
  restore(saved){
    if(!saved||saved.version!==1||saved.kind!=='platform'||!['running','paused'].includes(saved.mode)||!LEVELS.some(l=>l.id===saved.config?.levelId)||!saved.player||!saved.state)return false;
    this.reset({...saved.config,checkpoint:undefined});
    for(const [key,value] of Object.entries(saved.state)){if(!Object.hasOwn(this,key))continue;if(key==='_rainSeed')this[key]=(Number(value)||0)>>>0;else if(key==='_rain'||key==='_rainCount')this[key]=Math.round(clamp(value,0,key==='_rain'?16:1e6));else if(typeof this[key]==='number')this[key]=clamp(value,0,1e9);else if(key==='bossDefeated')this[key]=Boolean(value);else if(key==='_groundId')this[key]=typeof value==='string'?value:null;}
    this.hearts=clamp(this.hearts,1,this.maxHearts);this.player={...this.player,...saved.player,x:clamp(saved.player.x,W/2,this.width-W/2),y:clamp(saved.player.y,-200,this.height+50),vx:clamp(saved.player.vx,-400,400),vy:clamp(saved.player.vy,-1100,1100),w:W,h:H,width:W,height:H};
    if(saved.checkpoint&&Number.isFinite(saved.checkpoint.x)&&Number.isFinite(saved.checkpoint.y))this.checkpoint={id:String(saved.checkpoint.id||'saved'),x:clamp(saved.checkpoint.x,24,this.width-24),y:clamp(saved.checkpoint.y,0,600)};
    let rained=0;
    for(const change of Array.isArray(saved.entities)?saved.entities:[]){let e=this.entities.find(e=>e.id===change.id);if(!e&&change.spawn?.type==='heart'&&String(change.id).startsWith('block-heart-')){e={...change.spawn};this.entities.push(e);}
      // Treats from a snack shower that were still falling when the game was saved.
      else if(!e&&change.spawn?.rain===true&&change.spawn.type==='bone'&&/^rain-\d+$/.test(String(change.id))&&rained++<16){const t=change.spawn,floor=Number(t.floor);e={id:String(change.id),type:'bone',x:clamp(t.x,30,this.width-30),y:clamp(t.y,-60,this.height+40),w:26,h:24,taken:false,rain:true,vy:clamp(t.vy,100,260),life:clamp(t.life,0,6.5),age:clamp(t.age,0,6.5),...(Number.isFinite(floor)?{floor:clamp(floor,0,this.height)}:{})};this.entities.push(e);continue;}if(e)for(const key of ['taken','used','active','revealed','hp','x','y','vx','hurtTime'])if(change[key]!==undefined)e[key]=change[key];}
    for(const change of Array.isArray(saved.platforms)?saved.platforms:[]){const s=this.platforms.find(s=>s.id===change.id);if(s)Object.assign(s,{used:!!change.used,active:change.active!==false,crumbleTimer:finite(change.crumbleTimer),respawnIn:finite(change.respawnIn)});}
    const groundId=this._groundId;this._groundId=null;this._stepPlatforms(0);this._groundId=groundId;this._move=0;this._jumpBuffer=0;this.mode='running';this.finished=false;this.runId=typeof saved.runId==='string'?saved.runId.slice(0,150):this.runId;this._updateInteraction();this.emit('restore',{levelId:this.levelId,x:this.player.x,y:this.player.y});return true;
  }
}
