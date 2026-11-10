from PIL import Image, ImageDraw, ImageFont
F=lambda n:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',n)
f2=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
W=1000;S=Image.new('RGB',(2*W+90,2700),(14,18,22));d=ImageDraw.Draw(S)
d.text((30,20),'WHEELIE KING · PLACE MODE (concept, real game + injected prototype, not deployed)',font=F(32),fill=(140,252,169))
def put(img,x,y,w,label,sub=''):
  im=Image.open(img).convert('RGB');h=int(im.height*w/im.width);im=im.resize((w,h),Image.LANCZOS)
  d.text((x,y),label,font=F(22),fill=(230,240,235));
  if sub:d.text((x,y+28),sub,font=f2,fill=(170,200,185))
  S.paste(im,(x,y+58));d.rectangle([x-1,y+57,x+w,y+58+h],outline=(80,110,95));return y+58+h
X2=30+W+30
y=put('1-normal.png',30,75,W,'1 · Workshop, normal view','Default camera and zoom, bike on the workstand (unchanged).')
put('2-place.png',X2,75,W,'2 · Tap PLACE → place mode','Camera eases out (0.7 s) to a wide room overview; bike + workstand hidden.')
y+=30
y2=put('3-dropped.png',30,y,W,'3 · Pick an item → it drops into the middle of the room','Centre, or the nearest free spot if blocked (bike spot kept clear); ring + arrows on.')
ins=Image.open('3a-dropping.png').convert('RGB');ins=ins.resize((330,int(330*ins.height/ins.width)));S.paste(ins,(30+W-340,y+68));d.rectangle([30+W-341,y+67,30+W-10,y+68+ins.height],outline=(53,224,122),width=3);d.text((30+W-334,y+72+ins.height-26),'mid-drop',font=F(18),fill=(53,224,122))
put('4-garage-place.png',X2,y,W,'4 · Garage, place mode','Same wide overview; display bike hidden; selected toolbox with the new gizmo.')
y=y2+30
y3=put('5-phone.png',30,y,W,'5 · Phone landscape 844×390, place mode','Wide view + new chest at the centre spot with ring and arrows; bars unchanged.')
y4=put('6-exit.png',X2,y,W,'6 · ✓ Done → exit place mode','Camera eases back to the normal view and zoom; bike + workstand return; item stays.')
yy=max(y3,y4)+24
notes=['• Only while placing: wide FOV (32°→52°) and a high corner camera; zoom-out limit widened in place mode only. Normal zoom/camera untouched on exit.',
"• Bike, workstand and contact shadows hide on enter and return on ✓ Done. The bike's floor spot stays a no-drop zone so nothing lands where it comes back.",
'• New items drop ~0.75 m into the room centre; if blocked, a spiral search finds the nearest valid spot (same collision/no-clip checks), then auto-selects with ring + arrows.',
'• Edit / remove / lift / bottom bar unchanged. Garage gets the same enter/exit; the shop is not interactive so has no place mode.']
for i,t in enumerate(notes): d.text((30,yy+i*30),t,font=f2,fill=(205,225,215))
S=S.crop((0,0,S.width,yy+len(notes)*30+20));S.save('/workspace/wk-concept-place-mode.png');print(S.size)
