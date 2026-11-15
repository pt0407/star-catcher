# Star Catcher

stars and rocks fall from the top of the screen. move your basket to catch stars and dodge rocks. you get 3 hearts, each rock costs one. thats it, thats the game.

![Star Catcher gameplay](devlog-images/2026-11-13-star-catcher.png)

## run it

easiest: https://star-catcher-virid.vercel.app

or locally, open `index.html` in a browser, or:

```
python3 -m http.server 8000
```

then go to http://localhost:8000

## controls

- arrow keys or a/d: move
- space or enter: start / restart
- drag on the canvas, or the arrow buttons on touch screens: move
- p or esc: pause (pause has its own menu now)
- r: restart on the game over screen
- m: mute, n: night mode, f: fps counter
- 1/2/3 or arrow keys on the menus: difficulty
- gamepad: left stick or d-pad moves, a starts, start pauses
- tilt works on mobile but its probably janky, nobody tested it on a real phone

## whats in it

- 5 stages that cycle every 50 points, each with its own sky
- too many star types: golden, prism, wild, comets, super stars, double stars
- fever mode doubles points for 6 seconds, star showers and rock storms
- wind gusts, magnets, hearts, paired rocks, near misses
- 13 achievements, a stats screen, local top 10 with initials entry
- works offline as a pwa, chiptune music, screen reader announcements

best score and stats save in localStorage so they survive refreshes.

## built with

plain html, css, javascript. and hand drawn pixel art

## modding

put pngs in `assets/` with the names in the table below and the game uses them instead of the placeholders. animated `*_sheet.png` strips work too.

| file | size | used for |
|---|---|---|
| `player.png` | 64x64 | basket |
| `star.png` | 32x32 | good item |
| `rock.png` | 32x32 | bad item |
| `heart.png` | 24x24 | life icon |
| `magnet.png` | 32x32 | magnet pickup |
| `background.png` | 400x600 | optional bg |

gameplay constants are at the top of `game.js` (spawn rates, speeds, gusts, star chances). sound frequencies live in `audio.js`.
