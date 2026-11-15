import { initializeAudio } from "./audio.js";
import { SIZE } from "./sprites.js";

export const keys = {};
export const touch = { targetX: null, dir: 0, tilt: 0 };

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

  const bindPad = (id, dir) => {
    const el = document.getElementById(id);
    if (!el) return;
    const press = (event) => { event.preventDefault(); touch.dir = dir; };
    const release = () => { touch.dir = 0; };
    el.addEventListener("pointerdown", press);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("pointerleave", release);
  };
  bindPad("touch-left", -1);
  bindPad("touch-right", 1);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") handlers.onHidden();
  });

  const onTilt = (event) => {
    if (event.gamma === null || event.gamma === undefined) return;
    touch.tilt = Math.max(-1, Math.min(1, event.gamma / 25));
  };
  window.addEventListener("deviceorientation", onTilt);

  window.addEventListener("blur", () => {
    for (const key of Object.keys(keys)) keys[key] = false;
    touch.dir = 0;
    touch.tilt = 0;
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

