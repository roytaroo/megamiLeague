"""テクスチャ(PNG)を生成し、QuickChat.mcaddon を作るビルドスクリプト。

使い方: python3 build.py
"""
import os
import struct
import zipfile
import zlib

ROOT = os.path.dirname(os.path.abspath(__file__))

# 16x16 の吹き出しアイコン
#  . = 透明, K = 縁, W = 白, B = 水色(影), D = ドット
ITEM_ART = [
    "................",
    "..KKKKKKKKKKKK..",
    ".KWWWWWWWWWWWWK.",
    ".KWWWWWWWWWWWBK.",
    ".KWWWWWWWWWWWBK.",
    ".KWWDDWWDDWWDDK.",
    ".KWWDDWWDDWWDDK.",
    ".KWWWWWWWWWWWBK.",
    ".KWWWWWWWWWWWBK.",
    ".KBBBBBBBBBBBBK.",
    "..KKKKBBKKKKKK..",
    "......KBK.......",
    ".......KBK......",
    "........KK......",
    "................",
    "................",
]
PALETTE = {
    ".": (0, 0, 0, 0),
    "K": (24, 38, 64, 255),
    "W": (245, 250, 255, 255),
    "B": (150, 200, 240, 255),
    "D": (40, 120, 220, 255),
}
PACK_BG = (60, 40, 70, 255)


def write_png(path, pixels):
    h, w = len(pixels), len(pixels[0])
    raw = b"".join(b"\x00" + b"".join(bytes(px) for px in row) for row in pixels)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)


def item_pixels():
    return [[PALETTE[c] for c in row] for row in ITEM_ART]


def pack_icon_pixels(scale=8):
    art = item_pixels()
    out = []
    for y in range(16 * scale):
        row = []
        for x in range(16 * scale):
            px = art[y // scale][x // scale]
            row.append(px if px[3] else PACK_BG)
        out.append(row)
    return out


def build():
    write_png(os.path.join(ROOT, "QuickChat_RP/textures/items/quick_chat.png"), item_pixels())
    icon = pack_icon_pixels()
    write_png(os.path.join(ROOT, "QuickChat_RP/pack_icon.png"), icon)
    write_png(os.path.join(ROOT, "QuickChat_BP/pack_icon.png"), icon)

    out = os.path.join(ROOT, "QuickChat.mcaddon")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for pack in ("QuickChat_BP", "QuickChat_RP"):
            for dirpath, _, files in os.walk(os.path.join(ROOT, pack)):
                for name in sorted(files):
                    full = os.path.join(dirpath, name)
                    z.write(full, os.path.relpath(full, ROOT))
    print(f"built {out}")


if __name__ == "__main__":
    build()
