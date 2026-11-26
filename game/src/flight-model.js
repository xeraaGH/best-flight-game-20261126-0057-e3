// Gale Strip — the Kestrel-9 flight model and the landing judge.
// The model is deliberately small and honest: lift grows with airspeed
// squared, drag grows with flaps and gear, a banked turn swings the nose
// sideways, and below stall speed the wing quits and the nose drops. There
// is no autopilot anywhere in the game: the pilot flies every landing.
//
// Units: speed knots, altitude feet above the strip, distance feet from the
// threshold (shrinks as the plane flies in), lateral offset feet from the
// centreline (positive = right of it). One step is one simulation tick.
import { FLIGHT } from './config.js';
import { glideSlopeAltitudeFt, stoppingDistanceFt } from './strips.js';

export const FLAP_SETTINGS = [0, 1, 2];
export const GEAR_UP = false;
export const GEAR_DOWN = true;

export function createFlightState(strip, approach) {
  return {
    stripIndex: strip.index,
    // Position and attitude.
    distanceFt: approach.distanceFt,
    altitudeFt: approach.altitudeFt,
    lateralFt: 0,
    headingDeg: strip.headingDeg,
    pitchDeg: 0,
    rollDeg: 0,
    // Energy.
    speedKts: approach.speedKts,
    verticalSpeedFpm: 0,
    throttle: 0.55,
    flaps: 1,
    gearDown: GEAR_DOWN,
    fuelFraction: 1,
    // Outcome.
    landed: false,
    crashed: false,
    struck: false,
    strikeReason: '',
    landingScore: 0,
    landingReport: null,
    timeSec: 0,
  };
}

// Stall speed rises with altitude (thin air) and falls with flaps.
export function stallSpeedKts(state, strip) {
  const base = state.flaps === 2 ? FLIGHT.stallSpeedFlapsKts : FLIGHT.stallSpeedCleanKts;
  const altitudeFactor = 1 + strip.elevationFt / 45000;
  return base * altitudeFactor;
}

// Advance the flight model one tick. `controls` holds -1..1 pitch/roll and
// a 0..1 throttle lever; `wind` is {headwindKts, crosswindKts} this tick.
export function stepFlightModel(state, strip, controls, wind, dt) {
  if (state.landed || state.crashed) return state;
  state.timeSec += dt;

  // Throttle spools toward the lever; fuel burns with the lever.
  const lever = Math.max(0, Math.min(1, controls.throttle));
  state.throttle += (lever - state.throttle) * Math.min(1, FLIGHT.throttleSpoolPerSec * dt);
  const burnPerSec = (state.throttle * 0.85 + 0.15) / (FLIGHT.fuelMinutes * 60);
  state.fuelFraction = Math.max(0, state.fuelFraction - burnPerSec * dt);
  const engineOut = state.fuelFraction <= 0;

  // Pitch and roll answer the stick at once, eased toward the target.
  const targetPitch = controls.pitch * FLIGHT.pitchRateDegPerSec * 0.64;
  const targetRoll = controls.roll * 42;
  state.pitchDeg += (targetPitch - state.pitchDeg) * Math.min(1, 3.2 * dt);
  state.rollDeg += (targetRoll - state.rollDeg) * Math.min(1, 4.5 * dt);

  // Speed: thrust minus drag; drag grows with the square of speed and with
  // flaps and gear hanging out. An engine-out plane only slows down.
  const flapDrag = FLIGHT.flapDragBonus[state.flaps];
  const gearDrag = state.gearDown ? FLIGHT.gearDragBonus : 0;
  const dragKtsPerSec = FLIGHT.dragCoefficient * state.speedKts * state.speedKts * (1 + flapDrag + gearDrag) * 60;
  const thrust = engineOut ? 0 : state.throttle * FLIGHT.thrustKtsPerSec;
  state.speedKts += (thrust - dragKtsPerSec) * dt;
  state.speedKts = Math.max(28, Math.min(FLIGHT.maxSpeedKts, state.speedKts));

  // Lift: enough to hold level flight near approach speed with flaps; a
  // slow wing sinks, and below stall speed it quits outright.
  const stall = stallSpeedKts(state, strip);
  const liftFactor = FLIGHT.liftCoefficient * state.speedKts * state.speedKts * (1 + FLIGHT.flapLiftBonus[state.flaps]);
  const stalled = state.speedKts < stall;
  // Vertical speed in fpm: pitch sets the climb, lift shortfall sinks it.
  const pitchFpm = state.pitchDeg * 60;
  const liftShortfallFpm = stalled ? 1450 : (1 - liftFactor) * 900;
  const targetVsFpm = pitchFpm - liftShortfallFpm * 0.9 + (engineOut ? -260 : 0);
  state.verticalSpeedFpm += (targetVsFpm - state.verticalSpeedFpm) * Math.min(1, 1.6 * dt);
  if (stalled) state.pitchDeg += (-14 - state.pitchDeg) * Math.min(1, 1.2 * dt);

  state.altitudeFt += (state.verticalSpeedFpm / 60) * dt;
  // Forward progress: speed over the ground, helped or hurt by headwind.
  const groundSpeedFps = Math.max(0, (state.speedKts - wind.headwindKts) * 1.68781);
  state.distanceFt -= groundSpeedFps * dt;
  // Sideways: the bank turns the nose, the crosswind shoves the airframe.
  const turnFps = state.rollDeg * FLIGHT.turnRateFtPerSecPerDeg;
  const windFps = wind.crosswindKts * 1.68781;
  state.lateralFt += (turnFps + windFps) * dt;
  state.headingDeg = strip.headingDeg + state.rollDeg * 0.55;

  // The ground arrives: judge the touchdown, or the crash.
  if (state.altitudeFt <= 0) {
    state.altitudeFt = 0;
    judgeTouchdown(state, strip);
  }
  // Flying past the threshold with no strip under the wheels is an excursion.
  if (state.distanceFt < -strip.runwayLengthFt - 400 && !state.landed && !state.crashed) {
    state.crashed = true;
    state.struck = true;
    state.strikeReason = 'Overran the far end of the strip';
  }
  return state;
}

// Score a touchdown on the strip: soft, centred, in the zone, gear down.
export function judgeTouchdown(state, strip) {
  const sinkFpm = -state.verticalSpeedFpm;
  const inZone = state.distanceFt >= -FLIGHT.touchdownZoneFt && state.distanceFt <= 150;
  const onStrip = Math.abs(state.lateralFt) <= strip.runwayWidthFt / 2;
  const pastThreshold = state.distanceFt <= 150;
  const report = {
    sinkFpm: Math.round(sinkFpm),
    centrelineFt: Math.round(Math.abs(state.lateralFt)),
    distancePastThresholdFt: Math.round(150 - state.distanceFt),
    gearDown: state.gearDown,
    speedKts: Math.round(state.speedKts),
  };
  state.landingReport = report;

  if (!pastThreshold) {
    state.crashed = true;
    state.struck = true;
    state.strikeReason = 'Landed short of the threshold';
    return state;
  }
  // Touching down past the far end is an overrun, not a landing — the short
  // carrier deck ends 620 ft past its threshold.
  if (state.distanceFt < -strip.runwayLengthFt) {
    state.crashed = true;
    state.struck = true;
    state.strikeReason = 'Overran the far end of the strip';
    return state;
  }
  if (!onStrip) {
    state.crashed = true;
    state.struck = true;
    state.strikeReason = 'Runway excursion — off the centreline';
    return state;
  }
  if (!state.gearDown) {
    state.crashed = true;
    state.struck = true;
    state.strikeReason = 'Belly landing — gear was up';
    return state;
  }
  if (sinkFpm > FLIGHT.hardSinkFpm) {
    state.crashed = true;
    state.struck = true;
    state.strikeReason = `Hard touchdown — ${Math.round(sinkFpm)} fpm down`;
    return state;
  }
  // A landing: score the sink, the centreline and the touchdown point.
  const sinkScore = Math.max(0, 400 - Math.max(0, sinkFpm - 120) * 0.45);
  const centreScore = Math.max(0, 300 - Math.abs(state.lateralFt) * 4.5);
  const zoneScore = inZone ? 300 : 140;
  const stopFt = stoppingDistanceFt(state.speedKts, strip.terrain === 'sea' ? 2.4 : strip.terrain === 'storm' ? 0.55 : 0.85);
  const fits = stopFt < strip.runwayLengthFt - Math.max(0, 150 - state.distanceFt);
  state.landingScore = Math.round(sinkScore + centreScore + zoneScore);
  if (!fits) {
    state.landingScore = Math.round(state.landingScore * 0.55);
    report.stoppingNote = 'Long stop — used most of the strip';
  }
  state.landed = true;
  state.struck = sinkFpm > FLIGHT.touchdownSinkLimitFpm;
  if (state.struck) state.strikeReason = `Firm touchdown — ${Math.round(sinkFpm)} fpm down (a strike, but it counts)`;
  return state;
}

// PAPI lights: 4 lamps, white when above the glide slope, red when below.
// Returns how many of the four show white (0..4) at this position.
export function papiWhites(state) {
  const ideal = glideSlopeAltitudeFt(Math.max(0, state.distanceFt));
  const errorFt = state.altitudeFt - ideal;
  if (errorFt > 55) return 4;
  if (errorFt > 18) return 3;
  if (errorFt > -18) return 2;
  if (errorFt > -55) return 1;
  return 0;
}

// Glide-slope error in feet: positive means above the slope.
export function glideSlopeErrorFt(state) {
  return state.altitudeFt - glideSlopeAltitudeFt(Math.max(0, state.distanceFt));
}
