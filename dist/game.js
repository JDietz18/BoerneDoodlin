import './compat.js?v=21';
import {CHARACTERS,PLAYABLE_IDS,ABILITIES} from './characters.js?v=21';
import {AdventureRenderer} from './platform-renderer.js?v=21';
import {PlatformRun} from './platform-engine.js?v=21';
import {ScoutRun} from './scout-engine.js?v=21';
import {SnackStorm} from './snack-engine.js?v=21';
import {RallyRun,RallyRenderer} from './rally3d.js?v=21';
import {MemoryGame} from './memory-game.js?v=21';
import {loadJourney,saveJourney,Journey,UPGRADES,CHARMS,QUESTS,STICKERS,ACHIEVEMENTS,WORLDS,LEVELS} from './journey.js?v=21';
import {GameAudio} from './audio.js?v=21';
import {Celebrations} from './celebrations.js?v=21';
import {Hud,animateResult,tierOf} from './hud.js?v=21';
import {Controls} from './controls.js?v=21';
import {Haptics} from './haptics.js?v=21';

const $=id=>document.getElementById(id),num=n=>Math.round(Number(n)||0).toLocaleString(),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,cls='')=>`<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const modeNames={platform:'Platform adventure',scout:'Trail Scout',rally:'RV Rally',snack:'Snack Storm',memory:'Camp Pairs'};
const charmSymbols=['✦','✧','◈','♧','❋','☾','☀','↟','⌘','◆','↗','✺'];
let storage;try{storage=window.localStorage;}catch{storage=null;}
let journey=loadJourney(storage),ready=false,screen='home',run=null,currentConfig=null,finishing=false,lastResult=null,lastReward=null,mapWorld=journey.state.selectedWorld,activePanel='',frameTime=0,clock=0,lastHud=-1,lastCheckpointTime=0,toastTimer,calloutTimer,deferredInstall,swRegistration,reloading=false,storageWarned=false;
const renderer=new AdventureRenderer($('game')),audio=new GameAudio({enabled:journey.state.settings.sound}),celebrations=new Celebrations();
let rallyRenderer=null,memoryGame=null;
// Preferences that belong to this device rather than to the travelling save.
const PREFS_KEY='doodle-onward-device-v1';
const prefs={haptics:true,tilt:false,coached:{}};
try{const saved=JSON.parse(storage?.getItem(PREFS_KEY)||'{}');for(const key of ['haptics','tilt'])if(typeof saved[key]==='boolean')prefs[key]=saved[key];for(const mode of Object.keys(saved.coached||{}))if(saved.coached[mode]===true)prefs.coached[mode]=true;}catch{/* defaults */}
function savePrefs(){try{storage?.setItem(PREFS_KEY,JSON.stringify(prefs));}catch{/* session only */}}
const haptics=new Haptics({enabled:prefs.haptics}),hud=new Hud($);
const coarsePointer=window.matchMedia('(pointer:coarse)');
let inputMode=coarsePointer.matches?'touch':'keys',finaleTimer=0,resultStep=null,lastTier=0,lastCombo=0,wakeLock=null,wantAwake=false,wakePending=false,dirty=true,frameCount=0,frameFailed=false,insetTime=0,fxBusy=true,coachTime=0,lastSign='',tipTime=0,rallyStartX=0;
const engines={platform:new PlatformRun({onEvent:onGameEvent}),scout:new ScoutRun({onEvent:onGameEvent}),snack:new SnackStorm({onEvent:onGameEvent}),rally:new RallyRun({onEvent:onGameEvent})};
const held=new Set(),fxCanvas=$('celebrations'),fxContext=fxCanvas.getContext('2d');
let fxW=0,fxH=0,fxDpr=1;
const reduced=()=>journey.state.settings.reducedMotion||window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const totalMedals=()=>journey.state.worlds.reduce((sum,w)=>sum+w.medals,0);
const world=()=>WORLDS[journey.state.selectedWorld];
const level=id=>LEVELS.find(l=>l.id===id);
function nextLevel(worldIndex=journey.state.selectedWorld){return LEVELS.find(l=>l.worldIndex===worldIndex&&journey.state.levels[l.id].unlocked&&!journey.state.levels[l.id].completed)||LEVELS.find(l=>l.worldIndex===worldIndex&&journey.state.levels[l.id].unlocked)||LEVELS[0];}
function continueLevel(){const pending=Object.keys(journey.state.checkpoints).filter(id=>journey.state.levels[id]?.unlocked);return level(pending.find(id=>level(id).worldIndex===journey.state.selectedWorld)||'')||nextLevel();}
function persist(){const ok=saveJourney(storage,journey);$('save-status').textContent=ok?'Saved on this device':'Session only · export a backup';if(!ok&&!storageWarned){storageWarned=true;toast('This browser is blocking saves. Export a backup from your passport before you leave.');}return ok;}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function callout(text,duration=2300){if(!text)return;clearTimeout(calloutTimer);$('run-callout').textContent=text;$('run-callout').classList.add('visible');calloutTimer=setTimeout(()=>$('run-callout').classList.remove('visible'),duration);}
function announce(text){$('accessible-status').textContent=text;}
function paintPortraits(){if(ready)document.querySelectorAll('canvas[data-portrait]').forEach(c=>renderer.portrait(c,c.dataset.portrait));}
function syncSettings(){const s=journey.state.settings;$('sound-button').classList.toggle('muted',!s.sound);$('sound-button').setAttribute('aria-pressed',String(s.sound));$('sound-button').setAttribute('aria-label',s.sound?'Turn sound off':'Turn sound on');document.documentElement.dataset.reducedMotion=String(reduced());}
function gestureAudio(){audio.setEnabled(journey.state.settings.sound);audio.unlock();}
function toggleSound(){const enabled=!journey.state.settings.sound;audio.setEnabled(enabled);journey.setSetting('sound',enabled);if(enabled)audio.unlock();persist();syncSettings();audio.play('click');}
function clearInputs(){held.clear();controls.clear();run?.move?.(0,0);run?.brake?.(false);run?.releaseJump?.();}
function setScreen(next){
 screen=next;$('app').dataset.screen=next;$('app').dataset.activity=next==='home'?'':currentConfig?.mode||'';document.body.classList.toggle('playing',next!=='home');
 $('home-screen').hidden=next!=='home';$('camp-extras').hidden=next!=='home';$('run-ui').hidden=next==='home'||next==='result';$('pause-layer').hidden=next!=='paused';$('result-layer').hidden=next!=='result';
 $('play-controls').hidden=next!=='run'||currentConfig?.mode==='memory';controls.active=next==='run';$('run-ui').inert=next!=='run';
 $('rally-canvas').hidden=next==='home'||currentConfig?.mode!=='rally';$('memory-board').hidden=next==='home'||currentConfig?.mode!=='memory';$('game').hidden=next!=='home'&&['rally','memory'].includes(currentConfig?.mode);
 $('arena').dataset.mode=next==='home'?'home':currentConfig?.mode||'platform';$('below-game').hidden=next!=='home';
 if(next!=='run')clearInputs();renderer.resize();rallyRenderer?.resize();resizeEffects();layoutInsets();dirty=true;
 holdAwake(next==='run');
}
function setInputMode(mode){if(inputMode===mode&&$('app').dataset.input===mode)return;inputMode=mode;$('app').dataset.input=mode;controls.touchMode=mode==='touch';renderer.touchFirst=mode==='touch';if(mode!=='touch')$('coach').hidden=true;layoutInsets();dirty=true;}
// Tells each view which screen edges the HUD and the touch controls cover.
function layoutInsets(){
 const none={top:0,right:0,bottom:0,left:0};insetTime=clock;
 if(screen==='home'||!currentConfig){renderer.insets=none;return;}
 const arena=$('arena').getBoundingClientRect(),top=$('run-ui').hidden?arena.top:document.querySelector('#run-ui .hud-top').getBoundingClientRect().bottom;
 const probe=$('safe-probe'),safe=getComputedStyle(probe),side=value=>Math.max(0,Math.round(parseFloat(value)||0));
 const insets={top:Math.max(0,Math.round(top-arena.top)),right:side(safe.paddingRight),bottom:inputMode==='touch'?44+(probe.offsetHeight||0):0,left:side(safe.paddingLeft)};
 $('app').style.setProperty('--hud-h',`${insets.top}px`);renderer.insets=insets;
 if(rallyRenderer){
  rallyRenderer.insets=insets;const chip=currentConfig.mode==='rally'&&document.getElementById('obj-treats');
  // Snacks caught on the road fly to the treats count.
  if(chip){const r=chip.getBoundingClientRect();rallyRenderer.hudTarget=r.width?{x:r.left+r.width/2-arena.left,y:r.top+r.height/2-arena.top}:null;}
 }
}
// The request is asynchronous, so the wish is recorded first: a lock that
// arrives after the run has ended is handed straight back.
async function holdAwake(on){
 wantAwake=on;
 try{
  if(on&&!wakeLock&&!wakePending&&navigator.wakeLock){
   wakePending=true;const lock=await navigator.wakeLock.request('screen');wakePending=false;
   if(!wantAwake){await lock.release();return;}
   wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null;});
  }else if(!on&&wakeLock){const lock=wakeLock;wakeLock=null;await lock.release();}
 }catch{wakePending=false;wakeLock=null;}
}
function renderHome(){
 const s=journey.state,w=world(),next=continueLevel();$('wallet').textContent=num(s.wallet);$('medal-total').textContent=`${totalMedals()} / 90 medals`;
 $('play-label').textContent=s.checkpoints[next.id]?'Continue your adventure':s.counters.runs?'Onward, adventurer!':'Let’s go on an adventure';$('play-detail').textContent=`${w.name} · ${next.title}`;$('play-button').disabled=!ready;
 $('hero-world').innerHTML=`<span>CHAPTER ${String(w.index+1).padStart(2,'0')} / 05</span><strong>${esc(w.name)}</strong><small>${esc(w.tagline)}</small>`;
 $('crew-perk').textContent=`${CHARACTERS[s.selectedCharacter].name} · ${ABILITIES[s.selectedCharacter].name}`;
 $('crew').innerHTML=PLAYABLE_IDS.map(id=>`<button class="crew-choice ${s.selectedCharacter===id?'active':''}" data-character="${id}" aria-pressed="${s.selectedCharacter===id}" aria-label="Play as ${CHARACTERS[id].name}. ${esc(ABILITIES[id].detail)}"><canvas data-portrait="${id}" width="120" height="120" aria-hidden="true"></canvas><span><strong>${CHARACTERS[id].name}</strong><small>${id==='kevin'?'Forever guide':ABILITIES[id].name}</small></span>${s.selectedCharacter===id?'<b class="crew-check">✓</b>':''}</button>`).join('');
 const d=journey.getDailyChallenge();$('daily-title').textContent=`${modeNames[d.mode]} · ${WORLDS[d.worldIndex].name}`;$('daily-detail').textContent=d.claimed?`Bonus banked. Today’s best: ${num(d.bestScore)} points.`:`Finish today’s shared course for ${d.bonus} bonus treats. Standard gear keeps the challenge even.`;$('daily-button').textContent=d.claimed?'Beat your best':'Play today';
 const quests=journey.questProgress(s.selectedWorld),complete=quests.filter(q=>q.completed).length,nextQuest=quests.find(q=>!q.completed);$('quest-preview').innerHTML=`<span class="quest-ring" style="--progress:${complete/4*100}%"><span>${complete}/4</span></span><div><span class="eyebrow">THE FAMILY QUEST BOARD</span><h3>${nextQuest?esc(nextQuest.name):'Every little favor, done.'}</h3><p>${nextQuest?`${CHARACTERS[nextQuest.character].name} has a favor. ${num(nextQuest.progress)} / ${nextQuest.target} so far.`:'More family adventures await in the next world.'}</p></div><button data-panel="quests" aria-label="Open family quest board">${icon('arrow')}</button>`;
 renderMap();paintPortraits();syncSettings();document.querySelectorAll('[data-start-mode],#daily-button').forEach(b=>b.disabled=!ready);
}
function renderMap(){
 const s=journey.state,w=WORLDS[mapWorld],saved=s.worlds[mapWorld];
 $('world-tabs').innerHTML=WORLDS.map(a=>{const state=s.worlds[a.index];return `<button class="world-tab ${mapWorld===a.index?'active':''} ${state.unlocked?'':'locked'}" data-world="${a.index}" aria-pressed="${mapWorld===a.index}" aria-label="${a.name}. ${state.unlocked?`${state.clears} of 6 levels cleared`:'Locked. Clear four levels in the previous world.'}"><span>${state.completed?'✓':a.index+1}</span><span><strong>${a.name}</strong><small>${state.unlocked?`${state.clears} / 6 trails cleared`:'A little farther ahead'}</small></span></button>`;}).join('');
 $('world-stage').innerHTML=`<div class="world-stage-heading"><div><h3>${w.name}</h3><p>${esc(w.tagline)}</p></div><span>${saved.unlocked?`${saved.clears}/6 trails cleared · ${saved.medals}/18 medals`:`Clear four ${WORLDS[mapWorld-1]?.name||'previous world'} trails to open this chapter.`}</span></div><div class="level-grid">${LEVELS.filter(l=>l.worldIndex===mapWorld).map(l=>{const r=s.levels[l.id];return `<button class="level-card ${r.completed?'complete':''}" data-level="${l.id}" ${!r.unlocked||!ready?'disabled':''} aria-label="${l.index+1}. ${esc(l.title)}. ${r.medals} of 3 medals. ${r.unlocked?'Play':'Locked'}"><b>${r.completed?'✓':l.boss?'✦':l.index+1}</b><strong>${esc(l.title)}</strong><span class="medals">${[1,2,3].map(n=>icon('star',n<=r.medals?'earned':'')).join('')}</span><small>${l.boss?'BOUNCE BATTLE':s.checkpoints[l.id]?'CONTINUE EXPLORING':r.completed?'PLAY AGAIN':'FIND 2 KEYS + THE RV'}</small>${s.checkpoints[l.id]?'<span class="checkpoint-mark">SAVED</span>':''}</button>`;}).join('')}</div><div class="world-stage-footer"><span>${saved.unlocked?'Clear any four trails to open the next chapter. Explore all six for every medal.':'Your open chapters and every mini-game are ready whenever you are.'}</span><button data-panel="quests">${saved.unlocked?'See this world’s quests':'See the quest board'} →</button></div>`;
}
function startRun(selection={mode:'platform',levelId:continueLevel().id},{fresh=false}={}){
 if(!ready)return;closePanel();gestureAudio();clearInputs();
 if(selection.mode==='platform'&&fresh&&selection.levelId&&!selection.dailyDate&&!selection.remix)journey.clearCheckpoint(selection.levelId);
 const config=journey.getRunConfig({...selection,worldIndex:selection.worldIndex??journey.state.selectedWorld});if(fresh||config.dailyDate||config.remix)config.checkpoint=null;
 currentConfig=config;finishing=false;lastResult=null;lastReward=null;lastHud=-1;lastCheckpointTime=0;finaleTimer=0;resultStep=null;lastTier=0;lastCombo=0;renderer.resetCamera();renderer.particles=[];renderer.labels=[];renderer.juice.clear();rallyRenderer?.juice?.clear();celebrations.clear();clearTimeout(calloutTimer);$('run-callout').classList.remove('visible');$('run-callout').textContent='';
 if(config.mode==='memory'){
  memoryGame?.destroy();memoryGame=new MemoryGame($('memory-board'),{onEvent:onGameEvent,onFinish:finishGame});run=memoryGame;run.reset(config);
 }else {run=engines[config.mode];run.reset(config);}
 // Restored journeys keep the buddy and equipment that began that outing.
 config.characterId=run.characterId||config.characterId;if(run.gear)config.gear={...run.gear};
 // Snack Storm uses the original common gear contract; attach journey context.
 if(config.mode==='snack'){run.worldIndex=config.worldIndex;run.stage=config.worldIndex;run.dailyDate=config.dailyDate||'';}
 if(config.mode==='rally'&&!rallyRenderer)rallyRenderer=new RallyRenderer($('rally-canvas'));
 if(config.mode==='rally'&&prefs.tilt)controls.enableTilt().then(ok=>{if(ok)controls.calibrateTilt();});
 lastSign='';tipTime=clock;$('mode-tip').parentElement.classList.remove('faded');configureControls();setScreen('run');showCoach(config.mode);audio.setScene('run',config.worldIndex);frameTime=performance.now();window.scrollTo({top:0,behavior:'instant'});updateHud();
 if(config.mode==='memory')memoryGame.focus();else (config.mode==='rally'?$('rally-canvas'):$('game')).focus({preventScroll:true});
 if(config.checkpoint)callout('Right where you left your pawprints.');
 else callout({platform:'Two keys. Three golden snacks. One great adventure.',scout:'Find 3 treasures, a key, and a parcel for your neighbor.'}[config.mode],2600);
 announce(`${modeNames[config.mode]} in ${WORLDS[config.worldIndex].name}.`);
}
function saveCheckpoint(){if(run?.runMode==='platform'&&!currentConfig?.dailyDate&&!currentConfig?.remix&&['running','paused'].includes(run.mode)&&run.time>1){journey.saveCheckpoint(run.levelId,run.snapshot());persist();}}
function pause(){if(screen!=='run')return;run.pause();saveCheckpoint();audio.suspend();setScreen('paused');renderer.portrait($('pause-portrait'),run.characterId||currentConfig.characterId);$('pause-detail').textContent=resumable()?'Your position and discoveries are saved. Ready when you are.':'The clock has stopped. Take all the time you need.';$('resume-button').focus({preventScroll:true});announce('Adventure paused.');}
function resume(){if(screen!=='paused')return;gestureAudio();run.resume();setScreen('run');controls.calibrateTilt();frameTime=performance.now();audio.setScene('run',currentConfig.worldIndex);if(currentConfig.mode==='memory')memoryGame.focus();else (currentConfig.mode==='rally'?$('rally-canvas'):$('game')).focus({preventScroll:true});}
// A fresh mini-game deals a fresh board; platform levels and dailies keep their layout.
function restart({remix=false}={}){if(!currentConfig)return;if(run&&['run','paused'].includes(screen)&&!finishing){run.pause();if(!resumable())bankUnfinished();}const reroll=remix||(currentConfig.mode!=='platform'&&!currentConfig.dailyDate),c={...currentConfig,seed:reroll?undefined:currentConfig.seed,remix:remix||currentConfig.remix};startRun(c,{fresh:true});}
function home(){
 closePanel();if(run&&['run','paused'].includes(screen)&&!finishing){run.pause();bankUnfinished();}
 memoryGame?.pause();clearTimeout(calloutTimer);$('run-callout').classList.remove('visible');$('run-callout').textContent='';setScreen('home');mapWorld=journey.state.selectedWorld;audio.setScene('menu',mapWorld);renderHome();checkUpdate();$('play-button').focus({preventScroll:true});
}
// Only an ordinary platform level can be picked up again later.
function resumable(){return currentConfig?.mode==='platform'&&!currentConfig.dailyDate&&!currentConfig.remix;}
// Leaving mid-run: an ordinary level saves its place; everything else banks what was found, once.
function bankUnfinished(){
 if(resumable()){saveCheckpoint();return;}
 if(run.time>2||run.score>0){const summary=enrichResult(run.result());summary.won=false;journey.completeRun(summary);persist();}
}
function enrichResult(summary){return {...summary,mode:currentConfig.mode,worldIndex:currentConfig.worldIndex,characterId:summary.characterId||currentConfig.characterId,seed:currentConfig.seed,dailyDate:currentConfig.dailyDate||'',levelId:currentConfig.levelId||summary.levelId};}
// Rewards are banked the moment a run ends. The result card follows a short
// beat later so the last bounce, catch, or crossing can land on screen.
function finishGame(summary){
 if(finishing||!run||!currentConfig||screen==='home')return;finishing=true;lastResult=enrichResult(summary?.runId?summary:run.result());lastReward=journey.completeRun(lastResult);
 if(lastResult.mode==='platform'&&!currentConfig.dailyDate&&!currentConfig.remix)journey.clearCheckpoint(lastResult.levelId);persist();
 audio.play(lastResult.won?'finish':'lost');haptics.pulse(lastResult.won?'success':'heavy');
 finaleTimer=reduced()?.05:lastResult.won?(lastResult.mode==='memory'?1.35:1.15):.8;setScreen('finale');
}
function showResult(){
 if(screen!=='finale')return;setScreen('result');renderResult();audio.setScene('result',currentConfig.worldIndex);
 if(lastResult.won)celebrations.burst({x:.5,y:.24,kind:lastReward.newBest?'record':'win'});
 if(lastReward.questRewards.length){audio.play('mission');celebrations.burst({x:.3,y:.45,kind:'star'});}announce(`${lastResult.won?'Adventure complete':'Good try'}. ${num(lastResult.score)} points and ${lastReward.earnedTreats} treats earned.`);
 resultStep=animateResult($('result-content'),{reduced:reduced(),onTick:()=>audio.play('count-up'),onMedal:index=>{audio.play('medal',{index});haptics.pulse('medium');}});
 $('result-content').querySelector('.primary')?.focus({preventScroll:true});
}
function renderResult(){
 const r=lastResult,p=lastReward,platform=r.mode==='platform'&&journey.state.levels[r.levelId]?.unlocked===true,next=platform&&r.won?LEVELS.find(l=>l.worldIndex===r.worldIndex&&journey.state.levels[l.id].unlocked&&!journey.state.levels[l.id].completed):null;
 const title=r.won?({platform:'Pawsitively onward!',scout:'A nose for adventure.',rally:'What a lovely detour.',snack:'A very snacky forecast.',memory:'A perfect little match.'}[r.mode]):r.mode==='memory'?'One more little flip?':'Good paws. Fresh start.';
 const rewards=[...(p.unlockedWorlds||[]).map(w=>`${w.name} is open!`),...(p.unlockedCharms||[]).map(c=>`${c.name} earned.`),...(p.questRewards||[]).map(q=>`${q.name}: +${q.reward} treats.`),...(p.dailyBonus?[`Daily bonus: +${p.dailyBonus} treats.`]:[])];
 const medals=platform?`<div class="result-medals">${[1,2,3].map(n=>icon('star',n<=p.medals?'earned':'')).join('')}</div>`:`<div class="result-medals">${icon(r.won?'trophy':'paw','earned')}</div>`;
 $('result-content').innerHTML=`${medals}${p.newBest?'<span class="result-record">A NEW PERSONAL BEST</span>':''}<span class="eyebrow">${esc(WORLDS[r.worldIndex].name)} · ${esc(modeNames[r.mode])}</span><h2>${title}</h2><p class="result-line">${r.won?platform?`${esc(level(r.levelId).title)} is in the passport. There’s always another little path to explore.`:'Every little detour brings something good back to camp.':`The treats you found are safely in your backpack. ${r.mode==='platform'?'Try another route, change your charms, or have a quick mini-game break.':'Your next attempt is a fresh chance to find your rhythm.'}`}</p><div class="result-stats"><div><strong data-count="${Math.round(r.score)||0}">${num(r.score)}</strong><span>POINTS</span></div><div><strong data-count="${Math.round(r.treats)||0}">${num(r.treats)}</strong><span>TREATS FOUND</span></div><div><strong>${r.bestMultiplier||1}×</strong><span>BIGGEST STACK</span></div></div>${platform?`<div class="result-goals">${p.medalGoals.map(g=>`<span class="${g.earned?'done':''}">${g.earned?'✓ ':''}${esc(g.label)}</span>`).join('')}</div>`:''}<p class="reward-line">+<span data-count="${Math.round(p.earnedTreats)||0}">${num(p.earnedTreats)}</span> treats in your backpack${p.newMedals?` · +${p.newMedals} new medals`:''}</p>${rewards.length?`<p class="result-unlocks">${rewards.slice(0,4).map(esc).join('<br>')}</p>`:''}<button class="primary" data-result-action="${next?'next':'retry'}" ${next?`data-next-level="${next.id}"`:''}>${next?'The next little adventure':'Let’s do it again'} ${icon('arrow')}</button><div class="button-pair"><button class="secondary" data-result-action="${platform&&!currentConfig.dailyDate?'remix':'gear'}">${platform&&!currentConfig.dailyDate?'Remix this trail':'Visit the backpack'}</button><button class="secondary" data-result-action="home">Back to camp</button></div><div class="result-foot"><button class="text-button" data-result-action="quests">Check the quest board</button><button class="text-button" data-result-action="map">Explore the worlds</button></div>`;
}
const HAPTIC={'double-jump':'light',stomp:'stomp',smash:'stomp',pop:'light',hit:'hit',crash:'hit',shield:'medium',key:'gold',checkpoint:'medium',secret:'gold','boss-defeated':'success',power:'power',fever:'power','gold-rush':'gold',spring:'light',vent:'medium',block:'light',chest:'medium',match:'light',mismatch:'medium',deliver:'success',treasure:'gold',parcel:'medium','near-miss':'light',respawn:'light',
 flip:'tap',peek:'light',streak:'gold',swap:'medium','swap-done':'light','time-up':'medium','perfect-game':'max',go:'medium',ramp:'medium',landing:'medium',splash:'light',convoy:'success','final-push':'medium','finish-line':'success',bounce:'light',bloom:'medium',golden:'gold',trail:'light','trail-complete':'success',critter:'gold','paw-reveal':'light',paw:'success',greet:'light',bump:'tap'};
// Events that make no sound of their own. An engine's own 'stack' event is
// voiced by watchStack, which knows the real tier.
const QUIET=['start','pause','resume','prompt','step','hint','won','lost','dialog','locked','restore','stack','swap-done','walk','walk-end','walk-wait','trail-fade','critter-back'];
const SOUND_ALIAS={stomp:'spring',block:'collect',key:'unlock',chest:'unlock',secret:'mission',checkpoint:'unlock',fever:'combo','boss-defeated':'finish',pair:'collect',dodge:'near-miss'};
function onGameEvent(e){
 if(!run||finishing)return;
 const mode=currentConfig?.mode;
 forwardToView(e);
 // RV Rally has a real near-miss, so an ordinary pass stays quiet there; a chain
 // only sounds lost once it was worth something.
 const hush=QUIET.includes(e.type)||(mode==='rally'&&e.type==='dodge')||(e.type==='chain-lost'&&e.multiplier!==undefined&&!(e.multiplier>1));
 if(!hush)audio.play(audio.has?.(e.type)?e.type:SOUND_ALIAS[e.type]||e.type,{...e,gold:e.kind==='gold'});
 const last=e.remaining??e.seconds??e.count;
 const pulse=e.type==='collect'?(e.kind==='gold'?'gold':'collect'):['tick','final-tick','countdown'].includes(e.type)?(last<=3?'tap':null):e.type==='walk-end'?(e.reason==='hazard'?'medium':null):HAPTIC[e.type];if(pulse)haptics.pulse(pulse);
 if(e.type==='perfect-game')celebrations.burst({x:.5,y:.3,kind:'record'});
 if(e.type==='won'||e.type==='lost'){finishGame(e.result||run.result());return;}
 const power=ABILITIES[currentConfig?.characterId||'griffin'].name.toUpperCase();
 const how=inputMode!=='touch'?'Press X.':mode==='scout'?'Tap with two fingers.':'Flick up!';
 const text={charged:`${mode==='rally'?'BOOST':power} READY! ${how}`,checkpoint:'Checkpoint saved. Take the scenic route.','boss-defeated':'Snack dispute settled. Onward!','deliver':'Special delivery. Good neighbor energy.','parcel':'The picnic bundle! Bring it to your neighbor.'}[e.type];
 if(text)callout(text,e.type==='checkpoint'?1600:2000);
 if(mode==='scout'&&e.type==='chest')callout('Another treasure for the passport.',1800);
 if(['dialog','locked'].includes(e.type)||(e.type==='hint'&&mode==='scout'))callout(e.text||e.message||'Follow the glowing path.',3300);
 if(e.type==='hit'&&run.hearts===1)callout(`${CHARACTERS[currentConfig.characterId].name} believes in one more try.`,2000);
 if(e.type==='checkpoint')saveCheckpoint();
}
function forwardToView(e){
 const mode=currentConfig?.mode;
 if(mode==='platform')renderer.addAdventureEvent(e,run);else if(mode==='snack')renderer.addEvent(e,run);else if(mode==='scout')renderer.addScoutEvent?.(e,run);else if(mode==='rally')rallyRenderer?.addEvent?.(e,run);
}
// Watches the live stack and announces each new tier once on the way up.
function watchStack(){
 if(!run||currentConfig.mode==='memory')return;
 const total=run.totalMultiplier||run.multiplier||1,tier=tierOf(total);
 if(tier>lastTier){
  const e={type:'stack',total:tier,tier};if(currentConfig.mode!=='snack')forwardToView(e);audio.play(audio.has?.('stack')?'stack':tier>=10?'mega-stack':'combo',e);haptics.pulse(tier>=30?'max':tier>=10?'power':'medium');
  // Snack Storm and RV Rally celebrate in the scene itself; the others get the page's confetti and a line.
  const inScene=currentConfig.mode==='snack'||currentConfig.mode==='rally';
  if(tier>=10&&!inScene)celebrations.burst({x:.6,y:.22,kind:'stack'});
  if(tier>=30&&currentConfig.mode!=='snack')callout('MAX STACK! 30× POINTS!',2600);
 }
 lastTier=tier;
 const combo=run.combo||0;if(lastCombo>=6&&combo===0&&currentConfig.mode!=='snack'){audio.play('chain-lost');forwardToView({type:'chain-lost',combo:lastCombo});}lastCombo=combo;
}
function configureControls(){
 const m=currentConfig.mode,ability=ABILITIES[currentConfig.characterId],lv=m==='platform'?level(currentConfig.levelId):null,w=WORLDS[currentConfig.worldIndex];
 controls.configure(m);
 hud.begin({mode:m,characterId:currentConfig.characterId,powerName:m==='rally'?'boost':ability.name,requiredKeys:run?.requiredKeys||2,maxHearts:run?.maxHearts||3,
  region:m==='platform'?`${currentConfig.worldIndex+1}-${lv.index+1} · ${lv.title}`:w.name,
  tip:{platform:'← → move · Space jump twice · ↓ drop · X power · E open',scout:'Arrows move · E interact · H hint · X power',rally:'← → steer · ↓ brake · X boost',snack:'← → move · X power',memory:''}[m]});
 for(const [id,show] of Object.entries({up:m==='scout',down:m==='scout'||m==='rally',jump:m==='platform',interact:m==='platform'||m==='scout',hint:m==='scout',left:m!=='memory',right:m!=='memory',power:m!=='memory'}))$(`${id}-button`).hidden=!show;
}
function updateHud(){
 if(!run||screen==='home'||screen==='result')return;
 hud.update(run,frameDt,{reduced:reduced()});
 $('wallet').textContent=num(journey.state.wallet);
}
// First-time hints about where to touch. They fade once each move has been tried.
const COACH={
 platform:[['slide','Slide to run','Left side. Flick up for power.','move'],['tap','Tap to jump','Right side. Hold for height, tap again in the air.','action']],
 scout:[['swipe','Swipe to walk','Or tap a tile to go there.','move'],['tap','Press and hold for a hint','Two fingers use your power.','']],
 rally:[['drag','Drag to steer','Pull back to brake. Flick up to boost.','move']],
 snack:[['drag','Drag to catch','Flick up for your power.','move']]
};
function showCoach(mode){
 const tips=COACH[mode],box=$('coach');box.hidden=true;coachTime=0;
 if(!tips||inputMode!=='touch'||prefs.coached[mode]||currentConfig?.checkpoint)return;
 box.innerHTML=tips.map(([motion,title,detail,need])=>`<div class="coach-tip" data-need="${need}"><span class="coach-hand ${motion}"></span><span>${title}<br><small>${detail}</small></span></div>`).join('');
 box.classList.remove('leaving');box.hidden=false;coachTime=9;
}
function updateCoach(dt){
 if(coachTime<=0)return;const box=$('coach');let pending=0;
 for(const tip of box.children){const need=tip.dataset.need,done=need&&controls.used[need];tip.classList.toggle('done',!!done);if(need&&!done)pending++;}
 // The moment every move has been tried, the tips are done for good on this phone.
 if(!pending&&!prefs.coached[currentConfig.mode]){prefs.coached[currentConfig.mode]=true;savePrefs();}
 coachTime-=pending?dt:dt*3;
 if(coachTime<=1)box.classList.add('leaving');
 if(coachTime<=0)box.hidden=true;
}
function questHTML(worldIndex){return journey.questProgress(worldIndex).map(q=>`<article class="quest-card ${q.completed?'completed':''}"><small>${esc(CHARACTERS[q.character].name)} ${q.completed?'· FAVOR COMPLETE':'HAS A LITTLE FAVOR'}</small><h3>${esc(q.name)}</h3><p>${esc(q.description)}</p><div class="quest-track"><i style="width:${clamp(q.progress/q.target,0,1)*100}%"></i></div><footer><span>${q.completed?'✓ Complete':`${num(q.progress)} / ${q.target}`}</span><span>${q.completed?'Reward in your backpack':`+${q.reward} treats`}</span></footer></article>`).join('');}
function openPanel(panel){
 if(screen==='run')pause();activePanel=panel;const s=journey.state;let title='',html='';
 if(panel==='quests'){
  title='Good friends. Little favors.';html=`<p class="panel-intro">Twenty side quests, one very helpful crew. Explore, stomp, match, steer, and stack bonuses. Quest rewards land in your backpack after each outing.</p>${WORLDS.map(w=>`<div class="quest-world-label"><h3>${w.index+1}. ${w.name}</h3><span>${journey.questProgress(w.index).filter(q=>q.completed).length}/4 complete</span></div><div class="quest-grid">${questHTML(w.index)}</div>`).join('')}`;
 }else if(panel==='gear'){
  title='Pack a little possibility.';html=`<p class="panel-intro">You have <strong>${num(s.wallet)} treats</strong> to spend. Upgrades stay with you. Equip up to three earned charms to build your own kind of adventure.</p><div class="upgrade-grid">${UPGRADES.map(u=>{const n=s.upgrades[u.id],cost=u.costs[n],done=n>=u.maxLevel;return `<article class="upgrade-card">${icon({magnet:'bone',charge:'bolt',heart:'heart'}[u.id])}<h3>${esc(u.name)}</h3><p>${esc(u.description)} Current level: ${n} / ${u.maxLevel}.</p><div class="upgrade-levels">${Array.from({length:u.maxLevel},(_,i)=>`<i class="${i<n?'done':''}"></i>`).join('')}</div><button class="secondary" data-upgrade="${u.id}" ${done||s.wallet<cost?'disabled':''}>${done?'Fully upgraded':`${cost} treats · Upgrade`}</button></article>`;}).join('')}</div><h3 class="panel-heading">Three charms. Your signature stack.</h3><div class="loadout-slots">${Array.from({length:3},(_,i)=>{const c=CHARMS.find(c=>c.id===s.charms.loadout[i]);return `<span class="${c?'filled':''}">${c?esc(c.name):`Charm slot ${i+1}`}</span>`;}).join('')}</div><div class="charm-grid">${CHARMS.map((c,i)=>{const unlocked=s.charms.unlocked.includes(c.id),equipped=s.charms.loadout.includes(c.id);return `<button class="charm-card ${equipped?'equipped':''} ${unlocked?'':'locked'}" data-charm="${c.id}" aria-pressed="${equipped}" ${unlocked?'':'disabled'}><span aria-hidden="true">${charmSymbols[i]}</span><h3>${esc(c.name)}</h3><p>${esc(c.description)}</p><small>${equipped?'✓ Equipped · tap to remove':unlocked?'Tap to equip':esc(c.unlockLabel)}</small></button>`;}).join('')}</div><p class="record-note">A charm works in the activities that use its effect. Platform jumps and stomps stay on the trail; steering belongs to the RV. Daily challenges use standard gear.</p>`;
 }else if(panel==='passport'){
  title='A passport full of pawprints.';const completed=s.worlds.reduce((n,w)=>n+w.clears,0),questCount=QUESTS.filter(q=>s.quests[q.id].completed).length;
  html=`<p class="panel-intro">Every outing leaves a little story. Chase all 90 medals, complete the family’s favors, and keep the best bonus stacks coming. Your progress stays on this browser.</p><div class="records-grid">${[[`${completed}/30`,'TRAILS CLEARED'],[`${totalMedals()}/90`,'SHINY MEDALS'],[`${questCount}/20`,'FAMILY FAVORS'],[`${s.counters.bestMultiplier}×`,'BIGGEST STACK'],...Object.entries(modeNames).map(([m,n])=>[num(s.records[m].score),`${n.toUpperCase()} BEST`]),[num(s.counters.treats),'TREATS FOUND'],[num(s.counters.secrets),'SECRETS REVEALED'],[num(s.counters.runs),'FAMILY OUTINGS']].map(([v,l])=>`<div class="record-card"><strong>${v}</strong><span>${l}</span></div>`).join('')}</div><h3 class="panel-heading">Stickers from the road</h3><div class="sticker-grid">${STICKERS.map(st=>`<div class="sticker ${s.passport.stickers.includes(st.id)?'earned':''}" title="${esc(st.description)}"><span aria-hidden="true">${st.kind==='world'?'✦':st.kind==='crew'?'♧':({platform:'↟',scout:'✧',rally:'▰',snack:'❋',memory:'◈'}[st.mode])}</span><strong>${esc(st.name)}</strong></div>`).join('')}</div><h3 class="panel-heading">The whole crew</h3><div class="family-records">${PLAYABLE_IDS.map(id=>`<div><canvas data-portrait="${id}" width="150" height="150" aria-hidden="true"></canvas><strong>${CHARACTERS[id].name}</strong><span>${num(s.counters.characters[id].runs)} outings</span></div>`).join('')}</div><p class="record-note">Kevin, our forever guide. Always part of the family, and along for every mile.</p><h3 class="panel-heading">Little legends</h3><div class="quest-grid">${ACHIEVEMENTS.map(a=>`<article class="quest-card ${s.passport.achievements.includes(a.id)?'completed':''}"><small>${s.passport.achievements.includes(a.id)?'✓ ACHIEVEMENT EARNED':'A LITTLE SOMETHING TO AIM FOR'}</small><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p></article>`).join('')}</div><h3 class="panel-heading">Bring your progress along.</h3><p class="panel-intro">Download a backup before changing browsers or devices. Import it here to continue the trip. Importing replaces the progress on this device.</p><div class="export-row"><button class="secondary" id="export-save">Download save backup</button><button class="secondary" id="import-save">Import save backup</button><input id="import-file" type="file" accept="application/json,.json" hidden></div><p class="panel-intro">No file handy? Copy your backup as text, send it to the other phone in a message or a note, and paste it there.</p><div class="export-row"><button class="secondary" id="copy-save">Copy backup text</button><button class="secondary" id="paste-save">Paste backup text</button></div><div class="paste-row" id="paste-row" hidden><textarea id="paste-save-text" rows="4" aria-label="Backup text" placeholder="Paste your Doodle Onward backup text here" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea><button class="primary" id="restore-save">Continue from this backup</button></div>${s.migration.imported?'<p class="record-note">Your previous adventure’s treats, upgrades, selected buddy, and settings have been carried into this trip.</p>':''}`;
 }else if(panel==='help'){
  title='A little guide to a big trip.';html=`<p class="panel-intro">Thirty trails, five worlds, and plenty of detours. Take one chapter a day or follow your curiosity. All four adventure buddies and all the mini-games are ready from the beginning.</p>${inputMode==='touch'?'<div class="instructions"><div class="instruction"><h3>The whole screen is your controller.</h3><p>No buttons to hunt for. On the trail, <strong>slide your left thumb</strong> to run either way, and <strong>tap the right side</strong> to jump. Hold for height and tap again in the air for a double jump. <strong>Flick up</strong> with your left thumb for your power, and pull down to drop fast. Chests open and signs speak when you reach them.</p></div><div class="instruction"><h3>Swipe to scout.</h3><p>In Trail Scout, swipe to step and keep dragging to keep walking, or tap a tile or the corner map to go there. Press and hold for a hint. Tap with two fingers for your power.</p></div><div class="instruction"><h3>Drag to drive. Drag to catch.</h3><p>In RV Rally, drag left or right anywhere to steer, pull back to brake, and flick up to boost. Catch every snack in a convoy for a bonus, squeeze past a cone for a near miss, and take the ramps. In Snack Storm, drag to move and flick up for your power. The glowing power meter at the top can always be tapped as well. Tilt steering is in the settings below.</p></div></div>':''}${inputMode==='touch'?'':`<div class="instructions"><div class="instruction"><h3>Run. Jump. Explore.</h3><p><kbd>← →</kbd> or <kbd>A D</kbd> move freely. <kbd>Space</kbd>, <kbd>↑</kbd>, or <kbd>W</kbd> jumps. Hold for height; press again for a double jump. Bounce on the snack bandits, hit blocks from below, and use <kbd>E</kbd> to open chests. Two high-path keys open the RV goal. Checkpoints restore a heart and save your place.</p></div><div class="instruction"><h3>Follow your nose.</h3><p>Trail Scout is a top-down treasure adventure. Move in four directions with the arrow keys or <kbd>W A S D</kbd>. Press <kbd>E</kbd> beside a chest or neighbor. Find three treasures, a key, and the parcel; deliver it before returning to the RV. <kbd>H</kbd> shows a trail hint; <kbd>X</kbd> uses your character’s power. There is no countdown.</p></div><div class="instruction"><h3>Take the wheel.</h3><p>RV Rally is a 60-second 3D driving challenge. Use <kbd>← →</kbd> or <kbd>A D</kbd> to steer. Hold <kbd>↓</kbd> or <kbd>S</kbd> to brake. Collect snacks along the safe route, avoid cones and crates, and use <kbd>X</kbd> to boost when charged. Catch every snack in a convoy for a bonus, squeeze past a cone for a near miss, and take the ramps.</p></div><div class="instruction"><h3>A quick camp break.</h3><p>Catch falling treats for 45 seconds in Snack Storm. Move with the arrow keys or a drag across the field. In Camp Pairs, flip cards to find matches. Consecutive matches multiply your points. Both modes earn treats and quest progress.</p></div></div>`}<h3 class="panel-heading">Stack the good stuff.</h3><div class="stack-example"><span>5× chain</span><b>×</b><span>2× frenzy</span><b>×</b><span>2× Gold Rush</span><b>×</b><span>1.5× Griffin power</span><strong>30× points</strong></div><p class="panel-intro">Collect treats in a row to build a chain. Gold extends your double-point rush. Long chains start a frenzy. Stack Griffin’s power on top, then equip charms to keep the good things going longer.</p><div class="instructions">${PLAYABLE_IDS.map(id=>`<div class="instruction"><h3>${CHARACTERS[id].name}</h3><p><strong>${ABILITIES[id].name}</strong><br>${esc(ABILITIES[id].detail)}</p></div>`).join('')}</div><div class="settings">${[['sound','Music & sound','Original road-trip tunes and satisfying snack chimes. On iPhone, the ring switch also needs to be on.'],['assist','Easygoing mode','Extra hearts and a gentler pace. Applies on your next outing.'],['reducedMotion','Reduced motion','Steady scenery, quieter effects, and fewer moving decorations.']].map(([id,title,desc])=>`<label class="setting"><span><strong>${title}</strong><small>${desc}</small></span><input type="checkbox" data-setting="${id}" ${s.settings[id]?'checked':''}></label>`).join('')}${[['haptics','Touch feedback','A little tap for jumps, bounces, and big stacks, on phones that support it.'],['tilt','Tilt to steer','Steer the RV by tilting your phone. Dragging still works.']].map(([id,title,desc])=>`<label class="setting"><span><strong>${title}</strong><small>${desc}</small></span><input type="checkbox" data-pref="${id}" ${prefs[id]?'checked':''}></label>`).join('')}</div><p class="key-help">${inputMode==='touch'?'The pause button is in the top corner.':'<kbd>P</kbd> or <kbd>Esc</kbd> pauses.'} Progress in platform levels saves when you pause, reach a checkpoint, or return to camp. Complete any four different trails to open the next world. Three medals per level: finish, collect all three gold, and finish without a hit or within the target time. A remix reshuffles the platform route for a fresh challenge.</p>`;
 }else if(panel==='install'){
  title='Ready for the road.';html=`<img class="install-image" src="/assets/griffin-icon.png?v=21" alt="Griffin, your adventure buddy"><p class="panel-intro">Add Doodle Onward to your Home Screen for a full-screen adventure. Let the game finish loading while you’re connected, then the game and every activity can reopen offline.</p>${deferredInstall?'<button class="primary" data-install-now>Install Doodle Onward</button>':'<ol class="install-steps"><li>On iPhone or iPad, open this page in Safari.</li><li>Tap Share, then <strong>Add to Home Screen</strong>.</li><li>On Android or desktop, use your browser’s <strong>Install app</strong> option.</li></ol>'}<p class="record-note">Your save belongs to this browser and device. Download a backup from the passport before moving to a new device. After installing, open the game once and try an adventure before traveling offline.</p><div class="export-row"><button class="secondary" data-panel="passport">Open your passport</button></div>`;
 }else if(panel==='share'){
  title='Invite a fellow adventurer.';html=`<p class="panel-intro">One good dog, the whole crew, and a road full of little adventures.</p><input class="share-url" id="share-url" readonly value="${esc(location.origin+'/')}" aria-label="Game link"><div class="export-row"><button class="secondary" id="copy-link">Copy game link</button></div>`;
 }
 $('panel-title').textContent=title;$('panel-content').innerHTML=html;if(!$('panel-dialog').open){$('panel-dialog').showModal();audio.play('ui-open');}paintPortraits();
}
const backupText=()=>JSON.stringify({game:'Doodle Onward',exportedAt:new Date().toISOString(),journey:journey.serialize()},null,2);
// Replaces this device's progress with a backup. The old run is detached
// first, so nothing from it can pay out into the restored save.
function restoreBackup(text){
 try{
  if(String(text).length>1500000)throw Error('This save is too large.');const parsed=JSON.parse(String(text).trim());if(parsed.game!=='Doodle Onward'||parsed.journey?.version!==1)throw Error('Choose a Doodle Onward save backup.');
  clearInputs();run?.pause();memoryGame?.destroy();memoryGame=null;run=null;currentConfig=null;finishing=true;journey=new Journey(parsed.journey);persist();mapWorld=journey.state.selectedWorld;home();openPanel('passport');toast('Your road trip is ready to continue.');return true;
 }catch(err){toast(err instanceof SyntaxError?'That doesn’t look like a complete backup. Copy all of it and try again.':err.message||'We couldn’t read that save.');return false;}
}
function closePanel(){if($('panel-dialog').open){$('panel-dialog').close();audio.play('ui-close');}activePanel='';}
function goMap(){if(screen!=='home')home();closePanel();$('world-map').scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});}
async function share(){const text='Thirty little adventures, top-down treasure trails, 3D rallies, and big snack stacks. Doodle Onward with Griffin and friends!';if(navigator.share){try{await navigator.share({title:'Doodle Onward',text,url:location.origin+'/'});return;}catch(e){if(e.name==='AbortError')return;}}openPanel('share');}
function inputJump(){if(screen==='run'&&currentConfig.mode==='platform'){if(run.jump())haptics.pulse('tap');}}
function inputPower(){if(screen!=='run'||currentConfig.mode==='memory')return;gestureAudio();if(!run.power?.())toast('Collect treats to fill your power meter.');}
function inputHint(){if(screen!=='run'||currentConfig.mode!=='scout')return;if(run.hint())haptics.pulse('medium');else toast('Your three trail hints are used. Follow your nose from here.');}
function inputInteract(){if(screen!=='run')return;const worked=run.interact?.();if(!worked&&!run.interaction)callout('Get a little closer to a chest, sign, or neighbor.',1500);}
function updateMovement(){
 if(screen!=='run'||currentConfig.mode==='memory')return;const m=currentConfig.mode,k=key=>held.has(key)?1:0;
 const dx=Math.sign(k('right')-k('left')+controls.dir.x),dy=Math.sign(k('down')-k('up')+controls.dir.y);
 if(m==='scout')run.move(dx,dy);
 else if(m==='rally'){
  const drag=controls.drag,scale=(rallyRenderer?.pixelsPerUnit||40)*.6;
  if(drag&&!dx&&run.steerTo)run.steerTo(rallyStartX+drag.dx/scale);
  else{const tilt=controls.tilt?.seen?controls.tilt.value:0;run.move(dx||(drag?controls.steering:tilt)||0);}
  run.brake(k('down')>0||controls.braking);
 }
 else run.move?.(dx);
}
// A tap on the Trail Scout map walks to that tile, steps to a neighbour, or uses what is beside the buddy.
function scoutTap(x,y){
 if(run.walkTo&&renderer.scoutCellAt){const cell=renderer.scoutCellAt(x,y);if(cell)run.walkTo(cell.x,cell.y);return;}
 const l=renderer.scoutLayout;if(!l)return;const cx=Math.floor((x-l.left)/l.cell),cy=Math.floor((y-l.top)/l.cell),dx=cx-run.player.x,dy=cy-run.player.y;
 if(Math.abs(dx)+Math.abs(dy)===1)run.step?.(dx,dy);else if(Math.abs(dx)+Math.abs(dy)<=2)run.interact();
}
// The play field is the controller: see controls.js for the gestures.
const controls=new Controls({canvas:$('game'),rallyCanvas:$('rally-canvas'),on:{
 // A touch or click on the field also hands it the keyboard.
 gesture:e=>{gestureAudio();const field=e?.currentTarget;if(field?.focus&&document.activeElement!==field)field.focus({preventScroll:true});},
 direction:(x,y)=>{if(screen==='run'&&currentConfig.mode==='scout'&&(x||y))haptics.pulse('tap');updateMovement();},
 jump:inputJump,releaseJump:()=>run?.releaseJump?.(),drop:()=>{if(screen==='run'&&currentConfig.mode==='platform')run.drop?.();},
 power:inputPower,hint:inputHint,
 brake:()=>updateMovement(),steerStart:()=>{rallyStartX=run?.player?.x||0;},steer:value=>{if(value===null&&screen==='run'&&currentConfig.mode==='rally')run.steerTo?.(null);updateMovement();},
 fieldX:fraction=>{if(fraction===null||screen!=='run'||currentConfig.mode!=='snack')return;if(run.dragTo&&renderer.stormWorldX)run.dragTo(renderer.stormWorldX(fraction*renderer.width));else run.moveTo(fraction*1120);},
 tap:(x,y)=>{if(screen==='run'&&currentConfig.mode==='scout')scoutTap(x,y);}
}});
// Real buttons for keyboard, switch, and screen reader users. Hidden until focused.
// Each press nudges for a moment through the same held set the keyboard uses,
// so nothing else (a key coming up, the next frame) cancels it early.
const nudges={};
for(const [dir,x,y] of [['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]])$(`${dir}-button`).addEventListener('click',()=>{
 if(screen!=='run')return;const m=currentConfig.mode;
 if(m==='scout'){run.step?.(x,y);return;}
 if(!x&&!(m==='rally'&&y>0))return;
 held.add(dir);updateMovement();clearTimeout(nudges[dir]);nudges[dir]=setTimeout(()=>{held.delete(dir);updateMovement();},m==='rally'?(x?320:450):200);
});
$('jump-button').addEventListener('click',()=>{inputJump();setTimeout(()=>run?.releaseJump?.(),160);});$('power-button').addEventListener('click',inputPower);$('interact-button').addEventListener('click',inputInteract);$('hint-button').addEventListener('click',inputHint);
// The HUD's glowing power layer and Trail Scout's hint chip can be tapped too.
// A phone only makes a click from a lone finger, and a thumb is usually
// already steering, so touches act on the way down.
const CHIPS='[data-layer=power],#hint-chip,#pause-button';let chipTouch=-1e9;
const playField=()=>currentConfig?.mode==='rally'?$('rally-canvas'):$('game');
function chipAction(target){
 if(target.closest('#pause-button')){pause();return true;}
 if(target.closest('[data-layer=power]')){inputPower();return true;}
 if(target.closest('#hint-chip')){inputHint();return true;}
 return false;
}
$('run-ui').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'||screen!=='run'||!e.target.closest(CHIPS))return;chipTouch=performance.now();chipAction(e.target);});
$('run-ui').addEventListener('touchend',e=>{if(e.cancelable&&e.target.closest(CHIPS))e.preventDefault();},{passive:false});
$('run-ui').addEventListener('click',e=>{
 if(performance.now()-chipTouch<700||!e.target.closest(CHIPS))return;
 const pausing=!!e.target.closest('#pause-button');chipAction(e.target);
 // After a mouse click the keyboard goes back to the field, so Space still jumps.
 if(!pausing&&e.detail>0&&screen==='run'&&currentConfig?.mode!=='memory')playField().focus({preventScroll:true});
});
const keyDirection={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down'};
window.addEventListener('keydown',e=>{
 if(e.repeat&&['Escape','KeyP','KeyR'].includes(e.code))return;
 if(e.target.closest?.('input,textarea,select,[contenteditable]'))return;
 if(e.target.closest?.('button,a')&&['Enter','Space'].includes(e.code))return;
 if(e.code==='Escape'&&$('panel-dialog').open){e.preventDefault();closePanel();return;}
 if($('panel-dialog').open||e.ctrlKey||e.metaKey||e.altKey)return;
 if(['Escape','KeyP'].includes(e.code)&&screen!=='home'){e.preventDefault();if(screen==='run')pause();else if(screen==='paused')resume();return;}
 if(e.code==='KeyR'&&['result','paused'].includes(screen)){e.preventDefault();restart();return;}
 if(screen!=='run'||currentConfig.mode==='memory')return;
 if(keyDirection[e.code]||['Space','KeyX','KeyH','KeyE','Enter'].includes(e.code))e.preventDefault();
 if(keyDirection[e.code]){if(inputMode!=='keys'&&!coarsePointer.matches)setInputMode('keys');held.add(keyDirection[e.code]);updateMovement();}
 if(e.repeat)return;
 if(['Space','ArrowUp','KeyW'].includes(e.code)&&currentConfig.mode==='platform')inputJump();
 if(['ArrowDown','KeyS'].includes(e.code)&&currentConfig.mode==='platform')run.drop?.();
 if(e.code==='KeyX')inputPower();if(e.code==='KeyH')inputHint();if(e.code==='KeyE'||e.code==='Enter')inputInteract();
});
window.addEventListener('keyup',e=>{if(keyDirection[e.code])held.delete(keyDirection[e.code]);updateMovement();if(['Space','ArrowUp','KeyW'].includes(e.code)&&currentConfig?.mode==='platform')run?.releaseJump?.();});
$('play-button').addEventListener('click',()=>startRun({mode:'platform',levelId:continueLevel().id}));$('daily-button').addEventListener('click',()=>startRun(journey.getDailyChallenge()));$('home-button').addEventListener('click',()=>screen==='run'?pause():home());$('resume-button').addEventListener('click',resume);$('restart-button').addEventListener('click',()=>restart());$('quit-button').addEventListener('click',home);$('sound-button').addEventListener('click',toggleSound);$('help-button').addEventListener('click',()=>openPanel('help'));$('install-button').addEventListener('click',()=>openPanel('install'));$('share-button').addEventListener('click',share);$('close-dialog').addEventListener('click',closePanel);$('reload-button').addEventListener('click',()=>location.reload());
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;const d=b.dataset;
 if(d.panel){gestureAudio();audio.play('click');openPanel(d.panel);}
 if(d.nav==='map')goMap();
 if(d.character){journey.selectCharacter(d.character);persist();audio.play('click');renderHome();}
 if(d.world!==undefined){mapWorld=Number(d.world);if(journey.state.worlds[mapWorld].unlocked){journey.selectWorld(mapWorld);persist();renderHome();}else renderMap();}
 if(d.level)startRun({mode:'platform',levelId:d.level});
 if(d.startMode)startRun({mode:d.startMode,worldIndex:journey.state.selectedWorld});
 if(d.upgrade){const r=journey.purchaseUpgrade(d.upgrade);persist();openPanel('gear');toast(r.message);if(r.ok)audio.play('upgrade');$('wallet').textContent=num(journey.state.wallet);}
 if(d.charm){const r=journey.equipCharm(d.charm);persist();openPanel('gear');toast(r.message);audio.play('click');}
 if(d.resultAction){const a=d.resultAction;if(a==='home')home();else if(a==='map')goMap();else if(a==='retry')restart();else if(a==='remix')restart({remix:true});else if(a==='next'){startRun({mode:'platform',levelId:d.nextLevel},{fresh:false});}else openPanel(a);}
 if(b.id==='copy-link'){try{await navigator.clipboard.writeText(location.origin+'/');b.textContent='Link copied';}catch{$('share-url').select();}}
 if(b.id==='export-save'){
  // Phones save most reliably through the share sheet; everything else downloads a file.
  const text=backupText(),file=typeof File==='function'?new File([text],'doodle-onward-save.json',{type:'application/json'}):null;let shared=false;
  if(file&&inputMode==='touch'&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Doodle Onward save'});shared=true;}catch(e){shared=e.name==='AbortError';}}
  if(!shared){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='doodle-onward-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 }
 if(b.id==='copy-save'){const text=backupText();try{await navigator.clipboard.writeText(text);b.textContent='Backup copied';toast('Backup text copied. Paste it into a message or note.');}catch{$('paste-row').hidden=false;$('paste-save-text').value=text;$('paste-save-text').select();toast('Select all of this text and copy it.');}}
 if(b.id==='paste-save'){$('paste-row').hidden=false;$('paste-save-text').value='';$('paste-save-text').focus();}
 if(b.id==='restore-save')restoreBackup($('paste-save-text').value);
 if(b.id==='import-save')$('import-file').click();
 if(b.hasAttribute('data-install-now')&&deferredInstall){await deferredInstall.prompt();deferredInstall=null;closePanel();}
});
document.addEventListener('change',async e=>{
 if(e.target.dataset.pref){const key=e.target.dataset.pref;prefs[key]=e.target.checked;
  if(key==='haptics'){haptics.setEnabled(prefs.haptics);haptics.pulse('medium');}
  if(key==='tilt'){if(prefs.tilt){const ok=await controls.enableTilt();if(!ok){prefs.tilt=false;e.target.checked=false;toast('Tilt steering needs motion access. Dragging still works.');}}else controls.disableTilt();}
  savePrefs();}
 if(e.target.dataset.setting){const key=e.target.dataset.setting;journey.setSetting(key,e.target.checked);if(key==='sound'){audio.setEnabled(e.target.checked);if(e.target.checked)audio.unlock();}persist();syncSettings();}
 if(e.target.id==='import-file'){
  try{const file=e.target.files[0];if(!file)return;if(file.size>1500000)throw Error('This save is too large.');restoreBackup(await file.text());}catch(err){toast(err.message||'We couldn’t read that save.');}
 }
});
$('panel-dialog').addEventListener('click',e=>{if(e.target===$('panel-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();}});
window.addEventListener('blur',()=>{clearInputs();if(screen==='run')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='run')pause();});window.addEventListener('pagehide',()=>{saveCheckpoint();persist();});
// Turning the phone reflows the field, so take a breath instead of playing through it.
window.addEventListener('orientationchange',()=>{if(screen==='run')pause();controls.calibrateTilt();});
// iPhone only starts sound from a finished tap, so listen for those as well.
for(const name of ['pointerup','touchend','click','keydown'])window.addEventListener(name,()=>{if(journey.state.settings.sound)gestureAudio();},{passive:true,capture:true});
document.addEventListener('gesturestart',e=>{if(screen!=='home')e.preventDefault();});
// On iPhone Safari a touch that begins on the field must not start a page
// gesture (back-swipe from the left edge, where the run thumb rests, or a
// double-tap zoom). Pointer events still arrive as usual.
for(const field of [$('game'),$('rally-canvas')])for(const name of ['touchstart','touchmove'])field.addEventListener(name,e=>{if(screen==='run'&&e.cancelable)e.preventDefault();},{passive:false});
document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&inputMode!=='touch')setInputMode('touch');},{passive:true});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
function checkUpdate(){if(swRegistration?.waiting&&['home','result'].includes(screen))swRegistration.waiting.postMessage({type:'SKIP_WAITING'});}
if('serviceWorker' in navigator&&!['localhost','127.0.0.1'].includes(location.hostname)){
 navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{swRegistration=reg;checkUpdate();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',checkUpdate));}).catch(()=>{});
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading&&ready&&screen==='home'){reloading=true;location.reload();}});
}
function resizeEffects(){const r=$('arena').getBoundingClientRect();fxW=r.width;fxH=r.height;fxDpr=Math.min(2,window.devicePixelRatio||1);fxCanvas.width=Math.round(fxW*fxDpr);fxCanvas.height=Math.round(fxH*fxDpr);fxBusy=true;dirty=true;}
new ResizeObserver(()=>{resizeEffects();layoutInsets();}).observe($('arena'));
// The HUD grows when goals wrap or a row appears; the field hears about it at once.
new ResizeObserver(()=>{if(screen!=='home'){layoutInsets();dirty=true;}}).observe(document.querySelector('#run-ui .hud-top'));
let frameDt=0;
function frame(now){
 // Re-arm first: one bad frame must never stop the game.
 requestAnimationFrame(frame);
 const dt=Math.min(.05,Math.max(0,(now-(frameTime||now))/1000));frameTime=now;clock+=dt;frameDt=dt;frameCount++;
 try{step(dt);}catch(err){if(!frameFailed){frameFailed=true;console.error('Doodle Onward frame failed:',err);}}
}
function step(dt){
 if(ready){
  if(screen==='home'){if(frameCount&1||dirty){renderer.drawHome({characterId:journey.state.selectedCharacter,time:clock,theme:journey.state.selectedWorld,reducedMotion:reduced()});dirty=false;}}
  else if(run&&currentConfig){
   const mode=currentConfig.mode,view=mode==='rally'?rallyRenderer:renderer,juice=view?.juice,playing=screen==='run';if(juice)juice.reducedMotion=reduced();
   const simDt=playing?(juice?juice.step(dt):dt):0;
   if(playing){
    if(mode==='rally')updateMovement();
    run.update(simDt);controls.update(dt);updateCoach(dt);
    if(screen==='run'){
     // With no buttons on screen, chests open and signs speak when the buddy reaches them.
     if(mode==='platform'&&inputMode==='touch'){const near=run.interaction;if(near?.type==='chest')run.interact();else if(near?.type==='sign'&&near.id!==lastSign&&coachTime<=0){lastSign=near.id;callout(near.text,3400);}}
     if(run.runMode==='platform'&&run.time-lastCheckpointTime>12&&run.player.grounded){lastCheckpointTime=run.time;saveCheckpoint();}
     watchStack();
    }
   }
   // Paused and result screens hold one still frame instead of redrawing.
   const live=playing||screen==='finale';
   if(live||dirty){
    const opts={time:clock,dt:live?dt:0,simDt,reducedMotion:reduced(),insets:view?.insets};
    if(mode==='platform')renderer.drawPlatform(run,opts);else if(mode==='scout')renderer.drawScout(run,opts);else if(mode==='snack')renderer.drawStorm(run,opts);else if(mode==='rally')rallyRenderer?.draw(run,opts);
    dirty=false;
   }
   if(live)updateHud();
   if(clock-insetTime>1.5&&playing)layoutInsets();
   if(playing&&tipTime&&clock-tipTime>9){tipTime=0;$('mode-tip').parentElement.classList.add('faded');}
   if(screen==='finale'){finaleTimer-=dt;if(finaleTimer<=0)showResult();}
  }
  if(resultStep&&resultStep(dt))resultStep=null;
  const stack=run&&screen==='run'?(run.totalMultiplier||run.multiplier||1):1;
  audio.update(dt,{speed:1,combo:run?.combo||0,power:screen==='run'&&run?.powerTime>0,running:screen==='run',intensity:Math.min(1,Math.log2(stack)/Math.log2(30)),stack});
 }
 const busy=celebrations.particles?.length>0||controls.busy;
 if(busy||fxBusy){fxContext.setTransform(fxDpr,0,0,fxDpr,0,0);fxContext.clearRect(0,0,fxW,fxH);celebrations.update(dt);celebrations.draw(fxContext,fxW,fxH,{reducedMotion:reduced()});if(screen==='run')controls.draw(fxContext,{reduced:reduced()});}else celebrations.update(dt);
 fxBusy=busy;
}
// Test and tuning handle, only with ?debug in the address.
if(new URLSearchParams(location.search).has('debug'))window.__doodle={prefs,haptics,hud,controls,celebrations,get inputMode(){return inputMode;},setInputMode,get run(){return run;},get config(){return currentConfig;},get screen(){return screen;},get journey(){return journey;},renderer,get rallyRenderer(){return rallyRenderer;},get memoryGame(){return memoryGame;},audio,startRun,pause,resume,home};
setInputMode(inputMode);renderHome();syncSettings();resizeEffects();requestAnimationFrame(frame);
renderer.load().then(()=>{ready=true;renderHome();audio.setScene('menu',journey.state.selectedWorld);persist();announce('Doodle Onward is ready. Choose your adventure buddy, then explore.');}).catch(err=>{$('load-error').hidden=false;$('load-error-text').textContent='We couldn’t load the character artwork. Reconnect and try again.';console.error('Doodle Onward artwork failed to load:',err);});
