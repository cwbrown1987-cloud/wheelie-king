export function thumbFromVideo(video, canvas) {
  try {
    const w = 320, h = 180;
    const c = canvas || Object.assign(document.createElement('canvas'), { width: w, height: h });
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(video, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.72);
  } catch { return ''; }
}
export function thumbFromImageBlob(blob) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 320; c.height = 180;
      const g = c.getContext('2d');
      const scale = Math.max(320 / img.width, 180 / img.height);
      const w = img.width * scale, h = img.height * scale;
      g.drawImage(img, (320 - w) / 2, (180 - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
    img.src = url;
  });
}
