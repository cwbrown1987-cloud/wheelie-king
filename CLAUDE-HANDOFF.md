# Claude batch: handoff for Codex

Written 7 Nov 2026 by Claude, for Codex. Chris asked for: speed-ups, bug fixes, a better side-view camera, a workshop shadow-flicker fix, auto graphics quality, reusable level themes, better shop item renders, and a separate BETA build.

All work was done on a copy of the repo from Chris's zip (base = the `wheelie-king-main` zip of 7 Nov, cache `wk-v18-air-momentum-1`). Nothing was committed or deployed.

## How to apply

1. Branch off the current work branch, e.g. `work/claude-batch`.
2. Copy every file in this folder over the repo, keeping the same paths. `changes.diff` is the same change set as a unified diff for review. It covers text files only; the WebP images and the minified three are binary or large.
3. If the repo has moved on since the zip: `changes.diff` is the source of truth. Apply hunk by hunk; every edit was an exact-string patch with a count==1 assertion.
4. Keep the house rules: `window.DEV_INFINITE_MONEY=true` stays. Three.js, longitudinal physics, stunts and cloneForRide are preserved. The chase-view public switch stays disabled. No rewrite.
5. Run checks sequentially (see "Test status"), then commit in themed commits (suggested order matches the sections below).
6. `icons/*-background.png` are no longer referenced. Delete them only after checking the WebP versions in the garage, character, shop, showroom and ride backdrop.

## 1. Bug fixes

- **ENDLESS toggle broke phone graphics** (`ride.js`): `switchLevel` re-mounted the ride without `lowDetail`, so phones switched to antialias + higher pixel ratio after tapping ENDLESS. It now passes `lowDetail`, `quality` and `theme`. Verified: antialias stays false after the toggle.
- **Workshop shadow flicker** (`workshop-presentation.js`, workshop only):
  - Cause: the stage `ShadowMaterial` catcher (`v.stage.shadow`) sat at y=0, exactly on the room's `garage:floor` (also y=0). That z-fought, and the floor also received the same shadow.
  - Fix: catcher lifted to y=.003, `renderOrder=2`, `depthWrite=false`.
  - Key light `shadow.normalBias=.012`, `shadow.bias=-2e-4` (was bias -4e-4, no normalBias) to stop acne crawling on the bike while it rotates.
  - Software-GL before/after shows the doubled/blotchy patch gone. Needs a real-GPU look on Chris's devices.
- **Service worker offline fallback** (`sw.js`): any failed request (JS, images) used to get `index.html` back. It now falls back to `index.html` only for `request.mode === "navigate"`, otherwise `Response.error()`.

## 2. Ride performance

- **HUD writes deduped** (`ride.js`):
  - Helpers `put/putHtml/sty` cache the last value; score/best/speed/wheelie/batt/msg/view label/progress width/UI transform only touch the DOM when the value changes.
  - The view label element is cached instead of `querySelector` every frame.
  - In flat mode, `hud.best` is written once per frame (it used to be written twice with different strings).
  - Measured per frame (phone mode, software GL): layouts 2.03 → 1.09, style recalcs 2.47 → 1.52.
- **Per-frame allocations removed:**
  - `bike-motion.js`: shock-pose vectors, quaternions and matrices, fork shift, and attachment matrices are now reused scratch objects. The jockey-wheel lookup is cached; it used to `rear.traverse` every frame.
  - `rider-model.js` `pose()`: scratch vectors.
- **Legacy hills/bushes** (`ride.js`): only built if the backdrop texture fails to load (TextureLoader onError). They were built every ride and hidden on load.
- **Tiny meshes hidden in ride** (`ride.js` `trimTinyMeshes`): on low/medium quality, meshes under 3.5 cm across in the ride clone are hidden (under 3 px at ride distance). Skips instanced/skinned meshes.
- **Ride-only LOD** (`ride-lod.js`, new):
  - The ride scene's helmet shell/visor (65x65 vertex grid, 8192 tris each) is decimated to 2048 tris with the same vertices and winding.
  - Drilled brake rotors (4272 tris each) are replaced by a plain ring of the same size and thickness (~160 tris).
  - Only the ride copy's geometry is swapped; the garage keeps full detail. The new geometries are disposed in `stop()`.
- **Combined result** (phone mode): draw calls 276 → 260, triangles ~157k (original) → ~123k.
- I measured the physics substep cost: 0.00134 ms per step. It is negligible, so I did not change the physics.

## 3. Load size

- **Backgrounds:** PNG → WebP (q88), 10.2 MB → 1.3 MB. References were updated in:
  - `app.js`: one exact string, neon-garage.
  - `player-lounge.js`: 2.
  - `ride.js`.
  - `ride-environment.js`.
  - `sw.js` precache.
- **Three.js:** `vendor/three.module.js` is now the official minified r160 build. I verified that the old file was byte-identical to npm `three@0.160.0` `build/three.module.js`. 1.27 MB → 0.67 MB, same version, same API; `Reflector.js` etc. still import `./three.module.js`. To revert, copy `build/three.module.js` from `three@0.160.0`.
- **`sw.js`:** cache `wk-v19-perf-camera-1`. SHELL adds `ride-camera.js`, `ride-lod.js`, `ride-quality.js` and `ride-themes.js`.

## 4. Side-view camera (`ride-camera.js`, new)

Chris's brief: a slight follow, closer on flat and small jumps, zoomed out on bigger jumps, and a natural feel with some bobbing.

- Pure maths module (no THREE/DOM). All tunables are in `SIDE_CAMERA` at the top.
- Critically damped springs, sub-stepped at 1/120 s, so behaviour is frame-rate independent (the test checks 30/60/144 fps).
- **Zoom:** a base distance plus a small speed term. While airborne it predicts the apex from vy (`vy²/2g`) relative to the take-off height. Apex under 0.7 m keeps the close frame; higher apexes zoom out (out rate 2.4/s, in rate 0.85/s, so it pulls back fast and eases in slowly).
- **Following:** a vertical dead zone of 0.28 m, so small hops don't move the frame. Look-ahead is 0.15 s of vx.
- **Motion:** speed-scaled bob/sway/roll that fades out in the air. A hard landing gives a damped downward kick. `prefers-reduced-motion` turns the bob off.
- **Crash:** the crash-rig focus uses the old crash framing values, now smoothed.
- **Hooked into `ride.js`:**
  - Side view uses the module output.
  - The chase blend still uses the raw legacy targets (`cx`, `riderY`), mixed by `blend`, so chase behaviour is unchanged.
  - The old frame-rate-dependent `lerp(.12)` was removed.
- **Needs on-device tuning.** I have only checked it in tests and screenshots, not by feel.

## 5. Auto graphics quality (`ride-quality.js`, new)

- **Tiers:**
  - low: no AA, no shadows, PR 1, env low, trim tiny.
  - medium: no AA, no shadows, PR 1.25, env low, trim tiny.
  - high: AA, shadows, PR 1.5, full env.
- **Start tier:** `localStorage['wk-quality']`, else `pointer:coarse` → low, else high. `wk-race-low-detail='1'` still forces low (manual; the stored tier is never changed).
- **During a ride:** after a 1.5 s warm-up, a 3 s window is sampled. If the median frame time is worse than 40 fps, it drops pixel ratio ×0.8 (min .75) and turns shadows off live (materials `needsUpdate`), and stores one tier lower. This happens at most 3 times.
- Two smooth rides in a row (p90 ≥ 55 fps) store one tier higher for the next ride. Frames over 0.25 s (tab switches) are ignored.
- `race-launch.js` is untouched. `mountRide` now picks the tier itself (it accepts `quality` and `theme` options). `lowDetail` is derived from the tier.
- State is visible in `__WK_RIDE_STATE__().quality`.
- **Caveat:** software-GL test browsers will always downgrade. Tests don't assert AA/shadows, but keep that in mind.

## 6. Level themes (`ride-themes.js`, new)

Chris wants levels to reuse and slightly alter shared pieces.

- **What moved into data:** all ride look values in `ride.js` (background, fog, hemisphere/sun light, fallback sky gradient, sun disc, backdrop image and framing) and key `ride-environment.js` colours (paving, wall tint, concrete, barrels, neon) plus its art source.
- `THEMES.skatepark` reproduces the old values exactly; `tests/ride-themes.mjs` locks them.
- `deriveTheme(base, changes)` deep-merges for variants. An example `skatepark-night` is included but not wired to a level. Try it with `localStorage['wk-theme']='skatepark-night'`.
- `mountRide({theme})` accepts a name or an object.
- **Next step when levels exist:** a level config picks `theme` + terrain. Move more of `ride-environment.js`'s palette into the theme as needed.

## 7. Shop item renders (`thumbs.js`)

- **Studio lighting:** `RoomEnvironment` PMREM env map (intensity 0.9). Hemi light 3 → 1.6, exposure 1.6 → 1.2 (gear 1 → 0.9). Metal and paint now read properly.
- **Contact shadow:** a soft radial-gradient blob under each item (`placeContact`), also in the drag-to-rotate preview (it updates while rotating).
- **Retina:** thumbnails render at ×devicePixelRatio (max 2). The cache key includes the scale. Output is still a `data:image/png` (the trax-bike test checks this).
- **Framing:** the camera fits the actual posed geometry (sampled vertices, max 1500 per mesh, box corners for instanced/skinned) so nothing is cropped. Before, tyres, forks, brakes and controllers were cut off.
- All tunables are in `STUDIO` at the top of `thumbs.js`.
- **Model bugs I noticed (not fixed):**
  - The frame thumbnail has stray floating sticker dots, which also make it frame small.
  - The brakes model has a lever box floating above the rotor.

## 8. BETA build (`scripts/make-beta.mjs`, new)

- `node scripts/make-beta.mjs` stages `dist/` via `stageRuntime()` and copies it to `dist-beta/`. In that copy it:
  - prefixes the SW cache with `wk-beta-`;
  - sets the manifest name "Wheelie King BETA", short_name "WK Beta", `id`/`start_url` `./?beta=1`;
  - sets the `<title>` and adds a small yellow BETA badge.
- `--deploy` runs wrangler to the Pages project **`wheelie-king-beta`** (never the live `wheelie-king`).
- `dist-beta/` is added to `.gitignore`.
- Chris wants the beta online to test the camera on his phone.

## 9. Tests added

All are in the `ride` profile in `scripts/check.mjs` and are Node-only (fast, no browser):

- `tests/ride-camera.mjs`: finite output, close on flat, small hops ignored, big jumps zoom out (predictive), eases back, bob bounds, reduced motion, 30/60/144 fps agreement, rider stays framed, teleport snap, landing kick.
- `tests/ride-lod.mjs`: grid decimation (both windings, extents kept, non-grid untouched), rotor size kept and much lighter, garage geometry untouched.
- `tests/ride-quality.mjs`: tier pick, manual override, storage errors, downgrade and cap, two-smooth-rides upgrade, hitch filtering.
- `tests/ride-themes.mjs`: skatepark values locked, deep merge, no mutation, all themes complete.

## Test status (honest)

- **Passed on the patched copy:**
  - All Node tests above, plus `ride-landings`, `wheelie-balance`, `air-control`, `crash-physics`, `ride-parameters`, `physics-cadence` and `ride-parameter-integration`.
  - Static check (syntax + packaging, 92 files).
  - Browser tests: `screen-transitions`, `world-room`, `workshop-presentation` (before the thumbs change), `garage-drag`, `player-rooms`, `manage-rides`, `scene-depth`.
- **Not a reliable result yet:** the earlier "all pass" runs had browser tests hitting `127.0.0.1:8931`, which in my setup served the original copy. Only results with `WK_TEST_URL` pointed at the patched copy count. Those are the ones listed above.
- `workshop-mobile` times out in my container on the original game too (waitForFunction on sticker-dock images at DPR 2). Treat it as environment, but run it on Chris's PC.
- A full sequential re-run was still in progress when this was written. **Please run the full suite yourself:** `npm run check -- release`, with the preview of this branch at the URL the tests use. Pay special attention to `workshop-presentation`, `workshop-batch`, `simple-builder`, `basic-crazy` and `shop-space` after the `thumbs.js` change: 2× thumbnails cost more in software GL, so watch for timeouts.

## Ideas not done (suggested next)

- On-device camera tuning with Chris; values are in `SIDE_CAMERA`.
- More ride LOD: chain rollers (3.7k tris), hub flanges (~5.5k) and tyres. Or merge static bike meshes per material to cut draw calls (the bike is about 200 static meshes).
- Lazy-load startup modules. Not done: the risk wasn't worth it without real-device timing.
- Clean up the `wk-shots/` test screenshots from the repo (the tests regenerate them).
- Workshop/garage "much more realistic detail" (Chris's vision images) via the existing detail-LOD system: high detail near the camera only.
