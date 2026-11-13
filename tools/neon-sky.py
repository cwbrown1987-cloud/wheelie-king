# Neon Canal sunset sky (v2.1-45): painted procedurally to match the reference art: deep indigo zenith,
# purple-magenta band, orange horizon glow round a low sun, and streaky clouds lit pink/orange on the sun side.
# Writes the visible 4k JPG, the 1k LDR fallback and the 1k HDR used for lighting. Sun position is read
# from the existing HDR so the in-game sun light (ride.js sunDir) still lines up.
#   python3 tools/neon-sky.py
import numpy as np, cv2, sys, os
D = os.path.join(os.path.dirname(__file__), '..', 'assets', 'hdri')
src = cv2.imread(os.path.join(D, 'neon_sunset_1k.hdr'), cv2.IMREAD_UNCHANGED)
if os.path.exists(os.path.join(os.path.dirname(__file__), 'neon-sun.txt')):
    su, sv = map(float, open(os.path.join(os.path.dirname(__file__), 'neon-sun.txt')).read().split())
else:
    lum = src.sum(2); lum = cv2.GaussianBlur(lum, (0, 0), 3)
    y, x = np.unravel_index(np.argmax(lum), lum.shape); su, sv = x / lum.shape[1], y / lum.shape[0]
    open(os.path.join(os.path.dirname(__file__), 'neon-sun.txt'), 'w').write(f'{su} {sv}')
print('sun at', su, sv)

def fbm(h, w, seed, octaves, sx, sy):
    rng = np.random.default_rng(seed); out = np.zeros((h, w), np.float32); amp, tot = 1., 0.
    for o in range(octaves):
        gh, gw = max(2, int(sy * 2 ** o)), max(2, int(sx * 2 ** o))
        g = rng.random((gh, gw + 1)).astype(np.float32); g[:, -1] = g[:, 0]  # wraps horizontally
        out += amp * cv2.resize(g, (w + w // gw, h), interpolation=cv2.INTER_CUBIC)[:, :w]; tot += amp; amp *= .5
    return out / tot

def sky(W, H, hdr):
    v = (np.arange(H) + .5) / H; u = (np.arange(W) + .5) / W
    el = (.5 - v)[:, None] * np.pi * np.ones((1, W))                     # elevation (rad)
    az = (u[None, :] - su) * 2 * np.pi * np.ones((H, 1))
    sel = (.5 - sv) * np.pi
    cosd = np.sin(el) * np.sin(sel) + np.cos(el) * np.cos(sel) * np.cos(az); ang = np.arccos(np.clip(cosd, -1, 1))
    e = np.degrees(el)
    c = lambda h: np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)
    stops = [(-90, c('#120a22')), (-4, c('#24163a')), (0, c('#ff9a52')), (1.8, c('#ff7a48')), (4.5, c('#dc4a78')), (9, c('#8e3392')),
             (17, c('#55238a')), (30, c('#33196e')), (55, c('#211452')), (90, c('#150e38'))]
    col = np.zeros((H, W, 3), np.float32)
    for (e0, c0), (e1, c1) in zip(stops, stops[1:]):
        m = (e >= e0) & (e < e1); t = ((e - e0) / (e1 - e0))[..., None]; t = t * t * (3 - 2 * t)
        col = np.where(m[..., None], c0 * (1 - t) + c1 * t, col)
    near = np.exp(-ang / .55)[..., None]; halo = np.exp(-ang / .14)[..., None]
    above = np.clip(e / 2 + .6, 0, 1)[..., None]
    col += (near * c('#ff8a3a') * .55 + halo * c('#ffd890') * .9) * above
    # clouds: long streaks in a band above the horizon
    n1 = fbm(H, W, 3, 6, 6, 18); n2 = fbm(H, W, 8, 5, 3, 40)
    band = np.clip((e - 1.5) / 3, 0, 1) * np.clip((40 - e) / 18, 0, 1)
    dens = np.clip((n1 * .65 + n2 * .35 - .43) * 3.6, 0, 1) * band
    streak = np.clip((fbm(H, W, 11, 4, 4, 90) - .5) * 4, 0, 1) * np.clip((12 - e) / 9, 0, 1) * np.clip((e - .8) / 1.5, 0, 1)
    dens = np.clip(dens + streak * .7, 0, 1)[..., None]
    sunside = np.clip(np.cos(az) * .5 + .5, 0, 1)[..., None] ** 1.5
    lit = c('#ff9a6a') * sunside + c('#c45a9a') * (1 - sunside) * .9
    rim = np.exp(-ang / .35)[..., None] * c('#ffcf88')
    shade = c('#3a1f52') * (1 - sunside) + c('#7a3260') * sunside
    edge = np.clip(dens * 2.2, 0, 1); core = np.clip(dens * 1.4 - .3, 0, 1)
    ccol = lit * edge * (1 - core) + shade * core + rim * edge * .9
    col = col * (1 - dens * .92) + ccol * dens * .92 + ccol * 0
    # the sun disc
    col += (np.exp(-(ang / .018) ** 2) * 6 if hdr else np.exp(-(ang / .02) ** 2) * 1.2)[..., None] * c('#fff1c8') * above
    if hdr:
        lin = np.power(np.clip(col, 0, None), 2.2) * 1.6
        lin += (np.exp(-(ang / .02) ** 2) * 8)[..., None] * c('#ffcf90') * above  # hot sun so it still lights
        return lin
    return np.clip(col, 0, 1)

out4 = (sky(4096, 2048, False) * 255 + .5).astype(np.uint8)
cv2.imwrite(os.path.join(D, 'neon_sunset_4k.jpg'), cv2.cvtColor(out4, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 88])
out1 = cv2.resize(out4, (1024, 512), interpolation=cv2.INTER_AREA)
cv2.imwrite(os.path.join(D, 'neon_sunset_1k_ldr.jpg'), cv2.cvtColor(out1, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 85])
h = sky(1024, 512, True).astype(np.float32); h *= .45 / h.mean()  # keep the scene lit about half as bright as the old dusk sky
print('hdr mean new', h.mean(), 'old', src.mean())
cv2.imwrite(os.path.join(D, 'neon_sunset_1k.hdr'), cv2.cvtColor(h, cv2.COLOR_RGB2BGR))
