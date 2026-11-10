const driveButton=(kind,label,icon)=>`<button type="button" class="ride-drive ${kind}" data-t="${kind}" aria-label="${label}">${icon}</button>`;
const brakeIcon='<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4"><circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="15"/><circle cx="32" cy="32" r="6"/><path d="M32 9v8M32 47v8M9 32h8M47 32h8M16 16l6 6M42 42l6 6M16 48l6-6M42 22l6-6"/></g></svg>';
const gasIcon='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 32l16-16 16 16M16 48l16-16 16 16" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const glyph={hop:'M16 6V0 M12 4l4-4 4 4',tailwhip:'M12 4C0-2-2 13 6 15 M2 14l4 1-1-5',barspin:'M22 3c9-5 12 6 5 8 M30 7l-3 4-3-3',superman:'M4 4l17 2 5 4 M12 5L5 9 M20 4l3-3',trick:'M6 7C18-5 34 4 29 13 M26 9l3 4 3-3'};
const trickButton=(key,label)=>`<button data-t="${key}" type="button" aria-label="${label}"><svg viewBox="0 0 32 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="17" r="5"/><circle cx="26" cy="17" r="5"/><path d="M7 17l7-9 5 9H7m7-9h9l3 9M12 5h6m2-3 4 5"/><path d="${glyph[key]}"/></g></svg><span>${label}</span></button>`;
export const rideControlsMarkup=()=>`<div class="ride-controls">
 <div class="ride-hop ride-tricks">${trickButton('hop','HOP')}</div>
 <div class="ride-lean-buttons"><button type="button" data-t="leanBack" aria-label="Lean back">‹</button><button type="button" data-t="leanForward" aria-label="Lean forward">›</button></div>
 <div class="ride-tricks"><button class="ride-slow" data-r="slow" aria-pressed="false" hidden>SLOW MO</button><button type="button" class="ride-tricks-toggle" data-r="tricks" aria-label="Tricks" aria-expanded="false" aria-haspopup="true">TRICKS</button><div class="ride-tricks-fan">${[['tailwhip','TAILWHIP'],['barspin','BARSPIN'],['superman','SUPERMAN'],['trick','360']].map(([key,label])=>trickButton(key,label)).join('')}</div></div>
 <div class="ride-drive-buttons">${driveButton('brake','Brake / reverse',brakeIcon)}${driveButton('throttle','Accelerate',gasIcon)}</div>
</div>`;
export function mountLeanControls(ui,touch){
 const release=()=>{touch.lean=0;touch.leanBack=0;touch.leanForward=0};release();return {update(){},release,state:()=>({active:!!(touch.leanBack||touch.leanForward),value:(touch.leanForward||0)-(touch.leanBack||0)})};
}
export function mountTricksMenu(ui){
 const root=ui.querySelector('.ride-tricks:not(.ride-hop)');
 const toggle=root?.querySelector('[data-r=tricks]');
 if(!root||!toggle)return {close(){},state:()=>({open:false})};
 let timer=null;
 const close=()=>{root.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');clearTimeout(timer);timer=null};
 const arm=()=>{clearTimeout(timer);timer=setTimeout(close,2000)};
 const open=()=>{root.classList.add('is-open');toggle.setAttribute('aria-expanded','true');arm()};
 toggle.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(root.classList.contains('is-open'))close();else open()});
 root.querySelector('.ride-tricks-fan')?.addEventListener('pointerdown',arm,true);
 return {close,state:()=>({open:root.classList.contains('is-open')})};
}
if(typeof document!=='undefined'){
 const style=document.createElement('style');style.textContent=`
 [data-wk-ride-surface]{--lean-size:clamp(48px,6vw,82px);--trick-size:clamp(44px,5.1vw,74px)}[data-wk-ride-surface] .ride-controls{position:absolute;left:14px;right:14px;bottom:18px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;align-items:end;gap:16px;pointer-events:auto;font:900 11px system-ui;--lean-size:clamp(48px,6vw,82px);--trick-size:clamp(44px,5.1vw,74px)}
 [data-wk-paused] [data-h="msg"]{top:12px!important;font-size:18px!important}[data-r="recover"][hidden]{display:none!important}[data-wk-crashed] .ride-controls{opacity:.35;pointer-events:none}[data-wk-crashed] .ride-controls button{pointer-events:none}[data-wk-paused] .ride-controls{opacity:.4}[data-wk-paused] .ride-controls button{pointer-events:none}[data-wk-paused] .ride-pause-fab,[data-wk-paused] .ride-pause-menu{pointer-events:auto} .ride-lean-buttons,.ride-drive-buttons{display:flex;align-items:end;gap:clamp(7px,1vw,14px)}.ride-drive-buttons{justify-self:end}.ride-lean-buttons button,.ride-drive{border:3px solid #c8c9c6;border-radius:50%;background:linear-gradient(145deg,#424743d9,#121616df);color:#f8f9f4;box-shadow:0 5px 12px #0009,inset 0 1px 2px #fff4;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}
 .ride-lean-buttons button{width:var(--lean-size);height:var(--lean-size);font:700 calc(var(--lean-size)*.95) system-ui;line-height:.7;padding-bottom:9px;text-shadow:0 2px 3px #000}.ride-drive.brake{width:var(--lean-size);height:var(--lean-size)}.ride-drive.throttle{width:calc(var(--lean-size)*1.3);height:calc(var(--lean-size)*1.3);border-color:#a8e600;color:#b5f300;background:radial-gradient(circle at 40% 30%,#344028ed,#10170bed);box-shadow:0 0 17px #a4ff0033,0 5px 12px #0009}.ride-drive svg{width:70%;height:70%;filter:drop-shadow(0 3px 1px #0009)}
 .ride-glass{background:linear-gradient(135deg,#1c2d478f,#0a1428c4);border:1px solid #c7f4df66;border-radius:16px;backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);box-shadow:0 10px 28px #000a,inset 0 1px #ffffff22;color:#edfdf4;pointer-events:auto}
 .ride-glass[hidden],.ride-tricks .ride-slow[hidden]{display:none}
 .ride-finish,.ride-replay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;padding:16px;z-index:12;width:min(920px,94vw);max-width:94%;max-height:min(92vh,820px);box-sizing:border-box;overflow:auto}
 .ride-finish strong{color:#8cfca9}.ride-finish p{margin:6px 0 10px;font:700 14px system-ui}
 .ride-finish button,.ride-replay button,.ride-replay a{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 14px;margin:0;border:1px solid #80fbb285;border-radius:10px;background:linear-gradient(180deg,#2c4a40ee,#1a2e27f0);color:#fff;font:800 13px system-ui;text-decoration:none;cursor:pointer;transition:transform .12s,filter .12s,background .12s,box-shadow .12s}
 .ride-finish button:hover,.ride-replay button:hover,.ride-replay a:hover{filter:brightness(1.12);box-shadow:0 0 12px #39ff7a33}
 .ride-finish button:active,.ride-replay button:active,.ride-replay a:active{transform:translateY(1px) scale(.98)}
 .ride-finish [data-r=restart]{background:linear-gradient(180deg,#a6f5b0,#6edc84);color:#142b1b;border-color:#c8ffd8}
 .ride-finish-photos{display:flex;justify-content:center;gap:8px;margin-bottom:8px}.ride-finish-photos:empty{display:none}
 .ride-finish-photos canvas{width:clamp(70px,15vw,155px);border:3px solid #e0efe7;border-bottom-width:8px;border-radius:3px;transform:rotate(-3deg)}.ride-finish-photos canvas:nth-child(2){transform:rotate(3deg)}
 .ride-replay{z-index:14;text-align:left}
 .ride-replay-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
 .ride-replay-head strong{color:#8cfca9;font:900 18px system-ui;letter-spacing:.4px}
 .ride-replay-x{min-width:40px!important;padding:8px 10px!important}
 .ride-replay-layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(200px,.9fr);gap:14px;align-items:start}
 .ride-replay-main{min-width:0}
 .ride-replay-stage{position:relative;border-radius:12px;overflow:hidden;background:#050a08;border:1px solid #75eeaf44;aspect-ratio:16/9}
 .ride-replay video{display:block;width:100%;height:100%;object-fit:contain;background:#050a08}
 .ride-replay-overlay-play{position:absolute;inset:50% auto auto 50%;transform:translate(-50%,-50%);width:78px;height:78px;border-radius:50%!important;border:3px solid #d9ffe8!important;background:#0d2418e8!important;color:#d9ffe8!important;font:900 28px system-ui!important;box-shadow:0 0 24px #39ff7a66,0 8px 20px #000a;z-index:2}
 .ride-replay-overlay-play:hover{background:#95ef9f!important;color:#142b1b!important;transform:translate(-50%,-50%)!important}
 .ride-replay button.ride-replay-overlay-play:active{transform:translate(-50%,-50%) scale(.96)!important}
 .ride-replay-overlay-play[hidden]{display:none!important}
 .ride-replay-scrub{display:flex;align-items:center;gap:10px;margin:10px 0 8px;font:700 12px system-ui;color:#c7ead6}
 .ride-replay-scrub label{display:flex;align-items:center;gap:8px;flex:1}
 .ride-replay-scrub input,.ride-theatre-seek input{flex:1;width:100%;accent-color:#6dff9a}
 .ride-replay-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
 .ride-replay-playbtn{min-width:52px}
 .ride-replay-drop{background:linear-gradient(180deg,#a6f5b0,#6edc84)!important;color:#142b1b!important;border-color:#c8ffd8!important;font-weight:900!important}
 .ride-icon-btn{min-width:44px;min-height:44px;padding:8px!important;font-size:18px!important}
 .ride-replay-library{min-width:0;max-height:min(58vh,460px);overflow:auto;padding:4px}
 .ride-replay-library h3{margin:0 0 8px;font:900 13px system-ui;color:#9be7bc;letter-spacing:.3px}
 .ride-replay-latest,.ride-replay-item{display:flex;gap:10px;align-items:center;width:100%;text-align:left;padding:8px!important;margin-bottom:7px;background:#12281fe8!important}
 .ride-replay-latest[aria-pressed=true],.ride-replay-item[aria-pressed=true]{outline:2px solid #7dffb0;background:#1d3f32!important}
 .ride-replay-thumb{width:84px;height:48px;border-radius:8px;object-fit:cover;background:#0a1410;flex:0 0 auto;border:1px solid #75eeaf55}
 .ride-replay-thumb-live{display:flex;align-items:center;justify-content:center;font:900 11px system-ui;color:#95ef9f;letter-spacing:.5px}
 .ride-replay-meta{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
 .ride-replay-meta strong{font:800 12px system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .ride-replay-meta small{font:600 10px system-ui;opacity:.8;color:#b7dcc8}
 .ride-replay-del{margin-left:auto!important;min-width:36px!important;padding:6px!important;background:#3a2222cc!important;border-color:#f88!important}
 .ride-replay-theatre{display:none}
 .ride-replay.is-theatre{width:min(1100px,98vw);max-height:96vh;padding:12px}
 .ride-replay.is-theatre .ride-replay-library,.ride-replay.is-theatre .ride-replay-actions,.ride-replay.is-theatre .ride-replay-scrub,.ride-replay.is-theatre .ride-replay-overlay-play{display:none!important}
 .ride-replay.is-theatre .ride-replay-layout{grid-template-columns:1fr}
 .ride-replay.is-theatre .ride-replay-stage{aspect-ratio:16/9;max-height:72vh}
 .ride-replay.is-theatre .ride-replay-theatre{display:flex;flex-direction:column;gap:10px;margin-top:10px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#1c2d478f,#0a1428c4);border:1px solid #c7f4df55;backdrop-filter:blur(12px)}
 .ride-theatre-close{align-self:flex-end;min-width:42px}
 .ride-theatre-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
 .ride-theatre-seek{display:flex;align-items:center;gap:8px;flex:1 1 180px;font:700 12px system-ui;color:#c7ead6}
 .ride-pause-fab{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:15;display:inline-flex;align-items:center;gap:8px;padding:11px 22px;font:900 15px system-ui;letter-spacing:.4px;cursor:pointer;border:2px solid #8dffb8;background:linear-gradient(180deg,#163528f2,#0d2418f2);color:#d9ffe8;box-shadow:0 0 18px #39ff7a55,0 6px 16px #000a;pointer-events:auto;border-radius:999px}
 .ride-pause-fab-ico{font-size:18px;line-height:1}
 .ride-pause-fab[aria-expanded=true],.ride-pause-fab:hover{background:linear-gradient(180deg,#a6f5b0,#6edc84);color:#142b1b;border-color:#c8ffd8}
 .ride-pause-menu{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:16;padding:18px 18px 16px;display:flex;flex-direction:column;gap:10px;width:min(360px,92vw);text-align:center;pointer-events:auto}
 .ride-pause-menu[hidden]{display:none!important}
 .ride-pause-head strong{display:block;color:#8cfca9;font:900 22px system-ui;letter-spacing:.6px}
 .ride-pause-head p{margin:4px 0 2px;font:600 12px system-ui;color:#b7dcc8;opacity:.9}
 .ride-pause-menu button{padding:12px 14px;border:1px solid #80fbb285;border-radius:11px;background:linear-gradient(180deg,#2c4a40ee,#1a2e27f0);color:#fff;font:800 14px system-ui;cursor:pointer;transition:transform .12s,filter .12s}
 .ride-pause-menu button:hover{filter:brightness(1.1)}
 .ride-pause-menu button:active{transform:translateY(1px) scale(.98)}
 .ride-pause-primary{background:linear-gradient(180deg,#a6f5b0,#6edc84)!important;color:#142b1b!important;border-color:#c8ffd8!important;font-size:16px!important;padding:14px!important;box-shadow:0 0 16px #39ff7a44}
 .ride-pause-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
 .ride-pause-mode{display:flex;flex-direction:column;gap:6px;text-align:left}
 .ride-pause-mode-label{font:800 11px system-ui;color:#9be7bc;letter-spacing:.4px}
 .ride-pause-seg{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border:1px solid #80fbb285;border-radius:11px;overflow:hidden}
 .ride-pause-seg button{border:0;border-radius:0;margin:0;background:#162820}
 .ride-pause-seg button[aria-pressed=true]{background:linear-gradient(180deg,#3d6b55,#245440);color:#d9ffe8}
 .ride-pause-replay{margin-top:2px}
 .ride-replay-alert{position:absolute;top:50px;right:10px;padding:8px 12px;z-index:13;animation:ride-replay-pulse 1s alternate infinite}
 @keyframes ride-replay-pulse{to{box-shadow:0 0 13px #7eff9d}}
 .ride-crash-actions{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:12;display:flex;flex-wrap:nowrap;justify-content:center;gap:8px;align-items:center;pointer-events:auto;max-width:min(96vw,820px);padding:0 8px}
 .ride-crash-actions[hidden]{display:none!important}
 .ride-crash-actions .ride-crash-btn{flex:0 1 auto;box-sizing:border-box;min-width:0;height:42px;padding:0 14px;border-radius:12px;border-width:1px;font:800 13px system-ui,sans-serif;letter-spacing:.06em;white-space:nowrap;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer}
 .ride-rewind.is-held,.ride-crash-actions .ride-crash-btn:active{transform:translateY(1px) scale(.98)}
 .ride-rewind{position:absolute;z-index:13;right:14px;bottom:calc(18px + var(--lean-size)*1.3 + 22px);width:56px;height:56px;box-sizing:border-box;border-radius:50%;padding:0 6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;font:800 9px system-ui,sans-serif;letter-spacing:.05em;line-height:1.05;text-align:center;pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer;border-width:1px}
 .ride-rewind[hidden]{display:none!important}
 .ride-tricks:not(.ride-hop){display:flex;flex-direction:column;align-items:flex-end;justify-self:end;align-self:end;grid-column:2;grid-row:1;position:relative;margin-bottom:12px}
 .ride-tricks-toggle{height:42px;min-width:76px;padding:0 14px;border-radius:12px;border-width:1px;font:800 13px system-ui,sans-serif;letter-spacing:.06em;cursor:pointer;pointer-events:auto;white-space:nowrap}
 .ride-tricks-fan{position:absolute;right:0;bottom:calc(100% + 6px);display:flex;flex-direction:row;flex-wrap:nowrap;gap:5px;z-index:11}
 .ride-tricks:not(.is-open) .ride-tricks-fan{visibility:hidden;opacity:0;pointer-events:none}
 @media(max-width:650px){.ride-rewind{right:8px;bottom:calc(12px + 48px * 1.3 + 18px);width:52px;height:52px}}
 .ride-replay.is-dropping{opacity:0;transform:translate(-50%,-46%) scale(.98);filter:blur(2px);transition:opacity .32s ease,transform .32s ease,filter .32s ease;pointer-events:none}
 .ride-replay{transition:opacity .28s ease,transform .28s ease,filter .28s ease}
 .ride-save-btn{font-size:12px!important;padding:10px 12px!important}
 .ride-gallery{z-index:15;width:min(920px,94vw);max-height:min(92vh,820px);overflow:auto;text-align:left}
 .ride-gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
 .ride-gallery-card{display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:12px;background:#12281fe8;border:1px solid #75eeaf55}
 .ride-gallery-thumb-wrap{position:relative;border-radius:10px;overflow:hidden;aspect-ratio:16/9;background:#0a1410}
 .ride-gallery-thumb-wrap img{width:100%;height:100%;object-fit:cover;display:block}
 .ride-gallery-badge{position:absolute;left:8px;top:8px;padding:3px 7px;border-radius:999px;background:#0d2418e8;border:1px solid #8dffb8;font:800 10px system-ui;color:#d9ffe8}
 .ride-gallery-card-meta strong{display:block;font:800 12px system-ui}
 .ride-gallery-card-meta small{font:600 10px system-ui;color:#b7dcc8}
 .ride-gallery-card-actions{display:flex;flex-wrap:wrap;gap:6px}
 .ride-gallery-card-actions button{padding:7px 9px!important;font-size:11px!important;margin:0}
 .ride-gallery-del{background:#3a2222cc!important;border-color:#f88!important}
 .ride-gallery-empty{font:600 13px system-ui;color:#b7dcc8;text-align:center;padding:18px 8px}
 .ride-gallery[hidden],.ride-gallery-empty[hidden]{display:none!important}
 [data-wk-paused] .ride-pause-fab{pointer-events:auto}
 @media(max-width:720px){
  .ride-replay-layout{grid-template-columns:1fr}
  .ride-replay-library{max-height:34vh;order:2}
  .ride-replay-main{order:1}
  .ride-pause-menu{width:min(340px,94vw);padding:14px}
  .ride-pause-fab{padding:10px 16px;font-size:13px}
  .ride-theatre-bar{justify-content:center}
 }
 /* Short phone landscape (~1024x460): video + scrub + Drop In row all visible without scrolling. */
 @media(orientation:landscape) and (max-height:520px){
  .ride-replay:not(.is-theatre){padding:10px 12px}
  .ride-replay:not(.is-theatre) .ride-replay-head{margin-bottom:6px}
  .ride-replay:not(.is-theatre) .ride-replay-stage{aspect-ratio:auto;height:min(calc(92dvh - 160px),31vw);min-height:120px}
  .ride-replay:not(.is-theatre) .ride-replay-scrub{margin:6px 0}
  .ride-replay:not(.is-theatre) .ride-replay-actions{gap:6px}
  .ride-replay:not(.is-theatre) .ride-replay-actions :is(button,a){padding:8px 11px}
  .ride-replay-library{max-height:calc(92dvh - 80px)}
 }
 @media(orientation:portrait) and (max-width:520px){
  .ride-replay{width:96vw;padding:12px}
  .ride-replay-thumb{width:72px;height:42px}
 }
 [data-wk-finished] .ride-controls,[data-wk-reviewing] .ride-controls,[data-wk-reviewing] .ride-toolbar,[data-wk-reviewing] .ride-pause-fab,[data-wk-reviewing] .ride-pause-menu,[data-wk-reviewing] .ride-view-label,[data-wk-reviewing] [data-h]{visibility:hidden!important;opacity:0!important}[data-wk-finished] .ride-pause-fab{visibility:hidden}
 .ride-review-scrim{display:none;position:fixed;inset:0;background:#05070ce6;z-index:13;pointer-events:none}[data-wk-reviewing] .ride-review-scrim{display:block}
 .ride-slow-toast{position:absolute;left:50%;top:18%;transform:translateX(-50%);z-index:20;pointer-events:none;padding:12px 22px;border-radius:999px;background:linear-gradient(180deg,#3cf08a,#13b45c);border:1px solid #b8ffd5;color:#03200e;font:900 15px system-ui;letter-spacing:.12em;box-shadow:0 0 16px #35e07a99,inset 0 1px 0 #ffffff66;animation:wk-slow-toast 2.6s ease forwards}
 @keyframes wk-slow-toast{0%{opacity:0;transform:translateX(-50%) translateY(-8px) scale(.96)}8%,80%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-6px) scale(.98)}}
 .ride-tricks:not(.ride-hop){position:relative}
 .ride-tricks .ride-slow{position:absolute;bottom:calc(100% + 5px);right:0;height:35px;padding:0 12px;border-color:#71eda9}
 .ride-tricks .ride-slow[aria-pressed=true]{background:#95ef9f;color:#142b1b}
 .ride-tricks{display:grid;grid-template-columns:repeat(4,var(--trick-size));gap:5px;align-self:end;justify-self:end;grid-column:2;grid-row:1}.ride-tricks button{height:calc(var(--trick-size)*.95);border:2px solid #777d75;border-radius:13px;background:linear-gradient(#333a35ed,#0e120fe8);color:white;box-shadow:0 5px 10px #0009;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:3px;font:900 italic clamp(7px,.8vw,11px) system-ui;gap:2px}.ride-tricks svg{width:55%;height:52%}.ride-tricks [data-t=hop],.ride-tricks button[data-pressed=true]{border-color:#96e600;box-shadow:0 0 9px #94ed0066,0 4px 8px #0009}.ride-controls button[data-pressed=true]{filter:brightness(1.3);transform:translateY(2px)}
 .ride-view-label{position:absolute;left:8px;top:7px;padding:5px 14px;border:2px solid #7a837b;border-radius:22px;background:#090f10d9;font:900 italic 15px system-ui;letter-spacing:.3px}.ride-toolbar button{background:linear-gradient(#363e38ed,#0c120fed)!important;border:2px solid #6c786f!important;box-shadow:0 3px 6px #0009}.ride-toolbar [data-r=level]{color:#bbfa3b!important}.ride-toolbar{top:44px!important;gap:7px!important}[data-h=speed]{background:#10180ec9;border-radius:12px;padding:4px 10px}
 @media(max-width:650px){[data-wk-ride-surface] .ride-controls{left:8px;right:8px;bottom:12px;gap:7px;--lean-size:48px;--trick-size:44px}.ride-tricks{gap:3px}.ride-tricks button{border-radius:9px}.ride-view-label{font-size:12px;padding:4px 10px}.ride-toolbar{gap:5px!important;top:39px!important}.ride-toolbar button{font-size:11px!important;height:36px!important;width:auto!important;min-width:38px;padding:0 8px!important}[data-h=speed]{font-size:24px!important}}
 .ride-hop.ride-tricks{grid-column:1;grid-row:1;grid-template-columns:var(--trick-size);justify-self:start;margin-left:calc((var(--lean-size)*2 + clamp(7px,1vw,14px) - var(--trick-size))/2)}.ride-lean-buttons{grid-column:1;grid-row:2}.ride-drive-buttons{grid-column:2;grid-row:2}
 @media(max-width:520px){[data-wk-ride-surface] .ride-controls{row-gap:9px}.ride-tricks{grid-template-columns:repeat(2,var(--trick-size))}.ride-hop.ride-tricks{grid-template-columns:var(--trick-size)}}
 /* Replay: every control sits on the video (video-player style); the panel is the video, no scrolling. */
 .ride-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
 .ride-replay:not(.is-theatre){--wk-replay-ar:1.7778;padding:0!important;width:min(78vw,calc(75dvh * var(--wk-replay-ar)))!important;max-width:none!important;max-height:75dvh!important;aspect-ratio:var(--wk-replay-ar);overflow:hidden!important;border-radius:16px}
 .ride-replay:not(.is-theatre) .ride-replay-layout{display:block!important;position:absolute;inset:0}
 .ride-replay:not(.is-theatre) .ride-replay-main{position:static}
 .ride-replay:not(.is-theatre) .ride-replay-stage{position:absolute!important;inset:0;height:auto!important;min-height:0!important;aspect-ratio:auto!important;border:0!important;border-radius:0!important}
 .ride-replay:not(.is-theatre) .ride-replay-stage video{object-fit:contain}
 .ride-replay:not(.is-theatre) .ride-replay-stage::before,.ride-replay:not(.is-theatre) .ride-replay-stage::after{content:'';position:absolute;left:0;right:0;pointer-events:none;z-index:1}
 .ride-replay:not(.is-theatre) .ride-replay-stage::before{top:0;height:28%;background:linear-gradient(#000b,#0000)}
 .ride-replay:not(.is-theatre) .ride-replay-stage::after{bottom:0;height:46%;background:linear-gradient(#0000,#000d)}
 .ride-replay:not(.is-theatre) .ride-replay-head{position:absolute;top:10px;left:12px;right:10px;z-index:4;margin:0!important;pointer-events:none}
 .ride-replay:not(.is-theatre) .ride-replay-head strong{font:900 12px system-ui!important;padding:7px 11px;border-radius:999px;background:#0b1a13cc;border:1px solid #7dffb066;letter-spacing:.18em!important;white-space:nowrap}
 .ride-replay:not(.is-theatre) .ride-replay-head strong::before{content:'● ';color:#ff4d5e}
 .ride-replay:not(.is-theatre) .ride-replay-x{pointer-events:auto;border-radius:50%!important;width:40px;min-width:40px!important;height:40px;padding:0!important;background:#0b1a13cc!important}
 .ride-replay:not(.is-theatre) .ride-replay-library{position:absolute;z-index:4;top:8px;left:116px;right:60px;max-height:none!important;overflow:visible!important;display:flex;gap:6px;align-items:center;padding:0!important;order:0}
 .ride-replay:not(.is-theatre) .ride-replay-library h3{display:none}
 .ride-replay:not(.is-theatre) .ride-replay-list{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;touch-action:pan-x;min-width:0}
 .ride-replay:not(.is-theatre) .ride-replay-list::-webkit-scrollbar{display:none}
 .ride-replay:not(.is-theatre) :is(.ride-replay-latest,.ride-replay-item){position:relative;width:auto!important;flex:0 0 auto;margin:0!important;padding:4px 11px 4px 4px!important;gap:7px!important;border-radius:999px!important;background:#0b1a13cc!important;max-width:200px;min-height:40px}
 .ride-replay:not(.is-theatre) .ride-replay-thumb{width:46px!important;height:28px!important;border-radius:999px!important}
 .ride-replay:not(.is-theatre) .ride-replay-meta small{display:none}
 .ride-replay:not(.is-theatre) .ride-replay-del{display:none!important}
 .ride-replay:not(.is-theatre) .ride-replay-item.show-del .ride-replay-del{display:inline-flex!important;position:absolute;top:-6px;right:-6px;min-width:26px!important;width:26px;height:26px;padding:0!important;border-radius:50%!important;font-size:12px!important}
 .ride-replay:not(.is-theatre) .ride-replay-overlay-play{z-index:3;width:68px!important;height:68px!important}
 .ride-replay:not(.is-theatre) .ride-replay-scrub{position:absolute;z-index:4;left:10px;right:10px;bottom:60px;height:48px;margin:0!important;padding:0 6px;gap:10px;color:#e9fff2!important;text-shadow:0 1px 3px #000;touch-action:none;cursor:pointer;-webkit-user-select:none;user-select:none}
 .ride-replay:not(.is-theatre) .ride-replay-scrub label{height:100%;cursor:pointer}
 .ride-replay:not(.is-theatre) .ride-replay-scrub input{pointer-events:none;height:48px;margin:0;background:transparent;-webkit-appearance:none;appearance:none}
 .ride-replay:not(.is-theatre) .ride-replay-scrub input::-webkit-slider-runnable-track{height:6px;border-radius:6px;background:linear-gradient(90deg,#6dff9a,#6dff9a) 0/var(--wk-seek,0%) 100% no-repeat,#ffffff40}
 .ride-replay:not(.is-theatre) .ride-replay-scrub input::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;margin-top:-9px;border-radius:50%;background:#e9fff2;border:3px solid #6dff9a;box-shadow:0 0 12px #39ff7a99,0 2px 6px #000a;transition:transform .12s}
 .ride-replay:not(.is-theatre) .ride-replay-scrub input::-moz-range-track{height:6px;border-radius:6px;background:#ffffff40}
 .ride-replay:not(.is-theatre) .ride-replay-scrub input::-moz-range-progress{height:6px;border-radius:6px;background:#6dff9a}
 .ride-replay:not(.is-theatre) .ride-replay-scrub input::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#e9fff2;border:3px solid #6dff9a}
 .ride-replay:not(.is-theatre) .ride-replay-scrub.is-seeking input::-webkit-slider-thumb{transform:scale(1.25)}
 .ride-replay:not(.is-theatre) .ride-replay-scrub [data-r=replay-time]{font:800 12px system-ui;white-space:nowrap}
 .ride-replay:not(.is-theatre) .ride-replay-actions{position:absolute;z-index:4;left:12px;right:12px;bottom:12px;display:flex!important;flex-wrap:nowrap!important;gap:8px!important;align-items:center}
 .ride-replay:not(.is-theatre) .ride-replay-actions :is(button,a){flex:1 1 0;min-width:0;max-width:240px;min-height:42px;padding:6px 10px!important;border-radius:999px!important;background:#0b1a13cc!important;white-space:nowrap;font-size:12px!important;gap:6px}
 .ride-replay:not(.is-theatre) .ride-replay-actions a[hidden]{display:none!important}
 .ride-replay:not(.is-theatre) .ride-replay-actions .rl{overflow:hidden;text-overflow:ellipsis}
 .ride-replay:not(.is-theatre) .ride-replay-actions .ride-replay-playbtn{flex:0 0 42px;width:42px;padding:0!important;font-size:16px!important}
 .ride-replay:not(.is-theatre) .ride-replay-actions .ride-replay-drop{order:9;flex:0 0 auto;max-width:none;margin-left:auto;padding:10px 22px!important;font-size:15px!important;background:linear-gradient(180deg,#a6f5b0,#5fd877)!important;color:#0f2416!important;box-shadow:0 0 18px #39ff7a88}
 .ride-replay:not(.is-theatre) .ride-replay-actions .ride-replay-drop[hidden]{display:none!important}
 /* short phone landscape (844x390 and similar): icon-over-label buttons, same even spacing */
 @media(orientation:landscape) and (max-height:420px){
  .ride-replay:not(.is-theatre) .ride-replay-actions :is(button,a):not(.ride-replay-playbtn):not(.ride-replay-drop){flex-direction:column;gap:1px;font-size:10px!important;padding:3px 6px!important;min-height:42px}
  .ride-replay:not(.is-theatre) .ride-replay-actions .ri{font-size:15px;line-height:1}
  .ride-replay:not(.is-theatre) .ride-replay-scrub{bottom:56px}
  .ride-replay:not(.is-theatre) .ride-replay-overlay-play{width:56px!important;height:56px!important}
 }
 /* Tall (portrait-recorded) clips: Drop In spans the width, the rest share one evenly spaced row.
    Keyed off the video aspect, not the phone orientation, so a landscape clip on a portrait phone
    keeps the compact on-video chrome and still fits the 16:9 panel. */
 .ride-replay:not(.is-theatre).is-tall-video .ride-replay-library{left:12px;right:58px;top:52px}
 .ride-replay:not(.is-theatre).is-tall-video .ride-replay-head strong{font-size:11px!important}
 .ride-replay:not(.is-theatre).is-tall-video .ride-replay-actions{flex-wrap:wrap!important;row-gap:8px!important}
 .ride-replay:not(.is-theatre).is-tall-video .ride-replay-actions .ride-replay-drop{order:-1;flex:1 1 100%;margin:0!important;padding:13px!important;font-size:17px!important}
 .ride-replay:not(.is-theatre).is-tall-video .ride-replay-actions :is(button,a):not(.ride-replay-drop){flex:1 1 0;max-width:none;flex-direction:column;gap:2px;font-size:10px!important;padding:4px 2px!important;min-height:50px;border-radius:14px!important}
 .ride-replay:not(.is-theatre).is-tall-video .ride-replay-actions .ri{font-size:17px;line-height:1}
 .ride-replay:not(.is-theatre).is-tall-video .ride-replay-actions .ride-replay-playbtn{flex:1 1 0;width:auto;font-size:20px!important}
 .ride-replay:not(.is-theatre).is-tall-video .ride-replay-scrub{bottom:128px}
 `;document.head.append(style);
}
