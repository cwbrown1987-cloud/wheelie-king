// Phone scrolling for every menu/panel (see comments in the CSS below).
const css=`/* Phone scrolling for every menu/panel: if content is taller than the screen, the panel scrolls inside itself.
   dvh tracks the visible area on mobile browsers (address bar shown/hidden); vh is the fallback. */
.ride-pause-menu,.ride-replay,.ride-gallery,.ride-finish,.ride-replay-library,.ride-gallery-grid,
.wk-more,.wk-boot-card,.sticker-studio,#wk-trace,#wk-builder,[data-catpanel],[data-stickers],[data-fitpanel],.store-side,[data-gear-grid],.garage-items,
[data-wk-scroll-panel],[role="dialog"]:not(.ride-replay-theatre){
  max-height:calc(100vh - 16px)!important;max-height:calc(100dvh - 16px)!important;
  box-sizing:border-box!important;overflow-y:auto!important;overflow-x:hidden;-webkit-overflow-scrolling:touch;
  touch-action:pan-y!important;overscroll-behavior:contain;
}
.ride-replay.is-theatre{max-height:calc(100dvh - 8px)!important}
/* Centred panels: keep their top reachable when taller than the screen. */
@media (max-height:520px){.ride-pause-menu,.ride-finish{gap:8px}}
/* The ride surface blocks browser touch gestures on everything (so steering never scrolls the page).
   Inside menus/panels, let a vertical finger drag scroll the panel again (buttons still tap, sliders still drag). */
[data-wk-ride-surface] :is(.ride-pause-menu,.ride-replay,.ride-gallery,.ride-finish,.ride-replay-library,.ride-gallery-grid),
[data-wk-ride-surface] :is(.ride-pause-menu,.ride-replay,.ride-gallery,.ride-finish,.ride-replay-library,.ride-gallery-grid) *{touch-action:pan-y!important}
`;
if(!document.querySelector('style[data-wk-panel-scroll]')){const s=document.createElement('style');s.dataset.wkPanelScroll='';s.textContent=css;document.head.append(s);}

const canScroll=(el,dx,dy)=>{
  let n=el&&el.nodeType===1?el:el?.parentElement;
  while(n&&n!==document.body&&n!==document.documentElement){
    const cs=getComputedStyle(n);
    const y=/(auto|scroll)/.test(cs.overflowY)&&n.scrollHeight>n.clientHeight+1;
    const x=/(auto|scroll)/.test(cs.overflowX)&&n.scrollWidth>n.clientWidth+1;
    if(y){
      const down=n.scrollTop+n.clientHeight<n.scrollHeight-1, up=n.scrollTop>1;
      if((dy>0&&down)||(dy<0&&up))return n;
    }
    if(x){
      const right=n.scrollLeft+n.clientWidth<n.scrollWidth-1, left=n.scrollLeft>1;
      if((dx>0&&right)||(dx<0&&left))return n;
    }
    n=n.parentElement;
  }
  return null;
};
const pin=()=>{if(window.scrollX||window.scrollY)window.scrollTo(0,0)};
const fit=()=>{
  const vv=window.visualViewport;
  const h=Math.round(vv?.height||window.innerHeight);
  const w=Math.round(vv?.width||window.innerWidth);
  const r=document.documentElement, b=document.body;
  r.style.setProperty('--wk-vvh',h+'px');
  r.style.setProperty('--wk-vvw',w+'px');
  r.style.height=h+'px';
  b.style.height=h+'px';
  pin();
};
addEventListener('scroll',pin,{passive:true});
addEventListener('resize',fit);
addEventListener('orientationchange',fit);
visualViewport?.addEventListener('resize',fit);
visualViewport?.addEventListener('scroll',pin);
let lastY=0,lastX=0;
addEventListener('touchstart',e=>{const t=e.touches[0];if(t){lastX=t.clientX;lastY=t.clientY;}},{passive:true});
addEventListener('touchmove',e=>{
  if(e.touches.length!==1){if(e.cancelable)e.preventDefault();return;}
  const t=e.touches[0], dx=lastX-t.clientX, dy=lastY-t.clientY;
  lastX=t.clientX;lastY=t.clientY;
  if(!canScroll(e.target,dx,dy)&&e.cancelable)e.preventDefault();
},{passive:false});
addEventListener('wheel',e=>{
  if(!canScroll(e.target,e.deltaX,e.deltaY)&&e.cancelable)e.preventDefault();
},{passive:false});
fit();
