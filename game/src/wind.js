// Gale Strip — wind and gusts. Each strip has a steady wind (speed in knots,
// direction in degrees from the runway heading) plus a gust layer that swells
// and fades on a slow seeded wobble, so the same seed always blows the same.
// The crosswind component pushes the plane sideways; the pilot corrects with
// a crab angle or a slip, which is where the landing skill lives.
import { makeValueNoise } from './random.js';

// Split a wind into headwind (+) and crosswind (+) components, in knots,
// for a runway whose heading is `runwayHeadingDeg`.
export function splitWind(windSpeedKts, windFromDeg, runwayHeadingDeg) {
  const relative = ((windFromDeg - runwayHeadingDeg) * Math.PI) / 180;
  return {
    headwindKts: windSpeedKts * Math.cos(relative),
    crosswindKts: windSpeedKts * Math.sin(relative),
  };
}

export function createWindModel(strip, seed) {
  const gustNoise = makeValueNoise(seed * 7 + 13);
  return {
    baseSpeedKts: strip.windKts,
    baseFromDeg: strip.windFromDeg,
    gustKts: strip.gustKts,
    // Wind at `timeSec`: steady wind plus a gust that breathes in and out.
    windAt(timeSec) {
      const swell = 0.5 + 0.5 * gustNoise(timeSec * 0.11);
      const speed = this.baseSpeedKts + this.gustKts * swell;
      const wander = 14 * gustNoise(timeSec * 0.05 + 40);
      return { speedKts: speed, fromDeg: this.baseFromDeg + wander, gustFactor: swell };
    },
  };
}
