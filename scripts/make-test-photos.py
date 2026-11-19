#!/usr/bin/env python3
"""Erzeugt Testfotos mit EXIF-Aufnahmedatum, verteilt über die letzten Monate.

Die Fotos-App (auch im iOS-Simulator) übernimmt DateTimeOriginal als Aufnahmedatum,
dadurch landen die Bilder in verschiedenen Monaten/Wochen der App.

Nutzung:  python3 scripts/make-test-photos.py [anzahl] [zielordner]
Braucht Pillow (pip3 install pillow).
"""
import colorsys
import os
import random
import sys
from datetime import datetime, timedelta

from PIL import Image, ImageDraw, ImageFont

count = int(sys.argv[1]) if len(sys.argv) > 1 else 40
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'test-photos')
os.makedirs(out, exist_ok=True)

random.seed(42)
now = datetime.now()
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 90)
    small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 54)
except OSError:
    font = small = ImageFont.load_default()

for i in range(count):
    # über ~5 Monate verteilt, mehrere Fotos pro Woche
    taken = now - timedelta(days=random.uniform(0, 150), hours=random.uniform(0, 12))
    r, g, b = colorsys.hsv_to_rgb(random.random(), 0.55, 0.85)
    w, h = (1200, 1600) if i % 3 else (1600, 1200)
    img = Image.new('RGB', (w, h), (int(r * 255), int(g * 255), int(b * 255)))
    d = ImageDraw.Draw(img)
    for _ in range(6):
        x0, y0 = random.randint(0, w), random.randint(0, h)
        rad = random.randint(60, 320)
        d.ellipse((x0 - rad, y0 - rad, x0 + rad, y0 + rad), outline=(255, 255, 255), width=10)
    d.text((80, 80), f'Test #{i + 1}', fill=(255, 255, 255), font=font)
    d.text((80, 200), taken.strftime('%d.%m.%Y %H:%M'), fill=(255, 255, 255), font=small)

    exif = Image.Exif()
    stamp = taken.strftime('%Y:%m:%d %H:%M:%S')
    exif[306] = stamp  # DateTime
    exif.get_ifd(0x8769)[36867] = stamp  # DateTimeOriginal
    exif.get_ifd(0x8769)[36868] = stamp  # DateTimeDigitized
    path = os.path.join(out, f'test-{i + 1:03d}.jpg')
    img.save(path, 'JPEG', quality=85, exif=exif)

def save(img, taken, name, comment=None):
    exif = Image.Exif()
    stamp = taken.strftime('%Y:%m:%d %H:%M:%S')
    exif[306] = stamp
    exif.get_ifd(0x8769)[36867] = stamp
    exif.get_ifd(0x8769)[36868] = stamp
    if comment:
        # So kennzeichnet iOS Screenshots (UserComment = "Screenshot")
        exif.get_ifd(0x8769)[37510] = b'ASCII\x00\x00\x00' + comment.encode()
    img.save(os.path.join(out, name), 'JPEG', quality=85, exif=exif)


# Zwei Serien: dasselbe Motiv mehrfach im Abstand weniger Sekunden
for s, base in enumerate([now - timedelta(days=3, hours=2), now - timedelta(days=9, hours=5)]):
    hue = random.random()
    for k in range(4 if s == 0 else 3):
        taken = base + timedelta(seconds=2 * k)
        r, g, b = colorsys.hsv_to_rgb(hue, 0.5, 0.9)
        img = Image.new('RGB', (1200, 1600), (int(r * 255), int(g * 255), int(b * 255)))
        d = ImageDraw.Draw(img)
        # leicht verschobener Kreis = „wackliges“ Motiv
        cx, cy = 600 + k * 40, 800 - k * 25
        d.ellipse((cx - 300, cy - 300, cx + 300, cy + 300), outline=(255, 255, 255), width=24)
        d.text((80, 80), f'Serie {s + 1} · Bild {k + 1}', fill=(255, 255, 255), font=font)
        d.text((80, 200), taken.strftime('%d.%m.%Y %H:%M:%S'), fill=(255, 255, 255), font=small)
        save(img, taken, f'series-{s + 1}-{k + 1}.jpg')

# Drei „Screenshots“ (Bildschirmformat + Screenshot-Markierung)
for k in range(3):
    taken = now - timedelta(days=3, hours=6 + k)
    img = Image.new('RGB', (1206, 2622), (245, 245, 247))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 1206, 300), fill=(30, 30, 36))
    d.text((80, 160), f'Screenshot {k + 1}', fill=(255, 255, 255), font=font)
    for row in range(8):
        d.rounded_rectangle((80, 420 + row * 260, 1126, 620 + row * 260), radius=30, fill=(225, 225, 232))
    save(img, taken, f'screenshot-{k + 1}.jpg', comment='Screenshot')

print(f'{count} Testfotos, 2 Serien und 3 Screenshots in {os.path.abspath(out)}')
