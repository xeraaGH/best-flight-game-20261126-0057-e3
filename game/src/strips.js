// Gale Strip — the four strips of the sortie. Each one is a different mission
// with a different goal: a calm grass strip to learn the flare, a short high
// mountain strip hemmed by terrain, a carrier deck in crosswind, and a short
// wet strip in a night storm. `headingDeg` is the runway heading the pilot
// flies; `elevationFt` is the strip's height above sea level.
export const STRIPS = [
  {
    id: 'coral-grass',
    index: 0,
    name: 'Coral Grass Strip',
    place: 'Tidewater Atoll',
    goal: 'Learn the flare — wide, long, calm.',
    runwayLengthFt: 3400,
    runwayWidthFt: 90,
    elevationFt: 12,
    headingDeg: 90,
    windKts: 4,
    windFromDeg: 100,
    gustKts: 2,
    // Sky and ground palette for this strip's time of day.
    skyTop: '#2f6fb8',
    skyHorizon: '#bcd9ee',
    sunColor: '#fff3c4',
    groundFar: '#7fae62',
    groundNear: '#5d8f47',
    terrain: 'grass',
    timeOfDay: 'morning',
    seed: 11,
  },
  {
    id: 'pine-ridge',
    index: 1,
    name: 'Pine Ridge Mountain Strip',
    place: 'Kestrel Highlands',
    goal: 'Short and high — stop before the pines.',
    runwayLengthFt: 1900,
    runwayWidthFt: 60,
    elevationFt: 5400,
    headingDeg: 140,
    windKts: 9,
    windFromDeg: 165,
    gustKts: 6,
    skyTop: '#3a6ea8',
    skyHorizon: '#cfdde8',
    sunColor: '#ffe9a8',
    groundFar: '#6d7f5e',
    groundNear: '#4c6440',
    terrain: 'mountain',
    timeOfDay: 'afternoon',
    seed: 23,
  },
  {
    id: 'msv-tern',
    index: 2,
    name: 'Carrier Deck "MSV Tern"',
    place: 'Open Sea, 40 nm offshore',
    goal: 'A very short deck, strong crosswind — catch the wire zone.',
    runwayLengthFt: 620,
    runwayWidthFt: 78,
    elevationFt: 60,
    headingDeg: 270,
    windKts: 18,
    windFromDeg: 310,
    gustKts: 9,
    skyTop: '#2c5f8f',
    skyHorizon: '#a8c4d4',
    sunColor: '#ffe9b0',
    groundFar: '#2e6b8a',
    groundNear: '#25607e',
    terrain: 'sea',
    timeOfDay: 'late afternoon',
    seed: 37,
  },
  {
    id: 'storm-island',
    index: 3,
    name: 'Storm Island Strip',
    place: 'Blackrock Island',
    goal: 'Dusk, heavy gusts, short wet runway — grease it or go around.',
    runwayLengthFt: 1500,
    runwayWidthFt: 55,
    elevationFt: 210,
    headingDeg: 10,
    windKts: 16,
    windFromDeg: 350,
    gustKts: 14,
    skyTop: '#1c2438',
    skyHorizon: '#5a5f7a',
    sunColor: '#e8a35c',
    groundFar: '#3d4a3a',
    groundNear: '#2c362a',
    terrain: 'storm',
    timeOfDay: 'dusk',
    seed: 51,
  },
];

export function stripByIndex(index) {
  return STRIPS[Math.max(0, Math.min(STRIPS.length - 1, index))];
}

// A 3-degree glide slope: the height above the strip at a distance out.
export function glideSlopeAltitudeFt(distanceFt) {
  return distanceFt * Math.tan((3 * Math.PI) / 180);
}

// How far past the threshold the plane would stop, at its touchdown speed.
// `braking` is a surface multiplier on a firm dry stop: arrestor wires on
// the carrier deck stop far shorter, a wet storm strip far longer.
export function stoppingDistanceFt(touchdownSpeedKts, braking) {
  const speedFps = touchdownSpeedKts * 1.68781;
  return (speedFps * speedFps) / (2 * 11 * braking);
}
