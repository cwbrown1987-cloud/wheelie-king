# Wheelie King: Outback — Handoff for Codex

> **START HERE: `/workspace/wheelie-king-app/CODEX-HANDOFF.md`** (repo: `CODEX-HANDOFF.md`). It's the master handoff with the current state (v17 live, v18 WIP local), the pending queue, architecture, deploy/push steps and known issues. Sections below are older history and may be stale (e.g. "main at fba9d424" and "Pages NOT enabled" are out of date: main is at cf56f41 = v17 (tag v17); v18 WIP is on branch wip/v18-detail (4a90c95), and Pages is enabled).

> **Full transcript:** read `wheelie-king-CHAT-HISTORY.md` for the complete Chris ↔ Odd Job Bot conversation. This file is the short design/tech summary. Next work: gameplay to 2.5D, then full 3D.
Owner: Chris (Korumburra VIC, AEDT). This is a private game for him and his son, aimed at teens and adults.

## Where things are
- Live app (PWA): https://wheelie-king.pages.dev (Cloudflare Pages project `wheelie-king`, deployed with wrangler)
- Repo: https://github.com/cwbrown1987-cloud/wheelie-king (public). main is at commit fba9d424 (wk-v4 UI), with the stickers in assets/stickers/pack1 and pack2.
- GitHub Pages is NOT enabled yet. In Settings > Pages, set the branch to main and the folder to root. It will then be at https://cwbrown1987-cloud.github.io/wheelie-king/
- Source on the bot's computer: /workspace/wheelie-king-app/
- Stickers: /workspace/stickers/pack1/ and /workspace/stickers/pack2/ (the latest 5, each in a different style)

## Tech
- three.js with a procedurally built bike, OrbitControls and PBR materials. The pixel ratio is capped at 2.
- The modular part registry gives each part a builder(), mount anchors, weight, stats and plain-language effects. The centre of gravity is calculated from part weights and world positions, and it changes the balance point.
- Stickers are applied with DecalGeometry, wrap the frame and can be resized. Custom photo stickers get automatic background removal, crop and a die-cut border, with adjustments.
- PWA: manifest, service worker (cache wk-v3), relative ./ paths and .nojekyll.
- Content ratings are all, teen and adult18. 18+ stickers stay hidden until the PIN is entered in Settings. Only a SHA-256 hash of the PIN is stored, the PIN can be changed, and locking or unlocking also applies to stickers already on bikes.

## In progress / next
1. UI rebuild DONE (4 Nov, cache wk-v4): full screen, collapsible panels with Back buttons, stickers page, 3D part sheet with View on Bike, and mount snapping with centre-of-gravity updates. Still to do: test on real phones, add a rear rack part (HAS_RACK), save mount positions, and remove the window.__wkFit test helper. Original asks:
   - fill the full screen (no letterboxing)
   - side menus that collapse, with each category opening a full side panel that has a Back button
   - stickers on their own full page with a Back button
   - a "View on bike" preview on part sheets, without buying
   - small parts that snap between several realistic mount points, with the centre of gravity updating
2. Stickers: aim for a huge mix of styles. Chris's glossy drippy style is the base for only SOME of them. Themes are e-bike, e-moto, BMX, MTB, kick scooter and e-scooter, with Aussie themes first, then US, UK, NZ and Euro. The mix runs from clean young-teen stickers to crude adult ones.
   - Rules: any character with alcohol, smoking, weed or weapons must be clearly adult. No copies of real logos (brand names in plain text are fine).
3. Gameplay, part 1: a 2.5D side-view ride in a basic untextured 3D world. The physics covers pitch, gravity and centre of gravity, and looping a wheelie too far throws you off.
4. Gameplay, later: a full 3D street with side, first-person and chase cameras, a speed gauge, scrape damage, and part wear and breakage with repair or replace.


### v15 — realistic part models + 3D shop previews (done)
- `partmodels.js` builds every realistic part as a Group of NAMED sub-meshes with their OWN materials (`hub:shell`, `mid:gearHousing`, `fork:stanchionL`, `shock:spring`, `chain:rollers`…). See CHANGELOG v15 for the full list.
- `parts3d.js` `realParts()` swaps them onto the bike. Same REPLACE rule as before: the stock mesh is removed and exactly one `wk:model:*` is added per part.
- `thumbs.js` is the single shared renderer for shop thumbnails (`__WK_THUMB__`) and the part-sheet rotatable preview (`__WK_PREVIEW__`).
- Gearing: slots `sprocket_f`/`sprocket_r` carry `teeth` and `std` (bicycle/420/428); chains have a `std`. `__WK_GEAR__` changes top speed and wheelie and warns on chain/sprocket mismatch.
- FUTURE (not built): **Detail workshop.** Tap a part to inspect it, then modify or paint individual sub-meshes.
  - The model groups already expose named sub-meshes with unique materials, so painting = `obj.getObjectByName("hub:coverL").material.color.set(...)`.
  - Save per-part paint as `build.paint[partId][subMeshName]` and re-apply it in `realParts()` after building.


### v16: frame + spoke polish (done)
- Frames are rebuilt in `parts3d.js` `smoothFrame()`: swept CatmullRom tubes, weld fillets, a gusset, a head tube with cups, a seat collar and dropouts. Every piece is a named `frame:*` sub-mesh, ready for the detail workshop.
- Spokes are rebuilt in `respoke()`: each one goes exactly from a flange hole to a rim nipple. Keep this if you touch wheels.
- v17 = ride (B), done; see below. v18 = TRACE stickers (C).


### v17: ride (done)
- `ride.js` handles rendering, input, FX, HUD and condition; `ride-physics.js` is the pure physics, which can be reused for a future 3D mode.
- `Vm` in `app.js` is now just a mount point.
- Condition is stored per device in `localStorage["wk-condition"] = {dirt, wear:{slot:0..1+}}`. It is global (not per saved build) for now.
- Chat log was REMOVED from the app (Chris). `CHAT-HISTORY.md` is a repo-only doc now; don't re-add `chat-history.html` to the deploy.

## Full design brief (everything agreed with Chris)
### Bike and garage
- The bike is the main focus, and detail is key. It should be highly detailed, rotatable and zoomable in the 3D garage.
- Everything is modular, so new parts drop straight in. Every part needs its spec AND its intended effects, plus a real weight and a mount point. Weight and centre of gravity matter.
- Parts list: a mix of real e-bike, e-moto, BMX and MTB parts and original ones, each with stats and plain-language effects.
- Part sheets show a 3D part model and a "View on bike" preview that works before buying.
- Small parts snap to several realistic mount points.
- UI: side menus collapse, each category opens a full side panel with a Back button, and stickers have their own full page with a Back button. The app fills the full screen on phones.
- It's an installable PWA for Android and iOS.

### Stickers and vinyls
- A huge range. They're resizable and wrap the frame, and you can choose the position and the side.
- Upload your own photo to make a sticker. It automatically removes the background, crops and adds a die-cut border, and you can adjust it if needed.
- Themes: e-bike, e-moto, BMX, MTB, kick scooter and e-scooter culture (scooters may become rides later). Aussie culture comes first, e.g. "C U in the NT", eshays, Aussie animals and crude Aussie humour. There are also US sets (big there), plus UK, NZ and Euro.
- Ratings: clean young-teen, teen and crude adult. Crude language is fine.
- 18+ lock: very adult stickers are hidden behind an 18+ PIN in Settings. Chris will give you the PIN; only its hash is stored in the code. Uploaded stickers get ratings too.
- Styles: a BIG MIX. Chris's own glossy airbrushed stickers (Aussie animals in sunnies, chunky drippy lettering, thick white die-cut borders) are the base for only SOME of them. Others should be comic panels, retro badges, race number plates, punk stamps, kawaii, and so on, with varied lettering, text placement and shapes.
- Brands: use the plain brand name in brand colours, no copied logos or copied real sticker designs.
- Content lines I held: any character with beer, darts, cigarettes, weed, bongs or knives must look clearly adult. Teen characters get try-hard jokes only.
- Chris's favourite so far is "Faster Than Ya Mum's Mobility Scooter" (the wombat).
- Files:
  - /workspace/stickers/pack1 and pack2 (both also in assets/stickers in the repo)
  - older text sheets (Chris thought these were weak) are in /workspace/stickers/sheet-*.png
  - earlier generated stickers, e.g. the mobility scooter wombat and the 18+ eshay and "Baked Not Fried" ones, are in Odd Job Bot's assets store

### Gameplay vision
- Reference: Chris's screenshot of a 3D street, a rider in a blue helmet on an orange dirt bike, a chase cam and a speed gauge. Ask Chris for the image.
- Stage 1: 2.5D. A side-on camera on a simple untextured 3D world ("flat but with depth": plain shapes and colours, not 2D). The detail goes into the bike.
- Physics: weight, centre of gravity, gravity and pitch. Looping a wheelie too far throws you off.
- Damage: fenders and parts scraping the road show visible damage. Parts wear, scratch, crack and break, then get repaired or replaced.
- Stage 2: full 3D free-roam with switchable side, first-person and third-person chase cameras.

### Links
- Live: https://wheelie-king.pages.dev
- GitHub Pages: https://cwbrown1987-cloud.github.io/wheelie-king/
- Garage preview Page (2D, it can't load three.js): https://cursor.com/canvas/store-3c0c76ee-a94a-40c6-b880-99298dfc214d/a47f8930-ad97-4ae5-9e18-e5301977a222

### Live app state (v10, 4 Nov 2026)
- Live: https://wheelie-king.pages.dev, cache `wk-v10`. Full per-version change list: `/workspace/wheelie-king-app/CHANGELOG.md`.
- Chat history page: REMOVED from the app in v17 (repo doc only).
- Stickers: in the STICKERS screen, tap a sticker (or SHOW ALL → full picker), then drag the big flat sticker onto the bike; it wraps live over any tube or part (DecalGeometry, `stickers-dd.js`). Placed stickers can be dragged again any time; tap one for Size/Rotate/nudge/Remove. One finger elsewhere spins, two fingers pinch-zoom and pan; zoom goes right in to tubes.
- Placed stickers are stored per device in localStorage `wk-decals` (not in the build save / not synced).
- Deploy: `CLOUDFLARE_ACCOUNT_ID=7f9b89a42182a51327a119efb6cf949e WRANGLER_CACHE_DIR=/tmp/wcache npx wrangler pages deploy . --project-name wheelie-king --branch main --commit-dirty=true` from `/workspace/wheelie-king-app`.
- `/workspace/wheelie-king-app` is NOT a git checkout; v5–v10 changes are not on GitHub yet.
- v11 (4 Nov 2026, live, cache `wk-v11`): infinite money behind `window.DEV_INFINITE_MONEY = true` in `index.html` (money shows ∞, purchases free, nothing locked by price). Set it to `false` to turn it off.
- v12 (not deployed): motor types (rear hubs 1500/3000/5000/8000W, pedal mid, no-pedal moto mids with footpegs). Work-in-progress bundle at `/tmp/app.v12-wip.js`, not yet tested. It's built on v10, so the v11 money patches must be re-applied on top.
- v12 (live, cache `wk-v12`): rear hub motors (1.5/3/5/8kW), a pedal mid (keeps cranks), and moto mids (6/8/12kW, no pedals, footpegs, need a throttle). Also 60V/72V moto batteries. See CHANGELOG.
- Existing ride mode = React component `Vm` in app.js (canvas 2D side-on physics: wheelie, manual, flips, HEAD PLANT, BOTTOMED OUT, finish at x=220; keys arrows/WASD, n/m tricks). The v13 rebuild (side-on MotoX-Mayhem style with the real 3D bike, touch controls, suspension, particles, dirt, damage) and the sticker TRACE mode are not started.
- v13 (live, cache `wk-v13`): modular bike. New slots: shock, bars, grips, seat, rims, cranks, chain, fender F/R, bash guard, lights. SUSP is now FORKS. 3D swaps are in `parts3d.js`.
- RULE (modular parts): equipping a part REPLACES whatever is in that slot. Never stack meshes. The bike root is rebuilt from scratch each change; added visuals live in exactly one group `wk:part:<slot>`; restyle-type slots modify the stock mesh. Every part mounts at a named anchor from `parts3d.js anchors()`: forks head tube→front axle, bars on the stem, seat on the seat post, shock shockFrame→shockArm, wheels on the axles, cranks/pegs at the BB, fenders over the wheels, bash under the BB, battery in the triangle, lights on the bars/fork. Run `tests/one-part-per-slot.mjs` (Playwright, local server) after any parts change; it must report 0 failures.
- v14 (live, cache `wk-v14`): fitment-standards model in `fitment.js`. Frames declare BB/dropout/head/seat/brake/shock/battery/wheel standards; parts are checked by `fit()` and come back as ok, needs an adapter (with a one-tap ADD), or won't fit (with a reason). New push-bike frames (rigid MTB, hardtail 29, full-sus 27.5, fat 26x4) plus conversion KITS (rear/front hub, BBSHD-style mid, battery kits). A frame swap auto-removes parts that don't fit.
