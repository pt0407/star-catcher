export const SPRITES = {
  background: "assets/background.png",
  player: "assets/player.png",
  star: "assets/star.png",
  rock: "assets/rock.png",
  heart: "assets/heart.png",
  magnet: "assets/magnet.png",
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

export function isReady(name) {
  return imageReady[name];
}

export function drawSprite(ctx, name, x, y) {
  if (isReady(name)) {
    ctx.drawImage(images[name], x, y, SIZE[name], SIZE[name]);
  } else {
    ctx.fillStyle = FALLBACK[name];
    ctx.fillRect(x, y, SIZE[name], SIZE[name]);
  }
}
