// Doodle Onward · campfire pairs. All reveal and match timing belongs to update().
const PICTURES = [
  ['paw','🐾','Paw prints'],['bone','🦴','Treat bone'],['tree','🌲','Pine tree'],
  ['camp','🏕️','Campsite'],['star','⭐','Golden star'],['flower','🌻','Sunflower'],
  ['rv','🚐','Family RV'],['apple','🍎','Apple'],['fish','🐟','River fish'],
  ['heart','🧡','Big heart'],['moon','🌙','Crescent moon'],['butterfly','🦋','Butterfly']
];
let sequence = 0;
const clamp = (n,a,b) => Math.max(a,Math.min(b,Number.isFinite(Number(n))?Number(n):a));
const clone = value => JSON.parse(JSON.stringify(value));
function seeded(seed) { let state=Number(seed)>>>0;return()=>{state=(state+0x6d2b79f5)>>>0;let n=Math.imul(state^state>>>15,state|1);n^=n+Math.imul(n^n>>>7,n|61);return((n^n>>>14)>>>0)/4294967296;}; }
function shuffle(array,random) { for(let i=array.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[array[i],array[j]]=[array[j],array[i]];}return array; }

export class MemoryGame {
  constructor(container, { onEvent = () => {}, onFinish = () => {} } = {}) {
    this.container=container;this.onEvent=onEvent;this.onFinish=onFinish;this._destroyed=false;this._quiet=true;
    this._click=event=>{
      const card=event.target?.closest?.('[data-memory-card]');
      if(card&&this.container?.contains(card))this.flip(Number(card.dataset.memoryCard));
      else if(event.target?.closest?.('[data-memory-peek]'))this.peek();
    };
    this._key=event=>this._navigate(event);
    this.container?.addEventListener('click',this._click);this.container?.addEventListener('keydown',this._key);
    this.container?.classList.add('memory-game-host');
    this.reset();this.mode='ready';this._quiet=false;this._sync();
  }
  emit(type,detail={}) { if(!this._quiet)this.onEvent({...detail,type}); }
  reset({worldIndex=0,characterId='griffin',seed=1,gear={},assist=false,charms={},dailyDate=''}={}) {
    if(this._destroyed)return this;
    this.worldIndex=Math.round(clamp(worldIndex,0,4));this.stage=this.worldIndex;
    this.characterId=['griffin','kevin','mittens','spike'].includes(characterId)?characterId:'griffin';
    this.seed=Number(seed)>>>0;this.dailyDate=String(dailyDate||'');this.assist=Boolean(assist&&!this.dailyDate);
    this.gear={magnet:0,charge:0,heart:0};for(const key of Object.keys(this.gear))this.gear[key]=this.dailyDate?0:Math.round(clamp(gear?.[key]||0,0,key==='heart'?2:3));
    this.charms=this.dailyDate?{}:clone(charms&&typeof charms==='object'?charms:{});
    this.runId=`memory-${Date.now().toString(36)}-${++sequence}`;this.runMode='memory';this.mode='running';
    this.totalPairs=[6,8,8,10,10][this.worldIndex];this.pairs=0;this.mistakes=0;this.perfects=0;
    this.score=0;this.treats=0;this.gold=0;this.flips=0;this.combo=0;this.bestCombo=0;this.multiplier=1;this.totalMultiplier=1;this.bestMultiplier=1;
    this.time=0;this.timeLimit=this.assist?150:90;this.hearts=1;this.maxHearts=1;
    this.hints=1+this.gear.charge+(this.assist?1:0);this.hintsUsed=0;
    this.previewTime=this.assist?2.8:1.8;this._resolveTime=0;this._selected=[];this._missedKeys=new Set();this._summary=null;this._focusIndex=0;this._lastSecond=-1;this._warning=false;
    const random=seeded(this.seed),chosen=shuffle([...PICTURES],random).slice(0,this.totalPairs);
    this.cards=shuffle(chosen.flatMap(([key,symbol,label])=>[0,1].map(()=>({key,symbol,label,matched:false,faceUp:false}))),random).map((card,index)=>({...card,id:index}));
    this.message='Take a little peek. Remember a few friendly faces!';
    this._build();this._sync();this.emit('start',{runId:this.runId,mode:'memory',worldIndex:this.worldIndex});return this;
  }
  flip(index) {
    if(this.mode!=='running'||this._destroyed||this.previewTime>0||this._resolveTime>0||!Number.isInteger(index))return false;
    const card=this.cards[index];if(!card||card.matched||card.faceUp||this._selected.length>=2)return false;
    card.faceUp=true;this._selected.push(index);this.flips++;this._focusIndex=index;
    this.message=this._selected.length===1?`${card.label}. Find its friend.`:'Two cards. Let’s see…';
    this.emit('flip',{index,first:this._selected.length===1});
    if(this._selected.length===2)this._resolveTime=this.cards[this._selected[0]].key===card.key ? .36 : (this.assist?1:.78);
    this._sync();return true;
  }
  peek() {
    if(this.mode!=='running'||this.previewTime>0||this._resolveTime>0||this._selected.length||this.hints<=0)return false;
    this.hints--;this.hintsUsed++;this.previewTime=this.assist?2:1.3;
    this.message='One helpful peek. You’ve got this!';this.emit('hint',{remaining:this.hints});this._sync();return true;
  }
  pause() { if(this.mode==='running'){this.mode='paused';this.emit('pause');this._sync();} }
  resume() { if(this.mode==='paused'){this.mode='running';this.emit('resume');this._sync();} }
  update(dt) {
    if(this.mode!=='running'||this._destroyed)return;
    dt=clamp(dt||0,0,1);this.time=Math.min(this.timeLimit,this.time+dt);
    if(this.previewTime>0){this.previewTime=Math.max(0,this.previewTime-dt);if(!this.previewTime){this.message='Pick two cards. Matching friends build your streak.';this._sync();}}
    else if(this._resolveTime>0){this._resolveTime=Math.max(0,this._resolveTime-dt);if(!this._resolveTime)this._resolve();}
    if(this.mode!=='running')return;
    if(!this._warning&&this.timeLimit-this.time<=10){this._warning=true;this.message='Ten seconds. One pair at a time!';this.emit('timer-warning',{remaining:10});this._sync();}
    if(this.time>=this.timeLimit)this._finish(false);
    else if(Math.ceil(this.timeLimit-this.time)!==this._lastSecond)this._syncClock();
  }
  _resolve() {
    if(this._selected.length!==2)return;
    const keepBoardFocus=Boolean(this.buttons?.includes(this.container?.ownerDocument.activeElement));
    const [a,b]=this._selected.map(index=>this.cards[index]);
    if(a.key===b.key){
      a.matched=b.matched=true;this.pairs++;this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo);
      this.multiplier=Math.min(5,1+Math.floor((this.combo-1)/2));this.totalMultiplier=this.multiplier;this.bestMultiplier=Math.max(this.bestMultiplier,this.multiplier);
      const perfect=!this._missedKeys.has(a.key);if(perfect)this.perfects++;
      const value=60*this.multiplier;this.score+=value;this.treats+=perfect?3:2;
      this.message=this.combo>1?`${this.combo} pairs in a row! ${this.multiplier}× memory bonus.`:`${a.label} matched! A perfect little pair.`;
      this.emit('match',{pair:a.key,pairs:this.pairs,totalPairs:this.totalPairs,perfect,value,combo:this.combo,multiplier:this.multiplier});
      this.emit('collect',{kind:'pair',value,combo:this.combo,multiplier:this.multiplier,totalMultiplier:this.totalMultiplier});
      if(this.combo>1)this.emit('combo',{combo:this.combo,multiplier:this.multiplier,totalMultiplier:this.totalMultiplier});
    }else{
      a.faceUp=b.faceUp=false;this._missedKeys.add(a.key);this._missedKeys.add(b.key);
      this.mistakes++;this.combo=0;this.multiplier=this.totalMultiplier=1;
      this.message='Different friends. Now you know where they live.';this.emit('mismatch',{mistakes:this.mistakes});
    }
    this._selected=[];this._sync();
    if(a.matched)this._focusNext(keepBoardFocus);
    if(this.pairs===this.totalPairs)this._finish(true);
  }
  _finish(won) {
    if(this.mode!=='running'||this._summary)return;
    this.mode=won?'won':'lost';this.previewTime=0;this._resolveTime=0;
    if(won)this.score+=Math.ceil(this.timeLimit-this.time)*3+this.perfects*10;
    else this.hearts=0;
    this.message=won?'All together! A happy little campfire crew.':'The campfire is still warm. Try those pairs again.';
    this._summary=this._snapshot();this._sync();const summary=this.result();
    this.emit(this.mode,{result:summary});if(!this._quiet)this.onFinish(this.result());
  }
  _snapshot() { return {runId:this.runId,mode:'memory',state:this.mode,won:this.mode==='won',worldIndex:this.worldIndex,stage:this.worldIndex,characterId:this.characterId,seed:this.seed,dailyDate:this.dailyDate,assist:this.assist,gear:{...this.gear},charms:clone(this.charms),score:this.score,treats:this.treats,gold:0,pairs:this.pairs,totalPairs:this.totalPairs,mistakes:this.mistakes,perfects:this.perfects,flips:this.flips,hintsUsed:this.hintsUsed,bestCombo:this.bestCombo,bestMultiplier:this.bestMultiplier,time:Number(this.time.toFixed(3)),timeLimit:this.timeLimit,distance:0,hits:0,dodged:0,hearts:this.hearts,maxHearts:1}; }
  result() { return clone(this._summary||this._snapshot()); }
  focus() { this.buttons?.find(button=>!button.disabled)?.focus({preventScroll:true}); }
  _build() {
    if(!this.container)return;
    const doc=this.container.ownerDocument,make=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text)node.textContent=text;return node;};
    const section=make('section','memory-mini');section.setAttribute('aria-label','Camp Pairs memory game');
    const header=make('header','memory-mini__header');const intro=make('div');intro.append(make('h2','','Camp Pairs'),make('p','','Find friendly pairs. Keep your streak.'));
    const hint=make('button','memory-mini__peek');hint.type='button';hint.dataset.memoryPeek='true';hint.setAttribute('aria-label','Peek at all unmatched cards');header.append(intro,hint);this.hintButton=hint;
    const stats=make('div','memory-mini__stats');this.pairLabel=make('strong');this.timerLabel=make('span');this.streakLabel=make('span');stats.append(this.pairLabel,this.timerLabel,this.streakLabel);
    this.grid=make('div','memory-mini__grid');this.grid.dataset.pairs=String(this.totalPairs);this.grid.style.setProperty('--memory-cols',this.totalPairs===10?'5':'4');this.grid.setAttribute('role','group');this.grid.setAttribute('aria-label',`${this.totalPairs} matching pairs. Use arrow keys to move between cards.`);
    this.buttons=this.cards.map((card,index)=>{
      const button=make('button','memory-mini__card');button.type='button';button.dataset.memoryCard=String(index);
      const back=make('span','memory-mini__back','✦');back.setAttribute('aria-hidden','true');
      const face=make('span','memory-mini__face',card.symbol);face.setAttribute('aria-hidden','true');
      const check=make('span','memory-mini__check','✓');check.setAttribute('aria-hidden','true');
      button.append(back,face,check);this.grid.append(button);return button;
    });
    this.status=make('p','memory-mini__status');this.status.setAttribute('role','status');this.status.setAttribute('aria-live','polite');this.status.setAttribute('aria-atomic','true');
    section.append(header,stats,this.grid,this.status);this.container.replaceChildren(section);
  }
  _syncClock() { this._lastSecond=Math.ceil(this.timeLimit-this.time);if(this.timerLabel){this.timerLabel.textContent=`${Math.floor(this._lastSecond/60)}:${String(this._lastSecond%60).padStart(2,'0')} left`;this.timerLabel.classList.toggle('is-urgent',this._lastSecond<=10);} }
  _sync() {
    if(!this.container||!this.buttons)return;
    if(this.cards[this._focusIndex]?.matched)this._focusIndex=this.cards.findIndex(card=>!card.matched);
    for(let i=0;i<this.cards.length;i++){
      const card=this.cards[i],button=this.buttons[i],visible=card.faceUp||card.matched||this.previewTime>0;
      button.classList.toggle('is-up',visible);button.classList.toggle('is-matched',card.matched);
      // Temporarily busy cards stay focusable; aria-disabled blocks repeated input
      // without throwing keyboard focus out of the board during a reveal.
      button.disabled=card.matched;button.setAttribute('aria-disabled',String(this.mode!=='running'||this.previewTime>0||this._resolveTime>0||card.matched));
      button.tabIndex=i===this._focusIndex?0:-1;button.setAttribute('aria-pressed',String(visible));
      button.setAttribute('aria-label',card.matched?`Matched ${card.label}`:visible?`Card ${i+1}: ${card.label}`:`Card ${i+1}, face down`);
    }
    this.hintButton.textContent=`Peek · ${this.hints}`;this.hintButton.disabled=this.mode!=='running'||!this.hints||this.previewTime>0||this._resolveTime>0||Boolean(this._selected.length);
    this.pairLabel.textContent=`${this.pairs} / ${this.totalPairs} pairs`;this.streakLabel.textContent=this.combo?`${this.combo} streak · ${this.multiplier}×`:'A fresh start';
    if(this.status.textContent!==this.message)this.status.textContent=this.message;
    this._syncClock();
  }
  _focusNext(keepBoardFocus=false) {
    if(!this.container||!this.buttons)return;
    const active=this.container.ownerDocument.activeElement;
    if(!keepBoardFocus&&!this.buttons.includes(active))return;
    this.buttons.find(button=>!button.disabled)?.focus({preventScroll:true});
  }
  _navigate(event) {
    const target=event.target?.closest?.('[data-memory-card]');if(!target||!this.container.contains(target))return;
    const index=Number(target.dataset.memoryCard),computed=globalThis.getComputedStyle?.(this.grid).gridTemplateColumns;
    const columns=computed?.split(/\s+/).length||Number(this.grid.style.getPropertyValue('--memory-cols'))||4;
    const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns}[event.key];
    if(delta===undefined&&event.key!=='Home'&&event.key!=='End')return;
    event.preventDefault();let next=event.key==='Home'?0:event.key==='End'?this.cards.length-1:(index+delta+this.cards.length)%this.cards.length;
    const direction=delta<0||event.key==='End'?-1:1;
    for(let tries=0;tries<this.cards.length&&this.cards[next].matched;tries++)next=(next+direction+this.cards.length)%this.cards.length;
    if(!this.cards[next].matched){this._focusIndex=next;this._sync();this.buttons[next].focus({preventScroll:true});}
  }
  destroy() {
    if(this._destroyed)return;this._destroyed=true;this.mode='destroyed';
    this.container?.removeEventListener('click',this._click);this.container?.removeEventListener('keydown',this._key);
    this.container?.classList.remove('memory-game-host');this.container?.replaceChildren();this.buttons=null;this.grid=null;
  }
}
