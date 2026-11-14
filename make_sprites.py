import os
import struct
import zlib


def make_grid(rows, width, height):
    if len(rows) != height or any(len(row) != width for row in rows):
        raise ValueError("Sprite grid has the wrong dimensions")
    return rows


sprites = {
    "player.png": (
        make_grid([
            "................",
            ".......yy.......",
            "......ydy.......",
            "......dbd.......",
            ".....dbcb.......",
            "....dbccbd......",
            "...dbccccbd.....",
            "..dbccccccbd....",
            ".dbccccccccbd...",
            "dbccccccccccbd..",
            "dbccccccccccbd..",
            ".dbccccccccbd...",
            "..dbccccccbd....",
            "...dbccccbd.....",
            "..yyb....byy....",
            ".yybd....dbyy...",
        ], 16, 16),
        {
            ".": (0, 0, 0, 0),
            "d": (20, 39, 79, 255),
            "b": (55, 166, 218, 255),
            "c": (165, 235, 255, 255),
            "y": (255, 210, 82, 255),
        },
    ),
    "star.png": (
        make_grid([
            ".......y........",
            "......yyy.......",
            "......yoy.......",
            "....yyoyoyy.....",
            "...yyoyoyoyy....",
            "..yyoyoyoyoyy...",
            ".yyoyoyoyoyoyy..",
            ".yyyyyyyyyyyyy..",
            "..yyyyyyyyyyy...",
            "...yyyyyyyyy....",
            "....yyyyyyy.....",
            ".....yyyyy......",
            "......yyy.......",
            ".......y........",
            "................",
            "................",
        ], 16, 16),
        {
            ".": (0, 0, 0, 0),
            "y": (255, 205, 47, 255),
            "o": (239, 119, 28, 255),
            "w": (255, 248, 190, 255),
            "d": (164, 73, 31, 255),
        },
    ),
    "rock.png": (
        make_grid([
            "................",
            "....dddddddd....",
            "..ddggggggggdd..",
            ".dggggggggggggd.",
            "dggggggggggggggd",
            "dggggssggggggggd",
            "dggggggggggggggd",
            "dggggggggggggggd",
            "ddggggggggggggdd",
            ".ddggggggggdd...",
            "..ddggggggggdd..",
            "...dddddddddd...",
            "................",
            "................",
            "................",
            "................",
        ], 16, 16),
        {
            ".": (0, 0, 0, 0),
            "d": (47, 53, 74, 255),
            "g": (123, 132, 145, 255),
            "s": (184, 190, 190, 255),
            "r": (157, 83, 63, 255),
        },
    ),
    "heart.png": (
        make_grid([
            "..dd..dd....",
            ".drrd..drrd.",
            "drrrrrrrrrrd",
            "drrprrrrrrrd",
            ".drrrrrrrrd.",
            "..drrrrrrd..",
            "...drrrrd...",
            "....drrd....",
            ".....dd.....",
            "............",
            "............",
            "............",
        ], 12, 12),
        {
            ".": (0, 0, 0, 0),
            "d": (117, 24, 57, 255),
            "r": (239, 61, 103, 255),
            "p": (255, 142, 164, 255),
            "w": (255, 224, 229, 255),
        },
    ),
    "magnet.png": (
        make_grid([
            "................",
            "..www......www..",
            "..wsb..bb..bsw..",
            "..wsb.bbbb.bsw..",
            "..wsb.bbbb.bsw..",
            "..wsb.bbbb.bsw..",
            "..wsb.bbbb.bsw..",
            "..wsb.bbbb.bsw..",
            "..wsb.bbbb.bsw..",
            "..wsb.bbbb.bsw..",
            "..wsb.bbbb.bsw..",
            "..wsb.bbbb.bsw..",
            "..wssbbbbbbssw..",
            "..wssbbbbbbssw..",
            "...wssssssssw...",
            "................",
        ], 16, 16),
        {
            ".": (0, 0, 0, 0),
            "w": (230, 240, 255, 255),
            "s": (170, 185, 205, 255),
            "b": (79, 163, 255, 255),
        },
    ),
}


def rot90(rows):
    h, w = len(rows), len(rows[0])
    return ["".join(rows[h - 1 - x][y] for x in range(h)) for y in range(w)]


def pad_cell(rows, size=16, ox=0, oy=0):
    out = []
    for y in range(size):
        line = ""
        for x in range(size):
            sy, sx = y - oy, x - ox
            line += rows[sy][sx] if 0 <= sy < len(rows) and 0 <= sx < len(rows[0]) else "."
        out.append(line)
    return out


def hstack(frames):
    return ["".join(f[y] for f in frames) for y in range(len(frames[0]))]


def sheet_from(palette, frame_rows_list):
    frames = [pad_cell(f) for f in frame_rows_list]
    return hstack(frames), palette


def build_sheets():
    sheets = {}

    star_rows, star_pal = sprites["star.png"]
    star_frames = [star_rows]
    for _ in range(3):
        star_frames.append(rot90(star_frames[-1]))
    sheets["star_sheet.png"] = sheet_from(star_pal, star_frames)

    rock_rows, rock_pal = sprites["rock.png"]
    rock_frames = [rock_rows]
    for _ in range(3):
        rock_frames.append(rot90(rock_frames[-1]))
    sheets["rock_sheet.png"] = sheet_from(rock_pal, rock_frames)

    heart_rows, heart_pal = sprites["heart.png"]
    heart_cell = pad_cell(heart_rows, 16, 2, 2)
    # beat frame: widen the middle by duplicating two center columns
    wide = []
    for row in heart_cell:
        wide.append(row[:8] + row[7:9] + row[8:])
    wide = [r[:16] for r in wide]
    sheets["heart_sheet.png"] = (["".join(f[y] for f in (heart_cell, wide)) for y in range(16)], heart_pal)

    player_rows, player_pal = sprites["player.png"]
    wobble = []
    for i, shift in enumerate([0, -1, 0, 1]):
        frame = [list(r) for r in player_rows]
        for y in range(12, 16):
            row = frame[y]
            for x in range(16):
                src = x - shift
                row[x] = row[src] if 0 <= src < 16 else "."
        wobble.append(["".join(r) for r in frame])
    # squash frame: drop two leg rows and pad the bottom
    squash = player_rows[:12] + ["................", "................"]
    player_frames = wobble + [squash]
    sheets["player_sheet.png"] = sheet_from(player_pal, player_frames)

    return sheets


def make_background():
    grid = [["d" for _ in range(32)] for _ in range(32)]

    # A few low-contrast pixels add texture without making the tile too busy.
    for x, y in [(2, 3), (11, 2), (19, 4), (27, 3), (7, 12), (24, 16),
                  (3, 23), (16, 27), (29, 21), (12, 30), (21, 11)]:
        grid[y][x] = "b"

    # Small four-point stars, kept away from the edges for easy tiling.
    for x, y in [(5, 8), (22, 7), (14, 19), (27, 27)]:
        grid[y][x] = "w"
        grid[y - 1][x] = "s"
        grid[y + 1][x] = "s"
        grid[y][x - 1] = "s"
        grid[y][x + 1] = "s"

    return ["".join(row) for row in grid]


sprites["background.png"] = (
    make_grid(make_background(), 32, 32),
    {
        "d": (10, 23, 55, 255),
        "b": (19, 39, 78, 255),
        "s": (91, 132, 190, 255),
        "w": (199, 224, 255, 255),
    },
)


def png_chunk(kind, data):
    chunk = kind + data
    return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)


def write_png(path, rows, palette):
    height = len(rows)
    width = len(rows[0])
    image_data = bytearray()

    for row in rows:
        image_data.append(0)  # PNG filter: none
        for pixel in row:
            if pixel not in palette:
                raise ValueError("Unknown palette character: " + pixel)
            image_data.extend(palette[pixel])

    png_data = b"\x89PNG\r\n\x1a\n"
    png_data += png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png_data += png_chunk(b"IDAT", zlib.compress(bytes(image_data)))
    png_data += png_chunk(b"IEND", b"")

    with open(path, "wb") as image_file:
        image_file.write(png_data)


def main():
    assets_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
    os.makedirs(assets_dir, exist_ok=True)

    for filename, (rows, palette) in {**sprites, **build_sheets()}.items():
        path = os.path.join(assets_dir, filename)
        write_png(path, rows, palette)
        print("Wrote " + path)


if __name__ == "__main__":
    main()
