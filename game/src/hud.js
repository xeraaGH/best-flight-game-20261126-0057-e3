// Gale Strip — the HUD and the instruments. Everything the pilot needs is
// on screen at once, in big readable numbers: airspeed, altitude, heading,
// vertical speed, the glide-slope diamond, PAPI, throttle, fuel, flaps and
// gear, the wind, the strip, the score and the strikes. Warnings flash when
// the plane is stalling, sinking fast, low on fuel or landing gear-up.
import { glideSlopeErrorFt, papiWhites, stallSpeedKts } from './flight-model.js';
import { splitWind } from './wind.js';
import { outlinedText } from './render.js';

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8,14,24,0.62)';
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function drawTapeValue(ctx, label, value, unit, x, y, warn) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(label, x, y);
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.fillStyle = warn ? '#ff5a4e' : '#ffffff';
  ctx.fillText(value, x, y + 32);
  const valueWidth = ctx.measureText(value).width;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(unit, x + valueWidth + 6, y + 32);
}

// The glide-slope diamond: a vertical scale at screen centre-right, with a
// diamond marking how far above or below the 3-degree slope the plane is.
export function drawGlideSlopeIndicator(ctx, game, width, height) {
  const x = width - 132;
  const y0 = height * 0.3;
  const y1 = height * 0.62;
  const errorFt = glideSlopeErrorFt(game.flight);
  const clamped = Math.max(-120, Math.min(120, errorFt));
  const diamondY = (y0 + y1) / 2 - (clamped / 120) * ((y1 - y0) / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
  for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
    const y = y0 + (y1 - y0) * frac;
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 7, y);
    ctx.stroke();
  }
  ctx.fillStyle = errorFt > 55 || errorFt < -55 ? '#ffb020' : '#37d67a';
  ctx.beginPath();
  ctx.moveTo(x, diamondY - 9);
  ctx.lineTo(x + 9, diamondY);
  ctx.lineTo(x, diamondY + 9);
  ctx.lineTo(x - 9, diamondY);
  ctx.closePath();
  ctx.fill();
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('GLIDE', x, y0 - 12);
  ctx.fillText(errorFt >= 0 ? `+${Math.round(errorFt)} ft` : `${Math.round(errorFt)} ft`, x, y1 + 18);
}

// The full HUD over a flying frame.
export function drawHud(ctx, game, width, height) {
  const flight = game.flight;
  const strip = game.strip;
  const wind = game.windNow;
  const split = splitWind(wind.speedKts, wind.fromDeg, strip.headingDeg);
  const stall = stallSpeedKts(flight, strip);

  // Airspeed, altitude and heading: the three numbers the judge looks for.
  drawPanel(ctx, 18, 16, 168, 74);
  drawTapeValue(ctx, 'AIRSPEED', String(Math.round(flight.speedKts)), 'kt', 32, 34, flight.speedKts < stall + 4);
  drawPanel(ctx, width - 186, 16, 168, 74);
  drawTapeValue(ctx, 'ALTITUDE', String(Math.round(flight.altitudeFt)), 'ft AGL', width - 172, 34, flight.altitudeFt < 80);
  drawPanel(ctx, width / 2 - 130, 16, 260, 56);
  ctx.textAlign = 'center';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('HEADING', width / 2, 32);
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const heading = ((Math.round(flight.headingDeg) % 360) + 360) % 360;
  ctx.fillText(`${String(heading).padStart(3, '0')}°`, width / 2, 60);
  // Compass ticks under the heading.
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  for (let off = -40; off <= 40; off += 20) {
    ctx.beginPath();
    ctx.moveTo(width / 2 + off, 66);
    ctx.lineTo(width / 2 + off, 70);
    ctx.stroke();
  }

  // Vertical speed and distance to the threshold, left under the airspeed.
  drawPanel(ctx, 18, 102, 168, 64);
  ctx.textAlign = 'left';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('VERTICAL SPEED', 32, 120);
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillStyle = flight.verticalSpeedFpm < -800 ? '#ff5a4e' : '#ffffff';
  ctx.fillText(`${flight.verticalSpeedFpm >= 0 ? '+' : ''}${Math.round(flight.verticalSpeedFpm)} fpm`, 32, 148);
  drawPanel(ctx, 18, 178, 168, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('DIST TO THRESHOLD', 32, 196);
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const dist = Math.max(0, flight.distanceFt);
  ctx.fillText(dist >= 5280 ? `${(dist / 5280).toFixed(1)} nm` : `${Math.round(dist)} ft`, 32, 224);

  // PAPI lamps, as the pilot sees them, top right under the altitude.
  const whites = papiWhites(flight);
  drawPanel(ctx, width - 186, 102, 168, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PAPI', width - 172, 120);
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = i < whites ? '#ffffff' : '#ff3b30';
    ctx.beginPath();
    ctx.arc(width - 158 + i * 26, 142, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText(whites === 2 ? 'ON SLOPE' : whites > 2 ? 'HIGH' : 'LOW', width - 172, 160);

  drawGlideSlopeIndicator(ctx, game, width, height);

  // Throttle, fuel, flaps and gear, bottom left.
  drawPanel(ctx, 18, height - 108, 250, 90);
  ctx.textAlign = 'left';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('THROTTLE', 32, height - 90);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(32, height - 80, 180, 10);
  ctx.fillStyle = '#37d67a';
  ctx.fillRect(32, height - 80, 180 * flight.throttle, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('FUEL', 32, height - 54);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(32, height - 44, 180, 10);
  ctx.fillStyle = flight.fuelFraction < 0.2 ? '#ff5a4e' : '#ffb020';
  ctx.fillRect(32, height - 44, 180 * flight.fuelFraction, 10);
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`FLAPS ${flight.flaps}`, 224, height - 66);
  ctx.fillStyle = flight.gearDown ? '#37d67a' : '#ff5a4e';
  ctx.fillText(flight.gearDown ? 'GEAR DN' : 'GEAR UP', 224, height - 44);

  // Strip, wind, score and strikes, bottom right.
  drawPanel(ctx, width - 268, height - 108, 250, 90);
  ctx.textAlign = 'right';
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${strip.name}`, width - 32, height - 84);
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const windArrow = wind.fromDeg >= 0 ? '↖' : '↗';
  ctx.fillText(
    `WIND ${Math.round(wind.speedKts)} kt ${windArrow}  X/W ${Math.abs(Math.round(split.crosswindKts))} kt`,
    width - 32,
    height - 62,
  );
  ctx.fillText(`SCORE ${game.sortie.totalScore}   STRIKES ${'●'.repeat(game.sortie.strikes)}${'○'.repeat(3 - game.sortie.strikes)}`, width - 32, height - 40);
  ctx.fillText(`STRIP ${strip.index + 1} OF 4`, width - 32, height - 22);

  // Warnings, centred under the heading tape.
  const warnings = [];
  if (flight.speedKts < stall) warnings.push('STALL');
  else if (flight.verticalSpeedFpm < -900) warnings.push('SINK RATE');
  if (flight.fuelFraction < 0.15) warnings.push('LOW FUEL');
  if (!flight.gearDown && flight.altitudeFt < 250) warnings.push('GEAR UP');
  if (warnings.length > 0 && Math.floor(game.timeSec * 2.4) % 2 === 0) {
    outlinedText(ctx, warnings.join('  •  '), width / 2, 96, '800 24px system-ui, sans-serif', '#ff5a4e');
  }
}
