#!/usr/bin/env python3
"""The two display faces of the home page, cut down to what the page sets in them.

Anybody carries only headings and the big numbers (weights 800 to 900, every width), EB Garamond Italic only the voice
lines (weights 500 and 600). Both are cut to Basic Latin, the German letters, the most common accented letters and the
punctuation of English and German text, and to the weight range in use; widths, kerning and every OpenType feature stay. Public Sans, which sets everything
a visitor or an agent may bring (names, titles, prices), is left whole.

  python3 homepage/tools/fonts.py       writes site/fonts/anybody-display.woff2 and eb-garamond-voice-italic.woff2
Needs fonttools and brotli (pip), and the Latin variable files of Fontsource (npm install in homepage/).
"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'node_modules', '@fontsource-variable')
OUT = os.path.join(os.path.dirname(ROOT), 'site', 'fonts')
UNI = list(range(0x20, 0x7F)) + [ord(c) for c in 'ÄÖÜäöüßÉÈÊÀÁÇÑéèêàáíóúçñ'] + [0xA0, 0xA9, 0xAE, 0xB0, 0xB7, 0xD7, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2026, 0x2212, 0x20AC, 0x2122]
JOBS = [
    ('anybody/files/anybody-latin-wdth-normal.woff2', 'anybody-display.woff2', {'wght': (800, 900)}),
    ('eb-garamond/files/eb-garamond-latin-wght-italic.woff2', 'eb-garamond-voice-italic.woff2', {'wght': (400, 600)}),
]
os.makedirs(OUT, exist_ok=True)
for src, name, limits in JOBS:
    path = os.path.join(SRC, src)
    font = instancer.instantiateVariableFont(TTFont(path), limits)
    opt = subset.Options()
    opt.flavor = 'woff2'; opt.layout_features = ['*']; opt.name_IDs = ['*']; opt.notdef_outline = True; opt.glyph_names = False; opt.hinting = False
    s = subset.Subsetter(opt); s.populate(unicodes=UNI); s.subset(font)
    font.flavor = 'woff2'; out = os.path.join(OUT, name); font.save(out)
    t = TTFont(out)
    print(f"{name}: {os.path.getsize(path)} -> {os.path.getsize(out)} bytes, {t['maxp'].numGlyphs} glyphs, axes {[(a.axisTag, a.minValue, a.maxValue) for a in t['fvar'].axes]}")
