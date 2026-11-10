# Concept sheet for the garage "art is the room" proposal. Shots come from proto.mjs in /workspace/wk-garage-art.
from PIL import Image,ImageDraw,ImageFont
F='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';Fr='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=lambda s,b=True:ImageFont.truetype(F if b else Fr,s)
D='/workspace/wk-garage-art/'
W=1600;PW,PH=784,504;G=12
panels=[('/workspace/wheelie-king-repo/icons/showroom-background.webp','1. Your picture (showroom-background)'),
 (D+'current-default.png','2. The garage now'),
 (D+'proposed-default.png','3. Proposed, game camera: your white brick, pendants, cabinets, floor glow'),
 (D+'proposed-art-viewpoint.png',"4. Proposed, from your picture's viewpoint: your picture, in 3D"),
 (D+'proposed-orbit-left.png','5. Proposed, orbit left: modelled steel shelving and storage where yours stand'),
 (D+'proposed-orbit-right.png','6. Proposed, orbit right: modelled chests, cabinets and locker; room continues'),
 (D+'proposed-move-item.png','7. Moving an existing item still works (shelf dragged with the normal tools)')]
rows=(len(panels)+1)//2
S=Image.new('RGB',(W,96+rows*(PH+46)+78),'#0d0c14');d=ImageDraw.Draw(S)
d.text((G+4,14),'Wheelie King garage: "Art is the room" (concept)',font=f(30),fill='#e9e4ff')
d.text((G+4,56),'Your showroom picture becomes the walls, ceiling and floor. Only the pixels behind a modelled prop are patched, using your own brick and floor.',font=f(15,False),fill='#a9a3c9')
for i,(p,t) in enumerate(panels):
  x=G if i%2==0 else W-PW-G;y=96+(i//2)*(PH+46)
  if i==6: x=(W-PW)//2-W//4 if False else G
  im=Image.open(p).convert('RGB');r=min(PW/im.width,PH/im.height);im=im.resize((int(im.width*r),int(im.height*r)),Image.LANCZOS)
  S.paste(im,(x+(PW-im.width)//2,y+30));d.text((x+2,y+4),t,font=f(16),fill='#7fe6ff')
# notes beside panel 7
x=W-PW-G;y=96+3*(PH+46)+40
notes=['Kept unchanged:','- moving and arranging items (gizmo, rotate, delete, save)','- your existing shelf, toolbox and all furniture','- garage saves (same layout key)','- zoom and camera limits','- the bike display','',
 'Changed (room look only):','- your picture is the room, projected from its own camera','- props in the picture are modelled from the kit:','  tool chests, cabinet run with wood top, tall locker,','  wall shelf, steel shelving, storage boxes, plants','- orbiting shows the room continuing in white brick','- floor fades to matching concrete away from the picture view','- lights match your picture: warm pendants, purple and cyan glow']
for k,t in enumerate(notes):
  d.text((x+8,y+k*26),t,font=f(16 if t.endswith(':') else 15,t.endswith(':')),fill='#7fe6ff' if t.endswith(':') else '#c9c3e9')
y=96+rows*(PH+46)+4
d.text((G+4,y),'Prototype only (module swap in a test browser). No game files changed, nothing deployed.',font=f(14,False),fill='#a9a3c9')
S=S.crop((0,0,W,y+40))
S.save('/workspace/wk-concept-garage.png');print(S.size)
