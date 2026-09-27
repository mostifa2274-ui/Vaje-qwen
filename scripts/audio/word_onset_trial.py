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
from generate_audio import ROOT, SAMPLE_RATE, SPEED, VOCAB, Speaker, clip_id, trim  # noqa: E402

# name -> (phoneme prefix, phoneme suffix, style index from token count)
STRATEGIES = {
    "base": ("", "", lambda n: n),
    "period": ("", ".", lambda n: n),
    "style32": ("", "", lambda n: max(n, 32)),
    "period32": ("", ".", lambda n: max(n, 32)),
    "wrap": ("… ", ".", lambda n: n),
    "space_period": (" ", ".", lambda n: n),
}


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


def to_16k(audio: np.ndarray) -> np.ndarray:
    positions = np.arange(0, len(audio), SAMPLE_RATE / 16_000)
    return np.interp(positions, np.arange(len(audio)), audio).astype(np.float32)


def clean(text: str) -> str:
    return re.sub(r"[^a-z' ]", "", text.lower()).strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--voice", type=Path, required=True)
    parser.add_argument("--strategy", choices=sorted(STRATEGIES), required=True)
    args = parser.parse_args()
    name = args.strategy

    vocabulary = json.loads((ROOT / "src/data/vocabulary.json").read_text("utf-8"))
    singles = [entry for entry in vocabulary if re.fullmatch(r"[A-Za-z']+", entry["word"])]
    hiss = sorted({entry["word"] for entry in singles if hiss_initial(entry["ipa"])})
    others = sorted({entry["word"] for entry in singles if not hiss_initial(entry["ipa"])})
    others = others[::max(1, len(others) // 60)][:60]
    speaker = Speaker(args.model, args.voice, 4)

    clips = {word: synth(speaker, word, name) for word in hiss + others}
    bad = [word for word in hiss if starts_voiced(frame_labels(clips[word], SAMPLE_RATE))]
    lengths = [len(clip) / SAMPLE_RATE for clip in clips.values()]
    print(f"{name}: vowel before the hiss in {len(bad)}/{len(hiss)} words, median {np.median(lengths):.2f}s", flush=True)
    print(f"{name}: e.g. {bad[:12]}", flush=True)

    if name == "base":
        # The pipeline here reproduces the committed clips.
        committed = {word: starts_voiced(frame_labels(*decode(ROOT / "public/audio" / f"{clip_id('w', word)}.mp3"))) for word in hiss}
        agree = sum(committed[word] == (word in bad) for word in hiss)
        print(f"base: agrees with the committed clips on {agree}/{len(hiss)} words", flush=True)

    # Does speech recognition hear the right word, and no "a" before it?
    from faster_whisper import WhisperModel

    asr = WhisperModel("base.en", device="cpu", compute_type="int8")
    right, prefixed, misses = 0, [], []
    for word, clip in clips.items():
        segments, _ = asr.transcribe(to_16k(clip), language="en", beam_size=5,
                                     without_timestamps=True, condition_on_previous_text=False)
        heard = clean("".join(segment.text for segment in segments))
        if heard == word.lower():
            right += 1
        elif re.fullmatch(rf"(a|uh|ah|the|an) {re.escape(word.lower())}", heard):
            prefixed.append(heard)
        else:
            misses.append(f"{word}->{heard or '-'}")
    print(f"{name}: ASR exact {right}/{len(clips)}, heard a prefix {len(prefixed)} {prefixed[:8]}", flush=True)
    print(f"{name}: ASR other {len(misses)} {misses[:20]}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
