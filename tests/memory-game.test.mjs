import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryGame } from '../dist/memory-game.js';

function advance(game,seconds){for(let elapsed=0;elapsed<seconds-1e-8;elapsed+=.1)game.update(Math.min(.1,seconds-elapsed));}
function game(options={}){const instance=new MemoryGame(null,options);instance.reset({seed:831});advance(instance,2);return instance;}
function pairIndices(instance,key){return instance.cards.flatMap((card,index)=>card.key===key?[index]:[]);}
function match(instance,key){const pair=pairIndices(instance,key);assert.equal(instance.flip(pair[0]),true);assert.equal(instance.flip(pair[1]),true);advance(instance,.4);}

test('seeded boards have exactly two of each symbol at the three intended sizes',()=>{
  for(let worldIndex=0;worldIndex<5;worldIndex++){
    const a=new MemoryGame(null).reset({worldIndex,seed:54321}),b=new MemoryGame(null).reset({worldIndex,seed:54321});
    assert.equal(a.totalPairs,[6,8,8,10,10][worldIndex]);assert.equal(a.cards.length,a.totalPairs*2);assert.deepEqual(a.cards,b.cards);
    const counts=new Map();for(const card of a.cards)counts.set(card.key,(counts.get(card.key)||0)+1);
    assert.ok([...counts.values()].every(count=>count===2));assert.notEqual(a.runId,b.runId);
  }
  const a=new MemoryGame(null).reset({seed:1}),b=new MemoryGame(null).reset({seed:2});assert.notDeepEqual(a.cards,b.cards);
});

test('reveal and mismatch use simulation time, block a third card, and freeze while paused',()=>{
  const g=new MemoryGame(null).reset();assert.equal(g.flip(0),false);advance(g,2);
  const other=g.cards.findIndex(card=>card.key!==g.cards[0].key);assert.equal(g.flip(0),true);assert.equal(g.flip(0),false);assert.equal(g.flip(other),true);
  assert.equal(g.flip((other+1)%g.cards.length),false);assert.equal(g.peek(),false);
  g.pause();const paused=g.result();advance(g,4);assert.deepEqual(g.result(),paused);assert.equal(g.cards[0].faceUp,true);
  g.resume();advance(g,.8);assert.equal(g.mistakes,1);assert.equal(g.combo,0);assert.equal(g.cards[0].faceUp,false);assert.equal(g.cards[other].faceUp,false);
});

test('matches award real streak bonuses, with perfect-pair credit only before a mistake involving that symbol',()=>{
  const events=[],g=game({onEvent:e=>events.push(e)}),keys=[...new Set(g.cards.map(c=>c.key))];
  match(g,keys[0]);assert.equal(g.score,60);assert.equal(g.treats,3);assert.equal(g.perfects,1);
  match(g,keys[1]);match(g,keys[2]);assert.equal(g.score,240);assert.equal(g.multiplier,2);assert.equal(g.combo,3);assert.equal(g.perfects,3);
  const first=pairIndices(g,keys[3])[0],second=pairIndices(g,keys[4])[0];g.flip(first);g.flip(second);advance(g,.8);
  assert.equal(g.combo,0);assert.equal(g.multiplier,1);match(g,keys[3]);assert.equal(g.perfects,3);assert.equal(g.treats,11);
  assert.equal(events.filter(e=>e.type==='match').length,4);assert.equal(events.filter(e=>e.type==='mismatch').length,1);
});

test('Peek is a limited help action; assist and charge gear help without contaminating daily boards',()=>{
  const g=new MemoryGame(null).reset({assist:true,gear:{charge:2}});assert.equal(g.timeLimit,150);assert.equal(g.hints,4);
  advance(g,3);assert.equal(g.peek(),true);assert.equal(g.hints,3);assert.equal(g.hintsUsed,1);assert.equal(g.peek(),false);assert.equal(g.flip(0),false);
  advance(g,2.1);assert.equal(g.flip(0),true);assert.equal(g.peek(),false);
  g.reset({dailyDate:'2026-11-12',assist:true,gear:{charge:3,magnet:3,heart:2},charms:{shieldStart:true}});
  assert.equal(g.timeLimit,90);assert.equal(g.hints,1);assert.equal(g.assist,false);assert.deepEqual(g.charms,{});assert.deepEqual(g.gear,{magnet:0,charge:0,heart:0});assert.equal(g.result().dailyDate,'2026-11-12');
});

test('a complete board ends once and gives a detached stable summary before a fresh attempt',()=>{
  const results=[],events=[],g=game({onFinish:r=>results.push(r),onEvent:e=>events.push(e)});
  for(const key of new Set(g.cards.map(c=>c.key)))match(g,key);
  assert.equal(g.mode,'won');assert.equal(g.pairs,6);assert.equal(g.perfects,6);assert.equal(g.bestCombo,6);assert.equal(results.length,1);
  assert.equal(events.filter(e=>e.type==='won').length,1);assert.ok(g.score>720);const summary=g.result();
  advance(g,100);assert.equal(g.flip(0),false);assert.equal(g.peek(),false);assert.deepEqual(g.result(),summary);assert.equal(results.length,1);
  const detached=g.result();detached.gear.charge=99;assert.equal(g.result().gear.charge,0);
  g.reset();assert.notEqual(g.runId,summary.runId);assert.equal(g.pairs,0);assert.equal(g.mode,'running');
});

test('time-out ends once, while destroying an abandoned board does not award completion',()=>{
  const results=[],g=game({onFinish:r=>results.push(r)});advance(g,95);assert.equal(g.mode,'lost');assert.equal(g.time,90);assert.equal(g.hearts,0);assert.equal(results.length,1);assert.equal(results[0].won,false);
  advance(g,20);assert.equal(results.length,1);g.destroy();g.destroy();assert.equal(results.length,1);
  const abandoned=[];const a=game({onFinish:r=>abandoned.push(r)});a.destroy();advance(a,100);assert.equal(a.mode,'destroyed');assert.equal(abandoned.length,0);
});

// ---- road-trip symbols, twists, and the cues the controller hangs sound on ----

function eventsGame(reset={}){const events=[],instance=new MemoryGame(null,{onEvent:e=>events.push(e)});instance.reset(reset);advance(instance,2);return {g:instance,events};}

test('every world deals its own road-trip symbols, and later worlds add seeded twists',()=>{
  const anchors=[['river','fish','paw'],['pine','acorn','campfire'],['cactus','sun','map'],['moon','star','lantern'],['bluebonnet','hat','rv']];
  const plans=[[],['golden'],['swap'],['golden','swap'],['golden','swap']];
  for(let worldIndex=0;worldIndex<5;worldIndex++){
    const wilds=new Set(),boards=new Set();
    for(let seed=1;seed<=12;seed++){
      const g=new MemoryGame(null).reset({worldIndex,seed}),keys=new Set(g.cards.map(c=>c.key));
      for(const key of anchors[worldIndex])assert.ok(keys.has(key),`${key} belongs in world ${worldIndex}`);
      assert.deepEqual(g.twists,plans[worldIndex]);assert.deepEqual(g.result().twists,plans[worldIndex]);
      const golden=g.cards.filter(c=>c.wild);
      if(plans[worldIndex].includes('golden')){assert.equal(golden.length,2);assert.equal(golden[0].key,golden[1].key);assert.equal(golden[0].key,g.wildKey);wilds.add(g.wildKey);}
      else{assert.equal(golden.length,0);assert.equal(g.wildKey,'');}
      const again=new MemoryGame(null).reset({worldIndex,seed});assert.deepEqual(again.cards,g.cards);assert.equal(again.wildKey,g.wildKey);
      boards.add([...keys].sort().join());
    }
    assert.ok(boards.size>1,'the symbol set changes from seed to seed');
    if(plans[worldIndex].includes('golden'))assert.ok(wilds.size>1,'the golden pair moves with the seed');
  }
  // Easygoing play keeps the golden pair and skips the swaps; a daily board is never softened.
  assert.deepEqual(new MemoryGame(null).reset({worldIndex:4,assist:true}).twists,['golden']);
  assert.deepEqual(new MemoryGame(null).reset({worldIndex:4,assist:true,dailyDate:'2026-11-12'}).twists,['golden','swap']);
});

test('the opening deal and preview run on simulation time and announce themselves once',()=>{
  const events=[],g=new MemoryGame(null,{onEvent:e=>events.push(e)}).reset({seed:5});
  assert.deepEqual(events.map(e=>e.type),['start','deal']);assert.equal(events[1].cards,12);assert.deepEqual(events[0].twists,[]);
  advance(g,1);g.pause();advance(g,10);g.resume();assert.equal(g.flip(0),false);assert.equal(events.some(e=>e.type==='ready'),false);
  advance(g,1);assert.equal(events.filter(e=>e.type==='ready').length,1);assert.equal(g.flip(0),true);
  advance(g,1);assert.equal(g.peek(),false);
});

test('Peek keeps the original hint event and adds a distinct peek cue',()=>{
  const {g,events}=eventsGame({seed:12});
  assert.equal(g.peek(),true);
  const hint=events.find(e=>e.type==='hint'),peek=events.find(e=>e.type==='peek');
  assert.ok(events.indexOf(hint)<events.indexOf(peek));assert.equal(hint.remaining,0);assert.equal(hint.mode,'memory');assert.equal(typeof hint.text,'string');
  assert.equal(peek.remaining,0);assert.equal(peek.duration,1.3);
  assert.equal(g.flip(0),false);advance(g,1.4);assert.equal(g.flip(0),true);
  assert.equal(events.filter(e=>e.type==='ready').length,1,'only the opening preview announces ready');
});

test('the golden pair pays a flat bonus and never touches the streak multiplier',()=>{
  const {g,events}=eventsGame({worldIndex:1,seed:5}),plain=g.cards.find(c=>!c.wild).key;
  match(g,plain);assert.equal(g.score,60);
  match(g,g.wildKey);assert.equal(g.score,60+60+150);assert.equal(g.treats,3+3+2);
  assert.equal(g.multiplier,1);assert.equal(g.totalMultiplier,1);assert.equal(g.bestMultiplier,1);assert.equal(g.goldenFound,1);
  const collects=events.filter(e=>e.type==='collect');assert.deepEqual(collects.map(e=>e.kind),['pair','gold']);
  assert.equal(collects[1].value,60);assert.equal(collects[1].bonus,150);
  const golden=events.filter(e=>e.type==='golden');assert.equal(golden.length,1);assert.equal(golden[0].bonus,150);assert.equal(golden[0].pair,g.wildKey);
  const wild=events.filter(e=>e.type==='match').map(e=>e.wild);assert.deepEqual(wild,[false,true]);
  assert.equal(g.result().goldenFound,1);assert.equal(g.result().gold,0);
});

test('streak milestones, a streak-lost beat, and card positions reach the controller',()=>{
  const {g,events}=eventsGame({worldIndex:1,seed:8}),keys=[...new Set(g.cards.map(c=>c.key))];
  for(const key of keys.slice(0,5))match(g,key);
  assert.deepEqual(events.filter(e=>e.type==='streak').map(e=>[e.combo,e.multiplier,e.tier]),[[3,2,1],[5,3,2]]);
  const first=events.find(e=>e.type==='match');assert.deepEqual(first.indices.map(i=>g.cards[i].key),[keys[0],keys[0]]);
  const flips=events.filter(e=>e.type==='flip');assert.equal(flips[0].first,true);assert.equal(flips[1].first,false);assert.equal(flips[0].key,keys[0]);
  const a=pairIndices(g,keys[5])[0],b=pairIndices(g,keys[6])[0];g.flip(a);g.flip(b);advance(g,.8);
  const miss=events.find(e=>e.type==='mismatch');assert.deepEqual(miss.indices,[a,b]);assert.equal(miss.streakLost,5);
  assert.deepEqual(events.filter(e=>e.type==='streak-lost').map(e=>e.streak),[5]);
  match(g,keys[5]);g.flip(pairIndices(g,keys[6])[0]);g.flip(pairIndices(g,keys[7])[0]);advance(g,.8);
  assert.equal(events.filter(e=>e.type==='streak-lost').length,1,'a single pair is not a streak to lose');
});

test('the swap twist trades two face-down cards on simulation time and holds the clock',()=>{
  const play=order=>{
    const {g,events}=eventsGame({worldIndex:2,seed:9}),keys=order([...new Set(g.cards.map(c=>c.key))]);let matched=0;
    while(!events.some(e=>e.type==='swap')&&matched<6){match(g,keys[matched++]);advance(g,.5);}
    return {g,events,keys,matched};
  };
  const {g,events,keys,matched}=play(keys=>keys);
  assert.ok([3,4].includes(matched),'the swap waits for the seeded pair count');
  const swap=events.find(e=>e.type==='swap'),before=g.cards.map(c=>c.key),clock=g.time;
  assert.equal(g.flip(g.cards.findIndex(c=>!c.matched)),false);assert.equal(g.peek(),false);
  g.pause();advance(g,3);g.resume();assert.equal(events.some(e=>e.type==='swap-done'),false,'a paused swap does not move');
  let waited=0;while(!events.some(e=>e.type==='swap-done')&&waited<5){g.update(.1);waited+=.1;}
  assert.ok(waited>1.1&&waited<1.5);assert.equal(g.time,clock,'nobody loses time to a swap');
  const after=g.cards.map(c=>c.key),moved=before.flatMap((key,i)=>key===after[i]?[]:[i]);
  assert.deepEqual(moved,[...swap.indices].sort((x,y)=>x-y));assert.equal(after[moved[0]],before[moved[1]]);assert.equal(after[moved[1]],before[moved[0]]);
  for(const index of moved){assert.equal(g.cards[index].matched,false);assert.equal(g.cards[index].faceUp,false);}
  assert.equal(g.result().swaps,1);
  for(const key of keys.slice(matched))match(g,key);
  assert.equal(g.mode,'won');assert.equal(g.pairs,8);assert.equal(events.filter(e=>e.type==='swap').length,1);
  // The same seed swaps after the same pair count whatever order the player chose.
  const replay=play(keys=>keys);assert.deepEqual(replay.events.find(e=>e.type==='swap').indices,swap.indices);
  assert.equal(play(keys=>keys.reverse()).matched,matched);
});

test('the last seconds tick: one cue at fifteen, one at ten, then five counted ticks before time-up',()=>{
  const {g,events}=eventsGame();advance(g,95);
  const types=events.map(e=>e.type);
  assert.equal(types.filter(type=>type==='timer-low').length,1);assert.equal(types.filter(type=>type==='timer-warning').length,1);
  assert.deepEqual(events.filter(e=>e.type==='tick').map(e=>e.remaining),[5,4,3,2,1]);
  assert.ok(types.indexOf('timer-low')<types.indexOf('timer-warning'));assert.ok(types.indexOf('timer-warning')<types.indexOf('tick'));
  assert.deepEqual(types.slice(-2),['time-up','lost']);assert.equal(g.result().won,false);assert.equal(g.result().perfectGame,false);
});

test('a flawless board announces a perfect game before the final event, and one miss withholds it',()=>{
  const {g,events}=eventsGame({seed:831});for(const key of new Set(g.cards.map(c=>c.key)))match(g,key);
  assert.deepEqual(events.map(e=>e.type).slice(-2),['perfect-game','won']);
  const summary=g.result();assert.equal(summary.perfectGame,true);assert.ok(summary.timeBonus>0);assert.equal(summary.timeBonus,summary.score-720);
  const flawed=eventsGame({seed:831}),keys=[...new Set(flawed.g.cards.map(c=>c.key))];
  flawed.g.flip(pairIndices(flawed.g,keys[0])[0]);flawed.g.flip(pairIndices(flawed.g,keys[1])[0]);advance(flawed.g,.8);
  for(const key of keys)match(flawed.g,key);
  assert.equal(flawed.g.mode,'won');assert.equal(flawed.g.result().perfectGame,false);assert.equal(flawed.events.some(e=>e.type==='perfect-game'),false);
});

// ---- the board itself, on a tiny stand-in document -----------------------------

function fakeDocument(boardSize=[370,586]){
  const doc={boardSize,activeElement:null,documentElement:{dataset:{}},defaultView:{matchMedia:()=>({matches:false})}};
  class Node{
    constructor(tag){
      this.tagName=String(tag).toUpperCase();this.children=[];this.parentNode=null;this.attributes={};this.dataset={};this.listeners={};this.names=new Set();this.textContent='';this.ownerDocument=doc;
      this.style={values:{},setProperty(key,value){this.values[key]=value;}};
      this.classList={add:(...names)=>names.forEach(name=>this.names.add(name)),remove:(...names)=>names.forEach(name=>this.names.delete(name)),contains:name=>this.names.has(name),
        toggle:(name,on=!this.names.has(name))=>{if(on)this.names.add(name);else this.names.delete(name);return on;}};
    }
    set className(value){this.names=new Set(String(value).split(/\s+/).filter(Boolean));}get className(){return [...this.names].join(' ');}
    setAttribute(key,value){this.attributes[key]=String(value);}getAttribute(key){return this.attributes[key]??null;}
    append(...nodes){for(const node of nodes){node.remove();node.parentNode=this;this.children.push(node);}}
    replaceChildren(...nodes){for(const child of [...this.children])child.remove();this.append(...nodes);}
    remove(){if(!this.parentNode)return;this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}
    contains(node){for(;node;node=node.parentNode)if(node===this)return true;return false;}
    closest(selector){const key={'[data-memory-card]':'memoryCard','[data-memory-peek]':'memoryPeek'}[selector];for(let node=this;node;node=node.parentNode)if(key&&node.dataset[key]!==undefined)return node;return null;}
    querySelector(selector){const name=selector.slice(1),walk=node=>{for(const child of node.children){if(child.names.has(name))return child;const found=walk(child);if(found)return found;}return null;};return walk(this);}
    addEventListener(type,handler){(this.listeners[type]||=[]).push(handler);}
    removeEventListener(type,handler){this.listeners[type]=(this.listeners[type]||[]).filter(item=>item!==handler);}
    send(type,detail={}){const event={type,target:this,timeStamp:0,pointerId:1,button:0,preventDefault(){},...detail};for(const handler of [...(this.listeners[type]||[])])handler(event);}
    focus(){doc.activeElement=this;}
    get offsetWidth(){return 0;}
    get clientWidth(){return this.names.has('cp-board')?doc.boardSize[0]:0;}get clientHeight(){return this.names.has('cp-board')?doc.boardSize[1]:0;}
  }
  doc.createElement=tag=>new Node(tag);
  return {doc,host:new Node('div')};
}

test('the board is native buttons: a touch flips on contact, its click is swallowed, and an early tap is remembered',()=>{
  const {host}=fakeDocument(),g=new MemoryGame(host);g.reset({seed:831});advance(g,2);
  assert.equal(g.buttons.length,12);assert.equal(host.names.has('memory-game-host'),true);assert.equal(host.dataset.cpWorld,'river');
  for(const [index,button] of g.buttons.entries()){assert.equal(button.tagName,'BUTTON');assert.equal(button.type,'button');assert.equal(button.dataset.memoryCard,String(index));assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.getAttribute('aria-label'),`Card ${index+1}, face down`);}
  assert.equal(g.hintButton.tagName,'BUTTON');assert.equal(g.hintButton.dataset.memoryPeek,'true');assert.match(g.hintButton.getAttribute('aria-label'),/1 left/);
  assert.equal(g.status.getAttribute('role'),'status');assert.equal(g.status.getAttribute('aria-live'),'polite');
  const keys=[...new Set(g.cards.map(c=>c.key))],[a,b]=pairIndices(g,keys[0]),c=pairIndices(g,keys[1])[0];
  host.send('pointerdown',{target:g.buttons[a],pointerId:4,timeStamp:100});
  assert.equal(g.flips,1);assert.equal(g.buttons[a].names.has('is-pressed'),true);assert.equal(g.buttons[a].getAttribute('aria-pressed'),'true');assert.match(g.buttons[a].getAttribute('aria-label'),new RegExp(`Card ${a+1}: `));
  host.send('pointerup',{target:g.buttons[a],pointerId:4,timeStamp:900});host.send('click',{target:g.buttons[a],timeStamp:905});
  assert.equal(g.flips,1);assert.equal(g.buttons[a].names.has('is-pressed'),false);
  host.send('click',{target:g.buttons[b],timeStamp:4000});assert.equal(g.flips,2,'keyboard and assistive activation still flip');
  host.send('pointerdown',{target:g.buttons[c],pointerId:5,timeStamp:4100});assert.equal(g.flips,2);
  advance(g,.4);assert.equal(g.pairs,1);assert.equal(g.flips,3,'the early tap lands as soon as the pair settles');assert.equal(g.cards[c].faceUp,true);
  assert.equal(g.buttons[a].disabled,true);assert.equal(g.buttons[a].getAttribute('aria-label'),`Matched ${g.cards[a].label}`);
  // Arrow keys still walk the board, skipping matched cards.
  const open=g.cards.findIndex(card=>!card.matched);g.buttons[open].focus();host.send('keydown',{target:g.buttons[open],key:'End'});
  const last=g.cards.findLastIndex(card=>!card.matched);assert.equal(host.ownerDocument.activeElement,g.buttons[last]);assert.equal(g.buttons[last].tabIndex,0);
  host.send('click',{target:g.hintButton,timeStamp:9000});assert.equal(g.hintsUsed,0,'Peek waits while a card is face up');
  g.destroy();assert.equal(host.children.length,0);assert.equal(host.names.has('memory-game-host'),false);assert.equal(host.dataset.cpWorld,undefined);
});

test('cards fill a phone screen and never fall under 56 px wide',()=>{
  for(const [width,height] of [[370,575],[750,262],[824,270],[300,390],[346,560]])for(let worldIndex=0;worldIndex<5;worldIndex++){
    const {host}=fakeDocument([width,height]),g=new MemoryGame(host);g.reset({worldIndex,seed:3});
    const {w,h}=g._cardSize,cols=g._cols,rows=Math.ceil(g.cards.length/cols),gap=parseFloat(g.grid.style.values['--cp-gap']);
    assert.ok(w>=56,`${width}x${height} world ${worldIndex}: ${w}`);assert.ok(h>=56);
    assert.ok(cols*w+(cols-1)*gap<=width+.01);assert.ok(rows*h+(rows-1)*gap<=height+.01);
    assert.ok(cols*w+(cols-1)*gap>width*.8||rows*h+(rows-1)*gap>height*.8,'the board uses the space it is given');
    for(const spot of g._spots){assert.ok(spot.x>w/2-1&&spot.x<width-w/2+1);assert.ok(spot.y>h/2-1&&spot.y<height-h/2+1);}
    g.destroy();
  }
});
