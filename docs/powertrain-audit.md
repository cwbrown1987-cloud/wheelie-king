# Workshop-to-Ride parameter audit

7 Nov 2026. One installed build remains authoritative; no new saved build or wallet schema.

## Confirmed fixes

- ride-parameters.js now converts Workshop speed (km/h) to the nominal drive cap (m/s) for every class. Previously ordinary bicycles/e-bikes used an unrelated power-derived cap. Human stock BMX now has the displayed 18 km/h nominal cap, with the existing pedal-tap headroom and downhill overspeed retained.
- The installed motor explicitly selects electric/petrol versus human power. A low-output electric motor or missing/zero petrol output is not reclassified as pedal power. Missing stats power can use the installed motor rating; an explicit zero remains zero.
- Battery storage uses installed V x Ah. Petrol uses installed tank litres x 8,900 Wh/L x the existing 0.2 useful-energy approximation. Zero litres stays zero. Powered rides with no storage start empty; recovery preserves the existing energy fraction.
- Effective power/torque and mass are carried through from the Workshop calculation. Axle spacing and wheel radius use the actual rendered build anchors. The existing COM floor and 60 mm rear-linkage simulation limit are preserved and documented, not presented as a new physical travel calculation.
- Mid-drive gearing changes effective game torque and nominal speed together. Pedal gearing affects pedal torque. The pedal chain ratio does not alter hub-motor drive speed. Stock prototype gearing remains unchanged; alternate petrol sprocket ratios affect its stats.
- Prototype electric readiness now rejects voltage/current mismatches too, instead of bypassing generic electrical checks through the family-specific path.

## Scope and limits

These are game estimates, not a full motor RPM/efficiency, gearbox, drag or fuel-consumption model. Existing Nm-to-drive-force tuning, torque assistance, traction and longitudinal simulation remain. Range remains a Workshop estimate; no real-world mileage claim. Energy is still stored in the legacy s.battery fraction, with an explicit powertrain/energyType at the runtime boundary. No public chase controls or repair mechanics were enabled.

## Validation

- tests/ride-parameters.mjs: human/low-output electric/petrol classification, explicit zero output/storage, W/Nm/kg/m/s/Wh, energy drain versus capacity, prototype stock stats, gearing and invalid electrical configurations.
- tests/ride-parameter-integration.mjs: real BMX/e-moto/petrol/scooter Workshop-to-Race launches plus alternate mid-drive gearing. Waits for a new ride session, avoiding stale debug globals from a disposed session.
- tests/physics-cadence.mjs: current adaptive stepping at 30/60/90/120/144 Hz versus 480 Hz drive/brake/landing reference. No accumulator rewrite. Measurements saved to ignored test-results/physics-cadence.json.
- Existing wheelie, bump release, landing, touch controls, ragdoll/recovery and prototype vehicle checks remain required. Physical Android/iPad ride feel and performance still require owner testing.

Run: npm run check -- ride powertrain vehicles (with WK_TEST_URL pointing to the active checkout server).
