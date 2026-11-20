"""Single source of truth for timing. Writes web/timeline.js (for the 3D scene) and build/timeline.json (for audio)."""
import json, os
ROOT = os.path.join(os.path.dirname(__file__), "..")
D = json.load(open(f"{ROOT}/build/voice/durations.json"))

FPS = 24
DURATION = 88.0
BPM = 120

voice = []   # (clip, start)
sfx = []     # (name, time)
def v(clip, t): voice.append({"clip": clip, "t": round(t, 3), "d": D[clip]})
def s(name, t): sfx.append({"name": name, "t": round(t, 3)})

v("title", 0.8)
v("hello", 5.4); v("meet", 7.2); v("today", 11.2)

COLORS = ["red", "yellow", "blue", "green"]
STATION_X = {"intro": 0, "red": 16, "yellow": 32, "blue": 48, "green": 64, "finale": 80}
SCENE_START = {"red": 17, "yellow": 30, "blue": 43, "green": 56}
scenes = {}
for c in COLORS:
    S = SCENE_START[c]
    v(f"find_{c}", S + 0.6)
    v(f"like_{c}", S + 3.0)
    v("one", S + 5.8)
    v("two", S + 7.0)
    v(f"cheer_{c}", S + 8.3)   # starts with the word "Three"
    counts = [S + 5.9, S + 7.1, S + 8.35]
    word_t = S + 0.6 + D[f"find_{c}"] - 0.55      # the colour word is spoken at the end of "find" clip
    scenes[c] = {"start": S, "x": STATION_X[c], "word_t": round(word_t, 3), "counts": counts,
                 "celebrate": S + 9.6, "leave": S + 11.0}
    s("sparkle", word_t); [s("pop", t) for t in counts]
    s("tada", S + 9.6)
    s("whoosh", S + 11.0)

# finale
F = 69.0
rb = {"red": 70.0, "yellow": 71.4, "blue": 72.8, "green": 74.2}
for c, t in rb.items():
    v(c, t); s("sparkle", t)
v("together", 76.0); s("tada", 76.0)
v("bye", 82.0)
s("whoosh", 17 - 0.9); s("whoosh", 69 - 0.2)
s("tada", 3.2); s("sparkle", 5.0)

tl = {
    "fps": FPS, "duration": DURATION, "bpm": BPM, "voice": voice, "sfx": sfx,
    "scenes": scenes, "stationX": STATION_X, "rainbow": rb, "finaleStart": F,
}
os.makedirs(f"{ROOT}/build", exist_ok=True)
json.dump(tl, open(f"{ROOT}/build/timeline.json", "w"), indent=1)
open(f"{ROOT}/web/timeline.js", "w").write("window.TL = " + json.dumps(tl) + ";\n")
print("timeline ok", len(voice), "voice clips", len(sfx), "sfx")
