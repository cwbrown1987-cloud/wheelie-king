# Wheelie King — detailed change history

Written 12 November 2026, Australia/Sydney, as a companion to [HANDOFF-NOTES.md](HANDOFF-NOTES.md).
Every commit on `feature/3d-sample-track` is listed below, newest first within each era, with the reason for the era and (where memory or the commit message makes it clear) why the change was made.
HEAD at the time of writing: `01a004c`.

## v2.0.3 WIP — 12 Nov 2026 (not deployed)

Bump-turn flip fix and a chase-view-only QA harness. Live beta is still v2.0.2. Why: Chris reported that turning over bumps flipped the bike, and that ride tests had been run in the wrong camera. This commit is in git but has not been deployed or fully GPU-verified.

- `01a004c` (2026-11-12) — WIP v2.0.3: bump-turn flip fix (lean controller off when a wheel unloads, rider air roll hold, softer lean spring) + chase-view-only QA harness (not deployed)

## v2.0.2 — 12 Nov 2026

Why: v2.0.1 still tipped over in burnouts, drifts and donuts; the BMX could not stoppie; a heavier frame did not change the ride. Then a wheelie skipping a bump looped, so the air yank was gated on real flight time.

- `9062b1d` (2026-11-12) — v2.0.2 fix: air over-rotation yank only after 0.15 s of real flight (a wheelie skipping off a bump no longer loops)
- `bbb6ebf` (2026-11-12) — v2.0.2: burnout/donut/drift via tyre friction + rider foot-down balance, set-pressure stoppie control (BMX lifts), mass from fitted parts, full-yank air over-rotation (loop-out), rewind restores brake/lean/grip state

## v2.0.1 — 12 Nov 2026

Why: Chris wanted jumps and terrain done that morning ("I want at least a working ride simulator"), and wheelies from throttle plus pulling back rather than a button. MONO/STOPPIE buttons were removed. Brake at a stop now holds the bike, including on hills, so reverse became a double-tap of brake.

- `cea5685` (2026-11-12) — v2.0.1: brake holds the bike at a stop (slopes too), double-tap brake to reverse; side-view A/D lean restored; larger TRICKS buttons
- `68dccfc` (2026-11-12) — v2.0.1: uneven terrain lane (Jolt HeightFieldShape, CC0 Ground054), curved-kicker jumps as MeshShapes + in-air rider attitude, wheelie/stoppie by body weight shift (drag thumb / Shift-Space), MONO/STOPPIE buttons removed, instant single-speed drive, no rest creep, pedal sprint power from rider data, burnout torque from rear grip + foot-down

## v2.0 — 11–12 Nov 2026

Why: the release formerly called v35 was renamed v2.0. Playground rides now come from part data on Jolt, with rewind/drop-in, a tricks panel and a telemetry hook. sample3d and other modes were removed from the beta; the app autostarts into Playground; Legacy stays behind ?legacy. Tilt was removed. A late commit restored rewind steer/stoppie state and stopped hard-coding frame ids.

- `38debee` (2026-11-12) — v2.0: rewind restores steer input, front steer angle, stoppie and lever state; fitment frame class from FRAME_STD data (no hard-coded frame ids)
- `9b7b2e9` (2026-11-12) — v2.0: touch MONO/STOPPIE with weight shift + wheelie control, brake-lock slide, tilt removed, simple TRICKS list, Jolt-driven wheels, real grip/brakes/launch map, 3 table-top jumps with Jolt colliders, HUD distance, autostart into Playground, sample3d removed (Legacy via ?legacy)
- `f7d6de2` (2026-11-11) — v2.0: actually hide HOP in Playground (CSS display beat [hidden]); test checks computed visibility
- `1a88c15` (2026-11-11) — v2.0: rigid forks/no-shock use tyre compliance; wheelie weight shift eases at the balance point; weak bikes lean further back
- `13e2516` (2026-11-11) — v2.0: ride feel fixes from PC QA - sag/level calibration, light wheels and rotor, governor, wheelie pop scaled by drive
- `f269617` (2026-11-11) — v2.0: Playground rides from part data (Jolt) - wheelie/stand/burnout/drift, tricks panel, Jolt rewind/drop-in, QA telemetry

## v34 flat rebuild — 11 Nov 2026

Why: stacked Jolt hacks and undeployed assets (the packager had not been shipping playground HDRI/ground textures; only assets/workshop at one point) had wasted rounds and hurt the feel. v34 rebuilt Playground as a flat-ground movement test bed on a clean port of Jolt's MotorcycleTest, and fixed cache naming plus literal texture paths so the beta packager actually ships them.

- `b7c2632` (2026-11-11) — v34: sw cache name (beta prefix is added by make-beta).
- `8a0fce7` (2026-11-11) — v34: literal Ground086 paths so the beta packager ships them.
- `0fea5ca` (2026-11-11) — v34: rebuild Playground as a flat-ground movement test bed on a port of Jolt's MotorcycleTest; remove ramps, track, cones, grass, classic toggle, air handover and Playground-only assets.

## v3x: sample 3D, Arena, Jolt, Playground — 11 Nov 2026

Why: Chris wanted a real 3D world with a side view and a chase cam over the same map, free roam (lane-only steering was rejected), and proven engine handling. Work went from a 20-second SAMPLE 3D city track, through chase-cam controls and an Arena test world, to hooking Jolt's MotorcycleController into the live game. The Arena was renamed Playground. v33f made side view camera-only, snappier launch, brake-to-reverse, removed the box skyline, and shipped HDRI/ground assets with an LDR fallback so the scene never goes dark. Many of the arena decorations and the classic/Jolt toggle were later stripped in v34.

- `e474c30` (2026-11-11) — v33f: camera-only side view in Playground, snappier Jolt launch, brake-to-reverse and standstill hold, remove box skyline, ship HDRI/ground assets with an LDR fallback so the scene never goes dark.
- `39a5ece` (2026-11-11) — Clean Playground surfaces down to one layer each and light the course from the HDRI.
- `f4f940f` (2026-11-11) — Spin visual wheels from live axle speed, add an HDRI playground sky and ambientCG track textures, and rename Arena to Playground.
- `eadad60` (2026-11-11) — Fix arena Jolt cones, dirt drag and chase cam, and add surface-aware wheel FX plus grass tufts.
- `89b53e9` (2026-11-11) — Hook Jolt into the live arena behind a pause toggle, leaving classic as the default.
- `2f45a2a` (2026-11-11) — Add a standalone Jolt MotorcycleController sandbox beside the live game.
- `01187e5` (2026-11-11) — Lock the arena ground in world space, turn burnouts into creeping donuts, and add a tight follow-cam shadow map.
- `ae9c865` (2026-11-11) — Give the arena a grass-and-dirt floor, tyre smoke from slipping wheels, and a crash cam that stays on the rider.
- `488ef60` (2026-11-11) — Keep the chase camera close behind the bike in the air so tricks stay large on screen.
- `9a862c8` (2026-11-11) — Give arena kickers real air, frame jumps by pulling the camera back, and correct world scale.
- `891e1cd` (2026-11-11) — Add smoother, more visible arena jumps and tighten the slidy feel.
- `6b18928` (2026-11-11) — In free-roam side view, A and D tilt like UP and DOWN.
- `04fd50a` (2026-11-11) — Steer with the handlebars, not by spinning the bike in place.
- `369f520` (2026-11-11) — Snap the bike back onto the rail mid-swing and tighten the chase camera.
- `4308375` (2026-11-11) — Add arena landmarks, a mid-map side-view track, and a smooth glide back onto the rail.
- `52b25e3` (2026-11-11) — Stop the garage, workshop and ride screens from scrolling the page.
- `39c8936` (2026-11-11) — Fix free-roam steer so the bike turns, not the camera.
- `c6a8665` (2026-11-11) — Add the ARENA test world, a hold d-pad, and free-roam WASD keys.
- `1986370` (2026-11-11) — Add SAMPLE 3D free-roam steering with heading and soft collision.
- `84bee6b` (2026-11-11) — Pull the chase camera back and use the slider as tilt for now.
- `aa13ff6` (2026-11-11) — Use the unprefixed cache name so beta deploy becomes wk-beta-wk-v27-chase-controls.
- `2e5782a` (2026-11-11) — Add chase-cam controls with a spring-back steering slider.
- `5c84a4b` (2026-11-11) — Drop the flaky kicker height compare; the profile itself is the evidence.
- `21efc55` (2026-11-11) — Fix the sample3d physics check so it measures peak height on the kicker.
- `4dfd644` (2026-11-11) — Give the rider a head-sized full-face helmet, fill the sample street gap, and let the view pill toggle on a phone tap.
- `f3d4b92` (2026-11-11) — Fix the lime helmet size and shape, and drop the giant green ball.
- `2d510a0` (2026-11-11) — Add a rough 20s SAMPLE 3D city track as a real 3D world.

## v2x workshop era (v22–v25f2) — 10–11 Nov 2026

Why: Chris approved a 360° workshop built from his neon-garage art, with real 3D props, place/edit, a workstand, storage, style-B neon dock buttons, rewind, a YouTube-like replay overlay, a landscape lock, and a first pass at the race skyline and mid-ground. The original workshop zoom was restored and the turntable/circle was removed after he objected to unasked redesigns. Phone wall-art z-fighting was fixed. This block also folds the 11 Nov morning release that bundled wall-spin, inspect camera, painted mid-ground, the lime helmet, storage, rewind and landscape lock (wk-v25f2).

- `3c1152a` (2026-11-11) — Release wk-v25f2-wall-spin: wall drag and 90° neon spin, inspect camera, painted mid-ground, lime helmet, storage, rewind, landscape lock, and the rest of today's beta.
- `f19da38` (2026-11-10) — Test: wait for the wall pan to finish before dragging the neon.
- `96d4357` (2026-11-10) — Workshop: drag wall items on the wall, and spin neon 90° with animated arrows.
- `81fd922` (2026-11-10) — Test: wait for the workshop frame to settle before checking the home camera.
- `57c6581` (2026-11-10) — Workshop: tap the bike to ease home or inspect, and drop RESET VIEW.
- `10b7db5` (2026-11-10) — Ride: replace the blocky mid-ground kit with a painted parallax strip.
- `50f7de6` (2026-11-10) — Ride: pack a deeper mid-ground park into the side-view window.
- `a5efe4b` (2026-11-10) — Rider: put a lime full-face on the torso, the same path as the collar that draws.
- `e1f5eef` (2026-11-10) — Rider: give the ride helmet its own meshes so the lime shell actually draws.
- `0bada09` (2026-11-10) — Rider: draw the lime full-face helmet, not the jersey hood.
- `c173a05` (2026-11-10) — Test: pass the reloaded shelf and chest ids as one object.
- `95fcc91` (2026-11-10) — Test: allow a short floor-slot snap when a stored shelf is placed again.
- `b682f76` (2026-11-10) — Test: pass the storage re-place spot as a single evaluate argument.
- `22678fb` (2026-11-10) — Workshop: collide movable chests and shelves on their body, not their handles.
- `f29f18f` (2026-11-10) — Test: nudge a stored chest in the free direction, and keep the phone shot landscape.
- `8b2a927` (2026-11-10) — Workshop storage: built-in shelves and chests are movable items.
- `02c0afc` (2026-11-10) — Test: shoot the mid-ground without the pause card in the way.
- `dc4a480` (2026-11-10) — Ride: rotate mid-ground lots, bowls and jumps across world chunks.
- `92fdfca` (2026-11-10) — Test: measure the mid-ground deck against the wall cap and keep the shots.
- `0ce5635` (2026-11-10) — Test: read instanced mid-ground positions from the instance buffer.
- `e648e0b` (2026-11-10) — Test: read mid-ground positions without a Three Vector3.
- `3c17be5` (2026-11-10) — Ride: put a park mid-ground on the wall, in front of the city.
- `b3c2a3f` (2026-11-10) — Rider: paint the lime helmet unlit so it still reads at dusk.
- `cac1371` (2026-11-10) — Rider: draw the lime helmet as a solid shell so it reads in game.
- `b3b1085` (2026-11-10) — Rider: fix the helmet shell winding so the lime volume shows.
- `12baf14` (2026-11-10) — Rider: size the lime helmet so it reads at game scale.
- `f57059c` (2026-11-10) — Rider: nod the helmet about the head so the lime shell stays in view.
- `3a673ca` (2026-11-10) — Rider: raise the attack pose and make the lime helmet read clearly.
- `4342fdf` (2026-11-10) — Ride HUD: fold the tricks into one TRICKS button and move REWIND up right.
- `97b0e33` (2026-11-10) — Rider: apply the crouched ride pose on workshop bikes too.
- `40598d0` (2026-11-10) — Rider: wear the approved test outfit with better proportions.
- `b96ede3` (2026-11-10) — Crash bar: style-B neon dock buttons in one low row.
- `d7c57a5` (2026-11-10) — Lock Wheelie King to landscape and show a rotate-phone overlay.
- `3dc762f` (2026-11-10) — Test: assert Rewind release against the restored frame, not a mid-hold sample.
- `04b9130` (2026-11-10) — Ride: hold REWIND after a crash to scrub back at 2x.
- `73e6a7d` (2026-11-10) — Replay: actually hide the centre play button while the video is playing.
- `337fc56` (2026-11-10) — Thin the 3D race towers so the painted skyline and sunset show through.
- `1079f43` (2026-11-10) — Replay: centre play starts the video, and the panel is a bit smaller.
- `dc885e5` (2026-11-10) — Replay: keep the review scrim behind the overlay so the video is not dimmed.
- `d17a2b1` (2026-11-10) — Race skyline, ground slow-mo, and phone replay overlay; cache wk-v25e6-ride-bg.
- `17d9ea1` (2026-11-10) — Release wk-v25e4-handles: spaced object handles, 3D lift arrows, in-place spin around the bbox centre, auto-rotation off by default in place/edit.
- `8451348` (2026-11-10) — Lift arrows: add a pickable shaft and project drags onto the up arrow so garage lift-drags connect.
- `0340462` (2026-11-10) — Tests: wait for the 3D lift arrows before dragging them in the garage.
- `683509b` (2026-11-10) — Tests: close the place catalogue before clicking the ROTATION toggle in place mode.
- `24c9e64` (2026-11-10) — Handles: size the 3D lift arrows like the floor move arrows and sit them fully above the item, with the edit/remove row above that.
- `af948ff` (2026-11-10) — Handles: keep remove/done as a rigid generous gap on phone as well as desktop (never shrink the pair to fit).
- `8f0c8a6` (2026-11-10) — Object handles + in-place spin (wk-v25e4-handles): space edit/remove as a generous on-screen row above any item; drop the tall lift pill for 3D green up/down arrows (drag to lift); kit items rotate about their bounding-box centre so the ring stays on the item; curved rotate arrows animate around the ring; auto-rotation starts off in place/edit (ROTATION toggle still works).
- `61bc225` (2026-11-10) — Workshop HUD (Chris-approved layout, step 1): EDIT ROOM (was + PLACE) + TEST RIDE dock bottom-right in style B, + button green, SIMPLE/ADVANCED icon; bike controls sit left of the dock until they move into bike inspect (Job B); cache wk-v25e3-workshop-hud
- `343dc83` (2026-11-10) — Buttons: style B neon dock look for every in-game menu/HUD/dialog button (visual only: colour, border, glow; sizes and layouts unchanged; selected = green tint, primary = green, danger = red); fix garage floating handles overlapping the top toolbar (clamped below it); cache wk-v25e2-buttons
- `6c47170` (2026-11-10) — Object controls: neon dock style (Chris's pick B) for the selected-object bar and edit/remove/lift handles, workshop + garage, SVG icons + labels, compact on phones; cache wk-v25e-object-dock
- `c4783f6` (2026-11-10) — Place mode (workshop + garage): camera eases to a wide room overview, bike/stand and displayed rides hidden, new items drop into the centre (nearest free spot), selected with the 3D ring+arrows; PLACE MODE pill with Done restores camera and bike; place-mode test; cache wk-v25d-place-mode
- `2cfb4c3` (2026-11-10) — Replay overlay: all controls on the video (play, seek+time, Drop In, Screenshot, Save to Gallery/Device, Save clip, compact library strip), video fills the panel at its own aspect, no scrolling; even button flow at 1024x460/844x390/390x844; finger seek (tall touch zone, big thumb, drag anywhere); long-press delete; replay-overlay test; cache wk-v25c-replay-overlay
- `09506c3` (2026-11-10) — Replay: no capture while app menus/overlays cover the ride (More, Settings, Shop, Garage) or the tab is hidden; slow-mo clip recorder pauses too and its duration excludes paused time; stopClip stops paused recorders; replay-menu-gap regression test; cache wk-v25b-replay-menus
- `23c80f7` (2026-11-10) — Race: background towers stand on the ground line, uniformly scaled down (no texture stretch) so the skyline art shows; cache wk-v25a-race-buildings
- `5f1be75` (2026-11-10) — tests: replay-dropin-stress, 20 chained Drop Ins (no hang, frame loop, 20 s buffer cap, ring <= 2, bounded heap); in ride/replay changed rule
- `9f7bdd3` (2026-11-10) — Replay/Drop In fixes: scrub stays in replay, Drop In maps scrub by capture clock (exact frame), clear .is-dropping so repeated Drop Ins work; Settings/menu panels scroll on phones; compact replay panel in short landscape; regression tests
- `11aabb1` (2026-11-10) — garage-drag test: rotate via the 3D gizmo arc
- `edce211` (2026-11-10) — Workshop + garage: 3D floor gizmo (rotate arcs, move arrows) and kit workstand raising the bike 18 cm; PLACE button moved off the wheel; gizmo-stand test
- `2c4237c` (2026-11-10) — Concept tools: 3D floor gizmo + raised workstand (injected prototype, sheet script)
- `d003181` (2026-11-10) — Workshop: fix phone wall-art glitch (depth precision z-fighting): polygonOffset on the shell, near plane scaled with orbit distance, screen glass 6mm proud; SW cache wk-v23-workshop-art-room-2; orbit-check tool
- `ea2a49a` (2026-11-10) — tools/art-room: drop pycache
- `ad5c57f` (2026-11-10) — Workshop art-room: Chris's picture projected on walls/ceiling/floor with only prop-hidden pixels in-painted, his neon palette round the room, floor fade when orbiting; SW wk-v23-workshop-art-room-1
- `203e869` (2026-11-10) — Workshop: touch devices skip live floor reflection (cheap sheen), keeps mobile floor contract
- `bfa3734` (2026-11-10) — Workshop placement: preview edges draw through props, readable blocked reasons
- `9eeb6d5` (2026-11-10) — Workshop: 360° kit room in shared world, player prop placement with collision + persistence, vertex-PBR bake (14 prop draw calls), SW wk-v22-workshop-kit-1
- `0203d6a` (2026-11-10) — feat(kit): modular reskinnable 3D prop kit + workshop art-wall shell (concept, not wired in)
- `ac5237b` (2026-11-10) — fix(tests): serve game from a child process during checks
- `9d6231d` (2026-11-10) — fix(tests): Playwright headless must be boolean (WK_GPU)
- `45bc822` (2026-11-10) — chore(tests): shared browser helper, WK_GPU/WK_FAST, changed profile, built-in static server
- `6c5efc4` (2026-11-10) — fix(workshop): restore original workshop room and zoom, remove turntable; fix replay black screen + stutter; phone-scrollable menus

## Shared 3D rooms and late classic ride — 7 Nov 2026

Why: before the 3D Playground work, the workshop and garage were rebuilt as physical themed rooms sharing the vehicle camera, with the neon workshop art in the 3D room. Classic side-scroller ride work in this window covered air rotation, downhill energy, wheelie balance (rear-wheel pivot, real loop-outs), landings, auto graphics quality, and a powertrain/units audit. A concise Codex handoff replaced the long resume. Much of this classic ride path still lives behind Legacy and must not be casually rewritten.

- `b612761` (2026-11-10) — fix(world): render workshop summary immediately; longer room-ready wait in ride-finish test
- `87b6eac` (2026-11-10) — test(simple-builder): match Trials default race level before flat toggle
- `62bbd84` (2026-11-10) — test: accept wk-v20 SW cache in pause/replay and check-update asserts
- `b5a6a09` (2026-11-10) — test(race): accept current SW cache name after shared-world bump
- `4b036d1` (2026-11-10) — test(world): registry, doors, transitions, camera lock; allow Reflector
- `dfbb40a` (2026-11-10) — feat(world): wire shared world into presentation, nav, boot, and SW
- `d45d1e1` (2026-11-10) — feat(world): neon workshop room, registry, and shared-world controller
- `81b7512` (2026-11-10) — chore: drop leftover gallery debug harness
- `bb476fa` (2026-11-10) — feat(race): update check, boot loader, gallery, replay polish (racefix4)
- `354453a` (2026-11-10) — fix(race): uncapped speed, wall, slow-mo toggle, pause/replay, unlimited zoom
- `82788e9` (2026-11-10) — fix(race): distance score, Trials default, post-gear 110 cap, rear travel
- `116e58d` (2026-11-07) — Update workshop release check for current sticker controls
- `a3f8d96` (2026-11-07) — Publish verified beta builds through GitHub Actions
- `3c6ec6a` (2026-11-07) — Celebrate Trials finishes and add jump replay
- `8dbf518` (2026-11-07) — Keep landing road in view and add a downhill Trials loop
- `83f5d35` (2026-11-07) — Record verified beta deployment
- `6c82603` (2026-11-07) — Build and verify a separate Cloudflare Pages beta
- `cf8b7b2` (2026-11-07) — Improve shop previews and stabilize workshop shadows
- `78ebb6e` (2026-11-07) — Improve ride camera, graphics quality and render performance
- `1ca2605` (2026-11-07) — Record verified room and riding delivery in concise resume
- `469e06d` (2026-11-07) — Improve air rotation, conserve downhill contact energy and hide transition flashes
- `72e489f` (2026-11-07) — Render shared 3D workshop and garage rooms behind glass menus
- `0f9a24f` (2026-11-07) — Record verified powertrain deployment and next milestone
- `51476bb` (2026-11-07) — Align installed powertrain stats and energy with riding parameters
- `ef9ae4f` (2026-11-07) — Add persistent saved ride rename and confirmed deletion
- `a104a50` (2026-11-07) — Release rear tyre over bumps and move Crazy Builds into Settings
- `80ba4c5` (2026-11-07) — Accept common color and size fields in contributor template
- `062e955` (2026-11-07) — Normalize resume text encoding and line endings
- `9fd4a1f` (2026-11-07) — Detail shared rider shoes and shop clothing models
- `cc361e0` (2026-11-07) — Fix wheelie recovery and remove fixed-angle fender support
- `508f123` (2026-11-07) — Unify compatible part menus and add Basic-only overdrive test components
- `2096651` (2026-11-07) — Consolidate owner specifications and record staged delivery plan
- `acd5e68` (2026-11-07) — Offer extra-crazy power builds only in Basic mode

## Foundation: PWA, stickers, TRAX, modular parts — 4–6 Nov 2026

Why: this is the original app brought onto GitHub and then built into a modular customisation game: sticker wrapping, Chris's photo-based 20-inch TRAX bike, fitment standards, realistic part models, motors and packs, a production publish workflow, and the first physics/landing/touch work. The 18+ PIN gate was added here — the digits themselves must never be committed or printed (the gate code is already in the tree; do not copy the value into notes or new files).

- `e4b9693` (2026-11-06) — Use per-object free garage editing with floor rotation and automatic saves
- `e11257d` (2026-11-06) — Frame workshop opening and reset view around the complete bike
- `253b136` (2026-11-06) — Rebuild full-screen sticker gallery and touch cutout studio
- `ba38b12` (2026-11-06) — Remove rides from garage displays without deleting owned builds
- `dc3e771` (2026-11-06) — Add direct garage placement handles and recoverable wheelie balance
- `0836efe` (2026-11-06) — Keep garage objects fixed while camera moves and place owned items independently
- `152df5b` (2026-11-06) — Move touch tricks above pedals and help pedal bikes restart uphill
- `d53d825` (2026-11-06) — Add player garage, owned gear shop, rider customisation and Jaxons bike icon
- `70e5b8a` (2026-11-06) — Reclaim Workshop space, add Shop menu and preserve part menus during preview
- `602498e` (2026-11-06) — Polish ride recovery, rider foot placement and mobile Workshop fit
- `4420a30` (2026-11-06) — Add modular test motorbike and standing electric scooter platforms
- `b75aeab` (2026-11-06) — Clean up sticker selection with larger art cards and search
- `69cf5af` (2026-11-06) — Fix sticker-equipped Race startup and enlarge mobile Workshop menus
- `18665f6` (2026-11-05) — Center Workshop orbit and isolate race launch with graphics recovery
- `ef36d99` (2026-11-05) — Smooth terrain and scenery; add detached rider and bike crashes with instant recovery
- `1b74f67` (2026-11-05) — Modernize Workshop with full-screen neon garage, glass stats and top navigation
- `2c79de6` (2026-11-05) — Add streamed 3D surroundings and side/chase depth previews
- `5b13ce9` (2026-11-05) — Replace category rail with a compact frosted parts drawer
- `1d710fc` (2026-11-05) — Improve articulated rider and narrow side-view track composition
- `00884c6` (2026-11-05) — Fix workshop navigation, kit bundles, fork motion and arcade contacts; add sticker tracing and neon scenery
- `332b578` (2026-11-05) — Unify builder rail and add analogue lean, ride tricks and electric burnouts
- `f08c434` (2026-11-05) — Add Simple and Advanced preview builder and forgiving endless arcade riding
- `65c57d6` (2026-11-05) — Correct TRAX cockpit overlap and detail fork and drivetrain
- `31548fa` (2026-11-05) — Remove unfitted grips and cover removal and refitting
- `d4079f2` (2026-11-05) — Consolidate current handoff and automate targeted checks and live verification
- `86346ee` (2026-11-05) — Record verified landing and touch production deployment
- `65f8063` (2026-11-05) — Fix race landings, multi-touch controls and suspension attachments
- `e60339f` (2026-11-05) — Record verified production modular release
- `87ca35a` (2026-11-05) — Add production-only Cloudflare publishing workflow
- `bf9aeca` (2026-11-05) — Merge production history before publishing current app
- `391a3ec` (2026-11-05) — Fix moto modular assembly and verify all nine bike kits
- `606479c` (2026-11-05) — WIP modular parts, colour variants and compatible complete bike kits
- `52f15bd` (2026-11-05) — Rebuild TRAX pivoted rear frame and animate suspension and drivetrain
- `ddeaec3` (2026-11-04) — Fit parts on card click and open details with separate info button
- `2f5265d` (2026-11-04) — Add Chris's photo-based 20-inch TRAX bike and stock build
- `78a9670` (2026-11-04) — v18 WIP: saddle-cut frames, seated spokes and cast e-moto chassis
- `53b8a40` (2026-11-04) — docs: handoff reflects v17 on main + v18 WIP branch
- `e21aa01` (2026-11-04) — docs: handoff reflects v17 on main + v18 WIP branch
- `4a90c95` (2026-11-04) — WIP v18: detail.js, emoto frame, rear wing (unfinished)
- `cf56f41` (2026-11-04) — v16-v17: frame/spoke fix, new physics ride, dirt/damage, wash/repair, chat log removed; CODEX-HANDOFF
- `e9e13c7` (2026-11-04) — v13-v15: modular slots with mount anchors, fitment standards + conversion kits, realistic part models, 3D shop previews, sprocket gearing
- `cfbd133` (2026-11-04) — v12: rear hub + mid-drive motors, moto mids remove pedals/add footpegs, 60V/72V packs
- `f32066d` (2026-11-04) — v11: DEV_INFINITE_MONEY flag (money shows as infinity, free purchases)
- `05f4032` (2026-11-04) — v5-v10: drag-to-wrap stickers, Show all picker, re-drag, closer zoom, two-finger pan, iPad gestures; CHANGELOG
- `c986ee9` (2026-11-04) — Add CHAT-HISTORY.md and update HANDOFF.md
- `3bfff10` (2026-11-04) — Expand HANDOFF.md
- `fba9d42` (2026-11-04) — Sync UI rebuild (wk-v4) and add HANDOFF.md
- `7120540` (2026-11-04) — Sync latest app build and add sticker packs 1 and 2
- `2003635` (2026-11-04) — Sync: relative paths, 18+ PIN gate, new stickers
- `e9d8f47` (2026-11-04) — Initial Wheelie King PWA build

## How to read this against the live beta

The live beta is v2.0.2 (`9062b1d`) until someone deploys `01a004c` or a later fix. After any deploy, close the app fully and reopen it so the service worker picks up the new cache name or build line.

