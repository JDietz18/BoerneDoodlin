// The simulation uses one coordinate system on every device. The renderer owns scaling.
export const WORLD = Object.freeze({width:1120,height:630,ground:492,playerX:180});
export const REGION_IDS = Object.freeze(['rogue-river','redwood-trail','painted-canyon','starlight-mesa','boerne-bound']);
const REGION_SPEEDS = [320,335,350,365,380];
const REGION_SECONDS = [55,58,60,62,65];
const BODY_WIDTH=44, BODY_HEIGHT=82, SLIDE_HEIGHT=31, GRAVITY=1850;
const WORD='GRIFFIN';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const boundedInt=(n,a,b)=>Math.round(clamp(n,a,b));
const item=(type,x,y=0,w=36,h=36,extra={})=>({type,x,y,w,h,...extra});
const bones=(xs,ys=18)=>xs.map((x,i)=>item('bone',x,Array.isArray(ys)?ys[i]:ys,30,30));

// Authored chunks are deliberately separated by landing/recovery space. Pickup routes
// are attached to those chunks, so random generation cannot create contradictory tasks.
export const COURSE_PATTERNS = Object.freeze([
  {id:'easy-hop',minStage:0,length:1120,items:[item('log',440,0,76,52,{hint:'JUMP'}),...bones([200,300,380,450,520,670,800],[18,25,78,104,78,18,18])]},
  {id:'low-branch',minStage:0,length:1120,items:[item('branch',450,59,108,43,{hint:'SLIDE'}),...bones([220,320,410,490,580,720],[18,18,12,12,18,18])]},
  {id:'creek-hop',minStage:0,length:1180,items:[item('gap',470,-22,150,22,{hint:'JUMP'}),...bones([230,350,430,500,580,740],[18,60,95,112,75,18]),item('gold',490,183,34,34)]},
  {id:'spring-picnic',minStage:0,length:1240,items:[item('spring',350,0,58,18,{hint:'BOUNCE'}),...bones([200,420,500,580,660,820],[18,100,150,178,150,18]),item('gold',690,186,34,34)]},
  {id:'snack-meadow',minStage:0,length:1050,items:[...bones([180,280,380,480,580,680,780],[18,22,30,38,30,22,18])]},
  {id:'double-hop',minStage:1,length:1330,items:[item('log',350,0,70,48,{hint:'JUMP'}),item('log',790,0,82,60,{hint:'JUMP'}),...bones([240,350,460,680,790,900],[65,104,65,70,114,70])]},
  {id:'high-road',minStage:1,length:1220,items:[item('branch',460,59,108,43,{hint:'SLIDE OR DOUBLE JUMP'}),...bones([240,350,440,530,670],[18,12,12,12,18]),item('gold',465,205,34,34),...bones([390,530],[170,170])]},
  {id:'duck-then-hop',minStage:2,length:1460,items:[item('branch',340,59,108,43,{hint:'SLIDE'}),item('log',880,0,86,57,{hint:'JUMP'}),...bones([230,340,450,740,850,940,1090],[18,12,18,65,104,85,18])]},
  {id:'wide-creek',minStage:2,length:1320,items:[item('gap',500,-22,205,22,{hint:'HOLD JUMP'}),...bones([230,360,450,540,630,810],[18,60,108,120,80,18]),item('gold',540,200,34,34)]},
  {id:'bounce-and-glide',minStage:3,length:1510,items:[item('spring',330,0,58,18,{hint:'BOUNCE'}),item('gap',700,-22,170,22,{hint:'JUMP'}),...bones([210,430,530,630,730,840,1080],[18,115,170,190,160,80,18]),item('gold',700,220,34,34)]}
].map(pattern=>Object.freeze({...pattern,items:Object.freeze(pattern.items.map(entry=>Object.freeze(entry)))})));

export function seededRandom(seed=1){
  let state=(Number(seed)>>>0)||0x6d2b79f5;
  return ()=>{state=(state+0x6d2b79f5)>>>0;let n=Math.imul(state^(state>>>15),1|state);n^=n+Math.imul(n^(n>>>7),61|n);return ((n^(n>>>14))>>>0)/4294967296;};
}

let instanceSequence=0;
export class AdventureRun {
  constructor({onEvent=()=>{},random,seed=1}={}){
    this.onEvent=onEvent;this._providedRandom=typeof random==='function'?random:null;
    this._defaultSeed=Number(seed)>>>0;this._instance=++instanceSequence;this._runs=0;
    this._silent=true;this.reset();this._silent=false;this.mode='ready';
  }
  emit(type,data={}){if(!this._silent)this.onEvent({...data,type});}
  reset({mode='adventure',stage=0,characterId='griffin',gear={},assist=false,seed,dailyDate='',regionId}={}){
    this.runMode=['adventure','endless','daily'].includes(mode)?mode:'adventure';
    this.stage=boundedInt(stage,0,4);this.regionId=regionId||REGION_IDS[this.stage];
    this.characterId=['griffin','kevin','mittens','spike'].includes(characterId)?characterId:'griffin';
    this.assist=this.runMode==='daily'?false:Boolean(assist);
    const standardized=this.runMode==='daily';
    this.gear={magnet:standardized?0:boundedInt(gear.magnet,0,3),charge:standardized?0:boundedInt(gear.charge,0,3),heart:standardized?0:boundedInt(gear.heart,0,2),grace:standardized?0:boundedInt(gear.grace,0,3)};
    this.seed=(Number(seed??this._defaultSeed)>>>0)||1;
    this._random=this.runMode!=='daily'&&seed===undefined&&this._providedRandom?this._providedRandom:seededRandom(this.seed);
    this.dailyDate=String(dailyDate||'');this.runId=`run-${Date.now().toString(36)}-${this._instance}-${++this._runs}`;
    this.mode='running';this.finished=false;this.time=0;this.distance=0;
    this.baseSpeed=this.runMode==='endless'?320:REGION_SPEEDS[this.stage];
    this.goal=this.runMode==='adventure'?this.baseSpeed*REGION_SECONDS[this.stage]:Infinity;
    this.timeLimit=this.runMode==='daily'?90:0;
    this.speed=this.baseSpeed*(this.assist?.84:1);this.score=0;this.treats=0;this.gold=0;this.letters=0;this.letterMask=0;this._wordComplete=false;
    this.maxHearts=3+(this.characterId==='spike'?1:0)+this.gear.heart+(this.assist?1:0);this.hearts=this.maxHearts;
    this.charge=50+this.gear.charge*10;this.powerTime=0;this.powerDuration=0;this.powersUsed=0;this.invincible=0;
    this.magnetTime=0;this.shieldCharges=0;this.feverTime=0;this.goldRushTime=0;this.bestMultiplier=1;this._feverCooldown=0;
    this.combo=0;this.bestCombo=0;this.multiplier=1;this.comboTime=0;this.hits=0;this.dodged=0;this.nearMisses=0;this.springs=0;this.slides=0;this.doubleJumps=0;
    this.player={x:WORLD.playerX,y:0,vy:0,grounded:true,sliding:false,jumps:0,jumpHeld:false,drop:false,width:BODY_WIDTH,height:BODY_HEIGHT};
    this.entities=[];this._entitySequence=0;this._nextChunk=0;this._chunkIndex=0;this._lastPattern='';this.patternHistory=[];
    this._jumpBuffer=0;this._coyote=.1;this._slideTime=0;this._queuedSlide=false;this._lastGrounded=true;
    this._section=0;this.sections=0;this._hints=new Set();
    const span=this.runMode==='adventure'?this.goal:this.baseSpeed*(this.runMode==='daily'?90:65);
    this._letterDistances=Array.from({length:7},(_,i)=>span*(i+1)/8);this._nextLetter=0;
    this._ensureCourse();this.emit('start',{runId:this.runId,mode:this.runMode,stage:this.stage});
    return this;
  }
  jump(){
    if(this.mode!=='running')return false;
    const p=this.player;
    if(p.grounded||this._coyote>0){p.jumps=1;return this._launch(false);}
    if(p.jumps<2){p.jumps++;this.doubleJumps++;return this._launch(true);}
    this._jumpBuffer=.12+this.gear.grace*.02;return false;
  }
  _launch(isDouble){
    const p=this.player;p.vy=(isDouble?620:660)*(this.characterId==='mittens'?1.06:1);
    p.grounded=false;p.sliding=false;p.jumpHeld=true;p.drop=false;
    this._slideTime=0;this._queuedSlide=false;this._coyote=0;this._jumpBuffer=0;
    this.emit(isDouble?'double-jump':'jump',{x:p.x,y:p.y});return true;
  }
  releaseJump(){
    const p=this.player;if(p.jumpHeld&&p.vy>230)p.vy=Math.max(210,p.vy*.46);p.jumpHeld=false;
  }
  slide(){
    if(this.mode!=='running')return false;
    const p=this.player;this.slides++;
    if(!p.grounded&&p.y>5){p.vy=Math.min(p.vy,-850);p.drop=true;this._queuedSlide=true;this.emit('slide',{airborne:true});return true;}
    this._slideTime=this._slideDuration();p.sliding=true;p.height=SLIDE_HEIGHT;this.emit('slide',{airborne:false});return true;
  }
  _slideDuration(){return (.55+this.gear.grace*.025)/(this.assist?.84:1);}
  power(){
    if(this.mode!=='running'||this.charge<100||this.powerTime>0)return false;
    this.charge=0;this.powersUsed++;
    this.powerDuration=({griffin:4.4,kevin:5.3,mittens:3.9,spike:4.8})[this.characterId];
    this.powerTime=this.powerDuration;
    if(this.characterId==='mittens'){
      if(this.hearts<this.maxHearts){this.hearts++;this.emit('heal',{hearts:this.hearts});}
      else this.shieldCharges=Math.min(2,this.shieldCharges+1);
    }
    this._recordMultiplier();this.emit('power',{characterId:this.characterId,duration:this.powerDuration});return true;
  }
  get totalMultiplier(){return this.multiplier*(this.feverTime>0?2:1)*(this.goldRushTime>0?2:1)*(this.powerTime>0&&this.characterId==='griffin'?1.5:1);}
  _recordMultiplier(){this.bestMultiplier=Math.max(this.bestMultiplier,this.totalMultiplier);}
  pause(){if(this.mode!=='running')return;this.mode='paused';this.player.jumpHeld=false;this.emit('pause');}
  resume(){if(this.mode!=='paused')return;this.mode='running';this.emit('resume');}
  _gainCharge(amount){
    const before=this.charge,limit=this.powerTime>0?90:100;
    this.charge=Math.min(limit,this.charge+amount*(1+this.gear.charge*.12));
    if(before<100&&this.charge>=100)this.emit('charged');
  }
  _addEntity(spec,anchor){
    this.entities.push({...spec,x:WORLD.playerX+anchor+spec.x-this.distance,id:++this._entitySequence,worldX:anchor+spec.x,hit:false,passed:false,taken:false,closest:Infinity});
  }
  _ensureCourse(){
    while(this._nextChunk<this.distance+WORLD.width+1000){
      const start=this._nextChunk;
      if(Number.isFinite(this.goal)&&start>this.goal+400)break;
      let pattern;
      if(this._chunkIndex===0){pattern={id:'warm-up',length:1240,items:bones([240,360,480,600,720,840,960],[18,18,18,18,18,18,18])};}
      else if(Number.isFinite(this.goal)&&start>this.goal-1400){pattern=COURSE_PATTERNS.find(p=>p.id==='snack-meadow');}
      else{
        const teaching=['easy-hop','low-branch','spring-picnic','creek-hop'];
        if(this._chunkIndex<=4)pattern=COURSE_PATTERNS.find(p=>p.id===teaching[this._chunkIndex-1]);
        else{
          const difficulty=this.runMode==='endless'?Math.min(4,Math.floor(start/6500)):this.stage;
          let pool=COURSE_PATTERNS.filter(p=>p.minStage<=difficulty&&p.id!==this._lastPattern);
          // A restful pickup chunk regularly breaks up the action.
          if(this._chunkIndex%5===0)pool=COURSE_PATTERNS.filter(p=>p.id==='snack-meadow');
          pattern=pool[Math.min(pool.length-1,Math.floor(this._random()*pool.length))];
        }
      }
      for(const spec of pattern.items){
        if(!Number.isFinite(this.goal)||start+spec.x<this.goal-140)this._addEntity(spec,start);
      }
      const safeOffset=pattern.length-150;
      if(this._chunkIndex>1&&this._chunkIndex%4===0){
        const choices=['magnet','shield','heart'];
        this._addEntity(item(choices[Math.min(2,Math.floor(this._random()*3))],safeOffset-80,26,34,34),start);
      }
      while(this._nextLetter<7&&this._letterDistances[this._nextLetter]<start+pattern.length){
        const letterIndex=this._nextLetter++;
        this._addEntity(item('letter',safeOffset,35,36,40,{letter:WORD[letterIndex],letterIndex}),start);
      }
      this.patternHistory.push({id:pattern.id,distance:start});if(this.patternHistory.length>256)this.patternHistory.shift();
      this._lastPattern=pattern.id;this._nextChunk+=pattern.length;this._chunkIndex++;
    }
  }
  update(dt){
    if(this.mode!=='running')return;
    let remaining=Math.min(.1,Math.max(0,Number(dt)||0));
    while(remaining>1e-8&&this.mode==='running'){
      const step=Math.min(1/120,remaining);remaining-=step;this._step(step);
    }
  }
  _step(dt){
    this.time+=dt;
    for(const key of ['invincible','powerTime','magnetTime','feverTime','goldRushTime','_feverCooldown','comboTime','_jumpBuffer'])this[key]=Math.max(0,this[key]-dt);
    if(!this.comboTime&&this.combo){this.combo=0;this.multiplier=1;}
    this._gainCharge(dt*1.8);
    if(this.mode!=='running')return;
    const ramp=this.runMode==='endless'?Math.min(210,this.time*1.6):this.runMode==='daily'?35*Math.min(1,this.time/90):this.baseSpeed*(-.08+.16*Math.min(1,this.distance/this.goal));
    this.speed=Math.min(560,(this.baseSpeed+ramp)*(this.assist?.84:1)*(this.powerTime>0?1.12:1));
    const travel=this.speed*dt;this.distance+=travel;
    for(const e of this.entities)e.x-=travel;
    this._ensureCourse();
    const p=this.player,wasGrounded=p.grounded;
    this._slideTime=Math.max(0,this._slideTime-dt);p.sliding=this._slideTime>0&&p.grounded;p.height=p.sliding?SLIDE_HEIGHT:BODY_HEIGHT;
    const gap=this.powerTime>0?null:this.entities.find(e=>e.type==='gap'&&!e.hit&&Math.abs(e.x-p.x)<e.w*.5-10);
    if(p.grounded&&gap){p.grounded=false;this._coyote=.1+this.gear.grace*.02;}
    if(!p.grounded){p.vy-=GRAVITY*dt;p.y+=p.vy*dt;this._coyote=Math.max(0,this._coyote-dt);if(this._coyote===0&&p.jumps===0)p.jumps=1;}
    if(p.y<=0&&!gap){
      const landed=!p.grounded;p.y=0;p.vy=0;p.grounded=true;p.jumps=0;p.drop=false;this._coyote=.1;
      if(this._queuedSlide){this._queuedSlide=false;this._slideTime=this._slideDuration();p.sliding=true;p.height=SLIDE_HEIGHT;}
      if(landed){this.emit('land',{x:p.x,y:0});if(this.mode!=='running')return;}
      if(this._jumpBuffer>0)this.jump();
    }
    if(gap&&p.y<-24){
      this._damage(gap,'gap');if(this.mode!=='running')return;
      gap.hit=true;p.y=42;p.vy=390;p.jumps=1;p.grounded=false;p.sliding=false;p.drop=false;
      this.invincible=Math.max(this.invincible,2.1);this._queuedSlide=false;
    }
    // Input should not be lost on the same frame that a player steps off a ledge.
    if(wasGrounded&&!p.grounded&&p.jumps===0)this._coyote=Math.max(this._coyote,.1);
    for(const e of this.entities){
      if(e.taken)continue;
      if(['log','branch','gap'].includes(e.type)){
        const horizontal=Math.abs(e.x-p.x)<e.w*.46+BODY_WIDTH*.5;
        if(e.type!=='gap'&&horizontal&&!e.hit&&!e.cleared){
          const feet=p.y+5,head=p.y+p.height-5,top=e.y+e.h,bottom=e.y;
          const overlaps=feet<top-3&&head>bottom+3;
          if(overlaps){
            if(this.powerTime>0){e.hit=true;this.score+=this.characterId==='spike'?150:50;this.emit('smash',{kind:e.type,x:e.x,y:e.y});}
            else this._damage(e,e.type);
            if(this.mode!=='running')return;
          }else{
            e.closest=Math.min(e.closest,Math.max(feet-top,bottom-head,0));
            // Once the player's center has safely slid underneath a branch, a
            // recovering animation must not turn the trailing edge into a hit.
            if(e.type==='branch'&&p.sliding&&e.x<=p.x)e.cleared=true;
          }
        }
        if(!e.passed&&e.x+e.w*.5<p.x-BODY_WIDTH*.5){
          e.passed=true;
          if(!e.hit){
            this.dodged++;this.score+=20;this._gainCharge(4);this.emit('dodge',{kind:e.type,x:e.x,y:e.y});
            if(e.closest<35){this.nearMisses++;this.score+=35;this._gainCharge(3);this.emit('near-miss',{kind:e.type});}
          }
        }
        if(!e.hinted&&Math.abs(e.x-p.x)<400&&!this._hints.has(e.hint)){
          e.hinted=true;this._hints.add(e.hint);this.emit('hint',{action:e.hint,kind:e.type});
        }
      }else if(e.type==='spring'){
        if(!e.hit&&Math.abs(e.x-p.x)<e.w*.5+12&&p.y<24&&p.vy<=80){
          e.hit=true;p.y=Math.max(18,p.y);p.vy=880;p.grounded=false;p.jumps=1;p.sliding=false;p.drop=false;this._slideTime=0;this._coyote=0;this.springs++;
          this.emit('spring',{x:e.x,y:e.y});
        }
      }else this._maybeCollect(e);
      if(this.mode!=='running')return;
    }
    this.entities=this.entities.filter(e=>e.x>-200&&!e.taken);
    const section=this.runMode==='adventure'?Math.min(2,Math.floor(this.distance/this.goal*3)):Math.floor(this.time/30);
    if(section!==this._section){this._section=section;this.sections=section;this.emit('section',{section,index:section,stage:this.stage});if(this.mode!=='running')return;}
    if(this.runMode==='adventure'&&this.distance>=this.goal){this.distance=this.goal;this._finish(true);}
    else if(this.timeLimit&&this.time>=this.timeLimit){this.time=this.timeLimit;this._finish(true);}
  }
  _damage(e,reason){
    e.hit=true;
    if(this.invincible>0||this.powerTime>0)return false;
    if(this.shieldCharges>0){this.shieldCharges--;this.invincible=.9;this.emit('shield',{x:e.x,y:e.y,reason});return false;}
    this.hearts=Math.max(0,this.hearts-1);this.hits++;this.combo=0;this.multiplier=1;this.comboTime=0;
    this.invincible=1.8+this.gear.grace*.2;this.charge=Math.max(0,this.charge-10);
    this.emit('hit',{hearts:this.hearts,reason,x:this.player.x,y:this.player.y});
    if(this.hearts===0)this._finish(false);return true;
  }
  _maybeCollect(e){
    const p=this.player;
    let extra=this.gear.magnet*20+(this.magnetTime>0?120:0)+(this.feverTime>0?65:0);
    if(this.powerTime>0)extra+=this.characterId==='kevin'?245:70;
    const dx=Math.abs(e.x-p.x),dy=Math.abs(e.y+e.h*.5-(p.y+p.height*.52));
    const pullable=['bone','gold'].includes(e.type),radius=extra*(pullable?1:.2);
    if(dx>40+radius||dy>52+radius)return;
    e.taken=true;
    let value=0;
    if(e.type==='bone'||e.type==='gold'){
      this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.comboTime=5.4;this.multiplier=Math.min(5,1+Math.floor(this.combo/6));
      this.treats+=e.type==='gold'?3:1;if(e.type==='gold')this.gold++;
      this._gainCharge(e.type==='gold'?15:5);
      if(this.combo%6===0)this.emit('combo',{combo:this.combo,multiplier:this.multiplier});
      if(this.combo>=24&&this._feverCooldown===0){this.feverTime=8;this._feverCooldown=24;this.emit('fever',{duration:8});}
      if(e.type==='gold'){this.goldRushTime=Math.min(12,this.goldRushTime+4);this.emit('gold-rush',{duration:this.goldRushTime,totalMultiplier:this.totalMultiplier});}
      this._recordMultiplier();value=Math.round((e.type==='gold'?100:10)*this.totalMultiplier);
    }else if(e.type==='letter'){
      const bit=1<<e.letterIndex;
      if(!(this.letterMask&bit)){this.letterMask|=bit;this.letters++;value=80;this._gainCharge(8);}
      if(this.letters===7&&!this._wordComplete){this._wordComplete=true;value+=400;this.feverTime=10;this._feverCooldown=24;this._recordMultiplier();this.emit('word',{word:WORD,duration:10});}
    }else if(e.type==='magnet'){this.magnetTime=Math.min(21,this.magnetTime+7);value=30;this.emit('pickup',{kind:e.type,duration:this.magnetTime});}
    else if(e.type==='shield'){this.shieldCharges=Math.min(2,this.shieldCharges+1);value=30;this.emit('pickup',{kind:e.type,charges:this.shieldCharges});}
    else if(e.type==='heart'){const healed=this.hearts<this.maxHearts;this.hearts=Math.min(this.maxHearts,this.hearts+1);value=healed?25:80;this.emit('heal',{hearts:this.hearts,healed});}
    this.score+=value;this.emit('collect',{value,kind:e.type,x:e.x,y:e.y,combo:this.combo,multiplier:this.multiplier,totalMultiplier:this.totalMultiplier,letter:e.letter,letterIndex:e.letterIndex});
  }
  _finish(won){
    if(this.mode!=='running'||this.finished)return;
    this.finished=true;this.mode=won?'won':'lost';
    if(won)this.score+=this.hearts*80+(this.hits===0?200:0);
    this.emit(won?'won':'lost',{result:this.result()});
  }
  result(){
    return {runId:this.runId,mode:this.runMode,state:this.mode,stage:this.stage,regionId:this.regionId,characterId:this.characterId,won:this.mode==='won',score:Math.round(this.score),treats:this.treats,distance:Math.round(this.distance),time:Number(this.time.toFixed(3)),hits:this.hits,dodged:this.dodged,nearMisses:this.nearMisses,bestCombo:this.bestCombo,bestMultiplier:this.bestMultiplier,gold:this.gold,letters:this.letters,letterMask:this.letterMask,powersUsed:this.powersUsed,hearts:this.hearts,maxHearts:this.maxHearts,seed:this.seed,assist:this.assist,gear:{...this.gear},dailyDate:this.dailyDate,springs:this.springs,slides:this.slides,doubleJumps:this.doubleJumps};
  }
}
