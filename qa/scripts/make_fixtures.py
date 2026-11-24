#!/usr/bin/env python3
"""Generate fixtures/benign.png (a plain, clearly non-serious image) with no third-party deps."""
import pathlib, struct, zlib

out = pathlib.Path(__file__).resolve().parent.parent / "fixtures"
out.mkdir(exist_ok=True)
W = H = 64


def chunk(t, d):
    c = struct.pack(">I", len(d)) + t + d
    return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)


raw = b"".join(b"\x00" + bytes([200, 230, 200]) * W for _ in range(H))   # pale green square
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
(out / "benign.png").write_bytes(png)
print("wrote", out / "benign.png")
