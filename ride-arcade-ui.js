// Development-only Physics Lab. UI never applies physical forces.
const CONTROLS=[['steering','Steering response'],['grip','Corner grip'],['balance','Lean and air balance'],
  ['wheelie','Wheelie stability'],['stoppie','Stoppie stability'],['air','Air trick control'],
  ['landing','Predictive landing'],['camera','Camera stability']];
export function mountPhysicsLab(parent,handling,{storage=globalThis.localStorage,engine='classic',onEngineChange=null,onBiomeJump=null}={}){
  const root=document.createElement('section');
  root.setAttribute('data-wk-physics-lab','');
  root.style.cssText='position:absolute;right:12px;bottom:110px;z-index:45;width:min(285px,88vw);pointer-events:auto;font:12px system-ui,sans-serif;color:#eafff2;text-align:left';
  const button=document.createElement('button');button.type='button';button.textContent='⚙ ARCADE LAB';
  button.setAttribute('data-wk-lab-toggle','');
  button.style.cssText='display:block;margin-left:auto;padding:8px 12px;border:1px solid #74c99a;border-radius:9px;background:#101f1be8;color:#effff4;font:700 12px system-ui;cursor:pointer';
  const panel=document.createElement('div');panel.hidden=true;
  panel.style.cssText='background:#102019f5;border:1px solid #74c99a;border-radius:12px;padding:12px;max-height:min(55vh,430px);overflow:auto;box-shadow:0 12px 24px #0009';
  const title=document.createElement('strong');title.textContent='CLASSIC ARCADE LAB';panel.append(title);
  if(onEngineChange){
    const engineRow=document.createElement('label');engineRow.textContent='Bike engine  ';engineRow.style.cssText='display:block;margin:9px 0';
    const engineSelect=document.createElement('select');engineSelect.setAttribute('aria-label','Bike physics engine');
    engineSelect.style.cssText='color:#fff;background:#214337;border:1px solid #598c79;border-radius:5px;padding:5px';
    for(const [value,label] of [['classic','Classic custom'],['v3','V3 independent 3D']]){
      const option=document.createElement('option');option.value=value;option.textContent=label;engineSelect.append(option);
    }
    engineSelect.value=engine;
    engineSelect.addEventListener('change',()=>{if(engineSelect.value!==engine)onEngineChange(engineSelect.value);});
    engineRow.append(engineSelect);panel.append(engineRow);
  }
  if(onBiomeJump){
    const biomeRow=document.createElement('label');biomeRow.textContent='Ride to biome  ';biomeRow.style.cssText='display:block;margin:8px 0';
    const jump=document.createElement('select');jump.setAttribute('aria-label','Ride to biome');
    jump.style.cssText='color:#fff;background:#214337;border:1px solid #598c79;border-radius:5px;padding:5px';
    for(const [value,label] of [['','Choose a place…'],['forest','🌲 Mountain forest'],['valley','🌿 Lake valley'],['desert','🏜️ Red canyon']]){
      const option=document.createElement('option');option.value=value;option.textContent=label;jump.append(option);
    }
    jump.addEventListener('change',()=>{if(jump.value)onBiomeJump(jump.value);jump.value='';});
    biomeRow.append(jump);panel.append(biomeRow);
  }
  const modeLabel=document.createElement('label');modeLabel.style.cssText='display:block;margin:9px 0';modeLabel.textContent='Mode  ';
  const modeSelect=document.createElement('select');modeSelect.setAttribute('aria-label','Handling mode');
  modeSelect.style.cssText='color:#f1fff6;background:#214337;border:1px solid #598c79;border-radius:5px;padding:5px';
  for(const mode of ['original','balanced','arcade','custom']){
    const option=document.createElement('option');option.value=mode;option.textContent=mode[0].toUpperCase()+mode.slice(1);modeSelect.append(option);
  }
  modeLabel.append(modeSelect);panel.append(modeLabel);
  const sliders=new Map();
  for(const [key,label] of CONTROLS){
    const row=document.createElement('label');row.style.cssText='display:block;margin:7px 0';
    const top=document.createElement('span');top.style.cssText='display:flex;justify-content:space-between';
    const name=document.createElement('span');name.textContent=label;
    const val=document.createElement('output');top.append(name,val);
    const slider=document.createElement('input');slider.type='range';slider.min='0';slider.max='100';slider.step='5';
    slider.setAttribute('aria-label',label);slider.style.cssText='width:100%;accent-color:#55df9d;margin:3px 0';
    slider.addEventListener('input',()=>{handling.setSetting(key,Number(slider.value)/100);persist();sync();});
    row.append(top,slider);panel.append(row);sliders.set(key,{slider,val});
  }
  const info=document.createElement('div');info.style.cssText='font:11px/1.45 monospace;border-top:1px solid #52705c;padding-top:7px;margin-top:8px';panel.append(info);
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:10px';
  const makeButton=(label,callback)=>{
    const el=document.createElement('button');el.type='button';el.textContent=label;
    el.style.cssText='padding:7px;border:1px solid #577e65;border-radius:5px;background:#254937;color:white;cursor:pointer';
    el.addEventListener('click',callback);actions.append(el);
  };
  makeButton('Original',()=>{handling.setMode('original');persist();sync();});
  makeButton('Copy JSON',()=>{
    const json=JSON.stringify(handling.snapshot(),null,2);
    if(globalThis.navigator?.clipboard?.writeText)globalThis.navigator.clipboard.writeText(json).catch(()=>{});
  });
  makeButton('Save JSON',()=>{
    const data=JSON.stringify({mode:handling.getMode(),settings:handling.getSettings()},null,2);
    const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='wheelie-king-arcade.json';
    anchor.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  });
  const upload=document.createElement('input');upload.type='file';upload.accept='.json,application/json';upload.hidden=true;
  upload.addEventListener('change',async()=>{
    try{
      const file=upload.files?.[0];if(!file)return;
      const parsed=JSON.parse(await file.text());handling.setCustom(parsed.settings||parsed);
      persist();sync();
    }catch(e){globalThis.alert?.('Invalid Physics Lab JSON');}
    upload.value='';
  });
  makeButton('Import',()=>upload.click());
  panel.append(actions,upload);root.append(button,panel);parent.append(root);
  function persist(){
    try{storage?.setItem('wk-classic-arcade-mode',handling.getMode());
      if(handling.getMode()==='custom')storage?.setItem('wk-classic-arcade-custom',JSON.stringify(handling.getSettings()));
    }catch{}
  }
  function sync(){
    modeSelect.value=handling.getMode();const settings=handling.getSettings();
    for(const [key,{slider,val}] of sliders){
      const v=Math.round(Math.max(0,Math.min(1,settings[key]||0))*100);
      slider.value=String(v);val.textContent=String(v)+'%';
    }
  }
  modeSelect.addEventListener('change',()=>{handling.setMode(modeSelect.value);persist();sync();});
  button.addEventListener('click',()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));});
  sync();let lastInfoAt=0;
  return {update(s,now=performance.now()){
    if(panel.hidden||now-lastInfoAt<150)return;lastInfoAt=now;
    const d=handling.snapshot(),contacts=s.ground||[false,false];
    info.textContent='STATE '+d.state+' · Wheels '+Number(!!contacts[0])+'/'+Number(!!contacts[1])+
      ' · '+Math.round((s.vx||0)*3.6)+' km/h · '+d.mode+
      (d.prediction?' · landing '+d.prediction.time.toFixed(2)+'s':'');
  },dispose(){root.remove();}};
}
