// Gale Strip — procedural terrain and the perspective projection.
// The world is a chain of segments running away from the camera toward the
// strip: each segment is a band of ground 120 feet deep, coloured by the
// strip's terrain (grass, mountain, sea or storm dusk), with trees, rocks and
// water placed from the strip's seed. The runway is drawn on top of the bands
// as a projected strip with threshold bars, centreline dashes, edge lights
// and PAPI lamps beside the touchdown zone.
import { createSeededRandom, makeValueNoise } from './random.js';

export const SEGMENT_FT = 120;
export const VIEW_DISTANCE_FT = 9600;
export const FOCAL_PX = 900;

export function createTerrain(strip) {
  const random = createSeededRandom(strip.seed * 101 + 7);
  const ridgeNoise = makeValueNoise(strip.seed * 3 + 5);
  const groundNoise = makeValueNoise(strip.seed * 5 + 11);
  // Trees, rocks and buoys: fixed spots along the strip, seeded once.
  // The sea carries only a few small buoys, well clear of the deck.
  const features = [];
  const featureCount = strip.terrain === 'sea' ? 60 : 260;
  for (let i = 0; i < featureCount; i += 1) {
    const s = 200 + random() * 9800;
    const side = random() < 0.5 ? -1 : 1;
    const lateral = side * (strip.terrain === 'sea' ? 130 + random() * 900 : 90 + random() * 900);
    features.push({
      s,
      lateral,
      heightFt: strip.terrain === 'sea' ? 8 + random() * 10 : 18 + random() * 34,
      kind: strip.terrain === 'sea' ? 'buoy' : random() < 0.72 ? 'tree' : 'rock',
    });
  }
  // Clouds drift across the sky, seeded per strip.
  const clouds = [];
  for (let i = 0; i < 14; i += 1) {
    clouds.push({
      x: random(),
      y: 0.06 + random() * 0.3,
      scale: 0.5 + random() * 1.3,
      speed: 0.004 + random() * 0.008,
    });
  }
  return { strip, random, ridgeNoise, groundNoise, features, clouds };
}

// Ground height (feet above the strip) at `s` feet past the threshold and
// `lateralFt` feet from the centreline. Mountain strips rise steeply on both
// sides; grass rolls gently; the sea is flat water below the deck.
export function groundHeightFt(terrain, s, lateralFt) {
  const abs = Math.abs(lateralFt);
  if (terrain.strip.terrain === 'sea') return -18;
  if (terrain.strip.terrain === 'mountain') {
    const wall = Math.max(0, abs - 140);
    return (
      Math.min(560, wall * 0.5) +
      26 * terrain.ridgeNoise(s * 0.0016 + lateralFt * 0.002) +
      8 * terrain.groundNoise(s * 0.01)
    );
  }
  return 6 * terrain.groundNoise(s * 0.004 + lateralFt * 0.001) + 2 * terrain.groundNoise(s * 0.02);
}

// Project a world point (lateral feet from centreline, height feet above the
// strip, distance feet ahead of the camera) onto the canvas.
export function projectPoint(camera, xFt, yFt, distanceFt, canvasWidth, horizonY) {
  const d = Math.max(60, distanceFt);
  const sx = canvasWidth / 2 + ((xFt - camera.lateralFt) * FOCAL_PX) / d;
  const sy = horizonY - ((yFt - camera.altitudeFt) * FOCAL_PX) / d;
  return { x: sx, y: sy };
}

// The horizon line on screen: it drops as the plane climbs, rises as it sinks.
export function horizonScreenY(state, canvasHeight) {
  const base = canvasHeight * 0.42;
  return base + state.pitchDeg * 3.2 - (state.altitudeFt - 300) * 0.012;
}
