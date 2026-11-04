# Wheelie King: Outback — CHANGELOG (live PWA at https://wheelie-king.pages.dev)

Deploy: `CLOUDFLARE_ACCOUNT_ID=7f9b89a42182a51327a119efb6cf949e WRANGLER_CACHE_DIR=/tmp/wcache npx wrangler pages deploy . --project-name wheelie-king --branch main --commit-dirty=true`
(Pages project lives in the Korumburra@repairmepc.net Cloudflare account.)
`app.js` is a minified bundle with no source in this folder; all edits below were string patches to it. Search for the quoted snippets to find them.
Every version bumps `CACHE` in `sw.js` (currently `wk-v15`).

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

## v12 — motor types: rear hubs vs mid-drives, no-pedal moto mids
- `app.js` catalog `li`: 8 new generic motors after `galah` — rear hubs `hub1500` (52V, 7.5kg), `hub3000` (72V, 9.5kg), `hub5000` (72V, 13kg), `hub8000` (72V, 17kg); pedal mid `pmid1k` (52V, keeps cranks); moto mids with `nopedal:!0`: `mmid6k` (60V), `mmid8k` (72V), `mmid12k` (72V). One `motor` slot, so a hub and a mid always swap each other out.
- `app.js` catalog: 2 new batteries after `nullarbor`: `moto60` (60V 38Ah 150A) and `moto72` (72V 50Ah 250A). The existing 72V packs `tri72` and `redc` also match.
- `app.js` `Kr()` build-warning list: no-pedal mid + no throttle → red "No pedals on a moto mid-drive: fit a throttle to ride"; info "cranks and pedals removed, footpegs fitted"; rear hub ≥9kg → "Heavy rear hub … easy wheelies". There's no separate pedals part in the game, so nothing else gets removed.
- `app.js` 3D drive group (`let nn=.6;…`): if `Ve.nopedal`, it draws footpeg bars and pads instead of crank arms and pedals. The moto mid block branch also fires for `Ve.nopedal`. Hub visual radius `si` scales by power: 0.10 / 0.13 (≥3kW) / 0.15 (≥5kW) / 0.17 (≥8kW).
- CoG: the existing `Y`/height maths is unchanged. Rear hubs shift the CoG back by `kg*0.005` and mids lower it by 0.02, so the 17kg hub is very rear-biased.
- Infinite money (v11) kept. `sw.js` cache `wk-v12`.

## v13 — modular bike (12 new slots, swap-in-place)
- `app.js` category rail `Jf`: SUSP renamed **FORKS** (slot `suspension` = front fork). New slots: `shock`, `bars`, `grips`, `seat`, `rims`, `cranks`, `chain`, `fender_f`, `fender_r`, `bash`, `lights` (colours in `Yr`). The rail now scrolls (`overflowY:auto`, 40px buttons).
- `app.js` catalog `li`: 34 new generic parts (2–4 per new slot) with real weights (`kg` feeds total weight/CoG via `Kr`). Optional fields: `color`, `rise` (bars), `sx` (seat length), `travel` (shock), `pegs` (footpeg kit), `lm` (lights), `mod:{speed,wheelie,air,trick}`.
- `app.js` `Kr()`: sums every equipped part's `mod` into the stats, returns `shock` travel, and warns about a footpeg kit with no throttle or footpegs on a pedal mid.
- `app.js` drive builder: `Ce(M.cranks)?.pegs` hides cranks/pedals and draws footpegs (same as no-pedal moto mids).
- `app.js` end of bike rebuild `Wn()`: calls `globalThis.__WK_BUILD_HOOK__(root,{x,R:Ae,b:M},THREE)` before `scene.add`. Test hooks in sticker/part card `ci`: `__WK_EQUIP__` (= `Zr`, the equip function) and `__WK_BUILD__`.
- NEW `parts3d.js` (imported in `index.html` before `app.js`, cached in `sw.js`):
  - `anchors(x,R)` gives named mount anchors per frame: frontAxle, rearAxle, bb, headTop/headBottom, seatTop, stem, shockFrame, shockArm, underBB, headlight, tail.
  - Added-geometry slots each get exactly one group `wk:part:<slot>`: fenders = arcs over the wheels; shock = body + coil between shockFrame and shockArm; bash = plate under the BB; lights = headlight/light bar on the bars, plus a tail light for moto/bar sets.
  - In-place swaps restyle the stock mesh instead of adding one: bars (raise the cockpit + recolour), grips, seat (length/colour), rims, chain, cranks.
  - The bike root is rebuilt from scratch on every change, so a part always REPLACES the previous one.
- NEW `tests/one-part-per-slot.mjs` (Playwright): equips every option in every slot through `__WK_EQUIP__` and asserts it's equipped, there's exactly one bike root, exactly one `wk:part:<slot>` group for added slots and none for in-place slots. Result: 0 failures across 19 slots.
- `sw.js` cache `wk-v13`.

## v14 — fitment standards, push-bike frames, conversion kits
- NEW `fitment.js` (imported in `index.html`, cached in `sw.js`):
  - `FRAME_STD`: each frame declares `bb` (bmx / 68 / 73 / 100 / moto), `drop` (110 / 135qr / 148ta / 197 / moto), `head` (straight / tapered / triple), `seat` (post mm), `brake` (rim / is / post / moto), `shock` (null / metric / moto), `batt` (bottle / bag / rack / integrated), `wheel` (20 / 27.5 / 29 / 26f / moto) and `alloy`.
  - `fit(build, partId)` returns `{status: ok|adapter|no, adapters, reason}`. The rules cover hub dropouts (moto vs bicycle vs fat; torque arms on alloy dropouts or ≥1000W), front hubs, mid-drives (BB type; the 100mm BB needs `bb100`; moto mids need a moto mount), forks (straight/tapered/dual-crown/triple), brakes (rim bosses, IS→post, bolt-on disc), shock mount, battery mount, tyre size, seat (bench vs post shim) and cranks. Kits are checked component by component.
  - `__WK_FIT_WARN__(build)` feeds red warnings into `Kr()`. `__WK_FIT_PROMPT__` shows "⚠ Needs X  [+ ADD ADAPTER]" for one-tap add. `__WK_FRAMEGEO__` / `__WK_WHEELR__` give geometry and wheel radius for the new frames.
- `app.js` `Zr()` (equip):
  - Refuses `no` with "WON'T FIT: <reason>".
  - Equips `adapter` parts and raises the prompt.
  - A `kit` installs all its components in one build update (replacing motor, controller, throttle, cranks, battery and so on). A hub kit puts the hub wheel in the motor slot, which renders as the rear/front wheel.
  - A frame swap auto-removes parts that no longer fit and lists them.
  - `__WK_EQUIP_MANY__` is used by the adapter button.
- `app.js` bike builder: wheel radius and geometry come from `fitment.js` for the new frames, and frame colour comes from `fc`.
- `app.js` catalog:
  - Frames: `mtb_rigid` (27.5, 3.2kg), `mtb_ht` (29, 1.9kg), `mtb_fs` (27.5, shock mount, 3.1kg), `fat` (26x4, 2.8kg). All are push bikes until you add a kit; `bmx`, `rbmx` and `moto` are kept.
  - Tyres: `trail275`, `xc29`, `fat26`, `moto19` (each has a `size`).
  - Adapters (hidden slots `adp_*`): torque arms, BMX→68 BB adapter, crown race reducer, IS→post, bolt-on disc mount, battery strap/rack, seat post shim.
  - Kit parts: `kh_r1000`, `kh_rfat` (fat), `kh_f500`, `kh_f1000`, `crank_mid`, `kit_dp` (display + PAS, slot `elec`), and batteries `bat_dt48` (bottle), `bat_rack48` (rack), `bat_tri52` (bag).
  - Kits (new KITS rail category): `kit_rh1000`, `kit_rh1500`, `kit_rh3000`, `kit_rhfat`, `kit_fh500`, `kit_fh1000`, `kit_mid1000` (BBSHD-style, 68–73 or 100mm BB), and battery kits for downtube, rack and triangle.
  - `pmid1k` now has `bb100`.
- `tests/one-part-per-slot.mjs` now skips options that legitimately don't fit the current frame.
- `sw.js` cache `wk-v14`.

## v15 — realistic part models, 3D shop previews, sprocket slots + gearing
- NEW `partmodels.js`: realistic-proportion part builders. Each returns a Group of **named sub-meshes, each with its own material** (ready for the future detail workshop):
  - `hubMotor`: `hub:shell`, `hub:flangeL/R` (with 18 `hub:spokeHoles`; the wheel's spokes run into the flange), `hub:coverL/R`, `hub:bolts*`, `hub:fins`, `hub:axle`, `hub:axleNut*`, and `hub:cable` (axle cable exit).
  - `midDrive` (BBSHD-style): `mid:gearHousing` round the BB, `mid:motor` can angled forward and down with `mid:fins`, `mid:endCap`, `mid:cable`, `mid:cover`, plus the `mid:chainring` sprocket.
  - `motoMid`: pancake `motoMid:motor` with fins and covers, `motoMid:controller`, and a 428 `motoMid:sprocket`.
  - `sprocket(teeth, std)`: radius from the real 1/2in pitch, `:ring`, `:teeth` (instanced, one per tooth), `:spider` and `:bolts` (chainrings) or `:hub` (cogs).
  - `chainAlong(path, std)`: visible links (`chain:platesL/R` alternating inner/outer and `chain:rollers`). Width differs for bicycle, 420 and 428.
  - `battery`: triangle (extruded pack + straps), downtube (capsule + rail + lock + LEDs), moto (finned box + terminals), bottle, and rack.
  - `fork`: rigid blades, or `fork:stanchion*`, `fork:lower*`, `fork:arch`, `fork:crown`, `fork:dropout*` and `fork:topCaps`. Dual crown (`fox40`, `dnm`, `corro`) adds `fork:upperCrown`. `dnm` is upside-down (gold stanchions at the bottom).
  - `shock`: eyelets, `shock:body`, `shock:shaft`, plus either `shock:spring` (helix) or `shock:airCan`. The moto shock adds a `shock:reservoir`.
  - `bars(rise, sweep, width)`: `bars:bar` tube, `bars:clamp`, optional `bars:crossbar` and `bars:pad`, and `grips:L/R`.
- `parts3d.js` `realParts()` (called from the build hook) REPLACES the stock app meshes, so nothing stacks:
  - The hub shell, flanges, fins, axle and nuts inside the wheel group are swapped for `wk:model:hub`.
  - `wk:motor` for mids is cleared and gets `wk:model:mid` / `wk:model:motoMid`.
  - In `wk:drive`, the chainring, teeth, spider, cog and chain tube are removed and replaced with `sprocketF`, `sprocketR` and `wk:model:chain`.
  - `wk:suspension` is cleared and gets `wk:model:fork`.
  - The shock group gets `wk:model:shock`.
  - In `wk:cockpit`, the bar tube, crossbar and grips are swapped for `wk:model:bars`; levers and bar-mounted throttle/display move to the new grip height.
  - The v13 recolour hacks for shock, bars, grips and chain were removed.
- Gearing: `__WK_GEAR__(build)` (in `parts3d.js`).
  - Defaults per drivetrain: push bike / hub 25/9 bicycle, pedal mid 44/18 bicycle, moto mid 14/48 428.
  - `g = (rear/front) / stock ratio`. Top speed ×`g^-0.6`, wheelie ×`g^0.7`. On hub bikes the effect is ×0.25, because the chain only drives the pedals.
  - Warnings: chain standard vs sprocket standard mismatch (bad), "Moto mid needs a 420/428 front sprocket" (bad), and a gearing info line.
- `app.js` patches:
  - Chains get `std` (`chain_std`/`chain_gold` bicycle, `chain_hd` 420), plus NEW `chain_428`.
  - NEW slots `sprocket_f` (`spf_25` stock, `spf_28`, `spf_33`, `spf_36nw`, `spf_44`, `spf_52`, `spf_420_13`, `spf_428_12`, `spf_428_14`, `spf_428_16`) and `sprocket_r` (`spr_9` stock, `spr_11`, `spr_13`, `spr_18`, `spr_24`, `spr_420_37`, `spr_428_44`, `spr_428_48`, `spr_428_56`, `spr_428_60`), with `teeth`, `std` and `kg`. Rail entries SPROCKET F / SPROCKET R and `Yr` colours added.
  - In `Kr`: `let GR=globalThis.__WK_GEAR__?.(e)` applies `speedF`/`wheelF` and pushes the warnings. Stats return a `gear` field.
  - In `uc()` (SVG part art): if `__WK_THUMB__(part)` returns an image, an `<img data-thumb>` is rendered instead.
  - In `qm` (part-sheet preview): if `__WK_PREVIEW__.has(part)`, `__WK_PREVIEW__.mount(el, part)` is used (drag to rotate, pinch or wheel to zoom, slow auto-spin).
- NEW `thumbs.js`: ONE shared WebGL renderer (`preserveDrawingBuffer`) renders cached PNG thumbnails and drives the big preview.
  - Covers motors (hub, mid, moto mid), batteries, chains (a loop with links), front/rear sprockets, forks, shocks, bars, and kits (shown as the kit's motor or battery).
  - Other categories keep the SVG icons.
- `index.html` imports `./thumbs.js`. `sw.js` uses `wk-v15` and adds `partmodels.js` and `thumbs.js` to the shell.
