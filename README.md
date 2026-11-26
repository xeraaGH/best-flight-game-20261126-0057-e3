[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/xeraaGH/best-flight-game-20261126-0057-e3/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/xeraaGH/best-flight-game-20261126-0057-e3/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

Bounty: https://make.fun/c/best-flight-game-20261126-0057

# Gale Strip — Bush Pilot Landings

A precision-landing flight game for the make.fun "Make the best flight game"
bounty. Fly the Kestrel-9 STOL bush plane onto four escalating strips: a calm
grass field, a short high mountain strip, a carrier deck in crosswind, and a
short wet strip in a night storm.

## How to play

Open `game/index.html` from any static server (`node serve.ts`, then
http://localhost:8080) and play with keyboard and mouse. No network request,
no library — vanilla JavaScript and Canvas 2D, all sounds synthesised with
WebAudio.

- **↑ / ↓** pitch, **← / →** roll, **A / D** roll, **W / S** throttle
- **F** flaps, **G** gear, **P** pause, **R** restart the strip, **M** mute

Land soft, on the centreline, inside the touchdown zone, gear down. Watch the
PAPI lamps and the glide-slope diamond: two white and two red means you are
on the slope. Hard touchdowns, runway excursions, belly landings and landing
short all cost a strike; three strikes end the sortie. Fuel burns with the
throttle — an empty tank means gliding in dead-stick.

## Scoring

Each landing scores up to 1,000 points: up to 400 for a soft touchdown, 300
for the centreline, 300 for the touchdown zone (less a penalty when the stop
would run long). The sortie total is the sum of the four landings.

## Layout

- `game/src/config.js` — all tuning numbers and the sortie setup
- `game/src/strips.js` — the four strips: mission, runway, wind, palette
- `game/src/flight-model.js` — the flight model and the landing judge
- `game/src/wind.js` — steady wind plus seeded gusts
- `game/src/terrain.js` — procedural terrain and the perspective projection
- `game/src/render.js` — sky, ground, runway, aircraft, rain
- `game/src/hud.js` — airspeed, altitude, heading, PAPI, glide slope, fuel
- `game/src/audio.js` — synthesised engine, wind, touchdown, chimes
- `game/src/input.js` — keyboard and mouse
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=`)
- `game/src/main.js` — game loop, screens, sortie flow

`main.ts` hands the game in: it copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json` with the vendored make.fun
library. Screenshots are real renders of the game's own code, staged with
`shots.json` (`?shot=start|play|play2|end&seed=1`).

## License

MIT — see `LICENSE`.
