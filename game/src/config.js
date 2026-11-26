// Gale Strip — Bush Pilot Landings: every tunable number in one place.
// Distances are feet, speeds knots, altitudes feet above the strip.
// The four strips escalate: long calm grass, short high mountain, a carrier
// deck in crosswind, then a short wet strip in a night storm.
export const GAME_TITLE = 'GALE STRIP';
export const GAME_SUBTITLE = 'Bush Pilot Landings';
export const AIRCRAFT_NAME = 'Kestrel-9';
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 800;

// Flight-model tuning for the Kestrel-9 STOL bush plane.
export const FLIGHT = {
  stallSpeedCleanKts: 52,
  stallSpeedFlapsKts: 44,
  cruiseSpeedKts: 118,
  maxSpeedKts: 145,
  // Lift rises with the square of airspeed; flaps add lift and drag.
  liftCoefficient: 0.000128,
  dragCoefficient: 0.000011,
  flapLiftBonus: [0, 0.16, 0.3],
  flapDragBonus: [0, 0.35, 0.7],
  gearDragBonus: 0.18,
  // Pitch authority in degrees per second at full elevator.
  pitchRateDegPerSec: 14,
  // Roll authority in degrees per second at full aileron.
  rollRateDegPerSec: 55,
  // A banked turn swings the nose sideways: lateral feet per second per degree of bank.
  turnRateFtPerSecPerDeg: 2.1,
  // Throttle spool: 0..1 per second toward the lever.
  throttleSpoolPerSec: 0.55,
  // Thrust acceleration in knots per second at full throttle, sea level.
  thrustKtsPerSec: 9.5,
  // Fuel: minutes of full-throttle flying per sortie.
  fuelMinutes: 14,
  // A touchdown is scored when the wheels meet the strip.
  touchdownSinkLimitFpm: 620,
  hardSinkFpm: 900,
  // How far past the threshold the touchdown zone runs (feet).
  touchdownZoneFt: 900,
};

// The sortie: land all four strips, or three strikes end it.
export const SORTIE = {
  maxStrikes: 3,
  // Where each approach starts: feet out from the threshold, feet above the strip.
  // 430 ft at 7,200 ft out sits just above the 3-degree slope (377 ft), so the
  // pilot joins the PAPI from slightly high and rides it down.
  approachDistanceFt: 7200,
  approachAltitudeFt: 430,
  approachSpeedKts: 82,
};
