# Wheelie King Physics Lab — opt-in prototype

This branch is based on `feature/3d-sample-track` and leaves legacy side-on riding unchanged.

## Included
- `ride-arcade-handling.js`: pure input/state coordinator. Classifies GROUND, WHEELIE, STOPPIE, DRIFT, AIR, LANDING and CRASH.
- `ride-jolt.js`: reuses its *existing* Jolt steering, tyre and rider torque logic with optional assistance parameters. There is no second physics engine.
- `ride-arcade-ui.js`: collapsible Physics Lab for beta/localhost (or `?physicslab=1`).
- `ride.js`: manages opt-in handling in the Jolt playground, exposes telemetry and preserves classic mode.
- `tests/arcade-handling.mjs`: deterministic state/passthrough/configuration tests.

## How to use
Open a build of this feature branch in the 3D playground. Click **⚙ PHYSICS LAB** at the lower right.

Modes:
- **Original**: exact raw input pass-through; existing Jolt handling unchanged.
- **Balanced**: modest steering/grip/air assistance.
- **Arcade**: stronger but bounded assistance.
- **Custom**: adjust six settings live.

The current mode and custom sliders persist locally. **Original** is the default for a fresh user, to avoid untested handling becoming the live default. The test hook `window.__WK_HANDLING__` and `window.__WK_TELEMETRY__().handling` report the current state and assistance.

## Division of responsibility
The coordinator only shapes inputs and computes Jolt tuning hints. Jolt alone applies tyre friction, vehicle control and rider corrective torques. Intentional strong airborne lean suppresses roll self-righting so a trick is not fought by two systems.

Bike specifications still come from the existing `ride-profile.js`, preserving differences in mass, wheelbase, torque, grip and suspension.

## Tests
Run `npm run test:arcade`, `npm run check -- --profile=ride`, then the existing 3D Playground browser QA. Exact invocation of the existing QA profile should be checked against `scripts/check.mjs`.

**Not yet complete:** physically assisted trick scoring, predictive landing raycasts, rider IK improvements, cinematic camera overhaul, procedural three-biome terrain and mobile playtesting. These should be separate milestones, not represented as finished by this PR.

**No deployment or merge is performed by this branch.** Browser gameplay needs manual validation before selecting Balanced as the default.
