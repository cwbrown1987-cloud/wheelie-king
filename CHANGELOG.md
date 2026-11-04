# Wheelie King: Outback — CHANGELOG (live PWA at https://wheelie-king.pages.dev)

## v18 modular — landings, touch controls and moving attachments, 5 Nov 2026

- `ride-physics.js`: suspension now has hard travel stops and normal-direction contact impulses instead of an explosive extra bottom-out spring. Landing angles use the contacted wheel/track slope; normal rear/front-wheel-first landings are accepted, and completed flips normalize correctly. Genuine inverted and mid-spin impacts still crash. Rigid bikes no longer receive implicit suspension travel.
- `ride.js`: physical travel follows fitted parts and matches visual compression. Fork lowers retain rest mounts when starting a ride from a compressed garage preview.
- `index.html` / `ride.js`: the entire riding surface blocks text selection, long-press menus, drag and browser gestures. Independent pointers retain gas while lean is released. Blur/backgrounding clears held inputs; normal touch taps on Back/Reset/Tilt remain enabled. All listeners are removed on exit.
- `test:landings` passes 36 flat/uphill/downhill drops across four travel settings and three touchdown angles, checking settlement, penetration limits, false crashes, real crash cases and a complete flip. `test:touch` uses actual Chromium touch events for simultaneous gas/lean, independent release, selection/menu prevention, focus loss and a touch tap to exit. This is desktop touch emulation, not real Android/iPad validation.

- `bike-motion.js`: rigid rear triangles now keep their wheel axles fixed; rigid forks no longer telescope. Front travel is limited by the selected fork's travel.
- Brake discs and their mounting bolts rotate with the wheels. Calipers/rim brakes follow the fork lowers or rear swingarm, without spinning with the tyre. Low front guards move with the fork; high triple-clamp guards stay fixed. Rear huggers follow the rear pivot.
- `detail.js`: rear axle fasteners are separated from stationary bottom-bracket/head fasteners so they follow the axle instead of floating at its rest position.
- `test:motion` passes nine builds at five suspension positions (45 poses). Updated `test:mechanics` for complete kits and genuinely separate pedal platforms; it passes TRAX pivot/eye/axle alignment, chain movement, pedal levels, bench controls and no-pedal moto drive. The nine-kit modular/store/ride integration check also passes, with no page errors.
- Published `65f8063` through `npm run deploy`: https://wheelie-king.pages.dev, deployment https://9c89ca07.wheelie-king.pages.dev. Cache: `wk-v18-modular-4`. Verified the production HTML, service worker, ride UI/physics, motion and detail modules return HTTP 200 and SHA-256-match the staged release. Both GitHub branches are updated.

## v18 modular — published 5 Nov 2026

- Published `87ca35a` to the existing production Cloudflare Pages project after successful OAuth sign-in. Live: https://wheelie-king.pages.dev; immutable deployment: https://8197f184.wheelie-king.pages.dev.
- Production HTML, `sw.js`, `modular-catalogue.js` and `trax-suspension.js` return HTTP 200. Live service-worker cache is `wk-v18-modular-3`.
- Includes the modular catalogue/colour variants, nine complete bike kits, click-to-fit/info-button interaction, photo-based 20-inch TRAX rear-frame/pivot correction, and shared wheel/suspension/drivetrain motion described below. The nine-kit local integration check passed before publication; real-device validation remains with Chris.
- Both GitHub branches contain the release. Earlier notes about sign-in blocking deployment are historical.

## Publishing workflow — 5 Nov 2026

- Chris confirmed every update must reach the hosted web app, in addition to GitHub. Added `npm run deploy` for the existing `wheelie-king` Cloudflare Pages project and production branch.
- Upload staging includes only runtime JavaScript, HTML, manifest, headers, vendor modules, stickers and icons. Private attachments, chat history, tests and dependencies are excluded. Every service-worker precache asset is checked before upload.
- Merged the existing production Git history without reverting the modular build. Current runtime remains `wk-v18-modular-3`; Cloudflare OAuth authorization is pending.

## v18 WIP — modular quick-check follow-up, 5 Nov 2026

- Fixed removal of the old motor-bundled controller during scene traversal, which interrupted moto stem/footpeg construction. Collect meshes first and remove them after traversing.
- `node tests/modular-builds.mjs` now passes: all nine complete-bike builds and their component colour compatibility, no duplicate part groups, truly bare Enduro frame, real colour-swatch/info clicks, incompatible-interface rejection, and a finite moving pedal-powered ride. No page/hook errors reported.
- Updated screenshots/result: `wk-shots/modular/`. Cache: `wk-v18-modular-3`. Remote Cloudflare deployment still needs sign-in; this is a local/browser smoke check, not real-device validation.

## v18 WIP — modular catalogue and colour choices, 5 Nov 2026

- Added separate stems, headsets, seatposts, pedals/pegs, hubs, sized rims, suspension rear assemblies, Enduro covers and number plates. Rigid welded rear triangles remain part of their main frame.
- Paintable parts have separately priced/owned colour variants selected by swatches; tyre variants colour the sidewalls. Geometry identity and mounting interfaces stay attached to the base part.
- Strengthened compatibility for pivot families, wheel/rim/tyre/fork sizes, hub dropouts, bar clamps and saddle/post mounts. Added complete-bike kits for all nine bikes; individual frame purchases no longer grant a full build.
- Removed implicit stock geometry for missing components and separated Enduro accessories from its chassis. Shared motion supports separately fitted pedals/rear assemblies.
- New modules: modular-catalogue.js and modular-render.js. Cache: wk-v18-modular-2.
- USER-REQUESTED CHECKPOINT: user asked to stop tests and push immediately. Initial loading and static fitment checks for all nine stock manifests passed. The integration run caught complete-kit swaps retaining old parts/interfaces; both equip and fitment paths were corrected. The final correction has NOT been retested. Existing tests also need updating for explicit parts and complete-bike kits. Further polishing and verification are deferred.

## v18 WIP — TRAX pivot, rear-frame parts and drivetrain motion, 5 Nov 2026

- Rebuilt the rear from Chris's two close-ups. Separate paired lime stays, upper bridge/clevis, axle dropouts and pivot bearings now hinge above the BB; the stationary black seat tube passes between them. The diagonal coil's frame eye mounts to a fixed black top-tube hanger and its moving eye follows the clevis.
- Added **REAR FRAME** rail/store slot, lime/black TRAX assemblies and 3D previews; fitment restricts them to this frame. `TRAX_STOCK` includes the new part. Frame mass now excludes the separately counted assembly. Removed the hidden fallback coil so REMOVE really removes it.
- `trax-suspension.js` builds the rear and a short coil shock with real eye/bolt positions, adjuster collars and a deformable helix. Coil wire thickness stays constant under compression. Corrected front-end clearance for the confirmed 20-inch wheels and fork stroke.
- `bike-motion.js` provides a shared garage/ride visual rig: wheels rotate at distance/radius, stationary axle hardware/cables stay fixed, cranks/gears turn at the tooth ratio, pedal platforms counter-rotate, instanced chain links travel around tangent paths and the TRAX rear cluster/jockey wheels. The rear axle follows the single-pivot arc; the shock remains pinned at both eyes; fork lowers telescope along the fork axis. Peg builds have no pedal rotor.
- Added **TEST MOTION** and a suspension slider to inspect the bike in the garage; normal riding drives the same visual rig and articulated rider legs. The original 2D ride-force integrator is unchanged. Other frames retain simplified rear suspension visuals.
- `partmodels.js`: named replacement crank/pedal/peg assembly plus reusable instanced-chain updates. `parts3d.js` records the build/anchors for the rig and routes the TRAX chain through its rear pulleys. `ride.js` drives articulation and exposes phases in its existing test state.
- Added `test:mechanics`, expanded the slot regression to 23 slots, and updated TRAX ride validation. Geometry, slot, 111-build / 222-wheel, sticker, store-swap, mount-alignment and ride checks pass. Screenshots: `wk-shots/trax/` and `wk-shots/trax-mechanics/`.
- Photo-derived dimensions and non-wheel-size specifications remain estimates. Original personal photos stay excluded from Git.

## v18 WIP — click to fit, separate part information

- Part cards now fit/buy through the existing equip/fitment path immediately, replacing the currently fitted part. The separate `i` button opens the original part sheet without fitting the part. Sticker placement and custom upload retain their existing actions.
- Added keyboard activation, labelled info buttons, spacing for card controls and independent REMOVE handling.
- `tests/part-card-interaction.mjs` exercises real mouse clicks and emulated touch taps: direct fitting, one replacement model/group, info-only opening, keyboard operation, incompatible-part rejection and removal. Screenshots are in `wk-shots/part-click/`.
- Service-worker cache: `wk-v18-part-click-1`. WIP branch only; production remains v17.

## v18 WIP — Chris's 20-inch TRAX bike, 4 Nov 2026 (not deployed)

- Added a selectable **TRAX Lime Dual-Suspension Bike**, modeled from Chris's photo, with **20-inch wheels confirmed by Chris**. Includes its matching stock parts, own Y-frame/rear linkage, short near-horizontal lime coil, speckled lime/black livery and plain TRAX text, tall quill bars/cables, lime fork/rims, black spokes, amber reflectors, black saddle and guarded bicycle chainwheel.
- The frame installs its complete stock pedal build when selected from another frame. Parts remain swappable; compatibility rejects long shocks and unsuitable forks. Matching stock parts are included in ownership. Existing frame behavior is retained for frames without a stock map.
- Added a shared-hook 3D thumbnail and rotatable shop preview. Fixed rim paint targeting so rim swaps actually recolour the hoop/sidewall, rather than the tyre sidewall.
- Fixed ride clones retaining the green equip-selection glow, and cleared stale adapter prompts when switching frames.
- New module `trax-bike.js`; integration changes in `app.js`, `fitment.js`, `frame-geometry.js`, `parts3d.js`, `thumbs.js`, `ride.js` and `sw.js`. Exact hooks, provenance, estimates and validation are documented in `docs/TRAX-BIKE.md`.
- Added `npm run test:trax` and screenshots in `wk-shots/trax/`; extended geometry fixtures to the ninth frame. Stock equip, preview, swaps, fitment and pedal-powered ride pass. Wider v18 remains WIP and is not deployed.

## v18 WIP — Codex geometry checkpoint, 4 Nov 2026 (not deployed)

- `frame-geometry.js` (new): replaces `smoothFrame`'s indexed stock-mesh deletion and spherical weld blobs with a clean frame rebuild. Swept tubes use cylinder-intersection saddle cuts; weld seams and close-up bead instances follow the actual cut edge. Includes independent materials, headset cups, seat clamp/bolt, bottom bracket shells, dropouts, a wider fat-bike rear triangle, and paired moto cradle tubes and swingarms. The original moto shock is kept only when no replacement shock is fitted.
- `parts3d.js`: imports/re-exports the frame builder; `respoke()` maps the 36 spokes to 36 equally spaced rim sockets (three-cross plain hubs, one-cross large motor hubs). Nipples follow the spoke axis and seat at the actual torus inner wall, including their lateral offset. Plain hubs receive perforated flanges.
- `partmodels.js` `hubFlange()`: extruded flanges with 18 real through-bores per side, with the right flange offset half a hole pitch; `hubMotor()` uses the same geometry as the plain hubs. Removed decorative black cylinders that previously only suggested holes.
- `detail.js`: removed fixed-axis weld rings. Nipples stay visible at both LODs. The e-moto now has cast perimeter rails, inset side panels, panel fasteners, head mounts, seat subframe, a fitted battery lid and a taller finned controller. Its old bicycle triangle and round swingarms are hidden beneath the replacement chassis.
- `stickers-dd.js`: reads the new swept tubes' UV/path metadata so decals retain the true tube tangent and radius. Picking rejects meshes beneath hidden ancestors, preventing placement on the old triangle inside the e-moto. An integration test drags a real sticker onto a new tube and verifies its geometry and persistence onto the rebuilt bike.
- `sw.js`: includes `frame-geometry.js`; retains the **unreleased** `wk-v18` cache name.
- Tooling: added locked Playwright development dependency and npm scripts. Slot test now uses installed Chrome by default (`WK_BROWSER` overrides it), writes screenshots under ignored `test-results/`, blocks service workers for deterministic local testing, captures geometry-hook warnings, and exits nonzero on failures. Added geometry, wheel-matrix and frame-showcase tests; `wk-shots/before` records branch `53b8a40`, and `wk-shots/after` records this checkpoint.
- Validation: `npm run test:geometry` checks 8 frame types, 76 receiver joints and 180 motor-flange bores. `npm run test:wheels` checks 92 compatible builds / 184 wheels against rendered instance endpoints, actual flange bores, nipple axes and rim surfaces. `npm run test:slots` checks the inherited 22-slot matrix (32 legitimate fitment skips). All passed with no reported hook/page errors. Before/after captures cover full bikes and seat/head/BB close-ups for all eight frames.
- Still WIP: this is **not** a claim of reference-level quality or real-device performance. Wider part detailing, per-frame fenders/covers and paint controls, TRACE, and Android/iPad validation remain. Production and `main` remain v17; do not release this checkpoint on its own.

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

## v16: smooth frames, spokes that seat properly, stacked banners (quick fix from Chris's Android screenshots)
- `parts3d.js` `smoothFrame()` runs in the build hook after `realParts()`. It REMOVES the stock straight frame cylinders, then rebuilds every frame type with named sub-meshes:
  - `frame:headTube` with `frame:lowerCup`/`frame:upperCup` headset cups.
  - `frame:seatTube`, which now ends AT the seat cluster, plus a `frame:seatCollar`. Nothing pokes above the top tube.
  - `frame:topTube`: a CatmullRom TubeGeometry with a gentle arch.
  - `frame:downTube`: curved, flowing into the BB.
  - `frame:bbShell`.
  - Weld fillets at every join: `frame:weld*`.
  - A `frame:gusset` behind the head tube.
  - Non-moto frames: curved `frame:chainstayL/R` that bow out for tyre clearance, curved `frame:seatstayL/R`, a `frame:bridge`, and `frame:dropoutL/R` plates with axle slots.
  - Moto: the swingarm and shock are kept; the cradle becomes one smooth `frame:cradle` tube.
- `parts3d.js` `respoke()` replaces the stock instanced spokes on every wheel (plain hub and hub motor) with `wheel:spokes`. Each of the 36 spokes runs from a flange hole to a rim nipple (`wheel:nipples`, the new instanced nipples):
  - Flange hole radius: plain hub 0.030; hub motor = hub radius + 0.009, on the hub-motor flange.
  - Rim end: rim inner radius (rim torus radius − tube).
  - Verified numerically: hole and nipple radius errors are ~1e-17, so no ends stick past either.
- `partmodels.js` `hubMotor()` accepts `opts.r`/`opts.wd`, so the hub is built at the real wheel's hub size (it's no longer scaled).
- `fitment.js`: the adapter banner (e.g. "Needs Torque Arm Pair") now sits at the bottom above the nav, so it no longer overlaps the centred FITS popup.
- `sw.js` cache `wk-v16`. Before/after close-ups are `wk-shots/v16-before-*` and `v16-after-*`.
- NOTE: the new ride (B) is now v17 and TRACE (C) is v18. `ride.js` is in the folder and in the SW shell, but it isn't wired up yet in this version.

## v17: the new ride (B) + Chat log removed
- **Chat log feature removed entirely** (Chris's request):
  - Removed the floating "💬 Chat log" button and the `#chat-history` redirect from `index.html`.
  - `chat-history.html` is out of the deploy folder (moved to `/workspace/wheelie-king-removed/`) and out of the `sw.js` SHELL precache.
  - `CHAT-HISTORY.md` stays in the GitHub repo as a docs file only; it is not part of the web app.
- RIDE upgraded in place. The `Vm` component body (`app.js`) now just mounts `ride.js` `mountRide(el,{stats,build,onResult,onClose})`; the entry point (RIDE button) is unchanged, and the old canvas-2D ride code is gone.
- NEW `ride.js`: a three.js side-on scene in MotoX Mayhem style.
  - **Bike and rider:** the REAL garage bike is cloned (parts, stickers, dirt), with a low-poly rider whose body leans with input.
  - **Terrain:** generated by `ride-physics.js` `makeTerrain()` (hills, kickers, gaps, puddles, whoops, step-downs, checkpoints, finish) and drawn as an extruded dirt mesh with a dirt-top strip.
  - **Scenery:** water puddles, checkpoint and finish flags, parallax hill layers, scrub, sky and sun, and a shadow-casting sun that follows the bike.
  - **Camera:** a follow camera that zooms out with speed.
  - **Suspension:** visible. Each wheel moves toward the frame by `compression × travel`; travel comes from the fitted fork and shock.
  - **Particles** (one instanced pool): roost, landing dust, puddle splash, and scrape sparks on deep monos.
  - **Dirt:** builds up with distance and is ×30 faster in puddles. It tints the bike live and is saved to `localStorage["wk-condition"]`.
  - **Damage:** scrapes wear the rear fender and bash guard; crashes add 0.45 to the part that hit. 0.4 = CRACKED (bent/darkened), 1.0 = BROKEN (hidden).
  - **HUD:** score, money earned, dirt %, km/h, current wheelie/stoppie time and best mono, battery % (or PEDAL POWER), and a course progress bar.
  - **Touch controls** (pointer events, multi-touch, so they work on Android Chrome and iPad Safari): BRAKE, LEAN pad (drag left/right), 360, WHIP, HOP and GAS.
  - **Tilt:** an optional TILT toggle, which asks for iOS permission.
  - **Keyboard:** →/D gas, ←/A brake, ↑/W lean back, ↓/S lean forward, Space hop, Q 360, E whip, R reset, Esc exit.
  - **Crashes** auto-respawn at the last checkpoint after 2.2s.
- `ride-physics.js` tuning:
  - Throttle ramps up instead of snapping on.
  - Drive is capped at 0.4g × grip.
  - A rider balance assist holds a mono near the balance point unless you lean back, so leaning back is how you loop out.
  - Body-lean torque was raised.
  - The integrator runs at a fixed ~480 Hz substep, and negative frame dt is clamped (this fixed a start-of-ride blow-up).
- **Money from trick score:**
  - `Gn` (the ride result handler) adds `money = score/10` to the wallet and toasts "RIDE PAID $x".
  - No energy gating.
  - A bare push bike rides at pedal power (250W, ~8 m/s cap).
- **Garage condition:**
  - `parts3d.js` applies the saved dirt and damage to the garage bike (`applyCondition`).
  - The new `#wk-cond` panel (in `ride.js`, shown only in the garage when dirty or damaged) has 🧽 WASH and per-part 🔧 REPAIR $x. Repair charges `__WK_MONEY__` and rebuilds the bike via `__WK_SETBUILD__`; both are new hooks exposed in the `ci` renderer.
- `tests/one-part-per-slot.mjs` now also covers `sprocket_f` and `sprocket_r`. On every equip it asserts exactly one front sprocket/chainring, one rear sprocket and one chain model.
- `sw.js` uses `wk-v17`; the shell includes `ride.js` and `ride-physics.js`.
