#!/usr/bin/env python3
"""
Generates high-resolution 32-bit RGBA PNG textures and multi-layered vector SVG
images for all playable fighter jets, enemy aircraft, and aerial boss dreadnoughts
in assets/planes/. Zero third-party dependencies (uses stdlib zlib, struct, math).
"""

import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "planes")


def write_png(path, width, height, rgba_bytes):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        start = y * stride
        raw.extend(rgba_bytes[start : start + stride])

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), level=6)
    png_data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png_data)


class RasterCanvas:
    def __init__(self, size):
        self.size = size
        self.buf = bytearray(size * size * 4)

    def _blend(self, x, y, r, g, b, a):
        if x < 0 or x >= self.size or y < 0 or y >= self.size or a <= 0:
            return
        idx = (y * self.size + x) * 4
        sa = a / 255.0
        da = self.buf[idx + 3] / 255.0
        out_a = sa + da * (1.0 - sa)
        if out_a <= 0.001:
            return
        inv = 1.0 - sa
        self.buf[idx] = min(255, int((r * sa + self.buf[idx] * da * inv) / out_a))
        self.buf[idx + 1] = min(255, int((g * sa + self.buf[idx + 1] * da * inv) / out_a))
        self.buf[idx + 2] = min(255, int((b * sa + self.buf[idx + 2] * da * inv) / out_a))
        self.buf[idx + 3] = min(255, int(out_a * 255))

    def fill_poly(self, pts_norm, col_center, col_edge=None, metallic=True):
        """Fill normalized polygon (-1..1 coords, nose pointing UP -Y) with bounding-box scanline + shading."""
        s = self.size
        half = s * 0.5
        pts = [((px + 1.0) * half, (py + 1.0) * half) for px, py in pts_norm]
        n = len(pts)
        if n < 3:
            return
        min_x = max(0, int(min(p[0] for p in pts)) - 1)
        max_x = min(s - 1, int(max(p[0] for p in pts)) + 1)
        min_y = max(0, int(min(p[1] for p in pts)) - 1)
        max_y = min(s - 1, int(max(p[1] for p in pts)) + 1)

        c_edge = col_edge if col_edge is not None else (
            max(0, int(col_center[0] * 0.55)),
            max(0, int(col_center[1] * 0.55)),
            max(0, int(col_center[2] * 0.55)),
            col_center[3],
        )

        cx = sum(p[0] for p in pts) / n
        rx_span = max(1.0, (max_x - min_x) * 0.5)

        for y in range(min_y, max_y + 1):
            yf = y + 0.5
            xs = []
            for i in range(n):
                x1, y1 = pts[i]
                x2, y2 = pts[(i + 1) % n]
                if (y1 <= yf < y2) or (y2 <= yf < y1):
                    t = (yf - y1) / (y2 - y1)
                    xs.append(x1 + t * (x2 - x1))
            if not xs:
                continue
            xs.sort()
            for k in range(0, len(xs) - 1, 2):
                x_start = max(min_x, int(math.ceil(xs[k] - 0.5)))
                x_end = min(max_x, int(math.floor(xs[k + 1] - 0.5)))
                for x in range(x_start, x_end + 1):
                    if metallic:
                        # Highlight center spine & left directional sun specular
                        dx_norm = abs(x - half) / rx_span
                        sun = max(0.0, min(1.0, 0.25 - (x - cx) / (s * 0.6)))
                        t = min(1.0, dx_norm * 0.85)
                        r = int(col_center[0] * (1 - t) + c_edge[0] * t + sun * 42)
                        g = int(col_center[1] * (1 - t) + c_edge[1] * t + sun * 48)
                        b = int(col_center[2] * (1 - t) + c_edge[2] * t + sun * 58)
                    else:
                        r, g, b = col_center[0], col_center[1], col_center[2]
                    self._blend(x, y, min(255, r), min(255, g), min(255, b), col_center[3])

    def draw_line(self, p1_norm, p2_norm, col, width_px=1.6):
        s = self.size
        half = s * 0.5
        x1, y1 = (p1_norm[0] + 1.0) * half, (p1_norm[1] + 1.0) * half
        x2, y2 = (p2_norm[0] + 1.0) * half, (p2_norm[1] + 1.0) * half
        dist = math.hypot(x2 - x1, y2 - y1)
        steps = max(2, int(dist * 2))
        rad = width_px * 0.5
        for i in range(steps + 1):
            t = i / steps
            px = x1 + (x2 - x1) * t
            py = y1 + (y2 - y1) * t
            ix0, ix1 = int(px - rad - 1), int(px + rad + 1)
            iy0, iy1 = int(py - rad - 1), int(py + rad + 1)
            for yy in range(iy0, iy1 + 1):
                for xx in range(ix0, ix1 + 1):
                    d = math.hypot(xx + 0.5 - px, yy + 0.5 - py)
                    if d <= rad + 0.8:
                        cov = max(0.0, min(1.0, rad + 0.8 - d))
                        self._blend(xx, yy, col[0], col[1], col[2], int(col[3] * cov))

    def fill_ellipse(self, cx_n, cy_n, rx_n, ry_n, col_inner, col_outer=None):
        s = self.size
        half = s * 0.5
        cx, cy = (cx_n + 1.0) * half, (cy_n + 1.0) * half
        rx, ry = max(1.0, rx_n * half), max(1.0, ry_n * half)
        c_out = col_outer if col_outer is not None else col_inner
        x0 = max(0, int(cx - rx - 1))
        x1 = min(s - 1, int(cx + rx + 1))
        y0 = max(0, int(cy - ry - 1))
        y1 = min(s - 1, int(cy + ry + 1))
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx = (x + 0.5 - cx) / rx
                dy = (y + 0.5 - cy) / ry
                d2 = dx * dx + dy * dy
                if d2 <= 1.0:
                    d = math.sqrt(d2)
                    edge_aa = min(1.0, (1.0 - d) * min(rx, ry) * 0.9)
                    r = int(col_inner[0] * (1 - d) + c_out[0] * d)
                    g = int(col_inner[1] * (1 - d) + c_out[1] * d)
                    b = int(col_inner[2] * (1 - d) + c_out[2] * d)
                    a = int((col_inner[3] * (1 - d) + c_out[3] * d) * max(0.0, min(1.0, edge_aa)))
                    self._blend(x, y, r, g, b, a)


def mirror_poly(half_pts):
    """Given right-side vertices from top center to bottom center, mirror across X=0."""
    left = [(-x, y) for x, y in reversed(half_pts) if abs(x) > 1e-4]
    return half_pts + left


def hex_rgb(hex_str, alpha=255):
    h = hex_str.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def rgb_hex(c):
    return f"#{c[0]:02x}{c[1]:02x}{c[2]:02x}"


# Aircraft blueprint definitions (nose UP = -Y, normalized -1..1)
AIRCRAFT_SPECS = [
    {
        "id": "vanguard",
        "title": "F-99 VALKYRIE // VANGUARD-X",
        "size": 256,
        "hull": "#82a8c9",
        "hull_dark": "#2d4363",
        "accent": "#2cf5ff",
        "glow": "#ff2ebd",
        "canopy": "#9ff9ff",
        "wings": mirror_poly([(0.06, -0.22), (0.36, -0.05), (0.86, -0.28), (0.90, -0.04), (0.38, 0.34), (0.14, 0.36)]),
        "canards": mirror_poly([(0.07, -0.58), (0.28, -0.44), (0.24, -0.32), (0.07, -0.36)]),
        "fuselage": mirror_poly([(0.0, -0.92), (0.09, -0.62), (0.17, -0.20), (0.20, 0.42), (0.12, 0.72), (0.0, 0.64)]),
        "tails": mirror_poly([(0.12, 0.34), (0.40, 0.68), (0.36, 0.78), (0.12, 0.66)]),
        "nozzles": [(-0.09, 0.72), (0.09, 0.72)],
        "canopy_box": (0.0, -0.44, 0.068, 0.19),
        "stripes": [((-0.82, -0.20), (-0.40, 0.04)), ((0.82, -0.20), (0.40, 0.04))],
        "rotors": [],
    },
    {
        "id": "tesla",
        "title": "EA-77 TEMPEST // TESLA-9",
        "size": 256,
        "hull": "#7998d6",
        "hull_dark": "#22345e",
        "accent": "#4ca6ff",
        "glow": "#ffd02e",
        "canopy": "#ffe57a",
        "wings": mirror_poly([(0.08, -0.26), (0.88, 0.08), (0.88, 0.28), (0.42, 0.24), (0.15, 0.34)]),
        "canards": mirror_poly([(0.24, -0.34), (0.35, -0.34), (0.38, 0.68), (0.22, 0.68)]),
        "fuselage": mirror_poly([(0.0, -0.88), (0.11, -0.55), (0.16, 0.15), (0.14, 0.62), (0.0, 0.56)]),
        "tails": mirror_poly([(0.25, 0.52), (0.50, 0.70), (0.44, 0.78), (0.24, 0.68)]),
        "nozzles": [(-0.29, 0.69), (0.29, 0.69)],
        "canopy_box": (0.0, -0.42, 0.075, 0.17),
        "radome": (0.0, 0.12, 0.16),
        "stripes": [((-0.78, 0.12), (-0.36, 0.18)), ((0.78, 0.12), (0.36, 0.18))],
        "rotors": [],
    },
    {
        "id": "chronos",
        "title": "SR-00 ECLIPSE // CHRONOS-0",
        "size": 256,
        "hull": "#6a5c9e",
        "hull_dark": "#1f1938",
        "accent": "#b066ff",
        "glow": "#2eff9f",
        "canopy": "#9dffda",
        "wings": mirror_poly([(0.07, -0.30), (0.26, -0.10), (0.82, 0.44), (0.78, 0.58), (0.20, 0.52)]),
        "canards": mirror_poly([(0.04, -0.68), (0.16, -0.44), (0.08, -0.34)]),
        "fuselage": mirror_poly([(0.0, -0.95), (0.07, -0.66), (0.14, 0.0), (0.19, 0.62), (0.07, 0.78), (0.0, 0.72)]),
        "tails": mirror_poly([(0.24, 0.34), (0.34, 0.66), (0.28, 0.74), (0.20, 0.56)]),
        "nozzles": [(-0.11, 0.76), (0.11, 0.76)],
        "canopy_box": (0.0, -0.48, 0.055, 0.18),
        "stripes": [((-0.72, 0.44), (-0.22, 0.05)), ((0.72, 0.44), (0.22, 0.05))],
        "rotors": [],
    },
    {
        "id": "solaris",
        "title": "B-42 VALKYRIE // SOLARIS-V",
        "size": 256,
        "hull": "#b36270",
        "hull_dark": "#471c29",
        "accent": "#ff4866",
        "glow": "#ffb830",
        "canopy": "#ffd47a",
        "wings": mirror_poly([(0.10, -0.26), (0.86, 0.22), (0.90, 0.42), (0.38, 0.38), (0.16, 0.48)]),
        "canards": mirror_poly([(0.08, -0.54), (0.28, -0.36), (0.24, -0.26), (0.08, -0.32)]),
        "fuselage": mirror_poly([(0.0, -0.90), (0.12, -0.60), (0.22, -0.10), (0.24, 0.54), (0.14, 0.74), (0.0, 0.68)]),
        "tails": mirror_poly([(0.14, 0.46), (0.46, 0.74), (0.40, 0.82), (0.14, 0.68)]),
        "nozzles": [(-0.15, 0.75), (-0.05, 0.75), (0.05, 0.75), (0.15, 0.75)],
        "canopy_box": (0.0, -0.46, 0.085, 0.17),
        "stripes": [((-0.80, 0.25), (-0.24, -0.02)), ((0.80, 0.25), (0.24, -0.02))],
        "rotors": [],
    },
    {
        "id": "enemy_swarmer",
        "title": "MiG-X DELTA INTERCEPTOR",
        "size": 256,
        "hull": "#a84c5c",
        "hull_dark": "#3d1522",
        "accent": "#ff335f",
        "glow": "#ff7a99",
        "canopy": "#ff8da8",
        "wings": mirror_poly([(0.06, -0.28), (0.78, 0.38), (0.72, 0.56), (0.16, 0.46)]),
        "canards": [],
        "fuselage": mirror_poly([(0.0, -0.86), (0.11, -0.45), (0.14, 0.52), (0.0, 0.66)]),
        "tails": [],
        "nozzles": [(0.0, 0.68)],
        "canopy_box": (0.0, -0.34, 0.06, 0.16),
        "stripes": [],
        "rotors": [],
    },
    {
        "id": "enemy_lancer",
        "title": "SU-57 VIPER STRIKER",
        "size": 256,
        "hull": "#c98b44",
        "hull_dark": "#4d2f10",
        "accent": "#ffb830",
        "glow": "#ff335f",
        "canopy": "#ffe594",
        "wings": mirror_poly([(0.08, -0.28), (0.84, 0.26), (0.82, 0.46), (0.22, 0.44)]),
        "canards": mirror_poly([(0.07, -0.56), (0.24, -0.38), (0.09, -0.34)]),
        "fuselage": mirror_poly([(0.0, -0.94), (0.10, -0.52), (0.17, 0.38), (0.08, 0.72), (0.0, 0.62)]),
        "tails": mirror_poly([(0.12, 0.46), (0.36, 0.74), (0.14, 0.68)]),
        "nozzles": [(-0.09, 0.72), (0.09, 0.72)],
        "canopy_box": (0.0, -0.46, 0.065, 0.18),
        "stripes": [((-0.74, 0.28), (-0.22, 0.04)), ((0.74, 0.28), (0.22, 0.04))],
        "rotors": [],
    },
    {
        "id": "enemy_weaver",
        "title": "RQ-9 LASER RELAY TWIN-PROP",
        "size": 256,
        "hull": "#49a87c",
        "hull_dark": "#153d2e",
        "accent": "#2eff9f",
        "glow": "#2cf5ff",
        "canopy": "#9dffda",
        "wings": mirror_poly([(0.08, -0.14), (0.90, -0.04), (0.90, 0.14), (0.10, 0.16)]),
        "canards": mirror_poly([(0.34, -0.28), (0.46, -0.28), (0.46, 0.28), (0.34, 0.28)]),
        "fuselage": mirror_poly([(0.0, -0.82), (0.10, -0.44), (0.12, 0.56), (0.0, 0.68)]),
        "tails": mirror_poly([(0.06, 0.48), (0.38, 0.66), (0.36, 0.74), (0.06, 0.66)]),
        "nozzles": [],
        "canopy_box": (0.0, -0.38, 0.065, 0.14),
        "stripes": [],
        "rotors": [(-0.40, -0.32, 0.20), (0.40, -0.32, 0.20)],
    },
    {
        "id": "enemy_aegis",
        "title": "AH-88 AEGIS ASSAULT GUNSHIP",
        "size": 256,
        "hull": "#4f9cb8",
        "hull_dark": "#1b3f54",
        "accent": "#2cf5ff",
        "glow": "#80ffff",
        "canopy": "#a3f7ff",
        "wings": mirror_poly([(0.12, -0.12), (0.62, -0.02), (0.60, 0.16), (0.14, 0.16)]),
        "canards": [],
        "fuselage": mirror_poly([(0.0, -0.78), (0.16, -0.44), (0.18, 0.18), (0.07, 0.80), (0.0, 0.84)]),
        "tails": mirror_poly([(0.03, 0.64), (0.28, 0.76), (0.26, 0.82), (0.03, 0.78)]),
        "nozzles": [(-0.15, 0.18), (0.15, 0.18)],
        "canopy_box": (0.0, -0.42, 0.10, 0.20),
        "stripes": [],
        "rotors": [(0.0, -0.05, 0.76)],
    },
    {
        "id": "enemy_splitter",
        "title": "XB-70 VALKYRIE CARRIER",
        "size": 256,
        "hull": "#8d5ec2",
        "hull_dark": "#2d1a4d",
        "accent": "#b066ff",
        "glow": "#ff2ebd",
        "canopy": "#e6b8ff",
        "wings": mirror_poly([(0.08, -0.24), (0.86, 0.34), (0.82, 0.56), (0.18, 0.56)]),
        "canards": mirror_poly([(0.06, -0.62), (0.26, -0.42), (0.08, -0.38)]),
        "fuselage": mirror_poly([(0.0, -0.92), (0.11, -0.50), (0.22, 0.24), (0.22, 0.66), (0.0, 0.66)]),
        "tails": mirror_poly([(0.54, 0.32), (0.62, 0.56), (0.52, 0.58)]),
        "nozzles": [(-0.14, 0.68), (0.0, 0.68), (0.14, 0.68)],
        "canopy_box": (0.0, -0.48, 0.075, 0.16),
        "stripes": [],
        "rotors": [],
    },
    {
        "id": "enemy_gravity_mine",
        "title": "V-22 SINGULARITY TILT-ROTOR",
        "size": 256,
        "hull": "#9b4ca8",
        "hull_dark": "#361642",
        "accent": "#e03eff",
        "glow": "#2cf5ff",
        "canopy": "#f5a8ff",
        "wings": mirror_poly([(0.12, -0.18), (0.68, -0.12), (0.68, 0.08), (0.14, 0.12)]),
        "canards": [],
        "fuselage": mirror_poly([(0.0, -0.68), (0.16, -0.44), (0.18, 0.22), (0.12, 0.66), (0.0, 0.62)]),
        "tails": mirror_poly([(0.08, 0.50), (0.36, 0.66), (0.36, 0.76), (0.08, 0.66)]),
        "nozzles": [],
        "canopy_box": (0.0, -0.44, 0.11, 0.15),
        "radome": (0.0, 0.06, 0.18),
        "stripes": [],
        "rotors": [(-0.66, -0.08, 0.30), (0.66, -0.08, 0.30)],
    },
    {
        "id": "enemy_prism_sniper",
        "title": "F-117 FACETED STEALTH RAIL-JET",
        "size": 256,
        "hull": "#b85c8c",
        "hull_dark": "#3b172e",
        "accent": "#ff4da6",
        "glow": "#2cf5ff",
        "canopy": "#ffc2e0",
        "wings": mirror_poly([(0.0, -0.92), (0.86, 0.42), (0.58, 0.68), (0.20, 0.50), (0.0, 0.68)]),
        "canards": [],
        "fuselage": mirror_poly([(0.0, -0.92), (0.20, -0.22), (0.22, 0.48), (0.0, 0.64)]),
        "tails": mirror_poly([(0.16, 0.46), (0.32, 0.72), (0.12, 0.64)]),
        "nozzles": [(-0.10, 0.66), (0.10, 0.66)],
        "canopy_box": (0.0, -0.40, 0.075, 0.16),
        "stripes": [((-0.50, 0.22), (0.0, -0.54)), ((0.50, 0.22), (0.0, -0.54))],
        "rotors": [],
    },
    {
        "id": "enemy_carrier",
        "title": "C-5 LEVIATHAN AIRBORNE CARRIER",
        "size": 256,
        "hull": "#c4844b",
        "hull_dark": "#4a2c14",
        "accent": "#ff952e",
        "glow": "#ffe066",
        "canopy": "#ffdf9e",
        "wings": mirror_poly([(0.16, -0.24), (0.94, 0.14), (0.94, 0.34), (0.20, 0.16)]),
        "canards": [],
        "fuselage": mirror_poly([(0.0, -0.84), (0.16, -0.62), (0.20, 0.48), (0.10, 0.80), (0.0, 0.78)]),
        "tails": mirror_poly([(0.08, 0.58), (0.48, 0.76), (0.46, 0.86), (0.08, 0.78)]),
        "nozzles": [(-0.56, 0.22), (-0.34, 0.14), (0.34, 0.14), (0.56, 0.22)],
        "canopy_box": (0.0, -0.60, 0.10, 0.12),
        "stripes": [],
        "rotors": [(-0.56, 0.04, 0.15), (-0.34, -0.04, 0.15), (0.34, -0.04, 0.15), (0.56, 0.04, 0.15)],
    },
    {
        "id": "boss_archon",
        "title": "XB-999 ARCHON SKY-FORTRESS",
        "size": 512,
        "hull": "#528eb3",
        "hull_dark": "#18304a",
        "accent": "#2cf5ff",
        "glow": "#ff2ebd",
        "canopy": "#b3fcff",
        "wings": mirror_poly([(0.0, -0.64), (0.42, -0.40), (0.96, 0.16), (0.92, 0.44), (0.52, 0.30), (0.30, 0.56), (0.0, 0.44)]),
        "canards": mirror_poly([(0.12, -0.74), (0.26, -0.52), (0.12, -0.44)]),
        "fuselage": mirror_poly([(0.0, -0.84), (0.18, -0.56), (0.24, 0.18), (0.16, 0.68), (0.0, 0.60)]),
        "tails": mirror_poly([(0.24, 0.34), (0.44, 0.62), (0.34, 0.68), (0.18, 0.54)]),
        "nozzles": [(-0.18, 0.64), (-0.06, 0.64), (0.06, 0.64), (0.18, 0.64)],
        "canopy_box": (0.0, -0.54, 0.11, 0.14),
        "stripes": [((-0.86, 0.20), (-0.20, -0.22)), ((0.86, 0.20), (0.20, -0.22))],
        "rotors": [(-0.68, 0.02, 0.14), (-0.42, -0.14, 0.14), (0.42, -0.14, 0.14), (0.68, 0.02, 0.14)],
    },
    {
        "id": "boss_seraphim",
        "title": "SERAPHIM COMMAND LEVIATHAN",
        "size": 512,
        "hull": "#43a67b",
        "hull_dark": "#133a2c",
        "accent": "#2eff9f",
        "glow": "#ffb830",
        "canopy": "#b5ffe1",
        "wings": mirror_poly([(0.10, -0.34), (0.92, 0.08), (0.86, 0.34), (0.34, 0.24), (0.14, 0.42)]),
        "canards": mirror_poly([(0.08, -0.66), (0.38, -0.40), (0.34, -0.24), (0.10, -0.34)]),
        "fuselage": mirror_poly([(0.0, -0.92), (0.14, -0.60), (0.20, 0.12), (0.18, 0.72), (0.0, 0.64)]),
        "tails": mirror_poly([(0.14, 0.50), (0.52, 0.76), (0.46, 0.86), (0.14, 0.70)]),
        "nozzles": [(-0.14, 0.74), (0.0, 0.74), (0.14, 0.74)],
        "canopy_box": (0.0, -0.50, 0.09, 0.18),
        "stripes": [((-0.82, 0.14), (-0.22, -0.06)), ((0.82, 0.14), (0.22, -0.06))],
        "rotors": [],
    },
    {
        "id": "boss_omega",
        "title": "OMEGA VALKYRIE ORBITAL CARRIER",
        "size": 512,
        "hull": "#8255b8",
        "hull_dark": "#261442",
        "accent": "#c06eff",
        "glow": "#ff2ebd",
        "canopy": "#e6ccff",
        "wings": mirror_poly([(0.12, -0.44), (0.96, 0.06), (0.94, 0.36), (0.54, 0.32), (0.40, 0.62), (0.16, 0.54)]),
        "canards": mirror_poly([(0.08, -0.74), (0.40, -0.46), (0.34, -0.30), (0.10, -0.40)]),
        "fuselage": mirror_poly([(0.0, -0.94), (0.16, -0.66), (0.26, 0.0), (0.24, 0.68), (0.0, 0.76)]),
        "tails": mirror_poly([(0.22, 0.48), (0.58, 0.78), (0.50, 0.88), (0.18, 0.70)]),
        "nozzles": [(-0.22, 0.74), (-0.11, 0.74), (0.11, 0.74), (0.22, 0.74)],
        "canopy_box": (0.0, -0.56, 0.10, 0.17),
        "radome": (0.0, 0.08, 0.17),
        "stripes": [((-0.88, 0.14), (-0.22, -0.18)), ((0.88, 0.14), (0.22, -0.18))],
        "rotors": [],
    },
]


def render_png_spec(spec):
    size = spec["size"]
    rc = RasterCanvas(size)
    hull = hex_rgb(spec["hull"])
    hull_dark = hex_rgb(spec["hull_dark"])
    accent = hex_rgb(spec["accent"])
    glow = hex_rgb(spec["glow"])
    canopy = hex_rgb(spec["canopy"])

    if spec["canards"]:
        rc.fill_poly(spec["canards"], hull, hull_dark, metallic=True)
    if spec["wings"]:
        rc.fill_poly(spec["wings"], hull, hull_dark, metallic=True)
    if spec["tails"]:
        rc.fill_poly(spec["tails"], hull, hull_dark, metallic=True)

    rc.fill_poly(spec["fuselage"], hull, hull_dark, metallic=True)

    # Panel seams & glowing wing accents
    for p1, p2 in spec["stripes"]:
        rc.draw_line(p1, p2, accent, width_px=max(2.0, size * 0.012))

    # Spine highlight
    rc.draw_line((0.0, -0.78), (0.0, 0.56), (225, 242, 255, 110), width_px=max(1.5, size * 0.008))

    # Cockpit glass
    cx, cy, rx, ry = spec["canopy_box"]
    rc.fill_ellipse(cx, cy, rx, ry, canopy, accent)
    rc.fill_ellipse(cx - rx * 0.25, cy - ry * 0.3, rx * 0.35, ry * 0.35, (255, 255, 255, 210))

    # Optional AWACS Radome
    if "radome" in spec:
        rx0, ry0, rr = spec["radome"]
        rc.fill_ellipse(rx0, ry0, rr, rr, hull_dark, accent)
        rc.fill_ellipse(rx0, ry0, rr * 0.55, rr * 0.55, accent, glow)

    # Engine nozzles
    for nx, ny in spec["nozzles"]:
        rc.fill_ellipse(nx, ny, 0.045, 0.032, (30, 35, 50, 255))
        rc.fill_ellipse(nx, ny + 0.015, 0.032, 0.022, glow)

    # Rotor hubs / blurred prop discs
    for rtx, rty, rtr in spec["rotors"]:
        rc.fill_ellipse(rtx, rty, rtr, rtr, (180, 245, 255, 36), (180, 245, 255, 95))
        rc.fill_ellipse(rtx, rty, 0.038, 0.038, accent)

    return rc.buf


def poly_str(pts):
    return " ".join(f"{(x + 1.0) * 128:.2f},{(y + 1.0) * 128:.2f}" for x, y in pts)


def render_svg_spec(spec):
    hull = spec["hull"]
    dark = spec["hull_dark"]
    accent = spec["accent"]
    glow = spec["glow"]
    canopy = spec["canopy"]

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">',
        '  <defs>',
        f'    <linearGradient id="hullGrad" x1="0%" y1="0%" x2="100%" y2="0%">',
        f'      <stop offset="0%" stop-color="{dark}"/>',
        f'      <stop offset="50%" stop-color="{hull}"/>',
        f'      <stop offset="100%" stop-color="{dark}"/>',
        '    </linearGradient>',
        f'    <radialGradient id="canopyGrad" cx="40%" cy="35%" r="65%">',
        f'      <stop offset="0%" stop-color="#ffffff"/>',
        f'      <stop offset="45%" stop-color="{canopy}"/>',
        f'      <stop offset="100%" stop-color="{accent}"/>',
        '    </radialGradient>',
        '    <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">',
        '      <feGaussianBlur stdDeviation="3.2" result="blur"/>',
        '      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>',
        '    </filter>',
        '  </defs>',
    ]

    if spec["canards"]:
        parts.append(f'  <polygon points="{poly_str(spec["canards"])}" fill="url(#hullGrad)" stroke="{accent}" stroke-width="1.4"/>')
    if spec["wings"]:
        parts.append(f'  <polygon points="{poly_str(spec["wings"])}" fill="url(#hullGrad)" stroke="{accent}" stroke-width="1.6"/>')
    if spec["tails"]:
        parts.append(f'  <polygon points="{poly_str(spec["tails"])}" fill="url(#hullGrad)" stroke="{accent}" stroke-width="1.4"/>')

    parts.append(f'  <polygon points="{poly_str(spec["fuselage"])}" fill="url(#hullGrad)" stroke="{accent}" stroke-width="1.8"/>')

    for p1, p2 in spec["stripes"]:
        x1, y1 = (p1[0] + 1) * 128, (p1[1] + 1) * 128
        x2, y2 = (p2[0] + 1) * 128, (p2[1] + 1) * 128
        parts.append(f'  <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{accent}" stroke-width="2.6" filter="url(#neonGlow)"/>')

    parts.append('  <line x1="128" y1="30" x2="128" y2="196" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5"/>')

    cx, cy, rx, ry = spec["canopy_box"]
    parts.append(
        f'  <ellipse cx="{(cx+1)*128:.1f}" cy="{(cy+1)*128:.1f}" rx="{rx*128:.1f}" ry="{ry*128:.1f}" '
        f'fill="url(#canopyGrad)" stroke="{accent}" stroke-width="1.2" filter="url(#neonGlow)"/>'
    )

    if "radome" in spec:
        rx0, ry0, rr = spec["radome"]
        parts.append(
            f'  <circle cx="{(rx0+1)*128:.1f}" cy="{(ry0+1)*128:.1f}" r="{rr*128:.1f}" '
            f'fill="{dark}" stroke="{accent}" stroke-width="2.2"/>'
        )
        parts.append(
            f'  <line x1="{(rx0-rr*0.75+1)*128:.1f}" y1="{(ry0+1)*128:.1f}" '
            f'x2="{(rx0+rr*0.75+1)*128:.1f}" y2="{(ry0+1)*128:.1f}" stroke="{glow}" stroke-width="3" filter="url(#neonGlow)"/>'
        )

    for nx, ny in spec["nozzles"]:
        parts.append(
            f'  <ellipse cx="{(nx+1)*128:.1f}" cy="{(ny+1)*128:.1f}" rx="6.5" ry="4.5" '
            f'fill="{glow}" filter="url(#neonGlow)"/>'
        )

    for rtx, rty, rtr in spec["rotors"]:
        parts.append(
            f'  <circle cx="{(rtx+1)*128:.1f}" cy="{(rty+1)*128:.1f}" r="{rtr*128:.1f}" '
            f'fill="{accent}" fill-opacity="0.14" stroke="{accent}" stroke-opacity="0.55" stroke-width="1.6" stroke-dasharray="10 6"/>'
        )

    parts.append('</svg>')
    return "\n".join(parts)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for spec in AIRCRAFT_SPECS:
        png_path = os.path.join(OUT_DIR, f"{spec['id']}.png")
        svg_path = os.path.join(OUT_DIR, f"{spec['id']}.svg")
        rgba = render_png_spec(spec)
        write_png(png_path, spec["size"], spec["size"], rgba)
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(render_svg_spec(spec))
        print(f"Generated {spec['id']}.png ({spec['size']}x{spec['size']}) & {spec['id']}.svg")


if __name__ == "__main__":
    main()
