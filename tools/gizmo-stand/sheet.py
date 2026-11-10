# Concept sheet: 3D move/rotate gizmo + raised workstand. Shots from proto.mjs in /workspace/wk-gizmo.
from PIL import Image,ImageDraw,ImageFont
F='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';Fr='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=lambda s,b=True:ImageFont.truetype(F if b else Fr,s)
D='/workspace/wk-gizmo/';W=1600;PW,PH=784,504;G=12
panels=[('/workspace/wk-v23-place-valid.png','1. Now: flat 2D buttons (rotate, lift) over the object'),
 (D+'workshop-gizmo-default.png','2. Workshop, zoomed out: ring + curved rotate arrows + 3D move arrows'),
 (D+'workshop-gizmo-close.png','3. Workshop, close camera: arrows sit on the floor round the base'),
 (D+'workshop-phone-gizmo-close.png','4. Phone landscape (844x390), workshop'),
 (D+'garage-gizmo-default.png','5. Garage, default camera: same controls on the toolbox'),
 (D+'garage-gizmo-close.png','6. Garage, close camera'),
 (D+'garage-phone-gizmo-default.png','7. Phone landscape, garage'),
 (D+'workshop-stand-default.png','8. Workshop default camera: bike on a raised repair workstand')]
rows=(len(panels)+1)//2
S=Image.new('RGB',(W,96+rows*(PH+46)+90),'#0d0c14');d=ImageDraw.Draw(S)
d.text((G+4,14),'Wheelie King: 3D move / rotate controls + bike workstand (concept)',font=f(30),fill='#e9e4ff')
d.text((G+4,56),'Drag a curved blue arrow to rotate, drag a green arrow (or the object) to move. Edit / remove / lift buttons and the bottom bar stay as they are.',font=f(15,False),fill='#a9a3c9')
for i,(p,t) in enumerate(panels):
  x=G if i%2==0 else W-PW-G;y=96+(i//2)*(PH+46)
  im=Image.open(p).convert('RGB');r=min(PW/im.width,PH/im.height);im=im.resize((int(im.width*r),int(im.height*r)),Image.LANCZOS)
  S.paste(im,(x+(PW-im.width)//2,y+30));d.text((x+2,y+4),t,font=f(16),fill='#7fe6ff')
y=96+rows*(PH+46)+4
for k,t in enumerate(['Gizmo: dark glass ring on the floor round the object base, two opposed curved arrows (rotate), four 3D floor arrows (move). Sized from the object, drawn in the world so it follows the camera.',
 'Workstand: tripod base, steel mast with red quick-release collar, tool tray, swivel head and clamp on the seat post. Bike raised 18 cm; camera and zoom unchanged and the bike still fits.',
 'Prototype only (injected in a test browser). No game files changed, nothing deployed.']):
  d.text((G+4,y+k*26),t,font=f(14,False),fill='#c9c3e9')
S.save('/workspace/wk-concept-gizmo-stand.png');print(S.size)
