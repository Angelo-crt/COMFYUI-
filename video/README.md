# Pip & Bloo's Rainbow Garden — 3D animated kids' video

An 88-second, 1920×1080, 24 fps, family-friendly 3D cartoon that teaches **colors and counting (1-2-3)**.

* **Story:** Pip the bunny and Bloo the bird walk through a magical garden finding red apples, yellow sunflowers,
  blue butterflies and green frogs — counting three of each — then the four colors build a big rainbow.
* **Look:** soft rounded characters with big expressive eyes, bright sky, rolling hills, clouds, a smiling sun,
  sparkles and confetti, dynamic camera (aerial reveal, close-ups, dollies, wide shots, pull-back).
* **Sound:** warm neural narrator (Kokoro TTS), a synthesized marimba/ukulele/glockenspiel score at 120 BPM
  (characters dance on the beat), plus sound effects (pops, boings, chirps, ribbits, sparkles, whooshes).

## Rebuild
```
pip install kokoro-onnx soundfile numpy pillow         # + kokoro-v1.0.int8.onnx & voices-v1.0.bin
python3 tools/make_voice.py k.onnx voices.bin build/voice   # narration clips
python3 tools/timeline.py                                    # master timeline (anim + audio)
python3 tools/make_audio.py                                  # music + sfx + mix -> build/audio.wav
(cd web && python3 -m http.server 8765 &)                    # serve the three.js scene
for i in 0 1 2 3; do node tools/render.js $((i*528)) $((i*528+528)) 1 build/frames & done; wait
tools/assemble.sh                                            # -> pip_and_bloo_rainbow_garden.mp4
```
The scene (`web/scene.js`) is pure three.js, deterministic per time `t`, rendered headlessly with Playwright/Chromium
(no GPU needed). Edit `tools/timeline.py` to retime story beats.
