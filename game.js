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
const SPAWN_INTERVAL_SCORE_STEP = 5;
const SPAWN_INTERVAL_DECREASE = 0.03;
const MIN_SPAWN_EVERY = 0.45;
const STAR_CHANCE = 0.7;
const GOLDEN_STAR_CHANCE = 1 / 12;
const MAGNET_CHANCE = 1 / 25;
const HEART_CHANCE = 1 / 30;
const FAST_ROCK_CHANCE = 0.2;
const MAGNET_DURATION = 4;
const MAGNET_SPEED = 300;
const SHOOTING_STAR_INTERVAL = 20;
const SHOOTING_STAR_SPEED = 500;
const SHOOTING_STAR_SIZE = 24;
const SHOOTING_STAR_Y = 40;
const STAR_FREQUENCY = 600;
const STAR_DURATION = 0.08;
const ROCK_FREQUENCY = 140;
const PAUSE_FREQUENCY = 220;
const PAUSE_DURATION = 0.07;
const ROCK_DURATION = 0.15;
const POP_DURATION = 0.8;
const HEART_POPUP_DURATION = 0.8;
const BIT_COUNT = 6;
const BIT_POOL_SIZE = BIT_COUNT * 10;
const BIT_LIFETIME = 0.4;
const BIT_GRAVITY = 500;
const SPARKLE_COUNT = 8;
const SPARKLE_POOL_SIZE = SPARKLE_COUNT * 10;
const SPARKLE_LIFETIME = 0.35;
const SPARKLE_GRAVITY = 250;
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

const SPRITES = {
  background: "assets/background.png",
  player: "assets/player.png",
  star: "assets/star.png",
  rock: "assets/rock.png",
  heart: "assets/heart.png",
};
const SIZE = { player: 64, star: 32, rock: 32, magnet: 32, heart: 24 };
const FALLBACK = { player: "#4fc3f7", star: "#ffd93b", rock: "#8a8a8a", heart: "#ff5577" };
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

function drawPlayer(x = player.x, yOffset = 0) {
  if (!playerFacingLeft) {
    drawSprite("player", x, player.y + yOffset);
    return;
  }

  ctx.save();
  ctx.translate(x * 2 + SIZE.player, 0);
  ctx.scale(-1, 1);
  drawSprite("player", x, player.y + yOffset);
  ctx.restore();
}

let best = Number(localStorage.getItem("starCatcherBest") || 0);
let bestStreak = Number(localStorage.getItem("starCatcherBestStreak") || 0);
let totalStars = Number(localStorage.getItem("starCatcherTotalStars") || 0);
let hasSeenControlsTip = localStorage.getItem("starCatcherSeen") === "true";
let state, player, items, pops, lives, score, starsCaught, rocksHit, streak, fallSpeed, spawnTimer;
let runBestStreak = 0;
let bits = [];
const inactiveBits = Array.from({ length: BIT_POOL_SIZE }, () => ({ x: 0, y: 0, vx: 0, vy: 0, age: 0 }));
let sparkles = [];
const inactiveSparkles = Array.from({ length: SPARKLE_POOL_SIZE }, () => ({ x: 0, y: 0, vx: 0, vy: 0, age: 0, color: "#fff3a0" }));
const STARFIELD_COUNT = 40;
const starfield = Array.from({ length: STARFIELD_COUNT }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  phase: Math.random() * Math.PI * 2,
  speed: 1 + Math.random() * 2,
}));
let gustTimer, gustRemaining, gustDirection, magnetRemaining;
let shootingStar, shootingStarTimer;
let difficultyIndex = Number(localStorage.getItem("starCatcherDifficulty") || 1);
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
let audioContext = null;
let muted = localStorage.getItem("starCatcherMuted") === "true";
let nightMode = localStorage.getItem("starCatcherNight") === "true";
let touchTargetX = null;
let fpsEnabled = false;
let fpsWindowStart = 0;
let fpsFrameCount = 0;
let fpsText = "FPS 0";
let bgPattern = null;
const keys = {};

function initializeAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === "suspended") audioContext.resume();
}

function playCatchSound(type, pitchStep = 0) {
  if (muted || !audioContext) return;

  const isStar = type === "star";
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  const duration = isStar ? STAR_DURATION : ROCK_DURATION;

  oscillator.type = isStar ? "sine" : "square";
  oscillator.frequency.value = isStar ? STAR_FREQUENCY + pitchStep : ROCK_FREQUENCY;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function playPauseSound() {
  if (muted || !audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "square";
  oscillator.frequency.value = PAUSE_FREQUENCY;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + PAUSE_DURATION);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + PAUSE_DURATION);
}

function playNewBestSound() {
  if (muted || !audioContext) return;

  const notes = [523, 659, 784];
  notes.forEach((frequency, i) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = audioContext.currentTime + i * 0.09;

    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.1, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.12);
  });
}

function playGustSound() {
  if (muted || !audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(180, now);
  oscillator.frequency.exponentialRampToValueAtTime(420, now + GUST_DURATION);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.06, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + GUST_DURATION);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + GUST_DURATION);
}

function reset() {
  for (const bit of bits) inactiveBits.push(bit);
  bits.length = 0;
  for (const sparkle of sparkles) inactiveSparkles.push(sparkle);
  sparkles.length = 0;
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
  lives = START_LIVES;
  score = 0;
  starsCaught = 0;
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
  newBest = false;
  bestAnnounced = false;
}

function startGame() {
  if (!hasSeenControlsTip) {
    localStorage.setItem("starCatcherSeen", "true");
    hasSeenControlsTip = true;
  }
  reset();
}

function spawnRockBits(x, y, color = "#888") {
  for (let i = 0; i < BIT_COUNT; i++) {
    const bit = inactiveBits.pop();
    if (!bit) break;

    bit.x = x;
    bit.y = y;
    bit.vx = (Math.random() * 2 - 1) * 150;
    bit.vy = (Math.random() * 2 - 1) * 150;
    bit.age = 0;
    bit.color = color;
    bits.push(bit);
  }
}

function spawnStarSparkles(x, y, color = "#fff3a0", count = SPARKLE_COUNT) {
  for (let i = 0; i < count; i++) {
    const sparkle = inactiveSparkles.pop();
    if (!sparkle) break;

    sparkle.x = x;
    sparkle.y = y;
    sparkle.vx = (Math.random() * 2 - 1) * 220;
    sparkle.vy = (Math.random() * 2 - 1) * 220 - 60;
    sparkle.age = 0;
    sparkle.color = color;
    sparkles.push(sparkle);
  }
}

function spawnItem() {
  let type;
  if (lives < MAX_LIVES && Math.random() < HEART_CHANCE) {
    type = "heart";
  } else if (Math.random() < MAGNET_CHANCE) {
    type = "magnet";
  } else {
    type = Math.random() < STAR_CHANCE ? "star" : "rock";
  }
  const golden = type === "star" && Math.random() < GOLDEN_STAR_CHANCE;
  const speedMultiplier = type === "rock" ? (Math.random() < FAST_ROCK_CHANCE ? 1.5 : 0.9 + Math.random() * 0.2) : type === "heart" ? 0.8 : 1;
  items.push({ type, golden, speedMultiplier, x: Math.random() * (canvas.width - SIZE[type]), y: -SIZE[type] });
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
  const elapsed = Math.floor((gameOverTime - runStartTime) / 1000);
  runTimeText = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  newBest = score > best;
  if (newBest) {
    best = score;
    localStorage.setItem("starCatcherBest", String(best));
    playNewBestSound();
    spawnStarSparkles(canvas.width * 0.3, 150, "#ffd93b");
    spawnStarSparkles(canvas.width * 0.5, 120, "#ffffff");
    spawnStarSparkles(canvas.width * 0.7, 150, "#ff8fb3");
  }
  if (runBestStreak > bestStreak) {
    bestStreak = runBestStreak;
    localStorage.setItem("starCatcherBestStreak", String(bestStreak));
  }
  localStorage.setItem("starCatcherTotalStars", String(totalStars));
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

  for (let i = bits.length - 1; i >= 0; i--) {
    const bit = bits[i];
    bit.age += dt;
    bit.vy += BIT_GRAVITY * dt;
    bit.x += bit.vx * dt;
    bit.y += bit.vy * dt;
    if (bit.age >= BIT_LIFETIME) {
      bits.splice(i, 1);
      inactiveBits.push(bit);
    }
  }

  for (let i = sparkles.length - 1; i >= 0; i--) {
    const sparkle = sparkles[i];
    sparkle.age += dt;
    sparkle.vy += SPARKLE_GRAVITY * dt;
    sparkle.x += sparkle.vx * dt;
    sparkle.y += sparkle.vy * dt;
    if (sparkle.age >= SPARKLE_LIFETIME) {
      sparkles.splice(i, 1);
      inactiveSparkles.push(sparkle);
    }
  }

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
  if (touchTargetX !== null) {
    const distance = touchTargetX - player.x;
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
      item.x += gustDirection * GUST_SPEED * 0.25 * gustPushTime;
      item.x = Math.max(0, Math.min(canvas.width - SIZE[item.type], item.x));
    }

    const hit = touchesPlayer(item);
    if (hit) {
      playCatchSound(item.type === "heart" ? "star" : item.type, item.type === "star" ? Math.min(streak, 10) * 40 + (item.golden ? 160 : 0) : 0);
      if (item.type === "star") {
        starsCaught += 1;
        totalStars += 1;
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
          lives += 1;
          heartPopupRemaining = HEART_POPUP_DURATION;
          spawnStarSparkles(item.x + SIZE.heart / 2, item.y + SIZE.heart / 2, "#ff8fb3");
          hopTimer = HOP_DURATION;
          pops.push({ x: item.x + SIZE.heart / 2, y: item.y + SIZE.heart / 2, age: 0, value: "heart", color: "#ff8fb3" });
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
      if (streak >= 2) pops.push({ x: item.x + SIZE.star / 2, y: item.y, age: 0, text: "miss", color: "#ff9d9d" });
      streak = 0;
    }
    if (item.type === "rock" && !item.nearMiss && !hit) {
      const verticallyClose = item.y < player.y + SIZE.player && item.y + SIZE.rock > player.y;
      const horizontallyClose = Math.abs((item.x + SIZE.rock / 2) - (player.x + SIZE.player / 2)) < (SIZE.rock + SIZE.player) / 2 + NEAR_MISS_DISTANCE;
      if (verticallyClose && horizontallyClose) {
        item.nearMiss = true;
        pops.push({ x: item.x + SIZE.rock / 2, y: item.y + SIZE.rock / 2, age: 0, text: 'close!', color: "#9fd0ff" });
      }
    }
    if (hit || item.y >= canvas.height) items.splice(i, 1);
  }

  if (shootingStar) {
    shootingStar.x += SHOOTING_STAR_SPEED * dt + gustDirection * GUST_SPEED * 0.25 * gustPushTime;
    const overlapsPlayerX = shootingStar.x < player.x + SIZE.player &&
      shootingStar.x + SHOOTING_STAR_SIZE > player.x;
    if (overlapsPlayerX) {
      playCatchSound("star", Math.min(streak, 10) * 40);
      starsCaught += 1;
      totalStars += 1;
      streak += 1;
      runBestStreak = Math.max(runBestStreak, streak);
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

  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].age += dt;
    if (pops[i].age >= POP_DURATION) pops.splice(i, 1);
  }

  fallSpeed = difficulty.fallSpeed + Math.floor(score / SPEED_UP_EVERY) * SPEED_UP_AMOUNT;
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (shake > 0 && !reducedMotion) {
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

  ctx.fillStyle = "#fff";
  for (const dot of starfield) {
    ctx.globalAlpha = reducedMotion ? 0.4 : 0.25 + 0.25 * Math.sin(now / 500 * dot.speed + dot.phase);
    ctx.fillRect(dot.x, dot.y, 2, 2);
  }
  ctx.globalAlpha = 1;

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
  drawPlayer(state === "ready" ? player.x + Math.sin(now / 400) * 30 : player.x, idleBob - hop);
  for (const item of items) {
    if (item.type === "magnet") {
      ctx.fillStyle = "#4fa3ff";
      ctx.fillRect(item.x, item.y, SIZE.magnet, SIZE.magnet);
    } else if (item.type === "star" && item.golden) {
      const goldenSize = SIZE.star + 8;
      const goldenOffset = (SIZE.star - goldenSize) / 2;
      if (isReady("star")) {
        ctx.filter = "hue-rotate(-20deg) saturate(1.8) brightness(1.15)";
        ctx.shadowColor = "#ffd93b";
        ctx.shadowBlur = 10;
        ctx.drawImage(images.star, item.x + goldenOffset, item.y + goldenOffset, goldenSize, goldenSize);
        ctx.shadowBlur = 0;
        ctx.filter = "none";
      } else {
        ctx.fillStyle = "#ffb300";
        ctx.fillRect(item.x + goldenOffset, item.y + goldenOffset, goldenSize, goldenSize);
      }
    } else if (item.type === "rock" && item.speedMultiplier > 1.4) {
      ctx.filter = "sepia(1) saturate(4) hue-rotate(-50deg)";
      drawSprite("rock", item.x, item.y);
      ctx.filter = "none";
    } else if (item.type === "star" && magnetRemaining > 0) {
      ctx.filter = "hue-rotate(160deg) saturate(1.4)";
      drawSprite("star", item.x, item.y);
      ctx.filter = "none";
    } else {
      drawSprite(item.type, item.x, item.y);
    }
  }
  for (const bit of bits) {
    ctx.fillStyle = bit.color;
    ctx.fillRect(bit.x, bit.y, 3, 3);
  }
  for (const sparkle of sparkles) {
    ctx.fillStyle = sparkle.color;
    ctx.fillRect(sparkle.x, sparkle.y, 2, 2);
  }

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
    ctx.fillStyle = pop.color || "#fff";
    drawPixelText(pop.text || `+${pop.value || 1}`, pop.x, pop.y - progress * 30, 20, "center");
  }
  ctx.globalAlpha = 1;

  if (lives === 1) {
    const pulse = 0.2 + 0.15 * Math.sin(now / 200);
    ctx.strokeStyle = `rgba(255, 60, 60, ${pulse})`;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
  }

  ctx.globalAlpha = heartFlash > 0 ? 0.3 : 1;
  if (lives !== 1 || heartVisible) {
    for (let i = 0; i < lives; i++) drawSprite("heart", 10 + i * 30, 10);
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
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#fff";
    drawPixelText(gustDirection < 0 ? "<<" : ">>", canvas.width / 2, 48, 14, "center");
    ctx.globalAlpha = 1;
  }
  if (fpsEnabled) {
    ctx.fillStyle = "#fff";
    drawPixelText(fpsText, 10, 48, 8, "left");
  }
  ctx.fillStyle = "#fff";
  drawPixelText(`Score ${score}`, canvas.width - 10, 28, 10, "right");
  drawPixelText(`Best ${best}`, canvas.width - 10, 52, 10, "right");
  let hudY = 76;
  if (bestStreak >= 2) {
    drawPixelText(`Best streak ${bestStreak}`, canvas.width - 10, hudY, 10, "right");
    hudY += 24;
  }
  if (streak >= 2) drawPixelText(`Streak ${streak}`, canvas.width - 10, hudY, 10, "right");
  const speedLevel = 1 + Math.floor(score / SPEED_UP_EVERY);
  if (speedLevel >= 2) drawPixelText(`Speed ${speedLevel}`, canvas.width - 10, hudY + 24, 10, "right");
  if (milestoneFlashRemaining > 0) {
    drawPixelText(milestoneFlash, canvas.width / 2, 32, 20, "center");
  }
  if (comboFlashRemaining > 0) {
    drawPixelText(comboFlash, canvas.width / 2, 56, 20, "center");
  }
  if (perfectFlashRemaining > 0) {
    drawPixelText(perfectFlash, canvas.width / 2, 84, 14, 'center');
  }
  if (magnetRemaining > 0) {
    drawPixelText(`Magnet ${Math.ceil(magnetRemaining)}s`, canvas.width / 2, 108, 10, "center");
  }
  if (starsCaught > 0) {
    drawPixelText(`Stars ${starsCaught}`, 10, canvas.height - 26, 8, "left");
  }
  drawPixelText(`M: sound ${muted ? "off" : "on"}`, 10, canvas.height - 10, 10, "left");

  if (state === "paused" || state === "over") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (state === "ready") {
    const titleBob = reducedMotion ? 0 : Math.sin(now / 300) * 4;
    drawText([["Star Catcher", 28], ["Press Space to start", 14]], [titleBob]);
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
    if (!hasSeenControlsTip) {
      drawPixelText("arrows or a/d to move", canvas.width / 2, canvas.height / 2 + 90, 10, "center");
    }
  }
  if (state === "over") {
    const gameOverLines = [["Game over", 28], [`Score ${score}   Best ${best}   ${runTimeText}`, 14]];
    if (newBest) gameOverLines.push(["New best!", 14]);
    const attempts = starsCaught + rocksHit;
    const accuracy = attempts > 0 ? Math.round((starsCaught / attempts) * 100) : 0;
    gameOverLines.push([`Stars ${starsCaught}  Rocks ${rocksHit}  Total ${totalStars}  Acc ${accuracy}%`, 14]);

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
    const speedLevel = 1 + Math.floor(score / SPEED_UP_EVERY);
    pauseLines.push([`Score ${score}   Stars ${starsCaught}`, 14], [`Difficulty: ${difficulty.name}   Speed ${speedLevel}   R restarts`, 10]);
    drawText(pauseLines);
  }
  ctx.restore();
}

function setTouchTarget(event) {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touchX = (event.touches[0].clientX - rect.left) * canvas.width / rect.width;
  touchTargetX = Math.max(0, Math.min(canvas.width - SIZE.player, touchX - SIZE.player / 2));
}

canvas.addEventListener("pointerdown", () => {
  initializeAudio();
  if (state === "ready" || (state === "over" && performance.now() - gameOverTime >= RESTART_DELAY_MS)) startGame();
});
canvas.addEventListener("touchstart", setTouchTarget, { passive: false });
canvas.addEventListener("touchmove", setTouchTarget, { passive: false });
canvas.addEventListener("touchend", () => {
  touchTargetX = null;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("touchcancel", () => {
  touchTargetX = null;
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && state === "playing") {
    state = "paused";
    pauseStartTime = performance.now();
  }
});

window.addEventListener("blur", () => {
  for (const key of Object.keys(keys)) keys[key] = false;
});

document.addEventListener("keydown", (e) => {
  initializeAudio();
  if (["ready", "over"].includes(state) && ["1", "2", "3"].includes(e.key)) {
    difficultyIndex = Number(e.key) - 1;
    difficulty = DIFFICULTIES[difficultyIndex];
    localStorage.setItem("starCatcherDifficulty", String(difficultyIndex));
    return;
  }
  if (["ready", "over"].includes(state) && !e.repeat && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
    e.preventDefault();
    const direction = e.key === "ArrowRight" ? 1 : -1;
    difficultyIndex = (difficultyIndex + direction + DIFFICULTIES.length) % DIFFICULTIES.length;
    difficulty = DIFFICULTIES[difficultyIndex];
    localStorage.setItem("starCatcherDifficulty", String(difficultyIndex));
    return;
  }
  if (e.key.toLowerCase() === "m") {
    if (!e.repeat) {
      muted = !muted;
      localStorage.setItem("starCatcherMuted", String(muted));
    }
    return;
  }
  if (e.key.toLowerCase() === "n") {
    if (!e.repeat) {
      nightMode = !nightMode;
      localStorage.setItem("starCatcherNight", String(nightMode));
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
      } else {
        state = "playing";
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
