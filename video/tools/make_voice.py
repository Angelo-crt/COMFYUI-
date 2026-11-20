"""Generate narration clips with Kokoro (neural TTS). Usage: make_voice.py MODEL VOICES OUTDIR"""
import sys, json, soundfile as sf
from kokoro_onnx import Kokoro
model, voices, out = sys.argv[1:4]
k = Kokoro(model, voices)
LINES = {
 "title": "Pip and Bloo's Rainbow Garden!",
 "hello": "Hello, little friends!",
 "meet": "This is Pip the bunny, and this is Bloo the bird!",
 "today": "Today, we are going to find all the colors of the rainbow!",
 "find_red": "Let's find the color... red!",
 "like_red": "Red, like a juicy apple!",
 "find_yellow": "Let's find the color... yellow!",
 "like_yellow": "Yellow, like a happy sunflower!",
 "find_blue": "Let's find the color... blue!",
 "like_blue": "Blue, like a fluttery butterfly!",
 "find_green": "Let's find the color... green!",
 "like_green": "Green, like a hoppy little froggy!",
 "one": "One!", "two": "Two!", "three": "Three!",
 "cheer_red": "Three red apples! Yay!",
 "cheer_yellow": "Three yellow flowers! Hooray!",
 "cheer_blue": "Three blue butterflies! Wow!",
 "cheer_green": "Three green frogs! Ribbit, ribbit!",
 "red": "Red!", "yellow": "Yellow!", "blue": "Blue!", "green": "Green!",
 "together": "Together, they make a beautiful rainbow!",
 "bye": "Great job, friends! Bye bye! See you next time!",
}
dur = {}
for name, text in LINES.items():
    speed = 0.92 if name in ("one","two","three") else 0.97
    s, sr = k.create(text, voice="af_heart", speed=speed, lang="en-us")
    sf.write(f"{out}/{name}.wav", s, sr)
    dur[name] = round(len(s)/sr, 3)
json.dump(dur, open(f"{out}/durations.json", "w"), indent=1)
print(json.dumps(dur))
