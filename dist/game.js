import {CHARACTERS,PLAYABLE_IDS,ABILITIES} from './characters.js?v=20';
import {AdventureRenderer} from './platform-renderer.js?v=20';
import {PlatformRun} from './platform-engine.js?v=20';
import {ScoutRun} from './scout-engine.js?v=20';
import {SnackStorm} from './snack-engine.js?v=20';
import {RallyRun,RallyRenderer} from './rally3d.js?v=20';
import {MemoryGame} from './memory-game.js?v=20';
import {loadJourney,saveJourney,Journey,UPGRADES,CHARMS,QUESTS,STICKERS,ACHIEVEMENTS,WORLDS,LEVELS} from './journey.js?v=20';
import {GameAudio} from './audio.js?v=20';
import {Celebrations} from './celebrations.js?v=20';

const $=id=>document.getElementById(id),num=n=>Math.round(Number(n)||0).toLocaleString(),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name,cls='')=>`<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const modeNames={platform:'Platform adventure',scout:'Trail Scout',rally:'RV Rally',snack:'Snack Storm',memory:'Camp Pairs'};
const charmSymbols=['✦','✧','◈','♧','❋','☾','☀','↟','⌘','◆','↗','✺'];
let storage;try{storage=window.localStorage;}catch{storage=null;}
let journey=loadJourney(storage),ready=false,screen='home',run=null,currentConfig=null,finishing=false,lastResult=null,lastReward=null,mapWorld=journey.state.selectedWorld,activePanel='',frameTime=0,clock=0,lastHud=-1,lastCheckpointTime=0,toastTimer,calloutTimer,deferredInstall,swRegistration,reloading=false,storageWarned=false;
const renderer=new AdventureRenderer($('game')),audio=new GameAudio({enabled:journey.state.settings.sound}),celebrations=new Celebrations();
let rallyRenderer=null,memoryGame=null;
const engines={platform:new PlatformRun({onEvent:onGameEvent}),scout:new ScoutRun({onEvent:onGameEvent}),snack:new SnackStorm({onEvent:onGameEvent}),rally:new RallyRun({onEvent:onGameEvent})};
const held=new Set(),pointerHeld=new Set(),fxCanvas=$('celebrations'),fxContext=fxCanvas.getContext('2d');
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
function clearInputs(){held.clear();pointerHeld.clear();run?.move?.(0,0);run?.brake?.(false);run?.releaseJump?.();document.querySelectorAll('.control-button.pressed').forEach(b=>b.classList.remove('pressed'));}
function setScreen(next){
 screen=next;$('app').dataset.screen=next;$('app').dataset.activity=next==='home'?'':currentConfig?.mode||'';document.body.classList.toggle('playing',next!=='home');
 $('home-screen').hidden=next!=='home';$('camp-extras').hidden=next!=='home';$('run-ui').hidden=next==='home';$('pause-layer').hidden=next!=='paused';$('result-layer').hidden=next!=='result';
 $('play-controls').hidden=next==='home'||next==='result'||currentConfig?.mode==='memory';
 $('rally-canvas').hidden=next==='home'||currentConfig?.mode!=='rally';$('memory-board').hidden=next==='home'||currentConfig?.mode!=='memory';$('game').hidden=next!=='home'&&['rally','memory'].includes(currentConfig?.mode);
 $('arena').dataset.mode=next==='home'?'home':currentConfig?.mode||'platform';$('below-game').hidden=next!=='home';
 if(next!=='run')clearInputs();renderer.resize();rallyRenderer?.resize();resizeEffects();
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
 currentConfig=config;finishing=false;lastResult=null;lastReward=null;lastHud=-1;lastCheckpointTime=0;renderer.resetCamera();renderer.particles=[];renderer.labels=[];renderer.juice.clear();rallyRenderer?.juice?.clear();celebrations.clear();clearTimeout(calloutTimer);$('run-callout').classList.remove('visible');$('run-callout').textContent='';
 if(config.mode==='memory'){
  memoryGame?.destroy();memoryGame=new MemoryGame($('memory-board'),{onEvent:onGameEvent,onFinish:finishGame});run=memoryGame;run.reset(config);
 }else {run=engines[config.mode];run.reset(config);}
 // Restored journeys keep the buddy and equipment that began that outing.
 config.characterId=run.characterId||config.characterId;if(run.gear)config.gear={...run.gear};
 // Snack Storm uses the original common gear contract; attach journey context.
 if(config.mode==='snack'){run.worldIndex=config.worldIndex;run.stage=config.worldIndex;run.dailyDate=config.dailyDate||'';}
 if(config.mode==='rally'&&!rallyRenderer)rallyRenderer=new RallyRenderer($('rally-canvas'));
 setScreen('run');configureControls();audio.setScene('run',config.worldIndex);frameTime=performance.now();window.scrollTo({top:0,behavior:'instant'});updateHud(true);
 if(config.mode==='memory')memoryGame.focus();else (config.mode==='rally'?$('rally-canvas'):$('game')).focus({preventScroll:true});
 if(config.checkpoint)callout('Right where you left your pawprints.');
 else if(config.mode!=='memory')callout({platform:'Two keys. Three golden snacks. One great adventure.',scout:'Find 3 treasures, a key, and a parcel for your neighbor.',rally:'Follow the snacks. Steer clear. Boost when you’re ready.',snack:'Catch treats. Dodge mud. Stack the good stuff!',memory:'Find the pairs. Keep the streak.'}[config.mode],3000);
 announce(`${modeNames[config.mode]} in ${WORLDS[config.worldIndex].name}.`);
}
function saveCheckpoint(){if(run?.runMode==='platform'&&!currentConfig?.dailyDate&&!currentConfig?.remix&&['running','paused'].includes(run.mode)&&run.time>1){journey.saveCheckpoint(run.levelId,run.snapshot());persist();}}
function pause(){if(screen!=='run')return;run.pause();saveCheckpoint();audio.suspend();setScreen('paused');renderer.portrait($('pause-portrait'),run.characterId||currentConfig.characterId);$('pause-detail').textContent=currentConfig.mode==='platform'?'Your position and discoveries are saved. Ready when you are.':'The clock has stopped. Take all the time you need.';$('resume-button').focus({preventScroll:true});announce('Adventure paused.');}
function resume(){if(screen!=='paused')return;gestureAudio();run.resume();setScreen('run');configureControls();frameTime=performance.now();audio.setScene('run',currentConfig.worldIndex);if(currentConfig.mode==='memory')memoryGame.focus();else (currentConfig.mode==='rally'?$('rally-canvas'):$('game')).focus({preventScroll:true});}
function restart({remix=false}={}){if(!currentConfig)return;const c={...currentConfig,seed:remix?undefined:currentConfig.seed,remix:remix||currentConfig.remix};startRun(c,{fresh:true});}
function home(){
 closePanel();if(run&&['run','paused'].includes(screen)&&!finishing){run.pause();if(currentConfig.mode==='platform')saveCheckpoint();else if(run.time>2||run.score>0){const summary=enrichResult(run.result());summary.won=false;journey.completeRun(summary);persist();}}
 memoryGame?.pause();clearTimeout(calloutTimer);$('run-callout').classList.remove('visible');$('run-callout').textContent='';setScreen('home');mapWorld=journey.state.selectedWorld;audio.setScene('menu',mapWorld);renderHome();checkUpdate();$('play-button').focus({preventScroll:true});
}
function enrichResult(summary){return {...summary,mode:currentConfig.mode,worldIndex:currentConfig.worldIndex,characterId:summary.characterId||currentConfig.characterId,seed:currentConfig.seed,dailyDate:currentConfig.dailyDate||'',levelId:currentConfig.levelId||summary.levelId};}
function finishGame(summary){
 if(finishing||!run||!currentConfig||screen==='home')return;finishing=true;lastResult=enrichResult(summary?.runId?summary:run.result());lastReward=journey.completeRun(lastResult);
 if(lastResult.mode==='platform'&&!currentConfig.dailyDate&&!currentConfig.remix)journey.clearCheckpoint(lastResult.levelId);persist();setScreen('result');renderResult();audio.setScene('result',currentConfig.worldIndex);audio.play(lastResult.won?'finish':'lost');
 if(lastResult.won)celebrations.burst({x:.5,y:.24,kind:lastReward.newBest?'record':'win'});
 if(lastReward.questRewards.length){audio.play('mission');celebrations.burst({x:.3,y:.45,kind:'star'});}announce(`${lastResult.won?'Adventure complete':'Good try'}. ${num(lastResult.score)} points and ${lastReward.earnedTreats} treats earned.`);
 $('result-content').querySelector('.primary')?.focus({preventScroll:true});
}
function renderResult(){
 const r=lastResult,p=lastReward,platform=r.mode==='platform',next=platform&&r.won?LEVELS.find(l=>l.worldIndex===r.worldIndex&&journey.state.levels[l.id].unlocked&&!journey.state.levels[l.id].completed):null;
 const title=r.won?({platform:'Pawsitively onward!',scout:'A nose for adventure.',rally:'What a lovely detour.',snack:'A very snacky forecast.',memory:'A perfect little match.'}[r.mode]):r.mode==='memory'?'One more little flip?':'Good paws. Fresh start.';
 const rewards=[...(p.unlockedWorlds||[]).map(w=>`${w.name} is open!`),...(p.unlockedCharms||[]).map(c=>`${c.name} earned.`),...(p.questRewards||[]).map(q=>`${q.name}: +${q.reward} treats.`),...(p.dailyBonus?[`Daily bonus: +${p.dailyBonus} treats.`]:[])];
 const medals=platform?`<div class="result-medals">${[1,2,3].map(n=>icon('star',n<=p.medals?'earned':'')).join('')}</div>`:`<div class="result-medals">${icon(r.won?'trophy':'paw','earned')}</div>`;
 $('result-content').innerHTML=`${medals}${p.newBest?'<span class="result-record">A NEW PERSONAL BEST</span>':''}<span class="eyebrow">${esc(WORLDS[r.worldIndex].name)} · ${esc(modeNames[r.mode])}</span><h2>${title}</h2><p class="result-line">${r.won?platform?`${esc(level(r.levelId).title)} is in the passport. There’s always another little path to explore.`:'Every little detour brings something good back to camp.':`The treats you found are safely in your backpack. ${r.mode==='platform'?'Try another route, change your charms, or have a quick mini-game break.':'Your next attempt is a fresh chance to find your rhythm.'}`}</p><div class="result-stats"><div><strong>${num(r.score)}</strong><span>POINTS</span></div><div><strong>${num(r.treats)}</strong><span>TREATS FOUND</span></div><div><strong>${r.bestMultiplier||1}×</strong><span>BIGGEST STACK</span></div></div>${platform?`<div class="result-goals">${p.medalGoals.map(g=>`<span class="${g.earned?'done':''}">${g.earned?'✓ ':''}${esc(g.label)}</span>`).join('')}</div>`:''}<p class="reward-line">+${num(p.earnedTreats)} treats in your backpack${p.newMedals?` · +${p.newMedals} new medals`:''}</p>${rewards.length?`<p class="result-unlocks">${rewards.slice(0,4).map(esc).join('<br>')}</p>`:''}<button class="primary" data-result-action="${next?'next':'retry'}" ${next?`data-next-level="${next.id}"`:''}>${next?'The next little adventure':'Let’s do it again'} ${icon('arrow')}</button><div class="button-pair"><button class="secondary" data-result-action="${platform&&!currentConfig.dailyDate?'remix':'gear'}">${platform&&!currentConfig.dailyDate?'Remix this trail':'Visit the backpack'}</button><button class="secondary" data-result-action="home">Back to camp</button></div><div class="result-foot"><button class="text-button" data-result-action="quests">Check the quest board</button><button class="text-button" data-result-action="map">Explore the worlds</button></div>`;
}
function onGameEvent(e){
 if(!run||finishing)return;
 const mode=currentConfig?.mode;
 if(mode==='platform')renderer.addAdventureEvent(e,run);else if(mode==='snack')renderer.addEvent(e,run);else if(mode==='scout')renderer.addScoutEvent?.(e,run);else if(mode==='rally')rallyRenderer?.addEvent?.(e,run);
 const soundAlias={stomp:'spring',block:'collect',key:'unlock',chest:'unlock',secret:'mission',checkpoint:'unlock',fever:'combo','boss-defeated':'finish',pair:'collect',match:'collect',mismatch:'hit',dodge:'near-miss'};
 if(!['start','pause','resume','prompt','land','step','hint','won','lost','dialog','locked','restore'].includes(e.type))audio.play(soundAlias[e.type]||e.type,{...e,gold:e.kind==='gold'});
 if(e.type==='won'||e.type==='lost'){finishGame(e.result||run.result());return;}
 const text={charged:currentConfig?.mode==='rally'?'BOOST READY! Press X.':`${ABILITIES[currentConfig?.characterId||'griffin'].name.toUpperCase()} READY!`,power:currentConfig?.mode==='rally'?'GOOD ROAD. BIG BOOST.':ABILITIES[currentConfig?.characterId||'griffin'].name.toUpperCase(),fever:'SNACK FRENZY · DOUBLE POINTS!',checkpoint:'Checkpoint saved. Take the scenic route.',secret:'A secret snack stash!','boss-defeated':'Snack dispute settled. Onward!','gold-rush':'GOLD RUSH · KEEP THE STACK GOING!','treasure':'Another treasure for the passport.','deliver':'Special delivery. Good neighbor energy.','parcel':'The picnic bundle! Bring it to your neighbor.'}[e.type];
 if(text)callout(text,e.type==='checkpoint'?1800:2200);
 if(['dialog','locked','hint'].includes(e.type))callout(e.text||e.message||'Follow the glowing path.',3300);
 if(e.type==='hit'&&run.hearts===1)callout(`${CHARACTERS[currentConfig.characterId].name} believes in one more try.`,2000);
 if(e.type==='checkpoint')saveCheckpoint();
 if(['power','secret','gold-rush'].includes(e.type))celebrations.burst({x:.5,y:.45,kind:e.type==='power'?'power':'stack'});
 if((e.totalMultiplier||run.totalMultiplier||1)>=10&&e.type==='combo')celebrations.burst({x:.55,y:.27,kind:'stack'});
}
function configureControls(){
 const m=currentConfig.mode,scout=m==='scout';$('up-button').hidden=!scout;$('down-button').hidden=!['scout','rally'].includes(m);$('jump-button').hidden=m!=='platform';$('interact-button').hidden=!['platform','scout'].includes(m);$('power-button').hidden=m==='memory';$('hint-button').hidden=!scout;$('play-controls').dataset.mode=m;$('play-controls').querySelector('.dpad').classList.toggle('scout-dpad',scout);
 $('power-label').textContent=m==='rally'?'BOOST':ABILITIES[currentConfig.characterId].name.toUpperCase();$('power-button').setAttribute('aria-label',m==='rally'?'Use boost when charged':`Use ${ABILITIES[currentConfig.characterId].name}`);$('interact-label').textContent='OPEN';
 $('down-button').setAttribute('aria-label',scout?'Move down':'Brake');$('interact-button').setAttribute('aria-label','Interact with a nearby chest, sign, neighbor, or exit');
}
function updateHud(force=false){
 if(!run||screen==='home'||(!force&&clock-lastHud<.09))return;lastHud=clock;const m=currentConfig.mode,w=WORLDS[currentConfig.worldIndex];
 $('wallet').textContent=num(journey.state.wallet);$('run-region').textContent=m==='platform'?`${currentConfig.worldIndex+1}-${level(currentConfig.levelId).index+1} · ${level(currentConfig.levelId).title}`:`${modeNames[m]} · ${w.name}`;
 $('score').textContent=num(run.score);$('combo').textContent=run.combo>0?`${num(run.combo)} ${m==='memory'?'PAIR':'SNACK'} CHAIN`:'LET’S FIND THE GOOD STUFF';
 if(Number.isFinite(run.hearts)){$('hearts').innerHTML=Array.from({length:run.maxHearts||3},(_,i)=>icon('heart',i<run.hearts?'':'empty')).join('');$('hearts').setAttribute('aria-label',`${run.hearts} of ${run.maxHearts} hearts`);}else{$('hearts').innerHTML='';$('hearts').setAttribute('aria-label','');}
 const chip=(text,done=false,symbol)=>`<span class="objective-chip ${done?'done':''}">${symbol?icon(symbol):''}${text}</span>`;
 let progress=0,tip='',objectives='';
 if(m==='platform'){progress=run.farthest/(run.width-175);objectives=chip(`${run.keys}/${run.requiredKeys} keys`,run.keys>=run.requiredKeys)+chip(`${run.gold}/3 golden`,run.gold>=3,'star')+chip(`${run.secrets} secret${run.secrets===1?'':'s'}`,run.secrets>0);tip=run.interaction?`${run.interaction.text} · E / OPEN`:'← → move · Space jump twice · X power · E open';$('interact-label').textContent=run.interaction?.type==='sign'?'READ':run.interaction?.type==='goal'?'ONWARD':'OPEN';}
 else if(m==='scout'){progress=((run.treasures||0)+(run.hasKey||run.keys?1:0)+(run.deliveryDone?1:0))/5;objectives=chip(`${run.treasures||0}/3 treasures`,run.treasures>=3,'star')+chip(run.hasKey||run.keys?'Key found':'Find the key',!!(run.hasKey||run.keys))+chip(run.deliveryDone?'Parcel delivered':run.parcel?'Return the parcel':'Find the parcel',run.deliveryDone);tip=run.interaction?.text||'Move in four directions. Open chests, meet your neighbor, then return to the RV.';$('interact-label').textContent=run.interaction?.type==='npc'?'TALK':run.interaction?.type==='exit'?'FINISH':'OPEN';}
 else if(m==='memory'){progress=(run.pairs||0)/(run.totalPairs||1);objectives=chip(`${run.pairs||0}/${run.totalPairs||0} pairs`)+chip(`${run.mistakes||0} misses`,run.mistakes===0);tip='Match consecutive pairs to multiply your points.';}
 else{progress=run.time/(run.timeLimit||60);objectives=chip(`${Math.max(0,Math.ceil(run.timeLimit-run.time))}s left`)+chip(`${run.treats} treats`)+(m==='rally'?chip(`${num(run.distance)}m`):chip(`${run.gold} golden`,run.gold>0,'star'));tip=m==='rally'?'← → steer · ↓ brake · X boost · Follow the snack line.':'← → move, or drag Griffin · X power · Gold and frenzy multiply together.';}
 $('run-objectives').innerHTML=objectives;$('mode-tip').textContent=tip;$('progress-fill').style.width=`${clamp(progress,0,1)*100}%`;$('progress-text').textContent=m==='memory'?`${run.pairs||0}/${run.totalPairs||0}`:m==='scout'?`${Math.round(progress*100)}%`:`${Math.round(clamp(progress,0,1)*100)}%`;
 const total=run.totalMultiplier||run.multiplier||1,layers=[];
 if(run.multiplier>1)layers.push(`<span class="stack-layer">${run.multiplier}× chain</span>`);
 if(run.feverTime>0)layers.push(`<span class="stack-layer frenzy">2× frenzy · ${Math.ceil(run.feverTime)}s</span>`);
 if(run.goldRushTime>0)layers.push(`<span class="stack-layer gold">2× gold · ${Math.ceil(run.goldRushTime)}s</span>`);
 if(run.powerTime>0&&currentConfig.characterId==='griffin')layers.push('<span class="stack-layer power">1.5× zoomies</span>');
 $('bonus-stack').innerHTML=total>1?`${layers.join('')}<strong>${Number(total.toFixed(1))}×</strong>`:'';
 const isScout=m==='scout',charge=run.charge||0;$('power-fill').style.width=`${clamp(charge,0,100)}%`;$('power-button').classList.toggle('ready',charge>=100||run.powerTime>0);
 if(isScout){$('hint-label').textContent=`HINT · ${run.hintsRemaining??3}`;$('hint-button').disabled=run.hintsRemaining<=0;}
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
  html=`<p class="panel-intro">Every outing leaves a little story. Chase all 90 medals, complete the family’s favors, and keep the best bonus stacks coming. Your progress stays on this browser.</p><div class="records-grid">${[[`${completed}/30`,'TRAILS CLEARED'],[`${totalMedals()}/90`,'SHINY MEDALS'],[`${questCount}/20`,'FAMILY FAVORS'],[`${s.counters.bestMultiplier}×`,'BIGGEST STACK'],...Object.entries(modeNames).map(([m,n])=>[num(s.records[m].score),`${n.toUpperCase()} BEST`]),[num(s.counters.treats),'TREATS FOUND'],[num(s.counters.secrets),'SECRETS REVEALED'],[num(s.counters.runs),'FAMILY OUTINGS']].map(([v,l])=>`<div class="record-card"><strong>${v}</strong><span>${l}</span></div>`).join('')}</div><h3 class="panel-heading">Stickers from the road</h3><div class="sticker-grid">${STICKERS.map(st=>`<div class="sticker ${s.passport.stickers.includes(st.id)?'earned':''}" title="${esc(st.description)}"><span aria-hidden="true">${st.kind==='world'?'✦':st.kind==='crew'?'♧':({platform:'↟',scout:'✧',rally:'▰',snack:'❋',memory:'◈'}[st.mode])}</span><strong>${esc(st.name)}</strong></div>`).join('')}</div><h3 class="panel-heading">The whole crew</h3><div class="family-records">${PLAYABLE_IDS.map(id=>`<div><canvas data-portrait="${id}" width="150" height="150" aria-hidden="true"></canvas><strong>${CHARACTERS[id].name}</strong><span>${num(s.counters.characters[id].runs)} outings</span></div>`).join('')}</div><p class="record-note">Kevin, our forever guide. Always part of the family, and along for every mile.</p><h3 class="panel-heading">Little legends</h3><div class="quest-grid">${ACHIEVEMENTS.map(a=>`<article class="quest-card ${s.passport.achievements.includes(a.id)?'completed':''}"><small>${s.passport.achievements.includes(a.id)?'✓ ACHIEVEMENT EARNED':'A LITTLE SOMETHING TO AIM FOR'}</small><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p></article>`).join('')}</div><h3 class="panel-heading">Bring your progress along.</h3><p class="panel-intro">Download a backup before changing browsers or devices. Import it here to continue the trip. Importing replaces the progress on this device.</p><div class="export-row"><button class="secondary" id="export-save">Download save backup</button><button class="secondary" id="import-save">Import save backup</button><input id="import-file" type="file" accept="application/json,.json" hidden></div>${s.migration.imported?'<p class="record-note">Your previous adventure’s treats, upgrades, selected buddy, and settings have been carried into this trip.</p>':''}`;
 }else if(panel==='help'){
  title='A little guide to a big trip.';html=`<p class="panel-intro">Thirty trails, five worlds, and plenty of detours. Take one chapter a day or follow your curiosity. All four adventure buddies and all the mini-games are ready from the beginning.</p><div class="instructions"><div class="instruction"><h3>Run. Jump. Explore.</h3><p><kbd>← →</kbd> or <kbd>A D</kbd> move freely. <kbd>Space</kbd>, <kbd>↑</kbd>, or <kbd>W</kbd> jumps. Hold for height; press again for a double jump. Bounce on the snack bandits, hit blocks from below, and use <kbd>E</kbd> to open chests. Two high-path keys open the RV goal. Checkpoints restore a heart and save your place.</p></div><div class="instruction"><h3>Follow your nose.</h3><p>Trail Scout is a top-down treasure adventure. Move in four directions with the arrow keys, <kbd>W A S D</kbd>, or the touch pad. Press <kbd>E</kbd> beside a chest or neighbor. Find three treasures, a key, and the parcel; deliver it before returning to the RV. <kbd>H</kbd> shows a trail hint; <kbd>X</kbd> uses your character’s power. There is no countdown.</p></div><div class="instruction"><h3>Take the wheel.</h3><p>RV Rally is a 60-second 3D driving challenge. Use <kbd>← →</kbd> or <kbd>A D</kbd> to steer. Hold <kbd>↓</kbd> or <kbd>S</kbd> to brake. Collect snacks along the safe route, avoid cones and crates, and use <kbd>X</kbd> to boost when charged.</p></div><div class="instruction"><h3>A quick camp break.</h3><p>Catch falling treats for 45 seconds in Snack Storm. Move with arrows, touch buttons, or a drag across the field. In Camp Pairs, flip cards to find matches. Consecutive matches multiply your points. Both modes earn treats and quest progress.</p></div></div><h3 class="panel-heading">Stack the good stuff.</h3><div class="stack-example"><span>5× chain</span><b>×</b><span>2× frenzy</span><b>×</b><span>2× Gold Rush</span><b>×</b><span>1.5× Griffin power</span><strong>30× points</strong></div><p class="panel-intro">Collect treats in a row to build a chain. Gold extends your double-point rush. Long chains start a frenzy. Stack Griffin’s power on top, then equip charms to keep the good things going longer.</p><div class="instructions">${PLAYABLE_IDS.map(id=>`<div class="instruction"><h3>${CHARACTERS[id].name}</h3><p><strong>${ABILITIES[id].name}</strong><br>${esc(ABILITIES[id].detail)}</p></div>`).join('')}</div><div class="settings">${[['sound','Music & sound','Original road-trip tunes and satisfying snack chimes.'],['assist','Easygoing mode','Extra hearts and a gentler pace. Applies on your next outing.'],['reducedMotion','Reduced motion','Steady scenery, quieter effects, and fewer moving decorations.']].map(([id,title,desc])=>`<label class="setting"><span><strong>${title}</strong><small>${desc}</small></span><input type="checkbox" data-setting="${id}" ${s.settings[id]?'checked':''}></label>`).join('')}</div><p class="key-help"><kbd>P</kbd> or <kbd>Esc</kbd> pauses. Progress in platform levels saves when you pause, reach a checkpoint, or return to camp. Complete any four different trails to open the next world. Three medals per level: finish, collect all three gold, and finish without a hit or within the target time. A remix reshuffles the platform route for a fresh challenge.</p>`;
 }else if(panel==='install'){
  title='Ready for the road.';html=`<img class="install-image" src="/assets/griffin-icon.png?v=20" alt="Griffin, your adventure buddy"><p class="panel-intro">Add Doodle Onward to your Home Screen for a full-screen adventure. Let the game finish loading while you’re connected, then the game and every activity can reopen offline.</p>${deferredInstall?'<button class="primary" data-install-now>Install Doodle Onward</button>':'<ol class="install-steps"><li>On iPhone or iPad, open this page in Safari.</li><li>Tap Share, then <strong>Add to Home Screen</strong>.</li><li>On Android or desktop, use your browser’s <strong>Install app</strong> option.</li></ol>'}<p class="record-note">Your save belongs to this browser and device. Download a backup from the passport before moving to a new device. After installing, open the game once and try an adventure before traveling offline.</p><div class="export-row"><button class="secondary" data-panel="passport">Open your passport</button></div>`;
 }else if(panel==='share'){
  title='Invite a fellow adventurer.';html=`<p class="panel-intro">One good dog, the whole crew, and a road full of little adventures.</p><input class="share-url" id="share-url" readonly value="${esc(location.origin+'/')}" aria-label="Game link"><div class="export-row"><button class="secondary" id="copy-link">Copy game link</button></div>`;
 }
 $('panel-title').textContent=title;$('panel-content').innerHTML=html;if(!$('panel-dialog').open)$('panel-dialog').showModal();paintPortraits();
}
function closePanel(){if($('panel-dialog').open)$('panel-dialog').close();activePanel='';}
function goMap(){if(screen!=='home')home();closePanel();$('world-map').scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});}
async function share(){const text='Thirty little adventures, top-down treasure trails, 3D rallies, and big snack stacks. Doodle Onward with Griffin and friends!';if(navigator.share){try{await navigator.share({title:'Doodle Onward',text,url:location.origin+'/'});return;}catch(e){if(e.name==='AbortError')return;}}openPanel('share');}
function inputJump(){if(screen==='run'&&currentConfig.mode==='platform')run.jump();}
function inputPower(){if(screen!=='run')return;gestureAudio();if(!run.power?.())toast('Collect treats to fill your power meter.');}
function inputHint(){if(screen==='run'&&currentConfig.mode==='scout'&&!run.hint())toast('Your three trail hints are used. Follow your nose from here.');}
function inputInteract(){if(screen!=='run')return;const worked=run.interact?.();if(!worked&&!run.interaction)callout('Get a little closer to a chest, sign, or neighbor.',1500);}
function updateMovement(){if(screen!=='run'||currentConfig.mode==='memory')return;const pressed=key=>held.has(key)||pointerHeld.has(key),dx=(pressed('right')?1:0)-(pressed('left')?1:0),dy=(pressed('down')?1:0)-(pressed('up')?1:0);if(currentConfig.mode==='scout')run.move(dx,dy);else run.move?.(dx);if(currentConfig.mode==='rally')run.brake(dy>0);}
function pointerButton(id,down,up){const button=$(id);button.addEventListener('pointerdown',e=>{e.preventDefault();gestureAudio();button.setPointerCapture(e.pointerId);button.classList.add('pressed');down();});const release=()=>{button.classList.remove('pressed');up?.();};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);button.addEventListener('click',e=>{if(e.detail===0){down();setTimeout(release,120);}});}
for(const dir of ['left','right','up','down'])pointerButton(`${dir}-button`,()=>{pointerHeld.add(dir);updateMovement();},()=>{pointerHeld.delete(dir);updateMovement();});
pointerButton('jump-button',inputJump,()=>run?.releaseJump?.());pointerButton('power-button',inputPower);pointerButton('hint-button',inputHint);pointerButton('interact-button',inputInteract);
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
 if(keyDirection[e.code]){held.add(keyDirection[e.code]);updateMovement();}
 if(e.repeat)return;
 if(['Space','ArrowUp','KeyW'].includes(e.code)&&currentConfig.mode==='platform')inputJump();
 if(['ArrowDown','KeyS'].includes(e.code)&&currentConfig.mode==='platform')run.drop?.();
 if(e.code==='KeyX')inputPower();if(e.code==='KeyH')inputHint();if(e.code==='KeyE'||e.code==='Enter')inputInteract();
});
window.addEventListener('keyup',e=>{if(keyDirection[e.code])held.delete(keyDirection[e.code]);updateMovement();if(['Space','ArrowUp','KeyW'].includes(e.code)&&currentConfig?.mode==='platform')run?.releaseJump?.();});
let canvasPointer=false;
$('game').addEventListener('pointerdown',e=>{if(screen!=='run')return;e.preventDefault();gestureAudio();$('game').setPointerCapture(e.pointerId);canvasPointer=true;if(currentConfig.mode==='platform')inputJump();else if(currentConfig.mode==='snack'){const rect=$('game').getBoundingClientRect();run.moveTo((e.clientX-rect.left)/rect.width*1120);}else if(currentConfig.mode==='scout'){const l=renderer.scoutLayout,r=$('game').getBoundingClientRect();if(l){const x=Math.floor((e.clientX-r.left-l.left)/l.cell),y=Math.floor((e.clientY-r.top-l.top)/l.cell),dx=x-run.player.x,dy=y-run.player.y;if(Math.abs(dx)+Math.abs(dy)===1)run.step?.(dx,dy);else if(Math.abs(dx)+Math.abs(dy)<=2)run.interact();}}});
$('game').addEventListener('pointermove',e=>{if(canvasPointer&&screen==='run'&&currentConfig.mode==='snack'){const r=$('game').getBoundingClientRect();run.moveTo((e.clientX-r.left)/r.width*1120);}});
for(const name of ['pointerup','pointercancel'])$('game').addEventListener(name,()=>{canvasPointer=false;if(currentConfig?.mode==='platform')run?.releaseJump?.();});
$('play-button').addEventListener('click',()=>startRun({mode:'platform',levelId:continueLevel().id}));$('daily-button').addEventListener('click',()=>startRun(journey.getDailyChallenge()));$('home-button').addEventListener('click',home);$('pause-button').addEventListener('click',pause);$('resume-button').addEventListener('click',resume);$('restart-button').addEventListener('click',()=>restart());$('quit-button').addEventListener('click',home);$('sound-button').addEventListener('click',toggleSound);$('help-button').addEventListener('click',()=>openPanel('help'));$('install-button').addEventListener('click',()=>openPanel('install'));$('share-button').addEventListener('click',share);$('close-dialog').addEventListener('click',closePanel);$('reload-button').addEventListener('click',()=>location.reload());
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
 if(b.id==='export-save'){const blob=new Blob([JSON.stringify({game:'Doodle Onward',exportedAt:new Date().toISOString(),journey:journey.serialize()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='doodle-onward-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
 if(b.id==='import-save')$('import-file').click();
 if(b.hasAttribute('data-install-now')&&deferredInstall){await deferredInstall.prompt();deferredInstall=null;closePanel();}
});
document.addEventListener('change',async e=>{
 if(e.target.dataset.setting){const key=e.target.dataset.setting;journey.setSetting(key,e.target.checked);if(key==='sound'){audio.setEnabled(e.target.checked);if(e.target.checked)audio.unlock();}persist();syncSettings();}
 if(e.target.id==='import-file'){
  try{const file=e.target.files[0];if(!file)return;if(file.size>1500000)throw Error('This save is too large.');const parsed=JSON.parse(await file.text());if(parsed.game!=='Doodle Onward'||parsed.journey?.version!==1)throw Error('Choose a Doodle Onward save backup.');clearInputs();run?.pause();memoryGame?.destroy();memoryGame=null;run=null;currentConfig=null;finishing=true;journey=new Journey(parsed.journey);persist();mapWorld=journey.state.selectedWorld;home();openPanel('passport');toast('Your road trip is ready to continue.');}catch(err){toast(err.message||'We couldn’t read that save.');}
 }
});
$('panel-dialog').addEventListener('click',e=>{if(e.target===$('panel-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();}});
window.addEventListener('blur',()=>{clearInputs();if(screen==='run')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&screen==='run')pause();});window.addEventListener('pagehide',()=>{saveCheckpoint();persist();});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
function checkUpdate(){if(swRegistration?.waiting&&['home','result'].includes(screen))swRegistration.waiting.postMessage({type:'SKIP_WAITING'});}
if('serviceWorker' in navigator&&!['localhost','127.0.0.1'].includes(location.hostname)){
 navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>{swRegistration=reg;checkUpdate();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',checkUpdate));}).catch(()=>{});
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading&&ready&&screen==='home'){reloading=true;location.reload();}});
}
function resizeEffects(){const r=$('arena').getBoundingClientRect();fxW=r.width;fxH=r.height;fxDpr=Math.min(2,window.devicePixelRatio||1);fxCanvas.width=Math.round(fxW*fxDpr);fxCanvas.height=Math.round(fxH*fxDpr);}
new ResizeObserver(resizeEffects).observe($('arena'));
function frame(now){
 const dt=Math.min(.05,Math.max(0,(now-(frameTime||now))/1000));frameTime=now;clock+=dt;
 if(ready){
  if(screen==='home')renderer.drawHome({characterId:journey.state.selectedCharacter,time:clock,theme:journey.state.selectedWorld,reducedMotion:reduced()});
  else if(run){
   const view=currentConfig.mode==='rally'?rallyRenderer:renderer,juice=view?.juice;if(juice)juice.reducedMotion=reduced();
   const simDt=screen==='run'?(juice?juice.step(dt):dt):0;
   if(screen==='run'){run.update(simDt);if(screen==='run'&&run.runMode==='platform'&&run.time-lastCheckpointTime>10){lastCheckpointTime=run.time;saveCheckpoint();}}
   const opts={time:clock,dt:screen==='run'?dt:0,simDt,reducedMotion:reduced(),insets:view?.insets};
   if(currentConfig.mode==='platform')renderer.drawPlatform(run,opts);else if(currentConfig.mode==='scout')renderer.drawScout(run,opts);else if(currentConfig.mode==='snack')renderer.drawStorm(run,opts);else if(currentConfig.mode==='rally')rallyRenderer?.draw(run,opts);
   updateHud();
  }
  audio.update(dt,{speed:1,combo:run?.combo||0,power:screen==='run'&&run?.powerTime>0,running:screen==='run'});
 }
 fxContext.setTransform(fxDpr,0,0,fxDpr,0,0);fxContext.clearRect(0,0,fxW,fxH);celebrations.update(dt);celebrations.draw(fxContext,fxW,fxH,{reducedMotion:reduced()});requestAnimationFrame(frame);
}
// Test and tuning handle, only with ?debug in the address.
if(new URLSearchParams(location.search).has('debug'))window.__doodle={get run(){return run;},get config(){return currentConfig;},get screen(){return screen;},get journey(){return journey;},renderer,get rallyRenderer(){return rallyRenderer;},get memoryGame(){return memoryGame;},audio,startRun,pause,resume,home};
renderHome();syncSettings();resizeEffects();requestAnimationFrame(frame);
renderer.load().then(()=>{ready=true;renderHome();audio.setScene('menu',journey.state.selectedWorld);persist();announce('Doodle Onward is ready. Choose your adventure buddy, then explore.');}).catch(err=>{$('load-error').hidden=false;$('load-error-text').textContent='We couldn’t load the character artwork. Reconnect and try again.';console.error('Doodle Onward artwork failed to load:',err);});
