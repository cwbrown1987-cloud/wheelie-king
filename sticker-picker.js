// Restyle the existing picker; selection, cutouts and content gates stay native.
let query='';
const style=document.createElement('style');style.textContent=`
[data-stickers]{box-sizing:border-box!important;width:min(390px,42%)!important;padding:12px!important;gap:10px!important;border-radius:16px!important;background:linear-gradient(145deg,#20334bbc,#0b1528c9)!important}
[data-stickers]>div:first-child{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px!important;flex-shrink:0}
[data-stickers]>div:first-child button{font:700 11px system-ui!important;height:34px!important;min-height:34px!important;padding:4px!important;margin:0!important;border:1px solid #9ac6e04d!important;box-shadow:none!important;border-radius:7px!important;white-space:normal!important}
[data-stickers]>div:first-child button:first-child{grid-row:span 2;height:100%!important;background:#1e364c99!important;color:#ecf8ff!important}
[data-wk-sticker-search]{width:100%;box-sizing:border-box;min-height:38px;flex-shrink:0;border:1px solid #8ebce459;border-radius:9px;background:#0916268c;color:#e8f7ff;font:13px system-ui;padding:9px 11px;outline-offset:2px}
[data-wk-sticker-grid]{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;padding:1px 3px 8px!important;scrollbar-width:thin}
[data-stickers] [data-wk-part]{padding:32px 7px 8px!important;border:1px solid #9ac4db59!important;border-radius:12px!important;background:linear-gradient(150deg,#344960b5,#182738c9)!important;box-shadow:0 3px 9px #0004,inset 0 1px #d9f6ff18!important;transition:border-color .15s,background .15s}
[data-stickers] [data-wk-part]:hover,[data-stickers] [data-wk-part]:focus-visible{border-color:#72edba!important;background:#315549bf!important}
[data-stickers] [data-wk-part][hidden]{display:none!important}
[data-stickers] [data-wk-part]>span:first-of-type{display:none!important}
[data-stickers] [data-wk-part]>span:nth-of-type(2){top:9px!important;left:8px!important;font:800 8px system-ui!important;letter-spacing:.6px;padding:3px 5px!important}
[data-stickers] [data-wk-info]{width:26px!important;height:26px!important;top:5px!important;right:6px!important;font-size:16px!important;line-height:24px!important;background:#172c4099!important;border-color:#a6d4e65c!important}
[data-stickers] [data-wk-part]>div:first-of-type{height:76px;align-items:center;background:radial-gradient(ellipse,#eff5f31c,#b9c4e106);border-radius:8px;margin-bottom:8px}
[data-stickers] [data-wk-part] canvas,[data-stickers] [data-wk-part] img{max-width:100%!important;width:128px!important;height:auto!important;max-height:72px;object-fit:contain;filter:drop-shadow(0 3px 3px #0007)}
[data-stickers] [data-wk-part]>div:nth-of-type(2){font:650 12px/1.3 system-ui!important;min-height:32px!important;color:#eff8ff}
[data-stickers] [data-wk-part]>div:last-child{font:800 12px system-ui!important;color:#8dffc3!important}
[data-wk-sticker-result]{font:11px system-ui;color:#c0d7e8;min-height:14px;margin:0;flex-shrink:0}
@media(pointer:coarse){[data-wk-sticker-search]{font-size:16px}[data-stickers]{width:min(420px,47%)!important}[data-stickers]>div:first-child button{min-height:40px!important;font-size:12px!important}[data-stickers] [data-wk-part]>div:nth-of-type(2){font-size:13px!important}}
`;document.head.append(style);
setInterval(()=>{
 const panel=document.querySelector('[data-stickers][data-open="true"]');if(!panel)return;
 const cards=[...panel.querySelectorAll('[data-wk-part]')],grid=cards[0]?.parentElement;if(grid)grid.dataset.wkStickerGrid='';
 let search=panel.querySelector('[data-wk-sticker-search]');if(!search){search=document.createElement('input');search.type='search';search.placeholder='Find a sticker…';search.setAttribute('aria-label','Find a sticker');search.dataset.wkStickerSearch='';search.value=query;search.addEventListener('input',()=>{query=search.value;filter()});panel.insertBefore(search,grid||panel.children[1]);}
 let result=panel.querySelector('[data-wk-sticker-result]');if(!result){result=document.createElement('p');result.dataset.wkStickerResult='';result.setAttribute('role','status');result.setAttribute('aria-live','polite');search.after(result)}
 function filter(){const cards=[...panel.querySelectorAll('[data-wk-part]')];for(const card of cards)card.hidden=!card.getAttribute('aria-label').toLowerCase().includes(query.trim().toLowerCase());const count=cards.filter(c=>!c.hidden).length,text=count?count+' stickers · drag onto your bike':query?'No matches — try another name or clear search.':'No stickers in this collection yet.';if(result.textContent!==text)result.textContent=text}filter();
},300);
