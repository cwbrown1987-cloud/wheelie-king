# Wheelie King: Outback — CODEX HANDOFF (master doc)

_Written 4 Nov 2026, 6:30 PM AEDT (Australia/Sydney), when Chris paused the previous agent mid-v18. This file is documentation only. No game code was changed and nothing was deployed when it was written._

## TL;DR
- **CURRENT LIVE (5 Nov):** `65f8063` is published at https://wheelie-king.pages.dev (deployment https://9c89ca07.wheelie-king.pages.dev), cache `wk-v18-modular-4`. Production HTML, service worker, ride UI/physics, motion and detail modules return HTTP 200 and SHA-256-match the staged release. Both GitHub branches are pushed. `test:landings`, `test:touch`, `test:motion`, `test:mechanics` and `test:modular` passed. This supersedes pending-publication and prior-cache notes below. Next work: finer modular component detail and remaining pre-modular test migration; Chris is testing actual-device landings/two-finger controls.
- **Race/input follow-up (5 Nov):** Chris reported all three landing faults (false crashes, bouncing/flipping, sinking) plus two-finger text selection. Corrected normal contact forces and hard suspension stops, touchdown-angle handling, matching visual/physical travel, full-surface gesture/selection blocking and independent pointer release. New `test:landings` and `test:touch` cover 36 drops and actual Chromium multi-touch events. These changes share the `wk-v18-modular-4` attachment release below. Real-phone testing remains with Chris.
- **Continuation (5 Nov):** attachment correction is ready for publication with cache `wk-v18-modular-4`. Rigid forks/rear triangles stay rigid; discs spin while calipers, axle bolts and guards follow the appropriate fork/swingarm mounts. `npm run test:motion` verifies nine bikes/45 poses; `test:mechanics` and `test:modular` also pass. Next deferred work is finer modular-component detail and updating remaining pre-modular tests; do not regress separate purchases, variants or complete-kit semantics.
- **LIVE RELEASE (5 Nov):** the modular v18 build is now deployed at https://wheelie-king.pages.dev, deployment https://8197f184.wheelie-king.pages.dev, from `87ca35a`. Verified production HTML, service worker, modular catalogue and TRAX suspension module return HTTP 200; production cache is `wk-v18-modular-3`. Both `main` and `wip/v18-detail` include the release. Cloudflare OAuth on this PC succeeded. Older statements below about v17 being live or sign-in being blocked are historical checkpoints, superseded by this release.
- **Publication requirement (5 Nov, Chris):** every change must be pushed to the actual web app at https://wheelie-king.pages.dev as well as GitHub. A localhost link or branch push alone does not complete a release. Run `npm run deploy` to stage only runtime assets and deploy to the existing Cloudflare Pages production project; verify the live `sw.js` cache afterward. `node scripts/deploy.mjs --stage-only` prepares the upload without publishing. Cloudflare OAuth sign-in is currently pending on this PC.
- **Quick-check follow-up (5 Nov):** modular integration check now passes for all nine complete bike builds, all stock colour/interface permutations, part removal, swatches/info, fit rejection and a moving ride. Fixed a scene traversal/removal error that interrupted moto stem/pegs. See `wk-shots/modular/validation.json` and the newest CHANGELOG entry. Cache is `wk-v18-modular-3`; earlier untested-checkpoint notes below are historical. Local server was restarted in a hidden process at `http://127.0.0.1:8931/`. Cloudflare is still unauthenticated.

- **LATEST USER CHECKPOINT (5 Nov):** modular catalogue/colour-swatches batch is pushed for user testing. See the first CHANGELOG entry. New slots cover stem/headset/post/pedals/hubs/rear assemblies/covers/plate; each bike has an explicit complete kit under KITS. Individual frame purchases now fit only the frame. User said **no more tests, just push** at low usage. Static nine-stock fitment checks passed, but the complete-kit transition correction was not retested. Resume with `tests/modular-builds.mjs`, update older tests to use complete-kit IDs/explicit parts, and review rendering before claiming this batch fully validated. Current cache: `wk-v18-modular-2`. Do not discard this checkpoint or revert to hidden stock parts.

- **Latest TRAX correction (5 Nov):** close-up reference replaces the first rear geometry. `rear_frame` is a separate store slot (lime/black) and the diagonal coil has fixed frame / moving clevis anchors. `trax-suspension.js` builds them; `bike-motion.js` supplies the shared garage/ride visual rig, wheel/drivetrain motion and **TEST MOTION** / suspension controls. `npm run test:mechanics` verifies five compression poses, store swapping, tyre clearance and no-pedal behavior. Current cache: `wk-v18-trax-pivot-2`. See `docs/TRAX-BIKE.md` and `wk-shots/trax-mechanics/`. Do not reintroduce the old fallback shock or rear stays inside the main frame. The existing 2D ride integrator remains unchanged.
- **Publishing status:** Chris wants every completed change pushed and testable. The click-to-fit update was pushed as `ddeaec3`; the mechanics correction follows on the same branch. Local preview is `http://127.0.0.1:8931/`. On 5 Nov `npx wrangler whoami` reported **not authenticated** on this Windows host, so Cloudflare deployment remains blocked by sign-in. Do not claim a remote deployment or replace the existing Cloudflare project with unrelated hosting.
- **Card interaction:** click a part card to fit it directly; its separate `i` button opens the existing part sheet. Sticker/upload interactions are preserved. `npm run test:cards` covers mouse/touch, replacement, info-only and removal. The initial card cache was `wk-v18-part-click-1`, superseded by the latest mechanics cache above.
- **TRAX addition:** Chris's photo-based **20-inch TRAX Lime Dual-Suspension Bike** is selectable under FRAMES on the v18 branch. It installs matching stock parts, remains moddable, has its own Y-frame/coil anchors, livery, tall bars, lime rims and reflectors, and works in ride mode. See `docs/TRAX-BIKE.md`, `trax-bike.js`, `tests/trax-bike.mjs` and `wk-shots/trax/`. Only the wheel size is confirmed; other specifications are game estimates. This is still **not deployed**.
- **Latest continuation checkpoint (4 Nov, Codex):** v18 remains **WIP, not deployed** on `wip/v18-detail`. `frame-geometry.js` replaces blob welds with saddle-cut tube joints and matching weld seams; wheels have perforated flanges, evenly spaced rim sockets and spoke-aligned nipples. The e-moto has new cast perimeter rails and inset panels. See the v18 WIP entry in `CHANGELOG.md` for exact patches and validation. `wk-shots/before/` and `wk-shots/after/` contain eight-frame full/joint comparisons. The original section 6 below describes the inherited snapshot; this checkpoint supersedes its frame/spoke/weld details.
- **Current checkout:** `C:\Users\cbrow\Documents\ChatGPT\Wheelie king` is a real Git checkout of `wip/v18-detail`. No `/workspace` or `/tmp` paths from the old agent exist on this Windows host.
- **What it is:** a private PWA garage and wheelie game for Chris and his son Jaxon. You build a BMX/MTB/moto into an e-bike or e-moto out of modular 3D parts (three.js), add wrapped stickers, then ride a side-on 3D course.
- **LIVE:** modular v18 at https://wheelie-king.pages.dev (service worker cache `wk-v18-modular-3`).
- **GitHub:** https://github.com/cwbrown1987-cloud/wheelie-king. Both `main` and `wip/v18-detail` contain the current release. The previous v17 is preserved by tag `v17`.
- **LOCAL:** `/workspace/wheelie-king-app` (not a git checkout) holds an **undeployed, unfinished v18** (`wk-v18`, new `detail.js`). See [Current state](#6-exact-current-state-v18-wip).
- **Next work, in order:** (1) finish frames and spokes, (2) bring every part up to product-render quality, (3) per-frame fenders and covers with paint swatches, (4) TRACE sticker mode, (5) push v16+ to GitHub.
- **Standing rule:** after EVERY update, deploy to Cloudflare AND push to GitHub, with CHANGELOG.md and handoff notes that list the exact changes.
- **Never commit the 18+ PIN.** Chris knows the PIN; never commit it. The code stores only a SHA-256 hash (`wk-pin-hash`).

## 1. Links
| What | Where |
|---|---|
| Live app | https://wheelie-king.pages.dev (Cloudflare Pages project `wheelie-king`, in the Korumburra@repairmepc.net Cloudflare account, account id `7f9b89a42182a51327a119efb6cf949e`) |
| Repo | https://github.com/cwbrown1987-cloud/wheelie-king (public, `main`) |
| GitHub Pages | https://cwbrown1987-cloud.github.io/wheelie-king/ (enabled) |
| Per-version change list | `CHANGELOG.md` (this folder) |
| Older design brief | `/workspace/wheelie-king-HANDOFF.md` (repo: `HANDOFF.md`) |
| Full Chris ↔ bot transcript | `/workspace/wheelie-king-CHAT-HISTORY.md` (repo doc only, PIN redacted). It's built by `/workspace/build.py` from session logs. |

## 2. Run locally and test
Current Windows checkout (Node 24, Python 3.11, installed Google Chrome):
```powershell
npm ci
python -m http.server 8931 --bind 127.0.0.1
# In a second terminal:
npm run test:geometry
npm run test:slots
npm run test:wheels
npm run test:stickers
npm run test:trax
npm run showcase -- after
```
`test-results/` and `node_modules/` are ignored and must never be deployed. Browser test contexts use fresh storage with service workers blocked. `WK_BROWSER` can select another installed Playwright channel. Captures are desktop Chrome/SwiftShader evidence, **not** Android/iPad touch or performance validation. The slot test now returns a failing exit code for errors; its output path is no longer hardcoded to `/workspace`.

Original agent's Linux commands (historical):
```bash
cd /workspace/wheelie-king-app && python3 -m http.server 8931     # open http://localhost:8931/
# Playwright lives at /tmp/pw/node_modules (box). Run the test from there:
cd /tmp/pw && cp /workspace/wheelie-king-app/tests/one-part-per-slot.mjs t.mjs && node t.mjs http://localhost:8931/
```
- `tests/one-part-per-slot.mjs` equips every option in every slot through `__WK_EQUIP__` and checks four things: exactly one bike root, one `wk:part:<slot>` group for added slots (none for in-place slots), one front sprocket, one rear sprocket and one chain model. It skips parts that the fitment rules say won't fit. It also saves showcase screenshots. The output prefix is hardcoded to `/workspace/wk-shots/v13-`, so change `OUT` for each version.
- **Last run (local v18, 4 Nov):** `fails: 0, skipped: 32, errors: []`, with all 22 slots including `wing`.
- WebGL in headless Chromium needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. The test already passes these.
- The service worker caches aggressively. Load with `?v=<timestamp>` or clear site data. On a phone, a new `CACHE` name is what forces the update.
- Touch has to work on **Android Chrome** (Chris) and **iPad Safari** (Jaxon). Use pointer events and multi-touch. Block iOS `gesturestart` so pinch-zoom doesn't fight the canvas. Nothing has been tested on a real device yet.

## 3. Deploy and push (every release)
1. Bump `CACHE` in `sw.js` (`wk-vNN`). If you add a JS file, add it to `SHELL` and import it.
2. Add a `## vNN` section to `CHANGELOG.md` that lists the exact patches (file, function or snippet), and update this file's state section.
3. Run the test: 0 failures.
4. Deploy (command from CHANGELOG):
   ```bash
   cd /workspace/wheelie-king-app && CLOUDFLARE_ACCOUNT_ID=7f9b89a42182a51327a119efb6cf949e WRANGLER_CACHE_DIR=/tmp/wcache npx wrangler pages deploy . --project-name wheelie-king --branch main --commit-dirty=true
   ```
   Check it with `curl -s https://wheelie-king.pages.dev/sw.js | head -1`.
5. Push to GitHub `main`. The app folder is not a git repo, so clone the repo, copy the app files over, commit and push. Keep these out of the deploy and the repo: `.wrangler/`, `chat-history.html`, and **anything that contains the PIN**. Keep in the repo: `CHAT-HISTORY.md`, `HANDOFF.md`, `CODEX-HANDOFF.md`, `CHANGELOG.md`, `docs/`, and `assets/stickers/pack1`, `pack2`.
   - Before every commit, grep the whole tree for the PIN digits, and make sure the PIN itself only exists in Chris's head.

## 4. Architecture map
`app.js` is a **minified React + three.js bundle with no source in this folder**. Every change to it so far has been a string patch. Search for the quoted snippets in CHANGELOG to find them. Old bundles are in `/tmp/app.v6/8/9/14/15/17.js`, and `/tmp/app.v17.js` matches what's live now. Where you can, put new work in side modules that plug into the hooks below instead of editing `app.js`.

| File | Role |
|---|---|
| `index.html` | Import map (`three` → `vendor/three.module.js`), `window.DEV_INFINITE_MONEY = true`, `__WK_STANDALONE__`, `__WK_URLS__`, the install bar and SW registration. Load order: three → `parts3d.js` → `fitment.js` → `thumbs.js` → OrbitControls/RoomEnvironment → `app.js` → `stickers-dd.js`. |
| `app.js` | The UI: garage, shop, builds, challenges, settings and PIN. Holds the catalog array `li`, the equip function `Zr()`, the stats and warnings `Kr()`, the bike rebuild `Wn()` (rebuilt from scratch on every change), the part SVG art `uc()`, the part sheet `qm`, the ride mount `Vm` and the ride result `Gn`. |
| `parts3d.js` | `__WK_BUILD_HOOK__(root,{x,R,b},THREE)` runs at the end of each rebuild. Provides anchors, per-slot groups, `realParts()`, `respoke()`, condition and gear hooks. `smoothFrame` is now imported/re-exported from `frame-geometry.js`. Calls `detailPass()` and `startLOD()`. |
| `frame-geometry.js` | v18 continuation: clean frame rebuild, saddle-cut swept tubes, cylinder-intersection weld seams with hi-LOD ripples, individual materials, cups/clamps/shells/dropouts and moto cradle/swingarm geometry. |
| `partmodels.js` | Realistic part builders that return Groups of NAMED sub-meshes, each with its own material: `hubMotor`, `midDrive`, `motoMid`, `sprocket`, `chainAlong`, `battery`, `fork`, `shock`, `bars`. |
| `detail.js` | **v18 WIP.** PBR detail pass and LOD. See section 6. |
| `fitment.js` | `FRAME_STD` (bb/drop/head/seat/brake/shock/batt/wheel/alloy per frame) and `fit(build,id)` → ok/adapter/no. Also `__WK_FIT__`, `__WK_FIT_WARN__`, `__WK_FIT_PROMPT__` (the "+ ADD ADAPTER" banner), `__WK_FRAMEGEO__` and `__WK_WHEELR__`. |
| `thumbs.js` | ONE shared WebGL renderer that makes the shop thumbnails (`__WK_THUMB__`) and the rotatable part-sheet preview (`__WK_PREVIEW__.has/mount`). |
| `stickers-dd.js` | Drag-and-drop DecalGeometry stickers that wrap tubes. Exposes `__WK_STK_PICK__`, `__WK_STK_ALL__` and `__WK_STK__`. Saves to `wk-decals` and re-raycasts saved stickers onto the bike after rebuilds. |
| `ride.js` | v17 side-on ride (MotoX Mayhem style). It clones the real garage bike and adds a rider, terrain mesh, particles, HUD, touch, tilt and keyboard controls, dirt and damage. It also owns the garage `#wk-cond` WASH/REPAIR panel. Exposes `__WK_RIDE__`, `__WK_RIDE_STATE__`, `__WK_COND__` and `__WK_COND_PANEL__`. |
| `ride-physics.js` | Pure physics: `makeTerrain()` and a fixed ~480 Hz integrator with pitch, CoG, balance assist and suspension. **Keep it reusable** for the future 3D mode. |
| `sw.js` | `CACHE` name and `SHELL` precache list. Cache-first, and old caches are deleted on activate. |
| `vendor/` | three r160 `three.module.js`, `OrbitControls.js`, `RoomEnvironment.js`, `DecalGeometry.js`. |
| `stickers/` | Shipped sticker images: 6 transparent PNGs plus 10 `pack*-cut.webp` die-cut images. |
| `tests/one-part-per-slot.mjs` | The regression test (section 2). |
| `_headers`, `manifest.webmanifest`, `icons/`, `.nojekyll` | PWA and Pages plumbing. |
| `docs/reference/` | Chris's reference images (section 12). |

**Global hooks** (all `globalThis.__WK_*__`):
- **Exposed by app.js:**
  - `__WK_VIEW__` = `{scene, camera, renderer, controls, mode}` (garage)
  - `__WK_CAT__()` = `{items, base}`
  - `__WK_BUILD__` (the current build object)
  - `__WK_EQUIP__(id)` (= `Zr`)
  - `__WK_EQUIP_MANY__(ids)`
  - `__WK_SETBUILD__(build)` (replace the build and rebuild)
  - `__WK_MONEY__` (read and charge the wallet; used by repair)
  - Note: `__WK_EQUIP__`, `__WK_BUILD__`, `__WK_SETBUILD__` and `__WK_MONEY__` are set inside the card renderer `ci`, so **open any category once** before you use them.
- **Consumed by app.js:**
  - `__WK_BUILD_HOOK__`, `__WK_FIT_WARN__`, `__WK_FIT_PROMPT__`, `__WK_GEAR__`, `__WK_THUMB__`, `__WK_PREVIEW__`, `__WK_STK_PICK__`, `__WK_STK_ALL__`, `__WK_FRAMEGEO__`, `__WK_WHEELR__`, `__WK_THREE__`, `__WK_URLS__`
  - `__WK_LOD__` ("hi"/"lo", set by detail.js)

**Scene naming:**
- Slot groups are `wk:<slot>` (e.g. `wk:frame`, `wk:motor`, `wk:drive`, `wk:cockpit`, `wk:suspension`, `wk:sticker`).
- Added parts go in `wk:part:<slot>`, and realistic models are `wk:model:<kind>`.
- Sub-meshes are named `part:piece` (e.g. `frame:headTube`, `hub:coverL`, `caliper:piston`, `wheel:nipples`).
- `userData.lod="hi"` means the mesh is only shown close up.

**localStorage keys:**

| Key | What it holds |
|---|---|
| `wk-decals` | Placed stickers, per device: `{id,img,p,n,size,rot}` |
| `wk-condition` | `{dirt, wear:{slot:0..1+}}`. It's global, not per build. |
| `wk-cond` | Condition panel state |
| `wk-adult-until` | 18+ unlock expiry |
| `wk-pin-hash` | SHA-256 of the PIN |
| `wk-relock` | Relock setting |
| `wk-font` | Font setting |
| `wk-install-dismissed` | Install bar dismissed |

The app's own save state (builds, coins, owned parts) is persisted by the bundle itself. Inspect `localStorage` in devtools to see it.

**Slots** (category rail `Jf`, colours `Yr`):
- **Main slots:** `frame`, `motor`, `battery`, `controller`, `throttle`, `elec` (display/PAS), `kit`, `tyres`, `rims`, `brakes`, `suspension` (labelled FORKS), `shock`, `bars`, `grips`, `seat`, `cranks`, `chain`, `sprocket_f`, `sprocket_r`, `fender_f`, `fender_r` (relabelled HUGGER in v18), `wing` (NEW in v18, REAR WING), `bash`, `lights`, `sticker`.
- **Hidden adapter slots:** `adp_torque`, `adp_bb`, `adp_crown`, `adp_brake`, `adp_disc`, `adp_battmount`, `adp_shim`.
- **Added-geometry slots** (one `wk:part:<slot>` each): shock, fender_f, fender_r, bash, lights, wing. The rest swap or restyle in place.
- **Frames:** `bmx`, `rbmx`, `moto`, `mtb_rigid`, `mtb_ht`, `mtb_fs`, `fat`, plus `emoto` (v18).

## 5. Version history (details in CHANGELOG.md)
| Version | Changes |
|---|---|
| v3–v4 | Original PWA, then the full-screen UI rebuild (collapsible panels, sticker page, 3D part sheet). This is the last state described by the old HANDOFF. |
| v5 | Chat-history page. Removed again in v17. |
| v6 | 10 new image stickers. |
| v7 | First decal wrap and drag & drop, plus the hooks `__WK_VIEW__` and `__WK_CAT__`. |
| v8 | Transparent die-cut stickers. |
| v9 | Real tube wrapping, continuous drag, `wk-decals` persistence. |
| v10 | Stickers built into the STICKERS screen: re-drag, deep zoom, pan, two-finger touch. |
| v11 | `DEV_INFINITE_MONEY`. |
| v12 | Rear hubs 1.5/3/5/8 kW, pedal mid, no-pedal moto mids with footpegs, 60/72 V batteries. |
| v13 | Modular bike (12 new slots), the swap-in-place REPLACE rule, `parts3d.js`, the slot test. |
| v14 | Fitment standards, push-bike MTB/fat frames, conversion kits and adapters (`fitment.js`). |
| v15 | Realistic named-sub-mesh part models (`partmodels.js`), 3D shop previews (`thumbs.js`), sprocket slots and gearing. Pushed (`e9e13c7`). |
| v16 | `smoothFrame()` swept frames and welds, `respoke()` flange-to-nipple spokes, adapter banner moved. Live and pushed. |
| v17 | New three.js ride (`ride.js` + `ride-physics.js`), money from score, dirt and damage, WASH/REPAIR. Chat log removed. Live and on `main` (`cf56f41`, tag v17). |
| v18 | WIP on `wip/v18-detail`; see the latest checkpoint and CHANGELOG. |

## 6. Exact current state (v18 WIP)
I compared local files against live (`curl` of wheelie-king.pages.dev):
- **Identical to live:** `partmodels.js`, `thumbs.js`, `ride.js`, `ride-physics.js`, `stickers-dd.js`, `index.html`
- **Changed:** `sw.js`, `parts3d.js`, `fitment.js`, `app.js`
- **New:** `detail.js` (not on live)

**What v18 changed:**
- `sw.js`: `CACHE="wk-v18"`, and `./detail.js` added to SHELL.
- NEW `detail.js` (109 lines): `detailPass(root,A,b,T,find,slotGroup,g)`, `startLOD()`, `applyLODNow()`, `bbox()` (bevelled extruded box), `fenderArc()`, `LOD_NEAR=1.5`. The detail it adds:
  - **Frame:** hi-LOD weld-bead rings on every `frame:weld*`, plus hex bolts at the BB, rear axle and headset.
  - **Brakes:**
    - Real extruded rotors with 24 holes (`brake:rotor`) and 6 rotor bolts.
    - Bevelled calipers (`caliper:body`, red on moto or `zee`) with hi-LOD pistons and pads, plus bolts.
  - **Tyres:** a second staggered row of 96 hi-LOD knobs (`tyre:knobsHi`). Spoke nipples are tagged hi-LOD.
  - **Fenders:**
    - Front: an extruded blade (moto/MX) under the triple clamp, or an arc on the axle.
    - Rear: a hugger arc on the swingarm with a bolt.
  - **NEW rear `wing` slot:** a blade behind the seat with an emissive tail-light and bolts.
  - **LOD:** a 250 ms interval shows `userData.lod="hi"` meshes only when the camera is within 1.5 m of its target.
  - **`emoto()` (generic "Enduro E-Moto" look, no logo):**
    - A bevelled clearcoat battery/side-panel enclosure with seam lines and a battery lid.
    - A finned controller with bolts, and a motor cable (TubeGeometry).
    - A box-section swingarm with a pivot and axle bolts. It hides the stock round arms.
    - A long flat seat, a headlight with an emissive lens, and a number plate.
    - Green fork lowers.
- `parts3d.js`: imports detail.js and calls `detailPass(...)` and `startLOD()` in the build hook (inside try/catch). `realParts` and `smoothFrame` now treat `emoto` as moto.
- `fitment.js`: `FRAME_STD.emoto` (moto BB, dropout and brakes, triple clamp, moto shock, integrated battery, moto wheel, alloy).
- `app.js` (string patches):
  - Catalog: frame `emoto` "Enduro E-Moto Frame" (11 kg, $7200, maxW 8000), and wings `wing_blk`, `wing_wht`, `wing_neon`.
  - Moto checks: 3 places changed from `==="moto"` to also accept `"emoto"`.
  - Rail and colours: `FENDER R` relabelled `HUGGER`, a new `wing` rail entry "REAR WING", and the colour `wing:#7dffb0`.
- `tests/one-part-per-slot.mjs`: `wing` added to the slots and to the added set.
- Screenshots: `/workspace/wk-shots/v18-1…9-*.png` (emoto full and 3/4 view; close-ups of the caliper/rotor/hub, controller fins, swingarm/hugger/wing, headlight/plate, tyre knobs and BMX weld beads; far view with low LOD).
- **CHANGELOG has NO v18 entry yet.** That's the next doc to write once v18 is finished.

**Done:** the `detail.js` scaffolding (PBR helpers, bevel boxes, LOD switcher), rotors and calipers, extra knobs, weld beads, bolts, the wing slot, the emoto frame option, emoto fitment. The slot test passes with 0 failures, and no page errors appear in headless.

**Not done / not good enough yet:**
- **Not reference quality.** `v18-1-emoto-full.png` vs `docs/reference/quality-reference-emoto.png`: the emoto still reads as a BMX-style tube frame with a black slab in the triangle.
- **Frame (inherited snapshot):** superseded by the saddle-cut frame builder and cast e-moto perimeter rails in the Codex checkpoint. Broader visual/real-device review is still required.
- **Rendering setup:** PMREM environment and floor shadows are confirmed in `app.js`; improve their visual quality as needed.
- **Not yet in the detail pass:** motors and wheels; the "start with frames, fenders, motors, wheels" step is only partly done.
- **Fenders and covers:**
  - Fender styles (MTB clip-on, full, full-wrap rear) aren't per frame yet, and the covers slots don't exist.
  - No colour swatches.
  - The wing has no fitment rule (it's allowed on any frame) and doesn't take damage.
- **Weld beads:** replaced in the Codex checkpoint by welds following the actual cylinder-intersection seam.
- **LOD:** it keys off camera-to-target distance (<1.5 m), not the true distance to the part. Tune this on a phone.
- **Not tested on a phone. A v18 WIP CHANGELOG entry now exists. Not deployed. TRACE (item 4) not started.**

**Release boundary:** `main` already contains v17 (`cf56f41`, tag `v17`; handoff correction `e21aa01`). The inherited v18 is on `wip/v18-detail` (`4a90c95`, handoff correction `53b8a40`), followed by the Codex continuation checkpoint. Keep WIP commits on that branch. Merge to `main` and deploy to Cloudflare together only once the intended release is finished, tested and documented. GitHub Pages serves `main`.

**Verified rendering setup:** `app.js` already creates `scene.environment` from `PMREMGenerator.fromScene(new RoomEnvironment(), .04)`, a shadow receiver and a radial floor shadow. Do not add a second environment or claim these are missing. Contact quality still needs visual tuning against the reference.

## 7. Pending queue (Chris's order), with acceptance criteria
1. **Finish the frame/spoke fix.** References: `docs/reference/frame-joints.png`, `docs/reference/hub-spokes.png`.
   - Every frame type (bmx, rbmx, mtb_*, fat, moto, emoto) has smooth swept tubes that flow into each other, with weld fillets at every join, a head tube with cups, a seat collar, a BB shell and dropouts.
   - Nothing pokes through at any zoom or orbit angle. Check close-ups at each joint.
   - Every spoke runs from a flange hole to a nipple on every wheel/hub combination, with no gaps or overshoot.
   - Before/after screenshots go in `wk-shots/`.
2. **Product-render quality** (target: `docs/reference/quality-reference-emoto.png`).
   - Make the emoto option match the reference's chassis shape: a generic name and no logo. "Enduro E-Moto Frame" already exists, so refine that.
   - Then bring ALL parts up to that level so detail holds at full zoom: bolts, welds, cables, vent fins, tyre knobs, spoke nipples, rotor holes, calipers, bevels and seams. Start with frames, fenders, motors and wheels.
   - Technical requirements:
     - PBR materials, with RoomEnvironment through PMREM as the environment.
     - Contact shadows under the bike.
     - LOD, so it stays smooth on a mid-range Android and an iPad.
   - Every piece is a separate named sub-mesh with its own material.
   - The slot test still passes.
3. **Fenders and covers, per frame, in different styles.**
   - Fenders:
     - Front: high moto, low hugger, MTB clip-on, full fender.
     - Rear wing/tail as its own slot (exists).
     - Rear hugger and full-wrap.
   - Covers: side panels/battery covers, frame guards, swingarm guard, chain guard, bash plate, number plate.
   - Each style mounts at a frame-specific anchor and goes through `fitment.js` checks.
   - Colour swatches include chrome and carbon, and are saved per part (e.g. `build.paint[partId]`).
   - Parts can be damaged through `wk-condition` wear: they crack and break, with REPAIR.
   - One mesh group per slot.
4. **TRACE sticker mode** (in the custom sticker upload).
   - Freehand lasso trace on the photo, with pinch zoom and pan (Android and iPad).
   - Then: crop, feather, expand/shrink edge, die-cut border width, undo/redo, and "reset to auto background removal".
   - The output is a transparent die-cut sticker that goes into the normal drag/wrap flow, with a rating.
5. **Push v16, v17 and later to GitHub**, with CHANGELOG and HANDOFF. Keep doing this after every release from then on.

## 8. Design rules (non-negotiable)
- **Parts:**
  - A part REPLACES whatever is in its slot. Never stack meshes.
  - Each part mounts at a realistic named anchor for each frame.
  - Use real fitment standards (BB, dropout, steerer/head, brake mounts, shock, battery mount, wheel size), with conversion kits and adapters (ok / adapter / won't fit + reason).
  - Parts look like the real thing, with real weights (these feed CoG), stats, plain-language effects and a 3D shop preview.
- **Stickers:**
  - A BIG style mix. Chris's glossy drippy airbrushed style is only SOME of them; others are comic, retro badge, number plate, punk stamp, kawaii and so on.
  - Ratings are `all`, `teen` and `adult18`. 18+ stays behind the PIN lock.
  - No copied logos (a plain brand name in brand colours is fine).
  - Substance (beer, smokes, weed) and weapon jokes are for adult characters and 18+ only.
- **Removed on purpose:** the Chat log feature. Don't re-add `chat-history.html` or the button.
- **Dev money:** infinite money stays on (`window.DEV_INFINITE_MONEY=true` in `index.html`) until Chris says otherwise.

## 9. Future vision (not yet)
- **Detail workshop:** inspect, modify, upgrade and paint single parts or sub-meshes. Named sub-meshes and their own materials are already in place. Paint can be saved as `build.paint[partId][subMesh]` and re-applied after `realParts()`.
- **3D free-roam street** with side, first-person and chase cameras and a speed gauge. The current ride is a side-on placeholder, so keep `ride-physics.js` reusable.
- **Scooters** (kick and e-scooter) as rideables.
- **Part wear and repair:** partly done in v17 (dirt, crack and break, WASH/REPAIR). Still to do: scratches, per-build condition, and wear on more parts.

## 10. Known issues and limits
- Decals only wrap the camera-facing half of a tube (DecalGeometry projection depth).
- Placed stickers save per device (`wk-decals`), and condition saves globally in `wk-condition`. Neither is part of the build save, and neither syncs.
- The garage close-up framing is rough (camera target and zoom limits).
- **Nothing has been tested on real devices** (Android Chrome or iPad Safari): touch, performance and LOD.
- `app.js` has no source, and patches to it are fragile string replacements.
- These were open since v4 (old HANDOFF) and might be stale:
  - No rear-rack part (`HAS_RACK`).
  - Mount positions aren't saved.
  - The `window.__wkFit` test helper is left in.
- Build warnings: e.g. "Hub motor needs a controller" shows on the default emoto shot, which is expected until a controller is fitted.
- The adapter banner was moved in v16. Recheck that it doesn't overlap on small phones.

## 11. Chris's preferences
- He's in Korumburra VIC (AEDT). It's a private game for him and his son Jaxon, aimed at teens and adults. Crude Aussie humour is welcome, with Aussie themes first, then US, UK, NZ and Euro.
- The bike is the star, so **detail is key**. He judges from Android screenshots and close-ups.
- He wants it **live AND on GitHub after every update**, with exact change notes so any agent can take over.
- His favourite sticker is "Faster Than Ya Mum's Mobility Scooter" (the wombat). He thought the old text-sheet stickers were weak.
- Plain, short updates with screenshots.

## 12. Assets, screenshots, references
- **Reference images (in the repo):**
  - [`docs/reference/quality-reference-emoto.png`](docs/reference/quality-reference-emoto.png): quality target
  - [`docs/reference/frame-joints.png`](docs/reference/frame-joints.png): frame-flow complaint
  - [`docs/reference/hub-spokes.png`](docs/reference/hub-spokes.png): spoke complaint
  - Originals are in `/workspace/wk-shots/user/`.
- **Screenshots:**
  - `/workspace/wk-shots/`: `v8…v18-*` per version, `*live-*` taken against production, `v16-before/after-*`, and `00–06-*` from the UI-rebuild era.
- **Stickers:**
  - Shipped: `stickers/` in this folder.
  - Sources: `/workspace/stickers/pack1`, `/workspace/stickers/pack2` (jpg + contact sheets; in the repo under `assets/stickers/`).
  - Older weak sheets: `/workspace/stickers/sheet-*.png`, made by `/workspace/stickers/gen.py`.
- **Old bundles** for diffing: `/tmp/app.v*.js`, `/tmp/parts3d.ridewip.js`, `/tmp/sw.ridewip.js`. These are in /tmp, so they may disappear.
- **Removed chat page:** `/workspace/wheelie-king-removed/`.
- **Transcript builder:** `/workspace/build.py`. It redacts the PIN. Never print or commit the PIN.
