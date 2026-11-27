import cv2, numpy as np
from PIL import Image
rng=np.random.default_rng(3)
st=cv2.imread("input/estilo.jpg"); ch=cv2.imread("input/personaje.jpg")
H,W=st.shape[:2]
# --- recortar personaje con GrabCut
h,w=ch.shape[:2]
mask=np.full((h,w),cv2.GC_PR_BGD,np.uint8)
mask[:8,:]=cv2.GC_BGD; mask[:,:8]=cv2.GC_BGD
mask[int(h*.08):int(h*.97),int(w*.25):int(w*.8)]=cv2.GC_PR_FGD
mask[int(h*.3):int(h*.9),int(w*.35):int(w*.65)]=cv2.GC_FGD
mask[int(h*.55):,:int(w*.2)]=cv2.GC_PR_FGD
mask[int(h*.38):int(h*.88),int(w*.83):]=cv2.GC_BGD
mask[int(h*.45):int(h*.7),:int(w*.12)]=cv2.GC_BGD
mask[int(h*.52):int(h*.62),int(w*.12):int(w*.2)]=cv2.GC_BGD
cv2.grabCut(ch,mask,None,np.zeros((1,65)),np.zeros((1,65)),6,cv2.GC_INIT_WITH_MASK)
fg=np.where((mask==1)|(mask==3),255,0).astype(np.uint8)
fg=cv2.morphologyEx(fg,cv2.MORPH_CLOSE,np.ones((15,15),np.uint8))
ff=fg.copy(); pad=cv2.copyMakeBorder(ff,1,1,1,1,cv2.BORDER_CONSTANT,value=0)
fm=np.zeros((h+4,w+4),np.uint8); cv2.floodFill(pad,fm,(0,0),255)
holes=cv2.bitwise_not(pad[1:-1,1:-1]); fg=cv2.bitwise_or(fg,holes)
# cabeza: envolvente convexa solo en la zona del pelo
r=int(h*.14); top=(fg[:r]>127).astype(np.uint8)
n,lab,stt,_=cv2.connectedComponentsWithStats(top)
if n>1:
    k=1+np.argmax(stt[1:,cv2.CC_STAT_AREA]); pts=cv2.findNonZero((lab==k).astype(np.uint8))
    hull=cv2.convexHull(pts); tm=np.zeros_like(top); cv2.fillConvexPoly(tm,hull,1)
    fg[:r]=np.maximum(fg[:r],tm*255)
fg=cv2.GaussianBlur(fg,(5,5),0)
# --- estilo tinta: gris -> alto contraste, tono marfil
g=cv2.cvtColor(ch,cv2.COLOR_BGR2GRAY).astype(np.float32)
g=cv2.GaussianBlur(g,(0,0),1)
ink=np.clip((g-90)*2.2,0,255)
ivory=np.array([225,232,240],np.float32)  # BGR marfil
rgb=(ink[...,None]/255)*ivory
rgb+=rng.normal(0,10,rgb.shape)
# escala del personaje
th=int(H*0.82); sc=th/h; tw=int(w*sc)
rgb=cv2.resize(np.clip(rgb,0,255).astype(np.uint8),(tw,th))
a=cv2.resize(fg,(tw,th))
# --- separar manos
SHIFT=130
gs=cv2.cvtColor(st,cv2.COLOR_BGR2GRAY)
hm=cv2.dilate((gs>110).astype(np.uint8),np.ones((9,9),np.uint8))
hm=cv2.morphologyEx(hm,cv2.MORPH_CLOSE,np.ones((25,25),np.uint8))
n,lab,stats,_=cv2.connectedComponentsWithStats(hm)
hands_m=np.zeros_like(hm)
for i in range(1,n):
    if stats[i,cv2.CC_STAT_AREA]>3000: hands_m[lab==i]=1
hands_m=cv2.dilate(hands_m,np.ones((15,15),np.uint8))
dark=np.full_like(st,9); dark=(dark+rng.normal(0,3,st.shape)).clip(0,255).astype(np.uint8)
base=np.where(hands_m[...,None]>0,dark,st)
new=base.copy()
for side in (0,1):
    m=hands_m.copy(); m[:, (W//2 if side==0 else 0):(W if side==0 else W//2)]=0
    d=-SHIFT if side==0 else SHIFT
    M=np.float32([[1,0,d],[0,1,0]])
    sh=cv2.warpAffine(st,M,(W,H)); sm=cv2.warpAffine(m,M,(W,H))
    new=np.where(sm[...,None]>0,sh,new)
st=new
# --- fondo: estilo original, limpiando el centro
bg=st.astype(np.float32)
# zona de brillo rojo en el centro
yy,xx=np.mgrid[0:H,0:W]
cx,cy=W//2,H//2
glow=np.exp(-(((xx-cx)/260)**2+((yy-cy)/300)**2))
bg[...,2]+=glow*90
# poner personaje centrado

bx=np.where(a.max(0)>128)[0]; x0=cx-(bx[0]+bx[-1])//2; y0=H-th
canvas=bg.copy()
for _ in range(45):
    x,y=int(rng.integers(0,W)),int(rng.integers(0,H)); r=int(rng.integers(2,8))
    cv2.circle(canvas,(x,y),r,(20,20,150),-1)
fade=np.ones((th,tw),np.float32)
ys=np.linspace(1,0,int(th*.18)); fade[-len(ys):]*=ys[:,None]
xs=np.linspace(0,1,60); fade[:,:60]*=xs[None]; fade[:,-60:]*=xs[::-1][None]
al=((a/255.0)*fade)[...,None]
xs0=max(x0,0); xe=min(x0+tw,W)
sub=canvas[y0:H,xs0:xe]
src=rgb[:, xs0-x0:xe-x0].astype(np.float32); aa=al[:, xs0-x0:xe-x0]
# halo rojo detrás
halo=cv2.GaussianBlur((al[...,0]*255).astype(np.uint8),(0,0),25).astype(np.float32)/255
canvas[y0:H,xs0:xe,2]+=halo[:, xs0-x0:xe-x0]*70
sub=canvas[y0:H,xs0:xe]
canvas[y0:H,xs0:xe]=sub*(1-aa)+src*aa
# salpicaduras rojas extra + grano
canvas+=rng.normal(0,6,canvas.shape)
cv2.imwrite("output/casca_manos.png",np.clip(canvas,0,255).astype(np.uint8))
