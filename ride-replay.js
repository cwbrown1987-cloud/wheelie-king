import { createRideBuffer, restoreRideState } from './ride-buffer.js';
import { listReplays, saveReplay, deleteReplay } from './ride-replay-store.js';
import { thumbFromVideo } from './ride-gallery-thumb.js';
import { listGallery, addGalleryItem, removeGalleryItem, exportGalleryItem } from './ride-gallery.js';
import { createBlockRing } from './ride-replay-blocks.js';

export function mountRideReplay(ui, canvas, setReviewing, hooks = {}) {
  const button = ui.querySelector('[data-r="replay"]');
  const panel = ui.querySelector('.ride-replay');
  const video = panel.querySelector('video');
  const saveGalleryBtn = panel.querySelector('[data-r="save-video-gallery"]');
  const saveDeviceBtn = panel.querySelector('[data-r="save-video-device"]');
  const download = panel.querySelector('[data-r="download-video"]');
  const shotGalleryBtn = panel.querySelector('[data-r="save-shot-gallery"]');
  const scrub = panel.querySelector('input[type="range"]');
  const playBtn = panel.querySelector('[data-r="replay-play"]');
  const dropBtn = panel.querySelector('[data-r="drop-in"]');
  const timeLbl = panel.querySelector('[data-r="replay-time"]');
  const listEl = panel.querySelector('[data-r="replay-list"]');
  const latestBtn = panel.querySelector('[data-r="latest-run"]');
  const overlayPlay = panel.querySelector('[data-r="overlay-play"]');
  const theatreScrub = panel.querySelector('[data-r="theatre-scrub"]');
  const theatreTime = panel.querySelector('[data-r="theatre-time"]');
  let recorder, stream, url, expiry, limit, started, capture, disposed = false, openedFromPause = false;
  let rolling = null, activeSource = 'latest', activeSaved = null, latestBlob = null, latestDuration = 1;
  const ring = createBlockRing({ maxBlocks: 2, blockMs: 30000 });
  let latestState = null; // optional state snapshot for Drop In on latest / saved-with-state
  const buffer = createRideBuffer(20);
  const supported = typeof MediaRecorder !== 'undefined' && !!canvas.captureStream;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
  // iPad/iPhone Safari records and plays MP4 (H.264) reliably; Chrome/Android get VP8 WebM (cheap to encode on phones).
  const apple = /Apple/.test(navigator.vendor || '');
  const recMime = (() => {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
    const webm = ['video/webm;codecs=vp8', 'video/webm'], mp4 = ['video/mp4;codecs=avc1', 'video/mp4'];
    return (apple ? [...mp4, ...webm] : [...webm, ...mp4]).find(t => MediaRecorder.isTypeSupported(t));
  })();
  // 30 fps capture (15 fps looked choppy); bitrate sized for phones vs desktop.
  const REC = { fps: 30, bps: coarse ? 2000000 : 3000000 };
  let start0 = 0; // media timeline start of the presented clip (non-zero when early blocks were trimmed)

  const fmt = s => { s = Math.max(0, +s || 0); const m = Math.floor(s / 60), sec = Math.floor(s % 60); return m + ':' + String(sec).padStart(2, '0'); };
  const syncTime = () => {
    const total = (+scrub.max || video.duration || latestDuration || 0) - start0;
    const text = fmt(video.currentTime - start0) + ' / ' + fmt(total);
    if (timeLbl) timeLbl.textContent = text;
    if (theatreTime) theatreTime.textContent = text;
    if (theatreScrub && scrub) theatreScrub.value = scrub.value;
  };
  const syncPlayIcon = () => {
    const playing = !video.paused;
    if (playBtn) { playBtn.textContent = playing ? '❚❚' : '▶'; playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
    const tPlay = panel.querySelector('[data-r="theatre-play"]');
    if (tPlay) { tPlay.textContent = playing ? '❚❚ Pause' : '▶ Play'; tPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
    if (overlayPlay) overlayPlay.hidden = playing || panel.classList.contains('is-theatre');
  };
  const canDropIn = () => activeSource === 'latest' || !!(activeSaved?.state);
  const syncDrop = () => { if (dropBtn) dropBtn.hidden = !canDropIn(); const td = panel.querySelector('[data-r="theatre-drop"]'); if (td) td.hidden = !canDropIn(); };

  function clear() {
    clearTimeout(expiry); clearTimeout(limit);
    button.hidden = true; panel.hidden = true; ui.querySelector('.ride-gallery') && (ui.querySelector('.ride-gallery').hidden = true); openedFromPause = false;
    exitTheatre(false);
    ring.unfreeze();
    setCaptureActive(true);
    setReviewing(false);
    prepId++; start0 = 0; video.pause(); video.removeAttribute('src'); video.load();
    if (download) { download.removeAttribute('href'); download.hidden = true; }
    if (url) URL.revokeObjectURL(url); url = null;
    if (capture) { capture.discard = true; capture.chunks.length = 0; capture = null; }
    stopClip();
    syncPlayIcon(); syncTime();
  }
  function stopClip() {
    clearTimeout(limit);
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    recorder = stream = null;
  }
  function mimeGuess(chunks, rec) { return rec?.mimeType || chunks[0]?.type || 'video/webm'; }

  function present(blob, duration, { autoplay = true, source = 'latest' } = {}) {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    const mime = blob.type || 'video/webm';
    if (download) {
      const mime = blob.type || 'video/webm';
      download.download = mime.includes('mp4') ? 'wheelie-king.mp4' : 'wheelie-king.webm';
      download.href = url; download.hidden = true;
    }
    scrub.max = Math.max(.1, duration || 1);
    scrub.value = 0;
    if (theatreScrub) { theatreScrub.max = scrub.max; theatreScrub.value = 0; }
    button.hidden = true; panel.hidden = false; setReviewing(true);
    video.src = url;
    activeSource = source;
    if (source === 'latest') { latestBlob = blob; latestDuration = +scrub.max; latestBtn?.setAttribute('aria-pressed', 'true'); }
    else latestBtn?.setAttribute('aria-pressed', 'false');
    syncDrop(); syncTime();
    const token = prepareVideo();
    if (autoplay) token.then(ok => { if (ok && video.src === url) video.play().catch(() => {}); });
    else { video.pause(); syncPlayIcon(); }
  }
  // MediaRecorder WebM has no duration/cues (duration = Infinity), so seeking, the scrub bar and theatre
  // rew/ff misbehave and Safari/Chrome can stall. Force the browser to index the clip once, then rewind.
  let prepId = 0;
  function prepareVideo() {
    const id = ++prepId;
    video.preload = 'auto';
    video.playsInline = true; video.setAttribute('playsinline', ''); video.muted = true;
    return new Promise(resolve => {
      const done = ok => { video.removeEventListener('error', fail); resolve(ok && id === prepId); };
      const fail = () => done(false);
      video.addEventListener('error', fail, { once: true });
      const ready = () => {
        if (id !== prepId) return done(false);
        const settle = () => {
          start0 = video.seekable?.length ? video.seekable.start(0) : 0;
          if (!Number.isFinite(start0) || start0 < 0) start0 = 0;
          const end = Number.isFinite(video.duration) ? video.duration : (+scrub.max || 1);
          scrub.min = String(start0); scrub.max = String(Math.max(start0 + .1, end));
          if (theatreScrub) { theatreScrub.min = scrub.min; theatreScrub.max = scrub.max; }
          scrub.value = String(start0); video.currentTime = start0;
          const shown = () => { syncTime(); done(true); };
          if (video.readyState >= 2) shown(); else video.addEventListener('loadeddata', shown, { once: true });
        };
        if (Number.isFinite(video.duration) && video.duration > 0) return settle();
        const fixed = () => { if (Number.isFinite(video.duration)) { video.removeEventListener('durationchange', fixed); video.removeEventListener('timeupdate', fixed); settle(); } };
        video.addEventListener('durationchange', fixed); video.addEventListener('timeupdate', fixed);
        video.currentTime = 1e101;
      };
      if (video.readyState >= 1) ready(); else video.addEventListener('loadedmetadata', ready, { once: true });
    });
  }

  function start() {
    if (!supported) return;
    clear();
    const clip = capture = { chunks: [], discard: false };
    try {
      stream = canvas.captureStream(REC.fps);
      recorder = new MediaRecorder(stream, { videoBitsPerSecond: REC.bps, ...(recMime ? { mimeType: recMime } : {}) });
      const recording = recorder;
      recording.ondataavailable = event => { if (!clip.discard && event.data.size) clip.chunks.push(event.data); };
      recording.onstop = () => {
        if (disposed || clip.discard || clip !== capture || !clip.chunks.length) return;
        const mime = mimeGuess(clip.chunks, recording);
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(new Blob(clip.chunks, { type: mime }));
        clip.chunks.length = 0;
        scrub.max = clip.duration;
        latestBlob = null; // alert path uses url
        button.hidden = false;
        expiry = setTimeout(clear, 15000);
      };
      started = performance.now();
      recording.start();
      limit = setTimeout(finish, 20000);
    } catch { clear(); }
  }
  function finish() {
    if (!recorder) return;
    capture.duration = Math.max(.1, (performance.now() - started) / 1000);
    stopClip();
  }
  function finalizeCurrentBlock(force = false) {
    if (!rolling?.chunks?.length && !force) return;
    const blobs = (rolling?.chunks || []).map(c => c.blob).filter(b => b?.size);
    if (!blobs.length) { if (rolling) rolling.chunks = []; return; }
    const started = rolling.blockStarted || rolling.startedAt || performance.now();
    ring.push({ blobs, started, ended: performance.now(), mime: blobs[0].type || 'video/webm' });
    if (rolling) { rolling.chunks = []; rolling.blockStarted = performance.now(); }
  }
  function stopRolling() {
    if (!rolling) return;
    try { if (rolling.recorder.state === 'recording' || rolling.recorder.state === 'paused') rolling.recorder.stop(); } catch {}
    rolling.stream?.getTracks().forEach(t => t.stop());
    rolling = null;
  }
  function armRolling() {
    if (!supported || rolling) return;
    try {
      // Phone-friendly: 15 fps, modest bitrate. Blocks roll every 30s; ring keeps at most 2.
      const stream = canvas.captureStream(REC.fps);
      const recorder = new MediaRecorder(stream, { videoBitsPerSecond: REC.bps, ...(recMime ? { mimeType: recMime } : {}) });
      const startedAt = performance.now();
      rolling = { recorder, stream, chunks: [], startedAt, blockStarted: startedAt, capturePaused: false, first: null, init: null, head: [] };
      recorder.ondataavailable = event => {
        if (!event.data?.size || !rolling) return;
        // Only the very first chunk carries the WebM/MP4 header. Keep a copy of just the header so clips still
        // decode after the ring drops the first block (this was the black-screen replay bug).
        // Chrome can split the header over the first couple of chunks (the first is often 1 byte), so collect
        // leading chunks until the first media cluster/fragment shows up.
        if (!rolling.first) rolling.first = event.data;
        if (!rolling.init && rolling.head.length < 8) {
          const r = rolling; r.head.push(event.data);
          initSegment(new Blob(r.head, { type: event.data.type }), true).then(init => { if (init && !r.init) r.init = init; });
        }
        rolling.chunks.push({ t: performance.now(), blob: event.data });
        if (!ring.frozen && performance.now() - rolling.blockStarted >= ring.blockMs) finalizeCurrentBlock();
      };
      recorder.start(1000);
    } catch { rolling = null; }
  }
  function setCaptureActive(active) {
    if (!rolling?.recorder) return;
    try {
      if (!active && rolling.recorder.state === 'recording' && rolling.recorder.pause) {
        rolling.recorder.pause(); rolling.capturePaused = true;
      } else if (active && rolling.capturePaused && rolling.recorder.state === 'paused' && rolling.recorder.resume) {
        rolling.recorder.resume(); rolling.capturePaused = false;
      }
    } catch {}
  }
  async function initSegment(blob, strict = false) {
    try {
      const bytes = new Uint8Array(await blob.slice(0, Math.min(blob.size, 1 << 20)).arrayBuffer());
      for (let i = 4; i < bytes.length - 4; i++) {
        // WebM: first Cluster element (1F 43 B6 75). MP4: first 'moof' box (size field starts 4 bytes earlier).
        if (bytes[i] === 0x1F && bytes[i + 1] === 0x43 && bytes[i + 2] === 0xB6 && bytes[i + 3] === 0x75) return blob.slice(0, i, blob.type);
        if (bytes[i] === 0x6D && bytes[i + 1] === 0x6F && bytes[i + 2] === 0x6F && bytes[i + 3] === 0x66) return blob.slice(0, i - 4, blob.type);
      }
      if (!strict) return blob; // header-only chunk: it is the init segment
    } catch {}
    return null;
  }
  function assembleFrozenBlob() {
    finalizeCurrentBlock(true);
    const blocks = ring.snapshot();
    const blobs = blocks.flatMap(b => b.blobs);
    if (!blobs.length) return null;
    const type = blobs[0].type || recMime || 'video/webm';
    if (rolling?.first && blobs[0] !== rolling.first) {
      if (!rolling.init) return null; // header not parsed yet: never hand the player a headless clip
      blobs.unshift(rolling.init);
    }
    return new Blob(blobs, { type });
  }

  async function refreshLibrary() {
    if (!listEl) return;
    let clips = [];
    try { clips = await listReplays(); } catch { clips = []; }
    listEl.replaceChildren();
    for (const clip of clips) {
      const row = document.createElement('button');
      row.type = 'button'; row.className = 'ride-replay-item';
      row.setAttribute('aria-pressed', String(activeSaved?.id === clip.id));
      row.innerHTML = `<img class="ride-replay-thumb" alt="" src="${clip.thumb || ''}"><span class="ride-replay-meta"><strong>${clip.title || 'Saved run'}</strong><small>${clip.dateLabel || ''} · ${fmt(clip.duration)} · ${clip.bike || 'Bike'}</small></span><button type="button" class="ride-replay-del" data-del="${clip.id}" aria-label="Delete replay">🗑</button>`;
      row.onclick = e => {
        if (e.target.closest('[data-del]')) return;
        activeSaved = clip; activeSource = 'saved';
        latestBtn?.setAttribute('aria-pressed', 'false');
        present(clip.blob, clip.duration, { autoplay: true, source: 'saved' });
        refreshLibrary();
      };
      row.querySelector('[data-del]')?.addEventListener('click', async e => {
        e.stopPropagation();
        await deleteReplay(clip.id);
        if (activeSaved?.id === clip.id) {
          activeSaved = null;
          selectLatest(false);
        }
        refreshLibrary();
      });
      listEl.append(row);
    }
  }

  function selectLatest(autoplay) {
    activeSaved = null; activeSource = 'latest';
    latestBtn?.setAttribute('aria-pressed', 'true');
    const blob = latestBlob || (url ? null : null);
    if (latestBlob) present(latestBlob, latestDuration, { autoplay, source: 'latest' });
    else if (url) {
      video.src = url; scrub.value = 0; syncDrop();
      if (autoplay) video.play().catch(() => {});
    }
    refreshLibrary();
  }

  function openFromPause() {
    openedFromPause = true;
    clearTimeout(expiry);
    setCaptureActive(false);
    latestState = buffer.at(1);
    const duration = Math.max(.1, buffer.duration || 1);
    latestDuration = duration;
    const finishOpen = (blob) => {
      panel.hidden = false; setReviewing(true); exitTheatre(false);
      if (blob && blob.size) present(blob, duration, { autoplay: false, source: 'latest' });
      else {
        scrub.max = duration; scrub.value = scrub.max; syncTime(); syncDrop(); syncPlayIcon();
      }
      refreshLibrary();
    };
    try { rolling?.recorder?.requestData?.(); } catch {}
    setTimeout(() => { ring.freeze(); finishOpen(assembleFrozenBlob()); }, 140);
  }

  function recordStep(s, dt, meta) { if (dt > 0) buffer.push(s, dt, meta); }

  // The video can hold more than the 20s state buffer; map the playhead onto the buffer's tail.
  function dropFraction() {
    const end = +scrub.max || 0, at = +scrub.value || 0, span = Math.max(.1, buffer.duration || end - start0 || 1);
    if (end <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - (end - at) / span));
  }
  function dropIn() {
    if (!canDropIn()) return null;
    const frame = activeSource === 'latest'
      ? buffer.at(dropFraction())
      : activeSaved?.state;
    if (!frame) return null;
    panel.classList.add('is-dropping');
    const run = () => {
      hooks.onDropIn?.(frame);
      clear();
    };
    setTimeout(run, 340);
    return { frame };
  }

  async function currentVideoBlob() {
    if (latestBlob) return latestBlob;
    if (url) try { return await fetch(url).then(r => r.blob()); } catch { return null; }
    return null;
  }
  function flashBtn(btn, ok = 'Saved') {
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = ok;
    setTimeout(() => { btn.textContent = prev; }, 900);
  }
  async function saveFrameToGallery() {
    try {
      const c = document.createElement('canvas');
      c.width = video.videoWidth || 1280; c.height = video.videoHeight || 720;
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      const blob = await new Promise(res => c.toBlob(res, 'image/png'));
      if (!blob) return;
      const meta = hooks.getMeta?.() || {};
      const thumb = c.toDataURL('image/jpeg', 0.72);
      await addGalleryItem({ type: 'image', blob, thumb, title: 'Screenshot', bike: meta.bike || 'Bike' });
      flashBtn(shotGalleryBtn);
      refreshGallery?.();
    } catch {}
  }
  async function saveVideoToGallery() {
    const blob = await currentVideoBlob();
    if (!blob) return;
    const meta = hooks.getMeta?.() || {};
    const duration = Math.max(.1, (Number.isFinite(video.duration) ? video.duration : +scrub.max || latestDuration || 1) - start0);
    const thumb = thumbFromVideo(video);
    await saveReplay({
      blob, thumb,
      title: meta.title || 'Saved run',
      bike: meta.bike || 'Bike',
      duration,
      state: latestState || buffer.at(1) || null,
    });
    flashBtn(saveGalleryBtn);
    await refreshLibrary();
    refreshGallery?.();
  }
  async function saveVideoToDevice() {
    const blob = await currentVideoBlob();
    if (!blob) return;
    const mime = blob.type || 'video/webm';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = mime.includes('mp4') ? 'wheelie-king.mp4' : 'wheelie-king.webm';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2500);
    try {
      const file = new File([blob], a.download, { type: mime });
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Wheelie King replay' });
    } catch {}
    flashBtn(saveDeviceBtn, 'Sent');
  }

  function enterTheatre() {
    panel.classList.add('is-theatre');
    overlayPlay && (overlayPlay.hidden = true);
    video.play().catch(() => {});
    syncPlayIcon(); syncTime(); syncDrop();
  }
  function exitTheatre(resumeList = true) {
    panel.classList.remove('is-theatre');
    syncPlayIcon();
  }

  // Wire controls
  button.onclick = () => {
    clearTimeout(expiry); button.hidden = true; panel.hidden = false; setReviewing(true);
    scrub.value = 0; if (url && video.src !== url) { video.src = url; prepareVideo().then(ok => ok && video.play().catch(() => {})); } else video.play().catch(() => {});
    syncPlayIcon(); refreshLibrary();
  };
  scrub.oninput = () => { video.currentTime = +scrub.value; if (theatreScrub) theatreScrub.value = scrub.value; syncPlayIcon(); syncTime(); };
  theatreScrub?.addEventListener('input', () => { scrub.value = theatreScrub.value; video.currentTime = +theatreScrub.value; syncTime(); });
  video.ontimeupdate = () => { scrub.value = video.currentTime; syncTime(); };
  video.onplay = () => syncPlayIcon();
  video.onpause = () => syncPlayIcon();
  playBtn?.addEventListener('click', () => { if (video.paused) video.play().catch(() => {}); else video.pause(); });
  overlayPlay?.addEventListener('click', () => enterTheatre());
  panel.querySelector('[data-r="theatre-play"]')?.addEventListener('click', () => { if (video.paused) video.play().catch(() => {}); else video.pause(); });
  panel.querySelector('[data-r="theatre-rew"]')?.addEventListener('click', () => { video.currentTime = Math.max(start0, video.currentTime - 5); syncTime(); });
  panel.querySelector('[data-r="theatre-ff"]')?.addEventListener('click', () => { video.currentTime = Math.min(+scrub.max || video.duration || 0, video.currentTime + 5); syncTime(); });
  panel.querySelector('[data-r="theatre-close"]')?.addEventListener('click', () => exitTheatre());
  panel.querySelector('[data-r="theatre-drop"]')?.addEventListener('click', () => dropIn());
  dropBtn?.addEventListener('click', () => dropIn());
  shotGalleryBtn?.addEventListener('click', () => saveFrameToGallery());
  saveGalleryBtn?.addEventListener('click', () => saveVideoToGallery());
  saveDeviceBtn?.addEventListener('click', () => saveVideoToDevice());
  latestBtn?.addEventListener('click', () => selectLatest(true));
  const closeBtn = panel.querySelector('[data-r="replay-close"]');
  if (closeBtn) closeBtn.onclick = () => { const fromPause = openedFromPause; clear(); if (fromPause) hooks.onClose?.(); };


  const galleryPanel = ui.querySelector('.ride-gallery');
  const galleryGrid = ui.querySelector('[data-r="gallery-grid"]');
  const galleryEmpty = ui.querySelector('[data-r="gallery-empty"]');
  async function refreshGallery() {
    if (!galleryGrid) return;
    const items = await listGallery();
    galleryGrid.replaceChildren();
    if (galleryEmpty) galleryEmpty.hidden = items.length > 0;
    for (const item of items) {
      const card = document.createElement('article');
      card.className = 'ride-gallery-card';
      card.innerHTML = `<div class="ride-gallery-thumb-wrap"><img alt="" src="${item.thumb || ''}"><span class="ride-gallery-badge">${item.type === 'image' ? 'PHOTO' : 'VIDEO'}</span></div>
        <div class="ride-gallery-card-meta"><strong>${item.title || ''}</strong><small>${item.dateLabel || ''} · ${item.bike || ''}</small></div>
        <div class="ride-gallery-card-actions">
          <button type="button" data-open="${item.id}">Open</button>
          <button type="button" data-export="${item.id}">Save to Device</button>
          <button type="button" data-del="${item.id}" class="ride-gallery-del">Delete</button>
        </div>`;
      card.querySelector('[data-open]')?.addEventListener('click', async () => {
        if (item.type === 'video') {
          galleryPanel.hidden = true;
          activeSaved = item; activeSource = 'saved';
          present(item.blob, item.duration || 1, { autoplay: true, source: 'saved' });
          refreshLibrary();
        } else {
          const w = window.open('');
          if (w) { w.document.write(`<img src="${URL.createObjectURL(item.blob)}" style="max-width:100%">`); }
        }
      });
      card.querySelector('[data-export]')?.addEventListener('click', () => exportGalleryItem(item.id));
      card.querySelector('[data-del]')?.addEventListener('click', async () => { await removeGalleryItem(item.id); refreshGallery(); refreshLibrary(); });
      galleryGrid.append(card);
    }
  }
  function openGallery() {
    if (!galleryPanel) return;
    panel.hidden = true;
    galleryPanel.hidden = false;
    setReviewing(true);
    refreshGallery();
  }
  ui.querySelector('[data-r="gallery-close"]')?.addEventListener('click', () => {
    if (!galleryPanel) return;
    galleryPanel.hidden = true;
    setReviewing(false);
    hooks.onClose?.();
  });

  armRolling();

  return {
    start, finish, clear,
    dispose() { disposed = true; clear(); stopRolling(); rolling = null; ring.clear(); buffer.clear(); },
    buffer, recordStep, openFromPause, dropIn, restoreRideState, armRolling, setCaptureActive, ring, openGallery, refreshGallery,
    // test helpers
    _debug: () => ({ blocks: ring.snapshot().map(b => b.blobs.map(x => x.size)), first: rolling?.first?.size || 0, init: rolling?.init?.size || 0, mime: recMime, state: rolling?.recorder?.state, src: video.currentSrc, err: video.error?.message || '' }),
    _saveToLibrary: saveVideoToGallery, _refreshLibrary: refreshLibrary, _enterTheatre: enterTheatre, _saveFrame: saveFrameToGallery,
  };
}
