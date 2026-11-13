// Development-only Physics Lab. UI never applies physical forces.
const CONTROLS=[['steering','Steering response'],['balance','Mid-air balance'],['grip','Corner grip'],
  ['air','Air pitch control'],['landing','Landing assist'],['wheelie','Wheelie stability']];
export function mountPhysicsLab(parent,handling,{storage=globalThis.localStorage}={}){
  const root=document.createElement('section');
  root.setAttribute('data-wk-physics-lab','');
  root.style.cssText='position:absolute;right:12px;bottom:110px;z-index:45;width:min(285px,88vw);pointer-events:auto;font:12px system-ui,sans-serif;color:#eafff2;text-align:left';
  const button=document.createElement('button');button.type='button';button.textContent='⚙ PHYSICS LAB';
  button.setAttribute('data-wk-lab-toggle','');
  button.style.cssText='display:block;margin-left:auto;padding:8px 12px;border:1px solid #74c99a;border-radius:9px;background:#101f1be8;color:#effff4;font:700 12px system-ui;cursor:pointer';
  const panel=document.createElement('div');panel.hidden=true;
  panel.style.cssText='background:#102019f5;border:1px solid #74c99a;border-radius:12px;padding:12px;max-height:min(55vh,430px);overflow:auto;box-shadow:0 12px 24px #0009';
  const title=document.createElement('strong');title.textContent='HANDLING CONTROLLER';panel.append(title);
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
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:8px;margin-top:10px';
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
  panel.append(actions);root.append(button,panel);parent.append(root);
  function persist(){
    try{storage?.setItem('wk-arcade-mode',handling.getMode());
      if(handling.getMode()==='custom')storage?.setItem('wk-arcade-custom',JSON.stringify(handling.getSettings()));
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
      ' · '+Math.round((s.vx||0)*3.6)+' km/h · '+d.mode;
  },dispose(){root.remove();}};
}
