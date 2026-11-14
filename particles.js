const BIT_COUNT = 6;
const BIT_POOL_SIZE = BIT_COUNT * 10;
const BIT_LIFETIME = 0.4;
const BIT_GRAVITY = 500;
export const SPARKLE_COUNT = 8;
const SPARKLE_POOL_SIZE = SPARKLE_COUNT * 10;
const SPARKLE_LIFETIME = 0.35;
const SPARKLE_GRAVITY = 250;

export let bits = [];
export let sparkles = [];
const inactiveBits = Array.from({ length: BIT_POOL_SIZE }, () => ({ x: 0, y: 0, vx: 0, vy: 0, age: 0 }));
const inactiveSparkles = Array.from({ length: SPARKLE_POOL_SIZE }, () => ({ x: 0, y: 0, vx: 0, vy: 0, age: 0, color: "#fff3a0" }));


export function clearParticles() {
  for (const bit of bits) inactiveBits.push(bit);
  bits = [];
  for (const sparkle of sparkles) inactiveSparkles.push(sparkle);
  sparkles = [];
}

export function spawnRockBits(x, y, color = "#888") {
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

export function spawnStarSparkles(x, y, color = "#fff3a0", count = SPARKLE_COUNT) {
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

export function updateParticles(dt) {
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
}

export function drawParticles(ctx) {
  for (const bit of bits) {
    ctx.fillStyle = bit.color;
    ctx.fillRect(bit.x, bit.y, 3, 3);
  }
  for (const sparkle of sparkles) {
    ctx.fillStyle = sparkle.color;
    ctx.fillRect(sparkle.x, sparkle.y, 2, 2);
  }
}
