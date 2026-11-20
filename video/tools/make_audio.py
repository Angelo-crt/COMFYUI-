"""Synthesize music + SFX, mix with narration -> build/audio.wav (44.1 kHz stereo). numpy + soundfile only."""
import json, os, math
import numpy as np, soundfile as sf

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TL = json.load(open(f"{ROOT}/build/timeline.json"))
SR = 44100
DUR = TL["duration"]; N = int(DUR * SR) + SR
BEAT = 60 / TL["bpm"]
rng = np.random.default_rng(7)

def note(name):
    n = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[name[0]]
    return 440 * 2 ** ((n + 12 * (int(name[-1]) - 4) - 9) / 12)

def add(buf, sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= len(buf[0]) or i < 0: return
    sig = sig[: len(buf[0]) - i]
    l = math.cos((pan + 1) * math.pi / 4); r = math.sin((pan + 1) * math.pi / 4)
    buf[0][i:i + len(sig)] += sig * gain * l * 1.414
    buf[1][i:i + len(sig)] += sig * gain * r * 1.414

def tt(d): return np.arange(int(d * SR)) / SR
def marimba(f, d=.6, v=1):
    t = tt(d); env = np.exp(-t * 7) * (1 - np.exp(-t * 600))
    s = np.sin(2*np.pi*f*t) + .45*np.sin(2*np.pi*4*f*t)*np.exp(-t*20) + .12*np.sin(2*np.pi*9.8*f*t)*np.exp(-t*40)
    return s * env * v * .55
def glock(f, d=1.2, v=1):
    t = tt(d); env = np.exp(-t * 3.2) * (1 - np.exp(-t * 800))
    return (np.sin(2*np.pi*f*t) + .5*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*2) + .25*np.sin(2*np.pi*f*5.4*t)*np.exp(-t*6)) * env * v * .35
def bass(f, d=.5, v=1):
    t = tt(d); env = np.exp(-t * 4.5) * (1 - np.exp(-t * 300))
    return (np.sin(2*np.pi*f*t) + .35*np.sin(2*np.pi*2*f*t)*np.exp(-t*6)) * env * v * .8
def pluck(f, d=.5, v=1):
    t = tt(d); env = (1 - np.exp(-t * 900))
    s = np.sin(2*np.pi*f*t)*np.exp(-t*5) + .5*np.sin(2*np.pi*2*f*t)*np.exp(-t*8) + .3*np.sin(2*np.pi*3*f*t)*np.exp(-t*12) + .15*np.sin(2*np.pi*4*f*t)*np.exp(-t*16)
    return s * env * v * .4
def pad(f, d, v=1):
    t = tt(d); env = np.minimum(1, t / .4) * np.minimum(1, (d - t) / .5)
    return (np.sin(2*np.pi*f*t) + .5*np.sin(2*np.pi*f*1.005*t) + .3*np.sin(2*np.pi*2*f*t)) * env * v * .12
def noise(d): return rng.standard_normal(int(d * SR))
def shaker(v=1, d=.07):
    t = tt(d); n = np.diff(noise(d + 1/SR)) ; return n * np.exp(-t * 55) * v * .22
def kick(v=1):
    t = tt(.22); f = 50 + 90*np.exp(-t*30); ph = 2*np.pi*np.cumsum(f)/SR
    return np.sin(ph) * np.exp(-t*14) * v * .9
def clap(v=1):
    t = tt(.12); n = np.diff(noise(.12 + 1/SR)); return n * np.exp(-t * 35) * v * .3
def bandnoise(d, lo, hi):
    n = noise(d); F = np.fft.rfft(n); fr = np.fft.rfftfreq(len(n), 1/SR); F[(fr < lo) | (fr > hi)] = 0; return np.fft.irfft(F, len(n))

music = [np.zeros(N), np.zeros(N)]
sfx = [np.zeros(N), np.zeros(N)]

# ------------------------------------------------ music
CH = {"C": (["C2"], ["C4", "E4", "G4"]), "G": (["G2"], ["B3", "D4", "G4"]), "Am": (["A2"], ["A3", "C4", "E4"]), "F": (["F2"], ["A3", "C4", "F4"])}
PROG = ["C", "G", "Am", "F", "C", "G", "F", "C"]
MEL = [
    ["E5", 0, "G5", "E5", "C5", 0, "E5", 0], ["D5", 0, "G5", "D5", "B4", 0, "D5", 0], ["E5", 0, "A5", "E5", "C5", 0, "E5", "A5"], ["F5", "E5", "C5", 0, "A4", 0, "C5", 0],
    ["G5", 0, "E5", "G5", "C6", 0, "G5", 0], ["B5", "A5", "G5", 0, "D5", 0, "G5", 0], ["A5", "G5", "F5", "E5", "F5", 0, "A5", 0], ["G5", "E5", "C5", "E5", "G5", 0, "C6", 0],
]
nbars = int(DUR / (4 * BEAT)) + 1
def level(t):  # arrangement intensity per time
    if t < 5: return 0
    if t < 17: return 1
    if t < 69: return 2
    if t < 86: return 3
    return 0
for bar in range(nbars):
    t0 = bar * 4 * BEAT
    if t0 >= DUR: break
    lv = level(t0); ch = PROG[bar % 8]; roots, notes = CH[ch]
    if t0 < 5:  # title fanfare: glock arps + pad
        for k, nm in enumerate(notes + ["C5"]): add(music, glock(note(nm) * 2 if k < 3 else note(nm) * 2), t0 + k * BEAT / 2, .2 * (k - 1.5) / 1.5)
        add(music, pad(note(roots[0]) * 2, 4 * BEAT), t0, 0, 1.2)
        continue
    if t0 >= 86:  # final chord
        for nm in ["C4", "E4", "G4", "C5"]: add(music, glock(note(nm), 2.5), t0)
        add(music, pad(note("C3"), 3), t0); continue
    mel = MEL[bar % 8]
    # bass
    add(music, bass(note(roots[0]) * (1 if lv else 1)), t0, -.1)
    add(music, bass(note(roots[0]) * (2 if lv < 3 else 1), .4, .8), t0 + 2 * BEAT, -.1)
    if lv >= 2:
        add(music, bass(note(roots[0]) * 2, .3, .6), t0 + 1.5 * BEAT, -.1); add(music, bass(note(roots[0]) * 2, .3, .6), t0 + 3.5 * BEAT, -.1)
    # strum on offbeats
    for b in (1, 3):
        for k, nm in enumerate(notes): add(music, pluck(note(nm), .4, .9 if lv >= 2 else .7), t0 + b * BEAT + k * .012, .35)
    if lv >= 3:
        for b in (.5, 1.5, 2.5, 3.5):
            for k, nm in enumerate(notes): add(music, pluck(note(nm), .25, .45), t0 + b * BEAT + k * .01, .35)
    # pad
    add(music, pad(note(notes[0]), 4 * BEAT), t0, 0, 1 if lv < 3 else 1.3)
    # percussion
    for b in (0, 2):
        add(music, kick(.7 if lv == 1 else 1), t0 + b * BEAT)
    for b in (1, 3):
        add(music, clap(.5 if lv == 1 else .9), t0 + b * BEAT)
    for e in range(8):
        add(music, shaker(1.0 if e % 2 else .55), t0 + e * BEAT / 2, -.3 if e % 2 else .3)
    # melody
    for e, nm in enumerate(mel):
        if nm:
            amp = 1.0
            if lv == 1 and bar % 2 == 1 and False: amp = 0
            add(music, marimba(note(nm), .55, amp), t0 + e * BEAT / 2, -.15)
            if lv >= 3: add(music, glock(note(nm) * 2, .9, .55), t0 + e * BEAT / 2, .2)
    if lv >= 2 and bar % 4 == 0: add(music, glock(note("C6"), 1.5, .8), t0, .25)
    if lv >= 2 and bar % 4 == 3:  # little fill
        for k, nm in enumerate(["C5", "D5", "E5", "G5"]): add(music, glock(note(nm) * 2, .5, .5), t0 + 3 * BEAT + k * BEAT / 4, .1)

# ------------------------------------------------ SFX
def pop(v=1):
    t = tt(.16); f = 280 + 900 * (1 - np.exp(-t * 35)); ph = 2*np.pi*np.cumsum(f)/SR
    return np.sin(ph) * np.exp(-t * 22) * v * .8
def boing(v=1):
    t = tt(.35); f = 200 + 120 * np.sin(2*np.pi*14*t) * np.exp(-t*6) + 150 * np.exp(-t * 8); ph = 2*np.pi*np.cumsum(f)/SR
    return np.sin(ph) * np.exp(-t * 7) * v * .6
def sparkle():
    out = np.zeros(int(1.4 * SR)); tw = ["E6", "G6", "C7", "E7", "G7", "C8"]
    for k, nm in enumerate(tw):
        g = glock(note(nm), .6, .5); i = int(k * .055 * SR); out[i:i + len(g)] += g[: len(out) - i]
    return out * .8
def tada():
    out = np.zeros(int(2.4 * SR))
    for k, nm in enumerate(["C5", "E5", "G5", "C6"]):
        g = glock(note(nm), 1.4, .9); i = int(k * .09 * SR); out[i:i + len(g)] += g[: len(out) - i]
    for nm in ["C4", "E4", "G4", "C5"]:
        g = marimba(note(nm), .9, .6); i = int(.36 * SR); out[i:i + len(g)] += g[: len(out) - i]
    return out
def whoosh():
    d = .9; t = tt(d); base = bandnoise(d, 300, 6000) if False else noise(d)
    F = np.fft.rfft(base); fr = np.fft.rfftfreq(len(base), 1/SR)
    out = np.zeros(len(base))
    for k, (c, w) in enumerate([(600, 400), (1500, 900), (3500, 1800)]):
        m = np.exp(-((fr - c) / w) ** 2); x = np.fft.irfft(F * m, len(base)); env = np.exp(-((t - (.2 + .22 * k)) / .17) ** 2); out += x * env
    return out / (np.abs(out).max() + 1e-9) * .45
def chirp(v=1):
    t = tt(.28); out = np.zeros_like(t)
    for s0, d in ((0, .1), (.13, .1)):
        m = (t >= s0) & (t < s0 + d); u = (t[m] - s0) / d; f = 2600 + 1400 * np.sin(u * np.pi) + 600 * u; out[m] = np.sin(2*np.pi*np.cumsum(f)/SR) * np.sin(u * np.pi)
    return out * v * .35
def ribbit(v=1):
    out = np.zeros(int(.5 * SR))
    for s0 in (0, .17):
        t = tt(.14); f = 170 + 40 * np.sin(2*np.pi*35*t); ph = 2*np.pi*np.cumsum(f)/SR
        sig = (np.sin(ph) + .5*np.sin(2*ph + 1) + .3*np.sign(np.sin(ph))) * np.sin(np.linspace(0, np.pi, len(t))) ** .6
        i = int(s0 * SR); out[i:i + len(sig)] += sig[: len(out) - i]
    return out * v * .35
def thump(v=1):
    t = tt(.2); f = 110 * np.exp(-t * 10) + 60; return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t * 18) * v * .8

for e in TL["sfx"]:
    t = e["t"]
    if e["name"] == "pop": add(sfx, pop(), t - .02, 0, 1.0)
    elif e["name"] == "sparkle": add(sfx, sparkle(), t, .2, .9)
    elif e["name"] == "tada": add(sfx, tada(), t, 0, .8)
    elif e["name"] == "whoosh": add(sfx, whoosh(), t, 0, .9)
SC = TL["scenes"]; order = ["red", "yellow", "blue", "green"]
for c in order:
    s = SC[c]
    for k, tk in enumerate(s["counts"]):
        add(sfx, boing(.9), tk - .12, -.3); add(sfx, chirp(.9), tk + .12, .5)
        if c == "red": add(sfx, thump(.9), tk + .95 + 0.72, .1 * (k - 1)); add(sfx, boing(.4), tk + .95 + .72 + .02, 0)
        if c == "green": add(sfx, ribbit(1.0), tk + .86, (k - 1) * .4); add(sfx, pop(.6), tk + .8)
        if c == "yellow": add(sfx, boing(.7), tk + .1, (k - 1) * .4)
    if c == "green":
        for k in range(3): add(sfx, ribbit(.8), s["celebrate"] + .5 + k * .5, (k - 1) * .4)
# hops while travelling
legs = [(15.2, 17.4)] + [(SC[c]["leave"], (SC[order[i + 1]]["start"] if i < 3 else TL["finaleStart"]) + .4) for i, c in enumerate(order)]
for a, b in legs:
    for k in range(1, 5):
        tl = a + (b - a) * k / 4; add(sfx, boing(.45), tl - .5 * (b - a) / 4 + .0, 0); add(sfx, thump(.35), tl, 0)
# intro/finale extras
for tj in (12.0, 13.2): add(sfx, boing(.7), tj - .1)
for t0 in (7.3, 9.5, 5.4): add(sfx, chirp(.8), t0, .5)
add(sfx, sparkle(), 75.8, .0, .9); add(sfx, sparkle(), 82.3, 0, .8)
for k in range(3): add(sfx, ribbit(.8), 77.0 + k * .45, (k - 1) * .5)
for k in range(3): add(sfx, ribbit(.8), 79.0 + k * .5, (k - 1) * .5)

# ------------------------------------------------ voice
voice = [np.zeros(N), np.zeros(N)]
for v in TL["voice"]:
    w, sr = sf.read(f"{ROOT}/build/voice/{v['clip']}.wav")
    if sr != SR: w = np.interp(np.arange(int(len(w) * SR / sr)) / SR, np.arange(len(w)) / sr, w)
    add(voice, w, v["t"], 0, 1.0)
v_mono = (voice[0] + voice[1]) / 2
# gentle room reverb on voice
ir = np.exp(-np.arange(int(.35 * SR)) / (.08 * SR)) * rng.standard_normal(int(.35 * SR)); ir[0] = 0
def reverb(x, wet=.1):
    n = len(x) + len(ir); X = np.fft.rfft(x, n) * np.fft.rfft(ir, n); return np.fft.irfft(X, n)[: len(x)] * wet / (np.abs(ir).sum() ** .5)
for ch in voice: ch += reverb(ch, .55)
# ducking: music lowers under voice
def movavg(x, w):
    c = np.cumsum(np.insert(x, 0, 0)); h = w // 2
    idx = np.arange(len(x)); lo = np.clip(idx - h, 0, len(x)); hi = np.clip(idx + h, 0, len(x)); return (c[hi] - c[lo]) / np.maximum(1, hi - lo)
env = movavg(np.abs(v_mono), int(.06 * SR))
env = np.clip(env / (np.percentile(env[env > 1e-4], 90) + 1e-9), 0, 1)
env = movavg(env, int(.25 * SR))
duck = 1 - .5 * np.clip(env * 1.2, 0, 1)

mix = []
for ch in range(2):
    m = music[ch] * duck * .62 + sfx[ch] * .75 + voice[ch] * 1.25
    mix.append(m)
mix = np.stack(mix, 1)[: int(DUR * SR)]
# fade in/out
fi = int(.6 * SR); fo = int(1.6 * SR); mix[:fi] *= np.linspace(0, 1, fi)[:, None]; mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix = mix / np.abs(mix).max() * .89
sf.write(f"{ROOT}/build/audio.wav", mix.astype(np.float32), SR)
print("audio written", mix.shape, "peak", np.abs(mix).max())
