// Pause FAB + menu (Respawn / Restart / Mode / Replay / Resume). Extends existing pause.
export function pauseMenuMarkup(flat) {
  return `
<button class="ride-pause-fab ride-glass" data-r="pause" aria-label="Pause ride" aria-expanded="false">Ⅱ PAUSE</button>
<section class="ride-pause-menu ride-glass" hidden>
  <strong>PAUSED</strong>
  <button type="button" data-r="menu-respawn">Respawn</button>
  <button type="button" data-r="menu-restart">Restart</button>
  <button type="button" data-r="menu-mode">Mode: ${flat ? 'ENDLESS' : 'TRIALS'}</button>
  <button type="button" data-r="menu-replay">Replay</button>
  <button type="button" data-r="menu-resume">Resume</button>
</section>`;
}

export function mountRidePause(ui, {
  getPaused, setPaused, onRespawn, onRestart, onMode, onReplay, releaseControls, rootEl,
}) {
  const fab = ui.querySelector('[data-r="pause"]');
  const menu = ui.querySelector('.ride-pause-menu');
  const modeBtn = ui.querySelector('[data-r="menu-mode"]');

  function syncFab(paused) {
    fab.textContent = paused ? '▶' : 'Ⅱ PAUSE';
    fab.setAttribute('aria-label', paused ? 'Resume ride' : 'Pause ride');
    fab.setAttribute('aria-expanded', paused ? 'true' : 'false');
    rootEl.toggleAttribute('data-wk-paused', paused);
  }

  function open() {
    setPaused(true);
    releaseControls?.();
    menu.hidden = false;
    syncFab(true);
  }
  function showMenu() {
    menu.hidden = false;
    syncFab(true);
  }

  function close(resume = true) {
    menu.hidden = true;
    if (resume) {
      setPaused(false);
      syncFab(false);
    } else {
      syncFab(true);
    }
  }

  function toggle() {
    if (getPaused() && !menu.hidden) close(true);
    else if (getPaused()) { menu.hidden = false; syncFab(true); }
    else open();
  }

  fab.onclick = () => toggle();
  ui.querySelector('[data-r="menu-resume"]').onclick = () => close(true);
  ui.querySelector('[data-r="menu-respawn"]').onclick = () => { close(true); onRespawn?.(); };
  ui.querySelector('[data-r="menu-restart"]').onclick = () => { close(true); onRestart?.(); };
  ui.querySelector('[data-r="menu-mode"]').onclick = () => onMode?.();
  ui.querySelector('[data-r="menu-replay"]').onclick = () => {
    menu.hidden = true;
    onReplay?.();
  };

  return {
    open, close, toggle, syncFab, showMenu,
    setModeLabel(flat) { if (modeBtn) modeBtn.textContent = `Mode: ${flat ? 'ENDLESS' : 'TRIALS'}`; },
    get menu() { return menu; },
    get fab() { return fab; },
  };
}
