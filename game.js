import { loadItem, saveItem } from "./persist.js";
import {
  initializeAudio, isMuted, toggleMute, getVolume, setVolume,
  getMusicVolume, setMusicVolume, isMusicMuted, toggleMusicMute,
  playCatchSound, playPauseSound, playNewBestSound, playGustSound, playMissSound, playUnlockSound,
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
  { name: "easy", fallSpeed: 90, spawnEvery: 1.15 },
  { name: "normal", fallSpeed: 120, spawnEvery: 1 },
  { name: "hard", fallSpeed: 160, spawnEvery: 0.85 },
  { name: "expert", fallSpeed: 200, spawnEvery: 0.75 },
];
const SPEED_UP_EVERY = 10;
const STAGE_EVERY = 50;
const STAGES = [
  { name: "day", sky: null, stars: "#fff" },
  { name: "dusk", sky: "rgba(255, 140, 60, 0.16)", stars: "#ffd9a0", glow: "rgba(255, 120, 40, 0.22)" },
  { name: "night", sky: "rgba(10, 10, 50, 0.4)", stars: "#aab4ff", glow: "rgba(80, 80, 200, 0.18)" },
  { name: "deep space", sky: "rgba(70, 0, 110, 0.35)", stars: "#d0c0ff", glow: "rgba(150, 0, 220, 0.22)" },
  { name: "aurora", sky: "rgba(0, 140, 90, 0.22)", stars: "#9fffd0", glow: "rgba(0, 255, 160, 0.16)" },
];
const SPEED_UP_AMOUNT = 20;
const SPAWN_EVERY = 0.9;
const MAX_ITEMS = 14;
const SPAWN_INTERVAL_SCORE_STEP = 5;
const SPAWN_INTERVAL_DECREASE = 0.03;
const MIN_SPAWN_EVERY = 0.45;
const STAR_CHANCE = 0.7;
const GOLDEN_STAR_CHANCE = 1 / 12;
const GOLDEN_HEART_CHANCE = 0.15;
const COMET_CHANCE = 0.04;
const SUPER_STAR_CHANCE = 0.015;
const PRISM_STAR_CHANCE = 1 / 60;
const WILD_STAR_CHANCE = 1 / 40;
const FEVER_EVERY = 100;
const SHOWER_EVERY = 200;
const STORM_EVERY = 500;
const FEVER_DURATION = 6;
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
  const tilt = Math.min(playerSpeed / 500, 1) * 0.16;
  if (!playerFacingLeft) {
    drawSprite(ctx, "player", x, player.y + yOffset, frame, tilt);
    return;
  }

  ctx.save();
  ctx.translate(x * 2 + SIZE.player, 0);
  ctx.scale(-1, 1);
  drawSprite(ctx, "player", x, player.y + yOffset, frame, tilt);
  ctx.restore();
}

let best = Number(loadItem("starCatcherBest", "0"));
let bestStreak = Number(loadItem("starCatcherBestStreak", "0"));
let totalStars = Number(loadItem("starCatcherTotalStars", "0"));
let totalScore = Number(loadItem("starCatcherTotalScore", "0"));
let totalRuns = Number(loadItem("starCatcherRuns", "0"));
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
let lastStage = -1;
let stageFlash = 0;
let feverTimer = 0;
let nextFeverAt = FEVER_EVERY;
let nextShowerAt = SHOWER_EVERY;
let nextStormAt = STORM_EVERY;
let menuIndex = 0;
let pauseIndex = 0;
let gamepadDir = 0;
let particleScale = 1;
let konami = [];
let runUnlocks = [];
let trailTimer = 0;
let padA = false;
let padStart = false;
let nightMode = loadItem("starCatcherNight", "false") === "true";
let screenShake = loadItem("starCatcherShake", "true") !== "false";
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
  lastStage = -1;
  stageFlash = 0;
  trailTimer = 0;
  runUnlocks = [];
  feverTimer = 0;
  nextFeverAt = FEVER_EVERY;
  nextShowerAt = SHOWER_EVERY;
  nextStormAt = STORM_EVERY;
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

function stageIndex() {
  return Math.floor(score / STAGE_EVERY) % STAGES.length;
}

function stageName() {
  return STAGES[stageIndex()].name;
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
  const comet = type === "star" && stageIndex() >= 2 && Math.random() < COMET_CHANCE;
  const superStar = type === "star" && stageIndex() >= 4 && Math.random() < SUPER_STAR_CHANCE;
  const prism = type === "star" && Math.random() < PRISM_STAR_CHANCE;
  const wild = type === "star" && Math.random() < WILD_STAR_CHANCE;
  const golden = comet || superStar || prism || wild || (type === "star" && Math.random() < GOLDEN_STAR_CHANCE) || (type === "heart" && Math.random() < GOLDEN_HEART_CHANCE);
  const speedMultiplier = (type === "rock" ? (Math.random() < FAST_ROCK_CHANCE ? 1.5 : 0.9 + Math.random() * 0.2) : type === "heart" ? 0.8 : type === "star" ? 0.95 + Math.random() * 0.1 : type === "magnet" ? 0.7 : 1) * (comet ? 1.9 : superStar ? 0.75 : 1) * (1 + stageIndex() * 0.05);
  let x = Math.random() * (canvas.width - SIZE[type]);
  for (let tries = 0; tries < 3 && items.some(item => Math.abs(item.x + SIZE[item.type] / 2 - (x + SIZE[type] / 2)) < 40); tries++) {
    x = Math.random() * (canvas.width - SIZE[type]);
  }
  items.push({ type, golden, comet, super: superStar, prism, wild, wildValue: 1 + Math.floor(Math.random() * 5), speedMultiplier, drift: (Math.random() * 2 - 1) * 12, phase: Math.random() * 6.28, rot: type === "rock" ? Math.random() * 6.28 : 0, x, y: -SIZE[type] });
  if (type === "star" && !golden && items.length < MAX_ITEMS && Math.random() < 0.04) {
    items.push({ type: "star", golden: false, speedMultiplier: 0.95 + Math.random() * 0.1, drift: (Math.random() * 2 - 1) * 12, phase: Math.random() * 6.28, x: Math.min(canvas.width - SIZE.star, Math.max(0, x + SIZE.star + 4)), y: -SIZE.star });
  }
  if (type === "rock" && items.length < MAX_ITEMS && Math.random() < 0.12) {
    items.push({ type: "rock", golden: false, comet: false, speedMultiplier, drift: (Math.random() * 2 - 1) * 12, phase: Math.random() * 6.28, rot: Math.random() * 6.28, x: Math.min(canvas.width - SIZE.rock, Math.max(0, x + SIZE.rock + 6)), y: -SIZE.rock });
  }
}

function getSpawnInterval() {
  const reductions = Math.floor(score / SPAWN_INTERVAL_SCORE_STEP) * SPAWN_INTERVAL_DECREASE;
  return Math.max(MIN_SPAWN_EVERY, (SPAWN_EVERY - reductions) * difficulty.spawnEvery);
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
  if (qualifiesForBoard(score)) {
    state = "entry";
    entryLetters = ["A", "A", "A"];
    entryIndex = 0;
    entryScore = score;
  } else {
    state = "over";
  }
  playMusic("title");
  gameOverTime = performance.now();
  const elapsed = Math.floor((gameOverTime - runStartTime) / 1000);
  runTimeText = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  newBest = score > best;
  if (newBest) {
    best = score;
    saveItem("starCatcherBest", String(best));
    playNewBestSound();
    spawnSparkles(canvas.width * 0.3, 150, "#ffd93b");
    spawnSparkles(canvas.width * 0.5, 120, "#ffffff");
    spawnSparkles(canvas.width * 0.7, 150, "#ff8fb3");
  }
  if (runBestStreak > bestStreak) {
    bestStreak = runBestStreak;
    saveItem("starCatcherBestStreak", String(bestStreak));
  }
  saveItem("starCatcherTotalStars", String(totalStars));
  totalScore += score;
  saveItem("starCatcherTotalScore", String(totalScore));
  totalRuns += 1;
  saveItem("starCatcherRuns", String(totalRuns));
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
  spawnSparkles(player.x + SIZE.player / 2, player.y + SIZE.player / 2, "#ffd75e", 16);
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
  stageFlash = Math.max(0, stageFlash - dt);
  feverTimer = Math.max(0, feverTimer - dt);
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
  checkAchievements();

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
    const move = touch.dir !== 0 ? touch.dir : gamepadDir !== 0 ? gamepadDir : Math.abs(touch.tilt) > 0.15 ? touch.tilt : (keys["arrowright"] || keys["d"] ? 1 : 0) - (keys["arrowleft"] || keys["a"] ? 1 : 0);
    player.x += move * PLAYER_SPEED * dt;
  }
  player.x += gustDirection * GUST_SPEED * gustPushTime;
  player.x = Math.max(0, Math.min(canvas.width - SIZE.player, player.x));
  playerSpeed = dt > 0 ? Math.abs(player.x - previousPlayerX) / dt : 0;
  playerTrail.push(previousPlayerX);
  trailTimer -= dt;
  if (playerSpeed > 300 && trailTimer <= 0) {
    trailTimer = 0.08;
    spawnSparkles(player.x + SIZE.player / 2, player.y + SIZE.player / 2, "#9fd0ff", 2);
  }
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
          comboFlashRemaining = streak % 50 === 0 ? COMBO_FLASH_DURATION * 2 : COMBO_FLASH_DURATION;
        }
        runBestStreak = Math.max(runBestStreak, streak);
        let value = item.super ? 10 : item.comet ? 5 : item.prism ? 4 : item.wild ? item.wildValue : item.golden ? 3 : 1;
        const centerDistance = Math.abs((item.x + SIZE.star / 2) - (player.x + SIZE.player / 2));
        if (centerDistance < SIZE.player / 6) {
          value += 1;
          perfectFlash = 'PERFECT!';
          perfectFlashRemaining = PERFECT_FLASH_DURATION;
        }
        score += value * feverMult();
        if ((item.comet || item.super) && items.length < MAX_ITEMS) {
          const pieces = item.super ? 5 : 3;
          for (let s = 0; s < pieces; s++) {
            const dir = s - Math.floor(pieces / 2);
            items.push({ type: "star", golden: false, comet: false, super: false, speedMultiplier: 0.95 + Math.random() * 0.1, drift: dir * 30, phase: Math.random() * 6.28, rot: 0, x: Math.max(0, Math.min(canvas.width - SIZE.star, player.x + SIZE.player / 2 - SIZE.star / 2 + dir * 50)), y: player.y + SIZE.player });
          }
        }
        checkNewBest();
        checkHeartBonus();
        checkMilestone();
        spawnSparkles(item.x + SIZE.star / 2, item.y + SIZE.star / 2, item.prism ? "#7ef0ff" : item.golden ? "#ffcf40" : "#fff3a0", item.golden || item.prism ? 14 : SPARKLE_COUNT);
        hopTimer = HOP_DURATION;
        pops.push({ x: item.x + SIZE.star / 2, y: item.y + SIZE.star / 2, age: 0, value: value * feverMult(), color: item.prism ? "#7ef0ff" : item.golden ? "#ffd93b" : "#fff" });
      } else if (item.type === "magnet") {
        magnetRemaining = MAGNET_DURATION;
        comboFlash = "MAGNET!";
        comboFlashRemaining = COMBO_FLASH_DURATION;
        spawnSparkles(item.x + SIZE.magnet / 2, item.y + SIZE.magnet / 2, "#8fd0ff");
        hopTimer = HOP_DURATION;
      } else if (item.type === "heart") {
        if (lives < MAX_LIVES) {
          lives = Math.min(MAX_LIVES, lives + (item.golden ? 2 : 1));
          heartPopupRemaining = HEART_POPUP_DURATION;
          spawnSparkles(item.x + SIZE.heart / 2, item.y + SIZE.heart / 2, item.golden ? "#ffd93b" : "#ff8fb3");
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
        score += 1;
        pops.push({ x: item.x + SIZE.rock / 2, y: item.y + SIZE.rock / 2, age: 0, text: 'close! +1', color: item.speedMultiplier > 1.4 ? "#ff9d9d" : "#9fd0ff" });
      }
    }
    if (hit || item.y >= canvas.height) items.splice(i, 1);
  }

  if (shootingStar) {
    shootingStar.x += SHOOTING_STAR_SPEED * shootingStar.dir * dt + gustDirection * GUST_SPEED * 0.25 * gustPushTime;
    shootingStarTrailTimer -= dt;
    if (shootingStarTrailTimer <= 0) {
      shootingStarTrailTimer = 0.08;
      spawnSparkles(shootingStar.x + SHOOTING_STAR_SIZE / 2 - shootingStar.dir * 10, shootingStar.y + SHOOTING_STAR_SIZE / 2, "#ffffff", 1);
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
        comboFlashRemaining = streak % 50 === 0 ? COMBO_FLASH_DURATION * 2 : COMBO_FLASH_DURATION;
      }
      score += 5 * feverMult();
      checkNewBest();
      checkHeartBonus();
      checkMilestone();
      spawnSparkles(shootingStar.x + SHOOTING_STAR_SIZE / 2, shootingStar.y + SHOOTING_STAR_SIZE / 2, "#ffffff");
      hopTimer = HOP_DURATION;
      pops.push({
        x: shootingStar.x + SHOOTING_STAR_SIZE / 2,
        y: shootingStar.y + SHOOTING_STAR_SIZE / 2,
        age: 0,
        value: 5 * feverMult(),
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
  const stage = stageIndex();
  if (stage !== lastStage) {
    lastStage = stage;
    if (stage > 0) {
      pops.push({ x: canvas.width / 2, y: 120, age: 0, text: `stage ${stage + 1}: ${STAGES[stage].name}`, color: "#9fd0ff" });
      stageFlash = 0.4;
    }
  }
  if (score >= nextFeverAt) {
    nextFeverAt += FEVER_EVERY;
    feverTimer = FEVER_DURATION;
    pops.push({ x: canvas.width / 2, y: 100, age: 0, text: "FEVER x2!", color: "#ffd93b" });
    playNewBestSound();
  }
  if (score >= nextShowerAt) {
    nextShowerAt += SHOWER_EVERY;
    for (let i = 0; i < 14 && items.length < MAX_ITEMS; i++) {
      items.push({ type: "star", golden: Math.random() < GOLDEN_STAR_CHANCE, comet: false, super: false, prism: false, speedMultiplier: 0.9 + Math.random() * 0.25, drift: (Math.random() * 2 - 1) * 20, phase: Math.random() * 6.28, rot: 0, x: Math.random() * (canvas.width - SIZE.star), y: -SIZE.star - i * 30 });
    }
    pops.push({ x: canvas.width / 2, y: 84, age: 0, text: "STAR SHOWER!", color: "#9fd0ff" });
    playGustSound();
  }
  if (score >= nextStormAt) {
    nextStormAt += STORM_EVERY;
    for (let i = 0; i < 8 && items.length < MAX_ITEMS; i++) {
      items.push({ type: "rock", golden: false, comet: false, super: false, prism: false, wild: false, speedMultiplier: 1.3 + Math.random() * 0.3, drift: (Math.random() * 2 - 1) * 20, phase: Math.random() * 6.28, rot: Math.random() * 6.28, x: Math.random() * (canvas.width - SIZE.rock), y: -SIZE.rock - i * 25 });
    }
    pops.push({ x: canvas.width / 2, y: 84, age: 0, text: "ROCK STORM!", color: "#ff9d9d" });
    playMissSound();
  }
  setMusicLevel(1 + Math.floor(score / SPEED_UP_EVERY) + (feverTimer > 0 ? 1 : 0));
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

function menuItems() {
  return [
    { id: "play", label: "play" },
    { id: "difficulty", label: `difficulty: ${difficulty.name}` },
    { id: "sound", label: `sound: ${isMuted() ? "off" : "on"}` },
    { id: "music", label: `music: ${isMusicMuted() ? "off" : "on"}` },
    { id: "stats", label: "stats" },
    { id: "shake", label: `shake: ${screenShake ? "on" : "off"}` },
    { id: "howto", label: "how to play" },
  ];
}

function cycleMenuValue(id, direction) {
  if (id === "difficulty") {
    difficultyIndex = (difficultyIndex + direction + DIFFICULTIES.length) % DIFFICULTIES.length;
    difficulty = DIFFICULTIES[difficultyIndex];
    saveItem("starCatcherDifficulty", String(difficultyIndex));
  } else if (id === "sound") {
    toggleMute();
  } else if (id === "music") {
    toggleMusicMute();
  } else if (id === "shake") {
    screenShake = !screenShake;
    saveItem("starCatcherShake", String(screenShake));
  }
}

function activateMenuItem() {
  const item = menuItems()[menuIndex];
  if (item.id === "play") startGame();
  else if (item.id === "howto") state = "help";
  else if (item.id === "stats") state = "stats";
  else cycleMenuValue(item.id, 1);
}

function pauseItems() {
  return [
    { id: "resume", label: "resume" },
    { id: "restart", label: "restart" },
    { id: "quit", label: "quit to title" },
  ];
}

function activatePauseItem() {
  const item = pauseItems()[pauseIndex];
  if (item.id === "resume") {
    state = "playing";
    setMusicPaused(false);
  } else if (item.id === "restart") {
    reset();
  } else {
    state = "ready";
    setMusicPaused(false);
    playMusic("title");
  }
  playPauseSound();
}

let highScores = [];
try {
  highScores = JSON.parse(loadItem("starCatcherScores", "[]")) || [];
} catch {
  highScores = [];
}

function qualifiesForBoard(value) {
  return value > 0 && (highScores.length < 10 || value > highScores[highScores.length - 1].score);
}

function saveScoreEntry(name, value) {
  highScores.push({ name, score: value, date: new Date().toISOString().slice(0, 10) });
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, 10);
  saveItem("starCatcherScores", JSON.stringify(highScores));
}

const ACHIEVEMENTS = [
  { id: "first-star", label: "first star", test: () => starsCaught >= 1 },
  { id: "combo-10", label: "combo x10", test: () => streak >= 10 },
  { id: "century", label: "100 points", test: () => score >= 100 },
  { id: "stage-3", label: "reach stage 3", test: () => stageIndex() >= 2 },
  { id: "stargazer", label: "100 stars total", test: () => totalStars >= 100 },
  { id: "high-roller", label: "score 250", test: () => score >= 250 },
  { id: "combo-25", label: "combo x25", test: () => streak >= 25 },
  { id: "aurora", label: "reach the aurora", test: () => stageIndex() >= 4 },
  { id: "gold-rush", label: "5 golden stars", test: () => goldenCaught >= 5 },
  { id: "century-club", label: "1000 points all time", test: () => totalScore >= 1000 },
];
let unlocked = new Set();
try {
  unlocked = new Set(JSON.parse(loadItem("starCatcherAchievements", "[]")));
} catch {
  unlocked = new Set();
}

const feverMult = () => (feverTimer > 0 ? 2 : 1);

function spawnSparkles(x, y, color, count = SPARKLE_COUNT) {
  spawnStarSparkles(x, y, color, Math.max(1, Math.round(count * particleScale)));
}

function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (!unlocked.has(a.id) && a.test()) {
      unlocked.add(a.id);
      saveItem("starCatcherAchievements", JSON.stringify([...unlocked]));
      pops.push({ x: canvas.width / 2, y: 140, age: 0, text: `achievement: ${a.label}`, color: "#ffd93b" });
      runUnlocks.push(a.label);
      playUnlockSound();
    }
  }
}

let entryLetters = ["A", "A", "A"];
let entryIndex = 0;
let entryScore = 0;

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
  const shaking = shake > 0 && !reducedMotion && screenShake;
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

  const stageSky = nightMode ? null : STAGES[stageIndex()].sky;
  const stageStars = nightMode ? "#fff" : STAGES[stageIndex()].stars;
  drawStarfield(ctx, starfield, now, gustRemaining > 0, reducedMotion, stageStars, canvas.height);
  if (stageSky) {
    ctx.fillStyle = stageSky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const stageGlow = nightMode ? null : STAGES[stageIndex()].glow;
  if (stageGlow) {
    const grad = ctx.createLinearGradient(0, canvas.height * 0.55, 0, canvas.height);
    grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, stageGlow);
    ctx.fillStyle = grad;
    ctx.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);
  }

  if (stageFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${stageFlash * 0.5})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (feverTimer > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 120);
    ctx.strokeStyle = `rgba(255, 217, 59, ${0.4 + pulse * 0.4})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    drawPixelText("FEVER x2", canvas.width / 2, 96, 14, "center");
  }

  const speedLevelNow = 1 + Math.floor(score / SPEED_UP_EVERY);
  if (speedLevelNow >= 3 && state === "playing") {
    ctx.globalAlpha = Math.min(0.22, (speedLevelNow - 2) * 0.07);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    for (let i = 0; i < speedLevelNow * 3; i++) {
      const x = (i * 97 + now * 6) % canvas.width;
      const y = (i * 173 + now * (8 + speedLevelNow * 4)) % canvas.height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 18 + speedLevelNow * 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

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
  drawPixelText(difficulty.name, 10, 28, 10, "left");
  if (goldenCaught > 0) drawPixelText(`Gold ${goldenCaught}`, canvas.width - 10, 64, 10, "right");
  let hudY = 76;
  if (bestStreak >= 2) {
    drawPixelText(`Best streak ${bestStreak}`, canvas.width - 10, hudY, 10, "right");
    hudY += 24;
  }
  if (streak >= 2) drawPixelText(`Streak ${streak}`, canvas.width - 10, hudY, 10, "right");
  const speedLevel = 1 + Math.floor(score / SPEED_UP_EVERY);
  if (speedLevel >= 2) drawPixelText(`Speed ${speedLevel}`, canvas.width - 10, hudY + 24, 10, "right");
  if (streak >= 2) {
    const barW = 80;
    const prog = (streak % COMBO_EVERY) / COMBO_EVERY;
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(canvas.width / 2 - barW / 2, canvas.height - 12, barW, 5);
    ctx.fillStyle = "#ffd93b";
    ctx.fillRect(canvas.width / 2 - barW / 2, canvas.height - 12, barW * prog, 5);
  }
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

  if (["paused", "over", "help"].includes(state)) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (state === "ready") {
    const titleBob = reducedMotion ? 0 : Math.sin(now / 300) * 4;
    drawText([["Star Catcher", 28]], [titleBob]);
    const items = menuItems();
    const startY = canvas.height / 2 - 30;
    items.forEach((item, i) => {
      const selected = i === menuIndex;
      const label = selected ? `> ${item.label} <` : item.label;
      drawPixelText(label, canvas.width / 2, startY + i * 34, selected ? 16 : 14, "center");
    });
    if (best > 0) {
      drawPixelText(`Best ${best}`, canvas.width / 2, canvas.height - 110, 10, "center");
    }
    if (totalStars > 0) {
      drawPixelText(`Stars ${totalStars} all time`, canvas.width / 2, canvas.height - 92, 8, "center");
    }
    if (totalScore > 0) {
      drawPixelText(`Points ${totalScore} all time`, canvas.width / 2, canvas.height - 76, 8, "center");
    }
    if (unlocked.size > 0) {
      drawPixelText(`achievements ${unlocked.size}/${ACHIEVEMENTS.length}`, canvas.width / 2, canvas.height - 60, 8, "center");
    }
    drawPixelText("up/down pick, enter select", canvas.width / 2, canvas.height - 40, 8, "center");
    drawPixelText("v0.4", canvas.width - 10, canvas.height - 40, 8, "right");
  }
  if (state === "stats") {
    const statLines = [
      ["Stats", 24],
      ["", 10],
      [`runs ${totalRuns}`, 14],
      [`stars ${totalStars} all time`, 14],
      [`points ${totalScore} all time`, 14],
      [`best ${best}   best streak ${bestStreak}`, 14],
      ["", 10],
      [`achievements ${unlocked.size}/${ACHIEVEMENTS.length}`, 12],
      ...ACHIEVEMENTS.filter(a => unlocked.has(a.id)).map(a => [`* ${a.label}`, 10]),
      ["", 10],
    ];
    if (highScores.length > 0) {
      statLines.push(["top scores", 12]);
      highScores.slice(0, 3).forEach((entry, i) => {
        statLines.push([`${i + 1}. ${entry.name}  ${entry.score}${entry.date ? `  ${entry.date.slice(5)}` : ""}`, 10]);
      });
      statLines.push(["", 10]);
    }
    statLines.push(["any key - back", 14]);
    drawText(statLines);
  }
  if (state === "help") {
    const helpLines = [
      ["How to play", 24],
      ["", 10],
      ["arrows, a/d or gamepad - move", 14],
      ["space - start / restart", 14],
      ["p or esc - pause", 14],
      ["catch stars, dodge rocks", 14],
      ["golden stars = 3, comets = 5", 14],
      ["prism 4, wild is random, super 10", 12],
      ["fever doubles points for 6s", 12],
      ["star shower every 200, rock storm 500", 12],
      ["achievements unlock as you play", 12],
      ["m sound, shift+m music", 14],
      ["[ ] volume, , . music vol", 14],
      ["", 10],
      ["enter - back", 14],
      ["c on game over copies score", 12],
    ];
    drawText(helpLines);
  }
  if (state === "entry") {
    drawText([["New high score!", 24], [`Score ${entryScore}`, 16], ["", 8], ["enter initials:", 14], [entryLetters.join(" "), 28], ["", 8], ["arrows pick letter, up/down change", 10], ["enter to save", 10]]);
  }
  if (state === "over") {
    const gameOverLines = [["Game over", 28], [`Score ${score}   Best ${best}   ${runTimeText}`, 14]];
    if (newBest) gameOverLines.push(["New best!", 14]);
    const attempts = starsCaught + rocksHit;
    const accuracy = attempts > 0 ? Math.round((starsCaught / attempts) * 100) : 0;
    gameOverLines.push([`Stars ${starsCaught}  Rocks ${rocksHit}  Acc ${accuracy}%  ${difficulty.name}`, 14]);
    gameOverLines.push([`Stage ${stageIndex() + 1} (${stageName()})`, 12]);
    gameOverLines.push([`All time ${totalStars}${goldenCaught > 0 ? `   Gold ${goldenCaught}` : ""}`, 14]);
    gameOverLines.push([`Runs ${totalRuns}`, 10]);
    if (runUnlocks.length > 0) gameOverLines.push([`unlocked: ${runUnlocks.slice(0, 3).join(", ")}${runUnlocks.length > 3 ? "..." : ""}`, 10]);
    if (highScores.length > 0) {
      gameOverLines.push(["top scores", 12]);
      highScores.slice(0, 5).forEach((entry, i) => {
        gameOverLines.push([`${i + 1}. ${entry.name}  ${entry.score}${entry.date ? `  ${entry.date.slice(5)}` : ""}`, 10]);
      });
    }

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
    drawPixelText("c - copy score", canvas.width / 2, promptY + 22, 8, "center");
  }
  if (state === "paused") {
    drawText([["Paused", 28]]);
    const items = pauseItems();
    const startY = canvas.height / 2 + 10;
    items.forEach((item, i) => {
      const selected = i === pauseIndex;
      drawPixelText(selected ? `> ${item.label} <` : item.label, canvas.width / 2, startY + i * 34, selected ? 16 : 14, "center");
    });
    const speedLevel = 1 + Math.floor(score / SPEED_UP_EVERY);
    drawPixelText(`Score ${score}   Stars ${starsCaught}`, canvas.width / 2, canvas.height - 90, 10, "center");
    drawPixelText(`Difficulty: ${difficulty.name}   Speed ${speedLevel}   Stage ${stageIndex() + 1}`, canvas.width / 2, canvas.height - 70, 8, "center");
    drawPixelText("p or esc resume - r restart", canvas.width / 2, canvas.height - 40, 8, "center");
  }
  if (shaking) ctx.restore();
}

function onKeyDown(e) {
  const konamiSeq = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
  konami.push(e.key.toLowerCase());
  if (konami.length > konamiSeq.length) konami.shift();
  if (konami.join(",") === konamiSeq.join(",")) {
    konami = [];
    for (let i = 0; i < 20 && items.length < MAX_ITEMS; i++) {
      items.push({ type: "star", golden: true, comet: false, super: false, prism: false, speedMultiplier: 0.9 + Math.random() * 0.2, drift: (Math.random() * 2 - 1) * 20, phase: Math.random() * 6.28, rot: 0, x: Math.random() * (canvas.width - SIZE.star), y: -SIZE.star - i * 20 });
    }
    pops.push({ x: canvas.width / 2, y: 70, age: 0, text: "GOLDEN STORM!", color: "#ffd93b" });
    playNewBestSound();
  }
  if (state === "help" || state === "stats") {
    state = "ready";
    return;
  }
  if (state === "entry") {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      entryIndex = (entryIndex + (e.key === "ArrowRight" ? 1 : -1) + 3) % 3;
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const delta = e.key === "ArrowUp" ? -1 : 1;
      const cur = entryLetters[entryIndex].charCodeAt(0);
      entryLetters[entryIndex] = String.fromCharCode(((cur - 65 + delta + 26) % 26) + 65);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      saveScoreEntry(entryLetters.join(""), entryScore);
      state = "over";
      gameOverTime = performance.now();
    }
    return;
  }
  if (state === "paused" && !e.repeat && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "w" || e.key === "s" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    const down = e.key === "ArrowDown" || e.key === "s" || e.key === "ArrowRight";
    pauseIndex = (pauseIndex + (down ? 1 : -1) + pauseItems().length) % pauseItems().length;
    playPauseSound();
    return;
  }
  if (state === "over" && e.key.toLowerCase() === "c") {
    const text = `Star Catcher score: ${score} (best ${best})`;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    pops.push({ x: canvas.width / 2, y: canvas.height / 2 + 120, age: 0, text: "score copied!", color: "#9fd0ff" });
    return;
  }
  if (state === "ready" && !e.repeat && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "w" || e.key === "s")) {
    e.preventDefault();
    const down = e.key === "ArrowDown" || e.key === "s";
    menuIndex = (menuIndex + (down ? 1 : -1) + menuItems().length) % menuItems().length;
    playPauseSound();
    return;
  }
  if (state === "ready" && !e.repeat && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    const item = menuItems()[menuIndex];
    if (["difficulty", "sound", "music"].includes(item.id)) cycleMenuValue(item.id, e.key === "ArrowRight" ? 1 : -1);
    return;
  }
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
        pauseIndex = 0;
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
    if (state === "ready") activateMenuItem();
    else if (state === "paused") activatePauseItem();
    else if (state === "over" && performance.now() - gameOverTime >= RESTART_DELAY_MS) startGame();
    return;
  }
  if (e.key.startsWith("Arrow")) e.preventDefault();
  keys[e.key.toLowerCase()] = true;
}

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js");
}

bindInput({
  onPointerStart(event) {
    if (state === "ready" && event) {
      const rect = canvas.getBoundingClientRect();
      const nx = (event.clientX - rect.left) * canvas.width / rect.width;
      const ny = (event.clientY - rect.top) * canvas.height / rect.height;
      const startY = canvas.height / 2 - 30;
      const hit = menuItems().findIndex((item, i) => Math.abs(ny - (startY + i * 34 + 8)) < 17 && Math.abs(nx - canvas.width / 2) < 110);
      if (hit >= 0) {
        menuIndex = hit;
        activateMenuItem();
        return;
      }
    }
    if (state === "ready" || (state === "over" && performance.now() - gameOverTime >= RESTART_DELAY_MS)) startGame();
  },
  onHidden() {
    if (state === "playing") {
      state = "paused";
      pauseStartTime = performance.now();
      pauseIndex = 0;
      setMusicPaused(true);
    }
  },
  onKeyDown,
  onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
  },
});

let lastTime = performance.now();

function pollGamepad() {
  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = pads && pads[0];
  gamepadDir = 0;
  if (!pad) {
    padA = false;
    padStart = false;
    return;
  }
  const axis = pad.axes[0] || 0;
  const left = !!(pad.buttons[14] && pad.buttons[14].pressed);
  const right = !!(pad.buttons[15] && pad.buttons[15].pressed);
  if (axis < -0.4 || left) gamepadDir = -1;
  else if (axis > 0.4 || right) gamepadDir = 1;
  const a = !!(pad.buttons[0] && pad.buttons[0].pressed);
  if (a && !padA && (state === "ready" || (state === "over" && performance.now() - gameOverTime >= RESTART_DELAY_MS))) startGame();
  padA = a;
  const start = !!(pad.buttons[9] && pad.buttons[9].pressed);
  if (start && !padStart && (state === "playing" || state === "paused")) {
    if (state === "playing") {
      state = "paused";
      pauseStartTime = performance.now();
      pauseIndex = 0;
      setMusicPaused(true);
    } else {
      state = "playing";
      setMusicPaused(false);
    }
    playPauseSound();
  }
  padStart = start;
}

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
  if (fpsValue > 0) {
    if (fpsValue < 45 && particleScale > 0.4) particleScale = Math.max(0.4, particleScale - 0.1);
    else if (fpsValue > 55 && particleScale < 1) particleScale = Math.min(1, particleScale + 0.05);
  }
  const liveEl = document.getElementById("live");
  if (liveEl && time - (frame.lastLive || 0) > 500) {
    frame.lastLive = time;
    liveEl.textContent = state === "playing" ? `score ${score}, lives ${lives}` : "";
  }
  pollGamepad();
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
