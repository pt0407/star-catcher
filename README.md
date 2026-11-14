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
- Drag on the canvas: move (touch works too)
- P or Esc: pause
- R: restart mid-run
- M: mute
- N: night mode
- F: FPS counter
- 1, 2, 3: difficulty on the menus, arrow keys cycle it too

Catch stars for points, golden stars are worth 3. Rocks cost a heart. Magnet stars pull pickups toward you for a few seconds, hearts put one back. Wind gusts shove everything sideways, so keep an eye on the arrow up top.

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
| `background.png` | 400×600 | Optional background |

Use transparent backgrounds for the sprites. If you change a size, also update the `SIZE` table in `game.js`.

## Change the game

The settings are the constants at the top of `game.js`:

- `START_LIVES`: how many hearts you start with
- `PLAYER_SPEED`: how fast the player moves
- `START_FALL_SPEED`: how fast items fall at the start
- `SPEED_UP_EVERY` and `SPEED_UP_AMOUNT`: how often and how much items speed up
- `SPAWN_EVERY`: seconds between new items
- `STAR_CHANCE`: chance that a new item is a star instead of a rock
