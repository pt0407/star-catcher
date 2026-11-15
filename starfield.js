const STARFIELD_COUNT = 40;

export function createStarfield(width, height) {
  return Array.from({ length: STARFIELD_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    phase: Math.random() * Math.PI * 2,
    speed: 1 + Math.random() * 2,
  }));
}

export function drawStarfield(ctx, starfield, now, gustActive, reducedMotion, color = "#fff", height = 600) {
  ctx.fillStyle = color;
  const twinkleBoost = gustActive ? 1.5 : 1;
  if (reducedMotion) {
    ctx.globalAlpha = 0.4;
    for (const dot of starfield) ctx.fillRect(dot.x, dot.y, 2, 2);
  } else {
    for (const dot of starfield) {
      const y = (dot.y + (now / 1000) * dot.speed * 4) % height;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(now / 500 * dot.speed * twinkleBoost + dot.phase);
      ctx.fillRect(dot.x, y, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}
