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
- Space: start or restart

## Built with

Plain HTML, CSS, and JavaScript, no build step. The sprites are placeholders drawn by a small script from hand-defined shapes. The code and this README were written with an AI agent (Devin). Nobody has played a full run yet, so expect rough edges.

## Known issues

- Not playtested in a browser yet. Check controls, collisions, and game over.
- No sound, no title screen, no pause.
- Touch controls are missing. Keyboard only.

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
