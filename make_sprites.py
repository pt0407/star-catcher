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
}


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

    for filename, (rows, palette) in sprites.items():
        path = os.path.join(assets_dir, filename)
        write_png(path, rows, palette)
        print("Wrote " + path)


if __name__ == "__main__":
    main()
