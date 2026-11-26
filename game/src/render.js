// Gale Strip — the canvas renderer: sky, terrain bands, runway, aircraft.
// Everything is drawn with plain Canvas 2D from the strip's seed, so the
// same state always paints the same frame. The camera sits behind the
// Kestrel-9 and looks down the approach at the strip.
import { SEGMENT_FT, VIEW_DISTANCE_FT, groundHeightFt, horizonScreenY, projectPoint } from './terrain.js';
import { papiWhites } from './flight-model.js';

function lerpColor(a, b, t) {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const mix = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

function outlinedText(ctx, text, x, y, font, fill, align = 'center') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(8,12,20,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

// Sky gradient, sun and drifting clouds for the strip's time of day.
export function drawSky(ctx, game, width, height, horizonY) {
  const strip = game.strip;
  const gradient = ctx.createLinearGradient(0, 0, 0, horizonY);
  gradient.addColorStop(0, strip.skyTop);
  gradient.addColorStop(1, strip.skyHorizon);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, horizonY + 2);
  // Low sun (or dusk ember) hanging over the strip.
  const sunX = width * 0.68;
  const sunY = horizonY * 0.55;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
  glow.addColorStop(0, strip.sunColor);
  glow.addColorStop(0.35, strip.sunColor + '55');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
  ctx.fillStyle = strip.sunColor;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();
  // Clouds: soft flat ellipses drifting with the sortie clock.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const cloud of game.terrain.clouds) {
    const drift = ((cloud.x + game.timeSec * cloud.speed) % 1.2) - 0.1;
    const cx = drift * width;
    const cy = cloud.y * horizonY;
    const s = cloud.scale;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 64 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + 42 * s, cy + 6 * s, 44 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - 44 * s, cy + 7 * s, 40 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// One band of ground, far to near, its top edge following the terrain.
export function drawGroundBands(ctx, game, width, height, horizonY) {
  const { strip, terrain } = game;
  const flight = game.flight;
  const camera = { lateralFt: flight.lateralFt, altitudeFt: flight.altitudeFt + 6 };
  const samples = [-1600, -1100, -700, -400, -200, 0, 200, 400, 700, 1100, 1600];
  for (let d = VIEW_DISTANCE_FT; d > 0; d -= SEGMENT_FT) {
    const s = d - flight.distanceFt;
    const t = d / VIEW_DISTANCE_FT;
    let base = lerpColor(strip.groundFar, strip.groundNear, 1 - t);
    if (strip.terrain === 'sea') base = t > 0.55 ? '#2a6a8c' : '#1f5a7c';
    if (strip.terrain === 'storm') base = t > 0.5 ? '#46523f' : '#2e3a2c';
    // Near band: the far edge of the next band, so bands tile without gaps.
    const topEdge = [];
    const bottomEdge = [];
    for (const lateral of samples) {
      const hFar = groundHeightFt(terrain, s + SEGMENT_FT, lateral);
      const hNear = groundHeightFt(terrain, s, lateral);
      const pTop = projectPoint(camera, lateral, hFar, d + SEGMENT_FT, width, horizonY);
      const pBottom = projectPoint(camera, lateral, hNear, d, width, horizonY);
      topEdge.push(pTop);
      bottomEdge.push(pBottom);
    }
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.moveTo(-20, topEdge[0].y);
    for (const p of topEdge) ctx.lineTo(p.x, p.y);
    ctx.lineTo(width + 20, topEdge[topEdge.length - 1].y);
    for (let i = bottomEdge.length - 1; i >= 0; i -= 1) ctx.lineTo(bottomEdge[i].x, bottomEdge[i].y);
    ctx.closePath();
    ctx.fill();
  }
  // The bands' lateral undulation already draws the mountain shoulders; no
  // extra silhouette is needed, and a filled one reads as a canyon.
}

// The runway: a projected strip with threshold bars, centreline dashes,
// edge lights and the four PAPI lamps beside the touchdown zone.
export function drawRunway(ctx, game, width, height, horizonY) {
  const { strip } = game;
  const flight = game.flight;
  const camera = { lateralFt: flight.lateralFt, altitudeFt: flight.altitudeFt + 6 };
  const half = strip.runwayWidthFt / 2;
  const isDeck = strip.terrain === 'sea';
  const surface = isDeck ? '#4a5158' : strip.terrain === 'storm' ? '#3d3d3a' : '#6b6f66';
  // Deck hull under a carrier deck, so it reads as a ship, not a road: a
  // narrow wedge just wider than the deck itself, not a black triangle.
  if (isDeck) {
    const near = projectPoint(camera, 0, -16, Math.max(120, flight.distanceFt + 40), width, horizonY);
    const far = projectPoint(camera, 0, -16, Math.max(120, flight.distanceFt + strip.runwayLengthFt), width, horizonY);
    ctx.fillStyle = '#2b333d';
    ctx.beginPath();
    ctx.moveTo(near.x - 150, near.y + 70);
    ctx.lineTo(far.x - 42, far.y + 22);
    ctx.lineTo(far.x + 42, far.y + 22);
    ctx.lineTo(near.x + 150, near.y + 70);
    ctx.closePath();
    ctx.fill();
  }
  for (let d = VIEW_DISTANCE_FT; d > 0; d -= SEGMENT_FT) {
    const s = d - flight.distanceFt;
    if (s < -40 || s > strip.runwayLengthFt) continue;
    const leftNear = projectPoint(camera, -half, 0, d, width, horizonY);
    const rightNear = projectPoint(camera, half, 0, d, width, horizonY);
    const leftFar = projectPoint(camera, -half, 0, d + SEGMENT_FT, width, horizonY);
    const rightFar = projectPoint(camera, half, 0, d + SEGMENT_FT, width, horizonY);
    ctx.fillStyle = surface;
    ctx.beginPath();
    ctx.moveTo(leftNear.x, leftNear.y);
    ctx.lineTo(rightNear.x, rightNear.y);
    ctx.lineTo(rightFar.x, rightFar.y);
    ctx.lineTo(leftFar.x, leftFar.y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes: 120 ft on, 120 ft off.
    if (Math.floor(s / 240) % 2 === 0) {
      const a = projectPoint(camera, -1.5, 0.4, d, width, horizonY);
      const b = projectPoint(camera, 1.5, 0.4, d, width, horizonY);
      const c = projectPoint(camera, 1.5, 0.4, d + SEGMENT_FT, width, horizonY);
      const e = projectPoint(camera, -1.5, 0.4, d + SEGMENT_FT, width, horizonY);
      ctx.fillStyle = '#e8e6da';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(e.x, e.y);
      ctx.closePath();
      ctx.fill();
    }
    // Threshold bars at the start of the strip: four white bars across the
    // first segment only, drawn as projected quads like the centreline.
    if (s < SEGMENT_FT) {
      ctx.fillStyle = '#f2f0e6';
      for (const off of [-24, -8, 8, 24]) {
        const a = projectPoint(camera, off - 7, 0.4, d, width, horizonY);
        const b = projectPoint(camera, off + 7, 0.4, d, width, horizonY);
        const c = projectPoint(camera, off + 7, 0.4, d + SEGMENT_FT, width, horizonY);
        const e = projectPoint(camera, off - 7, 0.4, d + SEGMENT_FT, width, horizonY);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(e.x, e.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Edge lights every 600 ft.
    if (Math.round(s) % 600 < SEGMENT_FT) {
      ctx.fillStyle = '#ffd27a';
      for (const edge of [-half - 4, half + 4]) {
        const p = projectPoint(camera, edge, 2, d, width, horizonY);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // PAPI: four lamps beside the touchdown zone; white above the slope, red below.
  const whites = papiWhites(flight);
  for (let i = 0; i < 4; i += 1) {
    const lampX = half + 26 + i * 14;
    const d = flight.distanceFt + 320;
    const p = projectPoint(camera, lampX, 4, Math.max(120, d), width, horizonY);
    const r = Math.max(3, 900 / Math.max(120, d));
    ctx.fillStyle = i < whites ? '#ffffff' : '#ff3b30';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// Trees, rocks and buoys scattered beside the strip, far to near.
export function drawFeatures(ctx, game, width, height, horizonY) {
  const { strip, terrain } = game;
  const flight = game.flight;
  const camera = { lateralFt: flight.lateralFt, altitudeFt: flight.altitudeFt + 6 };
  const sorted = [...terrain.features].sort((a, b) => b.s - a.s);
  for (const feature of sorted) {
    const d = flight.distanceFt + feature.s;
    if (d < 200 || d > 7000) continue;
    const ground = groundHeightFt(terrain, feature.s, feature.lateral);
    const base = projectPoint(camera, feature.lateral, ground, d, width, horizonY);
    const top = projectPoint(camera, feature.lateral, ground + feature.heightFt, d, width, horizonY);
    const h = base.y - top.y;
    if (h < 3 || base.x < -40 || base.x > width + 40) continue;
    if (feature.kind === 'tree') {
      ctx.fillStyle = strip.terrain === 'storm' ? '#1e2b1c' : '#2f5d33';
      ctx.beginPath();
      ctx.moveTo(base.x, top.y);
      ctx.lineTo(base.x - h * 0.42, base.y);
      ctx.lineTo(base.x + h * 0.42, base.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4a3826';
      ctx.fillRect(base.x - 1, base.y - h * 0.12, 2, h * 0.12);
    } else if (feature.kind === 'rock') {
      ctx.fillStyle = '#6f6f68';
      ctx.beginPath();
      ctx.moveTo(base.x - h * 0.4, base.y);
      ctx.lineTo(base.x - h * 0.15, top.y);
      ctx.lineTo(base.x + h * 0.3, top.y + h * 0.25);
      ctx.lineTo(base.x + h * 0.42, base.y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#ff7a2a';
      ctx.beginPath();
      ctx.moveTo(base.x, top.y);
      ctx.lineTo(base.x + h * 0.4, base.y - h * 0.3);
      ctx.lineTo(base.x, base.y);
      ctx.lineTo(base.x - h * 0.4, base.y - h * 0.3);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// The Kestrel-9 from behind and slightly above: tail nearest the camera,
// nose pointing down the approach, high wing, tundra tyres when the gear is down.
export function drawAircraft(ctx, game, width, height) {
  const flight = game.flight;
  const cx = width / 2;
  const cy = height * 0.66 + flight.pitchDeg * 4;
  const wobble = flight.fuelFraction > 0 && flight.speedKts > 30 ? Math.sin(game.timeSec * 41) * 0.7 : 0;
  ctx.save();
  ctx.translate(cx + wobble, cy);
  ctx.rotate((flight.rollDeg * 0.45 * Math.PI) / 180);
  // Main wing, high and spanning, with orange tips.
  ctx.fillStyle = '#e9e5d8';
  ctx.strokeStyle = '#8a8578';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-132, -52, 264, 30, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8641c';
  ctx.fillRect(-132, -52, 22, 30);
  ctx.fillRect(110, -52, 22, 30);
  // Fuselage: wide at the tail (near), narrow at the nose (far).
  const body = ctx.createLinearGradient(-40, 0, 40, 0);
  body.addColorStop(0, '#f7f4ec');
  body.addColorStop(0.5, '#efece2');
  body.addColorStop(1, '#d9d4c6');
  ctx.fillStyle = body;
  ctx.strokeStyle = '#7d7868';
  ctx.beginPath();
  ctx.moveTo(-20, -78);
  ctx.lineTo(20, -78);
  ctx.lineTo(38, 62);
  ctx.lineTo(30, 74);
  ctx.lineTo(-30, 74);
  ctx.lineTo(-38, 62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Orange cheatline down both flanks.
  ctx.fillStyle = '#e8641c';
  ctx.fillRect(-37, 18, 8, 52);
  ctx.fillRect(29, 18, 8, 52);
  // Cockpit windows near the nose.
  ctx.fillStyle = '#22394f';
  ctx.beginPath();
  ctx.moveTo(-16, -74);
  ctx.lineTo(-4, -74);
  ctx.lineTo(-6, -52);
  ctx.lineTo(-16, -52);
  ctx.closePath();
  ctx.moveTo(16, -74);
  ctx.lineTo(4, -74);
  ctx.lineTo(6, -52);
  ctx.lineTo(16, -52);
  ctx.closePath();
  ctx.fill();
  // Tailplane and fin at the tail end.
  ctx.fillStyle = '#e9e5d8';
  ctx.strokeStyle = '#8a8578';
  ctx.beginPath();
  ctx.roundRect(-82, 52, 164, 16, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e8641c';
  ctx.beginPath();
  ctx.moveTo(-14, 66);
  ctx.lineTo(14, 66);
  ctx.lineTo(0, 96);
  ctx.closePath();
  ctx.fill();
  // Tundra tyres when the gear is down.
  if (flight.gearDown) {
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#1c1c1c';
      ctx.beginPath();
      ctx.arc(side * 34, 84, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9a9a9a';
      ctx.beginPath();
      ctx.arc(side * 34, 84, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Navigation lights: red left, green right, white tail.
  ctx.fillStyle = '#ff2d2d';
  ctx.beginPath();
  ctx.arc(-132, -37, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2dff5e';
  ctx.beginPath();
  ctx.arc(132, -37, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 96, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Rain streaks on the storm strip, seeded so a shot is always the same rain.
export function drawRain(ctx, game, width, height) {
  if (game.strip.terrain !== 'storm') return;
  ctx.strokeStyle = 'rgba(190,205,225,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 90; i += 1) {
    const seedX = ((i * 97.3) % 100) / 100;
    const seedY = ((i * 57.7) % 100) / 100;
    const x = ((seedX + game.timeSec * 0.05) % 1) * width;
    const y = ((seedY + game.timeSec * 0.55) % 1) * height;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 9, y + 26);
  }
  ctx.stroke();
}

// One full frame of the flying world, before the HUD and the screen overlays.
export function drawWorld(ctx, game, width, height) {
  const horizonY = horizonScreenY(game.flight, height);
  ctx.save();
  // The whole scene banks a touch with the plane, so the camera never fights.
  ctx.translate(width / 2, horizonY);
  ctx.rotate((-game.flight.rollDeg * 0.12 * Math.PI) / 180);
  ctx.translate(-width / 2, -horizonY);
  drawSky(ctx, game, width, height, horizonY);
  drawGroundBands(ctx, game, width, height, horizonY);
  drawRunway(ctx, game, width, height, horizonY);
  drawFeatures(ctx, game, width, height, horizonY);
  drawAircraft(ctx, game, width, height);
  drawRain(ctx, game, width, height);
  ctx.restore();
  // A soft vignette, so the HUD reads over any sky.
  const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.42, width / 2, height / 2, height * 0.85);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

export { outlinedText };
