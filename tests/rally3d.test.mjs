import test from 'node:test';
import assert from 'node:assert/strict';
import { RallyRun, RallyRenderer, RALLY_WORLD } from '../dist/rally3d.js';

function advance(run, seconds) {
  for (let elapsed=0;elapsed<seconds-1e-8;elapsed+=1/60) run.update(Math.min(1/60,seconds-elapsed));
}
function emptyTrack(options={}) {
  const run=new RallyRun(options);run.reset();run.entities=[];run._nextRow=Infinity;return run;
}
function entity(run,type,x=0,ahead=2,id=1) {
  return {id,type,x,z:ahead,worldZ:run.distance+ahead,width:type==='barrier'?1.9:type==='cone'?1:.55,depth:.6,hit:false,taken:false,passed:false};
}

test('the seed reproduces the road, with a warm-up and an open route through every obstacle row',()=>{
  for(let worldIndex=0;worldIndex<5;worldIndex++)for(let seed=1;seed<=32;seed++){
    const a=new RallyRun().reset({worldIndex,seed}),b=new RallyRun().reset({worldIndex,seed});
    assert.deepEqual(a.entities,b.entities);
    assert.notEqual(a.runId,b.runId);
    assert.ok(a.courseHistory[0].z>=70,'the opening gives the driver time to learn');
    for(let distance=0;distance<1600;distance+=100){
      a.distance=distance;a._ensureCourse();
      let previous=null;
      for(const row of a.courseHistory){
        assert.ok(!row.blocked.includes(row.safeLane));
        assert.ok(row.blocked.length>=1&&row.blocked.length<=2);
        assert.ok(RALLY_WORLD.lanes.includes(RALLY_WORLD.lanes[row.safeLane]));
        if(previous){assert.ok(row.z-previous.z>=44);assert.ok(Math.abs(row.safeLane-previous.safeLane)<=1);}
        previous=row;
      }
    }
  }
});

test('held steering is bounded, braking is useful, and pause stops both motion and input',()=>{
  const fast=emptyTrack(),slow=emptyTrack();slow.brake(true);fast.move(1);slow.move(-1);
  advance(fast,2);advance(slow,2);
  assert.ok(slow.distance<fast.distance*.8);
  assert.equal(fast.player.x,3.9);assert.equal(slow.player.x,-3.9);
  fast.pause();const frozen=fast.result();fast.move(-1);fast.brake(true);advance(fast,2);
  assert.deepEqual(fast.result(),frozen);assert.equal(fast.steering,0);assert.equal(fast.braking,false);
  fast.resume();fast.move(-1);advance(fast,.5);assert.ok(fast.player.x<2);
});

test('obstacles damage once, visibly separated obstacles allow recovery, and shields absorb a hit',()=>{
  const events=[],run=emptyTrack({onEvent:event=>events.push(event)});
  run.entities=[entity(run,'cone')];advance(run,.5);
  assert.equal(run.hits,1);assert.equal(run.hearts,2);assert.equal(events.filter(e=>e.type==='hit').length,1);
  advance(run,2);run.entities=[entity(run,'barrier',0,2,2)];advance(run,.2);
  assert.equal(run.hits,2);assert.equal(run.hearts,1);
  const shield=new RallyRun().reset({charms:{shieldStart:true}});shield.entities=[entity(shield,'cone')];shield._nextRow=Infinity;
  advance(shield,.3);assert.equal(shield.hearts,3);assert.equal(shield.hits,0);assert.equal(shield.shieldCharges,0);
  const dodge=emptyTrack();dodge.entities=[entity(dodge,'cone',3)];advance(dodge,.3);
  assert.equal(dodge.dodged,1);assert.equal(dodge.hits,0);assert.equal(dodge.score,20);
});

test('collecting and powers create the promised bounded multiplier stack and stop repeated power activation',()=>{
  const run=emptyTrack();run.entities=Array.from({length:20},(_,i)=>entity(run,'bone',0,2,i+1));advance(run,.1);
  assert.equal(run.bestCombo,20);assert.equal(run.treats,20);assert.equal(run.charge,100);assert.ok(run.feverTime>0);
  assert.equal(run.power(),true);assert.equal(run.power(),false);assert.equal(run.charge,0);
  run.entities=[entity(run,'gold',0,2,100)];advance(run,.1);
  assert.equal(run.gold,1);assert.equal(run.treats,23);assert.equal(run.totalMultiplier,30);assert.equal(run.bestMultiplier,30);
  const before=run.score;run.entities=[entity(run,'barrier')];advance(run,.1);
  assert.equal(run.hearts,3);assert.equal(run.hits,0);assert.ok(run.score>before);
});

test('gear and selected charms apply, daily attempts stay neutral, and result data are detached',()=>{
  const config={worldIndex:4,gear:{magnet:3,charge:3,heart:2},assist:true,charms:{shieldStart:true,comboGrace:2,goldDuration:2,speed:.1,powerDuration:1.5}};
  const run=new RallyRun().reset(config);assert.equal(run.maxHearts,6);assert.equal(run.charge,75);assert.equal(run.shieldCharges,1);
  run.charge=100;run.power();assert.equal(run.powerDuration,6);
  const daily=new RallyRun().reset({...config,dailyDate:'2026-11-12'});
  assert.deepEqual(daily.gear,{magnet:0,charge:0,heart:0});assert.deepEqual(daily.charms,{});assert.equal(daily.assist,false);assert.equal(daily.maxHearts,3);
  const result=daily.result();result.gear.heart=99;assert.equal(daily.result().gear.heart,0);assert.equal(result.dailyDate,'2026-11-12');
});

test('win and loss each produce one stable terminal event and a unique next attempt',()=>{
  const events=[],win=emptyTrack({onEvent:e=>events.push(e)});win.time=59.99;advance(win,.1);
  assert.equal(win.mode,'won');assert.equal(win.time,60);assert.equal(events.filter(e=>e.type==='won').length,1);
  const summary=win.result();advance(win,5);win.power();win.move(1);assert.deepEqual(win.result(),summary);
  win.reset();assert.notEqual(win.runId,summary.runId);assert.equal(win.mode,'running');
  const losses=[],loss=emptyTrack({onEvent:e=>losses.push(e)});loss.hearts=1;loss.entities=[entity(loss,'cone')];advance(loss,.2);
  assert.equal(loss.mode,'lost');assert.equal(loss.hearts,0);const final=loss.result();advance(loss,5);
  assert.deepEqual(loss.result(),final);assert.equal(losses.filter(e=>e.type==='lost').length,1);
});

function softwareCanvas(width=800,height=500,gl=null){
  let path=[];const shapes=[];
  const context={shapes,fillStyle:'',strokeStyle:'',setTransform(){},fillRect(){},beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},closePath(){},fill(){shapes.push({points:path.map(p=>[...p]),color:this.fillStyle});},stroke(){}};
  const surface={width:0,height:0,getContext(){return gl;},addEventListener(){},removeEventListener(){}};
  return {width:0,height:0,dataset:{},getContext(){return context;},getBoundingClientRect(){return {width,height};},ownerDocument:{createElement(){return surface;}},context};
}

test('software fallback projects lit 3D meshes, clips nearby geometry, and stays within a small triangle budget',()=>{
  for(const [width,height] of [[960,600],[390,650],[820,340]])for(let worldIndex=0;worldIndex<5;worldIndex++){
    const canvas=softwareCanvas(width,height),renderer=new RallyRenderer(canvas),run=new RallyRun().reset({worldIndex,seed:519});
    run.distance=12;run.player.x=3.8;run.player.vx=6;run.entities.forEach(e=>e.z=e.worldZ-run.distance);
    renderer.draw(run,{time:3,reducedMotion:false});
    assert.equal(renderer.backend,'software-3d');assert.equal(renderer.backendReason,'webgl-context-unavailable');assert.equal(canvas.dataset.renderStatus,'webgl-context-unavailable');
    assert.ok(renderer.softwareStats.triangles>1000&&renderer.softwareStats.triangles<5000);
    assert.ok(renderer.softwareStats.polygons>150&&renderer.softwareStats.polygons<3000);
    assert.ok(new Set(canvas.context.shapes.map(s=>s.color)).size>40,'directional lighting and fog should create dimensional faces');
    for(const shape of canvas.context.shapes)for(const [x,y] of shape.points){assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(x>=-.001&&x<=canvas.width+.001);assert.ok(y>=-.001&&y<=canvas.height+.001);}
    renderer.destroy();renderer.destroy();
  }
});

test('software projection reacts to steering, respects reduced motion, and skips redundant high-rate paints',()=>{
  const canvas=softwareCanvas(),renderer=new RallyRenderer(canvas),run=new RallyRun().reset();
  renderer.draw(run,{time:0,reducedMotion:true});const first=structuredClone(canvas.context.shapes),count=first.length;
  renderer.draw(run,{time:.005,reducedMotion:true});assert.equal(canvas.context.shapes.length,count);
  canvas.context.shapes.length=0;renderer.draw(run,{time:2,reducedMotion:true});assert.deepEqual(canvas.context.shapes,first);
  canvas.context.shapes.length=0;run.player.x=3;renderer.draw(run,{time:3,reducedMotion:true});assert.notDeepEqual(canvas.context.shapes,first);
  renderer.destroy();const finalCount=canvas.context.shapes.length;renderer.draw(run,{time:4});assert.equal(canvas.context.shapes.length,finalCount);
});

test('diagnostics distinguish shader compilation, context loss, and drawing failures while retaining software play',()=>{
  const brokenGL={VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,createShader(){return {};},shaderSource(){},compileShader(){},getShaderParameter(){return false;},getShaderInfoLog(){return 'test compile rejection';},deleteShader(){}};
  const compileCanvas=softwareCanvas(800,500,brokenGL),failed=new RallyRenderer(compileCanvas);assert.match(failed.backendReason,/webgl-vertex-compile-failed/);failed.draw(new RallyRun().reset(),{time:1});assert.ok(failed.softwareStats.polygons>0);
  const canvas=softwareCanvas(),renderer=new RallyRenderer(canvas);renderer.is3D=true;renderer.gl={isContextLost(){return false;}};renderer._draw3D=()=>{throw new Error('test draw rejection');};
  renderer.draw(new RallyRun().reset(),{time:1});assert.equal(renderer.backend,'software-3d');assert.match(renderer.backendReason,/webgl-draw-failed/);assert.ok(renderer.softwareStats.polygons>0);
  renderer._lost({preventDefault(){}});assert.equal(renderer.backendReason,'webgl-context-lost');
});

// --- dynamic release: analog steering, near misses, world twists, run beats, and view feel ---
import { RALLY_TIMING } from '../dist/rally3d.js';

const OBSTACLES=['cone','barrier'];
function course(worldIndex,seed,length=1700){
  const run=new RallyRun().reset({worldIndex,seed}),seen=new Map();
  for(let distance=0;distance<=length;distance+=60){run.distance=distance;run._ensureCourse();for(const e of run.entities)seen.set(e.id,e);}
  return {run,entities:[...seen.values()],rows:run.courseHistory};
}

test('analog steering accepts partial values, drag steering settles on a road position, and braking still works',()=>{
  const half=emptyTrack(),full=emptyTrack();half.steer(.5);full.move(1);advance(half,.4);advance(full,.4);
  assert.ok(half.player.x>.4&&half.player.x<full.player.x*.6,'half a stick is about half the slide');
  const drag=emptyTrack();drag.steerTo(2.2);let peak=0;
  for(let i=0;i<150;i++){drag.update(1/60);peak=Math.max(peak,drag.player.x);}
  assert.ok(Math.abs(drag.player.x-2.2)<.03,'the RV comes to rest under the finger');assert.ok(peak<2.35,'without hunting past it');
  drag.steerTo(-99);advance(drag,3);assert.equal(drag.player.x,-3.9);
  drag.steerTo(null);assert.equal(drag.steerTarget,null);assert.equal(drag.steering,0);
  drag.steerTo(1);drag.move(-1);assert.equal(drag.steerTarget,null);assert.equal(drag.steering,-1);
  drag.steerTo(0);drag.brake(true);const before=drag.speed;advance(drag,1);assert.ok(drag.speed<before*.7,'braking stays available while dragging');
  drag.pause();assert.equal(drag.steerTarget,null);drag.steerTo(3);assert.equal(drag.steerTarget,null,'a paused run ignores the finger');
});

test('a close pass earns one near-miss with a side, a wide pass and a collision earn none',()=>{
  const events=[],run=emptyTrack({onEvent:e=>events.push(e)});
  run.entities=[entity(run,'cone',1.6)];advance(run,.3);
  const near=events.filter(e=>e.type==='near-miss');
  assert.equal(near.length,1);assert.equal(near[0].side,1);assert.equal(near[0].value,30);assert.ok(near[0].gap>0&&near[0].gap<.75);
  assert.equal(run.nearMisses,1);assert.equal(run.hits,0);assert.equal(run.score,50);assert.equal(run.result().nearMisses,1);
  run.entities=[entity(run,'barrier',-2,2,2)];advance(run,.3);assert.equal(events.filter(e=>e.type==='near-miss').length,2);assert.equal(events.filter(e=>e.type==='near-miss').at(-1).side,-1);
  const wide=emptyTrack({onEvent:e=>events.push({...e,wide:true})});wide.entities=[entity(wide,'cone',3)];advance(wide,.3);
  assert.equal(wide.nearMisses,0);assert.equal(wide.dodged,1);
  const crash=emptyTrack();crash.entities=[entity(crash,'cone',.5)];advance(crash,.3);assert.equal(crash.hits,1);assert.equal(crash.nearMisses,0);
});

test('world twists are seeded, never move the obstacle course, and keep clear road around every extra',()=>{
  for(let seed=3;seed<=40;seed+=7){
    const worlds=[0,1,2,3,4].map(worldIndex=>course(worldIndex,seed));
    assert.deepEqual(worlds[0].rows,worlds[1].rows,'twists draw from their own stream');assert.deepEqual(worlds[2].rows,worlds[3].rows);assert.deepEqual(worlds[3].rows,worlds[4].rows);
    assert.deepEqual(worlds.map(w=>w.run.twist),['spray','bends','ramps','stars','hills']);
    worlds.forEach(({run,entities},worldIndex)=>{
      assert.deepEqual(course(worldIndex,seed).entities,entities,'the same seed rebuilds the same extras');
      const obstacles=entities.filter(e=>OBSTACLES.includes(e.type)),rowAt=z=>obstacles.filter(o=>Math.abs(o.worldZ-z)<.01);
      const kinds=new Set(entities.map(e=>e.type));
      assert.equal(kinds.has('splash'),worldIndex===0);assert.equal(kinds.has('ramp'),worldIndex===2);assert.equal(kinds.has('star'),worldIndex===3);
      for(const e of entities){
        assert.ok(Math.abs(e.x)<=3.9,'everything sits on the road');
        if(e.type==='splash'||e.type==='star')for(const o of obstacles)assert.ok(Math.abs(o.worldZ-e.worldZ)>=18,'extras keep their distance from obstacle rows');
        if(e.type==='ramp'){
          const row=rowAt(e.worldZ+12);assert.ok(row.some(o=>o.x===e.x),'a ramp always faces the obstacle it jumps');
          for(const o of obstacles)assert.ok(o.worldZ<e.worldZ+18||o.worldZ>e.worldZ+40,'the landing strip is clear');
          assert.equal(entities.filter(s=>s.y>1.5&&s.x===e.x&&s.worldZ>e.worldZ&&s.worldZ<e.worldZ+26).length,3,'three snacks hang over the jump');
        }
      }
      const convoys=new Map();for(const e of entities)if(e.convoy)convoys.set(e.convoy,[...(convoys.get(e.convoy)||[]),e]);
      assert.ok(convoys.size>=3,'several convoys per run');
      for(const bones of convoys.values()){
        assert.ok(bones.length>=5&&bones.length<=9);
        for(const bone of bones)for(const o of obstacles)assert.ok(Math.abs(o.worldZ-bone.worldZ)>=13.9,'convoys weave through open road only');
        for(let i=1;i<bones.length;i++)assert.ok(Math.abs(bones[i].x-bones[i-1].x)<1.4,'each snack is a small steer from the last');
      }
      assert.equal(run.road.drift>0,worldIndex===1);assert.equal(run.road.lift>0,worldIndex===4);
    });
  }
});

test('a canyon ramp flies the RV over its obstacle and lands at the same spot however fast it travels',()=>{
  const landings=[];
  for(const style of ['coast','brake']){
    const events=[],run=new RallyRun({onEvent:e=>events.push(e)});run.reset({worldIndex:2,seed:77});
    const ramp=run.entities.find(e=>e.type==='ramp');assert.ok(ramp);
    let top=0,overRow=0;
    for(let i=0;i<2400&&!events.some(e=>e.type==='landing');i++){
      run.steerTo(ramp.x);if(style==='brake'&&run.jump)run.brake(true);run.update(1/60);top=Math.max(top,run.player.y);
      if(Math.abs(run.distance-(ramp.worldZ+12))<.4)overRow=run.player.y;
    }
    const landing=events.find(e=>e.type==='landing');
    assert.ok(landing,'the RV comes down');assert.ok(events.some(e=>e.type==='ramp'));assert.equal(run.jumps,1);assert.equal(run.hits,0);
    assert.ok(top>2.5&&top<=2.7);assert.ok(overRow>2.4,'highest right above the obstacle');assert.equal(run.player.y,0);
    assert.ok(landing.cleared>=1);assert.equal(landing.value,landing.cleared*50);
    assert.ok(events.filter(e=>e.type==='dodge'&&e.air).length>=1);assert.ok(events.filter(e=>e.type==='collect'&&e.y>1.5).length===3,'the air snacks are catchable');
    landings.push(run.distance);
  }
  assert.ok(Math.abs(landings[0]-landings[1])<.6,'air time is measured in road, not seconds');
});

test('river spray gives a short surge, redwood bends push wide, mesa stars charge the boost',()=>{
  const events=[],river=emptyTrack({onEvent:e=>events.push(e)});advance(river,3);const cruising=river.speed;
  river.entities=[{...entity(river,'splash',0,2),width:2.6,depth:4}];advance(river,.6);
  assert.equal(river.splashes,1);assert.equal(events.filter(e=>e.type==='splash').length,1);assert.ok(river.speed>cruising*1.12);assert.equal(river.score,25);
  advance(river,2.5);assert.ok(river.speed<cruising*1.05,'the surge fades');
  const bends=new RallyRun().reset({worldIndex:1,seed:9}),easy=new RallyRun().reset({worldIndex:1,seed:9,assist:true}),straight=new RallyRun().reset({worldIndex:0,seed:9});
  for(const run of [bends,easy,straight]){run.entities=[];run._nextRow=Infinity;}
  let pushed=0,eased=0;for(let i=0;i<240;i++){const before=bends.player.x,soft=easy.player.x;bends.update(1/60);easy.update(1/60);straight.update(1/60);pushed+=Math.abs(bends.player.x-before);eased+=Math.abs(easy.player.x-soft);}
  assert.ok(pushed>.5,'an unsteered RV drifts on the S-bends');assert.ok(eased<pushed*.7,'Easygoing halves the push');assert.equal(straight.player.x,0);
  assert.ok(Math.abs(bends.curvature)<=1);assert.equal(bends.roadOffset(0),0);assert.equal(straight.roadLift(80),0);
  const mesa=new RallyRun({onEvent:e=>events.push(e)});mesa.reset({worldIndex:3,seed:5});mesa.entities=[entity(mesa,'star')];mesa._nextRow=Infinity;const charge=mesa.charge;advance(mesa,.2);
  assert.ok(mesa.charge>=charge+40);assert.ok(events.some(e=>e.type==='pickup'&&e.kind==='star'));assert.equal(mesa.treats,0,'a star is boost, not a treat');
});

test('snack convoys are announced and pay their stacked bonus only for a perfect line',()=>{
  const drive=(skip)=>{
    const events=[],run=new RallyRun({onEvent:e=>events.push(e)});run.reset({worldIndex:0,seed:11});
    const skipped=new Set();
    for(let i=0;i<60*30&&!events.some(e=>e.type==='convoy')&&run.time<29;i++){
      const bone=run.entities.filter(e=>e.convoy&&!e.taken&&!e.passed&&e.z>.2).sort((a,b)=>a.z-b.z)[0];
      const row=run.courseHistory.find(r=>r.z-run.distance>-2.2);
      let target=bone&&bone.z<24?bone.x:RALLY_WORLD.lanes[row.safeLane];
      if(skip&&bone&&bone.z<6&&!skipped.has(bone.convoy)){skipped.add(bone.convoy);bone.passed=true;}
      run.steerTo(target);run.update(1/60);
    }
    return {events,run};
  };
  const perfect=drive(false),starts=perfect.events.filter(e=>e.type==='convoy-start'),bonus=perfect.events.find(e=>e.type==='convoy');
  assert.ok(starts.length>=1&&starts[0].count>=5);assert.ok(bonus,'a careful driver can finish the line');
  assert.equal(bonus.count,starts[0].count);assert.equal(bonus.value,Math.round(100*perfect.run.totalMultiplier));assert.equal(perfect.run.convoys,1);assert.equal(perfect.run.hits,0);
  const broken=drive(true);assert.ok(broken.run.time>=29&&broken.events.filter(e=>e.type==='convoy-start').length>=2);assert.equal(broken.events.filter(e=>e.type==='convoy').length,0);assert.equal(broken.run.convoys,0);
});

test('countdown, final stretch and finish line ride on simulation time, pause with the run, and end in a safe victory roll',()=>{
  const events=[],clock={run:null},run=emptyTrack({onEvent:e=>events.push({...e,at:clock.run?.time??0})}),named=type=>events.filter(e=>e.type===type);clock.run=run;
  assert.equal(run.countdown,3);advance(run,1);
  assert.deepEqual(named('countdown').map(e=>e.count),[3,2]);assert.equal(run.countdown,2);
  run.pause();advance(run,5);assert.equal(named('countdown').length,2,'a paused run does not count down');run.resume();
  advance(run,2);assert.deepEqual(named('countdown').map(e=>e.count),[3,2,1]);assert.equal(named('go').length,1);assert.ok(Math.abs(named('go')[0].at-RALLY_TIMING.go)<.02);assert.equal(run.countdown,0);
  assert.ok(run.distance>40,'it is a rolling start: the RV drives through the count');
  run.time=49.5;advance(run,1);assert.equal(named('final-push').length,1);
  run.time=56.9;advance(run,2.45);assert.deepEqual(named('final-tick').map(e=>e.seconds),[3,2,1]);assert.equal(named('finish-line').length,0);
  advance(run,.1);assert.equal(named('finish-line').length,1);assert.equal(run.mode,'running');
  run.entities=[entity(run,'cone')];run.hearts=1;advance(run,.3);assert.equal(run.hits,0,'nothing can spoil the last moments');assert.equal(run.hearts,1);
  advance(run,1);assert.equal(run.mode,'won');assert.equal(named('won').length,1);assert.equal(named('finish-line').length,1);
});

function fullCanvas(width=390,height=750){
  const calls=[],texts=[];
  const gradient={addColorStop(){}};
  const context=new Proxy({calls,texts,canvasStyle:null},{
    get(target,name){
      if(name in target)return target[name];
      if(name==='createLinearGradient'||name==='createRadialGradient')return()=>gradient;
      if(name==='fillText')return text=>{calls.push('fillText');texts.push(String(text));};
      if(name==='measureText')return()=>({width:10});
      return(...args)=>{calls.push(String(name));};
    },
    set(target,name,value){target[name]=value;return true;}
  });
  const element=()=>({width:0,height:0,style:{},getContext:kind=>kind==='2d'?context:null,addEventListener(){},removeEventListener(){}});
  return {width:0,height:0,dataset:{},style:{},getContext(){return context;},getBoundingClientRect(){return {width,height,left:0,top:0};},ownerDocument:{createElement:element},context};
}

test('the view frames the RV and the road ahead between the HUD and the touch controls',()=>{
  for(const [width,height,insets] of [[390,750,{top:96,right:0,bottom:150,left:0}],[844,390,{top:64,right:0,bottom:84,left:0}],[390,650,{top:0,right:0,bottom:0,left:0}],[1024,700,{top:80,right:0,bottom:0,left:0}]])for(let worldIndex=0;worldIndex<5;worldIndex++){
    const canvas=fullCanvas(width,height),renderer=new RallyRenderer(canvas),run=new RallyRun().reset({worldIndex,seed:21});
    renderer.insets=insets;
    for(const [distance,x] of [[0,0],[300,3.9],[700,-3.9],[1100,1.5]]){
      run.distance=distance;run.player.x=x;run._ensureCourse();run.entities.forEach(e=>e.z=e.worldZ-run.distance);
      renderer.draw(run,{time:distance,reducedMotion:true,insets});
      const floor=height-insets.bottom,rear=renderer.project(x,0,-1.9),roof=renderer.project(x,3.4,0),left=renderer.project(x-.9,0,0),right=renderer.project(x+.9,0,0);
      assert.ok(rear.visible&&rear.y<=floor+.5,`the RV stays above the controls (${width}x${height} world ${worldIndex}: ${rear.y.toFixed(1)} > ${floor})`);
      assert.ok(roof.y>=insets.top,'and under the HUD');assert.ok(left.x>=0&&right.x<=width,'and on screen at either edge of the road');
      const rows=run.courseHistory.filter(row=>row.z-run.distance>2).slice(0,2);assert.equal(rows.length,2);
      for(const row of rows)for(const lane of [...row.blocked,row.safeLane]){
        const at=renderer.project(RALLY_WORLD.lanes[lane],.5,row.z-run.distance);
        assert.ok(at.visible&&at.y>=insets.top&&at.y<rear.y,`the next two rows sit in the clear band (${width}x${height} world ${worldIndex} y ${at.y.toFixed(1)})`);
        assert.ok(at.x>-width*.05&&at.x<width*1.05,`and inside the picture (${width}x${height} world ${worldIndex} x ${at.x.toFixed(1)})`);
      }
    }
    assert.ok(renderer.pixelsPerUnit>8);assert.ok(Math.abs(renderer.roadXAt(renderer.project(1.5,0,0).x)-1.5)<.25,'a finger on the RV maps back to its road position');assert.equal(renderer.roadXAt(-9999),-3.9);
    renderer.destroy();
  }
});

test('engine events become bounded game feel, and reduced motion keeps the words but drops the shaking',()=>{
  const canvas=fullCanvas(),renderer=new RallyRenderer(canvas),run=new RallyRun().reset({worldIndex:2,seed:4});
  assert.equal(renderer.backend,'software-3d');assert.equal(typeof renderer.addEvent,'function');assert.deepEqual(renderer.insets,{top:0,right:0,bottom:0,left:0});
  assert.equal(typeof renderer.juice.hitStop,'function');
  renderer.draw(run,{time:0,dt:1/60,simDt:1/60});
  renderer.addEvent({type:'collect',kind:'bone',value:15,x:0,z:1,totalMultiplier:1},run);
  assert.ok(renderer.juice.popups.some(p=>p.text==='+15'));assert.equal(renderer.juice.fliers.length,1,'the snack flies to the HUD');assert.ok(renderer.juice.particles.length>0);
  renderer.addEvent({type:'hit',hearts:2,x:0,z:0},run);
  assert.ok(renderer.juice.frozen,'a hit stops time for a beat');assert.ok(renderer.juice.trauma>.4);assert.ok(renderer.juice.popups.some(p=>p.text==='BONK!'));
  assert.equal(renderer.juice.step(1/60),0);
  renderer.addEvent({type:'near-miss',side:-1,value:30,x:-1.6,z:-2},run);assert.ok(renderer.juice.popups.some(p=>p.text==='SO CLOSE!'));
  renderer.addEvent({type:'shield',x:0,z:0},run);assert.ok(renderer.juice.rings.length>=2,'the shield pops visibly');
  renderer.addEvent({type:'finish-line'},run);renderer.juice._freeze=0;assert.ok(renderer.juice.step(1/60)<1/60*.5,'the finish plays in slow motion');
  for(let i=0;i<400;i++)renderer.addEvent({type:'collect',kind:'gold',value:100,x:0,z:1,totalMultiplier:30},run);
  assert.ok(renderer.juice.particles.length<=220&&renderer.juice.popups.length<=26&&renderer.juice.fliers.length<=40,'effects stay bounded');
  for(let i=0;i<5;i++)renderer.draw(run,{time:.1+i/30,dt:1/30,simDt:1/30});
  assert.ok(canvas.context.calls.includes('fillText'),'popups reach the shared 2D layer');
  const calm=new RallyRenderer(fullCanvas()),quiet=new RallyRun().reset();calm.draw(quiet,{time:0,dt:0,reducedMotion:true});
  calm.addEvent({type:'hit',hearts:2,x:0,z:0},quiet);calm.addEvent({type:'collect',kind:'bone',value:15,x:0,z:1},quiet);calm.addEvent({type:'finish-line'},quiet);
  assert.equal(calm.juice.trauma,0);assert.equal(calm.juice.frozen,false);assert.equal(calm.juice.fliers.length,0);assert.equal(calm.juice.step(1/60),1/60);
  assert.ok(calm.juice.popups.some(p=>p.text==='BONK!'));assert.deepEqual(calm.juice.offset,{x:0,y:0,rot:0,zoom:1});
  renderer.destroy();calm.destroy();
});

test('the rolling-start count and finish words are drawn from simulation time in the shared 2D layer',()=>{
  const canvas=fullCanvas(),renderer=new RallyRenderer(canvas),run=new RallyRun().reset(),texts=canvas.context.texts;
  const frame=time=>{texts.length=0;run.time=time;renderer.draw(run,{time:time+100,dt:1/30,simDt:0,reducedMotion:true});return [...texts];};
  assert.deepEqual(frame(.3),['3']);assert.deepEqual(frame(1),['2']);assert.deepEqual(frame(2),['1']);assert.deepEqual(frame(2.6),['GO!']);assert.deepEqual(frame(6),[]);
  assert.deepEqual(frame(.3),['3'],'the same simulation time always shows the same count');
  assert.deepEqual(frame(57.5),['FINISH','3']);assert.ok(frame(59.7).includes('FINISH!'));
  run.worldIndex=4;assert.ok(frame(57.5).includes('WELCOME TO BOERNE'));
  renderer.destroy();
});

test('the software fallback stays inside its triangle budget through the busiest moments of every world',()=>{
  for(const [width,height] of [[390,750],[844,390]])for(let worldIndex=0;worldIndex<5;worldIndex++){
    const canvas=softwareCanvas(width,height),renderer=new RallyRenderer(canvas),run=new RallyRun().reset({worldIndex,seed:88,charms:{shieldStart:true}});
    let most=0;
    for(const [distance,time] of [[0,.5],[40,2.2],[260,12],[640,30],[1180,52],[1390,59.5]]){
      run.distance=distance;run.time=time;run._ensureCourse();run.entities.forEach(e=>e.z=e.worldZ-run.distance);
      run.goldRushTime=5;run.feverTime=5;run.powerTime=3;run.magnetTime=4;run.multiplier=5;run.totalMultiplier=30;run.shieldCharges=2;run.splashTime=1;
      renderer.draw(run,{time:distance+1,dt:.1,simDt:.1});
      most=Math.max(most,renderer.softwareStats.triangles);
      assert.ok(renderer.softwareStats.triangles>1000&&renderer.softwareStats.triangles<5000,`${renderer.softwareStats.triangles} triangles in world ${worldIndex} at ${distance}`);
      assert.ok(renderer.softwareStats.polygons<3000);
      for(const shape of canvas.context.shapes)for(const [x,y] of shape.points){assert.ok(x>=-.001&&x<=canvas.width+.001);assert.ok(y>=-.001&&y<=canvas.height+.001);}
      canvas.context.shapes.length=0;
    }
    assert.ok(most>1500,'the scene is still rich');renderer.destroy();
  }
});
