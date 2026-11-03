"""Trilha do filme da torre XPTO: uma base leve (Am9, 92 bpm) do começo ao fim, o motor sob o mastro e sob cada painel,
um bipe duplo em cada placa lida, três bipes no alerta de mandado e um clique em cada botão do operador.

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
CLICKS = (1.8, 5.0, 9.0, 13.4, 15.0, 15.6, 19.6, 26.0, 26.4, 33.4, 33.8, 42.6, 43.0, 49.4, 49.8, 50.4, 50.8, 57.8, 58.4, 58.6, 58.8, 59.2, 60.4)
DEPLOY = 0.0
STOW = 60.4
PATROL = 15.0
ALERT = PATROL + 22.02
READS = (PATROL + 7.43, PATROL + 30.49)


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 92, CHORDS, MOTIF, motif_voice="epiano", kicks=(0, 2.5), snares=(), hats=8, swing=0.0, keys_vel=0.7, keys_lp=3400)
    mix.put_stereo(0, left, right, 0.12)
    mix.put(0, low, 0.12)
    mix.put(0, drums, 0.045)
    # mastro subindo, os dois painéis um de cada vez; no fim o inverso
    mix.put(DEPLOY + 0.6, motor(5.8, 190, 1300, 14), 0.022)
    mix.put(DEPLOY + 6.6, motor(2.4, 160, 900, 10), 0.02)
    mix.put(DEPLOY + 9.2, motor(2.4, 150, 850, 10), 0.02)
    mix.put(DEPLOY + 11.8, airy(1.0, 600, 2200, 0.5), 0.03)
    mix.put(STOW + 1.0, motor(2.4, 150, 850, 10), 0.02)
    mix.put(STOW + 3.6, motor(2.4, 160, 900, 10), 0.02)
    mix.put(STOW + 6.2, motor(4.4, 185, 1200, 14), 0.02)
    # o alerta de mandado: três bipes descendentes
    for i, f in enumerate((1760, 1480, 1240)):
        mix.put(ALERT + i * 0.16, click(f, 0.09), 0.08)
    for t in READS:
        mix.put(t, click(3200, 0.05), 0.07)
        mix.put(t + 0.11, click(4200, 0.05), 0.07)
    for t in CLICKS:
        mix.put(t, click(2400, 0.025), 0.055)
