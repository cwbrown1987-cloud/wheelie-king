# Race balance fix (`fix/race-balance`)

Small scoring/physics audit against the open roadmap item *track/trick reward audit*. Based on `work/claude-batch`.

## Changes
1. **Distance score** (`ride-physics.js`): +4 pts per metre while the driven wheel is powered (throttle + forward speed + battery/pedal). Coasting earns none.
2. **Speed-scaled balance** (`ride-physics.js`): wheelie/manual/stoppie rates multiply by `clamp(|vx|/6, 0.12, 1)`, so a near-stationary flat farm earns little. Keeps provisional HUD scoring; finish/report still pays once.
3. **Trials default** (`ride.js`): `wk-level` defaults to `trials` (~523 m, ~1 min depending on build). Endless flat stays via the ENDLESS toggle.
4. **110 km/h cap after gearing** (`app.js` exact string patch): cap applied after `GR.speedF` / mods so sprockets cannot exceed 110.
5. **Rear travel** (`ride-parameters.js`): sim travel uses `min(0.14, requested)` instead of `min(0.06, …)` so shocks differentiate without breaking the 2D linkage.
6. **SW cache**: `wk-v19-trials-finish-1-racefix1`.

## Intentional non-goals
No rewrite of longitudinal physics, stunts, Three.js, or `cloneForRide`. `DEV_INFINITE_MONEY` stays true.
