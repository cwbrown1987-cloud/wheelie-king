// "Neon dock" style (Chris picked style B) for the selected-object controls in the workshop and garage:
// the bottom bar (turn / up / down, status, place-done, cancel) and the floating edit / remove / lift handles.
// Line icons drawn as SVG so they read the same on every phone (no emoji / glyph fonts).
const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
export const ICON = {
 up: svg('<path d="M5 15l7-7 7 7"/>'), down: svg('<path d="M5 9l7 7 7-7"/>'),
 check: svg('<path d="M4.5 12.5l5 5L19.5 7"/>'), x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
 rl: svg('<path d="M8 7H4V3"/><path d="M4.6 7A8 8 0 1 1 4 13"/>'), rr: svg('<path d="M16 7h4V3"/><path d="M19.4 7A8 8 0 1 0 20 13"/>'),
 edit: svg('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'), bin: svg('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'),
 play: svg('<path d="M7 5l12 7-12 7z"/>'), sticker: svg('<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4"/>'),
 lift: svg('<path d="M7 9l5-5 5 5M7 15l5 5 5-5"/>'), turn90: svg('<path d="M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4"/><path d="M12 20V12"/>'),
};
/** Fill a button with icon + optional small caps label (keeps aria-label as the accessible name). */
export function dockButton(button, icon, label = '') { button.innerHTML = (ICON[icon] || '') + (label ? `<span class="wkl">${label}</span>` : ''); button.dataset.icon = icon; return button; }
const CSS = `
html body #wk-place-bar{flex-wrap:nowrap!important;width:auto!important;max-width:96vw!important;background:linear-gradient(180deg,#101a2ccc,#060b14e6)!important;border:1px solid #6fd3ff55!important;border-radius:18px!important;padding:6px!important;gap:4px!important;box-shadow:0 0 0 1px #000,0 10px 30px #000a,0 0 24px #2fa8ff33!important}
html body #wk-place-bar button{min-width:62px!important;height:56px!important;min-height:0!important;padding:4px 8px!important;border-radius:12px!important;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:transparent!important;border:0!important;color:#9fe0ff!important}
html body #wk-place-bar button:hover:not(:disabled){background:#1a2b44!important}
html body #wk-place-bar button.primary{background:linear-gradient(180deg,#3cf08a,#13b45c)!important;color:#03200e!important;box-shadow:0 0 16px #35e07a99!important;min-width:84px!important}
html body #wk-place-bar button.primary:disabled{background:linear-gradient(180deg,#36504a,#1f3330)!important;color:#8fb3a3!important;box-shadow:none!important}
html body #wk-place-bar button[data-icon=x]{color:#ff8a9a!important}
html body #wk-place-bar .status{border-left:1px solid #6fd3ff33;border-right:1px solid #6fd3ff33;padding:0 12px;white-space:nowrap}
html body #wk-place-bar svg,html body .garage-gizmo button svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px currentColor);flex:none}
html body #wk-place-bar button.primary svg{filter:none}
html body #wk-place-bar .wkl{display:block;font:800 9px/1 system-ui,sans-serif;letter-spacing:.12em;opacity:.9}
html body .garage-gizmo button{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;padding:0!important;border-radius:14px!important;display:grid!important;place-items:center;background:linear-gradient(180deg,#14223a,#070d18)!important;border:1px solid #6fd3ff66!important;color:#9fe0ff!important;box-shadow:0 0 12px #2fa8ff44!important;font-size:0!important}
html body .garage-gizmo button[hidden]{display:none!important}
html body .garage-gizmo .object-lift{height:84px!important;grid-template-rows:1fr 1fr}
html body .garage-gizmo .object-lift svg{height:30px}
html body .garage-gizmo button[data-icon=bin]{color:#ff8a9a!important;border-color:#ff5a6e88!important}
html body .garage-gizmo button[data-icon=check]{color:#7dffb0!important;border-color:#35e07a99!important}
@media (max-height:500px),(max-width:600px){
 html body #wk-place-bar{bottom:8px!important;padding:4px!important;gap:2px!important}
 html body #wk-place-bar button{min-width:52px!important;height:48px!important;padding:3px 6px!important}
 html body #wk-place-bar button.primary{min-width:70px!important}
 html body #wk-place-bar .status{min-width:0!important;padding:0 8px;font-size:12px}
 html body #wk-place-bar svg{width:20px;height:20px}
}
@media (max-width:420px){html body #wk-place-bar .status{max-width:86px;white-space:normal;line-height:1.1}}`;
export function ensureDockStyle() {
 if (typeof document === 'undefined' || document.getElementById('wk-object-dock-css')) return;
 const s = document.createElement('style'); s.id = 'wk-object-dock-css'; s.textContent = CSS; document.head.append(s);
}
