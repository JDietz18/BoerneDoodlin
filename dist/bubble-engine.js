// Bubble Pop: tap bubbles, or drag a finger through a whole string of them. The
// stack, the result summary and the event vocabulary match Snack Storm, so the
// HUD, the bonus-stack meter, the controller and the audio need no special cases.
// Rendering, input devices, audio, and storage stay outside.
//
// A run is always 45 seconds of simulation time:
//   0.00-1.50  a 3-2-1-GO count while the first bubbles are already floating up
//   15 and 30  the sky fills up (the existing `section` event)
//   35-45      the final push: faster, fuller bubbles and a tick every second
//   41         one golden goodbye: three golden bubbles that stay on screen to the end
//
// The field is unit space: x runs 0..1 across, y runs 0 (just under the HUD) to
// 1 (the grass line the buddy stands on). A bubble that rises past y=.02
// floats away, which costs nothing. The view tells the engine how big the field
// is on this phone (setField) so hit tests are made in real CSS pixels.
//
// The miss rule, for children in a moving car:
//   * a bubble that floats away is free: no score, no hearts (there are none), no break;
//   * the chain simply is not extended by it, and it times out after 5.4 seconds with no treat pop;
//   * popping a burr bubble breaks the chain (nothing else does), and dragging never pops a burr.
//
// Determinism: the spawn schedule (when, where, what, how fast, how it drifts) is drawn
// from one seeded stream in a fixed order, so a seed gives the same sky whatever the player
// does and at any frame rate. Everything the player causes (split bubbles, bluebonnet
// bursts, summoned golden bubbles) draws from a second stream. Nothing here reads the global random source.
//
// Events (every payload also carries `type`; x and y are field units 0..1):
//   start pause resume won{result} section{section} charged
//   countdown{count 3|2|1|0}  final-push{remaining}  tick{remaining 10..1}  finale{x}
//   collect{kind 'bone'|'gold',value,x,y,combo,multiplier,totalMultiplier,bonus,variant,mass}
//   string{count,bonus,x,y}     (a flat bonus, never multiplied)
//   burr{x,y,combo}  smash{kind:'burr',value,x,y}  escape{kind,x,y}  chain-lost{combo,multiplier,reason}
//   combo{combo,multiplier}  stack{tier 1|2|3,level 10|20|30,totalMultiplier}
//   fever{duration} fever-end  gold-rush{duration,totalMultiplier} gold-rush-end  power{characterId,duration} power-end
//   bark{count}  summon{count}  pounce{x,count}              (the four powers)
//   split{x,y} (Starlight Mesa)  bloom{x,y,count} (Boerne Hills)
export const BUBBLE_TWISTS=Object.freeze(['wobble','breeze','columns','glow','bloom']);
export const BUBBLE_TIMING=Object.freeze({limit:45,countdown:Object.freeze([0,.5,1,1.5]),finalPush:35,finale:41});
// Drawn radius never falls below MIN_RADIUS CSS px; a treat answers a touch within its radius plus SLOP.
// So every treat bubble is at least 2 x (27 + 17) = 88 px across to the thumb, and 54 px to the eye.
export const BUBBLE_HIT=Object.freeze({minRadius:27,slop:17});
export const BUBBLE_COLUMNS=Object.freeze([.12,.31,.5,.69,.88]);
const LIMIT=45,PUSH_AT=35,FINALE_AT=41,SPAWN_END=42,ESCAPE_Y=.02,TOUCHABLE_Y=.05,STRING_GAP=.7,BONUS_ID=100000,CHAIN_TIME=5.4,CLEAN_MIN=10,SUMMON_COUNT=3,SMASH_BASE=60,SUMMON_BASE=50,PRIZES=3;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const level=(value,max=3)=>Math.round(clamp(value,0,max));
const rngFor=seed=>{let n=(Number(seed)>>>0)||1;return()=>{n=(n+0x6d2b79f5)>>>0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};};
const stringBonus=count=>Math.min(40,10+5*(count-3));
let instanceSequence=0;

export class BubblePop {
  constructor({onEvent=()=>{},seed=1}={}){
    this.onEvent=onEvent;this._defaultSeed=Number(seed)>>>0;
    this._instance=++instanceSequence;this._runs=0;this._silent=true;this.reset();this._silent=false;this.mode='ready';
  }
  emit(type,data={}){if(!this._silent)this.onEvent({...data,type});}
  reset({characterId='griffin',gear={},assist=false,seed,worldIndex=0}={}){
    this.runMode='bubble';this.mode='running';this.stage=0;this.regionId='rogue-river';this.dailyDate='';
    // The controller may set worldIndex again after reset; the twist reads it as bubbles are made.
    this.worldIndex=level(worldIndex,4);
    this.characterId=['griffin','kevin','mittens','spike'].includes(characterId)?characterId:'griffin';
    this.gear={magnet:level(gear.magnet),charge:level(gear.charge),heart:level(gear.heart,2),grace:level(gear.grace)};
    this.assist=Boolean(assist);this.seed=(Number(seed??this._defaultSeed)>>>0)||1;
    this._random=rngFor(this.seed);                       // the schedule, and only the schedule
    this._extra=rngFor((this.seed^0x51ed270b)>>>0||7);    // everything the player causes
    this.runId=`bubble-${Date.now().toString(36)}-${this._instance}-${++this._runs}`;
    this.time=0;this.timeLimit=LIMIT;this.goal=Infinity;this.distance=0;
    this.field={w:390,h:640};this.inset={left:0,right:0};this.reducedMotion=this.reducedMotion||false;
    this.score=0;this.treats=0;this.gold=0;this.letters=0;this.letterMask=0;
    this.charge=50+this.gear.charge*10;this.powerTime=0;this.powerDuration=0;this.powersUsed=0;
    this.feverTime=0;this.goldRushTime=0;this._feverCooldown=0;
    this.combo=0;this.bestCombo=0;this.multiplier=1;this.bestMultiplier=1;this.comboTime=0;this._stackTier=0;
    this.popped=0;this.escaped=0;this.burrs=0;this.hits=0;this.strings=0;this.bestString=0;this.stringBonus=0;this.sections=0;this.finished=false;
    this.bloomed=0;this.smashed=0;this.splits=0;this.summoned=0;this.chainsLost=0;
    this.entities=[];this.spawnLog=[];this.extraLog=[];this._sequence=0;this._bonusSequence=0;this._spawned=0;this._nextSpawn=.25;this._finale=false;
    this._countStep=0;this._lastTick=11;this._windPhase=(this.seed%628)/100;this.wind=0;
    this.reticle={x:.5,y:.55};this.keyboard=false;this._nudge={x:0,y:0};this._strokes=new Map();this.trails=[];this._lastX=.5;this._lastPopAt=-9;
    this.emit('start',{runId:this.runId,mode:this.runMode,stage:0});return this;
  }
  get _shell(){return this.powerTime>0&&this.characterId==='spike';}
  get totalMultiplier(){return this.multiplier*(this.feverTime>0?2:1)*(this.goldRushTime>0?2:1)*(this.powerTime>0&&this.characterId==='griffin'?1.5:1);}
  // Which of the five world twists this run plays with.
  get twist(){return BUBBLE_TWISTS[level(this.worldIndex,4)];}
  get intro(){return Math.max(0,BUBBLE_TIMING.countdown[3]-this.time);}
  get finalPush(){return this.time>=PUSH_AT&&this.mode==='running';}
  // 0..1 through the six pops that earn the next chain step (1 at the 5x cap).
  get chainProgress(){return this.multiplier>=5?1:(this.combo%6)/6;}
    // The view reports the size of the play field and the side safe-area insets (a landscape notch), so bubbles stay where a thumb can reach.
  setField(width,height,left=0,right=0){const w=Number(width),h=Number(height);if(w>20&&h>20)this.field={w,h};this.inset={left:clamp(left,0,200),right:clamp(right,0,200)};}
  // Reduced motion: bubbles still rise, but they stop swaying and the breeze stops pushing them. The schedule is untouched.
  setReducedMotion(on){this.reducedMotion=Boolean(on);}
  get _xMin(){return Math.max(.05,(this.inset.left+30)/this.field.w);}
  get _xMax(){return Math.min(.95,1-(this.inset.right+30)/this.field.w);}
  radiusPx(e){return Math.max(e.r*this.field.h,BUBBLE_HIT.minRadius);}
  hitPx(e){return this.radiusPx(e)+(e.kind==='burr'?0:BUBBLE_HIT.slop);}
  _recordMultiplier(){this.bestMultiplier=Math.max(this.bestMultiplier,this.totalMultiplier);}
  _trackStack(){
    const total=this.totalMultiplier,tier=total>=30?3:total>=20?2:total>=10?1:0;
    if(tier>this._stackTier)this.emit('stack',{tier,level:[10,20,30][tier-1],totalMultiplier:total});
    this._stackTier=tier;
  }

  // --- input ---------------------------------------------------------------
  // A finger lands: pop the bubble under it (a treat if both a treat and a burr are in reach), and start a string.
  touchStart(id,x,y){
    if(this.mode!=='running'||!Number.isFinite(Number(x))||!Number.isFinite(Number(y)))return 0;
    this.keyboard=false;const stroke={id,x:Number(x),y:Number(y),count:0,lastPop:-9,pts:[{x:Number(x),y:Number(y),t:this.time}]};
    this._strokes.set(id,stroke);this.trails.push(stroke);
    return this._tapAt(stroke,x,y);
  }
  // The finger moved. The whole segment from where it was is swept, so a fast drag cannot skip a bubble,
  // and burrs are never popped by dragging.
  touchMove(id,x,y){
    const s=this._strokes.get(id);if(!s||this.mode!=='running'||!Number.isFinite(Number(x))||!Number.isFinite(Number(y)))return 0;
    const {w,h}=this.field,ax=s.x*w,ay=s.y*h,bx=Number(x)*w,by=Number(y)*h,dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy,hits=[];
    for(const e of this.entities){
      if(!this._live(e)||(e.kind==='burr'&&!this._shell))continue;
      const ex=e.x*w,ey=e.y*h,t=len2>1e-6?clamp(((ex-ax)*dx+(ey-ay)*dy)/len2,0,1):0,d=Math.hypot(ex-(ax+dx*t),ey-(ay+dy*t));
      if(d<=this.hitPx(e))hits.push({e,t});
    }
    hits.sort((a,b)=>a.t-b.t||a.e.id-b.e.id);
    let popped=0;for(const hit of hits)if(this._live(hit.e)){this._pop(hit.e,s);popped++;}
    s.x=Number(x);s.y=Number(y);s.pts.push({x:s.x,y:s.y,t:this.time});if(s.pts.length>14)s.pts.shift();
    return popped;
  }
  touchEnd(id){this._strokes.delete(id);}
  _live(e){return !e.popped&&!e.gone&&e.y>=TOUCHABLE_Y&&e.y<=1.03;}
  _tapAt(stroke,x,y){
    const {w,h}=this.field,px=Number(x)*w,py=Number(y)*h;let treat=null,treatScore=Infinity,burr=null,burrDist=Infinity;
    for(const e of this.entities){
      if(!this._live(e))continue;const d=Math.hypot(e.x*w-px,e.y*h-py);
      if(e.kind==='burr'){if(d<=this.radiusPx(e)&&d<burrDist){burr=e;burrDist=d;}}
      else if(d<=this.hitPx(e)&&d/this.hitPx(e)<treatScore){treat=e;treatScore=d/this.hitPx(e);}
    }
    const target=treat||burr;if(!target)return 0;this._pop(target,stroke);return 1;
  }
  // Keyboard and assistive tech: a marker that moves with the arrow keys and pops on Space.
  move(dx=0,dy=0){
    const x=Math.sign(Number(dx)||0),y=Math.sign(Number(dy)||0);if(this.mode!=='running'&&(x||y))return false;
    this._nudge.x=x;this._nudge.y=y;if(x||y)this.keyboard=true;return true;
  }
  step(dx=0,dy=0){
    if(this.mode!=='running')return false;this.keyboard=true;
    this.reticle.x=clamp(this.reticle.x+Math.sign(Number(dx)||0)*.14,.04,.96);this.reticle.y=clamp(this.reticle.y+Math.sign(Number(dy)||0)*.1,.08,1);return true;
  }
  interact(){
    if(this.mode!=='running')return false;this.keyboard=true;
    return this._tapAt({id:'marker',count:0,lastPop:-9,pts:[]},this.reticle.x,this.reticle.y)>0;
  }
  pause(){if(this.mode!=='running')return;this.mode='paused';this._nudge.x=this._nudge.y=0;this._strokes.clear();this.trails.length=0;this.emit('pause');}
  resume(){if(this.mode!=='paused')return;this.mode='running';this.emit('resume');}

  // --- powers ----------------------------------------------------------------
  // Griffin barks every bubble on screen at once (and has his 1.5x layer while it lasts), Pumpkin summons
  // golden bubbles, Mittens pounces on a column and slows the sky, and Spike's shell makes burrs harmless.
  power(){
    if(this.mode!=='running'||this.charge<100||this.powerTime>0)return false;
    this.charge=0;this.powersUsed++;this.powerDuration=({griffin:4.6,kevin:5.2,mittens:3.9,spike:5})[this.characterId];this.powerTime=this.powerDuration;
    this._recordMultiplier();this.emit('power',{characterId:this.characterId,duration:this.powerDuration,totalMultiplier:this.totalMultiplier});this._trackStack();
    if(this.characterId==='griffin')this._bark();
    else if(this.characterId==='kevin')this._summon();
    else if(this.characterId==='mittens')this._pounce();
    return true;
  }
  _gainCharge(amount){
    const before=this.charge;this.charge=Math.min(this.powerTime>0?90:100,this.charge+amount*(1+this.gear.charge*.12));
    if(before<100&&this.charge>=100)this.emit('charged');
  }
  _bark(){
    const list=this.entities.filter(e=>this._live(e)).sort((a,b)=>a.y-b.y||a.id-b.id);
    this.emit('bark',{count:list.length,x:.5,y:.6});
    for(const e of list)if(this._live(e))e.kind==='burr'?this._clear(e):this._treat(e,null,true);
  }
  _summon(){
    const r=this._extra,count=SUMMON_COUNT;this.summoned+=count;
    for(let i=0;i<count;i++){
      const x=clamp((i+.5)/count+(r()-.5)*.08,.08,.92),y=1.06+i%2*.07,e=this._bonusBubble({kind:'gold',x,y,r:.07,vy:.17+r()*.02,vx:(r()-.5)*.02,summoned:true});
      this.extraLog.push({id:e.id,kind:'gold',x:+x.toFixed(3),at:+this.time.toFixed(3)});
    }
    this.emit('summon',{count,x:.5,y:.9});
  }
  _pounce(){
    const col=this._lastPopAt>this.time-3?this._lastX:.5,list=this.entities.filter(e=>this._live(e)&&Math.abs(e.x-col)<=.2).sort((a,b)=>a.y-b.y||a.id-b.id);
    this.emit('pounce',{x:col,count:list.length});
    // The panther's prize: the three highest treats she lands on turn golden, which also starts a Gold Rush.
    for(const prize of list.filter(e=>e.kind==='bone').slice(0,PRIZES))prize.kind='gold';
    for(const e of list)if(this._live(e))e.kind==='burr'?this._clear(e):this._treat(e,null,true);
  }

  // --- the sky -----------------------------------------------------------------
  // One bubble of the base schedule. Eight draws, always in this order, whatever the world and whatever happens.
  _spawn(){
    const r=this._random,a=r(),b=r(),c=r(),d=r(),e=r(),f=r(),g=r(),h=r(),t=this.time,progress=t/LIMIT,n=this._spawned++;
    let kind='bone';if(a<.075&&t>1.2)kind='gold';else if(a>.87&&t>2.4)kind='burr';
    let x=.1+b*.8,vx=(e-.5)*.05;
    if(this.twist==='columns'){x=BUBBLE_COLUMNS[Math.min(4,Math.floor(b*5))];vx=0;}
    const size=kind==='gold'?.07:kind==='burr'?.062:.055+c*.03,vy=(.15+d*.07)*(1+.35*progress)*(this.assist?.84:1);
    const entity={id:++this._sequence,kind,x,baseX:x,y:1.08,r:size,vy,vx,phase:f*Math.PI*2,age:0,variant:Math.floor(a*1e4)%2,splits:g<.35&&kind==='bone',bloom:h>.88&&kind==='bone',popped:false,gone:false,bonus:false};
    this.entities.push(entity);
    this.spawnLog.push({id:entity.id,n,at:+t.toFixed(4),kind,x:+x.toFixed(4),r:+size.toFixed(4),vy:+vy.toFixed(4),vx:+vx.toFixed(4),phase:+entity.phase.toFixed(4)});
    this._nextSpawn+=(.7-.36*progress)*(.85+.3*((a*977+b*131)%1));
  }
  // A last golden goodbye, timed to stay on screen until the whistle.
  _spawnFinale(){
    this._finale=true;
    [.28,.5,.72].forEach((x,i)=>{
      const e={id:++this._sequence,kind:'gold',x,baseX:x,y:1.08+i*.1,r:.074,vy:.1,vx:0,phase:i*2,age:0,variant:0,splits:false,bloom:false,popped:false,gone:false,bonus:false,finale:true};
      this.entities.push(e);this.spawnLog.push({id:e.id,n:-1,at:+this.time.toFixed(4),kind:'gold',x,r:e.r,vy:e.vy,vx:0,phase:e.phase,finale:true});
    });
    this.emit('finale',{x:.5});
  }
  // Bubbles that exist because of something the player did. They are a gift: letting one go costs nothing.
  _bonusBubble({kind='bone',x,y,r,vy,vx=0,summoned=false}){
    const e={id:BONUS_ID+ ++this._bonusSequence,kind,x,baseX:x,y,r,vy,vx,phase:this._extra()*Math.PI*2,age:0,variant:0,splits:false,bloom:false,popped:false,gone:false,bonus:true,summoned};
    this.entities.push(e);return e;
  }
  _arc(){
    const beats=BUBBLE_TIMING.countdown;
    while(this._countStep<beats.length&&this.time>=beats[this._countStep]){this.emit('countdown',{count:3-this._countStep});this._countStep++;}
    while(this._lastTick>1&&this.time>=LIMIT-(this._lastTick-1)){
      this._lastTick--;if(this._lastTick===10)this.emit('final-push',{remaining:10});
      this.emit('tick',{remaining:this._lastTick});
    }
  }
  // The next moment the seeded schedule has something to do, so steps land on it exactly at any frame rate.
  _due(){
    const t=this.time;let due=Infinity;
    if(this._nextSpawn<SPAWN_END&&this._nextSpawn>t)due=this._nextSpawn;
    if(!this._finale&&FINALE_AT>t&&FINALE_AT<due)due=FINALE_AT;
    return due;
  }
  update(dt){
    if(this.mode!=='running')return;let remaining=clamp(dt,0,.1);
    while(remaining>1e-8&&this.mode==='running'){
      const left=this.timeLimit-this.time;
      if(left<=1e-8){this.time=this.timeLimit;this._finish(true);break;}
      const due=this._due(),gap=due-this.time,step=Math.min(1/120,remaining,left,gap);remaining-=step;
      this._step(step,step===gap?due:undefined);
    }
  }
  _step(dt,land){
    this.time=land===undefined?this.time+dt:land;
    const fever=this.feverTime>0,rush=this.goldRushTime>0,power=this.powerTime>0;
    for(const key of ['powerTime','feverTime','goldRushTime','_feverCooldown','comboTime'])this[key]=Math.max(0,this[key]-dt);
    if(fever&&!this.feverTime)this.emit('fever-end');
    if(rush&&!this.goldRushTime)this.emit('gold-rush-end');
    if(power&&!this.powerTime)this.emit('power-end',{characterId:this.characterId});
    if(!this.comboTime&&this.combo)this._breakCombo('timeout');this._gainCharge(dt*1.4);if(this.mode!=='running')return;
    if(this._nudge.x||this._nudge.y){
      const {w,h}=this.field,speed=380;this.reticle.x=clamp(this.reticle.x+this._nudge.x*speed*dt/w,.04,.96);this.reticle.y=clamp(this.reticle.y+this._nudge.y*speed*dt/h,.08,1);
    }
    this.wind=this.twist==='breeze'&&!this.reducedMotion?Math.sin(this.time*.5+this._windPhase):0;
    this._arc();if(this.mode!=='running')return;
    while(this.time>=this._nextSpawn&&this._nextSpawn<SPAWN_END)this._spawn();
    if(!this._finale&&this.time>=FINALE_AT)this._spawnFinale();
    const slow=power&&this.characterId==='mittens'?.55:1,twist=this.twist,rm=this.reducedMotion,lo=this._xMin,hi=this._xMax;let born=null;
    for(const e of this.entities){
      if(e.popped||e.gone)continue;
      e.age+=dt;e.y-=e.vy*slow*dt;e.baseX+=e.vx*dt+(twist==='breeze'&&!rm?this.wind*.03*dt:0);
      if(e.baseX<lo){e.baseX=lo;e.vx=Math.abs(e.vx);}else if(e.baseX>hi){e.baseX=hi;e.vx=-Math.abs(e.vx);}
      e.x=e.baseX+(twist==='wobble'&&!rm?Math.sin(e.age*2.6+e.phase)*.035:0);
      if(e.x<lo)e.x=lo;else if(e.x>hi)e.x=hi;
      if(twist==='glow'&&e.splits&&e.y<=.55){e.splits=false;e.gone=true;this._split(e,born||(born=[]));continue;}
      if(e.y<=ESCAPE_Y){e.gone=true;this.escaped++;this.emit('escape',{kind:e.kind,x:e.x,y:e.y});}
    }
    if(born)this.entities.push(...born);
    // Compact in place: no new arrays per step.
    let k=0;const list=this.entities;for(let i=0;i<list.length;i++){const e=list[i];if(!e.popped&&!e.gone)list[k++]=e;}list.length=k;
    k=0;const trails=this.trails;for(let i=0;i<trails.length;i++){const s=trails[i];while(s.pts.length&&this.time-s.pts[0].t>.45)s.pts.shift();if(s.pts.length>0||this._strokes.has(s.id))trails[k++]=s;}trails.length=k;
    this._trackStack();
    const section=Math.min(2,Math.floor(this.time/15));if(section!==this.sections){this.sections=section;this.emit('section',{section,index:section,stage:0});}
    if(this.time>=this.timeLimit-1e-8){this.time=this.timeLimit;this._finish(true);}
  }
  // Starlight Mesa: a glowing bubble splits in two as it climbs. The children come from the player stream,
  // because whether a split happens at all depends on whether the bubble was popped first.
  _split(e,born){
    const r=this._extra;this.splits++;
    for(const side of [-1,1]){
      const child={id:BONUS_ID+ ++this._bonusSequence,kind:'bone',x:e.x,baseX:e.baseX,y:e.y,r:e.r*.74,vy:e.vy*(.92+r()*.16),vx:side*(.05+r()*.02),phase:r()*Math.PI*2,age:0,variant:e.variant,splits:false,bloom:false,popped:false,gone:false,bonus:true};
      born.push(child);this.extraLog.push({id:child.id,kind:'split',x:+e.x.toFixed(3),at:+this.time.toFixed(3)});
    }
    this.emit('split',{x:e.x,y:e.y});
  }
  // Boerne Hills: a bluebonnet bubble bursts into small bonus bubbles.
  _bloom(e){
    const r=this._extra,count=2;this.bloomed++;
    // The little ones fan out and rise at different speeds, so they never start as one stack.
    for(let i=0;i<count;i++){
      const k=i-(count-1)/2,child=this._bonusBubble({kind:'bone',x:clamp(e.x+k*.16,this._xMin,this._xMax),y:e.y,r:e.r*.62,vy:e.vy*(.66+i*.22+r()*.05),vx:k*.05});
      child.variant=1;this.extraLog.push({id:child.id,kind:'bloom',x:+e.x.toFixed(3),at:+this.time.toFixed(3)});
    }
    this.emit('bloom',{x:e.x,y:e.y,count});
  }

  // --- popping -------------------------------------------------------------------
  _pop(e,stroke){e.kind==='burr'?this._burr(e,stroke):this._treat(e,stroke,false);}
  _treat(e,stroke,mass){
    e.popped=true;const gold=e.kind==='gold';
    this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.comboTime=CHAIN_TIME;this.multiplier=Math.min(5,1+Math.floor(this.combo/6));
    this.treats+=gold?3:1;if(gold)this.gold++;this.popped++;this._lastX=e.x;this._lastPopAt=this.time;
    this._gainCharge(gold?14:4);
    if(this.combo%6===0)this.emit('combo',{combo:this.combo,multiplier:this.multiplier});
    if(this.combo>=18&&this._feverCooldown===0){this.feverTime=8;this._feverCooldown=20;this.emit('fever',{duration:8});}
    if(gold){this.goldRushTime=Math.min(12,this.goldRushTime+4);this.emit('gold-rush',{duration:this.goldRushTime,totalMultiplier:this.totalMultiplier});}
    this._recordMultiplier();
    const value=Math.round((gold?(e.summoned?SUMMON_BASE:100):10)*this.totalMultiplier);this.score+=value;
    this.emit('collect',{kind:gold?'gold':'bone',value,x:e.x,y:e.y,r:e.r,combo:this.combo,multiplier:this.multiplier,totalMultiplier:this.totalMultiplier,bonus:e.bonus,variant:e.variant,mass:Boolean(mass),summoned:Boolean(e.summoned),finale:Boolean(e.finale)});
    // A string: the third bubble of one drag and every one after it adds a small flat bonus. It is added to the
    // score as it is, so no layer of the stack can multiply it.
    if(stroke&&!mass){
      stroke.count=this.time-stroke.lastPop<=STRING_GAP?stroke.count+1:1;stroke.lastPop=this.time;
      if(stroke.count>=3){
        const bonus=stringBonus(stroke.count);this.score+=bonus;this.stringBonus+=bonus;
        if(stroke.count===3)this.strings++;this.bestString=Math.max(this.bestString,stroke.count);
        this.emit('string',{count:stroke.count,bonus,x:e.x,y:e.y});
      }
    }
    if(this.twist==='bloom'&&e.bloom&&!mass)this._bloom(e);
    this._trackStack();
  }
  _burr(e,stroke){
    e.popped=true;this.burrs++;
    // Spike's shell: burrs bounce off, and he rolls over them. A smashed burr is worth a golden treat's points at the
    // current stack and keeps the chain alive. It is a treat-sized reward, so it never adds a layer of its own.
    if(this._shell){
      this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);this.comboTime=CHAIN_TIME;this.multiplier=Math.min(5,1+Math.floor(this.combo/6));this.smashed++;
      if(this.combo%6===0)this.emit('combo',{combo:this.combo,multiplier:this.multiplier});
      this._recordMultiplier();const value=Math.round(SMASH_BASE*this.totalMultiplier);this.score+=value;this.emit('smash',{kind:'burr',value,x:e.x,y:e.y});this._trackStack();return;
    }
    this.hits++;if(stroke)stroke.count=0;
    this.emit('burr',{x:e.x,y:e.y,combo:this.combo});this._breakCombo('burr');
  }
  // A burr cleared by a power (a bark, a pounce) is harmless and never touches the chain.
  _clear(e){e.popped=true;this.score+=25;this.emit('smash',{kind:'burr',value:25,x:e.x,y:e.y});}
  _breakCombo(reason=''){
    const combo=this.combo,multiplier=this.multiplier;this.combo=0;this.multiplier=1;this.comboTime=0;
    if(combo>0){if(multiplier>1)this.chainsLost++;this.emit('chain-lost',{combo,multiplier,reason,x:.5,y:1});}
  }
  _finish(won){
    if(this.mode!=='running'||this.finished)return;this.finished=true;this.mode=won?'won':'lost';this._strokes.clear();
    if(won&&this.hits===0&&this.popped>=CLEAN_MIN)this.score+=150;this.emit(won?'won':'lost',{result:this.result()});
  }
  result(){
    return {runId:this.runId,mode:'bubble',state:this.mode,stage:0,regionId:this.regionId,characterId:this.characterId,won:this.mode==='won',score:Math.round(this.score),treats:this.treats,distance:0,time:Number(this.time.toFixed(3)),hits:this.hits,dodged:0,nearMisses:0,bestCombo:this.bestCombo,bestMultiplier:this.bestMultiplier,gold:this.gold,letters:0,letterMask:0,powersUsed:this.powersUsed,hearts:0,maxHearts:0,seed:this.seed,assist:this.assist,gear:{...this.gear},dailyDate:'',missed:0,springs:0,slides:0,doubleJumps:0,popped:this.popped,escaped:this.escaped,burrs:this.burrs,strings:this.strings,bestString:this.bestString,stringBonus:this.stringBonus,blooms:this.bloomed,splits:this.splits};
  }
}
