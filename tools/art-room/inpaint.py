# Build assets/workshop/art-room.jpg: Chris's art with ONLY the pixels behind modelled props
# in-painted from his own art. Input sil.raw = modelled-prop silhouettes rendered from the art's
# camera (`PROTO=0 node proto.mjs mask`). Each prop's convex hull is patched (so painted items
# don't show through gaps in modelled shelves), plus a short band above chest tops where painted
# bottles stood (clipped below the pegboard / blueprint screen). Fill = low-frequency light from the
# surrounding art x brick / floor detail sampled from his picture.
import numpy as np,cv2,sys
D=sys.argv[1] if len(sys.argv)>1 else '/workspace/wk-art-room';OUT=sys.argv[2] if len(sys.argv)>2 else '../../assets/workshop/art-room.jpg'
W,H=1672,941
sil=np.frombuffer(open(D+'/sil.raw','rb').read(),np.uint8).reshape(H,W)[::-1].copy()
art=cv2.imread('/workspace/wheelie-king-repo/icons/neon-garage-background.png').astype(np.float32)
s0=(sil>128).astype(np.uint8)*255
m=s0.copy()
n,lab,st,_=cv2.connectedComponentsWithStats(cv2.dilate(s0,np.ones((9,9),np.uint8)))
u=np.arange(W)[None,:].repeat(H,0);v=np.arange(H)[:,None].repeat(W,1)
base=np.where(u<420,615-(u-52)*(55/368),563)
for i in range(1,n):
  x,y,w,h,a=st[i]
  if a<400: continue
  cm=((lab==i)&(s0>0)).astype(np.uint8)
  pts=cv2.findNonZero(cm);hull=cv2.convexHull(pts);hm=np.zeros_like(m);cv2.fillConvexPoly(hm,hull,255)
  hm[v>=base+(24 if x>1000 else 6)]=0   # hull stops at the wall base (chests: just past it, for painted casters)
  m|=hm
  if x>1000:        # chest run: band above the tops for painted items, clipped under pegboard/screen
    top=np.full(W,H);cols=np.where(cm.any(0))[0]
    for c in cols: top[c]=np.argmax(cm[:,c]>0)
    lim=np.where(np.arange(W)<1230,352,np.where(np.arange(W)<1370,318,296))
    for c in cols:
      y0=max(top[c]-90,lim[c]);
      if y0<top[c]: m[y0:top[c],c]=255
m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
m=cv2.dilate(m,np.ones((5,5),np.uint8))
wall=v<base+4
s=8;sm=cv2.resize(art,(W//s,H//s),interpolation=cv2.INTER_AREA);mm=cv2.dilate(cv2.resize(m,(W//s,H//s),interpolation=cv2.INTER_NEAREST),np.ones((3,3),np.uint8))
low=cv2.GaussianBlur(cv2.resize(cv2.inpaint(sm.astype(np.uint8),mm,6,cv2.INPAINT_TELEA).astype(np.float32),(W,H),interpolation=cv2.INTER_CUBIC),(0,0),6)
def tile(P):d=P/np.maximum(cv2.GaussianBlur(P,(0,0),14),1);h,w=d.shape[:2];return np.tile(d,(H//h+2,W//w+2,1))[:H,:W]
fill=low*np.where(wall[...,None],tile(art[372:540,812:1018]),tile(art[640:760,560:860]))
fine=cv2.inpaint(art.astype(np.uint8),m,4,cv2.INPAINT_TELEA).astype(np.float32);k=np.clip(cv2.distanceTransform(m,cv2.DIST_L2,5)/6,0,1)[...,None]
out=np.where(m[...,None]>0,fine*(1-k)+fill*k,art)
cv2.imwrite(OUT,np.clip(out,0,255).astype(np.uint8),[cv2.IMWRITE_JPEG_QUALITY,90]);print('patched',round((m>0).mean(),3))
cv2.imwrite(D+'/art-room-preview.jpg',cv2.resize(np.clip(out,0,255).astype(np.uint8),(1254,706)))
