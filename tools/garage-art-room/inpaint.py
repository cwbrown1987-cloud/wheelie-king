# Build garage-art.jpg: Chris's showroom picture with ONLY the pixels behind modelled props in-painted
# from his own picture (low-frequency light from the surroundings x his brick / floor detail).
# Input sil.raw from `node proto.mjs mask` (modelled props rendered from the picture's camera).
# Solid props (chests, cabinets, locker, boxes) are filled column-wise between their top and bottom;
# open / leafy ones (shelving frame, ivy) use their exact silhouette only.
import numpy as np,cv2,sys
D=sys.argv[1] if len(sys.argv)>1 else '/workspace/wk-garage-art';OUT=sys.argv[2] if len(sys.argv)>2 else 'garage-art.jpg'
W,H=1672,941
sil=np.frombuffer(open(D+'/sil.raw','rb').read(),np.uint8).reshape(H,W)[::-1].copy()
art=cv2.imread('/workspace/wheelie-king-repo/icons/showroom-background.webp').astype(np.float32)
s0=(sil>128).astype(np.uint8)*255;m=s0.copy()
u=np.arange(W)[None,:].repeat(H,0);v=np.arange(H)[:,None].repeat(W,1)
base=np.where(u<430,472+.174*(430-u),np.where(u>1333,472+.142*(u-1333),472))
n,lab,st,_=cv2.connectedComponentsWithStats(s0,connectivity=8)
for i in range(1,n):
  x,y,w,h,a=st[i]
  if a<1500 or a/(w*h)<.45: continue      # leafy / open props: exact silhouette only
  cm=(lab==i)
  for c in range(x,x+w):                  # solid props: fill each column between its top and bottom
    col=np.where(cm[:,c])[0]
    if len(col): m[col[0]:col[-1]+16,c]=255   # +16 px: painted feet/casters below the modelled ones
m=cv2.dilate(m,np.ones((5,5),np.uint8))
wall=v<base+4
s=8;sm=cv2.resize(art,(W//s,H//s),interpolation=cv2.INTER_AREA);mm=cv2.dilate(cv2.resize(m,(W//s,H//s),interpolation=cv2.INTER_NEAREST),np.ones((3,3),np.uint8))
low=cv2.GaussianBlur(cv2.resize(cv2.inpaint(sm.astype(np.uint8),mm,6,cv2.INPAINT_TELEA).astype(np.float32),(W,H),interpolation=cv2.INTER_CUBIC),(0,0),6)
def tile(P):d=P/np.maximum(cv2.GaussianBlur(P,(0,0),14),1);h,w=d.shape[:2];return np.tile(d,(H//h+2,W//w+2,1))[:H,:W]
fill=low*np.where(wall[...,None],tile(art[250:440,700:960]),tile(art[600:760,500:800]))
fine=cv2.inpaint(art.astype(np.uint8),m,4,cv2.INPAINT_TELEA).astype(np.float32);k=np.clip(cv2.distanceTransform(m,cv2.DIST_L2,5)/6,0,1)[...,None]
out=np.where(m[...,None]>0,fine*(1-k)+fill*k,art)
cv2.imwrite(OUT,np.clip(out,0,255).astype(np.uint8),[cv2.IMWRITE_JPEG_QUALITY,90]);print('patched',round((m>0).mean(),3))
cv2.imwrite(D+'/garage-art-preview.jpg',cv2.resize(np.clip(out,0,255).astype(np.uint8),(1254,706)))
