import { loadItem, saveItem } from "./persist.js";
import {
  initializeAudio, isMuted, toggleMute, getVolume, setVolume,
  getMusicVolume, setMusicVolume, toggleMusicMute,
  playCatchSound, playPauseSound, playNewBestSound, playGustSound, playMissSound,
} from "./audio.js";
import { SIZE, FALLBACK, images, isReady, drawSprite } from "./sprites.js";
import { keys, touch, bindInput } from "./input.js";
import { createStarfield, drawStarfield } from "./starfield.js";
import { SPARKLE_COUNT, clearParticles, spawnRockBits, spawnStarSparkles, updateParticles, drawParticles } from "./particles.js";
import { play as playMusic, stop as stopMusic, setLevel as setMusicLevel, setPaused as setMusicPaused } from "./music.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const START_LIVES = 3;
const MAX_LIVES = 5;
const PLAYER_SPEED = 300;
const NEAR_MISS_DISTANCE = 24;
const GUST_WAIT_MIN = 12;
const GUST_WARNING_TIME = 2;
const GUST_WAIT_MAX = 20;
const GUST_DURATION = 2;
const GUST_SPEED = 180;
const DIFFICULTIES = [
  { name: "easy", fallSpeed: 90 },
  { name: "normal", fallSpeed: 120 },
  { name: "hard", fallSpeed: 160 },
];
const SPEED_UP_EVERY = 10;
const SPEED_UP_AMOUNT = 20;
const SPAWN_EVERY = 0.9;
const MAX_ITEMS = 14;
const SPAWN_INTERVAL_SCORE_STEP = 5;
const SPAWN_INTERVAL_DECREASE = 0.03;
const MIN_SPAWN_EVERY = 0.45;
const STAR_CHANCE = 0.7;
const GOLDEN_STAR_CHANCE = 1 / 12;
const GOLDEN_HEART_CHANCE = 0.15;
const MAGNET_CHANCE = 1 / 25;
const HEART_CHANCE = 1 / 30;
const FAST_ROCK_CHANCE = 0.2;
const MAGNET_DURATION = 4;
const MAGNET_SPEED = 300;
const SHOOTING_STAR_INTERVAL = 20;
const SHOOTING_STAR_SPEED = 500;
const SHOOTING_STAR_SIZE = 24;
const SHOOTING_STAR_Y = 40;
const POP_DURATION = 0.8;
const HEART_POPUP_DURATION = 0.8;
const SHAKE_DURATION = 0.3;
const HOP_DURATION = 0.25;
const SHAKE_AMOUNT = 4;
const HEART_FLASH_DURATION = 0.2;
const HEART_BLINK_INTERVAL = 0.25;
const MILESTONES = [25, 50, 100, 150, 200];
const MILESTONE_FLASH_DURATION = 1;
const COMBO_EVERY = 5;
const COMBO_FLASH_DURATION = 1;
const PERFECT_FLASH_DURATION = 1;
const RESTART_DELAY_MS = 600;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const FONT = '"Press Start 2P", monospace';

function drawPlayer(x = player.x, yOffset = 0, frame = 0) {
  if (!playerFacingLeft) {
    drawSprite(ctx, "player", x, player.y + yOffset, frame);
    return;
  }

  ctx.save();
  ctx.translate(x * 2 + SIZE.player, 0);
  ctx.scale(-1, 1);
  drawSprite(ctx, "player", x, player.y + yOffset, frame);
  ctx.restore();
}

let best = Number(loadItem("starCatcherBest", "0"));
let bestStreak = Number(loadItem("starCatcherBestStreak", "0"));
let totalStars = Number(loadItem("starCatcherTotalStars", "0"));
let totalScore = Number(loadItem("starCatcherTotalScore", "0"));
let hasSeenControlsTip = loadItem("starCatcherSeen", "false") === "true";
let state, player, items, pops, lives, score, starsCaught, goldenCaught, rocksHit, streak, fallSpeed, spawnTimer;
let runBestStreak = 0;
const starfield = createStarfield(canvas.width, canvas.height);
let gustTimer, gustRemaining, gustDirection, magnetRemaining;
let shootingStar, shootingStarTimer, shootingStarTrailTimer;
let difficultyIndex = Number(loadItem("starCatcherDifficulty", "1"));
let difficulty = DIFFICULTIES[difficultyIndex];
let playerFacingLeft = false;
let playerTrail = [];
let playerSpeed = 0;
let gameOverTime = 0;
let runStartTime = 0;
let runTimeText = "0:00";
let pauseStartTime = 0;
let newBest = false;
let bestAnnounced = false;
let shake = 0;
let hopTimer = 0;
let heartFlash = 0;
let heartBlinkTimer = 0;
let heartVisible = true;
let heartPopupRemaining = 0;
let lastHeartBonusScore = 0;
let lastMilestoneShown = 0;
let milestoneFlashRemaining = 0;
let milestoneFlash = null;
let comboFlashRemaining = 0;
let comboFlash = null;
let perfectFlashRemaining = 0;
let perfectFlash = null;
let starsPopRemaining = 0;
let nightMode = loadItem("starCatcherNight", "false") === "true";
let fpsEnabled = false;
let fpsWindowStart = 0;
let fpsFrameCount = 0;
let fpsText = "";
let fpsValue = 0;
let bgPattern = null;
let vignette = null;

function reset() {
  clearParticles();
  state = "playing";
  runStartTime = performance.now();
  player = { x: canvas.width / 2 - SIZE.player / 2, y: canvas.height - 90 };
  playerFacingLeft = false;
  playerTrail = [];
  playerSpeed = 0;
  items = [];
  pops = [];
  shootingStar = null;
  shootingStarTimer = SHOOTING_STAR_INTERVAL;
  shootingStarTrailTimer = 0;
  lives = START_LIVES;
  score = 0;
  starsCaught = 0;
  goldenCaught = 0;
  rocksHit = 0;
  streak = 0;
  runBestStreak = 0;
  fallSpeed = difficulty.fallSpeed;
  spawnTimer = getSpawnInterval();
  gustTimer = GUST_WAIT_MIN + Math.random() * (GUST_WAIT_MAX - GUST_WAIT_MIN);
  gustRemaining = 0;
  gustDirection = 0;
  magnetRemaining = 0;
  shake = 0;
  hopTimer = 0;
  heartFlash = 0;
  heartBlinkTimer = 0;
  heartVisible = true;
  heartPopupRemaining = 0;
  lastHeartBonusScore = 0;
  lastMilestoneShown = 0;
  milestoneFlashRemaining = 0;
  milestoneFlash = null;
  comboFlashRemaining = 0;
  comboFlash = null;
  perfectFlashRemaining = 0;
  perfectFlash = null;
  starsPopRemaining = 0;
  newBest = false;
  bestAnnounced = false;
  setMusicPaused(false);
  setMusicLevel(1);
  playMusic("game");
}

function startGame() {
  if (!hasSeenControlsTip) {
    saveItem("starCatcherSeen", "true");
    hasSeenControlsTip = true;
  }
  reset();
}

function spawnItem() {
  if (items.length >= MAX_ITEMS) return;
  let type;
  if (lives < MAX_LIVES && Math.random() < HEART_CHANCE && !items.some(item => item.type === "heart")) {
    type = "heart";
  } else if (magnetRemaining <= 0 && Math.random() < MAGNET_CHANCE && !items.some(item => item.type === "magnet")) {
    type = "magnet";
  } else {
    type = Math.random() < STAR_CHANCE ? "star" : "rock";
  }
  const golden = (type === "star" && Math.random() < GOLDEN_STAR_CHANCE) || (type === "heart" && Math.random() < GOLDEN_HEART_CHANCE);
  const speedMultiplier = type === "rock" ? (Math.random() < FAST_ROCK_CHANCE ? 1.5 : 0.9 + Math.random() * 0.2) : type === "heart" ? 0.8 : type === "star" ? 0.95 + Math.random() * 0.1 : type === "magnet" ? 0.7 : 1;
  let x = Math.random() * (canvas.width - SIZE[type]);
  for (let tries = 0; tries < 3 && items.some(item => Math.abs(item.x + SIZE[item.type] / 2 - (x + SIZE[type] / 2)) < 40); tries++) {
    x = Math.random() * (canvas.width - SIZE[type]);
  }
  items.push({ type, golden, speedMultiplier, drift: (Math.random() * 2 - 1) * 12, phase: Math.random() * 6.28, rot: type === "rock" ? Math.random() * 6.28 : 0, x, y: -SIZE[type] });
  if (type === "star" && !golden && items.length < MAX_ITEMS && Math.random() < 0.04) {
    items.push({ type: "star", golden: false, speedMultiplier: 0.95 + Math.random() * 0.1, drift: (Math.random() * 2 - 1) * 12, phase: Math.random() * 6.28, x: Math.min(canvas.width - SIZE.star, Math.max(0, x + SIZE.star + 4)), y: -SIZE.star });
  }
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
  playMusic("title");
  gameOverTime = performance.now();
  const elapsed = Math.floor((gameOverTime - runStartTime) / 1000);
  runTimeText = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  newBest = score > best;
  if (newBest) {
    best = score;
    saveItem("starCatcherBest", String(best));
    playNewBestSound();
    spawnStarSparkles(canvas.width * 0.3, 150, "#ffd93b");
    spawnStarSparkles(canvas.width * 0.5, 120, "#ffffff");
    spawnStarSparkles(canvas.width * 0.7, 150, "#ff8fb3");
  }
  if (runBestStreak > bestStreak) {
    bestStreak = runBestStreak;
    saveItem("starCatcherBestStreak", String(bestStreak));
  }
  saveItem("starCatcherTotalStars", String(totalStars));
  totalScore += score;
  saveItem("starCatcherTotalScore", String(totalScore));
}

function checkHeartBonus() {
  while (score >= lastHeartBonusScore + 50) {
    lastHeartBonusScore += 50;
    if (lives < MAX_LIVES) {
      lives += 1;
      heartPopupRemaining = HEART_POPUP_DURATION;
    }
  }
}

function checkMilestone() {
  const milestone = MILESTONES.find((value) => value > lastMilestoneShown && score >= value);
  if (milestone === undefined) return;

  lastMilestoneShown = milestone;
  milestoneFlash = `${milestone}!`;
  milestoneFlashRemaining = MILESTONE_FLASH_DURATION;
  shake = Math.max(shake, 0.15);
  spawnStarSparkles(player.x + SIZE.player / 2, player.y + SIZE.player / 2, "#ffd75e", 16);
}

function checkNewBest() {
  if (!bestAnnounced && best > 0 && score > best) {
    bestAnnounced = true;
    comboFlash = "NEW BEST!";
    comboFlashRemaining = COMBO_FLASH_DURATION;
    playNewBestSound();
  }
}

function update(dt) {
  shake = Math.max(0, shake - dt);
  hopTimer = Math.max(0, hopTimer - dt);
  heartFlash = Math.max(0, heartFlash - dt);
  heartPopupRemaining = Math.max(0, heartPopupRemaining - dt);
  milestoneFlashRemaining = Math.max(0, milestoneFlashRemaining - dt);
  comboFlashRemaining = Math.max(0, comboFlashRemaining - dt);
  perfectFlashRemaining = Math.max(0, perfectFlashRemaining - dt);
  starsPopRemaining = Math.max(0, starsPopRemaining - dt);

  if (lives === 1) {
    heartBlinkTimer += dt;
    if (heartBlinkTimer >= HEART_BLINK_INTERVAL) {
      heartBlinkTimer %= HEART_BLINK_INTERVAL;
      heartVisible = !heartVisible;
    }
  } else {
    heartBlinkTimer = 0;
    heartVisible = true;
  }

  updateParticles(dt);

  if (state !== "playing") return;

  magnetRemaining = Math.max(0, magnetRemaining - dt);

  let gustPushTime = 0;
  if (gustRemaining > 0) {
    gustPushTime = Math.min(dt, gustRemaining);
    gustRemaining -= gustPushTime;
  } else {
    gustTimer -= dt;
    if (gustTimer > GUST_WARNING_TIME) {
      gustDirection = 0;
    } else if (gustDirection === 0) {
      gustDirection = Math.random() < 0.5 ? -1 : 1;
      playPauseSound();
    }
    if (gustTimer <= 0) {
      gustRemaining = GUST_DURATION;
      gustTimer = GUST_WAIT_MIN + Math.random() * (GUST_WAIT_MAX - GUST_WAIT_MIN);
      playGustSound();
      gustPushTime = Math.min(dt, gustRemaining);
      gustRemaining -= gustPushTime;
    }
  }

  const previousPlayerX = player.x;
  if (touch.targetX !== null) {
    const distance = touch.targetX - player.x;
    player.x += Math.sign(distance) * Math.min(Math.abs(distance), PLAYER_SPEED * dt);
  } else {
    const move = (keys["arrowright"] || keys["d"] ? 1 : 0) - (keys["arrowleft"] || keys["a"] ? 1 : 0);
    player.x += move * PLAYER_SPEED * dt;
  }
  player.x += gustDirection * GUST_SPEED * gustPushTime;
  player.x = Math.max(0, Math.min(canvas.width - SIZE.player, player.x));
  playerSpeed = dt > 0 ? Math.abs(player.x - previousPlayerX) / dt : 0;
  playerTrail.push(previousPlayerX);
  if (playerTrail.length > 3) playerTrail.shift();
  if (player.x < previousPlayerX) playerFacingLeft = true;
  else if (player.x > previousPlayerX) playerFacingLeft = false;

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnItem();
    spawnTimer = getSpawnInterval();
  }

  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if ((item.type === "star" || item.type === "heart") && magnetRemaining > 0) {
      const half = SIZE[item.type] / 2;
      const dx = player.x + SIZE.player / 2 - (item.x + half);
      const dy = player.y + SIZE.player / 2 - (item.y + half);
      const distance = Math.hypot(dx, dy);
      if (distance > 0) {
        const step = Math.min(MAGNET_SPEED * dt, distance);
        item.x += dx / distance * step;
        item.y += dy / distance * step;
      }
    } else {
      item.y += fallSpeed * item.speedMultiplier * dt;
      if (item.type === "rock") item.rot = (item.rot || 0) + dt * 2;
      item.x += ((item.drift || 0) + Math.sin(item.y / 45) * 10) * dt + gustDirection * GUST_SPEED * 0.25 * gustPushTime;
      item.x = Math.max(0, Math.min(canvas.width - SIZE[item.type], item.x));
    }

    const hit = touchesPlayer(item);
    if (hit) {
      playCatchSound(item.type === "heart" ? "star" : item.type, item.type === "star" ? Math.min(streak, 10) * 40 + (item.golden ? 160 : 0) : 0);
      if (item.type === "star") {
        starsCaught += 1;
        totalStars += 1;
        starsPopRemaining = 0.5;
        if (item.golden) goldenCaught += 1;
        streak += 1;
        if (streak % COMBO_EVERY === 0) {
          comboFlash = `COMBO ${streak}!`;
          comboFlashRemaining = COMBO_FLASH_DURATION;
        }
        runBestStreak = Math.max(runBestStreak, streak);
        let value = item.golden ? 3 : 1;
        const centerDistance = Math.abs((item.x + SIZE.star / 2) - (player.x + SIZE.player / 2));
        if (centerDistance < SIZE.player / 6) {
          value += 1;
          perfectFlash = 'PERFECT!';
          perfectFlashRemaining = PERFECT_FLASH_DURATION;
        }
        score += value;
        checkNewBest();
        checkHeartBonus();
        checkMilestone();
        spawnStarSparkles(item.x + SIZE.star / 2, item.y + SIZE.star / 2, item.golden ? "#ffcf40" : "#fff3a0", item.golden ? 14 : SPARKLE_COUNT);
        hopTimer = HOP_DURATION;
        pops.push({ x: item.x + SIZE.star / 2, y: item.y + SIZE.star / 2, age: 0, value, color: item.golden ? "#ffd93b" : "#fff" });
      } else if (item.type === "magnet") {
        magnetRemaining = MAGNET_DURATION;
        comboFlash = "MAGNET!";
        comboFlashRemaining = COMBO_FLASH_DURATION;
        spawnStarSparkles(item.x + SIZE.magnet / 2, item.y + SIZE.magnet / 2, "#8fd0ff");
        hopTimer = HOP_DURATION;
      } else if (item.type === "heart") {
        if (lives < MAX_LIVES) {
          lives = Math.min(MAX_LIVES, lives + (item.golden ? 2 : 1));
          heartPopupRemaining = HEART_POPUP_DURATION;
          spawnStarSparkles(item.x + SIZE.heart / 2, item.y + SIZE.heart / 2, item.golden ? "#ffd93b" : "#ff8fb3");
          hopTimer = HOP_DURATION;
          pops.push({ x: item.x + SIZE.heart / 2, y: item.y + SIZE.heart / 2, age: 0, value: item.golden ? "+2" : "heart", color: item.golden ? "#ffd93b" : "#ff8fb3" });
        } else {
          pops.push({ x: item.x + SIZE.heart / 2, y: item.y + SIZE.heart / 2, age: 0, text: "full!", color: "#ff8fb3" });
        }
      } else {
        spawnRockBits(item.x + SIZE.rock / 2, item.y + SIZE.rock / 2, item.speedMultiplier > 1.4 ? "#ff7777" : "#888");
        rocksHit += 1;
        streak = 0;
        lives -= 1;
        shake = SHAKE_DURATION;
        heartFlash = HEART_FLASH_DURATION;
      }
    }
    if (item.type === "star" && !hit && !item.missed && item.y > player.y + SIZE.player) {
      item.missed = true;
      if (streak >= 2) {
        pops.push({ x: item.x + SIZE.star / 2, y: item.y, age: 0, text: `miss x${streak}`, color: item.golden ? "#ffd93b" : "#ff9d9d" });
        playMissSound();
      }
      streak = 0;
    }
    if (item.type === "rock" && !item.nearMiss && !hit) {
      const verticallyClose = item.y < player.y + SIZE.player && item.y + SIZE.rock > player.y;
      const horizontallyClose = Math.abs((item.x + SIZE.rock / 2) - (player.x + SIZE.player / 2)) < (SIZE.rock + SIZE.player) / 2 + NEAR_MISS_DISTANCE;
      if (verticallyClose && horizontallyClose) {
        item.nearMiss = true;
        pops.push({ x: item.x + SIZE.rock / 2, y: item.y + SIZE.rock / 2, age: 0, text: 'close!', color: item.speedMultiplier > 1.4 ? "#ff9d9d" : "#9fd0ff" });
      }
    }
    if (hit || item.y >= canvas.height) items.splice(i, 1);
  }

  if (shootingStar) {
    shootingStar.x += SHOOTING_STAR_SPEED * shootingStar.dir * dt + gustDirection * GUST_SPEED * 0.25 * gustPushTime;
    shootingStarTrailTimer -= dt;
    if (shootingStarTrailTimer <= 0) {
      shootingStarTrailTimer = 0.08;
      spawnStarSparkles(shootingStar.x + SHOOTING_STAR_SIZE / 2 - shootingStar.dir * 10, shootingStar.y + SHOOTING_STAR_SIZE / 2, "#ffffff", 1);
    }
    const overlapsPlayerX = shootingStar.x < player.x + SIZE.player &&
      shootingStar.x + SHOOTING_STAR_SIZE > player.x;
    if (overlapsPlayerX) {
      playCatchSound("star", Math.min(streak, 10) * 40);
      starsCaught += 1;
      totalStars += 1;
      starsPopRemaining = 0.5;
      streak += 1;
      runBestStreak = Math.max(runBestStreak, streak);
      if (streak % COMBO_EVERY === 0) {
        comboFlash = `COMBO ${streak}!`;
        comboFlashRemaining = COMBO_FLASH_DURATION;
      }
      score += 5;
      checkNewBest();
      checkHeartBonus();
      checkMilestone();
      spawnStarSparkles(shootingStar.x + SHOOTING_STAR_SIZE / 2, shootingStar.y + SHOOTING_STAR_SIZE / 2, "#ffffff");
      hopTimer = HOP_DURATION;
      pops.push({
        x: shootingStar.x + SHOOTING_STAR_SIZE / 2,
        y: shootingStar.y + SHOOTING_STAR_SIZE / 2,
        age: 0,
        value: 5,
      });
      shootingStar = null;
    } else if (shootingStar.dir === 1 ? shootingStar.x >= canvas.width : shootingStar.x <= -SHOOTING_STAR_SIZE) {
      shootingStar = null;
    }
  } else {
    shootingStarTimer -= dt;
    if (shootingStarTimer <= 0) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      shootingStar = { x: dir === 1 ? -SHOOTING_STAR_SIZE : canvas.width, y: SHOOTING_STAR_Y + Math.random() * 40, dir };
      shootingStarTrailTimer = 0;
      shootingStarTimer = SHOOTING_STAR_INTERVAL;
    }
  }

  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].age += dt;
    pops[i].x += gustDirection * GUST_SPEED * 0.25 * gustPushTime;
    pops[i].x = Math.max(0, Math.min(canvas.width, pops[i].x));
    if (pops[i].age >= POP_DURATION) pops.splice(i, 1);
  }
  if (pops.length > 24) pops.splice(0, pops.length - 24);

  fallSpeed = difficulty.fallSpeed + Math.floor(score / SPEED_UP_EVERY) * SPEED_UP_AMOUNT;
  setMusicLevel(1 + Math.floor(score / SPEED_UP_EVERY));
  if (lives <= 0) gameOver();
}

let lastTextFont = "";
let lastTextAlign = "";

function drawPixelText(text, x, y, size, align) {
  const font = `${size}px ${FONT}`;
  if (font !== lastTextFont) {
    ctx.font = font;
    lastTextFont = font;
  }
  if (align !== lastTextAlign) {
    ctx.textAlign = align;
    lastTextAlign = align;
  }
  ctx.fillText(text, x, y);
}

function drawText(lines, offsets = []) {
  ctx.fillStyle = "#fff";
  const firstLineY = canvas.height / 2 - ((lines.length - 1) * 40) / 2;
  lines.forEach(([text, size], i) => {
    drawPixelText(text, canvas.width / 2, firstLineY + i * 40 + (offsets[i] || 0), size, "center");
  });
}

function draw() {
  const now = performance.now();
  const cursor = state === "ready" || state === "over" ? "pointer" : "default";
  if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const shaking = shake > 0 && !reducedMotion;
  if (shaking) {
    ctx.save();
    ctx.translate((Math.random() * 2 - 1) * SHAKE_AMOUNT, (Math.random() * 2 - 1) * SHAKE_AMOUNT);
  }

  if (nightMode) {
    ctx.fillStyle = "#1b0f2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (isReady("background")) {
    if (!bgPattern) bgPattern = ctx.createPattern(images.background, "repeat");
    if (bgPattern) {
      ctx.fillStyle = bgPattern;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  drawStarfield(ctx, starfield, now, gustRemaining > 0, reducedMotion);

  if (milestoneFlashRemaining > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(milestoneFlashRemaining / MILESTONE_FLASH_DURATION) * 0.2})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (playerSpeed > 200) {
    ctx.globalAlpha = 0.2;
    for (const x of playerTrail) drawPlayer(x);
    ctx.globalAlpha = 1;
  }
  const idleBob = state === "playing" && playerSpeed < 1 ? Math.sin(now / 500) * 2 : 0;
  const hop = hopTimer > 0 ? Math.sin((1 - hopTimer / HOP_DURATION) * Math.PI) * 8 : 0;
  const playerFrame = hopTimer > 0 ? 4 : Math.floor(now / 180) % 4;
  drawPlayer(state === "ready" ? player.x + Math.sin(now / 400) * 30 : player.x, idleBob - hop, playerFrame);
  if (magnetRemaining > 0 && state === "playing") {
    ctx.strokeStyle = "rgba(79, 163, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x + SIZE.player / 2, player.y + SIZE.player / 2, 110, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const item of items) {
    const frame = item.type === "star" ? Math.floor(now / 140 + (item.phase || 0)) % 4
      : item.type === "rock" ? Math.floor(now / 200 + (item.phase || 0)) % 4
      : item.type === "heart" ? Math.floor(now / 300 + (item.phase || 0)) % 2
      : 0;
    if (item.type === "magnet") {
      drawSprite(ctx, "magnet", item.x, item.y);
    } else if (item.type === "star" && item.golden) {
      ctx.globalAlpha = reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(now / 250 + item.x);
      const goldenSize = SIZE.star + 8;
      const goldenOffset = (SIZE.star - goldenSize) / 2;
      const starSheet = images["star_sheet"];
      if (isReady("star_sheet")) {
        ctx.filter = "hue-rotate(-20deg) saturate(1.8) brightness(1.15)";
        ctx.shadowColor = "#ffd93b";
        ctx.shadowBlur = 10;
        const cellW = starSheet.width / 4;
        ctx.drawImage(starSheet, frame * cellW, 0, cellW, starSheet.height, item.x + goldenOffset, item.y + goldenOffset, goldenSize, goldenSize);
        ctx.shadowBlur = 0;
        ctx.filter = "none";
      } else {
        ctx.fillStyle = "#ffb300";
        ctx.fillRect(item.x + goldenOffset, item.y + goldenOffset, goldenSize, goldenSize);
      }
      ctx.globalAlpha = 1;
    } else if (item.type === "rock" && item.speedMultiplier > 1.4) {
      ctx.filter = "sepia(1) saturate(4) hue-rotate(-50deg)";
      drawSprite(ctx, "rock", item.x, item.y, frame, item.rot || 0);
      ctx.filter = "none";
    } else if (item.type === "star" && magnetRemaining > 0) {
      ctx.filter = "hue-rotate(160deg) saturate(1.4)";
      drawSprite(ctx, "star", item.x, item.y, frame);
      ctx.filter = "none";
    } else if (item.type === "heart" && item.golden) {
      ctx.filter = "hue-rotate(-20deg) saturate(1.8) brightness(1.15)";
      drawSprite(ctx, "heart", item.x, item.y, frame);
      ctx.filter = "none";
    } else {
      drawSprite(ctx, item.type, item.x, item.y, frame, item.type === "rock" ? item.rot || 0 : 0);
    }
  }
  drawParticles(ctx);

  if (shootingStar) {
    const dir = shootingStar.dir || 1;
    const trail = ctx.createLinearGradient(shootingStar.x - 20 * dir, 0, shootingStar.x + 2 * dir, 0);
    trail.addColorStop(0, "rgba(255, 255, 255, 0)");
    trail.addColorStop(1, "rgba(255, 255, 255, 0.9)");
    ctx.strokeStyle = trail;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(shootingStar.x - 20 * dir, shootingStar.y + SHOOTING_STAR_SIZE / 2);
    ctx.lineTo(shootingStar.x + 2 * dir, shootingStar.y + SHOOTING_STAR_SIZE / 2);
    ctx.stroke();
    const shootFrame = Math.floor(now / 100) % 4;
    if (isReady("star_sheet")) {
      const starSheet = images["star_sheet"];
      const cellW = starSheet.width / 4;
      ctx.drawImage(starSheet, shootFrame * cellW, 0, cellW, starSheet.height, shootingStar.x, shootingStar.y, SHOOTING_STAR_SIZE, SHOOTING_STAR_SIZE);
    } else if (isReady("star")) {
      ctx.drawImage(images.star, shootingStar.x, shootingStar.y, SHOOTING_STAR_SIZE, SHOOTING_STAR_SIZE);
    } else {
      ctx.fillStyle = FALLBACK.star;
      ctx.fillRect(shootingStar.x, shootingStar.y, SHOOTING_STAR_SIZE, SHOOTING_STAR_SIZE);
    }
  }
  for (const pop of pops) {
    const progress = pop.age / POP_DURATION;
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = pop.color || "#fff";
    drawPixelText(pop.text || `+${pop.value || 1}`, pop.x, pop.y - progress * 30, pop.value >= 3 ? 24 : 20, "center");
  }
  ctx.globalAlpha = 1;

  if (!vignette) {
    vignette = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 180, canvas.width / 2, canvas.height / 2, 340);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, "rgba(0, 0, 0, 0.22)");
  }
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (lives === 1) {
    const pulse = 0.2 + 0.15 * Math.sin(now / 200);
    ctx.strokeStyle = `rgba(255, 60, 60, ${pulse})`;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  }

  ctx.globalAlpha = heartFlash > 0 ? 0.3 : 1;
  if (lives !== 1 || heartVisible) {
    const heartFrame = Math.floor(now / 300) % 2;
    for (let i = 0; i < lives; i++) drawSprite(ctx, "heart", 10 + i * 30, 10, heartFrame);
  }
  ctx.globalAlpha = 1;
  if (heartPopupRemaining > 0) {
    ctx.fillStyle = "#fff";
    drawPixelText("+heart", 10 + lives * 30, 27, 10, "left");
  }
  if (gustRemaining > 0) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 100);
    ctx.fillStyle = "#fff";
    drawPixelText(gustDirection < 0 ? "<<" : ">>", canvas.width / 2, 48, 14, "center");
    ctx.globalAlpha = 1;
  } else if (gustTimer <= GUST_WARNING_TIME && gustDirection !== 0) {
    ctx.globalAlpha = reducedMotion ? 0.3 : 0.2 + 0.15 * Math.sin(now / 150);
    ctx.fillStyle = "#fff";
    drawPixelText(gustDirection < 0 ? "<<" : ">>", canvas.width / 2, 48, 14, "center");
    ctx.globalAlpha = 1;
  }
  if (gustRemaining > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const sy = (i * 173 + Math.floor(now / 20) * gustDirection * 30) % canvas.height;
      const yy = sy < 0 ? sy + canvas.height : sy;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(canvas.width, yy);
      ctx.stroke();
    }
  }
  if (fpsEnabled && fpsText) {
    ctx.fillStyle = fpsValue > 0 && fpsValue < 30 ? "#ff7777" : "#fff";
    drawPixelText(fpsText, 10, 48, 8, "left");
  }
  ctx.fillStyle = "#fff";
  drawPixelText(`Score ${score}`, canvas.width - 10, 28, 10, "right");
  drawPixelText(`Best ${best}`, canvas.width - 10, 52, 10, "right");
  if (goldenCaught > 0) drawPixelText(`Gold ${goldenCaught}`, canvas.width - 10, 64, 10, "right");
  let hudY = 76;
  if (bestStreak >= 2) {
    drawPixelText(`Best streak ${bestStreak}`, canvas.width - 10, hudY, 10, "right");
    hudY += 24;
  }
  if (streak >= 2) drawPixelText(`Streak ${streak}`, canvas.width - 10, hudY, 10, "right");
  const speedLevel = 1 + Math.floor(score / SPEED_UP_EVERY);
  if (speedLevel >= 2) drawPixelText(`Speed ${speedLevel}`, canvas.width - 10, hudY + 24, 10, "right");
  if (milestoneFlashRemaining > 0) {
    ctx.globalAlpha = milestoneFlashRemaining / MILESTONE_FLASH_DURATION;
    drawPixelText(milestoneFlash, canvas.width / 2, 32, 20, "center");
    ctx.globalAlpha = 1;
  }
  if (comboFlashRemaining > 0) {
    ctx.globalAlpha = comboFlashRemaining / COMBO_FLASH_DURATION;
    drawPixelText(comboFlash, canvas.width / 2, 56, reducedMotion ? 20 : Math.round(20 + Math.sin(now / 80) * 2), "center");
    ctx.globalAlpha = 1;
  }
  if (perfectFlashRemaining > 0) {
    ctx.globalAlpha = perfectFlashRemaining / PERFECT_FLASH_DURATION;
    drawPixelText(perfectFlash, canvas.width / 2, 84, reducedMotion ? 14 : Math.round(14 + Math.sin(now / 80) * 1.5), 'center');
    ctx.globalAlpha = 1;
  }
  if (magnetRemaining > 0) {
    drawPixelText(`Magnet ${Math.ceil(magnetRemaining)}s`, canvas.width / 2, 108, 10, "center");
  }
  if (starsCaught > 0) {
    ctx.fillStyle = starsPopRemaining > 0 ? "#ffd93b" : "#fff";
    drawPixelText(`Stars ${starsCaught}`, 10, canvas.height - 26, 8, "left");
    ctx.fillStyle = "#fff";
  }
  drawPixelText(`M: sound ${isMuted() ? "off" : "on"}`, 10, canvas.height - 10, 10, "left");

  if (state === "paused" || state === "over") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (state === "ready") {
    const titleBob = reducedMotion ? 0 : Math.sin(now / 300) * 4;
    drawText([["Star Catcher", 28], [Math.floor(now / 400) % 2 === 0 ? "Press Space to start" : "", 14]], [titleBob]);
    ctx.fillStyle = "#fff";
    const difficultyOptions = DIFFICULTIES.map((option, index) => {
      const label = `${index + 1} ${option.name}`;
      return option === difficulty ? `[${label}]` : label;
    }).join("  ");
    drawPixelText(difficultyOptions, canvas.width / 2, canvas.height / 2 + 60, 10, "center");
    if (best > 0) {
      drawPixelText(`Best ${best}`, canvas.width / 2, canvas.height / 2 + 120, 10, "center");
    }
    if (totalStars > 0) {
      drawPixelText(`Stars ${totalStars} all time`, canvas.width / 2, canvas.height / 2 + 142, 8, "center");
    }
    if (totalScore > 0) {
      drawPixelText(`Points ${totalScore} all time`, canvas.width / 2, canvas.height / 2 + 158, 8, "center");
    }
    if (!hasSeenControlsTip) {
      drawPixelText("arrows or a/d to move", canvas.width / 2, canvas.height / 2 + 90, 10, "center");
    }
  }
  if (state === "over") {
    const gameOverLines = [["Game over", 28], [`Score ${score}   Best ${best}   ${runTimeText}`, 14]];
    if (newBest) gameOverLines.push(["New best!", 14]);
    const attempts = starsCaught + rocksHit;
    const accuracy = attempts > 0 ? Math.round((starsCaught / attempts) * 100) : 0;
    gameOverLines.push([`Stars ${starsCaught}  Rocks ${rocksHit}  Acc ${accuracy}%  ${difficulty.name}`, 14]);
    gameOverLines.push([`All time ${totalStars}${goldenCaught > 0 ? `   Gold ${goldenCaught}` : ""}`, 14]);

    const panelWidth = 380;
    const panelHeight = 240 + Math.max(0, gameOverLines.length - 4) * 40;
    const panelX = (canvas.width - panelWidth) / 2;
    const panelY = (canvas.height - panelHeight) / 2;
    ctx.fillStyle = "rgba(4, 12, 32, 0.9)";
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = "#b8c9ed";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    drawText(gameOverLines);
    const firstLineY = canvas.height / 2 - ((gameOverLines.length - 1) * 40) / 2;
    const promptY = firstLineY + gameOverLines.length * 40;
    if (Math.floor(now / 400) % 2 === 0) {
      drawPixelText("Press Space to play again", canvas.width / 2, promptY, 14, "center");
    }
  }
  if (state === "paused") {
    const pauseLines = [["Paused", 28]];
    if (now - pauseStartTime < 5000) {
      pauseLines.push(["Press P or Esc to resume", 14]);
    }
    if (loadItem("starCatcherSeenPauseHint", "false") !== "true") {
      pauseLines.push(["Arrows move - Space starts - R restarts", 10]);
      saveItem("starCatcherSeenPauseHint", "true");
    }
    const speedLevel = 1 + Math.floor(score / SPEED_UP_EVERY);
    pauseLines.push([`Score ${score}   Stars ${starsCaught}`, 14], [`Difficulty: ${difficulty.name}   Speed ${speedLevel}   R restarts`, 10]);
    drawText(pauseLines);
  }
  if (shaking) ctx.restore();
}

function onKeyDown(e) {
  if (["ready", "over"].includes(state) && ["1", "2", "3"].includes(e.key)) {
    difficultyIndex = Number(e.key) - 1;
    difficulty = DIFFICULTIES[difficultyIndex];
    saveItem("starCatcherDifficulty", String(difficultyIndex));
    return;
  }
  if (["ready", "over"].includes(state) && !e.repeat && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    const direction = e.key === "ArrowRight" ? 1 : -1;
    difficultyIndex = (difficultyIndex + direction + DIFFICULTIES.length) % DIFFICULTIES.length;
    difficulty = DIFFICULTIES[difficultyIndex];
    saveItem("starCatcherDifficulty", String(difficultyIndex));
    return;
  }
  if (e.key === "M" && e.shiftKey) {
    if (!e.repeat) toggleMusicMute();
    return;
  }
  if (e.key.toLowerCase() === "m") {
    if (!e.repeat) {
      toggleMute();
    }
    return;
  }
  if (e.key === "[" || e.key === "]" || e.key === "," || e.key === ".") {
    if (!e.repeat) {
      const music = e.key === "," || e.key === ".";
      const get = music ? getMusicVolume : getVolume;
      const set = music ? setMusicVolume : setVolume;
      set(Math.round((get() + (e.key === "[" || e.key === "," ? -0.1 : 0.1)) * 10) / 10);
      pops.push({ x: canvas.width / 2, y: 70, age: 0, text: `${music ? "music" : "vol"} ${Math.round(get() * 100)}%`, color: "#9fd0ff" });
    }
    return;
  }
  if (e.key.toLowerCase() === "n") {
    if (!e.repeat) {
      nightMode = !nightMode;
      saveItem("starCatcherNight", String(nightMode));
    }
    return;
  }
  if (e.key.toLowerCase() === "f") {
    if (!e.repeat) fpsEnabled = !fpsEnabled;
    return;
  }
  if (e.key.toLowerCase() === "r") {
    if (!e.repeat && (state === "playing" || state === "paused" || (state === "over" && performance.now() - gameOverTime >= RESTART_DELAY_MS))) reset();
    return;
  }
  if (e.key.toLowerCase() === "p" || e.key === "Escape") {
    if (!e.repeat && (state === "playing" || state === "paused")) {
      if (state === "playing") {
        state = "paused";
        pauseStartTime = performance.now();
        setMusicPaused(true);
      } else {
        state = "playing";
        setMusicPaused(false);
      }
      playPauseSound();
    }
    return;
  }
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    if (state === "ready" || (state === "over" && performance.now() - gameOverTime >= RESTART_DELAY_MS)) startGame();
    return;
  }
  if (e.key.startsWith("Arrow")) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
}

bindInput({
  onPointerStart() {
    if (state === "ready" || (state === "over" && performance.now() - gameOverTime >= RESTART_DELAY_MS)) startGame();
  },
  onHidden() {
    if (state === "playing") {
      state = "paused";
      pauseStartTime = performance.now();
      setMusicPaused(true);
    }
  },
  onKeyDown,
  onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
  },
});

let lastTime = performance.now();

function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  if (fpsWindowStart === 0) fpsWindowStart = time;
  fpsFrameCount += 1;
  if (time - fpsWindowStart >= 1000) {
    fpsText = `FPS ${fpsFrameCount}`;
    fpsValue = fpsFrameCount;
    fpsFrameCount = 0;
    fpsWindowStart = time;
  }
  if (state !== "paused") update(dt);
  draw();
  requestAnimationFrame(frame);
}

reset();
state = "ready";
playMusic("title");
requestAnimationFrame(frame);

// handy for poking at in the console
window.__game = {
  get state() { return state; },
  get score() { return score; },
  get lives() { return lives; },
  get starsCaught() { return starsCaught; },
  get items() { return items; },
  get pops() { return pops; },
  get muted() { return isMuted(); },
  get magnetRemaining() { return magnetRemaining; },
  get gustRemaining() { return gustRemaining; },
  get difficulty() { return difficulty.name; },
  spriteReady: (name) => isReady(name),
  spriteReadySheet: (name) => isReady(name + "_sheet"),
  set(name, value) {
    if (name === "lives") lives = value;
    else if (name === "score") score = value;
    else if (name === "shootingStar") shootingStar = value;
    else if (name === "gustRemaining") gustRemaining = value;
    else if (name === "gustDirection") gustDirection = value;
    else if (name === "magnetRemaining") magnetRemaining = value;
    else if (name === "state") state = value;
  },
};
