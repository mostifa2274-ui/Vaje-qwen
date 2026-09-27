"""Temporary trial: which way of feeding a single word to Kokoro removes the
"uh" it can say before the word? Prints a comparison; writes nothing.

usage: python word_onset_trial.py --model model_fp32.onnx --voice af_heart.bin --strategy period
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_word_onsets import decode, frame_labels, hiss_initial, starts_voiced  # noqa: E402
from generate_audio import ROOT, SAMPLE_RATE, SPEED, VOCAB, Speaker, clip_id, mp3, trim  # noqa: E402

# name -> (phoneme prefix, phoneme suffix, style index from token count)
STRATEGIES = {
    "base": ("", "", lambda n: n),
    "style12": ("", "", lambda n: max(n, 12)),
    "style16": ("", "", lambda n: max(n, 16)),
    "style20": ("", "", lambda n: max(n, 20)),
    "style24": ("", "", lambda n: max(n, 24)),
    "style32": ("", "", lambda n: max(n, 32)),
}

# Words that end in a vowel, nasal or liquid should stop cleanly: a separate
# blip after a gap at the end is an artifact, not a released consonant.
SONORANTS = set("aeiouæɑɒɔəɚɛɜɪʊʌmnŋlɹrwj")


def sonorant_final(ipa: str) -> bool:
    ending = ipa.rstrip("/ː ").strip()
    return bool(ending) and ending[-1] in SONORANTS


def tail_blip(labels: str) -> bool:
    return re.search(r"[VN~]{4,}\.{3,}[VN~]{2,}$", labels.rstrip(".")) is not None


def mp3_round_trip(audio: np.ndarray) -> np.ndarray:
    import miniaudio

    decoded = miniaudio.decode(mp3(audio), output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1, sample_rate=SAMPLE_RATE)
    return np.frombuffer(decoded.samples, dtype=np.float32)


def synth(speaker: Speaker, text: str, strategy: str) -> np.ndarray:
    prefix, suffix, style_index = STRATEGIES[strategy]
    phonemes = prefix + speaker.phonemes("w", text) + suffix
    tokens = [VOCAB[ch] for ch in phonemes if ch in VOCAB][:510]
    style = speaker.voice[min(style_index(len(tokens)), len(speaker.voice) - 1)]
    audio = np.asarray(speaker.session.run(None, {
        "input_ids": np.array([[0, *tokens, 0]], dtype=np.int64),
        "style": style.astype(np.float32),
        "speed": np.array([SPEED["w"]], dtype=np.float32),
    })[0], dtype=np.float32).reshape(-1)
    return trim(audio, "w")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--voice", type=Path, required=True)
    parser.add_argument("--strategy", choices=sorted(STRATEGIES), required=True)
    args = parser.parse_args()
    name = args.strategy

    vocabulary = json.loads((ROOT / "src/data/vocabulary.json").read_text("utf-8"))
    singles = [entry for entry in vocabulary if re.fullmatch(r"[A-Za-z']+", entry["word"])]
    ipa = {entry["word"]: entry["ipa"] for entry in singles}
    hiss = sorted({entry["word"] for entry in singles if hiss_initial(entry["ipa"])})
    others = sorted({entry["word"] for entry in singles if not hiss_initial(entry["ipa"])})
    others = others[::max(1, len(others) // 60)][:60]
    speaker = Speaker(args.model, args.voice, 4)

    print(f"model outputs: {[output.name for output in speaker.session.get_outputs()]}", flush=True)
    clips = {word: mp3_round_trip(synth(speaker, word, name)) for word in hiss + others}
    labels = {word: frame_labels(clip, SAMPLE_RATE) for word, clip in clips.items()}
    bad = [word for word in hiss if starts_voiced(labels[word])]
    sonorant = [word for word in clips if sonorant_final(ipa[word])]
    blips = [word for word in sonorant if tail_blip(labels[word])]
    lengths = [len(clip) / SAMPLE_RATE for clip in clips.values()]
    print(f"{name}: vowel before the hiss {len(bad)}/{len(hiss)} {bad[:10]}", flush=True)
    print(f"{name}: tail blip {len(blips)}/{len(sonorant)} {blips[:10]}", flush=True)
    print(f"{name}: median length {np.median(lengths):.3f}s, p90 {np.percentile(lengths, 90):.3f}s", flush=True)
    for word in ["face", "fish", "sit", "farm", "final", "fire", "feel", "sun"]:
        if word in labels:
            print(f"{name}: {word:6s} {labels[word].strip('.')}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
