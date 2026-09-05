#!/usr/bin/env python3
"""Build grade-level word banks from published age-of-acquisition data."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import re
import urllib.request
from pathlib import Path


SOURCE_URL = (
    "https://raw.githubusercontent.com/GliteTech/research-ace-cefr/main/"
    "tasks/t0009_download_psycholinguistic_word_norms/assets/dataset/"
    "kuperman-aoa-2012/files/kuperman-aoa-2012.csv"
)
SOURCE_SHA256 = "59f04580155c2a9f7e65ef8b0666d590afaacb7f79665c04b0149de21d0c00dd"
MIN_FREQUENCY_PER_MILLION = 1.0
WORD_PATTERN = re.compile(r"^[a-z]+(?:['-][a-z]+)*$")
BANKS = {
    "1st-grade-words.csv": 7.0,
    "5th-grade-words.csv": 11.0,
}


def read_source(path: Path | None) -> bytes:
    if path is not None:
        return path.read_bytes()
    with urllib.request.urlopen(SOURCE_URL, timeout=30) as response:
        return response.read()


def verify_source(data: bytes) -> None:
    digest = hashlib.sha256(data).hexdigest()
    if digest != SOURCE_SHA256:
        raise ValueError(
            f"Source checksum changed: expected {SOURCE_SHA256}, got {digest}"
        )


def load_rows(data: bytes) -> list[tuple[str, float, float]]:
    text = data.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    required = {"Word", "Freq_pm", "Rating.Mean"}
    if reader.fieldnames is None or not required.issubset(reader.fieldnames):
        raise ValueError(f"Source must contain these columns: {sorted(required)}")

    rows: dict[str, tuple[str, float, float]] = {}
    for row in reader:
        word = row["Word"].strip().lower()
        if not WORD_PATTERN.fullmatch(word):
            continue
        try:
            age = float(row["Rating.Mean"])
            frequency = float(row["Freq_pm"])
        except (TypeError, ValueError):
            continue
        if frequency < MIN_FREQUENCY_PER_MILLION:
            continue
        rows[word] = (word, age, frequency)
    return list(rows.values())


def write_bank(
    output_path: Path,
    rows: list[tuple[str, float, float]],
    maximum_age: float,
) -> int:
    selected = [row for row in rows if row[1] <= maximum_age]
    selected.sort(key=lambda row: (-row[2], row[0]))

    with output_path.open("w", encoding="utf-8", newline="") as output_file:
        writer = csv.writer(output_file, lineterminator="\n")
        writer.writerow(("word", "age_of_acquisition", "frequency_per_million"))
        for word, age, frequency in selected:
            writer.writerow((word, f"{age:.6g}", f"{frequency:.6g}"))
    return len(selected)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        help="Use a local copy of the source CSV instead of downloading it.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "references",
    )
    args = parser.parse_args()

    data = read_source(args.source)
    verify_source(data)
    rows = load_rows(data)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for filename, maximum_age in BANKS.items():
        count = write_bank(args.output_dir / filename, rows, maximum_age)
        print(f"Wrote {count} words to {args.output_dir / filename}")


if __name__ == "__main__":
    main()
