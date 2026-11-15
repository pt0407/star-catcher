# Star Catcher

Stars and rocks fall from the top of the screen. Move your basket to catch the stars and dodge the rocks. You start with 3 hearts, and each rock you catch costs one.

![Star Catcher gameplay](devlog-images/2026-11-13-star-catcher.png)

## Run it

Open `index.html` in a browser, or run a local server from this folder:

```
python3 -m http.server 8000
```

Then go to http://localhost:8000.

Live version: https://star-catcher-virid.vercel.app

## Controls

- Arrow keys or A/D: move
- Space or Enter: start or restart
- Drag on the canvas or use the arrow buttons on touch screens: move
- P or Esc: pause
- R: restart mid-run
- M: mute
- N: night mode
- F: FPS counter
- 1, 2, 3: difficulty on the menus, arrow keys cycle it too
- Gamepad: left stick or d-pad to move, A to start, start button pauses

Catch stars for points, golden stars are worth 3. Rocks cost a heart. Magnet stars pull pickups toward you for a few seconds, hearts put one back. Wind gusts shove everything sideways, so keep an eye on the arrow up top. Difficulty (1/2/3) changes fall speed and spawn rate, and your pick is remembered.

Your best score, streak, and totals are saved in the browser (localStorage), so they survive refreshes.

## Features

- 5 stages that cycle every 50 points: day, dusk, night, deep space, aurora, each with its own sky and star colors
- Star types: normal, golden (3), prism (4), wild (random 1-5), comets (5, split into 3), super stars (10, split into 5)
- Fever mode doubles points for 6 seconds every 100 points, star showers and rock storms keep it spicy
- 10 achievements, a local top 10 with initials entry, pause menu, stats screen
- Chiptune music with separate volume, Web Audio sound effects
- Keyboard, mouse/touch, gamepad, tilt and on-screen buttons
- Installable as a PWA, plays offline

## Built with

Plain HTML, CSS, and JavaScript, no build step. The sprites are placeholders drawn by a small script from hand-defined shapes. The code and this README were written with an AI agent (Devin). Nobody has played a full run yet, so expect rough edges.

## Known issues

- Not playtested on a real phone. Touch dragging works in desktop Chrome but nobody has tried it on iOS or Android.
- The sounds are Web Audio beeps, checked in code but nobody has listened to them yet.
- The sprites are still the generated placeholders, not real art.

## Add your sprites

Put PNG files in the `assets/` folder using these exact names. Until a file exists, the game draws a colored box in its place, so you can play before your art is ready.

| File | Suggested size | Used for |
|---|---|---|
| `player.png` | 64×64 | Your basket or character |
| `star.png` | 32×32 | Good item, +1 point |
| `rock.png` | 32×32 | Bad item, costs a life |
| `heart.png` | 24×24 | Life icon |
| `magnet.png` | 32×32 | Magnet pickup |
| `background.png` | 400×600 | Optional background |

The `*_sheet.png` files (`player_sheet`, `star_sheet`, `rock_sheet`, `heart_sheet`) are animation strips that `make_sprites.py` builds next to the stills — star spin, rock tumble, heart beat, basket wobble. The game uses a sheet when it loads and falls back to the single PNG.

Use transparent backgrounds for the sprites. If you change a size, also update the `SIZE` table in `sprites.js`.

The code is split into ES modules: `game.js` is the game loop and state, `sprites.js` images and drawing, `particles.js` the pixel bursts, `audio.js` the sounds, `input.js` keys and touch, `persist.js` localStorage, `starfield.js` the background dots.

## Change the game

The gameplay settings are the constants at the top of `game.js` (sound frequencies live in `audio.js`):

- `START_LIVES`: how many hearts you start with
- `PLAYER_SPEED`: how fast the player moves
- `SPAWN_EVERY`: seconds between new items at the start
- `SPAWN_INTERVAL_SCORE_STEP` and `SPAWN_INTERVAL_DECREASE`: how often and how much spawns speed up
- `SPEED_UP_EVERY` and `SPEED_UP_AMOUNT`: how often and how much items fall faster
- `STAR_CHANCE`: chance that a new item is a star instead of a rock
- `GOLDEN_STAR_CHANCE`: chance a star is golden (worth 3)
- `MAGNET_CHANCE` and `MAGNET_DURATION`: how often magnets drop and how long they last
- `HEART_CHANCE`: how often heart pickups drop
- `FAST_ROCK_CHANCE`: how often a rock is the fast red kind
- `GUST_WAIT_MIN`/`GUST_WAIT_MAX`, `GUST_WARNING_TIME`, `GUST_DURATION`, `GUST_SPEED`: the wind gusts
- `SHOOTING_STAR_INTERVAL` and `SHOOTING_STAR_SPEED`: the bonus stars that cross the top
