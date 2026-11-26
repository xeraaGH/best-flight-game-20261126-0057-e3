// Gale Strip — Bush Pilot Landings: the game loop and the screens.
// Screens: title, strip briefing, flying, debrief. A sortie is four strips
// in order; a landing scores and moves on, a strike costs one of three, and
// three strikes — or the fourth strip — end the sortie at the debrief.
// There is no autopilot: every landing is flown by hand.
import { AIRCRAFT_NAME, CANVAS_HEIGHT, CANVAS_WIDTH, GAME_SUBTITLE, GAME_TITLE, SORTIE } from './config.js';
import { createFlightState, stepFlightModel } from './flight-model.js';
import { createWindModel, splitWind } from './wind.js';
import { createTerrain } from './terrain.js';
import { drawHud } from './hud.js';
import { drawWorld, outlinedText } from './render.js';
import { createAudioEngine } from './audio.js';
import { stageShot } from './shots.js';
import { attachKeyboardInput, attachMouseInput, consumeKeyPress, consumeMouseClick, createInputState } from './input.js';
import { STRIPS, stripByIndex } from './strips.js';

const STEP = 1 / 60;
const STATUS = document.getElementById('status');

export function createGame() {
  return {
    screen: 'title',
    stripIndex: 0,
    strip: STRIPS[0],
    terrain: createTerrain(STRIPS[0]),
    windModel: createWindModel(STRIPS[0], STRIPS[0].seed),
    windNow: { speedKts: STRIPS[0].windKts, fromDeg: STRIPS[0].windFromDeg, gustFactor: 0 },
    flight: createFlightState(STRIPS[0], {
      distanceFt: SORTIE.approachDistanceFt,
      altitudeFt: SORTIE.approachAltitudeFt,
      speedKts: SORTIE.approachSpeedKts,
    }),
    sortie: { scores: [null, null, null, null], strikes: 0, totalScore: 0, finished: false },
    timeSec: 0,
    banner: null,
    shotMode: false,
    // Switch the world to another strip and reset the approach.
    setStrip(index) {
      this.stripIndex = index;
      this.strip = stripByIndex(index);
      this.terrain = createTerrain(this.strip);
      this.windModel = createWindModel(this.strip, this.strip.seed);
      this.flight = createFlightState(this.strip, {
        distanceFt: SORTIE.approachDistanceFt,
        altitudeFt: SORTIE.approachAltitudeFt,
        speedKts: SORTIE.approachSpeedKts,
      });
      this.windNow = this.windModel.windAt(0);
    },
    // A fresh sortie from strip one, scores and strikes cleared.
    resetSortie() {
      this.sortie = { scores: [null, null, null, null], strikes: 0, totalScore: 0, finished: false };
      this.banner = null;
      this.setStrip(0);
    },
  };
}

// What happens when a flight ends: a landing banks its score and moves to
// the next strip; a crash costs a strike and the strip is flown again.
function resolveFlightEnd(game) {
  const flight = game.flight;
  if (flight.landed) {
    game.sortie.scores[game.stripIndex] = flight.landingScore;
    game.sortie.totalScore += flight.landingScore;
    game.banner = {
      text: flight.struck
        ? `LANDED — ${flight.landingScore} PTS (FIRM — 1 STRIKE)`
        : `LANDED — ${flight.landingScore} PTS`,
      tone: flight.struck ? 'warn' : 'good',
      until: game.timeSec + 3.5,
    };
    if (flight.struck) game.sortie.strikes += 1;
    if (game.sortie.strikes >= 3 || game.stripIndex >= 3) {
      game.sortie.finished = true;
      game.screen = 'debrief';
    } else {
      game.setStrip(game.stripIndex + 1);
      game.screen = 'briefing';
    }
  } else if (flight.crashed) {
    game.sortie.strikes += 1;
    game.banner = { text: `STRIKE — ${flight.strikeReason}`, tone: 'bad', until: game.timeSec + 3.5 };
    if (game.sortie.strikes >= 3) {
      game.sortie.finished = true;
      game.screen = 'debrief';
    } else {
      game.setStrip(game.stripIndex);
      game.screen = 'briefing';
    }
  }
}

function announce(text) {
  if (STATUS) STATUS.textContent = text;
}

function drawTitleScreen(ctx, game, width, height) {
  ctx.fillStyle = 'rgba(6,10,18,0.45)';
  ctx.fillRect(0, 0, width, height);
  outlinedText(ctx, GAME_TITLE, width / 2, height * 0.24, '900 84px system-ui, sans-serif', '#ffffff');
  outlinedText(ctx, GAME_SUBTITLE, width / 2, height * 0.24 + 58, '600 26px system-ui, sans-serif', '#ffd27a');
  outlinedText(ctx, `Fly the ${AIRCRAFT_NAME} onto four strips — grass, mountain, carrier deck, storm.`, width / 2, height * 0.24 + 104, '500 18px system-ui, sans-serif', '#ffffff');
  ctx.textAlign = 'center';
  ctx.font = '500 16px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  let y = height * 0.44;
  for (const strip of STRIPS) {
    ctx.fillText(
      `${strip.index + 1}. ${strip.name} — ${strip.runwayLengthFt.toLocaleString()} ft — ${strip.goal}`,
      width / 2,
      y,
    );
    y += 26;
  }
  outlinedText(ctx, 'PRESS ENTER OR CLICK TO FLY', width / 2, height * 0.85, '800 24px system-ui, sans-serif', '#37d67a');
  ctx.font = '500 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('↑ ↓ pitch    ← → roll    A / D roll    W / S throttle    F flaps    G gear    P pause    R restart', width / 2, height * 0.85 + 34);
  ctx.fillText('Land soft, on the centreline, inside the touchdown zone. Three strikes end the sortie.', width / 2, height * 0.85 + 58);
}

function drawBriefingScreen(ctx, game, width, height) {
  const strip = game.strip;
  ctx.fillStyle = 'rgba(6,10,18,0.55)';
  ctx.fillRect(0, 0, width, height);
  outlinedText(ctx, `STRIP ${strip.index + 1} OF 4`, width / 2, height * 0.3, '700 20px system-ui, sans-serif', '#ffd27a');
  outlinedText(ctx, strip.name, width / 2, height * 0.3 + 48, '900 52px system-ui, sans-serif', '#ffffff');
  outlinedText(ctx, strip.place, width / 2, height * 0.3 + 92, '500 20px system-ui, sans-serif', '#ffffff');
  ctx.textAlign = 'center';
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const wind = splitWind(strip.windKts, strip.windFromDeg, strip.headingDeg);
  ctx.fillText(strip.goal, width / 2, height * 0.3 + 140);
  ctx.fillText(
    `Runway ${strip.runwayLengthFt.toLocaleString()} ft × ${strip.runwayWidthFt} ft  •  Elevation ${strip.elevationFt.toLocaleString()} ft  •  Wind ${strip.windKts} kt, gusts ${strip.gustKts} kt, crosswind ${Math.abs(Math.round(wind.crosswindKts))} kt`,
    width / 2,
    height * 0.3 + 170,
  );
  ctx.fillText(`Fuel for the sortie: full  •  Strikes so far: ${game.sortie.strikes} of 3  •  Score: ${game.sortie.totalScore}`, width / 2, height * 0.3 + 200);
  outlinedText(ctx, 'PRESS ENTER OR CLICK TO FLY THE APPROACH', width / 2, height * 0.72, '800 22px system-ui, sans-serif', '#37d67a');
}

function drawDebriefScreen(ctx, game, width, height) {
  ctx.fillStyle = 'rgba(6,10,18,0.68)';
  ctx.fillRect(0, 0, width, height);
  outlinedText(ctx, 'SORTIE DEBRIEF', width / 2, height * 0.2, '900 54px system-ui, sans-serif', '#ffffff');
  outlinedText(
    ctx,
    game.sortie.strikes >= 3
      ? 'Sortie ended — three strikes.'
      : `All four strips flown. Well landed, bush pilot.${game.sortie.strikes > 0 ? ` — ${game.sortie.strikes} strike${game.sortie.strikes > 1 ? 's' : ''}.` : ''}`,
    width / 2,
    height * 0.2 + 46,
    '500 19px system-ui, sans-serif',
    '#ffd27a',
  );
  const panelX = width / 2 - 330;
  const panelY = height * 0.32;
  ctx.fillStyle = 'rgba(8,14,24,0.72)';
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, 660, 250, 12);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('STRIP', panelX + 24, panelY + 34);
  ctx.fillText('LANDING', panelX + 470, panelY + 34);
  ctx.font = '500 18px system-ui, sans-serif';
  let y = panelY + 66;
  for (const strip of STRIPS) {
    const score = game.sortie.scores[strip.index];
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${strip.index + 1}. ${strip.name}`, panelX + 24, y);
    ctx.fillStyle = score == null ? 'rgba(255,255,255,0.55)' : '#37d67a';
    ctx.fillText(score == null ? 'no landing' : `${score} pts`, panelX + 470, y);
    y += 34;
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(panelX + 24, y + 2);
  ctx.lineTo(panelX + 636, y + 2);
  ctx.stroke();
  ctx.font = '800 22px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('TOTAL', panelX + 24, y + 32);
  ctx.fillStyle = '#ffd27a';
  ctx.fillText(`${game.sortie.totalScore} pts`, panelX + 470, y + 32);
  outlinedText(ctx, 'PRESS R TO FLY AGAIN — ENTER FOR THE TITLE SCREEN', width / 2, height * 0.82, '800 20px system-ui, sans-serif', '#37d67a');
}

function drawPauseScreen(ctx, width, height) {
  ctx.fillStyle = 'rgba(6,10,18,0.55)';
  ctx.fillRect(0, 0, width, height);
  outlinedText(ctx, 'PAUSED', width / 2, height * 0.45, '900 56px system-ui, sans-serif', '#ffffff');
  outlinedText(ctx, 'P or CLICK TO RESUME  •  R TO RESTART THE STRIP', width / 2, height * 0.45 + 48, '600 18px system-ui, sans-serif', '#ffffff');
}

function drawBanner(ctx, game, width) {
  if (!game.banner || game.timeSec > game.banner.until) return;
  const color = game.banner.tone === 'good' ? '#37d67a' : game.banner.tone === 'warn' ? '#ffb020' : '#ff5a4e';
  outlinedText(ctx, game.banner.text, width / 2, 128, '800 26px system-ui, sans-serif', color);
}

function drawFlyingFrame(ctx, game, width, height) {
  drawWorld(ctx, game, width, height);
  drawHud(ctx, game, width, height);
  drawBanner(ctx, game, width);
}

function renderFrame(ctx, game, width, height) {
  if (game.screen === 'title') {
    drawWorld(ctx, game, width, height);
    drawTitleScreen(ctx, game, width, height);
  } else if (game.screen === 'briefing') {
    drawWorld(ctx, game, width, height);
    drawBriefingScreen(ctx, game, width, height);
    // The landing (or strike) banner stays visible over the next briefing.
    drawBanner(ctx, game, width);
  } else if (game.screen === 'flying' || game.screen === 'paused') {
    drawFlyingFrame(ctx, game, width, height);
    if (game.screen === 'paused') drawPauseScreen(ctx, width, height);
  } else if (game.screen === 'debrief') {
    drawWorld(ctx, game, width, height);
    drawDebriefScreen(ctx, game, width, height);
  }
}

// One fixed step of the flying simulation, from the live keyboard.
function stepGame(game, input, dt) {
  if (game.screen !== 'flying') return;
  const flight = game.flight;
  const pitch = (input.pitchUp ? 1 : 0) + (input.pitchDown ? -1 : 0);
  const roll = (input.rollLeft ? -1 : 0) + (input.rollRight ? 1 : 0);
  const throttle = flight.throttle + (input.throttleUp ? dt * 0.9 : 0) - (input.throttleDown ? dt * 0.9 : 0);
  const wind = game.windModel.windAt(flight.timeSec);
  game.windNow = wind;
  const split = splitWind(wind.speedKts, wind.fromDeg, game.strip.headingDeg);
  stepFlightModel(flight, game.strip, { pitch, roll, throttle }, split, dt);
  game.timeSec += dt;
  if (flight.landed || flight.crashed) {
    game.audio.playTouchdownThud(Math.max(0, -flight.verticalSpeedFpm));
    if (flight.landed && !flight.struck) game.audio.playLandingChime();
    const report = flight.landingReport;
    announce(
      flight.landed
        ? `Landed on ${game.strip.name}: ${flight.landingScore} points, sink ${report.sinkFpm} feet per minute, ${report.centrelineFt} feet off the centreline.`
        : `Crashed on ${game.strip.name}: ${flight.strikeReason}.`,
    );
    resolveFlightEnd(game);
  }
}

function handleMenuKeys(game, input) {
  const confirm = consumeKeyPress(input, 'Enter') || consumeKeyPress(input, 'NumpadEnter') || consumeMouseClick(input);
  if (game.screen === 'title' && confirm) {
    game.audio.ensureStarted();
    game.resetSortie();
    game.screen = 'briefing';
    announce(`Briefing for ${game.strip.name}.`);
    return;
  }
  if (game.screen === 'briefing' && confirm) {
    game.audio.ensureStarted();
    game.screen = 'flying';
    announce(`Flying the approach to ${game.strip.name}. Gear down, flaps set.`);
    return;
  }
  if (game.screen === 'debrief') {
    if (consumeKeyPress(input, 'KeyR')) {
      game.resetSortie();
      game.screen = 'briefing';
      return;
    }
    if (consumeKeyPress(input, 'Enter')) {
      game.resetSortie();
      game.screen = 'title';
    }
  }
}

function handleFlyingKeys(game, input) {
  if (consumeKeyPress(input, 'KeyF')) {
    game.flight.flaps = (game.flight.flaps + 1) % 3;
    game.audio.playClick();
  }
  if (consumeKeyPress(input, 'KeyG')) {
    game.flight.gearDown = !game.flight.gearDown;
    game.audio.playClick();
  }
  if (consumeKeyPress(input, 'KeyP') || consumeKeyPress(input, 'Escape')) {
    game.screen = game.screen === 'paused' ? 'flying' : 'paused';
  }
  if (consumeKeyPress(input, 'KeyR')) {
    game.setStrip(game.stripIndex);
    game.screen = 'briefing';
  }
  if (consumeKeyPress(input, 'KeyM')) {
    game.audio.muted = !game.audio.muted;
  }
}

export function startGame(canvas) {
  const ctx = canvas.getContext('2d');
  const game = createGame();
  game.audio = createAudioEngine();
  const input = createInputState();
  attachKeyboardInput(window, input);
  attachMouseInput(canvas, input);

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(640, Math.floor(rect.width));
    const height = Math.max(480, Math.floor(rect.height));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { width, height };
  }

  // Screenshot scenes: ?shot=start|play|play2|end&seed=N stages a fixed frame.
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    const seed = Number(params.get('seed') || '1');
    game.strip = stripByIndex(shot === 'play' ? 1 : shot === 'play2' ? 2 : shot === 'end' ? 3 : 0);
    void seed;
    stageShot(shot, game);
  }

  let lastTime = performance.now();
  let accumulator = 0;
  function frame(now) {
    const { width, height } = resizeCanvas();
    const frameDt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    if (!game.shotMode) {
      handleMenuKeys(game, input);
      if (game.screen === 'flying' || game.screen === 'paused') handleFlyingKeys(game, input);
      if (game.screen === 'flying') {
        accumulator += frameDt;
        while (accumulator >= STEP) {
          stepGame(game, input, STEP);
          accumulator -= STEP;
        }
        game.audio.updateFlying(game.flight.throttle, game.flight.speedKts, true);
      } else {
        game.audio.updateFlying(0, 0, false);
      }
      if (game.screen === 'title' || game.screen === 'briefing' || game.screen === 'debrief') {
        game.timeSec += frameDt;
      }
    }
    renderFrame(ctx, game, width, height);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // A handle for automated playtests (and curious pilots): the live game.
  window.__gale = game;
  return game;
}
