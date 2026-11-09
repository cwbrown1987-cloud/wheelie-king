from PIL import Image,ImageDraw,ImageFont,ImageFilter
import json
F='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';Fr='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=lambda s,b=True:ImageFont.truetype(F if b else Fr,s)
W=1600;PW,PH=784,441;G=12
S=Image.new('RGB',(W,90+3*(PH+46)+40),'#0d0c14');d=ImageDraw.Draw(S)
d.text((G+4,14),'Wheelie King workshop: modular 3D prop kit (concept)',font=f(30),fill='#e9e4ff')
d.text((G+4,54),'Every prop is real modelled geometry with PBR materials. Chris\'s art stays on the walls only. Nothing is cut out of the picture. Concept, not in the game yet.',font=f(15,False),fill='#a9a3c9')
def panel(img,x,y,title,labels=None,cellLabels=False):
  im=Image.open('out/'+img).convert('RGB');sx=PW/im.width;sy=PH/im.height;im=im.resize((PW,PH),Image.LANCZOS)
  S.paste(im,(x,y+30));d.text((x+2,y+4),title,font=f(17),fill='#7fe6ff')
  if labels:
    for l in labels:
      t=l['text'];tx=x+l['x']*sx;ty=l['y']*sy+y+30
      fn=f(13);w=d.textlength(t,font=fn)
      if not l.get('cell'): tx-=w/2;ty=max(ty-26,y+38)
      d.rounded_rectangle((tx-6,ty-3,tx+w+6,ty+18),5,fill='#0a0c12d0',outline='#9cffd9')
      d.text((tx,ty),t,font=fn,fill='#9cffd9')
J=lambda n:json.load(open('out/'+n+'.json')).get('labels')
y=90
panel('parts.png',G,y,'1. Kit parts: each one is a factory with size and skin settings',J('parts.png'))
panel('chest.png',W-PW-G,y,'2. Tool chest = 1 body + 7 drawers + 4 casters',J('chest.png'))
y+=PH+46
panel('reskin.png',G,y,'3. Same parts, reskinned and resized (the trolley uses the same casters)',J('reskin.png'))
panel('front.png',W-PW-G,y,'4. Front wall from the real workshop camera (fov 32)')
y+=PH+46
panel('front-wide.png',G,y,'5. Wider look: props modelled where they sit in your art')
x=W-PW-G;ty=y+34
d.text((x,ty),'What the kit includes',font=f(17),fill='#ffb35a');ty+=28
for t in ['Parts: caster, drawer, bar/tube handle, chest body, shelf unit (rack or steel),',
 '  bin, carton, can, spray can, bottle, hard case, pegboard, wrench, screwdriver,',
 '  pliers, hammer, socket rail, bench top, vice, shop light, neon tube, screen, contact shadow.',
 'Props built from them: tool chest, top chest, trolley, stocked shelving, workbench, tool wall.',
 'Reskin any slot: body / drawer / handle / wheel / fork / tray, as a colour, preset or material.',
 'New props: kit.register(name, factory) or kit.compose({parts:[...]}). No code changes elsewhere.',
 'Performance: parts share geometry and materials; kit.bake() merges a whole room into one',
 '  mesh per material. Back-wall props: 35 draw calls now, aiming for 15–25 by sharing colours.',
 'Walls: your art is projected onto the back walls and ceiling. Where a prop stood in the picture,',
 '  a premade mask swaps in relit brick, so there is never a painted copy behind a 3D prop.',
 'Floor: clean concrete with a live, blurred reflection (quarter resolution on phones).',
 'No interactions on the parts yet. Placement and collision come next, as planned.']:
  d.text((x,ty),t,font=f(13,False),fill='#d6d2ee');ty+=22
d.text((G+4,S.height-34),'Still rough here: the pegboard tools read small from far back, the tall chest\'s dark side needs a fill light, and the hoses on the right wall are still painted in the art.',font=f(13,False),fill='#8f89b3')
S.save('/workspace/wk-concept-kit.png');print(S.size)
