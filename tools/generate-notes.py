#!/usr/bin/env python3
"""
Generate the merge tones.

Synthesised rather than sourced: it keeps the repository free of third-party
audio licensing, and it means the timbre is a parameter rather than a
constraint. The sound has to survive being the only audio in a game about
calming down on a train, so it is a struck-bar tone — quick attack, long
exponential decay, no sustain, and no attack transient sharp enough to startle.

Minor pentatonic degrees, one per link of a chain, so a cascade walks up the
scale. Run with: python3 tools/generate-notes.py
"""

import math
import struct
import wave
from pathlib import Path

RATE = 32000
DURATION = 0.55
ROOT_HZ = 220.0  # A3
DEGREES = [0, 3, 5, 7, 10, 12]  # minor pentatonic, in semitones

# Partial amplitudes. The quiet upper partials are what stop it sounding like a
# test tone; the fast-decaying third is most of the "struck" quality.
PARTIALS = [(1.0, 1.0, 3.2), (2.0, 0.28, 5.0), (3.01, 0.10, 8.0)]

ATTACK = 0.006  # seconds; long enough that nothing clicks
PEAK = 0.62     # headroom, so a chain of these never clips


def render(freq: float) -> bytes:
    frames = int(RATE * DURATION)
    out = bytearray()
    for i in range(frames):
        t = i / RATE
        value = 0.0
        for ratio, amp, decay in PARTIALS:
            value += amp * math.sin(2 * math.pi * freq * ratio * t) * math.exp(-decay * t)
        envelope = min(1.0, t / ATTACK) if t < ATTACK else 1.0
        sample = value * envelope * PEAK / sum(a for _, a, _ in PARTIALS)
        out += struct.pack("<h", int(max(-1.0, min(1.0, sample)) * 32767))
    return bytes(out)


def main() -> None:
    target = Path(__file__).resolve().parent.parent / "assets" / "audio"
    target.mkdir(parents=True, exist_ok=True)
    for index, semitones in enumerate(DEGREES):
        freq = ROOT_HZ * (2 ** (semitones / 12))
        path = target / f"note-{index}.wav"
        with wave.open(str(path), "w") as f:
            f.setnchannels(1)
            f.setsampwidth(2)
            f.setframerate(RATE)
            f.writeframes(render(freq))
        print(f"{path.name}  {freq:7.2f} Hz  {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
