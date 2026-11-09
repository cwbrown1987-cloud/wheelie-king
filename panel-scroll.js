// Phone scrolling for every menu/panel (see comments in the CSS below).
const css=`/* Phone scrolling for every menu/panel: if content is taller than the screen, the panel scrolls inside itself.
   dvh tracks the visible area on mobile browsers (address bar shown/hidden); vh is the fallback. */
.ride-pause-menu,.ride-replay,.ride-gallery,.ride-finish,.ride-replay-library,.ride-gallery-grid,
.wk-more,.wk-boot-card,.sticker-studio,#wk-trace,#wk-builder,[data-catpanel],[data-stickers],[data-fitpanel],
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
