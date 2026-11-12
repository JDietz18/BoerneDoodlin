export function setupPhone({pause,notify,getScore,getCharacter,getStartHint}) {
  const $=id=>document.getElementById(id);
  const standalone=matchMedia('(display-mode: standalone)');
  const touch=matchMedia('(pointer: coarse)');
  const gameURL=new URL('/',location.href).href;
  let wakeLock=null;

  function updateDevice() {
    $('install-button').hidden=standalone.matches||navigator.standalone===true;
    document.documentElement.dataset.touch=String(touch.matches);
    if(!window.visualViewport||window.visualViewport.scale===1){
      const height=window.visualViewport?.height||window.innerHeight;
      document.documentElement.style.setProperty('--phone-height',`${Math.round(height)}px`);
    }
    $('start-hint').textContent=getStartHint?getStartHint(touch.matches):(touch.matches?'Tap to jump · Gather supplies · Reach Texas':'RUN THE ROAD · MANAGE SUPPLIES · REACH TEXAS');
  }
  standalone.addEventListener('change',updateDevice);touch.addEventListener('change',updateDevice);
  window.addEventListener('resize',updateDevice,{passive:true});window.visualViewport?.addEventListener('resize',updateDevice,{passive:true});
  window.addEventListener('orientationchange',()=>{pause();notify('New view. Tap Keep going when you’re ready.',2200);});
  updateDevice();

  function openDialog(dialog) {pause();dialog.showModal();}
  $('install-button').addEventListener('click',()=>openDialog($('install-dialog')));
  for(const dialog of [$('install-dialog'),$('share-dialog')]){
    dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  }

  async function copyLink() {
    if(!navigator.clipboard?.writeText)return false;
    try{await navigator.clipboard.writeText(gameURL);return true;}catch{return false;}
  }
  async function share(withScore=false) {
    pause();
    const score=getScore(),character=getCharacter?.()||'my road captain';
    const text=withScore?`I helped Griffin and the family score ${score.toLocaleString()} points on the move from Grants Pass to Boerne. Can you beat me?`:`Help Griffin and the family move from Grants Pass, Oregon, to Boerne, Texas, in Boerne Doodlin. Pick ${character} as road captain and pack the snacks!`;
    if(navigator.share){
      try{await navigator.share({title:'Boerne Doodlin',text,url:gameURL});return;}
      catch(error){if(error.name==='AbortError')return;}
    }
    if(await copyLink()){notify('Game link copied. Pass the snacks!');return;}
    $('share-url').value=gameURL;$('share-status').textContent='';openDialog($('share-dialog'));
  }
  $('share-button').addEventListener('click',()=>share());
  $('share-score-button').addEventListener('click',()=>share(true));
  $('share-url').addEventListener('click',()=>$('share-url').select());
  $('copy-link-button').addEventListener('click',async()=>{
    if(await copyLink()){$('share-status').textContent='Link copied. Ready to share!';}
    else{$('share-url').focus();$('share-url').select();$('share-url').setSelectionRange(0,$('share-url').value.length);$('share-status').textContent='Touch and hold the selected link, then choose Copy.';}
  });

  async function keepAwake(running) {
    if(!running){try{await wakeLock?.release();}catch{}wakeLock=null;return;}
    if(!navigator.wakeLock||document.visibilityState!=='visible')return;
    try{const lock=await navigator.wakeLock.request('screen');if(document.documentElement.dataset.gameMode!=='running'){await lock.release();return;}wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null;});}catch{}
  }
  document.addEventListener('griffin:mode',e=>keepAwake(e.detail==='running'));

  if('serviceWorker' in navigator){
    window.addEventListener('load',()=>{
      navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{});
    },{once:true});
  }
}
