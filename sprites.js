export const SPRITES = {
  background: "assets/background.png",
  player: "assets/player.png",
  star: "assets/star.png",
  rock: "assets/rock.png",
  heart: "assets/heart.png",
  magnet: "assets/magnet.png",
};

// animated sprites: sheet file + how many frames sit side by side
export const SHEETS = {
  player: { src: "assets/player_sheet.png", frames: 5 },
  star: { src: "assets/star_sheet.png", frames: 4 },
  rock: { src: "assets/rock_sheet.png", frames: 4 },
  heart: { src: "assets/heart_sheet.png", frames: 2 },
};

export const SIZE = { player: 64, star: 32, rock: 32, magnet: 32, heart: 24 };
export const FALLBACK = { player: "#4fc3f7", star: "#ffd93b", rock: "#8a8a8a", heart: "#ff5577", magnet: "#4fa3ff" };

export const images = {};
const imageReady = {};

for (const [name, src] of Object.entries(SPRITES)) {
  const image = new Image();
  imageReady[name] = false;
  image.addEventListener("load", () => {
    imageReady[name] = true;
  });
  image.addEventListener("error", () => {
    imageReady[name] = false;
  });
  image.src = src;
  images[name] = image;
}

for (const [name, sheet] of Object.entries(SHEETS)) {
  const image = new Image();
  const key = name + "_sheet";
  imageReady[key] = false;
  image.addEventListener("load", () => {
    imageReady[key] = true;
  });
  image.addEventListener("error", () => {
    imageReady[key] = false;
  });
  image.src = sheet.src;
  images[key] = image;
}

export function isReady(name) {
  return imageReady[name];
}

function drawFallback(ctx, name, x, y) {
  ctx.fillStyle = FALLBACK[name];
  ctx.fillRect(x, y, SIZE[name], SIZE[name]);
}

export function drawSprite(ctx, name, x, y, frame = 0, rotation = 0) {
  const size = SIZE[name];
  const blit = (image, sx, sy, sw, sh) => {
    if (rotation) {
      ctx.save();
      ctx.translate(x + size / 2, y + size / 2);
      ctx.rotate(rotation);
      ctx.drawImage(image, sx, sy, sw, sh, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      ctx.drawImage(image, sx, sy, sw, sh, x, y, size, size);
    }
  };
  const sheet = SHEETS[name];
  if (sheet) {
    const key = name + "_sheet";
    const image = images[key];
    if (imageReady[key]) {
      const cellW = image.width / sheet.frames;
      const cellH = image.height;
      blit(image, frame * cellW, 0, cellW, cellH);
    } else {
      drawFallback(ctx, name, x, y);
    }
    return;
  }

  if (isReady(name)) {
    blit(images[name], 0, 0, images[name].width, images[name].height);
  } else {
    drawFallback(ctx, name, x, y);
  }
}
