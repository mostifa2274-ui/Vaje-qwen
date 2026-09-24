# Recorded narration

Every English prompt the app speaks is pre-recorded: each vocabulary word, each
example sentence, every story sentence, every end-of-book test sentence and the
voice sample in Settings (`extra-prompts.json`). The clips live in
`public/audio/<id>.mp3`, and `public/audio/index.json` lists them.

A clip's id hashes its exact text (`clipId()` in `src/engine/audioClips.ts`,
`clip_id()` in `generate_audio.py`). When a text changes, its old clip no longer
matches. The app falls back to the device's speech engine for that prompt, and
`npm run validate:data` fails until the clips are regenerated. For a deliberate
partial run, set `GHESSE_ALLOW_MISSING_AUDIO=1`.

## Voice

[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) v1.0 (Apache-2.0), voice
`af_heart` (American English). It runs as the ONNX export on the CPU. Phonemes
come from misaki's G2P with an eSpeak NG fallback for out-of-lexicon words.
Words that are said very differently alone than in running speech ("a", "the",
"to"…) use the citation forms in `CITATION`.

| Input | Source | SHA-256 |
| --- | --- | --- |
| `model_fp16.onnx` (163,234,740 bytes) | `onnx-community/Kokoro-82M-v1.0-ONNX` → `onnx/model_fp16.onnx`, converted with `upcast_model.py` | `ba4527a874b42b21e35f468c10d326fdff3c7fc8cac1f85e9eb6c0dfc35c334a` |
| `af_heart.bin` (522,240 bytes) | `onnx-community/Kokoro-82M-v1.0-ONNX` → `voices/af_heart.bin` | `d583ccff3cdca2f7fae535cb998ac07e9fcb90f09737b9a41fa2734ec44a8f0b` |
| spaCy `en_core_web_sm` 3.8.0 | `pip install` from the spaCy release, or conda-forge `spacy-model-en_core_web_sm-3.8.0-pyhd8ed1ab_0.conda` | conda package `27649bd0e680285e186c71d8e3e7ac393a6ead2b857b5fb45e391579280e4121` |

## Precision

The fp16 export computes in half precision, and for about one prompt in
fifteen an intermediate value overflows, so the whole waveform becomes NaN,
which encodes as silence. `upcast_model.py` stores the same fp16 weights as
float32 and makes every cast target float32. The voice is unchanged, and the
arithmetic has enough headroom. The full-precision `onnx/model.onnx` works
too. The generator refuses to write a clip without clearly audible speech.

## Regenerating

```sh
python3 -m venv .venv-audio
.venv-audio/bin/pip install "misaki[en]==0.9.4" onnxruntime==1.30.0 onnx==1.19.1 lameenc==1.8.4 numpy
.venv-audio/bin/pip install https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl
.venv-audio/bin/python scripts/audio/upcast_model.py path/to/model_fp16.onnx model_fp32.onnx
.venv-audio/bin/python scripts/audio/generate_audio.py \
  --model model_fp32.onnx --voice path/to/af_heart.bin
npm run validate:data
```

The script records only the clips that are missing, then deletes clips that no
longer match any course text and rewrites `index.json`. A full run of about
4,000 clips takes roughly 45 minutes on four CPU threads. Use `--limit 20` for a
trial run.

Clips are trimmed and peak-normalised, then encoded as mono 40 kbps MP3 at
24 kHz (about 14 KB each).
