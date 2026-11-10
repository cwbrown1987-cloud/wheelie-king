// Style B "neon dock" look for every in-game menu / HUD / dialog button (Chris's pick). Visual only: colours,
// border, glow and text. Sizes, padding, radius and layout stay with each screen's own CSS, so menus keep their
// layouts and scrolling. Exclusions use :where() so they add no specificity, and the dock's own, more specific
// rules (selected-object bar, floating handles) still win.
const OFF = ':where(:not([data-destination], [style*="background"], .garage-gizmo *, #wk-place-bar *, .wkx, [data-no-dock], [data-swatch], .swatch, input))';
const B = `html body button${OFF}`;
const PRIMARY = ':where(.primary, .ride-replay-drop, .ride-drive.throttle, [data-primary], .is-primary, .cta, .green)';
const ON = ':where([aria-pressed="true"], [aria-selected="true"], [aria-current="page"], .active, .is-active, .selected)';
const DANGER = ':where(.ride-drive.brake, .danger, .is-danger, [data-danger], .ride-replay-x, .ride-theatre-close)';
const CSS = `
${B}{background:linear-gradient(180deg,#14223a,#070d18)!important;border-color:#6fd3ff66!important;border-style:solid!important;color:#9fe0ff!important;box-shadow:0 0 0 1px #000c,0 0 12px #2fa8ff33,inset 0 1px 0 #ffffff14!important;text-shadow:0 0 6px #2fa8ff66}
${B}:where(:hover:not(:disabled)){background:linear-gradient(180deg,#1a2b44,#0a1322)!important;border-color:#8fdfff99!important}
${B}${ON}{background:linear-gradient(180deg,#13402c,#06180f)!important;border-color:#35e07acc!important;color:#7dffb0!important;box-shadow:0 0 0 1px #000c,0 0 14px #35e07a55,inset 0 1px 0 #ffffff1a!important}
${B}${PRIMARY}{background:linear-gradient(180deg,#3cf08a,#13b45c)!important;border-color:#b8ffd5!important;color:#03200e!important;box-shadow:0 0 16px #35e07a99,inset 0 1px 0 #ffffff66!important;text-shadow:none}
${B}${DANGER}{color:#ff8a9a!important;border-color:#ff5a6e99!important;box-shadow:0 0 0 1px #000c,0 0 12px #ff5a6e33!important}
${B}:disabled{opacity:.45;box-shadow:none!important}
${B} svg{filter:drop-shadow(0 0 3px currentColor)}
${B}${PRIMARY} svg{filter:none}`;
if (typeof document !== 'undefined' && !document.getElementById('wk-neon-buttons')) {
 const s = document.createElement('style'); s.id = 'wk-neon-buttons'; s.textContent = CSS;
 // last in <head> at load; !important makes later-injected screen styles lose on these properties only
 (document.head || document.documentElement).append(s);
}
