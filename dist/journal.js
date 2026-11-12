export const JOURNAL_KEY='boerne-doodlin-journal-v1';
export const BADGES=[
  {id:'first-outing',name:'Snack scout',detail:'Finish a character outing.'},
  {id:'combo',name:'Snack symphony',detail:'Collect a chain of 10 snacks.'},
  {id:'clean-road',name:'Smooth operator',detail:'Drive a leg without a bump.'},
  {id:'crew',name:'Family affair',detail:'Take all four characters on an outing.'},
  {id:'upgrade',name:'Home on wheels',detail:'Upgrade the family RV.'},
  {id:'desert',name:'Desert doodlin',detail:'Make it through the Mojave.'},
  {id:'home',name:'BoerneDoodle',detail:'Bring the family home to Boerne.'},
  {id:'postcards',name:'Every little mile',detail:'Collect all seven stop postcards.'}
];
export class Journal{
  constructor(raw){
    try{raw=typeof raw==='string'?JSON.parse(raw):raw;}catch{raw=null;}
    this.badges=[...new Set((Array.isArray(raw?.badges)?raw.badges:[]).filter(id=>BADGES.some(b=>b.id===id)))];
    this.crew=[...new Set((Array.isArray(raw?.crew)?raw.crew:[]).filter(id=>['griffin','kevin','mittens','spike'].includes(id)))];
    const cards=Array.isArray(raw?.postcards)?raw.postcards.filter(p=>p&&Number.isInteger(p.leg)&&p.leg>0&&p.leg<8):[];
    this.postcards=[...new Map(cards.map(p=>[p.leg,{...p,stars:Math.max(1,Math.min(3,Math.round(p.stars)||1))}])).values()];
    this.bestCombo=Math.max(0,Number(raw?.bestCombo)||0);this.arcadeBest=Math.max(0,Number(raw?.arcadeBest)||0);
    this.runs=Math.max(0,Number(raw?.runs)||0);this.trips=Math.max(0,Number(raw?.trips)||0);
  }
  earn(id){const badge=BADGES.find(b=>b.id===id);if(!badge||this.badges.includes(id))return null;this.badges.push(id);return badge;}
  outing({captain,combo=0,score=0,arcade=false}){
    this.runs++;this.bestCombo=Math.max(this.bestCombo,combo);
    if(arcade)this.arcadeBest=Math.max(this.arcadeBest,score);
    if(!this.crew.includes(captain))this.crew.push(captain);
    const earned=[this.earn('first-outing')];
    if(combo>=10)earned.push(this.earn('combo'));
    if(this.crew.length===4)earned.push(this.earn('crew'));
    return earned.filter(Boolean);
  }
  road(report){
    const old=this.postcards.find(p=>p.leg===report.leg);
    if(!old)this.postcards.push({...report});else if(report.stars>old.stars)Object.assign(old,report);
    const earned=[];
    if(report.hits===0)earned.push(this.earn('clean-road'));
    if(report.leg>=3)earned.push(this.earn('desert'));
    if(this.postcards.length===7)earned.push(this.earn('postcards'));
    return earned.filter(Boolean);
  }
  serialize(){return {badges:this.badges,crew:this.crew,postcards:this.postcards,bestCombo:this.bestCombo,arcadeBest:this.arcadeBest,runs:this.runs,trips:this.trips};}
}
