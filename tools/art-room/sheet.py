# Concept sheet for the art-room proposal. Run from /workspace/wk-art-room (proto shots live there).
from PIL import Image,ImageDraw,ImageFont
F='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';Fr='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=lambda s,b=True:ImageFont.truetype(F if b else Fr,s)
W=1600;PW,PH=784,504;G=12
panels=[('/workspace/wheelie-king-repo/icons/neon-garage-background.png','1. Your original picture (neon-garage-background)'),
 ('/workspace/wk-wsp-default.png','2. Now (v22 beta): the mask swapped your art for plain brick'),
 ('proposed-default.png','3. Proposed, game camera + bike: your walls, pegboard, tubes, glow'),
 ('proposed-projector.png',"4. Proposed, from your picture's viewpoint: your art, in 3D"),
 ('proposed-orbit-left.png','5. Proposed, orbit left: modelled chests where yours stand'),
 ('proposed-orbit-right.png','6. Proposed, orbit right: room continues in your neon style')]
rows=(len(panels)+1)//2
S=Image.new('RGB',(W,96+rows*(PH+46)+78),'#0d0c14');d=ImageDraw.Draw(S)
d.text((G+4,14),'Wheelie King workshop: "It needs to be the room" (concept)',font=f(30),fill='#e9e4ff')
d.text((G+4,56),'Your picture stays on the walls, ceiling and floor. Only the exact pixels hidden behind a modelled prop are patched, using your own brick and floor.',font=f(15,False),fill='#a9a3c9')
for i,(p,t) in enumerate(panels):
  x=G if i%2==0 else W-PW-G;y=96+(i//2)*(PH+46)
  im=Image.open(p).convert('RGB');r=min(PW/im.width,PH/im.height);im=im.resize((int(im.width*r),int(im.height*r)),Image.LANCZOS)
  S.paste(im,(x+(PW-im.width)//2,y+30));d.text((x+2,y+4),t,font=f(16),fill='#7fe6ff')
y=96+rows*(PH+46)+4
for k,t in enumerate(['Kept: modelled kit props, placement, collision, saves, the original zoom (0.12 to 4.2), and no turntable. Props stay modelled, never cut-outs.',
  'Changed: no brick mask. Flat wall details (pegboard, blueprint screen, tubes, fuse box, pipes, vines) come straight from your art. Lights and fog use your pink, purple, cyan and warm tones.']):
  d.text((G+4,y+k*24),t,font=f(14,False),fill='#c9c3e9')
S.save('/workspace/wk-concept-art-room.png');print(S.size)
