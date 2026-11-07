# Wheelie King - current instructions and resume

Updated 7 Nov 2026. Read this first. Archived checkpoints are historical, not current instructions.

## Resume

- Work here: `C:/Users/cbrow/.codex/worktrees/wheelie-basic-crazy`, branch `work/nov7-polish`. The original `C:/Users/cbrow/Documents/ChatGPT/Wheelie king` checkout is old and dirty; do not deploy/reset it or apply its old pending files wholesale. Its handoff points here.
- Production: https://wheelie-king.pages.dev . Main/wip/development branches receive verified batches. Shared-room batch `72e489f` and riding/transition follow-up `469e06d` are deployed; 82 production file hashes matched (`wk-v18-air-momentum-1`).
- Current owner batch is finished and published; conserve usage through focused tests and brief updates. Room, ride and transition checks passed for these batches. Next is owned Workshop inventory/progression, after owner riding feedback.
- Room: physical Garage/Workshop/Character geometry shares the vehicle camera; full-screen background under existing glass menus. Garage is light brick/neon; Workshop dark brick/tools/bench. Camera movement does not move objects. Free Edit dragging, floor rotation/lift arrows, independent furniture, placement autosave and persistent rename/confirmed deletion work. PBR floor is default; planar reflection is off. Resources dispose cleanly; instanced foliage reduces calls. Real-device FPS remains unverified.
- Riding: actual installed build/decals clone into Race. Rear-wheel recovery, balance, scrapes/loop-outs and bump release work. Current follow-up increases/tapers airborne rotation, retains momentum and replaces slope velocity assignment with a normal projection to stop energy injection. Existing landings, tricks, ragdoll and instant recovery remain.
- Parameters: `ride-parameters.js` transfers explicit human/electric/petrol type, effective power/torque/speed/mass, installed Wh storage and actual axle/wheel geometry. Zero output/fuel stays zero. Mid-drive/pedal gearing affects torque; hub drive ignores pedal sprocket ratios. Fuel/range are game estimates. Stock BMX nominal speed is 18 km/h plus existing pedal-tap headroom; gravity can exceed the drive cap.
- Builder: Simple default/Advanced share installed configuration. Compatible plans resolve adapters/supporting parts; kits are complete component bundles. Preview keeps its menu, with apply/cancel. Colours are under Styles. Crazy Builds is in More > Settings, usable only in Basic; relax frame power ratings, never hard mounts/electrical limits. Existing crazy builds survive mode changes. Original 18,000 W motor + 250 A controller test parts are Basic-only.
- Workshop drafts, custom sticker art/rating, wardrobe, wallet, saved rides and layouts persist locally. Deleted unchanged drafts do not immediately recreate a ride. Full-page sticker gallery/editor supports automatic cutout, tracing/adjustment and gates. Shop has category/detail/back, preview/purchase/equip; product geometry is shared with worn helmets/gloves/shoes. Further art/detail remains future work.
- Vehicles: confirmed 20-inch lime TRAX (other photo measurements estimated), bicycle/e-moto builds, one original Outback 125 petrol prototype and a Kaabo electric scooter prototype (exact model unconfirmed). Prototype mounts stay family-specific. Repairs/condition/washing remain disabled. Chase preview remains developer-only; no public steering/camera switch yet.

## Rules

- Preserve current Three.js, longitudinal physics, stunts, installed-part identity and cloneForRide. No unsolicited rewrite, free roam, multiplayer or detailed mechanic/disassembly work.
- Keep `window.DEV_INFINITE_MONEY=true`. Never print/commit PINs, credentials or private photos. Preserve all/teen/adult18 sticker ratings and PIN gates. Use original art; no copied logos.
- Extra-crazy builds only in Basic. Physical/electrical compatibility remains mandatory. One fitted part per slot; replace old geometry. Basic/Advanced must preserve installed builds.
- Batch related changes, run affected checks, commit/push and deploy verified playable milestones. Never force-push. A Git push or localhost is not delivery; verify production hashes. Owner can override deployment timing per batch.
- `app.js` is a minified React bundle without source: use side modules and assert exact match counts for essential string patches.
- Avoid repeated full-history reading and broad GPU reruns. Run software-rendered Chrome checks sequentially. Keep progress/final reports short and evidence-backed; distinguish automation from actual phone feel/performance.

## Checks and delivery

PowerShell in the active checkout. Dependencies already installed through a junction. Active preview: `http://127.0.0.1:8932/` (`python -m http.server 8932 --bind 127.0.0.1` if needed). Browser checks: `$env:WK_TEST_URL='http://127.0.0.1:8932/'`.

- `npm run check`: syntax + safe runtime packaging.
- `npm run check -- ride`: landings/balance/bump release/air control/touch/crashes/recovery.
- `npm run check -- transitions`: initial room gating and Garage/Shop/Race transitions.
- `npm run check -- rooms`: room camera/lifecycle, Workshop presentation, touch editing, saved rides, shop/wardrobe and mobile layouts.
- `npm run check -- powertrain vehicles`: parameter/energy/gearing/cadence audit and prototype integration.
- Other groups: menus, player, scene, polish, mechanics, modular. `release` combines groups; an old `workshop-batch` sticker-editor test has stale labels, so inspect it before using the entire legacy builder/release profile.
- Bump `sw.js` cache and precache new runtime imports. Update CHANGELOG/current resume. Commit, then `git push origin HEAD:work/nov7-polish HEAD:wip/v18-detail HEAD:main`; `npm run deploy` publishes and verifies hashes. Use only development branch for deliberately unfinished work.
- Cloudflare: Pages project `wheelie-king`, account `7f9b89a42182a51327a119efb6cf949e`; deploy script pins Wrangler 4.157.0. OAuth worked. Upload only staged `dist/`; packager excludes tests/history/private photos/dependencies. `npm run verify:live` compares without publishing.

## Map and backlog

- Current owner decisions/backlog: [docs/ROADMAP.md](docs/ROADMAP.md). Player room/inventory design: [docs/player-rooms.md](docs/player-rooms.md). Parameter audit: [docs/powertrain-audit.md](docs/powertrain-audit.md).
- Catalogue/config: modular-catalogue.js, build-policy.js, fitment.js, builder-mode.js, vehicle-platforms.js. Geometry/motion: parts3d.js, modular-render.js, frame-geometry.js, trax-bike.js, bike-motion.js, vehicle-models.js.
- Riding: ride.js, ride-physics.js, ride-parameters.js, ride-controls.js, ride-tricks.js, crash-physics.js/crash-rig.js. Terrain/environment: terrain-profile.js, ride-environment.js, ride-scenery.js.
- UI/rooms: workshop-presentation.js/navigation/mobile, race-launch.js, player-lounge.js/view3d.js, garage-room3d.js/gizmo/state/furniture, workshop-autosave.js, gear-catalogue/state/models, rider-spec/model, sticker-picker/editor/trace.
- Contributor template/prompt: contrib/parts/. Not packaged; review generated modules before integration. The proposed AI part-generator website is separate from the game and is being built elsewhere.
- Earlier inventory/store work remains stashed in the original checkout. Review rather than apply wholesale. Next functional targets: starter BMX+scooter, owned/cheap Workshop inventory, simulated vehicle/parts stores, level-5 moto unlock and one-time basic race prize with upgrade headroom. No real-money payments.
- Full feature history: CHANGELOG and docs/archive/. Latest longer historical checkpoint: docs/archive/CODEX-HANDOFF-through-2026-11-07.md. QA screenshots: wk-shots/; detailed test output: ignored test-results/.
