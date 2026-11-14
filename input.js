import { initializeAudio } from "./audio.js";
import { SIZE } from "./sprites.js";

export const keys = {};
export const touch = { targetX: null };

const canvas = document.getElementById("game");

export function bindInput(handlers) {
  document.addEventListener("pointerdown", () => {
    initializeAudio();
    handlers.onPointerStart();
  });

  const setTouchTarget = (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touchX = (event.touches[0].clientX - rect.left) * canvas.width / rect.width;
    touch.targetX = Math.max(0, Math.min(canvas.width - SIZE.player, touchX - SIZE.player / 2));
  };
  canvas.addEventListener("touchstart", setTouchTarget, { passive: false });
  canvas.addEventListener("touchmove", setTouchTarget, { passive: false });
  canvas.addEventListener("touchend", () => { touch.targetX = null; });
  canvas.addEventListener("touchcancel", () => { touch.targetX = null; });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") handlers.onHidden();
  });

  window.addEventListener("blur", () => {
    for (const key of Object.keys(keys)) keys[key] = false;
  });

  document.addEventListener("keydown", (e) => {
    initializeAudio();
    handlers.onKeyDown(e);
  });
  document.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
    handlers.onKeyUp(e);
  });
}

