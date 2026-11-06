// Restyle the existing picker; selection, cutouts and content gates stay native.
let query='';
const style=document.createElement('style');style.textContent=`
body [data-stickers]{box-sizing:border-box!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:100%!important;max-width:100%!important;padding:16px!important;gap:12px!important;z-index:18!important;border:1px solid #b4e1f85c!important;border-radius:16px!important;background:linear-gradient(145deg,#182c467a,#0b1528a8)!important;backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2)}
[data-stickers][data-open="true"]{transform:none!important}[data-stickers][data-open="false"]{display:none!important}
[data-stickers]>div:first-child{display:flex!important;align-items:center;gap:8px!important;flex-shrink:0}
[data-stickers]>div:first-child button{font:700 13px system-ui!important;min-height:42px!important;padding:8px 15px!important;margin:0!important;border:1px solid #9ac6e05d!important;box-shadow:none!important;border-radius:9px!important;white-space:nowrap!important}
[data-stickers]>div:last-child:not([data-wk-sticker-grid]){display:none!important}
[data-wk-sticker-search]{width:100%;box-sizing:border-box;min-height:42px;flex-shrink:0;border:1px solid #8ebce459;border-radius:9px;background:#09162669;color:#e8f7ff;font:16px system-ui;padding:9px 12px}
[data-wk-sticker-grid]{grid-template-columns:repeat(auto-fill,minmax(160px,1fr))!important;gap:14px!important;padding:2px 4px 10px!important;scrollbar-width:thin}
[data-stickers] [data-wk-part]{padding:12px!important;border:1px solid #9ac4db40!important;border-radius:14px!important;background:#263e5466!important;box-shadow:0 3px 9px #0003!important}
[data-stickers] [data-wk-part]:hover{border-color:#72edba!important}[data-stickers] [data-wk-part][hidden]{display:none!important}
[data-stickers] [data-wk-part]>span{display:none!important}
[data-stickers] [data-wk-info]{width:28px!important;height:28px!important;top:5px!important;right:6px!important;font-size:16px!important;line-height:26px!important;background:#172c4099!important;border-color:#a6d4e65c!important}
[data-stickers] [data-wk-part]>div:first-of-type{height:132px;align-items:center;justify-content:center;margin-bottom:8px}
[data-stickers] [data-wk-part] canvas,[data-stickers] [data-wk-part] img{max-width:100%!important;width:160px!important;height:auto!important;max-height:128px;object-fit:contain;filter:drop-shadow(0 3px 3px #0007)}
[data-stickers] [data-wk-part]>div:nth-of-type(2){font:650 13px/1.3 system-ui!important;min-height:32px!important;color:#eff8ff}[data-stickers] [data-wk-part]>div:last-child{font:800 12px system-ui!important;color:#8dffc3!important}
[data-wk-sticker-result]{font:11px system-ui;color:#c0d7e8;min-height:14px;margin:0;flex-shrink:0}
body:has([data-stickers][data-open="true"]) #wk-summary{display:none!important}
@media(max-width:800px){body [data-stickers]{padding:10px!important;gap:8px!important}[data-wk-sticker-grid]{grid-template-columns:repeat(auto-fill,minmax(132px,1fr))!important;gap:9px!important}[data-stickers]>div:first-child button{padding:7px 10px!important;font-size:12px!important}[data-stickers] [data-wk-part]>div:first-of-type{height:110px}[data-stickers] [data-wk-part] img,[data-stickers] [data-wk-part] canvas{max-height:105px}}
`;document.head.append(style);
setInterval(()=>{
 const panel=document.querySelector('[data-stickers][data-open="true"]');if(!panel)return;
 const buttons=panel.firstElementChild?.querySelectorAll('button');if(buttons?.length>=5){for(const [i,label]of ['✕','All','Mine','＋ Custom','↺'].entries()){if(buttons[i].textContent!==label)buttons[i].textContent=label;}buttons[0].setAttribute('aria-label','Close stickers');buttons[3].setAttribute('aria-label','Custom sticker');buttons[4].setAttribute('aria-label','Show all placed stickers');}
 const cards=[...panel.querySelectorAll('[data-wk-part]')],grid=cards[0]?.parentElement;if(grid)grid.dataset.wkStickerGrid='';
 let search=panel.querySelector('[data-wk-sticker-search]');if(!search){search=document.createElement('input');search.type='search';search.placeholder='Find a sticker…';search.setAttribute('aria-label','Find a sticker');search.dataset.wkStickerSearch='';search.value=query;search.addEventListener('input',()=>{query=search.value;filter()});panel.insertBefore(search,grid||panel.children[1]);}
 let result=panel.querySelector('[data-wk-sticker-result]');if(!result){result=document.createElement('p');result.dataset.wkStickerResult='';result.setAttribute('role','status');result.setAttribute('aria-live','polite');search.after(result)}
 function filter(){const cards=[...panel.querySelectorAll('[data-wk-part]')];for(const card of cards)card.hidden=!card.getAttribute('aria-label').toLowerCase().includes(query.trim().toLowerCase());const count=cards.filter(c=>!c.hidden).length,text=count?count+' stickers':query?'No matches':'No stickers in this collection yet.';if(result.textContent!==text)result.textContent=text}filter();
},300);

// Clear the gallery once a sticker is selected so placement has the whole bike view.
document.addEventListener('click',e=>{const card=e.target.closest('[data-stickers][data-open="true"] [data-wk-part]');if(card&&!e.target.closest('[data-wk-info]'))setTimeout(()=>document.querySelector('[data-stickers][data-open="true"]>div:first-child button')?.click(),0)});
