export function mountRideReplay(ui, canvas, setReviewing) {
  const button = ui.querySelector('[data-r="replay"]');
  const panel = ui.querySelector('.ride-replay');
  const video = panel.querySelector('video');
  const save = panel.querySelector('a');
  const scrub = panel.querySelector('input');
  let recorder, stream, url, expiry, limit, started, capture, disposed = false;
  const supported = typeof MediaRecorder !== 'undefined' && !!canvas.captureStream;

  function clear() {
    clearTimeout(expiry);
    clearTimeout(limit);
    button.hidden = true;
    panel.hidden = true;
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
    stop();
  }

  function stop() {
    clearTimeout(limit);
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    recorder = stream = null;
  }

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
        const mime = recording.mimeType || clip.chunks[0].type || 'video/webm';
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
    stop();
  }

  button.onclick = () => {
    clearTimeout(expiry);
    button.hidden = true;
    panel.hidden = false;
    setReviewing(true);
    scrub.value = 0;
    save.href = video.src = url;
    video.play().catch(() => {});
  };
  scrub.oninput = () => { video.currentTime = +scrub.value; };
  video.ontimeupdate = () => { scrub.value = video.currentTime; };
  panel.querySelector('button').onclick = clear;
  return { start, finish, clear, dispose() { disposed = true; clear(); } };
}
