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
