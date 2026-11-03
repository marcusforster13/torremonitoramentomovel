"""Trilha do filme da torre XPTO: uma base leve (Am9, 92 bpm) do começo ao fim, o motor sob a abertura dos painéis e
a subida do mastro, um bipe duplo em cada placa lida e um clique em cada botão do operador.

    python run_sfx.py <pasta>/src/score.py

Tempos de src/film.js (SCRIPT) e src/kin.js (as sequências e o instante de cada leitura).
"""

import os

from sfx.score_kit import airy, bed, chords, hz, motor
from sfx.synth import click

TIMELINE = "../film/timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "xpto-score.wav")
TARGET_LUFS = -14.0
SEED = 23

CHORDS = chords("Am9:A2 E3 G3 B3 C4/A1", "Fmaj7:F2 C3 E3 A3/F1", "Cmaj9:C3 E3 G3 B3 D4/C2", "G6:G2 D3 E3 B3/G1")
MOTIF = [(0.5, hz("E5")), (1.5, hz("G5")), (2.5, hz("D5"))]
CLICKS = (1.6, 6.0, 11.6, 12.4, 13.2, 14.6, 18.2, 18.8, 21.2, 21.6, 22.2, 24.6, 25.0, 25.4, 28.4, 28.8, 29.2, 29.6, 30.0)
DEPLOY = 0.0
STOW = 30.0
READS = (12.4 + 3.37, 12.4 + 9.79)


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 92, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(), hats=8, swing=0.0, keys_vel=0.7, keys_lp=3400)
    mix.put_stereo(0, left, right, 0.12)
    mix.put(0, low, 0.12)
    mix.put(0, drums, 0.045)
    # painéis abrindo, mastro subindo; no fim o inverso
    mix.put(DEPLOY + 0.6, motor(3.6, 160, 900, 10), 0.02)
    mix.put(DEPLOY + 4.4, motor(5.8, 190, 1300, 14), 0.022)
    mix.put(DEPLOY + 10.3, airy(1.0, 600, 2200, 0.5), 0.03)
    mix.put(STOW + 1.0, motor(5.0, 185, 1200, 14), 0.02)
    mix.put(STOW + 6.2, motor(3.2, 155, 850, 10), 0.02)
    for t in READS:
        mix.put(t, click(3200, 0.05), 0.07)
        mix.put(t + 0.11, click(4200, 0.05), 0.07)
    for t in CLICKS:
        mix.put(t, click(2400, 0.025), 0.055)
