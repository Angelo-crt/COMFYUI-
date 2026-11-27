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
fg=cv2.GaussianBlur(fg,(5,5),0)
# --- estilo tinta: gris -> alto contraste, tono marfil
g=cv2.cvtColor(ch,cv2.COLOR_BGR2GRAY).astype(np.float32)
g=cv2.GaussianBlur(g,(0,0),1)
ink=np.clip((g-90)*2.2,0,255)
ivory=np.array([225,232,240],np.float32)  # BGR marfil
rgb=(ink[...,None]/255)*ivory
rgb+=rng.normal(0,10,rgb.shape)
# escala del personaje
th=int(H*0.92); sc=th/h; tw=int(w*sc)
rgb=cv2.resize(np.clip(rgb,0,255).astype(np.uint8),(tw,th))
a=cv2.resize(fg,(tw,th))
# --- fondo: estilo original, limpiando el centro
bg=st.astype(np.float32)
# zona de brillo rojo en el centro
yy,xx=np.mgrid[0:H,0:W]
cx,cy=W//2,H//2
glow=np.exp(-(((xx-cx)/260)**2+((yy-cy)/300)**2))
bg[...,2]+=glow*90
# poner personaje centrado

x0=cx-tw//2; y0=H-th
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
