// Gale Strip — deterministic screenshot scenes behind ?shot=.
// Each scene places the real flight model in a real state and renders one
// frame of the real game: there is no autopilot anywhere, in the game or
// here. The debrief scene scores its landings through the same
// judgeTouchdown the game uses, from plausible touchdown numbers, so the
// table it shows is real output of the scoring code.
//   start — title screen over the Coral Grass approach
//   play  — final approach to Pine Ridge, PAPI lit, HUD lit
//   play2 — flaring over the carrier deck "MSV Tern" in crosswind
//   end   — the debrief table after a finished sortie
import { createFlightState, judgeTouchdown } from './flight-model.js';
import { stripByIndex } from './strips.js';

function placeOnApproach(game, distanceFt, altitudeFt, speedKts, lateralFt) {
  const flight = game.flight;
  flight.distanceFt = distanceFt;
  flight.altitudeFt = altitudeFt;
  flight.speedKts = speedKts;
  flight.lateralFt = lateralFt;
  flight.verticalSpeedFpm = -520;
  flight.pitchDeg = -2;
  flight.rollDeg = 0;
  flight.throttle = 0.62;
  flight.flaps = 2;
  flight.gearDown = true;
  flight.timeSec = 24;
  game.timeSec = 24;
}

// Score one staged landing through the real touchdown judge, on its own strip.
function stagedLandingScore(strip, sinkFpm, centrelineFt, distancePastThresholdFt, speedKts) {
  const flight = createFlightState(strip, { distanceFt: -distancePastThresholdFt, altitudeFt: 0, speedKts });
  flight.verticalSpeedFpm = -sinkFpm;
  flight.lateralFt = centrelineFt;
  flight.gearDown = true;
  flight.flaps = 2;
  judgeTouchdown(flight, strip);
  return { score: flight.landingScore, report: flight.landingReport, struck: flight.struck };
}

export function stageShot(name, game) {
  game.shotMode = true;
  if (name === 'play') {
    game.setStrip(1);
    placeOnApproach(game, 1000, 85, 72, 8);
    game.screen = 'flying';
    return;
  }
  if (name === 'play2') {
    game.setStrip(2);
    placeOnApproach(game, 520, 64, 68, -18);
    game.flight.verticalSpeedFpm = -260;
    game.flight.pitchDeg = 5;
    game.flight.rollDeg = -9;
    game.screen = 'flying';
    return;
  }
  if (name === 'end') {
    game.setStrip(3);
    // A finished sortie: four scored landings through the real scoring
    // function — the Storm Island one firm enough to cost a strike — then
    // the debrief screen over Storm Island.
    const staged = [
      stagedLandingScore(stripByIndex(0), 210, 6, 320, 71),
      stagedLandingScore(stripByIndex(1), 340, -14, 410, 74),
      stagedLandingScore(stripByIndex(2), 420, 22, 380, 72),
      stagedLandingScore(stripByIndex(3), 700, 10, 300, 70),
    ];
    game.sortie.scores = staged.map((entry) => entry.score);
    game.sortie.strikes = staged.filter((entry) => entry.struck).length;
    game.sortie.totalScore = staged.reduce((sum, entry) => sum + entry.score, 0);
    game.sortie.finished = true;
    game.screen = 'debrief';
    return;
  }
  // Default: start — the title screen over the Coral Grass approach.
  game.setStrip(0);
  placeOnApproach(game, 1600, 200, 78, 0);
  game.screen = 'title';
}
