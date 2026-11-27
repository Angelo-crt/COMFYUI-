import cv2, numpy as np
rng=np.random.default_rng(3)
S=2                                   # factor de resolución
st0=cv2.imread("input/estilo.jpg"); ch=cv2.imread("input/personaje.jpg")
h0,w0=st0.shape[:2]; W,H=w0*S,h0*S
def smooth(m,lo=90,hi=170,sig=1.6):
    m=cv2.GaussianBlur(m.astype(np.float32),(0,0),sig)
    return np.clip((m-lo)/(hi-lo),0,1)
def crisp(g,lo=70,hi=150):            # nitidez de tinta tras reescalar
    return np.clip((g-lo)/(hi-lo),0,1)
# ---------- estilo: B/N limpio (min de canales elimina el rojo original)
gray=st0.min(axis=2).astype(np.float32)
gray=cv2.resize(gray,(W,H),interpolation=cv2.INTER_LANCZOS4)
# máscara de manos
hm=(gray>110*1.0).astype(np.uint8)
hm=cv2.dilate(hm,np.ones((9*S//2,9*S//2),np.uint8))
hm=cv2.morphologyEx(hm,cv2.MORPH_CLOSE,np.ones((25*S,25*S),np.uint8))
n,lab,stt,_=cv2.connectedComponentsWithStats(hm)
hands=np.zeros_like(hm)
for i in range(1,n):
    if stt[i,cv2.CC_STAT_AREA]>3000*S*S: hands[lab==i]=1
hands=cv2.dilate(hands,np.ones((15*S//2,15*S//2),np.uint8))
SHIFT=130*S
bgcol=float(np.median(gray[(hands==0)&(gray<60)]))
base=np.where(hands>0,bgcol,gray)
out=base.copy()
for side in (0,1):
    m=hands.copy()
    if side==0: m[:,W//2:]=0
    else: m[:,:W//2]=0
    d=-SHIFT if side==0 else SHIFT
    M=np.float32([[1,0,d],[0,1,0]])
    sh=cv2.warpAffine(gray,M,(W,H),flags=cv2.INTER_LANCZOS4)
    sm=cv2.warpAffine(m.astype(np.float32),M,(W,H))
    sm=cv2.GaussianBlur(sm,(0,0),1.5)
    out=out*(1-sm)+sh*sm
# nitidez: curva de tinta sobre B/N (mantiene lluvia tenue del fondo)
hi=out>60
out=np.where(hi,255*crisp(out,90,150)*0.95,out)
canvas=np.stack([out*0.95,out*0.96,out*1.0],-1)   # (B,G,R) ligero marfil
canvas[...,2]=out*1.0; canvas[...,0]=out*0.88; canvas[...,1]=out*0.92
# ---------- personaje
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
chi=ch.astype(int); sky=((chi[...,0]-chi[...,2])>8)&(chi.mean(2)>150)
sky=cv2.morphologyEx(sky.astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
fg[sky>0]=0
fg=cv2.morphologyEx(fg,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
pad=cv2.copyMakeBorder(fg,1,1,1,1,cv2.BORDER_CONSTANT,value=0)
cv2.floodFill(pad,np.zeros((h+4,w+4),np.uint8),(0,0),255)
fg=cv2.bitwise_or(fg,cv2.bitwise_not(pad[1:-1,1:-1]))
r=int(h*.14); top=(fg[:r]>127).astype(np.uint8)
n,lab,stt,_=cv2.connectedComponentsWithStats(top)
if n>1:
    k=1+np.argmax(stt[1:,cv2.CC_STAT_AREA]); pts=cv2.findNonZero((lab==k).astype(np.uint8))
    tm=np.zeros_like(top); cv2.fillConvexPoly(tm,cv2.convexHull(pts),1)
    fg[:r]=np.maximum(fg[:r],tm*255)
# quedarse con el componente principal (elimina restos de barandilla)
n,lab,stt,_=cv2.connectedComponentsWithStats((fg>127).astype(np.uint8))
fg=((lab==1+np.argmax(stt[1:,cv2.CC_STAT_AREA]))*255).astype(np.uint8)
th=int(H*0.82); sc=th/h; tw=int(w*sc)
a=cv2.resize(fg,(tw,th),interpolation=cv2.INTER_CUBIC)
a=smooth(a,100,160,2.0)
# tinta del personaje
big=cv2.resize(ch,(tw,th),interpolation=cv2.INTER_LANCZOS4)
g=cv2.cvtColor(big,cv2.COLOR_BGR2GRAY).astype(np.float32)
g=cv2.GaussianBlur(g,(0,0),0.8)
ink=np.clip((g-62)*1.95,0,255)/255
ivory=np.array([222,232,242],np.float32)   # BGR
rgb=ink[...,None]*ivory
# desvanecer bordes inferior/laterales
fade=np.ones((th,tw),np.float32)
ys=np.linspace(1,0,int(th*.16))**1.5; fade[-len(ys):]*=ys[:,None]
xs=np.linspace(0,1,80)**1.3; fade[:,:80]*=xs[None]; fade[:,-80:]*=xs[::-1][None]
al=(a*fade)
bx=np.where(a.max(0)>.5)[0]
cx,cy=W//2,H//2
x0=cx-(bx[0]+bx[-1])//2; y0=H-th
# brillo rojo
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
glow=np.exp(-(((xx-cx)/(300*S))**2+((yy-cy)/(340*S))**2))
canvas[...,2]+=glow*95
# gotas
for _ in range(50):
    x,y=int(rng.integers(0,W)),int(rng.integers(0,H)); rr=int(rng.integers(2,8))*S
    cv2.circle(canvas,(x,y),rr,(22,22,150),-1,cv2.LINE_AA)
# halo y composición
xs0=max(x0,0); xe=min(x0+tw,W)
sl=slice(xs0-x0,xe-x0)
hl=np.zeros((H,W),np.float32); hl[y0:H,xs0:xe]=a[:,sl]
halo=cv2.GaussianBlur(hl,(0,0),30*S)
canvas[...,2]+=halo*70
aa=al[:,sl][...,None]
canvas[y0:H,xs0:xe]=canvas[y0:H,xs0:xe]*(1-aa)+rgb[:,sl]*aa
# grano fino + viñeta
canvas+=rng.normal(0,4.5,canvas.shape[:2])[...,None]
v=1-0.35*(((xx-cx)/W*2)**2+((yy-cy)/H*2)**2)
canvas*=np.clip(v,0.5,1)[...,None]
res=np.clip(canvas,0,255).astype(np.uint8)
cv2.imwrite("output/casca_manos.png",res)
cv2.imwrite("output/casca_manos_1206.png",cv2.resize(res,(w0,h0),interpolation=cv2.INTER_AREA))
