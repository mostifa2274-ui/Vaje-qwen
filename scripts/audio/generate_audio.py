"""Pre-record every English prompt in the course with Kokoro-82M.

The app plays these clips before it ever falls back to the device's
speech engine. Clips are named by a hash of what they say (see
src/engine/audioClips.ts), so an edited sentence simply has no clip until
this script runs again, and the app then uses the device voice for it.

Inputs (not committed; see scripts/audio/README.md):
  --model   Kokoro-82M v1.0 ONNX at float32 precision (model.onnx, or
            model_fp16.onnx converted by upcast_model.py)
  --voice   a Kokoro v1.0 voice: a single-voice file such as af_heart.bin,
            or kokoro-onnx's voices-v1.0.bin pack with --voice-name

Output: public/audio/<hash>.mp3 and public/audio/index.json.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import zipfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SAMPLE_RATE = 24_000
# Sentences are recorded at the app's default narrator speed; clipPlaybackRate()
# in src/engine/audio.ts scales them from 0.92 when the learner changes it.
SPEED = {"w": 0.86, "s": 0.92}
LEAD_MS = {"w": 60, "s": 80}
TAIL_MS = {"w": 140, "s": 220}
BITRATE_KBPS = 40

# The vocabulary of the Kokoro v1.0 tokenizer (onnx-community tokenizer.json).
VOCAB = {
    ";": 1, ":": 2, ",": 3, ".": 4, "!": 5, "?": 6, "—": 9, "…": 10, '"': 11, "(": 12, ")": 13,
    "“": 14, "”": 15, " ": 16, "̃": 17, "ʣ": 18, "ʥ": 19, "ʦ": 20, "ʨ": 21, "ᵝ": 22,
    "ꭧ": 23, "A": 24, "I": 25, "O": 31, "Q": 33, "S": 35, "T": 36, "W": 39, "Y": 41, "ᵊ": 42,
    "a": 43, "b": 44, "c": 45, "d": 46, "e": 47, "f": 48, "h": 50, "i": 51, "j": 52, "k": 53,
    "l": 54, "m": 55, "n": 56, "o": 57, "p": 58, "q": 59, "r": 60, "s": 61, "t": 62, "u": 63,
    "v": 64, "w": 65, "x": 66, "y": 67, "z": 68, "ɑ": 69, "ɐ": 70, "ɒ": 71, "æ": 72, "β": 75,
    "ɔ": 76, "ɕ": 77, "ç": 78, "ɖ": 80, "ð": 81, "ʤ": 82, "ə": 83, "ɚ": 85, "ɛ": 86, "ɜ": 87,
    "ɟ": 90, "ɡ": 92, "ɥ": 99, "ɨ": 101, "ɪ": 102, "ʝ": 103, "ɯ": 110, "ɰ": 111, "ŋ": 112,
    "ɳ": 113, "ɲ": 114, "ɴ": 115, "ø": 116, "ɸ": 118, "θ": 119, "œ": 120, "ɹ": 123, "ɾ": 125,
    "ɻ": 126, "ʁ": 128, "ɽ": 129, "ʂ": 130, "ʃ": 131, "ʈ": 132, "ʧ": 133, "ʊ": 135, "ʋ": 136,
    "ʌ": 138, "ɣ": 139, "ɤ": 140, "χ": 142, "ʎ": 143, "ʒ": 147, "ʔ": 148, "ˈ": 156, "ˌ": 157,
    "ː": 158, "ʰ": 162, "ʲ": 164, "↓": 169, "→": 171, "↗": 172, "↘": 173, "ᵻ": 177,
}

# A word card says the word on its own, so function words get their full
# (stressed) form rather than the reduced one they have inside a sentence.
CITATION = {
    "a, an": "ˈA, ˈæn",
    "the": "ðˈi",
    "to": "tˈu",
    "of": "ˈʌv",
    "for": "fˈɔɹ",
    "and": "ˈænd",
    "at": "ˈæt",
    "from": "fɹˈʌm",
    "can": "kˈæn",
    "or": "ˈɔɹ",
    "but": "bˈʌt",
    "as": "ˈæz",
    "than": "ðˈæn",
    "them": "ðˈɛm",
    "us": "ˈʌs",
    "some": "sˈʌm",
    "that": "ðˈæt",
    "your": "jˈɔɹ",
    "her": "hˈɜɹ",
    "him": "hˈɪm",
    "his": "hˈɪz",
    "was": "wˈʌz",
    "have": "hˈæv",
    "do": "dˈu",
    "you": "jˈu",
    "we": "wˈi",
    "be": "bˈi",
    "by": "bˈI",
    "into": "ˈɪntu",
    "our": "ˈWəɹ",
    "their": "ðˈɛɹ",
    "must": "mˈʌst",
    "would": "wˈʊd",
    "could": "kˈʊd",
    "should": "ʃˈʊd",
    "will": "wˈɪl",
    "use": "jˈuz",
}


def fnv1a(data: bytes, seed: int) -> int:
    value = seed
    for byte in data:
        value ^= byte
        value = (value * 0x01000193) & 0xFFFFFFFF
    return value


def normalize(text: str) -> str:
    return " ".join(text.replace("’", "'").split())


def clip_id(kind: str, text: str) -> str:
    """Must match clipId() in src/engine/audioClips.ts."""
    data = f"{kind}|{normalize(text)}".encode("utf-8")
    return f"{fnv1a(data, 0x811C9DC5):08x}{fnv1a(data, 0x01000193 ^ 0x9E3779B9):08x}"


def collect() -> dict[str, tuple[str, str]]:
    """Every spoken prompt in the course, keyed by clip id."""
    clips: dict[str, tuple[str, str]] = {}

    def add(kind: str, text: str) -> None:
        text = normalize(text)
        if text:
            clips.setdefault(clip_id(kind, text), (kind, text))

    vocabulary = json.loads((ROOT / "src/data/vocabulary.json").read_text("utf-8"))
    for word in vocabulary:
        add("w", word["word"])
        add("s", word["ex"])
    for path in sorted((ROOT / "src/data/chapters").glob("*.json")):
        for sentence in json.loads(path.read_text("utf-8"))["sentences"]:
            add("s", sentence["en"])
    for path in sorted((ROOT / "src/data/bookTests").glob("*.json")):
        content = json.loads(path.read_text("utf-8"))
        for text in [*content["reading"], *content["listening"]]:
            for sentence in text["sentences"]:
                add("s", sentence["en"])
    # Sentences the app speaks outside the course content, such as the voice sample in Settings.
    for text in json.loads((ROOT / "scripts/audio/extra-prompts.json").read_text("utf-8")):
        add("s", text)
    return clips


class Speaker:
    def __init__(self, model: Path, voice: Path, threads: int, voice_name: str = "af_heart") -> None:
        # Imported here so clip_id() and collect() load without the model stack.
        import onnxruntime as ort
        from misaki import en, espeak

        options = ort.SessionOptions()
        options.intra_op_num_threads = threads
        self.session = ort.InferenceSession(str(model), options, providers=["CPUExecutionProvider"])
        # The onnx-community export names its token input "input_ids"; the
        # kokoro-onnx export of the same weights calls it "tokens".
        inputs = {item.name for item in self.session.get_inputs()}
        self.token_input = "input_ids" if "input_ids" in inputs else "tokens"
        self.voice = load_voice(voice, voice_name)
        self.g2p = en.G2P(trf=False, british=False, fallback=espeak.EspeakFallback(british=False))

    def phonemes(self, kind: str, text: str) -> str:
        if kind == "w" and text.lower() in CITATION:
            return CITATION[text.lower()]
        phonemes, _ = self.g2p(text.replace("’", "'"))
        return phonemes

    def speak(self, kind: str, text: str) -> np.ndarray:
        phonemes = self.phonemes(kind, text)
        tokens = [VOCAB[ch] for ch in phonemes if ch in VOCAB][:510]
        style = self.voice[min(len(tokens), len(self.voice) - 1)]
        audio = np.asarray(self.session.run(None, {
            self.token_input: np.array([[0, *tokens, 0]], dtype=np.int64),
            "style": style.astype(np.float32),
            "speed": np.array([SPEED[kind]], dtype=np.float32),
        })[0], dtype=np.float32).reshape(-1)
        # A half-precision graph can overflow into NaN, which encodes as
        # silence; never write a clip that is not clearly audible speech.
        if not np.isfinite(audio).all() or float(np.abs(audio).max()) < 0.05:
            raise RuntimeError(f"no audible speech for {kind} {text!r}; use the float32 model (upcast_model.py)")
        return trim(audio, kind)


def load_voice(path: Path, name: str) -> np.ndarray:
    """A voice's style vectors, from a single-voice file or a kokoro-onnx voice pack."""
    if zipfile.is_zipfile(path):
        return np.load(path)[name].reshape(-1, 1, 256)
    return np.fromfile(path, dtype=np.float32).reshape(-1, 1, 256)


def trim(audio: np.ndarray, kind: str) -> np.ndarray:
    level = np.abs(audio)
    threshold = max(1e-3, float(level.max()) * 0.02)
    voiced = np.flatnonzero(level > threshold)
    if voiced.size:
        audio = audio[max(0, voiced[0] - 240): voiced[-1] + 480]
    lead = np.zeros(int(SAMPLE_RATE * LEAD_MS[kind] / 1000), dtype=np.float32)
    tail = np.zeros(int(SAMPLE_RATE * TAIL_MS[kind] / 1000), dtype=np.float32)
    audio = np.concatenate([lead, audio, tail])
    peak = float(np.abs(audio).max()) or 1.0
    return audio * min(0.95 / peak, 4.0)


def mp3(audio: np.ndarray) -> bytes:
    import lameenc

    encoder = lameenc.Encoder()
    encoder.set_bit_rate(BITRATE_KBPS)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(1)
    encoder.set_quality(2)
    pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()
    return bytes(encoder.encode(pcm) + encoder.flush())


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--voice", type=Path, required=True)
    parser.add_argument("--voice-name", default="af_heart", help="the voice to use from a multi-voice pack")
    parser.add_argument("--out", type=Path, default=ROOT / "public/audio")
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--limit", type=int, default=0, help="only generate this many new clips (for a trial run)")
    parser.add_argument("--rerecord", choices=["w", "s"], help="record every clip of this kind again, e.g. after a voice fix")
    args = parser.parse_args()

    clips = collect()
    args.out.mkdir(parents=True, exist_ok=True)
    speaker = Speaker(args.model, args.voice, args.threads, args.voice_name)
    # A clip's name hashes only its text, so a voice fix needs --rerecord.
    todo = [key for key in sorted(clips) if clips[key][0] == args.rerecord or not (args.out / f"{key}.mp3").exists()]
    if args.limit:
        todo = todo[: args.limit]
    print(f"{len(clips)} clips in the course, {len(todo)} to generate", flush=True)

    started = time.time()
    for done, key in enumerate(todo, 1):
        kind, text = clips[key]
        (args.out / f"{key}.mp3").write_bytes(mp3(speaker.speak(kind, text)))
        if done % 50 == 0 or done == len(todo):
            rate = done / (time.time() - started)
            print(f"{done}/{len(todo)} ({rate:.1f} clips/s)", flush=True)

    # Stale clips from edited text are removed so the pack only holds what the course says.
    for stale in args.out.glob("*.mp3"):
        if stale.stem not in clips and not args.limit:
            stale.unlink()
    available = sorted(path.stem for path in args.out.glob("*.mp3"))
    voice = args.voice_name if zipfile.is_zipfile(args.voice) else args.voice.stem
    (args.out / "index.json").write_text(json.dumps({"voice": f"kokoro-v1.0:{voice}", "clips": available}, separators=(",", ":")) + "\n")
    print(f"index lists {len(available)} clips", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
