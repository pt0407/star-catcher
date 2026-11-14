const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const START_LIVES = 3;
const PLAYER_SPEED = 300;
const START_FALL_SPEED = 120;
const SPEED_UP_EVERY = 10;
const SPEED_UP_AMOUNT = 20;
const SPAWN_EVERY = 0.9;
const SPAWN_INTERVAL_SCORE_STEP = 5;
const SPAWN_INTERVAL_DECREASE = 0.03;
const MIN_SPAWN_EVERY = 0.45;
const STAR_CHANCE = 0.7;
const STAR_FREQUENCY = 600;
const STAR_DURATION = 0.08;
const ROCK_FREQUENCY = 140;
const ROCK_DURATION = 0.15;
const POP_DURATION = 0.8;
const SHAKE_DURATION = 0.3;
const SHAKE_AMOUNT = 4;
const RESTART_DELAY_MS = 600;

const SPRITES = {
  background: "assets/background.png",
  player: "assets/player.png",
  star: "assets/star.png",
  rock: "assets/rock.png",
  heart: "assets/heart.png",
};
const SIZE = { player: 64, star: 32, rock: 32, heart: 24 };
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
let state, player, items, pops, lives, score, starsCaught, rocksHit, streak, fallSpeed, spawnTimer;
let gameOverTime = 0;
let shake = 0;
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
  lives = START_LIVES;
  score = 0;
  starsCaught = 0;
  rocksHit = 0;
  streak = 0;
  fallSpeed = START_FALL_SPEED;
  spawnTimer = 0;
  shake = 0;
}

function spawnItem() {
  const type = Math.random() < STAR_CHANCE ? "star" : "rock";
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
  if (score > best) {
    best = score;
    localStorage.setItem("starCatcherBest", String(best));
  }
}

function update(dt) {
  shake = Math.max(0, shake - dt);
  if (state !== "playing") return;

  if (touchTargetX !== null) {
    const distance = touchTargetX - player.x;
    player.x += Math.sign(distance) * Math.min(Math.abs(distance), PLAYER_SPEED * dt);
  } else {
    const move = (keys["arrowright"] || keys["d"] ? 1 : 0) - (keys["arrowleft"] || keys["a"] ? 1 : 0);
    player.x += move * PLAYER_SPEED * dt;
  }
  player.x = Math.max(0, Math.min(canvas.width - SIZE.player, player.x));

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnItem();
    spawnTimer = getSpawnInterval();
  }

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    item.y += fallSpeed * dt;
    if (touchesPlayer(item)) {
      playCatchSound(item.type);
      if (item.type === "star") {
        starsCaught += 1;
        streak += 1;
        score += 1;
        pops.push({ x: item.x + SIZE.star / 2, y: item.y + SIZE.star / 2, age: 0 });
      } else {
        rocksHit += 1;
        streak = 0;
        lives -= 1;
        shake = SHAKE_DURATION;
      }
    }
    if (touchesPlayer(item) || item.y >= canvas.height) items.splice(i, 1);
  }

  for (const pop of pops) pop.age += dt;
  pops = pops.filter((pop) => pop.age < POP_DURATION);

  fallSpeed = START_FALL_SPEED + Math.floor(score / SPEED_UP_EVERY) * SPEED_UP_AMOUNT;
  if (lives <= 0) gameOver();
}

function drawText(lines) {
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  lines.forEach(([text, size], i) => {
    ctx.font = `${size}px ${FONT}`;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 40 + i * 40);
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
  for (const item of items) drawSprite(item.type, item.x, item.y);
  for (const pop of pops) {
    const progress = pop.age / POP_DURATION;
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = "#fff";
    ctx.font = `20px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("+1", pop.x, pop.y - progress * 30);
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < lives; i++) drawSprite("heart", 10 + i * 30, 10);
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
  ctx.fillText(`Best ${best}`, canvas.width - 10, 46);
  if (streak >= 2) ctx.fillText(`Streak ${streak}`, canvas.width - 10, 64);
  ctx.font = `8px ${FONT}`;
  ctx.fillText(`M: sound ${muted ? "off" : "on"}`, canvas.width - 20, 78);

  if (state === "ready") drawText([["Star Catcher", 36], ["Press Space to start", 20]]);
  if (state === "over") drawText([["Game over", 36], [`Score ${score}   Best ${best}`, 20], [`Caught ${starsCaught} stars, hit ${rocksHit} rocks`, 16], ["Press Space to play again", 20]]);
  if (state === "paused") drawText([["Paused", 36]]);
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
