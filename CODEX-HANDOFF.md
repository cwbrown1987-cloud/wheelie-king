# Wheelie King — current instructions and resume

Updated 6 Nov 2026. This is the single current instruction page. Replace the resume when work changes; do not append checkpoints. Consult history only for a specific question.

## Resume

- Branch: `wip/v18-detail`; completed batches also go to `main` and https://wheelie-king.pages.dev. Runtime: `wk-v18-polish-1`.
- Workshop: renamed builder, same layout. Full-screen neon static garage image behind editable 3D bike and frosted panels; old green turntable hidden. Compact top-right bike/stats card expands the existing glass panel. Sticker drawer does not resize the bike viewport. Parts replace the category rail; ✓/✕ preview keeps that rail visible. Bikes cards show complete assemblies, not just frames. More accessory categories now have rendered 3D pictures.
- Navigation: primary menus are at the top; left parts layout retained. Garage/Browser are explicitly Coming Soon, Workshop and Race work; My Builds/Parts Shop/Challenges/Settings are under More. Future Garage ownership/trophies and simulated marketplace Browser remain deferred; see `docs/future-garage-browser.md`.
- Builder: Simple default/Advanced, compatible plans, separate complete Bikes/conversion Kits, nested colours, preview recovery, rotation pause, quiet automatic removals. Infinite money on; repairs paused. TRAX wheel size is confirmed 20 inch; other photo dimensions remain estimates.
- Sticker picker: two larger art cards per row, searchable names, restrained glass cards and compact controls; existing info, upload/cutout and rating gates retained.
- Stickers: upload → Draw Cutout → trace/tap → Use cutout → existing die-cut/rating/apply flow. Adult PIN/rating rules remain.
- Ride: reference-style controls, tricks, flat endless/trials, forgiving contacts/monos, reverse/electric burnouts. Streamed 3D near/middle/far surroundings and QA `__WK_SCENE_VIEW__('side'|'chase')` pan; no public camera toggle/curving track yet. Depth checks passed beyond 10 km with bounded resource use. Screenshots: `wk-shots/scene-depth/`.
- Race follow-up: rounded monotone terrain supplies the same surface to visuals/contacts. Track, walls, caps/fences and nearby ground follow it; flowers have grounded stems, props use their actual placement height, and palms/grass/rocks have smoother geometry. Floor coverage and tile UV continuity improved. Suspension contact travel follows real fork/swingarm motion relative to road angle; rendered-wheel test on rounded Trials terrain found only 0.000044 m penetration.
- Crashes: `crash-physics.js`/`crash-rig.js` give rider and bike separate constrained physical bodies, inherited momentum, gravity, ground/limb contacts and inter-body contact. Full-face lime helmet, red gloves and separate clothing material slots prepare for later styles. Instant Recover button/R reattaches cleanly; score/battery/odo persist, controls clear. No automatic 1.2-second attached-rider spin/reset.
- Validation: release checks passed individually (one fixed-delay drivetrain check was made state-based and rerun successfully). New checks cover four ragdoll poses/settling, five physical crash/recovery cycles, keyboard recovery/no geometry growth, 1,104 ground/stem anchors, seamless wall joins, rendered tyre contact and bounded scenery beyond 10 km. Real phone/iPad performance and complete reference-art fidelity remain unverified.
- Camera/launch follow-up: reset/orbit centred on the stand, pan/zoom unchanged, explicit rotation pause survives idle timers. Workshop rendering pauses beneath Race. Race launches in its own viewport portal outside transformed/glassy Workshop DOM, with visible loading/startup errors and a compatibility-graphics retry (reduced resolution/shadows/streaming). Desktop/touch ride checks and a simulated graphics-loss/retry check passed; Chris's specific black-screen device still needs confirmation.
- Wall: higher, level cap/fence; wall top no longer follows/bends with track. Far building foundations extended below the wall.
- Accessories: Simple-mode WIP category with six placeholder gear/bundle cards. Shared Common/Rare/Epic/Legendary and premium/themed bundles are design backlog only; no real payments or item locks added.
- Mobile/decals: Race clones omit circular editor links while preserving rendered stickers and original Workshop metadata. Clone preflight runs before graphics allocation. Larger touch layout, actual 3D category pictures, banner and bottom-right Ride removed; compact Stickers and Simple/Advanced are docked at sidebar bottom and stay accessible beside drawers. Top Race is the ride entry. Automated desktop/touch checks cover layouts, source preservation and repeated sticker-equipped Race launches; physical iOS/Android confirmation remains outstanding.
- Vehicles: Motorbikes and E-scooters sections now contain one playable prototype each: original Outback 125 petrol pit bike and provisional Kaiji rear-hub e-scooter (make/model unconfirmed). Matching vehicle parts list, family-only fitment, separate components/colour variants, seated/standing rider anchors, motion and existing crash/recovery. Specs/proportions are game estimates; no gearbox or detailed engine simulation. Architecture: `docs/vehicle-platforms.md`.
- Polish: spawn/recover aligns to the terrain and clears both tyre footprints (including scooter wheels); staggered scooter feet sit inside the deck and pit-bike feet on the pegs. Prototype headset bearings follow the head axis, front axle nuts travel with the fork, and chain thumbnails use the proper sprocket loop. Ten Simple categories fit the landscape touch sidebar, including narrow phones; sticker search has useful empty results and a 16px touch field to avoid iOS focus zoom.
- Next: Chris tests both prototype vehicles and confirms which scooter Kaiji means. Improve silhouettes/handling from that feedback; public chase switching, Garage and Browser remain deferred. Keep repairs paused and rating/PIN gate intact.

## Working rules

- Batch related fixes, run relevant checks, commit/push both branches, then publish to the existing Cloudflare app. GitHub or localhost alone is not delivery. Fix a failing check before broadening work.
- Keep progress brief. Final: changed / tested / pushed / remaining. Explain more when asked.
- Search specific files and changed sections. Reuse verified findings; repeat checks only for new changes, failures or unresolved concerns.
- Overwrite stale resume notes here. Version detail belongs in CHANGELOG, test logs in ignored `test-results/`, selected visual evidence in `wk-shots/`.
- Prefer side modules: `app.js` is a minified React bundle without source. Required string patches must assert their expected match count.
- One fitted part per slot: replace/remove old geometry. Structural main frames are separate from the BIKES presets and conversion KITS. Preserve fitment/adapters and colour interfaces; use realistic named mounts and connected moving components.
- Keep `window.DEV_INFINITE_MONEY=true` and the removed chat-log feature removed. Never print/commit the PIN, credentials or private photos.
- Preserve sticker ratings (`all`, `teen`, `adult18`) and the PIN gate. Substance/weapon jokes belong to adult characters and 18+ content. Use original art; no copied logos.
- Target Android Chrome/iPad Safari, named sub-meshes/materials and sensible LOD. Keep ride physics reusable. Only the TRAX wheel size (20-inch) is confirmed; other photo-derived measurements/standards are game estimates.

## Checks and delivery

PowerShell in this checkout. Install dependencies: `npm ci`. Preview: `python -m http.server 8931 --bind 127.0.0.1`. Browser checks need that server and installed Chrome; run them sequentially on this PC.

| Command | Purpose |
| --- | --- |
| `npm run check` | Syntax and safe runtime packaging; no browser |
| `npm run check -- builder` | Presets, compatible plans, colours/wheels, preview/apply/cancel, endless ride |
| `npm run check -- ride` | Static checks, landings and multi-touch |
| `npm run check -- mechanics` | Static checks, nine-bike motion and TRAX mechanics |
| `npm run check -- polish` | Spawn/settling and sticker search regressions |
| `npm run check -- vehicles` | Two prototype vehicle builds, fitment, colours, suspension and riding |
| `npm run check -- modular` | Static checks, catalogue/fitment/colour/removal and ride smoke |
| `npm run check -- release` | All current integration checks, sequentially |
| `npm run deploy` | Package, publish to production, verify served file hashes |
| `npm run verify:live` | Compare current runtime files with production without publishing |

Combine groups, e.g. `npm run check -- ride mechanics`; each check runs once. Failures stop immediately. Short terminal summaries; detailed logs/JSON in `test-results/checks/`.

For game changes: bump SW cache, precache new runtime modules, update CHANGELOG/resume, run the relevant group, commit, then `git push origin HEAD:wip/v18-detail HEAD:main` and `npm run deploy`. Never force-push. Docs/tooling changes need static/affected checks, not every gameplay check or a new SW cache.

Cloudflare project: `wheelie-king`, account `7f9b89a42182a51327a119efb6cf949e`. OAuth worked on this PC; if expired: `npx --yes wrangler@4.157.0 login`. Do not log credentials or change hosting. Upload only `dist/`; staging whitelists runtime assets and excludes history, photos, tests and dependencies.

## Code and backlog

- Catalogue/variants/stock: `modular-catalogue.js`; fitment: `fitment.js`; assembly: `parts3d.js`, `modular-render.js`; previews: `thumbs.js`.
- Geometry/detail: `frame-geometry.js`, `partmodels.js`, `detail.js`; TRAX: `trax-bike.js`, `trax-suspension.js`; motion: `bike-motion.js`.
- Riding/rendering: `ride.js`; reference control skin: `ride-controls.js`; stunt transforms: `ride-tricks.js`; contacts/landings/trick awards: `ride-physics.js`; category icons: `category-icons.js`; backdrop: `icons/neon-skatepark-background.png` ([prompt/provenance](docs/assets/neon-backdrop.md)); decals: `stickers-dd.js`; cutouts: `sticker-trace.js`; road/foreground: `ride-scenery.js`; workshop presentation/nav: `workshop-presentation.js`, `workshop-navigation.js`, `workshop-mobile.js`; PWA: `index.html`, `sw.js`, manifest/headers/icons.
- Deferred priorities: component detail, frame-specific fender/cover styles and finishes, richer sticker editing. Future: sub-mesh workshop, 3D free roam, scooters, richer per-build wear.
- Targets: `docs/reference/quality-reference-emoto.png`, `docs/reference/frame-joints.png`, `docs/reference/hub-spokes.png`. Evidence: `wk-shots/`.
- History: [CHANGELOG](CHANGELOG.md), [old checkpoints](docs/archive/CODEX-HANDOFF-through-2026-11-05.md), [original brief](docs/archive/HANDOFF-original.md), [TRAX notes](docs/archive/TRAX-BIKE-through-2026-11-05.md), [transcript](docs/archive/CHAT-HISTORY.md). Historical instructions do not override this page or Chris's latest request.
