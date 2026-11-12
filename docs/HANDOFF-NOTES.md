# Wheelie King handoff notes

Written 12 November 2026, Australia/Sydney, for a clean handoff to Claude Code.
Branch `feature/3d-sample-track` at `01a004c` (already pushed before these notes).
Repo: [cwbrown1987-cloud/wheelie-king](https://github.com/cwbrown1987-cloud/wheelie-king).
Chris Brown is the owner (Korumburra VIC). This file is the current handoff. Older root files (`CODEX-HANDOFF.md`, `CLAUDE-HANDOFF.md`, `HANDOFF.md`, `CHANGELOG.md`) are historical and stop around 7 November.

The full commit-by-commit history is in [CHANGELOG-DETAILED.md](CHANGELOG-DETAILED.md).

---

## 1. Project overview and architecture

Wheelie King is a customisation-first bike game with two ride paths that must both stay in the repo:

1. **Legacy** — Chris's original 2D / 2.5D side-scroller. It must stay intact. "It will have a place in this game." In the current beta it is not the default. Open it with `?legacy=1` (dev URL only). Do not change classic-mode trick or rotation physics.
2. **Playground** — the 3D Jolt ride, which is what the beta opens into. This is the physics and controls test bed. Once the ride feels right, bigger levels build on it.

There is also a **Garage / Workshop** builder (parts, stickers, rooms). The Shop and a full city race world are planned but not finished in the same way as the workshop.

Live URLs:

- Beta (what Chris plays): https://wheelie-king-beta.pages.dev/
- Production (only when Chris says so): https://wheelie-king.pages.dev/

### 3D Playground physics

`ride-jolt.js` is a port of Jolt's own `Samples/Tests/Vehicle/MotorcycleTest.cpp`. Settings, `MotorcycleController` usage and `ProcessInput` logic stay as in the sample. Any departure is marked `PATCH` with a reason. Collision steps are 4 per 1/60 s so the lean controller stays stable with a rider on a light bike.

The visual bike and the Jolt body are driven from a **ride profile** (`ride-profile.js`) built from fitted parts. A new frame should be data plus a model: ride-affecting parts carry an optional **ride block**; cosmetic parts only change visuals; adding a part must not need a code change. Frame class comes from `FRAME_STD` in `fitment.js` (for example a triple-clamp head is a moto frame). There are no hard-coded frame ids for class. Mass, grip, power, balance point and suspension should all follow the fitted parts.

Playground world: `ride-playground.js`. A large flat floor, three curved-kicker jumps as Jolt `MeshShape`s, and a dirt **terrain lane** next to spawn as a Jolt `HeightFieldShape` (rollers, climb, side slope, descent, moguls; CC0 ambientCG Ground054). The 3D ground is a static world, never a moving or scrolling floor.

Main loop, cameras, HUD and the telemetry hook live in `ride.js`. Touch/keyboard bindings live in `ride-controls.js`. Autostart into Playground is `autostart.js`.

### Cameras and views

Side view and the 3D chase cam are a camera swap over the **same** free-roam world.

- **Side view** is meant to be **track-locked**: no sideways steering, only forward, brake, back and tilt. A/D tilt (D forward / front flip, A back / backflip).
- **Chase view** is free ride: A/D (and on-screen left/right) steer the bike; the camera follows. The camera itself only turns when the player swipes or drags the mouse. HUD touches and buttons must never move the camera.

**All free-ride QA, stills and clips must run in chase view.** The Playground currently **boots in side view**, which is a known bug (see §4). The QA harness forces chase after boot and fails the run if the camera is not chase.

### Current ride controls (as of v2.0.1+, still in 2.0.3 WIP)

These supersede earlier button and toggle ideas. See §2 for the history.

**Touch, chase / free ride**

- Throttle and brake buttons.
- **Wheelie:** throttle plus drag the throttle thumb down (weight back). Not a mono button.
- **Stoppie:** brake plus drag the thumb up (weight forward). Not a stoppie button.
- **Brake lock / burnout:** sliding a finger from brake onto throttle locks the brake until that finger lifts, so you can burn out while steering. On the e-moto, brake plus throttle holds a burnout; steering turns it into a donut.
- Left and right buttons steer. There is no steer slider right now.
- One collapsible **TRICKS** button off to the side.
- After a crash: hold **REWIND** to scrub back at 2×; let go to resume with the speed and state at that point. **RECOVER** and **REPLAY** stay in the bottom row.
- Device tilt controls are removed. The old HOP, MONO and STOPPIE buttons are gone from Playground.

**Keyboard**

- W accelerate, S brake. In chase, A/D steer. In side view, A/D tilt.
- Shift leans back, Space leans forward, G is stand.
- Reverse is a **double-tap of brake**, because holding brake at a stop now holds the bike, including on hills.

### Telemetry and test hooks

Playwright and the QA harness talk to the live page through:

- `window.__WK_TELEMETRY__()` — compact live ride telemetry (speed, pose, wheel omega/slip, suspension compression, inputs, trick toggles, and so on).
- `window.__WK_RIDE_STATE__()`
- `window.__WK_RIDE_HOLD__(patch)` — force inputs
- `window.__WK_JOLT_RESET__(pose)`
- `window.__WK_SCENE_VIEW__('chase'|'side')`
- `window.__WK_EQUIP__(rideId)`
- `window.__WK_EXTRA_CATALOG__` — inject a data-only catalogue entry before boot (used to prove a new frame carries everything over)

### Version, cache and packing

- `version.js` exports `WK_VERSION` (currently `'2.0.3'`). Later updates go 2.1, 2.2, and so on. The name "v35" was retired.
- `sw.js` cache name follows `wk-v<version>-<name>`, currently `wk-v2.0.3-rides`. A comment line (`// build v2.0.3-1: ...`) is changed on each deploy so the service worker reinstalls and re-fetches the SHELL list even when the cache name stays the same.
- `scripts/package.mjs` (`stageRuntime`) copies runtime JS, `index.html`, `manifest.webmanifest`, `_headers`, `.nojekyll`, and the `vendor`, `stickers`, `icons`, `src` and `assets` folders into `dist/`. It checks that every SHELL path exists, and that every `./assets/...` URL referenced by a ride module is packed (this bit was added after v33f shipped a dark scene because the HDRI and ground textures never left the repo).
- `scripts/make-beta.mjs` copies `dist` to `dist-beta`, prefixes the cache name with `wk-beta-` (so beta becomes e.g. `wk-beta-wk-v2.0.2-rides`), sets the manifest name to "Wheelie King BETA", and adds a BETA badge on the page.

The **live beta is still v2.0.2** (`9062b1d`, cache `wk-beta-wk-v2.0.2-rides` after the packager prefix). Commit `01a004c` (v2.0.3 WIP) is in git but **has not been deployed**.

Players must close the app fully and reopen it to pick up a new service worker.

### Deploy (beta and main)

Use `/workspace/wk-deploy.sh <commit> [beta|production]`. Beta is the default. **Only deploy to beta unless Chris has said in his own words that main/production may go out.**

What the script does, with no secrets:

1. Creates a detached git worktree at the given commit (so the working copy is not what gets uploaded).
2. **Beta:** runs `node scripts/make-beta.mjs`, then deploys `dist-beta` to the Cloudflare Pages project `wheelie-king-beta` (https://wheelie-king-beta.pages.dev/).
3. **Production:** runs `node scripts/deploy.mjs --stage-only`, then deploys `dist` to the Cloudflare Pages project `wheelie-king` (https://wheelie-king.pages.dev/).
4. Before upload it greps the staged folder for the 18+ PIN and aborts if it is found.
5. It calls Wrangler (`npx wrangler@4.157.0 pages deploy ... --branch main --commit-dirty=true`) with the Cloudflare token taken from the environment. Never print, log or commit that token, or any GitHub token.
6. It then fetches `/sw.js` and the site root, prints the live cache name, and optionally runs `scripts/verify-live-assets.mjs`.
7. It tears the worktree down.

Push to GitHub from the box with:

```bash
bash -lc 'GITHUB_TOKEN_ECHO="$GITHUB_TOKEN_ECHOPET" git push origin feature/3d-sample-track'
```

The credential helper reads `$GITHUB_TOKEN_ECHO`. Never print the token.

### QA harness (`tools/qa-v2`)

The harness in the repo under `tools/qa-v2` is the copy to use. A working tree also exists at `/workspace/wk-qa-v2` on the box, and tests on Chris's PC (My-PC, RTX 3070) should run from `C:\Users\cbrow\Documents\wheelie-king-tests` (and write shots only into the `wk-v2.0-shots` / `wk-v3x-shots` folders). On My-PC, touch only those folders. Never delete untracked files you did not create. Use the box for git, the PIN check and deploys; run GPU tests and screenshots on My-PC when it is online.

`tools/qa-v2/run-pc.ps1` is the PC entry point. It sets:

- `WK_GPU=1` (real Chrome GPU; about 3.5× faster than SwiftShader)
- `WK_TEST_URL` default `https://wheelie-king-beta.pages.dev/` unless already set (point this at a local staged build when checking undeployed code)
- `WK_QA_OUT` to `qa-out` under the harness folder
- then `node qa-main.mjs`

Useful env:

- `WK_QA_ONLY` — comma list of suites. Default for `qa-main.mjs` is `rides,parts,tricks,phone,rider,ramps,carry,cache,legacy`.
- `WK_QA_RIDES` — e.g. `bike_bmx,bike_emoto`.
- There are also `qa-touch.mjs`, `qa-terrain.mjs`, `qa-node.mjs`, `qa-repro.mjs`, and capture scripts (`cap-chase.mjs`, `cap-201.mjs`, `cap-202.mjs`).
- `serve-local.mjs` serves a staged build for pre-deploy GPU checks.

**Chase view is mandatory for free-ride tests.** `startRide` in `qa-lib.mjs` switches the camera to chase, waits for the swing, and throws if it is not chase. `reset` re-asserts this. Do not go back to testing steering, lean, donuts, drift, terrain or jumps in side view.

---

## 2. Every decision and rule from Chris

Plain rules, grouped by area, with dates. Later rules win where they conflict. **Superseded** items are kept so nobody revives them.

### Standing product and process

- Wheelie King is a customisation game at heart. The rides are the focus. World detail matters less, as long as the world ends up looking like Chris's vision. (11 Nov 2026)
- Attention to detail on the ride, feel and the physical bike. "Not too advanced, but advanced enough that it's perfect" — weight transfer, suspension, grip and throttle response done right with the engine's own features. (11 Nov 2026)
- Ride physics must come from researched, proven approaches (existing engines and vehicle controllers, how shipped games do it), not invented as we go with constant back and forth. (11 Nov 2026)
- Use proven existing tech and assets wherever possible, then reskin to our style: Jolt Physics for rides, free sellable 3D models (ramps, jumps, skate park, props, rider), PBR ground textures, HDRI skies, plus lighting, weather and road-condition effects. Everything must carry a commercial-friendly licence that is recorded. (11 Nov 2026)
- Patch only what is missing. Use engine features as intended. Do not stack new layers on old ones; remove what is replaced. (standing)
- Remove all old and superseded code and graphics from the 3D Playground path so nothing conflicts, with no fallbacks or flags to old versions. The exceptions are what Legacy mode and the Garage still use. (11 Nov 2026)
- Change only what Chris asks. Do not add extra features or unrequested redesigns. (10 Nov 2026)
- Batch requested changes into one pass and be careful with usage credits: no doubling up, no re-reading, no repeat checks. (10 Nov 2026)
- Each batch should be either a bunch of small changes or one big change, never both mixed. (10 Nov 2026)
- Get the ride working and usable first, then optimise performance afterwards. (11 Nov 2026)
- Apart from graphics, the v2.0 push needs to be perfect. Test on the live beta. "No more mistakes." (11 Nov 2026)
- Do not stop between batched steps Chris has already asked for. (12 Nov 2026, after work paused following the v2.0 deploy)
- Concept images are the final goal. Meshes, models and variety may be improved wherever that gets closer to them. (10 Nov 2026)
- The game must stay runnable on phones and tablets. Every bike part must fit and work properly. Bike customisation is the big job once the ride and rooms are right. (10 Nov 2026)
- Normal updates go to beta for testing. Merging or deploying main/production needs Chris's OK in his own words. Beta deploys are already approved. (standing)
- Never buy anything without Chris's OK in his own words, and never invent prices or specs. (standing)
- Never edit project-echo (Dex's code). Never touch the shop site, ShopApp, RD's echo-companion-preview, or the echo-status worker. (standing, not Wheelie King source, but still in force)
- Run tests, builds and screenshots on My-PC, in parallel where safe. Use the box only for git, the PIN check and deploys. (10 Nov 2026)

### Versioning

- The release formerly called v35 (two rides, tricks, new rider) is **v2.0**. Later updates go 2.1, 2.2 and so on. (11 Nov 2026)
- Day-to-day Playground fixes have been shipped as 2.0.1, 2.0.2, and a 2.0.3 WIP.

### Legacy, modes and Playground

- The OG side-scroller stays exactly as-is as Legacy mode, with only its background and world fixed later. "It will have a place in this game." Keep it intact, including its original rider and art. (11 Nov 2026)
- **Superseded (11 Nov 2026, late evening):** sample3d and the other modes were removed from the beta so work can focus on the Jolt Playground. The beta opens straight into the Playground. Legacy is kept in the repo via `?legacy`. The Garage stays.
- The arena was renamed **Playground** and is the physics and controls test bed. Once it feels right, bigger and more complex levels build on it. (11 Nov 2026)
- **Superseded (v34 / v2.0):** Jolt first went in behind a pause toggle with classic as the default, then as a side-by-side compare switch. Playground is now Jolt-only. Classic lives only as Legacy.
- Get the riding feel right first in a simple open test world with a few bumps and jumps and enough room to reach top speed, pull wheelies and do burnouts, before adding the city. (11 Nov 2026)
- Work only on the city skate-park level for now. The mountain trail level is parked until Chris asks for it. (10 Nov 2026)

### Cameras, world and views

- Side view and the 3D chase cam are a camera swap over the same free-roam world. Riding should feel like a AAA riding game. Trick and rotation physics must never change. (11 Nov 2026)
- A track runs through the middle of the free-roam map. Side view locks the rider to it (no steering, only forward, brake, back and tilt). Switching to 3D swings the camera from the side to behind and unlocks steering, so you can follow the track or ride off anywhere. (11 Nov 2026)
- The 3D world should be free roam: go anywhere, steer, turn around, ride the ramps, treat buildings as solid. Lane-only steering is rejected. (11 Nov 2026)
- All free-ride QA, stills and clips (steering, lean, donut, drift, terrain, jumps) must run in **chase view**, because side view is track-locked with no sideways steering. (12 Nov 2026)
- The chase camera was too close; pull it back so the whole rider and bike are visible. (11 Nov 2026). A later note asked for it a bit closer so you can see detail; keep the whole rider and bike in frame.
- The camera is fixed behind the rider and only turns when you swipe or drag the mouse. Buttons and keys never move it; they steer the bike. (11 Nov 2026)
- Left and right buttons must steer the bike itself, not the camera. The bike should visibly turn and lean into corners. (11 Nov 2026)
- Jumps should feel bigger and speed should feel faster in the 3D chase view, closer to how they feel in the side view. (11 Nov 2026)
- Shadows are needed so the player can gauge depth and steepness. (11 Nov 2026)
- The bike, rider, jumps, cones and buildings should be sized to real-world measurements, so a 2 m-tall jump actually looks like one next to the rider. (11 Nov 2026)
- No repeated background. When going from side view to chase, the world should be a real 3D city along the track, with streets, the skate park, the BMX track and buildings placed as actual pieces. The painted skyline stays only as the far horizon and sky. Concept first. (11 Nov 2026)
- Do not stretch the wall or buildings in a way that hides the background. The background should stay visible. Scale uniformly. (10 Nov 2026)
- Buildings should be reskinnable kit parts (towers, windows, rooftops, signs with texture slots), not plain tinted boxes. Show that in the concept first. (10 Nov 2026)
- Fill the ride mid-ground (between the wall and the city) with a street, a skate park and a moto/BMX track so it feels alive. (10 Nov 2026)
- The 3D ground must be a static world, never moving or scrolling. Tyre marks must be tyre-width and come from the rear contact patch. (11 Nov 2026)
- After jumps, handling on uneven terrain (uphill, downhill, slopes, bumps) must work, because the open world will not just be roads, flat ground and ramps. Chris later asked to batch the background and terrain into the same build: "I want at least a working ride simulator." Terrain shipped in v2.0.1. (11–12 Nov 2026)
- Return-to-track: a glide looked like the bike was being dragged. Instead, snap the bike to the nearest track point facing forward and hide the snap with a quick camera swing. (11 Nov 2026)
- Descenders and Riders Republic are the main references for 3D camera angles and tricks. On-screen controls need to be easy and natural. (11 Nov 2026)
- Use Wheelie Life and kids' Roblox bike games as feel references. Chris likes Wheelie Life's bike damage physics and wants something like it later, after the free-roam arena feels right. (11 Nov 2026)
- Once v2.0 is perfect, if usage remains, beautify the world with free assets that look good together and match his city vision, reskinning where needed. Check usage before starting. (11 Nov 2026)

### Controls and tricks

- **Current (12 Nov 2026, 8:46 AM):** wheelies and similar moves must come from accelerating and pulling back (rider weight shift with throttle), not from a mono button. This **supersedes** the earlier wheelie-toggle idea, and **supersedes** the v2.0 MONO / STOPPIE touch buttons.
- On touch, drag the throttle thumb down to shift weight back (wheelie under power). Push forward while on the brakes for a stoppie. Keyboard: Shift leans back, Space leans forward. (12 Nov 2026)
- Sliding a finger from brake onto throttle locks the brake until that finger lifts, so you can burn out while steering. (11 Nov 2026)
- **Tilt controls are removed entirely.** (11 Nov 2026) This **supersedes** earlier air-tilt buttons on the left, up/down tilt buttons, and using the slider as tilt.
- Tricks should be simplified. All possible tricks go in one collapsible touch button off to the side. (11 Nov 2026)
- Rewind and drop-in must be kept and must work with Jolt in Playground. (11 Nov 2026)
- After a crash, holding REWIND rewinds the ride at double speed. Letting go resumes from that point with the speed and position the rider had there. (10 Nov 2026)
- The trick buttons collapse into one TRICKS button set a bit higher on the right. The crash REWIND button is a round button at the right end above the trick and throttle area. RECOVER and REPLAY stay in the bottom row. (10 Nov 2026)
- HUD touches must never move the camera. (11 Nov 2026)
- **Superseded (11 Nov, later the same day):** "for now there's no steer slider; left and right buttons steer, and up and down buttons rotate or tilt, plus accelerate, brake, hop and tricks." The hop button was then hidden in Playground, tilt was removed, and mono/stoppie buttons were later removed in favour of weight shift. Left/right steer buttons remain. A steer slider had been added earlier for chase-cam and is also **superseded** for now.
- **Partially superseded:** Chris wanted the full Project Wheelie control set — a wheelie toggle with throttle feathering at the balance point, throttle+brake for burnout and drift, a stand-on-pegs button, one-hander and knee-knock, and walking up to a bike to hop on. (11 Nov 2026). The wheelie *toggle* is superseded by weight shift (feathering at the balance point still matters). Throttle+brake burnout/drift remains. Stand, one-hander, knee-knock and walk-up are still wanted; walk-up comes after the rider swap.
- In side view, D tilts forward (front flip) and A tilts back (backflip). In chase view, A/D steer. W accelerates. S brakes. (11 Nov 2026; Space-to-hop is superseded in Playground)
- Steering must come from the handlebars, like a real bike. At a standstill, only the bars turn. The bike turns only when moving, follows the front wheel and must not slide. (11 Nov 2026)
- Holding brake plus accelerate should creep forward very slowly and let you turn the bars into a donut. (11 Nov 2026)
- There is no speed cap; each vehicle can reach the max speed its own capabilities allow. (10 Nov 2026)
- Slow-mo is a toggle: one press starts it, the next press stops it, with no holding and no timer. (10 Nov 2026)
- A note on BMX standstill burnouts: in v2.0.2 this was left as real-world accurate (a rider's legs do not have that torque). It is still listed as an open feel issue in §4, because the harness and Chris may still want an arcade option.

### Parts, frames and damage

- Ride physics come from data-driven parts. A new frame must just be data plus a model, and new frames and designs must carry everything over (same systems: wheelie, stoppie, burnout, rewind, fitment, and so on). (11 Nov 2026)
- There will be many more parts, some purely visual mods. Ride-affecting parts carry an optional ride block; cosmetic ones only change visuals; adding a part never needs code changes. (11 Nov 2026)
- Every fitted part should change weight, balance point, power and grip. Upgrade kits like e-bike motor kits must be able to raise top speed past the 25 km/h legal limit. (11 Nov 2026)
- Every ride (bikes, scooter and so on) should adapt automatically through one shared rig. Bars, fork and wheels are detected from the 3D model and steered and spun by the same physics, with only per-vehicle tuning. No per-model hand wiring. (11 Nov 2026)
- Pegs become a part later. (11 Nov 2026)
- Part damage comes after v2.0: a tyre pops after a long burnout, bent rim, damaged fender, driven by Jolt slip and impact data with durability and a damaged look per part. (11 Nov 2026)

### Vehicles and roster

- Two-wheelers only: scooters, bikes, e-bikes, e-scooters and dirt bikes. ATVs and 4-wheelers are not a focus. (11 Nov 2026)
- Skateboard and scooters (electric and kick) are the edge over Project Wheelie, which is motorbikes only. Both come after the two bikes feel right. A skateboard for the skate park would have its own separate control style. (11 Nov 2026)
- Chris wants on-foot walking, so the rider can get off one ride and onto another. Playground should later have several rides parked (bikes, a scooter, a skateboard) to swap between. This comes after the rider swap. (11 Nov 2026)

### Rider

- The rider should be a smooth rigged 3D character with fluid movement that looks like his vision, replacing the block rider, while trick and bike physics stay the same. (11 Nov 2026)
- Plan: swap to the CC0 Quaternius Universal Base Character, with IK poses for seated, stand, wheelie lean, one-hander and knee-knock. The old rider is deleted once the new one is in. Ragdoll comes in the round after (Jolt ragdoll on that rig, Universal Animation Library clips for off-bike moments). Chris still wants a crazy full ragdoll on crashes. (11 Nov 2026)
- The new rider was deferred from v2.0 because it would cost too much usage while wheels and jumps were still wrong. (11–12 Nov 2026)
- He wants the rider to look more like his vision screenshot, starting with one awesome test outfit (concept first). A lime full-face test helmet and crouched ride pose are already in. (10 Nov 2026)

### Replay, drop-in and media

- Replay plays back the last 20 seconds up to pause. There is a back/forward scrubber, a Play button under the video, and a Drop In button that returns the player to the live game at that exact moment with the same speed and state (if mid-trick, still mid-trick). (10 Nov 2026)
- Drop In smoothly blends from the replay video into the live game, then runs about a second of slow-mo that eases back to full speed so the player can get their bearings. (10 Nov 2026)
- When the player crashes, a Replay button appears next to Respawn so they can watch the stack straight away. (10 Nov 2026)
- Replay recording pauses while the player is in any menu or the game is paused, so clips only show actual riding. (10 Nov 2026)
- The replay screen looks like a YouTube page: big player, saved videos listed down the side as thumbnails (date, length, bike); tapping a thumbnail plays that video; the latest run stays at the top with Drop In; saved videos stay on the device and can be deleted from the list. (10 Nov 2026)
- Hitting the play button in the middle of the video (like YouTube) opens a larger view that hides the side thumbnails and starts playing, with clearly labelled Pause, Rewind and Fast forward, a scrubber, and a Drop In button along the bottom. (10 Nov 2026)
- All replay controls must sit on the video panel itself (play, the seek bar, Drop In, Screenshot, Save and Clip) so the replay screen never needs scrolling. The scrub bar must be easy to scroll with a finger. (10 Nov 2026)
- There should be a way to save a replay video and a screenshot; they can later go in photo frames or something similar, which Chris will decide. (10 Nov 2026)

### Rooms, workshop, garage and shop

- Landscape only everywhere. Portrait shows only a rotate-your-phone overlay. There are no portrait layouts or portrait tests. (10 Nov 2026)
- The garage and workshop screens must not scroll; every screen should lock to the device screen size on iPhone, iPad and Android. (11 Nov 2026). Earlier (10 Nov) every *menu* had to scroll on phones — that still applies to overflowing menus, but the room screens themselves stay locked to the screen.
- Auto-rotation is off by default in the bike-edit and room-edit views. (10 Nov 2026)
- All in-game menu buttons follow style B, the neon dock look. (10 Nov 2026)
- The loading screen should stay short and never wait longer than it needs to. While it loads it shows a rotating hint, tip or change from the latest update, kept in a simple list so new ones are easy to add. (10 Nov 2026)
- All rooms (garage, workshop, shop, and later others) exist as their own 3D environments in one shared space. The camera stays locked inside the current room. Switching rooms is a smooth zoom out, pan, zoom in. Real doors in the scenery should later lead to the neighbouring room, with an option to walk or ride through as well as the camera transition. Workshop behind the garage, shop beside it. (10 Nov 2026)
- Workshop: Chris's `icons/neon-garage-background.webp` art "needs to be the room". It is camera-projection-mapped onto real 3D blocks (chests, shelves, bins, pegboard, tools). The rest of the 360° room continues the same garage style, with open placement slots. Keep the original workshop zoom. No turntable or circle under the bike. Never mask the art out to plain brick. The room must look like his picture from the game camera. (10 Nov 2026)
- The player can place 3D objects anywhere in the workshop, like the garage's move/arrange system, with collision so objects never clip walls or each other. (10 Nov 2026)
- PLACE becomes an EDIT room button at the bottom right, with a small TEST RIDE button next to it that starts a race. Rotation, test motion and the suspension slider show only in bike edit mode. (10 Nov 2026)
- When entering place mode in any room, the camera pulls back to a wider view, the bike is hidden, and selected items drop into the middle of the room with the move and rotate buttons. (10 Nov 2026)
- Move and rotate controls should look natural and 3D, with curved opposed rotate arrows around the object's base. The workshop bike should sit on a proper bike workstand, raised as if it is being worked on. (10 Nov 2026)
- Height / lift uses up and down arrows in the same style as the move arrows, not a tall lift button, spaced well apart. (10 Nov 2026)
- Items spin in place about their own centre, and the rotate arrows animate a little. Shelves and toolboxes can be moved too. Removing any item sends it to Storage, where it can be placed again. (10 Nov 2026)
- The player drags a wall item freely around the wall with a finger. Spin arrows shown around it turn it in the wall plane, like tilting a picture frame. There is no separate rotate button for that. (10 Nov 2026)
- Picking a wall-mounted object quickly pans the camera up and highlights the item. A Done button exits edit mode and recentres on the bike. Clicking the bike at any time snaps the camera back to it, unless the camera is already close enough for working around the bike. (10 Nov 2026)
- The admin panel has an Unlimited zoom toggle, off by default; when it is on, the room cameras have no zoom limits, and the setting persists. (10 Nov 2026)
- Garage art-room (pending): same projection treatment using `icons/showroom-background.webp` (white showroom garage), keeping everything that currently works in the garage (moving items, existing shelves and furniture). Concept sheet first. (10 Nov 2026)
- Shop art-room (pending): same treatment using `icons/rider-shop-background.webp`, with no bike. Shelves display items (not interactive); clicking a shelf section opens that item category in the shop. Concept sheet first. (10 Nov 2026)

### Tuning and how to work on feel (approved 12 Nov 2026)

Chris agreed these should come right after the bump-turn flip fix:

1. **A tuning panel in the beta** — live sliders on the phone for grip, lean speed, suspension, the wheelie balance point and weight shift. Chris sets the feel by riding; the numbers then get baked into the parts data.
2. **Recording rides / crashes** — the game saves inputs when the player crashes or flips. That exact ride is replayed to fix the bug, and becomes a permanent test.

A third idea (start from proven open-source bike-game handling rather than only hand-tuning Jolt's stock motorbike) was suggested as a longer path; the first two are the approved next step.

### Orientation and My-PC paths

- Landscape only, as above.
- My-PC machine id `cd098c8d-6cc9-47ef-98d0-fd7c8c1371a5`. Touch only `C:\Users\cbrow\Documents\wheelie-king-tests` and the `wk-v3x-shots` / `wk-v2.0-shots` folders.

---

## 3. Change history (summary)

See [CHANGELOG-DETAILED.md](CHANGELOG-DETAILED.md) for every commit on this branch, grouped and explained.

Short arc:

- **4–7 Nov 2026, foundation.** PWA, stickers, TRAX 20-inch bike, modular parts and fitment, early side-scroller ride physics, then shared 3D workshop/garage rooms behind the menus.
- **10 Nov, v2x workshop era (v22–v25f2).** 360° workshop kit, art-room projection, place/edit mode, style-B buttons, workstand and gizmo, storage, rewind, landscape lock, replay overlay, race skyline, mid-ground, test rider outfit.
- **11 Nov, v3x.** A rough 20-second SAMPLE 3D city track, chase-cam controls, the Arena test world, then Jolt `MotorcycleController` first as a sandbox, then hooked into the live arena. Arena renamed Playground. Wheels spun from axle speed, HDRI sky, ground textures. v33f: camera-only side view, snappier launch, brake-to-reverse, HDRI shipping fix.
- **11 Nov, v34.** Flat-ground rebuild on a clean port of Jolt's MotorcycleTest. Stacked hacks, ramps, track, cones, grass, classic toggle and Playground-only assets were stripped because they had ruined the feel and wasted deploys (undeployed assets, missing packager paths).
- **11–12 Nov, v2.0.** Parts-derived Jolt ride, tricks panel, rewind/drop-in, telemetry, autostart into Playground, sample3d removed, tilt removed, jumps and skyline, HOP hidden.
- **12 Nov, v2.0.1.** Terrain lane, jumps that actually launch, wheelie/stoppie by weight shift, MONO/STOPPIE buttons removed, no rest creep, brake-hold at a stop, double-tap brake to reverse.
- **12 Nov, v2.0.2.** Burnout/donut/drift via tyre friction and foot-down balance, BMX stoppie lift, mass from fitted parts, loop-out yank, then a fix so a wheelie skipping a bump no longer loops.
- **12 Nov, v2.0.3 WIP (`01a004c`, not deployed).** Bump-turn flip fix (lean controller off when a wheel unloads, rider air roll hold, softer lean spring) and chase-view-only QA harness.

---

## 4. Current state and known bugs

**Git:** `01a004c` on `feature/3d-sample-track` (v2.0.3 WIP).
**Live beta:** still **v2.0.2** (`9062b1d`), cache `wk-beta-wk-v2.0.2-rides`. v2.0.3 has not been deployed or GPU-verified as a full suite.

### Latest pass counts

- **v2.0** (38debee, live beta, early 12 Nov, still partly in side view): main 143/187, touch 22/34. Mono, brake lock, skyline and Playground start worked. Jumps did not launch. Steering dropped during brake lock. Bikes crept at rest. Stoppie, burnout and drift were wrong.
- **v2.0.1** (68dccfc + cea5685, My-PC GPU): main 89/105, touch 26/32, terrain 12/14.
- **v2.0.2** (bbb6ebf / 9062b1d, My-PC GPU, reported to Chris): touch **31/32**, terrain **14/14**, main **124/138**. E-moto burnout and donut held without falling over (413° in the clip). BMX drift and stoppie worked; a heavier frame changed the ride. Remaining failures were mostly test settings, plus BMX landings and lean, and no BMX standstill burnout.
- **v2.0.3 WIP** (`01a004c`, My-PC GPU against a **local staged build**, not the live beta; chase view; carry suite interrupted): bump-turn check **11/12** (was 3/12 on live v2.0.2). The remaining fail is BMX 30 km/h hold-turn, which still falls at about x=121. Main was about **127/138** partial. Lean-responsive checks passed. BMX loop-out no longer triggered in the harness path. A full GPU main/touch/terrain re-run was not finished. Node full-lock flat turns at 20–40 km/h did not reproduce Chris's hard-turn flip (max roll 22–35°, no crash).

The chase-view re-run Chris asked for on live v2.0.2 was started, then work moved onto the bump-turn fix; a complete chase-view report on the live beta was not finished.

### Known bugs and open feel issues

Verbatim from the latest report at `01a004c`:

- **Flat hard-turn flips in Chris's clip** (over-lean, front lifts, pivots on the rear, slides on its side then snaps into a roll). Not reproduced in node. Suspected input path of lean plus steer.
- **Ramp-edge violent launch** when the rear wheel hits a ramp edge off-line.
- **Random hop on flat ground.**
- **Visual fork and shock not compressing.**
- **Bump-turn flip** partly fixed in `01a004c` and not GPU-verified. (The fix: Jolt lean controller is disabled whenever either wheel loses contact, because its target is the direction of the ground impulse; cresting a roller or landing, that is one tyre's side force, and the spring threw the bike over. Airborne, the rider holds the bike upright with a roll PD. Lean spring was softened from the v2.0.2 tune 7/0.45 to 5/0.4. Tip-in t90 stayed about 0.73 s on GPU.)
- **BMX loop-out lost.**
- **BMX burnout and donut from a standstill.**
- **Drift ratio.**
- **BMX lean and twitchiness.**
- **BMX landings.**
- **Rider IK.**
- **Rewind first-frame offset.**
- **The Playground boots in side view** (side view is meant to be track-locked with no steering; free ride is chase).

Chris also reported, in his own words, that going over bumps and turning seems to flip the bike out. That is the bump-turn item above.

---

## 5. Deferred and roadmap

Do these after the ride-feel bugs above, unless Chris says otherwise. Tuning panel and crash recording were approved to follow the bump-turn fix.

- **In-beta tuning panel** plus **crash / flip input recording** that becomes permanent tests. (Chris approved, 12 Nov 2026, 11:19 AM Australia/Sydney.)
- **Quaternius rider** plus IK poses (seated, stand, wheelie lean, one-hander, knee-knock) and, in a later round, Jolt ragdoll.
- **One-hander and knee-knock** (want to work once the rider IK is in; the trick names exist).
- **Pegs as a part.**
- **Part damage** after v2.0 (tyre pop after a long burnout, bent rim, damaged fender).
- **World beautify** with free, licence-clean assets that match the city vision, only once the ride is right and if usage remains. Check usage first.
- **Skateboard and scooters** (electric and kick), after the two bikes feel right. Skateboard gets its own control style.
- **Walking up to bikes** and several parked rides in Playground to swap between, after the rider swap.
- **Dead-code sweep** of leftover Playground / sample3d / classic-toggle paths, without touching Legacy or the Garage.
- **Garage art-room** (`icons/showroom-background.webp`), concept first.
- **Shop art-room** (`icons/rider-shop-background.webp`, no bike, shelves open categories), concept first.
- **City race world** as a real 3D side + chase world, reskinnable buildings, painted skyline only as the far horizon, concept first.
- **Mountain trail** level, parked.
- Start-from-proven-bike-code (looking at open-source games with good handling) remains a suggested longer path, not the approved next step.

---

## 6. Hard rules for any agent

- **Never commit the 18+ PIN or the games hub PIN.** Never print them, never write the digits into docs, comments, logs, cache names, tests or screenshots. Grep for them before every commit. The deploy script also greps the staged dist for the 18+ PIN and aborts if it is found.
- **Never print, log or commit tokens or keys** (Cloudflare, GitHub, Hugging Face, or any other). Use them from the environment in a fresh `bash -lc` shell.
- **No force-push.**
- **Keep Legacy intact.** Do not change classic-mode trick or rotation physics. Leave `?legacy=1` working.
- **Use engine features as intended.** Port and configure Jolt's `MotorcycleController`; do not stack hacks on top of previous hacks. Remove superseded code when you replace it.
- **A new frame is data plus a model.** Do not special-case frame ids. Carry the whole ride system over.
- **Test on the live beta, in chase view**, for any free-ride behaviour. If you are checking undeployed code, stage it locally and still test in chase. After a beta deploy, close the app fully and reopen it.
- **Beta deploys only.** Main / production needs Chris's OK in his own words.
- On My-PC, touch only the test and shots folders named in §2. Never delete untracked files you did not create. No broad deletes in `/tmp` or other shared folders. Kill only processes you start.
- Freely available, commercial-friendly assets only, licences recorded. Do not invent prices, and do not buy anything without Chris's OK.
