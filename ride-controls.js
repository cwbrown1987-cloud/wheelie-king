const driveButton=(kind,label,icon)=>`<button type="button" class="ride-drive ${kind}" data-t="${kind}" aria-label="${label}">${icon}</button>`;
const brakeIcon='<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="4"><circle cx="32" cy="32" r="23"/><circle cx="32" cy="32" r="15"/><circle cx="32" cy="32" r="6"/><path d="M32 9v8M32 47v8M9 32h8M47 32h8M16 16l6 6M42 42l6 6M16 48l6-6M42 22l6-6"/></g></svg>';
const gasIcon='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 32l16-16 16 16M16 48l16-16 16 16" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const glyph={hop:'M16 6V0 M12 4l4-4 4 4',tailwhip:'M12 4C0-2-2 13 6 15 M2 14l4 1-1-5',barspin:'M22 3c9-5 12 6 5 8 M30 7l-3 4-3-3',superman:'M4 4l17 2 5 4 M12 5L5 9 M20 4l3-3',trick:'M6 7C18-5 34 4 29 13 M26 9l3 4 3-3'};
const trickButton=(key,label)=>`<button data-t="${key}" type="button" aria-label="${label}"><svg viewBox="0 0 32 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="7" cy="17" r="5"/><circle cx="26" cy="17" r="5"/><path d="M7 17l7-9 5 9H7m7-9h9l3 9M12 5h6m2-3 4 5"/><path d="${glyph[key]}"/></g></svg><span>${label}</span></button>`;
export const rideControlsMarkup=()=>`<div class="ride-controls">
 <div class="ride-hop ride-tricks">${trickButton('hop','HOP')}</div>
 <div class="ride-lean-buttons"><button type="button" data-t="leanBack" aria-label="Lean back">‹</button><button type="button" data-t="leanForward" aria-label="Lean forward">›</button></div>
 <div class="ride-tricks"><button class="ride-slow" data-r="slow" aria-pressed="false" hidden>SLOW MO</button>${[['tailwhip','TAILWHIP'],['barspin','BARSPIN'],['superman','SUPERMAN'],['trick','360']].map(([key,label])=>trickButton(key,label)).join('')}</div>
 <div class="ride-drive-buttons">${driveButton('brake','Brake / reverse',brakeIcon)}${driveButton('throttle','Accelerate',gasIcon)}</div>
</div>`;
export function mountLeanControls(ui,touch){
 const release=()=>{touch.lean=0;touch.leanBack=0;touch.leanForward=0};release();return {update(){},release,state:()=>({active:!!(touch.leanBack||touch.leanForward),value:(touch.leanForward||0)-(touch.leanBack||0)})};
}
if(typeof document!=='undefined'){
 const style=document.createElement('style');style.textContent=`
 [data-wk-ride-surface] .ride-controls{position:absolute;left:14px;right:14px;bottom:18px;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto;align-items:end;gap:16px;pointer-events:auto;font:900 11px system-ui;--lean-size:clamp(48px,6vw,82px);--trick-size:clamp(44px,5.1vw,74px)}
 [data-wk-paused] [data-h="msg"]{top:12px!important;font-size:18px!important}[data-r="recover"][hidden]{display:none!important}[data-wk-crashed] .ride-controls{opacity:.35;pointer-events:none}[data-wk-crashed] .ride-controls button{pointer-events:none}[data-wk-paused] .ride-controls{opacity:.4}[data-wk-paused] .ride-controls button{pointer-events:none}[data-wk-paused] .ride-pause-fab,[data-wk-paused] .ride-pause-menu{pointer-events:auto} .ride-lean-buttons,.ride-drive-buttons{display:flex;align-items:end;gap:clamp(7px,1vw,14px)}.ride-drive-buttons{justify-self:end}.ride-lean-buttons button,.ride-drive{border:3px solid #c8c9c6;border-radius:50%;background:linear-gradient(145deg,#424743d9,#121616df);color:#f8f9f4;box-shadow:0 5px 12px #0009,inset 0 1px 2px #fff4;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0}
 .ride-lean-buttons button{width:var(--lean-size);height:var(--lean-size);font:700 calc(var(--lean-size)*.95) system-ui;line-height:.7;padding-bottom:9px;text-shadow:0 2px 3px #000}.ride-drive.brake{width:var(--lean-size);height:var(--lean-size)}.ride-drive.throttle{width:calc(var(--lean-size)*1.3);height:calc(var(--lean-size)*1.3);border-color:#a8e600;color:#b5f300;background:radial-gradient(circle at 40% 30%,#344028ed,#10170bed);box-shadow:0 0 17px #a4ff0033,0 5px 12px #0009}.ride-drive svg{width:70%;height:70%;filter:drop-shadow(0 3px 1px #0009)}
 .ride-glass{background:#122420ed;border:1px solid #75eeaf88;border-radius:14px;backdrop-filter:blur(8px);box-shadow:0 8px 24px #0009;color:#edfdf4;pointer-events:auto}
 .ride-glass[hidden],.ride-tricks .ride-slow[hidden]{display:none}
 .ride-finish,.ride-replay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;padding:14px;z-index:12;width:max-content;max-width:92%;box-sizing:border-box}
 .ride-finish strong{color:#8cfca9}.ride-finish p{margin:6px 0 10px;font:700 14px system-ui}
 .ride-finish button,.ride-replay button,.ride-replay a{display:inline-block;padding:8px 12px;margin:2px;border:1px solid #80fbb285;border-radius:7px;background:#243e35;color:#fff;font:800 12px system-ui;text-decoration:none;cursor:pointer}
 .ride-finish [data-r=restart]{background:#95ef9f;color:#142b1b}
 .ride-finish-photos{display:flex;justify-content:center;gap:8px;margin-bottom:8px}.ride-finish-photos:empty{display:none}
 .ride-finish-photos canvas{width:clamp(70px,15vw,155px);border:3px solid #e0efe7;border-bottom-width:8px;border-radius:3px;transform:rotate(-3deg)}.ride-finish-photos canvas:nth-child(2){transform:rotate(3deg)}
 .ride-replay{z-index:14}.ride-replay video{display:block;width:min(540px,82vw);max-height:55vh}.ride-replay input{width:100%}
 .ride-replay-alert{position:absolute;top:50px;right:10px;padding:8px;z-index:13;animation:ride-replay-pulse 1s alternate infinite}
 .ride-pause-fab{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:15;padding:10px 22px;font:900 16px system-ui;letter-spacing:.4px;cursor:pointer;border:2px solid #8dffb8;background:#0d2418f2;color:#d9ffe8;box-shadow:0 0 18px #39ff7a55,0 6px 16px #000a;pointer-events:auto}
 .ride-pause-fab[aria-expanded=true]{background:#95ef9f;color:#142b1b;border-color:#c8ffd8}
 .ride-pause-menu{position:absolute;top:58px;left:50%;transform:translateX(-50%);z-index:16;padding:14px 16px;display:flex;flex-direction:column;gap:8px;min-width:min(260px,86vw);text-align:center;pointer-events:auto}
 .ride-pause-menu[hidden]{display:none!important}
 .ride-pause-menu strong{color:#8cfca9;font:900 18px system-ui;margin-bottom:4px}
 .ride-pause-menu button{padding:10px 12px;border:1px solid #80fbb285;border-radius:8px;background:#243e35;color:#fff;font:800 13px system-ui;cursor:pointer}
 .ride-pause-menu [data-r=menu-resume]{background:#95ef9f;color:#142b1b}
 .ride-replay-play{margin:6px 0}
 .ride-replay-play button{min-width:96px}
 [data-wk-paused] .ride-pause-fab{pointer-events:auto}

 @keyframes ride-replay-pulse{to{box-shadow:0 0 13px #7eff9d}}
 [data-wk-finished] .ride-controls,[data-wk-reviewing] .ride-controls,[data-wk-reviewing] .ride-toolbar,[data-wk-reviewing] .ride-pause-fab,[data-wk-reviewing] .ride-pause-menu{visibility:hidden}[data-wk-finished] .ride-pause-fab{visibility:hidden}
 .ride-tricks:not(.ride-hop){position:relative}
 .ride-tricks .ride-slow{position:absolute;bottom:calc(100% + 5px);right:0;height:35px;padding:0 12px;border-color:#71eda9}
 .ride-tricks .ride-slow[aria-pressed=true]{background:#95ef9f;color:#142b1b}
 .ride-tricks{display:grid;grid-template-columns:repeat(4,var(--trick-size));gap:5px;align-self:end;justify-self:end;grid-column:2;grid-row:1}.ride-tricks button{height:calc(var(--trick-size)*.95);border:2px solid #777d75;border-radius:13px;background:linear-gradient(#333a35ed,#0e120fe8);color:white;box-shadow:0 5px 10px #0009;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:3px;font:900 italic clamp(7px,.8vw,11px) system-ui;gap:2px}.ride-tricks svg{width:55%;height:52%}.ride-tricks [data-t=hop],.ride-tricks button[data-pressed=true]{border-color:#96e600;box-shadow:0 0 9px #94ed0066,0 4px 8px #0009}.ride-controls button[data-pressed=true]{filter:brightness(1.3);transform:translateY(2px)}
 .ride-view-label{position:absolute;left:8px;top:7px;padding:5px 14px;border:2px solid #7a837b;border-radius:22px;background:#090f10d9;font:900 italic 15px system-ui;letter-spacing:.3px}.ride-toolbar button{background:linear-gradient(#363e38ed,#0c120fed)!important;border:2px solid #6c786f!important;box-shadow:0 3px 6px #0009}.ride-toolbar [data-r=level]{color:#bbfa3b!important}.ride-toolbar{top:44px!important;gap:7px!important}[data-h=speed]{background:#10180ec9;border-radius:12px;padding:4px 10px}
 @media(max-width:650px){[data-wk-ride-surface] .ride-controls{left:8px;right:8px;bottom:12px;gap:7px;--lean-size:48px;--trick-size:44px}.ride-tricks{gap:3px}.ride-tricks button{border-radius:9px}.ride-view-label{font-size:12px;padding:4px 10px}.ride-toolbar{gap:5px!important;top:39px!important}.ride-toolbar button{font-size:11px!important;height:36px!important;width:auto!important;min-width:38px;padding:0 8px!important}[data-h=speed]{font-size:24px!important}}
 .ride-hop.ride-tricks{grid-column:1;grid-row:1;grid-template-columns:var(--trick-size);justify-self:start;margin-left:calc((var(--lean-size)*2 + clamp(7px,1vw,14px) - var(--trick-size))/2)}.ride-lean-buttons{grid-column:1;grid-row:2}.ride-drive-buttons{grid-column:2;grid-row:2}
 @media(max-width:520px){[data-wk-ride-surface] .ride-controls{row-gap:9px}.ride-tricks{grid-template-columns:repeat(2,var(--trick-size))}.ride-hop.ride-tricks{grid-template-columns:var(--trick-size)}}
 `;document.head.append(style);
}
