import * as THREE from './three.module.min.js';
const TL = window.TL;
const W = 1920, H = 1080;
const X = TL.stationX;
const BEAT = 60 / TL.bpm;

/* ---------- helpers ---------- */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutCubic = t => 1 - Math.pow(1 - clamp(t), 3);
const easeOutBack = t => { t = clamp(t); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutElastic = t => { t = clamp(t); if (t === 0 || t === 1) return t; return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1; };
function rngMaker(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = rngMaker(1234);
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ---------- renderer / scene ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('stage').prepend(renderer.domElement);

const scene = new THREE.Scene();
{ // sky gradient
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#5cbcff'); gr.addColorStop(.55, '#a8e2ff'); gr.addColorStop(.85, '#e6f8ff'); gr.addColorStop(1, '#fff6d9');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
}
scene.fog = new THREE.Fog(0xcdeeff, 45, 150);

const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 400);
const hemi = new THREE.HemisphereLight(0xcfeaff, 0x86d675, 1.25); scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xfff0d0, 2.2);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
const sc = sunLight.shadow.camera; sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 1; sc.far = 70;
sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.03; sunLight.shadow.radius = 4;
scene.add(sunLight, sunLight.target);
const fill = new THREE.DirectionalLight(0xffd6f0, .5); fill.position.set(-10, 6, 14); scene.add(fill);

/* ---------- materials / primitives ---------- */
const matCache = new Map();
function matOf(color, o = {}) {
  const k = color + '|' + (o.roughness ?? .55) + '|' + (o.emissive ?? 0) + '|' + (o.ei ?? 0);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: o.roughness ?? .55, metalness: 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 0 }));
  return matCache.get(k);
}
const UNIT = new THREE.SphereGeometry(1, 22, 15), UNIT_LOW = new THREE.SphereGeometry(1, 14, 10); let lowMode = false;
function S(r, color, sx = 1, sy = 1, sz = 1, o = {}) {
  const m = new THREE.Mesh(lowMode ? UNIT_LOW : UNIT, matOf(color, o)); m.scale.set(r * sx, r * sy, r * sz);
  m.castShadow = o.shadow ?? true; return m;
}
function cyl(rt, rb, h, color, seg = 12, o = {}) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), matOf(color, o)); m.castShadow = true; return m; }
function capsule(r, len, color, o = {}) { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), matOf(color, o)); m.castShadow = true; return m; }
function smileMesh(r, tube, color = 0x5a2040) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 22, Math.PI), matOf(color, { roughness: .4 })); m.rotation.z = Math.PI; return m; }

function makeEye(r) {
  const g = new THREE.Group();
  const white = S(r, 0xffffff, 1, 1.12, .5, { shadow: false, roughness: .3 }); g.add(white);
  const look = new THREE.Group(); look.position.z = r * .26; g.add(look);
  const pupil = S(r * .68, 0x2a1840, 1, 1.08, .5, { shadow: false, roughness: .25 }); pupil.position.z = r * .1; look.add(pupil);
  const h1 = S(r * .25, 0xffffff, 1, 1, 1, { shadow: false, emissive: 0xffffff, ei: .8 }); h1.position.set(r * .24, r * .32, r * .5);
  const h2 = S(r * .11, 0xffffff, 1, 1, 1, { shadow: false, emissive: 0xffffff, ei: .8 }); h2.position.set(-r * .22, -r * .24, r * .5);
  look.add(h1, h2); g.userData = { look, r }; return g;
}
function makeBrow(len, color) { const b = capsule(.03, len, color, {}); b.castShadow = false; b.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(b); return g; }

/* ---------- characters ---------- */
function makePip() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = 0xffb3d3, furL = 0xffe6f0, inner = 0xff8db8;
  const torso = S(.62, fur, 1, 1, .92); torso.position.y = .88; body.add(torso);
  const belly = S(.46, furL, 1, 1, .5); belly.position.set(0, .84, .42); body.add(belly);
  const tail = S(.26, 0xffffff); tail.position.set(0, .62, -.6); body.add(tail);
  const head = new THREE.Group(); head.position.y = 1.95; body.add(head);
  head.add(S(.84, fur, 1.1, .95, 1));
  const ears = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.set(s * .36, .62, -.05); head.add(piv);
    const e = capsule(.2, .8, fur); e.position.y = .55; piv.add(e);
    const ei = capsule(.11, .6, inner); ei.position.set(0, .55, .1); ei.scale.z = .5; ei.castShadow = false; piv.add(ei);
    piv.userData.s = s; ears.push(piv);
  }
  const eyeL = makeEye(.24), eyeR = makeEye(.24); eyeL.position.set(-.33, .12, .69); eyeR.position.set(.33, .12, .69);
  eyeL.rotation.y = -.25; eyeR.rotation.y = .25; head.add(eyeL, eyeR);
  const browL = makeBrow(.16, 0xb0507a), browR = makeBrow(.16, 0xb0507a); browL.position.set(-.34, .46, .66); browR.position.set(.34, .46, .66); head.add(browL, browR);
  const nose = S(.08, 0xff5c8f, 1, .8, .8, { shadow: false }); nose.position.set(0, -.08, .84); head.add(nose);
  const smile = smileMesh(.13, .028); smile.position.set(0, -.2, .8); head.add(smile);
  const open = new THREE.Group(); open.position.set(0, -.3, .78);
  const mo = S(.13, 0x6b1f3a, 1, 1, .5, { shadow: false }); const tg = S(.08, 0xff7a96, 1, .6, .4, { shadow: false }); tg.position.set(0, -.06, .03); open.add(mo, tg); head.add(open);
  for (const s of [-1, 1]) { const ch = S(.14, 0xff8fb5, 1, .75, .35, { shadow: false }); ch.position.set(s * .53, -.12, .6); ch.rotation.y = s * .6; head.add(ch); }
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-.6, 1.2, .1); armR.position.set(.6, 1.2, .1);
  for (const a of [armL, armR]) { const c = capsule(.17, .45, fur); c.position.y = -.3; a.add(c); const h = S(.19, furL); h.position.y = -.62; a.add(h); body.add(a); }
  for (const s of [-1, 1]) { const f = S(.29, furL, 1.1, .6, 1.35); f.position.set(s * .34, .17, .22); body.add(f); }
  return { root, body, head, eyeL, eyeR, browL, browR, smile, open, armL, armR, ears, kind: 'pip', bright: 0 };
}
function makeBloo() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const blue = 0x49b0ff, blueD = 0x2f8fe8;
  const torso = S(.8, blue, 1, .98, .95); torso.position.y = .98; body.add(torso);
  const belly = S(.6, 0xe3f5ff, .95, .8, .6); belly.position.set(0, .74, .42); body.add(belly);
  const head = new THREE.Group(); head.position.y = 0; body.add(head);
  const tuftG = new THREE.Group(); tuftG.position.set(0, 1.78, .05); head.add(tuftG);
  for (const [x, rz, h] of [[-.14, .5, 1.5], [0, 0, 1.9], [.14, -.5, 1.5]]) { const t = S(.12, blueD, .8, h, .8); t.position.set(x, .12, 0); t.rotation.z = rz; tuftG.add(t); }
  const eyeL = makeEye(.25), eyeR = makeEye(.25); eyeL.position.set(-.31, 1.2, .67); eyeR.position.set(.31, 1.2, .67);
  eyeL.rotation.y = -.3; eyeR.rotation.y = .3; head.add(eyeL, eyeR);
  const browL = makeBrow(.16, 0x1d5fae), browR = makeBrow(.16, 0x1d5fae); browL.position.set(-.33, 1.55, .6); browR.position.set(.33, 1.55, .6); head.add(browL, browR);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(.16, .34, 18), matOf(0xffa630)); beak.rotation.x = Math.PI / 2; beak.position.set(0, .99, .88); beak.castShadow = true; head.add(beak);
  const lowP = new THREE.Group(); lowP.position.set(0, .9, .74); head.add(lowP);
  const low = new THREE.Mesh(new THREE.ConeGeometry(.12, .26, 16), matOf(0xf08a10)); low.rotation.x = Math.PI / 2; low.position.set(0, 0, .12); lowP.add(low);
  const smile = new THREE.Group(); const open = new THREE.Group(); // unused for bird but keep API
  for (const s of [-1, 1]) { const ch = S(.16, 0xff8fb5, 1, .75, .35, { shadow: false }); ch.position.set(s * .54, .98, .52); ch.rotation.y = s * .8; head.add(ch); }
  const armL = new THREE.Group(), armR = new THREE.Group(); armL.position.set(-.76, 1.0, 0); armR.position.set(.76, 1.0, 0);
  for (const [a, s] of [[armL, -1], [armR, 1]]) { const w = S(.3, blueD, .5, 1.25, 1.1); w.position.set(s * .1, -.3, 0); a.add(w); body.add(a); }
  const tail = S(.24, blueD, .7, .45, 1.3); tail.position.set(0, .72, -.78); tail.rotation.x = -.5; body.add(tail);
  for (const s of [-1, 1]) { const f = S(.17, 0xffa630, 1.2, .4, 1.6); f.position.set(s * .26, .07, .3); body.add(f); const l = cyl(.035, .035, .3, 0xffa630, 8); l.position.set(s * .26, .22, .2); body.add(l); }
  return { root, body, head, eyeL, eyeR, browL, browR, smile, open, armL, armR, ears: [], lowBeak: lowP, tuft: tuftG, kind: 'bloo' };
}
function makeFrog() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const g = 0x6fd04f, gl = 0xd9f6a4;
  const torso = S(.62, g, 1.15, .8, 1.05); torso.position.y = .5; body.add(torso);
  const belly = S(.5, gl, .95, .6, .6); belly.position.set(0, .38, .36); body.add(belly);
  const head = new THREE.Group(); body.add(head);
  for (const s of [-1, 1]) { const bump = S(.27, g); bump.position.set(s * .34, .96, .28); head.add(bump); }
  const eyeL = makeEye(.2), eyeR = makeEye(.2); eyeL.position.set(-.34, 1.0, .44); eyeR.position.set(.34, 1.0, .44); head.add(eyeL, eyeR);
  const smile = smileMesh(.3, .028); smile.position.set(0, .66, .6); smile.scale.y = .6; head.add(smile);
  const sac = S(.2, 0xff9db0, 1, 1, .6, { shadow: false }); sac.position.set(0, .44, .62); head.add(sac);
  for (const s of [-1, 1]) { const ch = S(.12, 0xff8fb5, 1, .75, .35, { shadow: false }); ch.position.set(s * .5, .7, .5); ch.rotation.y = s * .7; head.add(ch);
    const bl = S(.32, g, .6, .9, 1.3); bl.position.set(s * .66, .32, -.1); bl.rotation.y = s * .3; body.add(bl);
    const fr = S(.14, g, 1.2, .5, 1.5); fr.position.set(s * .32, .08, .62); body.add(fr); }
  const dummy = new THREE.Group();
  return { root, body, head, eyeL, eyeR, sac, smile, browL: dummy, browR: dummy, open: dummy, armL: dummy, armR: dummy, ears: [], kind: 'frog' };
}
function applyPose(c, P) {
  const r = c.root;
  r.position.set(P.x, P.y || 0, P.z); r.rotation.y = P.ry || 0; r.scale.setScalar(P.scale ?? 1);
  const sq = P.sq || 0; c.body.scale.set(1 + sq * .55, 1 - sq, 1 + sq * .55);
  c.body.rotation.z = P.lean || 0; c.head.rotation.z = P.tilt || 0; c.head.rotation.x = P.nod || 0;
  const b = 1 - .93 * (P.blink || 0); c.eyeL.scale.y = b; c.eyeR.scale.y = b;
  const lk = (c.eyeL.userData.r) * .3; const lx = clamp(P.lookX || 0, -1, 1) * lk, ly = clamp(P.lookY || 0, -1, 1) * lk;
  c.eyeL.userData.look.position.x = lx; c.eyeR.userData.look.position.x = lx; c.eyeL.userData.look.position.y = ly; c.eyeR.userData.look.position.y = ly;
  const op = P.open || 0;
  if (c.kind === 'pip') { c.smile.visible = op < .15; c.open.visible = op >= .15; c.open.scale.set(1 + op * .2, .25 + op * .95, 1); }
  if (c.kind === 'bloo') { c.lowBeak.rotation.x = op * .55; c.tuft.rotation.z = Math.sin((P.t || 0) * 6) * .08 + (P.tilt || 0) * .3; }
  if (c.kind === 'frog') { c.sac.scale.setScalar(.2 * (1 + (P.croak || 0) * .9)); }
  const bro = P.brow || 0; // -1 sad .. 1 happy raise
  c.browL.position.y = (c.kind === 'pip' ? .46 : 1.55) + bro * .05; c.browR.position.y = c.browL.position.y;
  c.browL.rotation.z = bro * .3; c.browR.rotation.z = -bro * .3;
  const ar = c.kind === 'bloo' ? 1.9 : 2.5;
  c.armL.rotation.z = -(.22 + (P.armL || 0) * ar) + (P.wobL || 0); c.armR.rotation.z = (.22 + (P.armR || 0) * ar) + (P.wobR || 0);
  c.ears.forEach(e => { const s = e.userData.s; e.rotation.z = -s * (.12 + (P.earA || 0)) + Math.sin((P.t || 0) * 7 + s) * (P.earW || 0); e.rotation.x = -.15 + (P.earF || 0); });
}
const blinkAt = (t, ph) => { const per = 3.1 + (ph % 1) * 1.4; const c = (t + ph * 3.7) % per; return c < .15 ? Math.sin(c / .15 * Math.PI) : 0; };

/* ---------- world: ground, hills, sky ---------- */
const pathZ = x => 1.6 + Math.sin(x * .09) * .9;
const groundH = (x, z) => {
  const back = smooth(-9, -30, z) * (3.2 + 2.6 * Math.sin(x * .06 + 1) + 1.4 * Math.sin(x * .17 + z * .1));
  const front = smooth(14, 24, z) * 1.2;
  return Math.max(0, back) + front;
};
{
  const g = new THREE.PlaneGeometry(270, 100, 270, 100); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const A = new THREE.Color(0x82df5c), B = new THREE.Color(0x5fca47), P = new THREE.Color(0xf8e4a8), C = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + 40, wz = pos.getZ(i) - 15;
    pos.setY(i, groundH(wx, wz));
    const n = .5 + .5 * Math.sin(wx * .31) * Math.sin(wz * .27 + wx * .05);
    C.copy(A).lerp(B, n * .8 + smooth(-8, -30, wz) * .2);
    C.lerp(P, 1 - smooth(1.7, 2.8, Math.abs(wz - pathZ(wx))));
    col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 }));
  m.position.set(40, 0, -15); m.receiveShadow = true; scene.add(m);
}
lowMode = true;
for (let i = 0; i < 16; i++) { // distant hills
  const h = S(1, [0x9be28e, 0x86d9a8, 0xa6e59a, 0x7fd3b4][i % 4], 1, 1, 1, { emissive: 0x9be28e, ei: .25 });
  h.castShadow = false; const sz = 16 + rnd() * 14; h.scale.set(sz * 1.6, sz * .55, sz); h.position.set(-30 + i * 9.5 + rnd() * 5, -3, -62 - rnd() * 18); scene.add(h);
}
const clouds = [];
for (let i = 0; i < 18; i++) {
  const g = new THREE.Group(); const n = 4 + Math.floor(rnd() * 3), s = 1.6 + rnd() * 1.6;
  for (let k = 0; k < n; k++) { const b = S(s * (.7 + rnd() * .5), 0xffffff, 1, .85, .9, { emissive: 0xffffff, ei: .45, shadow: false }); b.position.set((k - n / 2) * s * .95, (k % 2) * s * .3, rnd() * .6); g.add(b); }
  g.position.set(-35 + i * 8.5 + rnd() * 4, 13 + rnd() * 8, -38 - rnd() * 18); g.userData.base = g.position.x; g.userData.sp = .25 + rnd() * .25; clouds.push(g); scene.add(g);
}
const sunRig = new THREE.Group(); scene.add(sunRig);
{
  const core = new THREE.Mesh(new THREE.SphereGeometry(4.5, 32, 20), new THREE.MeshBasicMaterial({ color: 0xffe45e, fog: false })); sunRig.add(core);
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, 'rgba(255,240,150,.95)'); gr.addColorStop(.4, 'rgba(255,230,120,.35)'); gr.addColorStop(1, 'rgba(255,230,120,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.set(34, 34, 1); sunRig.add(sp);
  const e1 = S(.55, 0x5a3a10, 1, 1.2, .4, { shadow: false }), e2 = e1.clone(); e1.position.set(-1.4, .9, 4.2); e2.position.set(1.4, .9, 4.2); sunRig.add(e1, e2);
  for (const e of [e1, e2]) e.material = new THREE.MeshBasicMaterial({ color: 0x5a3a10, fog: false });
  const sm = new THREE.Mesh(new THREE.TorusGeometry(1.6, .22, 8, 24, Math.PI), new THREE.MeshBasicMaterial({ color: 0xd24a2a, fog: false })); sm.rotation.z = Math.PI; sm.position.set(0, -.7, 4.3); sunRig.add(sm);
  for (const s of [-1, 1]) { const ch = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ color: 0xff9a6a, fog: false })); ch.scale.set(.8, .5, .2); ch.position.set(s * 2.7, -.2, 4.1); sunRig.add(ch); }
}

/* ---------- decor ---------- */
function makeTree(kind) {
  const g = new THREE.Group(); const h = 2.6 + rnd() * 2.2;
  const t = cyl(.34, .5, h, 0x9a6a3c); t.position.y = h / 2; g.add(t);
  const cols = [0x4fcf5e, 0x66d760, 0x36bf6e, 0xff9fc6, 0xffc447, 0x7fe08a]; const c = cols[kind % cols.length];
  const big = S(2.1 + rnd() * .5, c, 1, .95, 1); big.position.y = h + 1.4; g.add(big);
  for (const [x, y, z, r] of [[-1.5, h + .5, .5, 1.3], [1.5, h + .6, .2, 1.4], [.2, h + 2.8, -.3, 1.2]]) { const b = S(r, c); b.position.set(x, y, z); g.add(b); }
  return g;
}
for (let i = 0; i < 52; i++) { const t = makeTree(Math.floor(rnd() * 6)); const x = -32 + rnd() * 150, z = -14 - rnd() * 17; t.position.set(x, groundH(x, z) - .05, z); t.scale.setScalar(.9 + rnd() * .6); scene.add(t); }
for (let i = 0; i < 45; i++) { // bushes
  const x = -30 + rnd() * 145, z = -8 - rnd() * 3, g = new THREE.Group(); const c = [0x58d36a, 0x3fbf62, 0x6fdc7a][i % 3];
  for (let k = 0; k < 3; k++) { const b = S(.7 + rnd() * .4, c); b.position.set(k * .8 - .8, .45, rnd() * .4); g.add(b); }
  if (i % 3 === 0) for (let k = 0; k < 5; k++) { const bb = S(.12, 0xff5577, 1, 1, 1, { shadow: false }); bb.position.set(rnd() * 2 - 1, .5 + rnd() * .6, .8 + rnd() * .1); g.add(bb); }
  g.position.set(x, groundH(x, z), z); scene.add(g);
}
for (let i = 0; i < 18; i++) { // mushrooms
  const x = -25 + rnd() * 130, z = -6 - rnd() * 3, g = new THREE.Group(); const s = .6 + rnd() * .5;
  const st = cyl(.14, .18, .5, 0xfff3e0); st.position.y = .25; g.add(st);
  const cap = S(.42, i % 2 ? 0xff5a6e : 0xb18cff, 1, .7, 1); cap.position.y = .55; g.add(cap);
  for (const [dx, dz] of [[-.18, .22], [.16, .26], [0, .34]]) { const d = S(.07, 0xffffff, 1, 1, .5, { shadow: false }); d.position.set(dx, .78 - Math.abs(dx) * .2, dz); g.add(d); }
  g.position.set(x, 0, z); g.scale.setScalar(s * 1.4); scene.add(g);
}
{ // instanced flowers & grass
  const FL = 950; const colors = [0xff6fa8, 0xffffff, 0xffd23f, 0xb48cff, 0xff8a4c, 0x6fc8ff];
  const LOW = new THREE.SphereGeometry(1, 8, 6);
  const petals = new THREE.InstancedMesh(LOW, new THREE.MeshStandardMaterial({ roughness: .6 }), FL * 5);
  const centers = new THREE.InstancedMesh(LOW, matOf(0xffb100), FL);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.025, .03, 1, 5), matOf(0x3fae4a), FL);
  const d = new THREE.Object3D(), col = new THREE.Color(); let pi = 0;
  for (let i = 0; i < FL; i++) {
    let x, z; do { x = -28 + rnd() * 140; z = rnd() < .45 ? (6.8 + rnd() * 2.6) : (-4.5 - rnd() * 7); } while (Math.abs(z - pathZ(x)) < 3);
    const h = .45 + rnd() * .5, sz = .1 + rnd() * .09, c = colors[Math.floor(rnd() * colors.length)], y0 = groundH(x, z);
    d.rotation.set(0, 0, 0); d.scale.set(1, h, 1); d.position.set(x, y0 + h / 2, z); d.updateMatrix(); stems.setMatrixAt(i, d.matrix);
    d.scale.setScalar(sz * .8); d.position.set(x, y0 + h, z + .03); d.updateMatrix(); centers.setMatrixAt(i, d.matrix);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2; d.scale.set(sz * .75, sz * .75, sz * .3);
      d.position.set(x + Math.cos(a) * sz * 1.05, y0 + h + Math.sin(a) * sz * 1.05, z); d.updateMatrix(); petals.setMatrixAt(pi, d.matrix); petals.setColorAt(pi, col.set(c)); pi++;
    }
  }
  scene.add(petals, centers, stems);
  const GT = 1600, tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(.12, .5, 5), matOf(0x45b83c), GT);
  for (let i = 0; i < GT; i++) { const x = -30 + rnd() * 145, z = -15 + rnd() * 25; d.rotation.set(0, rnd() * 6, (rnd() - .5) * .4); d.scale.setScalar(.7 + rnd() * .9); d.position.set(x, groundH(x, z) + .22, z); d.updateMatrix(); tufts.setMatrixAt(i, d.matrix); }
  scene.add(tufts);
}

lowMode = false;
/* ---------- station props ---------- */
const COL = { red: 0xff3b4a, yellow: 0xffd21f, blue: 0x3b9bff, green: 0x45cc4f };
const SC = TL.scenes;
// red: apple tree + apples
const appleTree = new THREE.Group();
{
  const h = 3.4; const t = cyl(.5, .75, h, 0x9a6a3c); t.position.y = h / 2; appleTree.add(t);
  for (const [x, y, z, r] of [[0, h + 1.6, 0, 2.7], [-2, h + .8, .2, 1.9], [2, h + 1, .1, 2], [0, h + 3.4, -.3, 1.7], [-.9, h + .3, 1.4, 1.4], [1.1, h + .2, 1.5, 1.3]]) { const b = S(r, 0x4fcf5e); b.position.set(x, y, z); appleTree.add(b); }
  appleTree.position.set(X.red, 0, -2.8); scene.add(appleTree);
}
function makeApple() {
  const g = new THREE.Group(); const a = S(.44, 0xff3b4a, 1, .93, 1, { roughness: .35 }); g.add(a);
  const st = cyl(.03, .03, .22, 0x6b3f1c, 6); st.position.set(0, .45, 0); g.add(st);
  const lf = S(.15, 0x3fb34f, 1.6, .35, .8); lf.position.set(.16, .5, 0); lf.rotation.z = .4; g.add(lf);
  const hl = S(.09, 0xffffff, 1, 1, 1, { shadow: false, emissive: 0xffffff, ei: .6 }); hl.position.set(-.2, .2, .36); g.add(hl);
  const e1 = makeEye(.09), e2 = makeEye(.09); e1.position.set(-.15, .05, .39); e2.position.set(.15, .05, .39); g.add(e1, e2);
  const sm = smileMesh(.09, .02); sm.position.set(0, -.1, .4); g.add(sm); return g;
}
const apples = [0, 1, 2].map(() => { const a = makeApple(); a.visible = false; scene.add(a); return a; });
const appleSpawn = [[X.red - 1.4, 3.9, -.7], [X.red + 1.3, 4.7, -.6], [X.red + .1, 3.3, -.4]];
const appleLand = [[X.red - 1.9, .42, 3.6], [X.red, .42, 4.0], [X.red + 1.9, .42, 3.6]];
// yellow: sunflowers
function makeSunflower() {
  const g = new THREE.Group(); const H = 3.3;
  const st = cyl(.08, .11, H, 0x3fae4a, 8); st.position.y = H / 2; g.add(st);
  for (const s of [-1, 1]) { const l = S(.45, 0x4fc25a, 1.5, .25, .8); l.position.set(s * .5, 1 + (s > 0 ? .5 : 0), 0); l.rotation.z = s * .5; g.add(l); }
  const head = new THREE.Group(); head.position.set(0, H, .1); head.rotation.x = -.12; g.add(head);
  head.add(S(.78, 0x8b5a2b, 1, 1, .38));
  for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; const p = S(.3, 0xffd31f, .55, 1.35, .25); p.position.set(Math.cos(a) * .98, Math.sin(a) * .98, -.04); p.rotation.z = a - Math.PI / 2; head.add(p); }
  const e1 = makeEye(.14), e2 = makeEye(.14); e1.position.set(-.27, .16, .27); e2.position.set(.27, .16, .27); head.add(e1, e2);
  const sm = smileMesh(.16, .03, 0x4a2a10); sm.position.set(0, -.12, .3); head.add(sm);
  for (const s of [-1, 1]) { const ch = S(.1, 0xff9a6a, 1, .7, .3, { shadow: false }); ch.position.set(s * .46, -.08, .3); head.add(ch); }
  g.userData.head = head; g.visible = false; scene.add(g); return g;
}
const sunflowers = [0, 1, 2].map(() => makeSunflower());
const sfPos = [[X.yellow - 3, 0, -1.4], [X.yellow, 0, -2.6], [X.yellow + 3, 0, -1.4]];
// blue: bush + butterflies
const bush = new THREE.Group();
{ for (const [x, y, z, r, c] of [[-1.6, .9, 0, 1.2, 0x4cc765], [0, 1.2, -.2, 1.6, 0x58d36a], [1.7, .9, 0, 1.2, 0x4cc765]]) { const b = S(r, c); b.position.set(x, y, z); bush.add(b); }
  for (let k = 0; k < 16; k++) { const f = S(.16, [0x7cc4ff, 0x3b9bff, 0xffffff][k % 3], 1, 1, 1, { shadow: false }); const a = k * 2.4; f.position.set(Math.sin(a) * 2, .8 + (k % 4) * .3, .9 + Math.cos(a) * .2); bush.add(f); }
  bush.position.set(X.blue, 0, -3); scene.add(bush); }
function makeButterfly(c1, c2) {
  const g = new THREE.Group(); const bd = capsule(.07, .5, 0x23407a); bd.castShadow = false; g.add(bd);
  for (const s of [-1, 1]) { const a = cyl(.012, .012, .3, 0x23407a, 4); a.position.set(s * .1, .48, 0); a.rotation.z = -s * .4; g.add(a); const bl = S(.04, 0xffd23f, 1, 1, 1, { shadow: false }); bl.position.set(s * .17, .62, 0); g.add(bl); }
  const wings = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); g.add(piv);
    const up = S(.55, c1, 1, 1.05, .07); up.position.set(s * .55, .2, 0); piv.add(up);
    const lo = S(.38, c2, 1, 1, .07); lo.position.set(s * .4, -.32, 0); piv.add(lo);
    const d1 = S(.1, 0xffffff, 1, 1, .5, { shadow: false }); d1.position.set(s * .62, .3, .05); piv.add(d1);
    const d2 = S(.07, 0xffffff, 1, 1, .5, { shadow: false }); d2.position.set(s * .42, -.34, .05); piv.add(d2);
    wings.push([piv, s]);
  }
  g.userData.wings = wings; g.visible = false; scene.add(g); return g;
}
const bflies = [makeButterfly(0x3b9bff, 0x7cc4ff), makeButterfly(0x2f7de8, 0x9bd6ff), makeButterfly(0x5aa9ff, 0x2f7de8)];
// green: pond, lily pads, frogs
const pond = new THREE.Group();
{
  const w = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .12, 40), matOf(0x58d3ff, { roughness: .15, emissive: 0x2a9fe0, ei: .3 })); w.scale.set(5.6, 1, 3.1); w.position.y = .05; w.receiveShadow = true; pond.add(w);
  for (let k = 0; k < 22; k++) { const a = k / 22 * Math.PI * 2; const r = S(.45 + hash(k) * .25, k % 2 ? 0xc9b7ff : 0xbba4f0); r.scale.y *= .7; r.position.set(Math.cos(a) * 5.7, .2, Math.sin(a) * 3.2); pond.add(r); }
  for (let k = 0; k < 6; k++) { const a = 3.6 + k * .45; const rd = cyl(.04, .05, 1.8 + hash(k) * .6, 0x3fae4a, 6); rd.position.set(Math.cos(a) * 6.3, .9, Math.sin(a) * 3.7); pond.add(rd); const ct = capsule(.12, .35, 0x8a5a2b); ct.position.set(Math.cos(a) * 6.3, 1.9 + hash(k) * .5, Math.sin(a) * 3.7); pond.add(ct); }
  pond.position.set(X.green, 0, -1.4); scene.add(pond);
}
const padPos = [[X.green - 2.7, .13, -1.0], [X.green + .2, .13, -2.2], [X.green + 2.9, .13, -.8]];
for (const [x, y, z] of padPos) { const p = cyl(1.0, 1.0, .08, 0x38c24a, 24); p.position.set(x, y - .04, z); scene.add(p); const lot = S(.28, 0xff8fc0, 1, .7, 1); lot.position.set(x + .55, y + .1, z + .35); scene.add(lot); }
const frogs = [0, 1, 2].map(() => { const f = makeFrog(); f.root.visible = false; scene.add(f.root); return f; });
// finale cast
const finFrogs = [0, 1, 2].map(() => { const f = makeFrog(); f.root.visible = false; scene.add(f.root); return f; });
const finBflies = [makeButterfly(0xff7bb0, 0xffb3d3), makeButterfly(0xb48cff, 0xd8c4ff), makeButterfly(0xff9a3c, 0xffd23f)];
const finFlowers = [0, 1, 2, 3].map(() => makeSunflower());
// rainbow
const RB = [['red', 13.6, 0xff4256], ['yellow', 12.3, 0xffcf1f], ['blue', 11.0, 0x3b9bff], ['green', 9.7, 0x42cc55]];
const rainbow = RB.map(([n, r, c]) => { const m = new THREE.Mesh(new THREE.BufferGeometry(), matOf(c, { roughness: .4, emissive: c, ei: .35 })); m.scale.z = .45; m.position.set(X.finale, -2.2, -10); m.castShadow = false; scene.add(m); return { m, r, n, p: -1 }; });
function setRainbow(rb, p) {
  p = clamp(p); if (Math.abs(p - rb.p) < 1e-4) return; rb.p = p; rb.m.visible = p > 0.002;
  if (p <= 0.002) return; rb.m.geometry.dispose(); rb.m.geometry = new THREE.TorusGeometry(rb.r, 1.15, 12, 90, Math.PI * p); rb.m.rotation.z = Math.PI - Math.PI * p;
}
// intro props: balloons
const balloons = [];
{
  const colors = [0xff4d5e, 0xffc800, 0x2f9bff, 0x3ccb4e];
  colors.forEach((c, i) => { const b = S(.5, c, 1, 1.12, 1, { roughness: .25 }); b.position.set(X.intro + 7 + (i % 2) * .6, 4.3 + i * .55, -1.2 + i * .2); b.userData.b = i; scene.add(b); const s = cyl(.012, .012, 2.3 + i * .55, 0xffffff, 4); s.position.set(b.position.x, b.position.y - 1.3 - i * .27, b.position.z); scene.add(s); b.userData.stringMesh = s; balloons.push(b); });
}

/* ---------- particles ---------- */
const sparkGeo = new THREE.OctahedronGeometry(1);
const SPK = 260, spark = [];
for (let i = 0; i < SPK; i++) { const m = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })); m.visible = false; scene.add(m); spark.push(m); }
const PAL = [0xffe14d, 0xff7bb0, 0x6fd0ff, 0xb48cff, 0xffffff, 0x7dff9a];
const bursts = [];
const addBurst = (t, p, n, pal = PAL, speed = 3, size = .22, life = 1.3) => bursts.push({ t, p, n, pal, speed, size, life, id: bursts.length });
const confetti = []; const CONF = 110;
for (let i = 0; i < CONF; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.28, .16, .02), new THREE.MeshBasicMaterial({ color: PAL[i % PAL.length], fog: false })); m.visible = false; scene.add(m); confetti.push(m); }
const ripples = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, .06, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false })); m.rotation.x = Math.PI / 2; m.visible = false; scene.add(m); return m; });

function runBursts(t) {
  let k = 0; for (const m of spark) m.visible = false;
  for (const b of bursts) {
    const a = t - b.t; if (a < 0 || a > b.life) continue;
    for (let i = 0; i < b.n && k < SPK; i++) {
      const h1 = hash(b.id * 91 + i * 7.3), h2 = hash(b.id * 53 + i * 3.1), h3 = hash(b.id * 17 + i * 11.7);
      const th = h1 * Math.PI * 2, ph = (h2 - .3) * Math.PI, sp = b.speed * (.4 + h3);
      const m = spark[k++]; m.visible = true;
      m.position.set(b.p[0] + Math.cos(th) * Math.cos(ph) * sp * a, b.p[1] + Math.sin(ph) * sp * a - 1.8 * a * a, b.p[2] + Math.sin(th) * Math.cos(ph) * sp * a * .6);
      const s = b.size * (.5 + h3 * .8) * (1 - smooth(.4, 1, a / b.life)); m.scale.set(s, s * 1.5, s * .5); m.rotation.set(0, 0, a * 4 + i); m.material.color.set(b.pal[i % b.pal.length]);
    }
  }
}
// schedule bursts from timeline
for (const c of ['red', 'yellow', 'blue', 'green']) {
  const s = SC[c]; addBurst(s.word_t, [s.x - 2.2, 3.4, 2.2], 22, [COL[c], 0xffffff, 0xffe14d], 3.2, .24);
  s.counts.forEach((t, i) => {
    if (c === 'red') addBurst(t, appleSpawn[i], 18, [0xff3b4a, 0xffe14d, 0xffffff]);
    if (c === 'yellow') addBurst(t, [sfPos[i][0], 3.5, sfPos[i][2]], 20, [0xffd21f, 0xffffff, 0xff9a3c]);
    if (c === 'blue') addBurst(t, [X.blue, 2.6, -2.2], 20, [0x3b9bff, 0x9bd6ff, 0xffffff]);
    if (c === 'green') addBurst(t, [padPos[i][0], .5, padPos[i][2]], 22, [0x7fd6ff, 0xffffff, 0x58d3ff], 2.6);
  });
  addBurst(s.celebrate, [s.x, 4.2, 2], 60, PAL, 5.2, .28, 1.6);
}
addBurst(.9, [0, 4, 0], 40, PAL, 6, .3, 1.8); addBurst(3.2, [0, 6, 0], 50, PAL, 7, .32, 2);
addBurst(11.5, [0, 4.5, 2], 40, PAL, 5, .3, 1.6);
for (const [n, t] of Object.entries(TL.rainbow)) addBurst(t, [X.finale + (n === 'red' ? -12 : n === 'yellow' ? -8 : n === 'blue' ? 8 : 12), 4, -9], 26, [COL[n], 0xffffff, 0xffe14d], 4, .3);
addBurst(76.0, [X.finale, 5, 2], 80, PAL, 6.5, .3, 2); addBurst(75.8, [X.finale - 9, 1.5, 1], 30, PAL, 3, .26); addBurst(75.8, [X.finale + 9, 1.5, 1], 30, PAL, 3, .26);
addBurst(82.3, [X.finale, 4, 3], 50, PAL, 5.5, .3, 1.8);

/* ---------- character trajectories ---------- */
const stops = [{ X: X.intro, arrive: 0, leave: 15.2 }];
for (const c of ['red', 'yellow', 'blue', 'green']) stops.push({ X: X[c], arrive: SC[c].start + .4, leave: SC[c].leave });
stops.push({ X: X.finale, arrive: TL.finaleStart + .4, leave: 1e9 });
function traj(t, dx, lag) {
  t -= lag;
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    if (t >= s.arrive && t < s.leave) return { x: s.X + dx, p: 0, moving: false, hop: 0, sq: 0, i };
    const nx = stops[i + 1];
    if (nx && t >= s.leave && t < nx.arrive) {
      const p = (t - s.leave) / (nx.arrive - s.leave), e = p * p * (3 - 2 * p), n = 4, w = Math.abs(Math.sin(p * n * Math.PI));
      return { x: lerp(s.X, nx.X, e) + dx, p, moving: true, hop: w, sq: .22 * (1 - smooth(0, .35, w)) - .08 * smooth(.6, 1, w), i };
    }
  }
  return { x: stops[0].X + dx, p: 0, moving: false, hop: 0, sq: 0, i: 0 };
}
function jumpFx(t, t0, dur, h) {
  const u = (t - t0) / dur;
  if (u >= 0 && u <= 1) return { y: h * 4 * u * (1 - u), sq: -.12 * Math.sin(u * Math.PI), air: 1 };
  if (u < 0 && u > -.25) return { y: 0, sq: .24 * smooth(-.25, -.02, u), air: 0 };
  if (u > 1 && u < 1.4) return { y: 0, sq: .26 * (1 - smooth(1, 1.4, u)), air: 0 };
  return { y: 0, sq: 0, air: 0 };
}
const beatPh = t => (t % BEAT) / BEAT;
const danceBounce = t => Math.abs(Math.sin(Math.PI * t / BEAT));
const lookAtCam = (x, cam) => clamp((cam.x - x) * .08, -.8, .8);

const PIP_DX = -2.3, BLOO_DX = 2.7;
let camPos = new THREE.Vector3(), camLook = new THREE.Vector3();

function sceneOf(t) { for (const c of ['red', 'yellow', 'blue', 'green']) { const s = SC[c]; if (t >= s.start - 0.3 && t < s.leave) return c; } return null; }
function colorSceneIdx(t) { for (const c of ['red', 'yellow', 'blue', 'green']) { const s = SC[c]; if (t >= s.start && t < s.start + 13) return c; } return null; }

const pip = makePip(), bloo = makeBloo(); scene.add(pip.root, bloo.root);

function updatePip(t) {
  const tr = traj(t, PIP_DX, 0); const P = { t, x: tr.x, z: 2.2, y: 0, sq: 0, ry: 0, smile: 1, open: 0, blink: blinkAt(t, .3), earW: .06 };
  const cs = colorSceneIdx(t), sc_ = cs && SC[cs];
  P.y += tr.hop * .85; P.sq += tr.sq;
  if (tr.moving) { P.armL = .35 * tr.hop; P.armR = .35 * tr.hop; P.open = .5; P.ry = .35 * Math.sign(1) * (1 - Math.abs(2 * tr.p - 1)) * 0; P.earF = tr.hop * .35; P.earA = .1; P.lookX = .6; }
  else {
    const idle = danceBounce(t) * .06; P.y += idle; P.sq += (1 - danceBounce(t)) * .02; P.earA = .02;
  }
  // intro
  if (t < 15.2) {
    P.lookX = lookAtCam(P.x, camPos) * .8; P.lookY = .1;
    if (t > 0.8 && t < 5) { const u = smooth(.6, 1.4, t); P.scale = 1; }
    if (t >= 5.3 && t < 7) { P.armR = .95 + Math.sin(t * 12) * .05; P.wobR = Math.sin(t * 13) * .35; P.open = .6; P.brow = 1; }
    if (t >= 7.2 && t < 9.4) { P.armR = .95; P.wobR = Math.sin(t * 13) * .4; P.open = .7; P.brow = 1; P.tilt = Math.sin(t * 5) * .06; }
    if (t >= 9.4 && t < 11) { P.lookX = .8; P.armL = .0; P.brow = .6; }
    if (t >= 11.2 && t < 14.4) { const j = jumpFx(t, 12.0, .6, 1.3), j2 = jumpFx(t, 13.2, .6, 1.4); P.y += j.y + j2.y; P.sq += j.sq + j2.sq; P.armL = P.armR = (j.air || j2.air) ? .95 : .25; P.open = .8; P.brow = 1; }
  }
  if (sc_) {
    const u = t - sc_.start; const tgtX = sc_.x;
    P.lookX = clamp((tgtX - P.x) * .12, -.8, .8) * (u > 2.8 && u < 9 ? 1 : .2) + lookAtCam(P.x, camPos) * (u > 2.8 && u < 9 ? 0 : .6); P.lookY = (u > 4.5 && u < 9.3) ? .45 : .1;
    P.ry = clamp((tgtX - P.x) * .025, -.3, .3) * (u > 2.8 ? 1 : 0);
    if (u > 1.4 && u < 3.0) { P.armR = .8; P.wobR = Math.sin(t * 12) * .1; P.open = .6; P.brow = 1; } // announce
    if (u > 3.0 && u < 5.6) { P.armR = .65 + .1 * Math.sin(t * 3); P.tilt = Math.sin(t * 2.5) * .06; P.brow = .7; P.open = .15; }
    let acc = { y: 0, sq: 0, air: 0 };
    sc_.counts.forEach(tk => { const j = jumpFx(t, tk - .12, .62, 1.35); acc.y += j.y; acc.sq += j.sq; acc.air += j.air; });
    P.y += acc.y; P.sq += acc.sq; if (acc.air) { P.armL = P.armR = .95; P.open = .85; P.brow = 1; }
    if (u > 9.4 && u < 11.2) { // celebrate dance
      const b = danceBounce(t); P.y += b * .55; P.sq += (1 - b) * .12 - .05; const ph = Math.floor(t / BEAT) % 2;
      P.armL = ph ? .95 : .35; P.armR = ph ? .35 : .95; P.open = .9; P.brow = 1; P.lean = (ph ? 1 : -1) * .08; P.earW = .25; P.earF = .3; P.tilt = (ph ? 1 : -1) * .1;
    }
  }
  if (t >= TL.finaleStart + .4) {
    const u = t - TL.finaleStart - .4; P.lookX = lookAtCam(P.x, camPos) * .8; P.lookY = u < 5 ? .6 : .1;
    if (u > 6 && u < 13.5) { const b = danceBounce(t); P.y += b * .6; P.sq += (1 - b) * .1 - .04; const ph = Math.floor(t / BEAT) % 2; P.armL = ph ? .95 : .3; P.armR = ph ? .3 : .95; P.open = .9; P.brow = 1; P.lean = (ph ? 1 : -1) * .1; P.earW = .3; P.earF = .3; P.tilt = (ph ? 1 : -1) * .1; P.ry = Math.sin(t * 2) * .35; }
    else if (u >= 13.5) { P.armR = .95; P.wobR = Math.sin(t * 12) * .4; P.open = .8; P.brow = 1; P.tilt = Math.sin(t * 5) * .06; }
    else if (u > 1 && u < 6) { P.armL = P.armR = .4 + .1 * Math.sin(t * 4); P.open = .6; P.brow = 1; }
  }
  applyPose(pip, P);
}
function updateBloo(t) {
  const tr = traj(t, BLOO_DX, .12); const P = { t, x: tr.x, z: 2.3, y: .55, sq: 0, ry: 0, blink: blinkAt(t, .7), open: 0 };
  const flapRate = tr.moving ? 16 : 8, fl = .5 + .5 * Math.sin(t * flapRate); const lift = tr.moving ? .85 : .55;
  P.y += .12 * Math.sin(t * 3.2) + (tr.moving ? .45 * Math.sin(tr.p * Math.PI * 2) + .3 * tr.hop : 0);
  P.armL = P.armR = .12 + fl * (tr.moving ? .9 : .5); P.brow = .5;
  P.lookX = lookAtCam(P.x, camPos) * .8; P.lookY = .1;
  const cs = colorSceneIdx(t), sc_ = cs && SC[cs];
  if (t < 15.2) {
    if (t >= 5.3 && t < 7) { P.open = .5; P.brow = 1; }
    if (t >= 9.4 && t < 11) { P.armR = .95 + Math.sin(t * 14) * .08; P.armL = .12; P.open = .6; P.brow = 1; P.tilt = Math.sin(t * 5) * .06; }
    if (t >= 11.2 && t < 14.4) { P.y += danceBounce(t) * .5; P.open = .9; P.armL = P.armR = .6 + .4 * fl; }
  }
  if (sc_) {
    const u = t - sc_.start; P.lookX = clamp((sc_.x - P.x) * .12, -.8, .8) * (u > 2.8 && u < 9 ? 1 : .2) + lookAtCam(P.x, camPos) * (u > 2.8 && u < 9 ? 0 : .6); P.lookY = (u > 4.5 && u < 9.3) ? .4 : .1;
    P.ry = clamp((sc_.x - P.x) * .03, -.35, .35) * (u > 2.8 ? 1 : 0);
    sc_.counts.forEach(tk => { const a = (t - tk) / .8; if (a > 0 && a < 1) { P.ry += Math.PI * 2 * easeOutCubic(a); P.y += Math.sin(a * Math.PI) * .7; P.open = .8; P.brow = 1; } });
    if (u > 9.4 && u < 11.2) { P.y += danceBounce(t) * .6; P.open = .9; P.brow = 1; P.tilt = Math.sin(t * 6) * .12; P.armL = P.armR = .4 + .6 * fl; }
  }
  if (t >= TL.finaleStart + .4) {
    const u = t - TL.finaleStart - .4;
    if (u > 6 && u < 13.5) { P.y += danceBounce(t) * .6; P.open = .9; P.brow = 1; P.ry = Math.sin(t * 2.2) * .4; P.tilt = Math.sin(t * 6) * .12; P.armL = P.armR = .4 + .6 * fl; }
    else if (u >= 13.5) { P.armL = .12; P.armR = .95 + Math.sin(t * 14) * .08; P.open = .8; P.brow = 1; P.tilt = Math.sin(t * 5) * .06; }
  }
  applyPose(bloo, P);
}

/* ---------- station object updates ---------- */
function updateRed(t) {
  const s = SC.red;
  apples.forEach((a, i) => {
    const tk = s.counts[i], dtp = t - tk; a.visible = dtp >= 0;
    if (!a.visible) return;
    const fallT = tk + .95; const sp = appleSpawn[i], ld = appleLand[i];
    if (t < fallT) { a.position.set(sp[0], sp[1] + .04 * Math.sin(t * 6 + i), sp[2]); const pop = easeOutBack(dtp / .35); a.scale.setScalar(pop); a.rotation.z = Math.sin(t * 5 + i) * .12; }
    else {
      const dt = t - fallT, g = 14; const y0 = sp[1] - ld[1], tf = Math.sqrt(2 * y0 / g); const k = clamp(dt / tf);
      let y; if (dt < tf) y = sp[1] - .5 * g * dt * dt; else { let rest = dt - tf, v = g * tf * .5; y = ld[1]; for (let b = 0; b < 3; b++) { const tb = 2 * v / g; if (rest < tb) { y = ld[1] + v * rest - .5 * g * rest * rest; break; } rest -= tb; v *= .5; } }
      a.position.set(lerp(sp[0], ld[0], easeOutCubic(k)), y, lerp(sp[2], ld[2], k)); a.scale.setScalar(1); a.rotation.z = lerp(a.rotation.z, 0, .2);
      const hop = jumpFx(t, s.celebrate + i * .25, .5, .6); if (t > s.celebrate && t < s.celebrate + 2) { a.position.y += hop.y; }
    }
  });
}
function updateYellow(t) {
  const s = SC.yellow;
  sunflowers.forEach((f, i) => {
    const tk = s.counts[i], dtp = t - tk; f.visible = dtp >= 0 && t < s.leave + 2.5; if (!f.visible) return;
    f.position.set(sfPos[i][0], 0, sfPos[i][2]); const g = easeOutElastic(dtp / 1.0); f.scale.setScalar(Math.max(.001, g));
    const sw = Math.sin(t * 2.2 + i * 1.7); f.rotation.z = sw * .045; f.userData.head.rotation.z = Math.sin(t * 2.2 + i) * .1;
    if (t > s.celebrate && t < s.leave) { const b = danceBounce(t + i * .12); f.scale.set(1 + (1 - b) * .04, 1 + b * .07, 1); f.rotation.z = Math.sin(t * 6 + i) * .09; f.userData.head.rotation.z = Math.sin(t * 6 + i) * .2; }
  });
}
function bfPath(i, t, cx, cy, cz, spread = 1) {
  const w = .85 + .12 * i, ph = i * 2.1;
  return [cx + (3.2 + i * .7) * spread * Math.sin(w * t + ph), cy + .9 * Math.sin(1.7 * w * t + ph * 2) + (i - 1) * .35, cz + 1.4 * Math.cos(w * t + ph) * spread];
}
function placeButterfly(b, p, t, i, scale = 1) {
  b.position.set(p[0], p[1], p[2]); b.rotation.set(0, Math.sin(t * 1.3 + i) * .5, Math.sin(t * 1.7 + i) * .25);
  const a = Math.sin(t * 21 + i * 1.3) * .95 + .15; for (const [piv, s] of b.userData.wings) piv.rotation.y = -s * a; b.scale.setScalar(scale);
}
function updateBlue(t) {
  const s = SC.blue; const spawn = [X.blue, 2.4, -2.0];
  bflies.forEach((b, i) => {
    const tk = s.counts[i], dtp = t - tk; b.visible = dtp >= 0 && t < s.leave + 1.2; if (!b.visible) return;
    const p = bfPath(i, t, X.blue + .3, 3.3, 1.3); const k = easeOutCubic(dtp / 1.2);
    const q = [lerp(spawn[0], p[0], k), lerp(spawn[1], p[1], k), lerp(spawn[2], p[2], k)];
    const exit = smooth(s.leave - .5, s.leave + 1.2, t); // fly away to follow along
    placeButterfly(b, [lerp(q[0], X.blue + 12, exit), q[1] + exit * 2, q[2]], t, i, easeOutBack(dtp / .4));
  });
}
function updateGreen(t) {
  const s = SC.green;
  frogs.forEach((f, i) => {
    const tk = s.counts[i], dtp = t - tk; f.root.visible = dtp >= -.05 && t < s.leave + .4; if (!f.root.visible) return;
    const pp = padPos[i]; const u = clamp(dtp / .85); const P = { t, x: pp[0], z: pp[2], y: pp[1] - .02, sq: 0, ry: -Math.sign(pp[0] - X.green) * .35, blink: blinkAt(t, i * .37), open: 0, croak: 0 };
    if (dtp < .85) { P.y = pp[1] - .02 + 2.5 * 4 * u * (1 - u) - .9 * (1 - u) * (1 - u); P.sq = -.15 * Math.sin(u * Math.PI); P.scale = 1; }
    else { const L = dtp - .85; P.sq = L < .35 ? .3 * (1 - L / .35) * Math.cos(L * 14) : 0; const cr = (t * .9 + i * .4) % 1.3; P.croak = cr < .35 ? Math.sin(cr / .35 * Math.PI) : 0; }
    if (t > s.celebrate && t < s.leave) { const b = danceBounce(t + i * .17); P.y += b * .9; P.sq += (1 - b) * .15 - .06; P.croak = b > .5 ? 1 : 0; }
    applyPose(f, P); f.root.scale.setScalar(1.15);
  });
  ripples.forEach((r, i) => { const a = t - (s.counts[i] + .8); r.visible = a >= 0 && a < 1.4; if (!r.visible) return; const pp = padPos[i]; r.position.set(pp[0], .14, pp[2]); r.scale.set(1 + a * 2.2, 1 + a * 2.2, 1); r.material.opacity = (1 - a / 1.4) * .9; });
}
function updateFinale(t) {
  const F = TL.finaleStart, show = t > 75.8;
  const rbT = [TL.rainbow.red, TL.rainbow.yellow, TL.rainbow.blue, TL.rainbow.green];
  rainbow.forEach((rb, i) => setRainbow(rb, easeOutCubic((t - rbT[i] + .2) / 1.8)));
  const c = X.finale;
  finBflies.forEach((b, i) => { b.visible = show; if (!show) return; const dtp = t - 75.8; placeButterfly(b, bfPath(i, t, c, 5.0, -.5, 1.5), t, i, easeOutBack(dtp / .5) * .85); });
  finFlowers.forEach((f, i) => { f.visible = show; if (!show) return; const xs = [-9.5, -6.2, 6.2, 9.5][i], zs = [-1, -2.5, -2.5, -1][i]; const dtp = t - 75.8 - i * .1; f.position.set(c + xs, 0, zs); f.scale.setScalar(Math.max(.001, easeOutElastic(dtp / 1))); const b = danceBounce(t + i * .1); f.rotation.z = Math.sin(t * 5 + i) * .07; f.userData.head.rotation.z = Math.sin(t * 5 + i) * .18; if (t > 78) f.scale.y = 1 + b * .05; });
  finFrogs.forEach((f, i) => { f.root.visible = show; if (!show) return; const dtp = t - 75.8 - i * .15; const xs = [-5.4, 5.8, -8.4][i], zs = [3.6, 3.6, 2.4][i]; const b = danceBounce(t * 1 + i * .25); const P = { t, x: c + xs, z: zs, y: b * .9, sq: (1 - b) * .15 - .06, blink: blinkAt(t, i * .31), croak: b > .5 ? 1 : 0, open: 0, ry: -Math.sign(xs) * .3 }; if (dtp < 0) f.root.visible = false; applyPose(f, P); f.root.scale.setScalar(1.0 * easeOutBack(dtp / .5)); });
}
function updateIntro(t) { balloons.forEach((b, i) => { b.position.y = 4.3 + i * .55 + Math.sin(t * 1.3 + i) * .25; b.position.x = X.intro + 7 + (i % 2) * .6 + Math.sin(t * .9 + i) * .15; if (b.userData.stringMesh) b.userData.stringMesh.position.set(b.position.x, b.position.y - 1.3 - i * .27, b.position.z); }); }

/* ---------- camera ---------- */
const keys = [];
const K = (t, p, l) => keys.push({ t, p, l });
// title + intro
K(0, [-20, 12, 22], [-3, 3, 0]); K(4.6, [-7, 5.2, 14], [0, 2.4, 0]); K(5.6, [-1.5, 2.7, 8.5], [-2, 2.3, 1.6]);
K(7.0, [-3.8, 2.4, 6.6], [-2.3, 2.3, 2]); K(9.6, [3.6, 2.5, 6.8], [2.6, 2.3, 2]); K(11.4, [0, 3.4, 10.5], [0, 2.7, 1]); K(14.2, [1, 3.8, 9], [0, 2.8, 1.5]);
const shot = (S0, x, v = 0) => {
  K(S0 + 0.0, [x - 8, 3.2, 9.2], [x - 3, 2.2, 1]);
  K(S0 + 2.5, [x - 3.4 - v, 2.5, 8.2], [x - 2.3, 2.4, 1.8]);
  K(S0 + 4.8, [x + 1 + v, 4.6 + v * .3, 12.5], [x, 2.9, 0]);
  K(S0 + 6.6, [x + .5, 3.4, 10], [x, 2.9, .5]);
  K(S0 + 8.5, [x + 2.2, 3.0, 9.2], [x, 3.0, 0]);
  K(S0 + 9.9, [x - 1.2, 2.3, 6.2], [x - 2.3, 2.4, 2]);
  K(S0 + 11.8, [x + 7, 3.4, 10], [x + 7, 2.4, 1.5]);
};
shot(SC.red.start, X.red); shot(SC.yellow.start, X.yellow, 1); shot(SC.blue.start, X.blue, 0); shot(SC.green.start, X.green, 1);
{ const F = TL.finaleStart, x = X.finale;
  K(F, [x - 8, 3.2, 9.2], [x - 3, 2.2, 1]); K(F + 1.4, [x, 2.2, 12], [x, 6, -4]); K(F + 4.5, [x + 1, 5, 19], [x, 6.2, -6]); K(F + 7, [x - 1, 3.1, 8.6], [x, 2.7, 1.5]);
  K(F + 9.5, [x + 7, 3.6, 10], [x, 3, 1]); K(F + 11.5, [x - 6.5, 4, 10.5], [x, 3, 1]); K(F + 13, [x, 2.8, 7.6], [x, 2.5, 1.8]);
  K(F + 16, [x, 6, 22], [x, 5, 0]); K(F + 19.5, [x, 9, 34], [x, 5.5, 0]); }
function sampleKeys(t) {
  let i = 0; while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
  const k1 = keys[i], k2 = keys[Math.min(i + 1, keys.length - 1)], k0 = keys[Math.max(i - 1, 0)], k3 = keys[Math.min(i + 2, keys.length - 1)];
  const dt = Math.max(1e-3, k2.t - k1.t), u = clamp((t - k1.t) / dt), u2 = u * u, u3 = u2 * u;
  const out = [[], []];
  for (let w = 0; w < 2; w++) for (let a = 0; a < 3; a++) {
    const g = k => w ? k.l[a] : k.p[a]; const p1 = g(k1), p2 = g(k2);
    const m1 = (i === 0) ? 0 : (p2 - g(k0)) / Math.max(1e-3, k2.t - k0.t) * dt;
    const m2 = (k3 === k2) ? 0 : (g(k3) - p1) / Math.max(1e-3, k3.t - k1.t) * dt;
    out[w][a] = (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
  }
  return out;
}

/* ---------- overlays ---------- */
const $ = id => document.getElementById(id);
const el = { t1: $('title1'), t2: $('title2'), word: $('word'), words: $('words'), badge: $('badge'), end1: $('end1'), end2: $('end2'), fade: $('fade') };
const RAINB = ['#ff4d5e', '#ff9a1f', '#ffc800', '#3ccb4e', '#2f9bff', '#8a5cff'];
'Rainbow Garden'.split('').forEach((ch, i) => { const s = document.createElement('span'); s.textContent = ch === ' ' ? ' ' : ch; s.style.color = RAINB[i % RAINB.length]; el.t2.appendChild(s); });
'The End'.split('').forEach((ch, i) => { const s = document.createElement('span'); s.textContent = ch === ' ' ? ' ' : ch; s.style.color = RAINB[(i + 2) % RAINB.length]; el.end1.appendChild(s); });
const CNAME = { red: 'RED', yellow: 'YELLOW', blue: 'BLUE', green: 'GREEN' }, CHEX = { red: '#ff4d5e', yellow: '#ffb800', blue: '#2f9bff', green: '#2fbf4a' };
function overlays(t) {
  // title
  const ta = t - .3; const tv = ta > 0 && t < 4.9;
  el.t1.style.opacity = el.t2.style.opacity = tv ? clamp(1 - (t - 4.3) / .6) : 0;
  if (tv) {
    el.t1.style.transform = `translateY(${(1 - easeOutBack(ta / .8)) * -120}px) scale(${easeOutBack(ta / .8)})`;
    [...el.t2.children].forEach((s, i) => { const a = (ta - .35 - i * .05) / .5; s.style.transform = `translateY(${(1 - easeOutBack(a)) * -260 + Math.sin(t * 5 + i * .6) * 8 * smooth(1.5, 2, t)}px) scale(${clamp(easeOutBack(a), 0, 1.3)}) rotate(${Math.sin(t * 3 + i) * 3}deg)`; });
  }
  // color word
  let wordTxt = '', wo = 0, wscale = 1;
  for (const c of ['red', 'yellow', 'blue', 'green']) {
    const s = SC[c]; if (t >= s.word_t && t < s.leave + .6) { wordTxt = c; const a = t - s.word_t; wo = clamp(a / .15) * clamp((s.leave + .6 - t) / .4); wscale = easeOutBack(a / .5) * (a > 1 ? 1 : 1) * (a > .5 ? 1 + Math.sin((a - .5) * 6) * .025 * clamp(a - .5) : 1); }
  }
  if (wordTxt) { el.word.textContent = CNAME[wordTxt]; el.word.style.color = CHEX[wordTxt]; el.word.style.opacity = wo; el.word.style.transform = `scale(${wscale}) rotate(${Math.sin(t * 2) * 1.5}deg)`; } else el.word.style.opacity = 0;
  // finale words
  [...el.words.children].forEach((sp, i) => { const tt = TL.rainbow[['red', 'yellow', 'blue', 'green'][i]]; const a = t - tt; sp.style.opacity = a > 0 && t < 82.5 ? clamp(a / .15) * clamp((82.5 - t) / .5) : 0; sp.style.transform = `scale(${easeOutBack(a / .5)}) translateY(${Math.sin(t * 4 + i) * 6}px)`; });
  // count badge
  let n = 0, tk0 = 0; for (const c of ['red', 'yellow', 'blue', 'green']) { const s = SC[c]; if (t >= s.counts[0] - .02 && t < s.leave + .2) { s.counts.forEach((tk, i) => { if (t >= tk - .02) { n = i + 1; tk0 = tk; } }); el.badge.style.color = CHEX[c]; el.badge.style.borderColor = CHEX[c]; } }
  if (n) { const a = t - tk0; el.badge.textContent = n; el.badge.style.opacity = 1; el.badge.style.transform = `scale(${easeOutBack(a / .4) * (1 + .08 * Math.sin(t * 5))})`; } else el.badge.style.opacity = 0;
  // end
  const ea = t - 85.2; el.end1.style.opacity = el.end2.style.opacity = ea > 0 ? clamp(ea / .3) : 0;
  if (ea > 0) { [...el.end1.children].forEach((s, i) => { const a = (ea - i * .06) / .5; s.style.transform = `scale(${clamp(easeOutBack(a), 0, 1.3)}) translateY(${Math.sin(t * 4 + i) * 8}px)`; }); el.end2.style.transform = `scale(${easeOutBack((ea - .5) / .5)})`; }
  // fade in/out
  el.fade.style.opacity = Math.max(1 - smooth(0, .9, t), smooth(TL.duration - 1.4, TL.duration - .05, t));
}

/* ---------- main frame ---------- */
function frame(t) {
  const [p, l] = sampleKeys(t);
  const wob = .04; camPos.set(p[0] + Math.sin(t * .9) * wob * 3, Math.max(1.7, p[1] + Math.sin(t * 1.1) * wob * 2), p[2]); camLook.set(l[0], l[1], l[2]);
  camera.position.copy(camPos); camera.lookAt(camLook);
  sunRig.position.set(camPos.x - 26, 30, -90); sunRig.scale.setScalar(1); sunRig.rotation.z = Math.sin(t * .6) * .05;
  clouds.forEach(c => { c.position.x = c.userData.base + t * c.userData.sp; });
  sunLight.position.set(camLook.x + 11, 20, camLook.z + 13); sunLight.target.position.set(camLook.x, 0, camLook.z);
  updateIntro(t); updatePip(t); updateBloo(t); updateRed(t); updateYellow(t); updateBlue(t); updateGreen(t); updateFinale(t);
  runBursts(t);
  // confetti
  const cs = t > 76.3 && t < 86.5;
  confetti.forEach((m, i) => { m.visible = cs; if (!cs) return; const a = t - 76.3 + hash(i * 3.3) * 9, cyc = 7, ph = ((a % cyc) + cyc) % cyc; const x = X.finale + (hash(i * 1.7) - .5) * 30 + Math.sin(ph * 2 + i) * .8, y = 16 - ph * 2.4, z = -4 + hash(i * 5.1) * 14; m.position.set(x, y, z); m.rotation.set(ph * 3 + i, ph * 2, ph * 4); const sw = smooth(0, .5, t - 76.3); m.scale.setScalar(sw * clamp((y + 1) / 1)); });
  overlays(t);
  renderer.render(scene, camera);
}
window.frame = frame; window.__r = renderer; window.__s = scene; window.__l = sunLight;
document.fonts.load('700 100px Fredoka').then(() => { frame(0); window.ready = true; });
