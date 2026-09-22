#!/usr/bin/env python3
"""Build an independent English word-frequency candidate pool from Tatoeba CC0.

This script intentionally does not read Ghesse vocabulary data. It is a one-way
source -> candidate generator used before any comparison with the legacy deck.
"""

from __future__ import annotations

import argparse
import bz2
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

TOKEN_RE = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)?")
SOURCE_URL = "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences_CC0.tsv.bz2"
SOURCE_LICENSE = "CC0-1.0"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_token(raw: str) -> str:
    return raw.lower().replace("’", "'")


def build_candidates(path: Path, limit: int) -> dict:
    token_counts: Counter[str] = Counter()
    sentence_counts: Counter[str] = Counter()
    sentences = 0
    malformed = 0

    with bz2.open(path, "rt", encoding="utf-8", errors="strict") as handle:
        for line in handle:
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 3:
                malformed += 1
                continue

            language = fields[1]
            text = fields[2]
            if language != "eng":
                malformed += 1
                continue

            tokens = [
                normalize_token(match.group(0))
                for match in TOKEN_RE.finditer(text)
            ]
            tokens = [token for token in tokens if len(token) > 1 or token in {"a", "i"}]
            if not tokens:
                sentences += 1
                continue

            token_counts.update(tokens)
            sentence_counts.update(set(tokens))
            sentences += 1

    ranked = sorted(
        token_counts,
        key=lambda token: (
            -sentence_counts[token],
            -token_counts[token],
            token,
        ),
    )[:limit]

    return {
        "schemaVersion": 1,
        "kind": "independent-frequency-candidates",
        "releaseClearingEvidence": False,
        "source": {
            "name": "Tatoeba English CC0 sentence export",
            "url": SOURCE_URL,
            "license": SOURCE_LICENSE,
            "sha256": sha256_file(path),
        },
        "method": {
            "tokenizer": "ASCII English words plus internal apostrophe; lowercase normalization",
            "ranking": "sentence frequency desc, token frequency desc, token asc",
            "limit": limit,
            "legacyVocabularyConsulted": False,
        },
        "stats": {
            "sentences": sentences,
            "malformedRows": malformed,
            "uniqueTokens": len(token_counts),
        },
        "candidates": [
            {
                "word": token,
                "sentenceCount": sentence_counts[token],
                "tokenCount": token_counts[token],
            }
            for token in ranked
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--limit", type=int, default=5000)
    args = parser.parse_args()

    if args.limit < 899:
        raise SystemExit("--limit must be at least 899 so the candidate pool can support an independent deck")
    if not args.input.is_file():
        raise SystemExit(f"input not found: {args.input}")

    result = build_candidates(args.input, args.limit)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {len(result['candidates'])} independent candidates from "
        f"{result['stats']['sentences']} CC0 English sentences."
    )
    print(f"Source SHA-256: {result['source']['sha256']}")


if __name__ == "__main__":
    main()
