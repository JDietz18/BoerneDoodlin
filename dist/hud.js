// In-run heads-up display. The structure for a run is built once, then each
// frame only touches nodes whose values changed, so CSS animations on them are
// never restarted. Reads engine state; never changes it.

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const num=n=>Math.round(Number(n)||0).toLocaleString();
const icon=(name,cls='')=>`<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
export const STACK_TIERS=[2,5,10,20,30];
export const tierOf=total=>{let tier=0;for(const t of STACK_TIERS)if(total>=t)tier=t;return tier;};

// Pure description of the bonus stack, shared by the HUD and its tests.
export function stackLayers(run,characterId='griffin'){
  const chain=run.multiplier||1,combo=run.combo||0,frenzy=run.feverTime>0,gold=run.goldRushTime>0,power=run.powerTime>0,griffin=characterId==='griffin';
  return {
    total:Number((run.totalMultiplier||chain).toFixed(1)),
    chain:{on:chain>1,value:chain,fill:combo>0?clamp((run.comboTime||0)/5.4,0,1):0,next:chain>=5?1:clamp((combo%6)/6,0,1)},
    frenzy:{on:frenzy,value:2,fill:frenzy?clamp(run.feverTime/8,0,1):clamp(combo/18,0,1)},
    gold:{on:gold,value:2,fill:gold?clamp(run.goldRushTime/12,0,1):0},
    power:{on:power,value:griffin?1.5:1,counts:griffin,fill:power?clamp(run.powerTime/(run.powerDuration||5),0,1):clamp((run.charge||0)/100,0,1)}
  };
}

export class Hud {
  constructor(get){
    this.el={region:get('run-region'),hearts:get('hearts'),score:get('score'),combo:get('combo'),objectives:get('run-objectives'),stack:get('bonus-stack'),timer:get('run-timer'),progress:get('progress-fill'),progressText:get('progress-text'),tip:get('mode-tip')};
    this.mode='';this.shown=0;this.cache={};
  }
  set(key,node,value,apply){if(this.cache[key]===value)return false;this.cache[key]=value;apply(node,value);return true;}
  text(key,node,value){return this.set(key,node,String(value),(n,v)=>{n.textContent=v;});}
  pop(node,name='bump'){if(!node?.animate||this.reduced)return;node.classList.remove(name);void node.offsetWidth;node.classList.add(name);}

  // Called once when a run starts.
  begin({mode,region,powerName,characterId,tip,requiredKeys=2,maxHearts=3}){
    const e=this.el;this.mode=mode;this.characterId=characterId;this.cache={};this.shown=0;this.lastTotal=1;this.lastScore=0;this.lastHearts=null;this.lastSecond=null;
    e.region.textContent=region;e.tip.textContent=tip||'';e.score.textContent='0';
    e.hearts.innerHTML=Array.from({length:maxHearts},()=>icon('heart')).join('');this.heartNodes=[...e.hearts.children];
    const slot=(cls,name,count)=>`<span class="obj ${cls}">${Array.from({length:count},()=>icon(name)).join('')}</span>`;
    const stat=(id,label)=>`<span class="obj stat" id="obj-${id}"><b>0</b><i>${label}</i></span>`;
    e.objectives.innerHTML=mode==='platform'?slot('keys','key',requiredKeys)+slot('golds','star',3)+'<span class="obj secrets" hidden><b>0</b><i>secret</i></span>'
      :mode==='scout'?slot('golds','star',3)+slot('keys','key',1)+'<span class="obj parcel"><i>Find the parcel</i></span>'
      :mode==='memory'?stat('pairs','pairs')+stat('misses','misses')
      :stat('treats','treats')+(mode==='rally'?stat('distance','m'):stat('gold','golden'));
    this.obj={keys:[...e.objectives.querySelectorAll('.keys svg')],golds:[...e.objectives.querySelectorAll('.golds svg')],secrets:e.objectives.querySelector('.secrets'),parcel:e.objectives.querySelector('.parcel i')};
    for(const id of ['pairs','misses','treats','distance','gold'])this.obj[id]=e.objectives.querySelector(`#obj-${id} b`);
    const timed=mode==='snack'||mode==='rally';e.timer.hidden=!timed;e.timer.classList.remove('urgent','final');
    const stacked=mode!=='memory';e.stack.hidden=!stacked;
    if(stacked){
      const layer=(id,label,value)=>`<span class="layer ${id}" data-layer="${id}"><i></i><em>${label}</em><b>${value}</b></span>`;
      e.stack.innerHTML=`<strong class="stack-total"><b>1</b>×</strong><div class="stack-layers">${layer('chain','CHAIN','×1')}${layer('frenzy','FRENZY','×2')}${layer('gold','GOLD','×2')}${layer('power',characterId==='griffin'?'ZOOMIES':String(powerName||'POWER').split(' ')[0].toUpperCase(),characterId==='griffin'?'×1.5':'')}</div>`;
      this.stackNodes={total:e.stack.querySelector('.stack-total'),totalText:e.stack.querySelector('.stack-total b')};
      for(const id of ['chain','frenzy','gold','power']){const node=e.stack.querySelector(`[data-layer=${id}]`);this.stackNodes[id]={node,value:node.querySelector('b')};}
    }
  }

  // Called every frame while a run is on screen. dt is real seconds.
  update(run,dt,{reduced=false}={}){
    const e=this.el,m=this.mode;this.reduced=reduced;if(!run||!m)return;
    // Score rolls up to its real value.
    const target=Math.round(run.score||0);
    if(this.shown!==target){const diff=target-this.shown;this.shown=Math.abs(diff)<2||reduced?target:this.shown+diff*Math.min(1,dt*12);if(this.text('score',e.score,num(this.shown))&&target-this.lastScore>=100){this.pop(e.score);}this.lastScore=target;}
    // Hearts.
    if(Number.isFinite(run.hearts)){
      if(this.heartNodes.length!==(run.maxHearts||3)){e.hearts.innerHTML=Array.from({length:run.maxHearts||3},()=>icon('heart')).join('');this.heartNodes=[...e.hearts.children];this.lastHearts=null;}
      if(this.lastHearts!==run.hearts){this.heartNodes.forEach((node,i)=>{const empty=i>=run.hearts;if(empty&&!node.classList.contains('empty')&&this.lastHearts!==null)this.pop(node,'lost');node.classList.toggle('empty',empty);});e.hearts.setAttribute('aria-label',`${run.hearts} of ${run.maxHearts} hearts`);e.hearts.classList.toggle('danger',run.hearts===1&&run.maxHearts>1);this.lastHearts=run.hearts;}
    }else if(this.lastHearts!=='none'){e.hearts.innerHTML='';e.hearts.setAttribute('aria-label','');this.heartNodes=[];this.lastHearts='none';}
    // Objectives and progress.
    let progress=0;const fillSlots=(key,nodes,count)=>this.set(key,nodes,count,(list,n)=>list.forEach((node,i)=>{const on=i<n;if(on&&!node.classList.contains('on'))this.pop(node);node.classList.toggle('on',on);}));
    if(m==='platform'){
      progress=run.farthest/(run.width-175);fillSlots('keys',this.obj.keys,run.keys||0);fillSlots('golds',this.obj.golds,run.gold||0);
      this.set('secrets',this.obj.secrets,run.secrets||0,(node,n)=>{node.hidden=!n;node.querySelector('b').textContent=n;node.querySelector('i').textContent=n===1?'secret':'secrets';if(n)this.pop(node);});
    }else if(m==='scout'){
      const key=run.hasKey||run.keys?1:0;progress=((run.treasures||0)+key+(run.deliveryDone?1:0))/5;fillSlots('golds',this.obj.golds,run.treasures||0);fillSlots('keys',this.obj.keys,key);
      this.set('parcel',this.obj.parcel,run.deliveryDone?'Delivered!':run.parcel?'Deliver the parcel':'Find the parcel',(node,v)=>{node.textContent=v;node.parentElement.classList.toggle('on',v==='Delivered!');this.pop(node.parentElement);});
    }else if(m==='memory'){
      progress=(run.pairs||0)/(run.totalPairs||1);this.text('pairs',this.obj.pairs,`${run.pairs||0}/${run.totalPairs||0}`);this.text('misses',this.obj.misses,run.mistakes||0);
    }else{
      progress=run.time/(run.timeLimit||60);this.text('treats',this.obj.treats,num(run.treats));
      if(m==='rally')this.text('distance',this.obj.distance,num(run.distance));else this.text('gold',this.obj.gold,run.gold||0);
      const left=Math.max(0,Math.ceil((run.timeLimit||60)-run.time));
      if(this.text('timer',e.timer,left)){e.timer.classList.toggle('urgent',left<=10&&left>5);e.timer.classList.toggle('final',left<=5);if(left<=10)this.pop(e.timer,'tick');this.lastSecond=left;}
    }
    progress=clamp(progress||0,0,1);
    this.set('progress',e.progress,Math.round(progress*200),(node,v)=>{node.style.width=`${v/2}%`;});
    this.text('progressText',e.progressText,m==='memory'?`${run.pairs||0}/${run.totalPairs||0}`:`${Math.round(progress*100)}%`);
    // Bonus stack: every layer is always visible, lit or waiting.
    if(!e.stack.hidden){
      const s=stackLayers(run,this.characterId),n=this.stackNodes;
      if(this.text('total',n.totalText,s.total)){if(s.total>this.lastTotal)this.pop(n.total);this.lastTotal=s.total;}
      this.set('tier',e.stack,tierOf(s.total),(node,v)=>{node.dataset.tier=v;});
      for(const id of ['chain','frenzy','gold','power']){
        const layer=s[id],node=n[id].node;
        this.set(`${id}:on`,node,layer.on,(el,v)=>{el.classList.toggle('on',v);if(v)this.pop(el);});
        this.set(`${id}:fill`,node,Math.round(layer.fill*50),(el,v)=>{el.style.setProperty('--fill',v/50);});
      }
      this.text('chain:value',n.chain.value,`×${s.chain.value}`);
      this.set('chain:low',n.chain.node,s.chain.on&&s.chain.fill<.35,(el,v)=>el.classList.toggle('low',v));
    }
    // Screen reader friendly summary line (also the desktop combo label).
    this.text('combo',e.combo,run.combo>0?`${num(run.combo)} ${m==='memory'?'pair':'snack'} chain`:'');
  }
}

// Counts result numbers up and stamps medals in, one after another.
export function animateResult(root,{reduced=false,onTick=()=>{},onMedal=()=>{}}={}){
  const counters=[...root.querySelectorAll('[data-count]')],medals=[...root.querySelectorAll('.result-medals svg.earned')];
  if(reduced){for(const node of counters)node.textContent=num(node.dataset.count);return ()=>{};}
  for(const node of counters)node.textContent='0';
  medals.forEach(node=>node.classList.add('pending'));
  let time=0,stamped=0,lastTick=0,done=false;
  // Returns a step(dt) function for the frame loop; it reports true when finished.
  return dt=>{
    if(done)return true;time+=dt;
    while(stamped<medals.length&&time>.25+stamped*.32){medals[stamped].classList.remove('pending');medals[stamped].classList.add('stamp');onMedal(++stamped);}
    const u=clamp((time-.2)/1.1,0,1),eased=1-Math.pow(1-u,3);
    for(const node of counters)node.textContent=num(Number(node.dataset.count)*eased);
    if(u<1&&time-lastTick>.07){lastTick=time;onTick();}
    done=u>=1&&stamped>=medals.length;return done;
  };
}
