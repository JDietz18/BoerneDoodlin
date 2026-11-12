export const PLAYABLE_IDS=['griffin','kevin','mittens','spike'];

export const CHARACTERS={
  griffin:{id:'griffin',name:'Griffin',role:'BoerneDoodle',edition:'Grants Pass to Boerne · Starring Griffin',tagline:'Goofy heart. Pure good boy. Texas bound.',intro:'Help Griffin and the family make the 2,050 story-mile move.<br>Pack the RV, run for supplies, and keep the good-boy compass pointed at Texas.',sticker:'CERTIFIED GOOD BOY NAVIGATOR',play:'Start the move',pause:'Griffin will be right here, believing in everyone.',startTouch:'Tap Jump. Gather supplies for the road.',startKeys:'Space or tap to jump. Gather supplies for the road.',run:'Griffin is positive this will be the best trip ever.',hitOne:'One heart left. Griffin still believes in the whole crew.',hit:'Who put that there? Griffin forgives them completely.',chicken:'Chicken strip acquired. Moving-day priorities: correct.',zoom:'GOOD BOY ZOOMIES! Texas is that way!',perk:'Successful supply runs add extra morale.',stats:{speed:1,jump:1,charge:1,score:1,zoom:1,magnet:0,hitbox:1,hearts:3}},
  // Pumpkin plays in the second buddy slot. The slot keeps its saved id, 'kevin', so progress made
  // with it carries over. Kevin himself stays in the story as the forever guide (see GUIDE).
  kevin:{id:'kevin',name:'Pumpkin',role:'Princess cat',edition:'Grants Pass to Boerne · Pumpkin has notes',tagline:'Royal fluff. Loud opinions. Judging every mile.',intro:'Pumpkin is a princess, and she will tell you so at length. She does not chase snacks. Snacks are summoned.',sticker:'CERTIFIED BACKSEAT ROYALTY',play:'Hit the road with Pumpkin',pause:'Pumpkin is waiting. Pumpkin does not like waiting.',startTouch:'Tap Jump. Pumpkin summons snacks from afar.',startKeys:'Space or tap to jump. Pumpkin summons snacks from afar.',run:'Pumpkin is supervising the route, loudly. Griffin is taking notes.',hitOne:'One heart left. Pumpkin has opinions about that.',hit:'Pumpkin would like to speak to whoever put that there.',chicken:'Pumpkin accepts this tribute.',zoom:'Pumpkin says: bring me everything.',perk:'Summons faraway snacks; power charges quickly.',stats:{speed:1.03,jump:1,charge:1.35,score:1,zoom:1.04,magnet:4,hitbox:.98,hearts:3}},
  mittens:{id:'mittens',name:'Mittens',role:'House panther',edition:'Grants Pass to Boerne · Mittens is in charge',tagline:'Tiny panther. Gold eyes. First one into every adventure.',intro:'Mittens is the adventurous one: a pocket panther with a yellow collar and double jumps that treat obstacles as suggestions.',sticker:'CERTIFIED HOUSE PANTHER',play:'Hit the road with Mittens',pause:'Mittens is pretending this stop was always scheduled.',startTouch:'Tap Jump. Mittens gets extra lift.',startKeys:'Space or tap to jump. Mittens double-jumps higher.',run:'Mittens is leading the route. Griffin fully supports this surprising decision.',hitOne:'One heart left. Mittens remains unimpressed.',hit:'Mittens clipped an obstacle and declines to comment.',chicken:'Road chicken obtained. Obviously deserved.',zoom:'CAT ZOOMIES! Next stop: Texas!',perk:'Supply runs bring back extra cash.',stats:{speed:.98,jump:1.12,charge:1,score:1.08,zoom:1,magnet:8,hitbox:.92,hearts:3}},
  spike:{id:'spike',name:'Spike',role:'Sulcata tortoise',edition:'Grants Pass to Boerne · Spike sets the pace',tagline:'Slow. Sturdy. Absolutely not rushed.',intro:'Spike brings a sulcata shell, four hearts, and the calm confidence of someone who knows the RV should be checked twice.',sticker:'CERTIFIED SLOW AND STEADY',play:'Hit the road with Spike',pause:'Spike is taking a thoughtful pause. This may take a minute.',startTouch:'Tap Jump. Spike has four sturdy hearts.',startKeys:'Space or tap to jump. Spike has four sturdy hearts.',run:'Spike is leading at Spike speed. Griffin thinks this is wise and possibly snack-related.',hitOne:'One heart left. Spike remains philosophically unbothered.',hit:'Spike absorbed a little road drama and kept going.',chicken:'A chicken strip has been located. Spike will consider it carefully.',zoom:'TORTOISE ZOOMIES! This is a measured emergency.',perk:'Supply runs repair the RV.',stats:{speed:.86,jump:.88,charge:.85,score:1,zoom:.9,magnet:1,hitbox:1.12,hearts:4}}
};

export const CHARACTER_ART = {
  griffin:{src:'/assets/griffin-character-atlas.png',columns:2,rows:2,regions:[[0,0,.5,.44],[.5,0,1,.44],[0,.44,.5,1],[.5,.44,1,1]],runnerWidth:158,heroWidth:330,cadence:10},
  kevin:{src:'/assets/pumpkin-atlas.png',columns:2,rows:2,runnerWidth:160,heroWidth:330,cadence:11},
  mittens:{src:'/assets/mittens-atlas.png',columns:2,rows:2,runnerWidth:138,heroWidth:310,cadence:11},
  spike:{src:'/assets/spike-atlas.png',columns:2,rows:2,runnerWidth:142,heroWidth:335,cadence:6}
};

export const ABILITIES = {
  griffin:{name:'Good-boy zoomies',key:'joy',detail:'Dash through obstacles and earn 50% more snack points.',color:'#ffd56d'},
  kevin:{name:'Royal summons',key:'radar',detail:'Faraway snacks come to her. Pumpkin does not fetch.',color:'#ffc978'},
  mittens:{name:'Panther pounce',key:'cat',detail:'Recover one heart and pounce straight through trouble.',color:'#ffc3df'},
  spike:{name:'Shell roll',key:'shell',detail:'Plow through obstacles for triple smash points.',color:'#aedd80'}
};
for(const [id,ability] of Object.entries(ABILITIES))CHARACTERS[id].stats.ability=ability.key;

// Kevin, our forever guide. He asks the favors on the quest board; he is not a playable buddy.
export const GUIDE={id:'kevin',name:'Kevin'};
