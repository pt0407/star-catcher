const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

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

const SPRITES = {
  background: "assets/background.png",
  player: "assets/player.png",
  star: "assets/star.png",
  rock: "assets/rock.png",
  heart: "assets/heart.png",
};
const SIZE = { player: 64, star: 32, rock: 32, heart: 24 };
const FALLBACK = { player: "#4fc3f7", star: "#ffd93b", rock: "#8a8a8a", heart: "#ff5577" };

const images = {};
for (const [name, src] of Object.entries(SPRITES)) {
  images[name] = new Image();
  images[name].src = src;
}

function isReady(name) {
  return images[name].complete && images[name].naturalWidth > 0;
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
let state, player, items, pops, lives, score, fallSpeed, spawnTimer;
let shake = 0;
let audioContext = null;
let muted = false;
let touchTargetX = null;
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
  const s = SIZE[item.type];
  return item.x < player.x + SIZE.player && item.x + s > player.x &&
         item.y < player.y + SIZE.player && item.y + s > player.y;
}

function gameOver() {
  state = "over";
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

  for (const item of items) {
    item.y += fallSpeed * dt;
    if (touchesPlayer(item)) {
      item.caught = true;
      playCatchSound(item.type);
      if (item.type === "star") {
        score += 1;
        pops.push({ x: item.x + SIZE.star / 2, y: item.y + SIZE.star / 2, age: 0 });
      } else {
        lives -= 1;
        shake = SHAKE_DURATION;
      }
    }
  }
  items = items.filter((item) => !item.caught && item.y < canvas.height);

  for (const pop of pops) pop.age += dt;
  pops = pops.filter((pop) => pop.age < POP_DURATION);

  fallSpeed = START_FALL_SPEED + Math.floor(score / SPEED_UP_EVERY) * SPEED_UP_AMOUNT;
  if (lives <= 0) gameOver();
}

function drawText(lines) {
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  lines.forEach(([text, size], i) => {
    ctx.font = `${size}px sans-serif`;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 40 + i * 40);
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() * 2 - 1) * SHAKE_AMOUNT, (Math.random() * 2 - 1) * SHAKE_AMOUNT);
  }

  if (isReady("background")) ctx.drawImage(images.background, 0, 0, canvas.width, canvas.height);

  drawSprite("player", player.x, player.y);
  for (const item of items) drawSprite(item.type, item.x, item.y);
  for (const pop of pops) {
    const progress = pop.age / POP_DURATION;
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = "#fff";
    ctx.font = "20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("+1", pop.x, pop.y - progress * 30);
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < lives; i++) drawSprite("heart", 10 + i * 30, 10);
  ctx.textAlign = "right";
  ctx.fillStyle = "#fff";
  ctx.font = "20px sans-serif";
  ctx.fillText(`Score ${score}`, canvas.width - 10, 28);
  ctx.font = "12px sans-serif";
  ctx.fillText(`M: sound ${muted ? "off" : "on"}`, canvas.width - 10, 46);

  if (state === "ready") drawText([["Star Catcher", 36], ["Press Space to start", 20]]);
  if (state === "over") drawText([["Game over", 36], [`Score ${score}   Best ${best}`, 20], ["Press Space to play again", 20]]);
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

document.addEventListener("keydown", (e) => {
  initializeAudio();
  if (e.key.toLowerCase() === "m") {
    if (!e.repeat) muted = !muted;
    return;
  }
  if (e.key.toLowerCase() === "p" || e.key === "Escape") {
    if (!e.repeat && (state === "playing" || state === "paused")) {
      state = state === "playing" ? "paused" : "playing";
    }
    return;
  }
  if (e.key === " ") {
    e.preventDefault();
    if (state === "ready" || state === "over") reset();
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
  if (state !== "paused") update(dt);
  draw();
  requestAnimationFrame(frame);
}

reset();
state = "ready";
requestAnimationFrame(frame);
