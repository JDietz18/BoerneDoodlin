// Thirty original, replayable courses. Coordinates use y-down world space;
// platform x/y are their top-left corner, entity x/y are their center.
export const WORLDS=Object.freeze([
  {id:'river',index:0,name:'Rogue River',tagline:'Follow the water. Follow your nose.',theme:'river'},
  {id:'redwood',index:1,name:'Redwood Run',tagline:'Small paws. Very tall trees.',theme:'redwoods'},
  {id:'canyon',index:2,name:'Painted Canyon',tagline:'Big skies and hidden snack trails.',theme:'canyon'},
  {id:'mesa',index:3,name:'Starlight Mesa',tagline:'Kevin knows the way after dark.',theme:'night'},
  {id:'boerne',index:4,name:'Boerne Hills',tagline:'The whole crew is almost home.',theme:'texas'}
].map(Object.freeze));
const TITLES=[
  ['First Pawprints','Riverbend Ribbons','Creekside Curios','Picnic Peak','Falls and Fetch','The Paddle Bandit'],
  ['Tall Tails','Canopy Crumbs','Mossy Switchbacks','Fern Fort Hideout','Treetop Treasure','The Acorn Guardian'],
  ['Sandstone Steps','Cactus Courtyard','Echo Ravine','The Painted Passage','Sunset Switchback','The Canyon Crumbler'],
  ['Moonrise Meadows','Firefly Footpaths','Comet Lookout','The Quiet Observatory','Kevin’s Star Trail','The Midnight Muncher'],
  ['Bluebonnet Bounce','Creekhouse Crossing','Porchlight Promenade','Hill Country Hideaway','The Homeward Hop','The Great Welcome Home']
];
const SUBTITLES=['Learn the trail, find two keys, and follow the good things.','Try the high path. Something golden is waiting.','Every detour has a story. And usually a snack.','Look above the obvious route for a little surprise.','Bring your best jumps and your biggest snack stack.','Three gentle stomps settle this snack dispute.'];
export const LEVELS=Object.freeze(WORLDS.flatMap(world=>TITLES[world.index].map((title,index)=>Object.freeze({
  id:`${world.id}-${index+1}`,worldIndex:world.index,index,globalIndex:world.index*6+index,
  title,subtitle:SUBTITLES[index],parTime:145+world.index*8+(index%3)*12+(index===5?20:0),
  requiredKeys:2,goldTarget:3,boss:index===5,theme:world.theme
}))));
const hash=text=>{let n=2166136261;for(const c of String(text))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const randomFor=seed=>{let n=seed>>>0;return()=>{n=(n+0x6d2b79f5)>>>0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};};

export function getLevel(id='river-1',{seed,remix=false}={}){
  const meta=LEVELS.find(level=>level.id===id)||LEVELS[0];
  const layoutSeed=remix?(Number(seed)>>>0)||hash(meta.id+':remix'):hash(meta.id+':onward');
  const random=randomFor(layoutSeed),platforms=[],entities=[],zones=[],sectionShapes=[];
  let pId=0,eId=0;
  const platform=(x,y,w,h=24,type='grass',extra={})=>{const p={id:`p${++pId}`,x,y,w,h,type,oneWay:type!=='ground'&&type!=='block',active:true,...extra};platforms.push(p);return p;};
  const entity=(type,x,y,w=30,h=30,extra={})=>{const e={id:`e${++eId}`,type,x,y,w,h,taken:false,...extra};entities.push(e);return e;};
  const coinLine=(x,y,count=5,spacing=62)=>{for(let i=0;i<count;i++)entity('bone',x+i*spacing,y,26,24);};
  const sections=10+(meta.index%3),span=900,start=640,finishStart=start+sections*span,width=finishStart+1500;
  const goldSections=[1,Math.floor(sections/2),sections-2],keySections=[3,sections-3],secretSection=Math.floor(sections/2)+1;
  platform(0,480,640,120,'ground');coinLine(170,442,6,65);
  entity('sign',150,390,40,60,{text:'Move freely. Hold jump for height. Jump again in the air.'});
  // A safe first jump teaches the controls without spending a heart.
  platform(360,412,150);coinLine(390,376,2,64);
  for(let section=0;section<sections;section++){
    const x=start+section*span;
    const elevated=section>0&&(section+meta.index+meta.worldIndex)%4===2;
    const floorY=elevated?456:480;
    const gap=126+Math.floor(random()*45)+Math.min(15,meta.worldIndex*3);
    platform(x,floorY,570,600-floorY,'ground');
    platform(x+570+gap,480,span-570-gap,120,'ground');
    zones.push({x:x+570,y:480,w:gap,h:120,type:meta.worldIndex===2?'ravine':'water'});
    const shape=(section+meta.index+meta.worldIndex)%3;
    sectionShapes.push({index:section,shape:['canopy-steps','spring-bridge','moving-terraces'][shape],x,width:span});
    let first;
    if(shape===0){
      first=platform(x+125,floorY-78,145,24,(section+meta.index)%4===2||meta.worldIndex===2?'crumble':'grass',{crumbleAfter:1.1});
      platform(x+275,floorY-156,145,24,'grass');
    }else if(shape===1){
      first=platform(x+125,floorY-66,230,24,'grass');
      platform(x+330,floorY-142,116,24,'grass');
      platform(x+505,floorY-62,310,22,meta.worldIndex===2?'crumble':'bridge',{crumbleAfter:1.45});
      entity('spring',x+245,first.y-10,46,20,{groundY:first.y});
    }else{
      first=platform(x+110,floorY-78,174,24,'moving',{axis:'y',range:18,speed:.85+meta.worldIndex*.06,originX:x+110,originY:floorY-78,phase:random()*Math.PI*2});
      platform(x+285,floorY-156,166,24,'moving',{axis:'x',range:28,speed:.8+meta.worldIndex*.06,originX:x+285,originY:floorY-156,phase:random()*Math.PI*2});
    }
    platform(x+435,floorY-234,175,24,'grass');
    const movingDescent=section%3===1||(meta.worldIndex===1&&section%2===0);
    platform(x+640,floorY-156,145,24,movingDescent?'moving':'grass',movingDescent?{axis:'x',range:42,speed:.9,originX:x+640,originY:floorY-156,phase:random()*Math.PI*2}:{});
    platform(x+770,floorY-78,120,24,'grass');
    if(section%4===3)platform(x+580,476,gap-16,18,'crumble',{crumbleAfter:.85});
    coinLine(x+70,floorY-32,5,96);
    coinLine(first.x+26,first.y-32,2,70);coinLine(x+310,floorY-188,2,66);coinLine(x+465,floorY-266,2,74);
    const block=platform(x+54,floorY-150,48,48,'block',{used:false});
    entity('block',block.x+24,block.y+24,48,48,{platformId:block.id,used:false,contains:section%5===4?'heart':'bones'});
    if(goldSections.includes(section))entity('gold',x+555,floorY-274,38,38,{ordinal:goldSections.indexOf(section)+1});
    if(keySections.includes(section))entity('key',x+490,floorY-274,30,34,{ordinal:keySections.indexOf(section)+1});
    if(section===secretSection){
      platform(x+500,floorY-324,180,22,'secret',{secret:true});
      entity('chest',x+595,floorY-349,48,46,{secret:true,revealed:false,reward:12});
      coinLine(x+535,floorY-357,2,45);
    }
    if(section===2||section===sections-2)entity('chest',x+820,floorY-103,44,42,{secret:false,reward:8});
    if(section>0&&(section+meta.worldIndex)%2===0){
      const size=42;entity('enemy',x+390,floorY-size/2,44,size,{subtype:'patrol',hp:1,vx:52+meta.worldIndex*8,left:x+245,right:x+535,groundY:floorY,hurtTime:0});
    }
    if(section%3===1||(meta.worldIndex===4&&section%2===0))entity('spring',x+840,470,46,20,{groundY:480});
    if([3,6,9].includes(section))entity('checkpoint',x+48,floorY-42,34,84,{spawnX:x+78,spawnY:floorY,active:false});
    if(section%4===2)entity('magnet',x+355,floorY-196,30,30);
    if(section%5===4)entity('shield',x+710,floorY-196,30,30);
    if(section===keySections[0])entity('sign',x+90,floorY-90,35,45,{text:'The high path holds a key. Two keys open the snack stop.'});
    if(section===secretSection)entity('sign',x+90,floorY-90,35,45,{text:'The best surprises are one jump above the high path.'});
  }
  platform(finishStart,480,1500,120,'ground');coinLine(finishStart+70,442,5,75);
  entity('checkpoint',finishStart+100,438,34,84,{spawnX:finishStart+130,spawnY:480,active:false});
  if(meta.boss){
    entity('enemy',finishStart+680,432,108,96,{subtype:'boss',name:['Paddle Bandit','Acorn Guardian','Canyon Crumbler','Midnight Muncher','Welcome-Home Rumbler'][meta.worldIndex],hp:3,maxHp:3,vx:65+meta.worldIndex*7,left:finishStart+450,right:finishStart+1030,groundY:480,hurtTime:0});
    platform(finishStart+360,398,150);platform(finishStart+1040,398,150);
    entity('sign',finishStart+225,390,40,60,{text:'Three stomps from above—or a well-timed power—settle the snack dispute.'});
  }
  entity('goal',width-175,400,90,160,{requiredKeys:2,requiresBoss:meta.boss});
  return {...meta,seed:layoutSeed,remix:Boolean(remix),width,height:600,spawn:{x:120,y:480},platforms,entities,zones,sectionShapes};
}
