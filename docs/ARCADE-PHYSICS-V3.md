# Wheelie King Arcade Physics V3 — custom-bike engine

## Why this branch exists

The player's preferred handling is the original Wheelie King custom solver (`ride-physics.js` + `ride-freeroam.js`) adapted for 3D. The old Jolt-first Playground (`feature/3d-sample-track`) is **not** the basis for this work. This branch is based on `claude/classic-playground`.

Keep the original motion and bike profiles as the physical authority. New helpers **do not run another simulation**, and should never directly overwrite bike velocity, orientation or wheel contact.

Jolt's `ride-jolt.js` remains available separately with `?physics=jolt`. This change does **not** add Jolt prop physics, ragdolls or collisions to the custom simulator.

## What is built

- `ride-arcade-assist.js`: classifies ground, drift, wheelie, stoppie, air, landing and crash; predicts a rough terrain-relative landing slope and time; returns bounded assistance hints.
- `ride-freeroam.js`: reads optional hints for steering lag, available cornering grip, lean response, controlled slides, air yaw and vert rotation. No hints = original exact settings.
- `ride-physics.js`: reads optional hints for airborne pitch, hands-off flight alignment, subtle landing correction and wheelie/stoppie angular damping. No hints = exact original calculations.
- `ride.js`: activates these hints only for custom-physics **3D chase view**, mounts Arcade Lab in beta/localhost or with `?physicslab=1`, exposes telemetry and feeds visual landing cues to the rider.
- `rider-ubc.js`: optional small visual landing-preparation crouch; no duplicate COM torque.
- Arcade Lab includes Original, Balanced, Arcade and Custom presets, eight live sliders, current state, wheel contact, speed, predicted landing time, and JSON import/export. Saves locally in keys `wk-classic-arcade-mode` and `wk-classic-arcade-custom`.

### Controls

The game controls are unchanged. The handling modes modulate **the player's existing inputs**, they do not add wheelie/stoppie buttons. More responsive pitch input in the air does not mean automatic flips. The player can still crash, and a sufficiently aggressive trick suppresses predictive pitch correction.

`Original` is the default for a new browser profile.

`window.__WK_CLASSIC_ASSIST__` provides `getMode()`, `getSettings()`, `setMode()`, `setSetting()`, `reset()` and `snapshot()`. `window.__WK_TELEMETRY__().arcade` reports the current tuning and observed ride state.

### Test plan

1. `npm run test:arcade` — node-only assistance and full classic physics simulation regressions.
2. `node tests/playground-classic.mjs` — existing custom wheelie/ramp/bump-turn regression.
3. `node scripts/check.mjs ride` — complete ride test profile and static/package checks.
4. Test a BMX, e-MTB and e-moto in **CHASE** using Original → Balanced → Arcade on identical terrain.
5. Test both side view (unchanged) and `?physics=jolt` (unchanged).
6. Test touch controls, drag-to-wheelie/stoppie, trick buttons, rewind/drop-in, crashes and bike switching on a phone.
7. Use a **separate Cloudflare Pages preview** for this branch, not `wheelie-king-beta.pages.dev` or production, until all relevant checks have passed.

## Verification performed in this development session

- All changed JavaScript files compiled with a V8 syntax parse.
- The new `tests/arcade-classic.mjs` assertions executed successfully against the repository's actual new controller, steering and physics source using a mocked flat-terrain module harness.
- An identical-input run of the previous custom physics versus patched physics (Original / no hints) produced **exactly identical** sampled position, velocity, yaw, pitch, odometer, battery and score values in that flat-terrain harness.
- On the same bike and initial conditions, arcade mode produced more airborne pitch rotation than balanced and original, and tested level-ground turning remained finite without crashes.

**Not yet verified**: running the full repository's Node/browser/Playwright QA on the actual 3D scene; riding feel, mobile performance and exact current live Cloudflare deployment commit. No beta or production deployment was performed here.

## Out of scope / future work

This is a real integration of custom arcade riding assistance, not a rewrite of the world. A full physically-based 3D rigid-body lean simulation, movable Jolt props, advanced rider ragdolls, a full cinematic camera redesign, predictive shape-cast landings and procedural forest/valley/desert world generation are separate projects. Keep those features out of this branch until this handling layer is verified.

The old draft Jolt-first assistance PR was superseded; do not cherry-pick its `ride.js` or `ride-jolt.js` changes into the classic branch.
