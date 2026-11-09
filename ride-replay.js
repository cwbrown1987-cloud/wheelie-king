import { createRideBuffer, restoreRideState } from './ride-buffer.js';

export function mountRideReplay(ui, canvas, setReviewing, hooks = {}) {
  const button = ui.querySelector('[data-r="replay"]');
  const panel = ui.querySelector('.ride-replay');
  const video = panel.querySelector('video');
  const save = panel.querySelector('[data-r="save-video"]') || panel.querySelector('a');
  const scrub = panel.querySelector('input');
  const playBtn = panel.querySelector('[data-r="replay-play"]');
  const dropBtn = panel.querySelector('[data-r="drop-in"]');
  const shotBtn = panel.querySelector('[data-r="save-shot"]');
  let recorder, stream, url, expiry, limit, started, capture, disposed = false, openedFromPause = false;
  let rolling = null; // { recorder, stream, chunks:[{t,blob}], started }
  const buffer = createRideBuffer(20);
  const supported = typeof MediaRecorder !== 'undefined' && !!canvas.captureStream;

  function clear() {
    clearTimeout(expiry);
    clearTimeout(limit);
    button.hidden = true;
    panel.hidden = true;
    openedFromPause = false;
    setReviewing(false);
    video.pause();
    video.removeAttribute('src');
    save.removeAttribute('href');
    video.load();
    if (url) URL.revokeObjectURL(url);
    url = null;
    if (capture) {
      capture.discard = true;
      capture.chunks.length = 0;
      capture = null;
    }
    stopClip();
    if (playBtn) playBtn.textContent = 'Play';
  }

  function stopClip() {
    clearTimeout(limit);
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    recorder = stream = null;
  }

  function mimeGuess(chunks, rec) {
    return rec?.mimeType || chunks[0]?.type || 'video/webm';
  }

  function present(blob, duration) {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    const mime = blob.type || 'video/webm';
    save.download = mime.includes('mp4') ? 'wheelie-king.mp4' : 'wheelie-king.webm';
    scrub.max = Math.max(.1, duration || buffer.duration || 1);
    scrub.value = 0;
    button.hidden = true;
    panel.hidden = false;
    setReviewing(true);
    save.href = video.src = url;
    video.play().catch(() => {});
    if (playBtn) playBtn.textContent = 'Pause';
  }

  // Slow-mo jump clip (existing behaviour).
  function start() {
    if (!supported) return;
    clear();
    const clip = capture = { chunks: [], discard: false };
    try {
      stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, { videoBitsPerSecond: 1800000 });
      const recording = recorder;
      recording.ondataavailable = event => {
        if (!clip.discard && event.data.size) clip.chunks.push(event.data);
      };
      recording.onstop = () => {
        if (disposed || clip.discard || clip !== capture || !clip.chunks.length) return;
        const mime = mimeGuess(clip.chunks, recording);
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(new Blob(clip.chunks, { type: mime }));
        clip.chunks.length = 0;
        save.download = mime.includes('mp4') ? 'wheelie-king.mp4' : 'wheelie-king.webm';
        scrub.max = clip.duration;
        button.hidden = false;
        expiry = setTimeout(clear, 15000);
      };
      started = performance.now();
      recording.start();
      limit = setTimeout(finish, 20000);
    } catch {
      clear();
    }
  }

  function finish() {
    if (!recorder) return;
    capture.duration = Math.max(.1, (performance.now() - started) / 1000);
    stopClip();
  }

  function stopRolling() {
    if (!rolling) return;
    try { if (rolling.recorder.state === 'recording') rolling.recorder.stop(); } catch {}
    rolling.stream?.getTracks().forEach(t => t.stop());
  }

  function armRolling() {
    if (!supported || rolling) return;
    try {
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { videoBitsPerSecond: 1400000 });
      const chunks = [];
      const startedAt = performance.now();
      recorder.ondataavailable = event => {
        if (!event.data?.size) return;
        const now = performance.now();
        chunks.push({ t: now, blob: event.data });
        const cut = now - 20000;
        while (chunks.length && chunks[0].t < cut) chunks.shift();
      };
      recorder.start(1000);
      rolling = { recorder, stream, chunks, startedAt };
    } catch {
      rolling = null;
    }
  }

  function openFromPause() {
    openedFromPause = true;
    clearTimeout(expiry);
    const duration = Math.max(.1, buffer.duration || 1);
    const finishOpen = (blob) => {
      if (!blob || !blob.size) {
        // State-only fallback: still open panel so Drop In / screenshot work.
        panel.hidden = false;
        setReviewing(true);
        scrub.max = duration;
        scrub.value = scrub.max;
        if (playBtn) playBtn.textContent = 'Play';
        return;
      }
      present(blob, duration);
      video.pause();
      video.currentTime = Math.min(duration, +scrub.max);
      scrub.value = scrub.max;
      if (playBtn) playBtn.textContent = 'Play';
    };
    if (rolling?.chunks?.length) {
      const mime = rolling.chunks[0].blob.type || 'video/webm';
      // Request a final slice then assemble.
      const chunks = rolling.chunks.map(c => c.blob);
      try {
        if (rolling.recorder.state === 'recording') {
          const once = () => {
            rolling.recorder.removeEventListener('dataavailable', once);
            finishOpen(new Blob(rolling.chunks.map(c => c.blob), { type: mime }));
          };
          rolling.recorder.addEventListener('dataavailable', once);
          rolling.recorder.requestData();
          setTimeout(() => finishOpen(new Blob(chunks, { type: mime })), 120);
          return;
        }
      } catch {}
      finishOpen(new Blob(chunks, { type: mime }));
      return;
    }
    finishOpen(null);
  }

  function recordStep(s, dt, meta) {
    if (dt > 0) buffer.push(s, dt, meta);
  }

  function dropIn() {
    const ratio = scrub.max > 0 ? (+scrub.value) / (+scrub.max) : 1;
    const frame = buffer.at(ratio);
    if (!frame) return null;
    const meta = hooks.onDropIn?.(frame) ?? null;
    clear();
    return { frame, meta };
  }

  function saveScreenshot() {
    try {
      canvas.toBlob(blob => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'wheelie-king.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'wheelie-king.png', { type: blob.type })] })) {
          // Share is optional; download already fired.
        }
      }, 'image/png');
    } catch {}
  }

  button.onclick = () => {
    clearTimeout(expiry);
    button.hidden = true;
    panel.hidden = false;
    setReviewing(true);
    scrub.value = 0;
    save.href = video.src = url;
    video.play().catch(() => {});
    if (playBtn) playBtn.textContent = 'Pause';
  };
  scrub.oninput = () => {
    video.currentTime = +scrub.value;
    if (playBtn) playBtn.textContent = 'Play';
  };
  video.ontimeupdate = () => { scrub.value = video.currentTime; };
  video.onplay = () => { if (playBtn) playBtn.textContent = 'Pause'; };
  video.onpause = () => { if (playBtn) playBtn.textContent = 'Play'; };
  playBtn?.addEventListener('click', () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });
  dropBtn?.addEventListener('click', () => dropIn());
  shotBtn?.addEventListener('click', () => saveScreenshot());
  const closeBtn = panel.querySelector('[data-r="replay-close"]')
    || [...panel.querySelectorAll('button')].find(b => /close/i.test((b.textContent || '').trim()));
  if (closeBtn) closeBtn.onclick = () => { const fromPause = openedFromPause; clear(); if (fromPause) hooks.onClose?.(); };

  armRolling();

  return {
    start, finish, clear, dispose() { disposed = true; clear(); stopRolling(); rolling = null; buffer.clear(); },
    buffer, recordStep, openFromPause, dropIn, restoreRideState, armRolling,
  };
}
