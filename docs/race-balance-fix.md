# Race balance fix (`fix/race-balance`)

Small scoring/physics/UI audit on top of `work/claude-batch`.

## Changes
1. **Distance score** (`ride-physics.js`): +4 pts per metre while the driven wheel is powered (throttle + forward speed + battery/pedal). Coasting earns none.
2. **Speed-scaled balance** (`ride-physics.js`): wheelie/manual/stoppie rates multiply by `clamp(|vx|/6, 0.12, 1)`, so a near-stationary flat farm earns little.
3. **Trials default** (`ride.js`): `wk-level` defaults to `trials`. Endless flat stays via the ENDLESS toggle.
4. **No hard top-speed cap**: workshop speed and `bikeParams.vmax` follow motor/gearing/drag only (removed the old 110 km/h and 40 m/s clamps). Soft drag at `vmax` remains as vehicle capability.
5. **Rear travel** (`ride-parameters.js`): sim travel uses `min(0.14, requested)` so shocks differentiate.
6. **Graffiti wall** (`ride-environment.js`): restored terrain-following ~1.7 m wall height (no fixed `wallTop` stretch that hid the backdrop in valleys).
7. **Slow-mo toggle** (`ride.js`): SLOW MO is press-once to start, press-again to stop. No hold-to-run and no 15 s timeout. Still requires a jump/air window to arm, and still ends on crash/finish.
8. **Pause menu** (`ride-pause.js` + `ride.js`): prominent top-centre Pause opens Respawn / Restart / Mode / Replay / Resume. Esc or P toggles it.
9. **Replay buffer / library / theatre** (`ride-buffer.js` + `ride-replay.js`): rolling last-20s state (every physics step) and rolling canvas capture. Pause → YouTube-style glass player (latest 20s + IndexedDB library). Overlay play enters theatre (hide library; Play/Pause, Rewind, FF, scrubber, Drop In). Drop In for live buffer and saved clips with state. Never clears localStorage.
10. **Unlimited zoom** (`builder-mode.js` + `player-view3d.js`): Settings toggle (off by default, `wk-unlimited-zoom`). On → workshop/garage orbit has no min/max zoom; Off → normal limits.
11. **Check for update** (Settings): fetches `sw.js` (`cache: no-store`), compares build id, can force via long-press or second tap; unregisters SW + deletes caches (keeps localStorage), then cache-bust reload. Offline → "Can't reach server".
12. **SW cache**: `wk-v19-trials-finish-1-racefix4`.

## Intentional non-goals
No rewrite of longitudinal physics, stunts, Three.js, or `cloneForRide`. `DEV_INFINITE_MONEY` stays true. Workshop neon-background rebuild deferred (`/workspace/wk-workshop-bg-wip.patch`).
