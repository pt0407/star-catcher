const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const START_LIVES = 3;
const PLAYER_SPEED = 300;
const GUST_WAIT_MIN = 12;
const GUST_WAIT_MAX = 20;
const GUST_DURATION = 2;
const GUST_SPEED = 180;
const START_FALL_SPEED = 120;
const SPEED_UP_EVERY = 10;
const SPEED_UP_AMOUNT = 20;
const SPAWN_EVERY = 0.9;
const SPAWN_INTERVAL_SCORE_STEP = 5;
const SPAWN_INTERVAL_DECREASE = 0.03;
const MIN_SPAWN_EVERY = 0.45;
const STAR_CHANCE = 0.7;
const MAGNET_CHANCE = 1 / 25;
const MAGNET_DURATION = 4;
const MAGNET_SPEED = 300;
const SHOOTING_STAR_INTERVAL = 20;
const SHOOTING_STAR_SPEED = 500;
const SHOOTING_STAR_SIZE = 24;
const SHOOTING_STAR_Y = 40;
const STAR_FREQUENCY = 600;
const STAR_DURATION = 0.08;
const ROCK_FREQUENCY = 140;
const ROCK_DURATION = 0.15;
const POP_DURATION = 0.8;
const BIT_COUNT = 6;
const BIT_LIFETIME = 0.4;
const BIT_GRAVITY = 500;
const SHAKE_DURATION = 0.3;
const SHAKE_AMOUNT = 4;
const HEART_FLASH_DURATION = 0.2;
const RESTART_DELAY_MS = 600;

const SPRITES = {
  background: "assets/background.png",
  player: "assets/player.png",
  star: "assets/star.png",
  rock: "assets/rock.png",
  heart: "assets/heart.png",
};
const SIZE = { player: 64, star: 32, rock: 32, magnet: 32, heart: 24 };
const FALLBACK = { player: "#4fc3f7", star: "#ffd93b", rock: "#8a8a8a", heart: "#ff5577" };
const FONT = '\"Press Start 2P\", monospace';

const images = {};
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

function isReady(name) {
  return imageReady[name];
}

function drawSprite(name, x, y) {
  if (isReady(name)) {
    ctx.drawImage(images[name], x, y, SIZE[name], SIZE[name]);
  } else {
    ctx.fillStyle = FALLBACK[name];
    ctx.fillRect(x, y, SIZE[name], SIZE[name]);
  }
}

let best = Number(localStorage.getItem("starCatcherBest") || 0);
let state, player, items, pops, bits, lives, score, starsCaught, rocksHit, streak, fallSpeed, spawnTimer;
let gustTimer, gustRemaining, gustDirection, magnetRemaining;
let shootingStar, shootingStarTimer;
let gameOverTime = 0;
let newBest = false;
let shake = 0;
let heartFlash = 0;
let audioContext = null;
let muted = localStorage.getItem("starCatcherMuted") === "true";
let touchTargetX = null;
let fpsEnabled = false;
let fpsWindowStart = 0;
let fpsFrameCount = 0;
let fpsText = "FPS 0";
const keys = {};

function initializeAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") audioContext.resume();
}

function playCatchSound(type) {
  if (muted || !audioContext) return;

  const isStar = type === "star";
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  const duration = isStar ? STAR_DURATION : ROCK_DURATION;

  oscillator.type = isStar ? "sine" : "square";
  oscillator.frequency.value = isStar ? STAR_FREQUENCY : ROCK_FREQUENCY;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function reset() {
  state = "playing";
  player = { x: canvas.width / 2 - SIZE.player / 2, y: canvas.height - 90 };
  items = [];
  pops = [];
  bits = [];
  shootingStar = null;
  shootingStarTimer = SHOOTING_STAR_INTERVAL;
  lives = START_LIVES;
  score = 0;
  starsCaught = 0;
  rocksHit = 0;
  streak = 0;
  fallSpeed = START_FALL_SPEED;
  spawnTimer = 0;
  gustTimer = GUST_WAIT_MIN + Math.random() * (GUST_WAIT_MAX - GUST_WAIT_MIN);
  gustRemaining = 0;
  gustDirection = 0;
  magnetRemaining = 0;
  shake = 0;
  heartFlash = 0;
  newBest = false;
}

function spawnRockBits(x, y) {
  for (let i = 0; i < BIT_COUNT; i++) {
    bits.push({
      x,
      y,
      vx: (Math.random() * 2 - 1) * 150,
      vy: (Math.random() * 2 - 1) * 150,
      age: 0,
    });
  }
}

function spawnItem() {
  let type;
  if (Math.random() < MAGNET_CHANCE) {
    type = "magnet";
  } else {
    type = Math.random() < STAR_CHANCE ? "star" : "rock";
  }
  items.push({ type, x: Math.random() * (canvas.width - SIZE[type]), y: -SIZE[type] });
}

function getSpawnInterval() {
  const reductions = Math.floor(score / SPAWN_INTERVAL_SCORE_STEP) * SPAWN_INTERVAL_DECREASE;
  return Math.max(MIN_SPAWN_EVERY, SPAWN_EVERY - reductions);
}

function touchesPlayer(item) {
  const size = SIZE[item.type];
  const hitboxSize = item.type === "rock" ? size * 0.8 : size;
  const inset = (size - hitboxSize) / 2;
  const x = item.x + inset;
  const y = item.y + inset;
  return x < player.x + SIZE.player && x + hitboxSize > player.x &&
         y < player.y + SIZE.player && y + hitboxSize > player.y;
}

function gameOver() {
  state = "over";
  gameOverTime = performance.now();
  newBest = score > best;
  if (newBest) {
    best = score;
    localStorage.setItem("starCatcherBest", String(best));
  }
}

function update(dt) {
  shake = Math.max(0, shake - dt);
  heartFlash = Math.max(0, heartFlash - dt);

  for (let i = bits.length - 1; i >= 0; i--) {
    const bit = bits[i];
    bit.age += dt;
    bit.vy += BIT_GRAVITY * dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    if (bit.age >= BIT_LIFETIME) bits.splice(i, 1);
  }

  if (state !== "playing") return;

  magnetRemaining = Math.max(0, magnetRemaining - dt);

  let gustPushTime = 0;
  if (gustRemaining > 0) {
    gustPushTime = Math.min(dt, gustRemaining);
    gustRemaining -= gustPushTime;
  } else {
    gustTimer -= dt;
    if (gustTimer <= 0) {
      gustDirection = Math.random() < 0.5 ? -1 : 1;
      gustRemaining = GUST_DURATION;
      gustTimer = GUST_WAIT_MIN + Math.random() * (GUST_WAIT_MAX - GUST_WAIT_MIN);
      gustPushTime = Math.min(dt, gustRemaining);
      gustRemaining -= gustPushTime;
    }
  }

  if (touchTargetX !== null) {
    const distance = touchTargetX - player.x;
    player.x += Math.sign(distance) * Math.min(Math.abs(distance), PLAYER_SPEED * dt);
  } else {
    const move = (keys["arrowright"] || keys["d"] ? 1 : 0) - (keys["arrowleft"] || keys["a"] ? 1 : 0);
    player.x += move * PLAYER_SPEED * dt;
  }
  player.x += gustDirection * GUST_SPEED * gustPushTime;
  player.x = Math.max(0, Math.min(canvas.width - SIZE.player, player.x));

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnItem();
    spawnTimer = getSpawnInterval();
  }

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type === "star" && magnetRemaining > 0) {
      const dx = player.x + SIZE.player / 2 - (item.x + SIZE.star / 2);
      const dy = player.y + SIZE.player / 2 - (item.y + SIZE.star / 2);
      const distance = Math.hypot(dx, dy);
      if (distance > 0) {
        const step = Math.min(MAGNET_SPEED * dt, distance);
        item.x += dx / distance * step;
        item.y += dy / distance * step;
      }
    } else {
      item.y += fallSpeed * dt;
    }

    if (touchesPlayer(item)) {
      playCatchSound(item.type);
      if (item.type === "star") {
        starsCaught += 1;
        streak += 1;
        score += 1;
        pops.push({ x: item.x + SIZE.star / 2, y: item.y + SIZE.star / 2, age: 0 });
      } else if (item.type === "magnet") {
        magnetRemaining = MAGNET_DURATION;
      } else {
        spawnRockBits(item.x + SIZE.rock / 2, item.y + SIZE.rock / 2);
        rocksHit += 1;
        streak = 0;
        lives -= 1;
        shake = SHAKE_DURATION;
        heartFlash = HEART_FLASH_DURATION;
      }
    }
    if (touchesPlayer(item) || item.y >= canvas.height) items.splice(i, 1);
  }

  if (shootingStar) {
    shootingStar.x += SHOOTING_STAR_SPEED * dt;
    const overlapsPlayerX = shootingStar.x < player.x + SIZE.player &&
      shootingStar.x + SHOOTING_STAR_SIZE > player.x;
    if (overlapsPlayerX) {
      playCatchSound("star");
      starsCaught += 1;
      streak += 1;
      score += 5;
      pops.push({
        x: shootingStar.x + SHOOTING_STAR_SIZE / 2,
        y: shootingStar.y + SHOOTING_STAR_SIZE / 2,
        age: 0,
        value: 5,
      });
      shootingStar = null;
    } else if (shootingStar.x >= canvas.width) {
      shootingStar = null;
    }
  } else {
    shootingStarTimer -= dt;
    if (shootingStarTimer <= 0) {
      shootingStar = { x: -SHOOTING_STAR_SIZE, y: SHOOTING_STAR_Y };
      shootingStarTimer = SHOOTING_STAR_INTERVAL;
    }
  }

  for (const pop of pops) pop.age += dt;
  pops = pops.filter((pop) => pop.age < POP_DURATION);

  fallSpeed = START_FALL_SPEED + Math.floor(score / SPEED_UP_EVERY) * SPEED_UP_AMOUNT;
  if (lives <= 0) gameOver();
}

function drawText(lines) {
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  const firstLineY = canvas.height / 2 - ((lines.length - 1) * 40) / 2;
  lines.forEach(([text, size], i) => {
    ctx.font = `${size}px ${FONT}`;
    ctx.fillText(text, canvas.width / 2, firstLineY + i * 40);
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() * 2 - 1) * SHAKE_AMOUNT, (Math.random() * 2 - 1) * SHAKE_AMOUNT);
  }

  if (isReady("background")) {
    const pattern = ctx.createPattern(images.background, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  drawSprite("player", player.x, player.y);
  for (const item of items) {
    if (item.type === "magnet") {
      ctx.fillStyle = "#4fa3ff";
      ctx.fillRect(item.x, item.y, SIZE.magnet, SIZE.magnet);
    } else {
      drawSprite(item.type, item.x, item.y);
    }
  }
  ctx.fillStyle = "#888";
  for (const bit of bits) ctx.fillRect(bit.x, bit.y, 3, 3);

  if (shootingStar) {
    const trail = ctx.createLinearGradient(shootingStar.x - 20, 0, shootingStar.x + 2, 0);
    trail.addColorStop(0, "rgba(255, 255, 255, 0)");
    trail.addColorStop(1, "rgba(255, 255, 255, 0.9)");
    ctx.strokeStyle = trail;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(shootingStar.x - 20, shootingStar.y + SHOOTING_STAR_SIZE / 2);
    ctx.lineTo(shootingStar.x + 2, shootingStar.y + SHOOTING_STAR_SIZE / 2);
    ctx.stroke();
    if (isReady("star")) {
      ctx.drawImage(images.star, shootingStar.x, shootingStar.y, SHOOTING_STAR_SIZE, SHOOTING_STAR_SIZE);
    } else {
      ctx.fillStyle = FALLBACK.star;
      ctx.fillRect(shootingStar.x, shootingStar.y, SHOOTING_STAR_SIZE, SHOOTING_STAR_SIZE);
    }
  }
  for (const pop of pops) {
    const progress = pop.age / POP_DURATION;
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = "#fff";
    ctx.font = `20px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(`+${pop.value || 1}`, pop.x, pop.y - progress * 30);
  }
  ctx.globalAlpha = 1;

  ctx.globalAlpha = heartFlash > 0 ? 0.3 : 1;
  for (let i = 0; i < lives; i++) drawSprite("heart", 10 + i * 30, 10);
  ctx.globalAlpha = 1;
  if (gustRemaining > 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = `14px ${FONT}`;
    ctx.fillText(gustDirection < 0 ? "<<" : ">>", canvas.width / 2, 48);
  }
  if (fpsEnabled) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = `8px ${FONT}`;
    ctx.fillText(fpsText, 10, 48);
  }
  ctx.textAlign = "right";
  ctx.fillStyle = "#fff";
  ctx.font = `10px ${FONT}`;
  ctx.fillText(`Score ${score}`, canvas.width - 10, 28);
  ctx.fillText(`Best ${best}`, canvas.width - 10, 52);
  if (streak >= 2) ctx.fillText(`Streak ${streak}`, canvas.width - 10, 76);
  ctx.textAlign = "left";
  ctx.font = `10px ${FONT}`;
  ctx.fillText(`M: sound ${muted ? "off" : "on"}`, 10, canvas.height - 10);

  if (state === "paused" || state === "over") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (state === "ready") drawText([["Star Catcher", 28], ["Press Space to start", 14]]);
  if (state === "over") {
    const gameOverLines = [["Game over", 28], [`Score ${score}   Best ${best}`, 14]];
    if (newBest) gameOverLines.push(["New best!", 14]);
    gameOverLines.push([`Stars ${starsCaught}  Rocks ${rocksHit}`, 14], ["Press Space to play again", 14]);

    const panelWidth = 380;
    const panelHeight = 240;
    const panelX = (canvas.width - panelWidth) / 2;
    const panelY = (canvas.height - panelHeight) / 2;
    ctx.fillStyle = "rgba(4, 12, 32, 0.9)";
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = "#b8c9ed";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    drawText(gameOverLines);
  }
  if (state === "paused") drawText([["Paused", 28], ["Press P or Esc to resume", 14]]);
  ctx.restore();
}

function setTouchTarget(event) {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touchX = (event.touches[0].clientX - rect.left) * canvas.width / rect.width;
  touchTargetX = Math.max(0, Math.min(canvas.width - SIZE.player, touchX - SIZE.player / 2));
}

canvas.addEventListener("touchstart", setTouchTarget, { passive: false });
canvas.addEventListener("touchmove", setTouchTarget, { passive: false });
canvas.addEventListener("touchend", () => {
  touchTargetX = null;
});
canvas.addEventListener("touchcancel", () => {
  touchTargetX = null;
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && state === "playing") state = "paused";
});

window.addEventListener("blur", () => {
  for (const key of Object.keys(keys)) keys[key] = false;
});

document.addEventListener("keydown", (e) => {
  initializeAudio();
  if (e.key.toLowerCase() === "m") {
    if (!e.repeat) {
      muted = !muted;
      localStorage.setItem("starCatcherMuted", String(muted));
    }
    return;
  }
  if (e.key.toLowerCase() === "f") {
    if (!e.repeat) fpsEnabled = !fpsEnabled;
    return;
  }
  if (e.key.toLowerCase() === "p" || e.key === "Escape") {
    if (!e.repeat && (state === "playing" || state === "paused")) {
      state = state === "playing" ? "paused" : "playing";
    }
    return;
  }
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    if (state === "ready" || (state === "over" && performance.now() - gameOverTime >= RESTART_DELAY_MS)) reset();
    return;
  }
  if (e.key.startsWith("Arrow")) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

let lastTime = performance.now();

function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  if (fpsWindowStart === 0) fpsWindowStart = time;
  fpsFrameCount += 1;
  if (time - fpsWindowStart >= 1000) {
    fpsText = `FPS ${fpsFrameCount}`;
    fpsFrameCount = 0;
    fpsWindowStart = time;
  }
  if (state !== "paused") update(dt);
  draw();
  requestAnimationFrame(frame);
}

reset();
state = "ready";
requestAnimationFrame(frame);
