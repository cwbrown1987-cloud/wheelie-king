# Wheelie King: Outback — CHANGELOG (live PWA at https://wheelie-king.pages.dev)

Deploy: `CLOUDFLARE_ACCOUNT_ID=7f9b89a42182a51327a119efb6cf949e WRANGLER_CACHE_DIR=/tmp/wcache npx wrangler pages deploy . --project-name wheelie-king --branch main --commit-dirty=true`
(Pages project lives in the Korumburra@repairmepc.net Cloudflare account.)
`app.js` is a minified bundle with no source in this folder; all edits below were string patches to it. Search for the quoted snippets to find them.
Every version bumps `CACHE` in `sw.js` (currently `wk-v10`).

## v5 — chat history page
- NEW `chat-history.html`: static HTML render of `/workspace/wheelie-king-CHAT-HISTORY.md` (Chris = blue right bubbles, bot = dark left). Machine ids / attachment paths stripped; no PIN.
- `index.html`: `#chat-history` hash redirects to `./chat-history.html`; fixed "💬 Chat log" link bottom-right.
- `sw.js`: adds `./chat-history.html` to `SHELL`.

## v6 — 10 new image stickers
- `stickers/pack1-*.webp`, `stickers/pack2-*.webp` (512px) — replaced in v8 by `*-cut.webp`.
- `app.js` catalog `li` (the parts array): 10 entries inserted before `{id:"custom",slot:"sticker"…}`, ids `p1…`/`p2…`, `img:"pack…"`. Ratings: Ride It Like You Stole It ×2 = `adult18`, Eshay Brah (I'm 13) ×2 = `teen`, rest `all`.

## v7 — first wrap attempt + drag & drop
- `app.js` hooks: `globalThis.__WK_VIEW__={scene,camera,renderer,controls,mode}` set in `sp()` when `t==="garage"`; group factory `U=d=>…` now names groups `"wk:"+d` (e.g. `wk:frame`, `wk:sticker`); `globalThis.__WK_CAT__=()=>({items:li,base:jm})` exposes catalog + sticker base URL.
- NEW `vendor/DecalGeometry.js` (three r160 addon). NEW `stickers-dd.js` (loaded from `index.html` after `app.js`).

## v8 — transparent die-cut stickers
- `stickers/pack*-cut.webp`: background flood-filled to alpha from the edges (scipy labelling + 0.8px feather); punk stamp cut to the convex hull of its ring. `app.js` `img:` fields point at `-cut.webp`. Older 6 PNGs were already transparent.
- Sticker materials `alphaTest:0.1`.

## v9 — real wrapping, continuous drag
- `app.js` `me()` (frame tube cylinder builder): radial segments ≥48, height segments `ceil(len/0.02)`; `en()` TubeGeometry radial 10 → 40 so decals curve.
- `app.js` old fixed-spot sticker (top/down/seat tube plane/card) disabled: `if($t){let d=ip($t)` → `if(!1){…}`. Nothing floats any more.
- `stickers-dd.js` rewritten: `surf(hit)` gets world normal (normalMatrix), tube axis (Cylinder local Y / Tube path tangent at uv.x / longest bbox axis) and radius; `buildDecal()` orients decal X along tube axis (+ rotation), height 2.1·r·size, projection depth 2·r, `polygonOffsetFactor:-4`, `depthWrite:false`, `transparent`, `alphaTest:0.1`, decal parented to the hit mesh. Saved per sticker in localStorage `wk-decals`: `{id,img,p,n (bike-root local),size,rot}`; `rehit()` re-raycasts along the saved normal so stickers survive rebuilds/frame swaps (checked every 400ms). 18+ ones hidden unless `wk-adult-until` unlocked.
- Flow: big flat overlay → drag onto bike (orbit off, rAF-throttled live re-wrap, pointer capture) → drop selects it (green emissive glow), panel: Size, Rotate, ◀ ▶ along tube, ⤴ ⤵ around tube, Remove, Done.

## v10 — integrated into STICKERS screen, re-drag, zoom, pan, touch
- `app.js` sticker card `ci` onClick: still equips/buys via `Zr(id)`, then calls `globalThis.__WK_STK_PICK__(id)` (if owned or affordable) to start the drag flow.
- `app.js` sticker screen: "SHOW ALL" button (`data-wk="showall"`) after "+ UPLOAD" → `globalThis.__WK_STK_ALL__()` opens the full picker tray. PLACE/SIZE/SIDE preset rows replaced by hint text (REMOVE kept). Panel no longer dimmed.
- `stickers-dd.js`: separate 🏷️ Stickers button removed; exports `__WK_STK_PICK__`, `__WK_STK_ALL__`, `__WK_STK__` (test hooks). Any placed sticker can be grabbed any time: capture-phase `pointerdown` raycasts placed decals; hit → select + drag (OrbitControls gets nothing for that gesture); miss → normal orbit. Drop uses the last move position (fixes touchend at 0,0). iOS `gesturestart/change/end` prevented.
- `app.js` camera/controls: `PerspectiveCamera near .05→.005`, `minDistance .9→.12`, `enablePan=true`, `screenSpacePanning=true`, `touches={ONE:ROTATE,TWO:DOLLY_PAN}` (two-finger pinch zoom + pan; desktop right-drag or ctrl/shift-drag pans). Canvas already `touch-action:none`.

## v11 — infinite money (dev flag)
- `index.html`: `window.DEV_INFINITE_MONEY = true;` (first inline script). Set to `false` to restore normal money.
- `app.js` purchase function (the one returning `hn("NEED MORE COINS",!1)`): skips the price check and the `t(e-g.price)` deduction when the flag is on.
- `app.js` part sheet button (`e<O.price?"🔒 LOCKED"`) and sticker/part card `ci` (`P=!g&&e<p.price`): never show locked/dimmed when the flag is on.
- `app.js` money displays (garage header `e.toLocaleString()` and the `["$ ",e.toLocaleString()]` summary) show `∞` when the flag is on. Coin balance itself is unchanged in storage.
- `sw.js`: cache `wk-v11`.
- Motor types (rear hub vs mid-drive, no-pedal moto mids) are work in progress for v12; WIP bundle kept off-deploy at `/tmp/app.v12-wip.js`.
