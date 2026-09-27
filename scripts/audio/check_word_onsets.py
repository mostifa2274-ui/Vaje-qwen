"""Flag word clips that start with a vowel the word does not have.

Kokoro can open a single word with a short "uh" before its first consonant,
so "sit" plays as "uh-sit" (see LEAD_IN_FRAMES in generate_audio.py). The
reliable place to hear that by machine is a word whose first sound is a hiss
(s, f, sh): nothing pitched may come before the hiss. This checks every such
word clip and exits 1 if any has 30 ms or more of voicing before it.

usage: python scripts/audio/check_word_onsets.py [--audio public/audio]
Needs numpy and miniaudio (pip install numpy miniaudio).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_audio import clip_id  # noqa: E402

HISS_ONSETS = set("sfʃ")


def hiss_initial(ipa: str) -> bool:
    """True when the word's first sound (from its IPA) is s, f or sh."""
    first = ipa.lstrip("/ˈˌ ").strip()
    return bool(first) and first[0] in HISS_ONSETS


def frame_labels(audio: np.ndarray, sample_rate: int) -> str:
    """One character per 10 ms: '.' quiet, 'N' noise (hiss), 'V' voiced, '~' other."""
    n = int(sample_rate * 0.01)
    lo, hi = int(sample_rate / 400), int(sample_rate / 75)
    frames = [audio[i:i + 2 * n] for i in range(0, len(audio) - 2 * n, n)]
    if not frames:
        return ""
    levels = [float(np.sqrt(np.mean(frame[:n] ** 2))) for frame in frames]
    top = max(levels) or 1.0
    labels = []
    for frame, level in zip(frames, levels):
        if level < top * 0.03:
            labels.append(".")
            continue
        crossings = float(np.mean(np.abs(np.diff(np.sign(frame[:n])))) / 2)
        centred = frame - frame.mean()
        corr = np.correlate(centred, centred, "full")[len(centred) - 1:]
        periodic = float(corr[lo:hi].max() / corr[0]) if corr[0] > 0 else 0.0
        labels.append("N" if crossings > 0.25 else "V" if periodic > 0.5 else "~")
    return "".join(labels)


def voicing_before_hiss(labels: str) -> int | None:
    """Voiced 10 ms frames before the first 30 ms of hiss, or None if the clip
    does not open with hiss (a weak "f" can read as '~' and cannot be judged)."""
    hiss = re.search(r"N{3,}", labels)
    if not hiss or hiss.start() > 40:
        return None
    return labels[:hiss.start()].count("V")


def decode(path: Path) -> tuple[np.ndarray, int]:
    import miniaudio

    decoded = miniaudio.decode_file(str(path), output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1)
    return np.frombuffer(decoded.samples, dtype=np.float32), decoded.sample_rate


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--audio", type=Path, default=ROOT / "public/audio")
    args = parser.parse_args()

    vocabulary = json.loads((ROOT / "src/data/vocabulary.json").read_text("utf-8"))
    words = sorted({entry["word"] for entry in vocabulary if hiss_initial(entry["ipa"]) and " " not in entry["word"]})
    judged = 0
    voiced = []
    for word in words:
        path = args.audio / f"{clip_id('w', word)}.mp3"
        if not path.exists():
            continue
        labels = frame_labels(*decode(path))
        frames = voicing_before_hiss(labels)
        if frames is None:
            continue
        judged += 1
        if frames >= 3:
            voiced.append((word, labels.strip(".")[:30]))

    print(f"{len(words)} word clips start with s, f or sh; {judged} open with clear hiss, "
          f"and {len(voiced)} of those have a vowel before it")
    for word, labels in voiced:
        print(f"  {word:14s} {labels}")
    return 1 if voiced else 0


if __name__ == "__main__":
    sys.exit(main())
