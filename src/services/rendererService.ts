/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Wood, Star, Firefly, Tree, Mountain, Cloud, Rock, Grass, Cactus, Comet } from '../types';
import { SKY_COLORS, MOON_POSITION_CONFIG } from '../constants';

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

const interpolateColor = (color1: string, color2: string, factor: number) => {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);
  return `rgb(${r}, ${g}, ${b})`;
};

export const drawSky = (ctx: CanvasRenderingContext2D, width: number, horizonY: number, cycle: number) => {
  let topColor, bottomColor;
  
  // Cycle: 0 (Dusk) -> 0.4 (Night) -> 0.7 (Dawn) -> 1.0 (Dusk)
  if (cycle < 0.4) {
    const f = cycle / 0.4;
    topColor = interpolateColor(SKY_COLORS.DUSK.top, SKY_COLORS.NIGHT.top, f);
    bottomColor = interpolateColor(SKY_COLORS.DUSK.bottom, SKY_COLORS.NIGHT.bottom, f);
  } else if (cycle < 0.7) {
    const f = (cycle - 0.4) / 0.3;
    topColor = interpolateColor(SKY_COLORS.NIGHT.top, SKY_COLORS.DAWN.top, f);
    bottomColor = interpolateColor(SKY_COLORS.NIGHT.bottom, SKY_COLORS.DAWN.bottom, f);
  } else {
    const f = (cycle - 0.7) / 0.3;
    topColor = interpolateColor(SKY_COLORS.DAWN.top, SKY_COLORS.DUSK.top, f);
    bottomColor = interpolateColor(SKY_COLORS.DAWN.bottom, SKY_COLORS.DUSK.bottom, f);
  }

  const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGradient.addColorStop(0, topColor);
  skyGradient.addColorStop(1, bottomColor);
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, width, horizonY);
};

export const drawGround = (ctx: CanvasRenderingContext2D, width: number, height: number, horizonY: number, cycle: number) => {
  // Ground also gets darker/lighter with cycle
  const brightness = cycle > 0.4 && cycle < 0.7 ? 0.05 : 0.15 * (1 - Math.abs(cycle - 0.5) * 2);
  const groundGradient = ctx.createLinearGradient(0, horizonY, 0, height);
  
  // Darken ground relative to sky
  const color1 = cycle > 0.3 && cycle < 0.8 ? '#0a0714' : '#1a1724';
  const color2 = cycle > 0.3 && cycle < 0.8 ? '#05020a' : '#0a0a1a';
  
  groundGradient.addColorStop(0, color1);
  groundGradient.addColorStop(1, color2);
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, horizonY, width, height - horizonY);
};

let moonCanvas: HTMLCanvasElement | null = null;

export const drawMoon = (ctx: CanvasRenderingContext2D, width: number, height: number, cycle: number) => {
  // Moon is visible mostly at night (0.2 to 0.8)
  let alpha = 0;
  if (cycle > 0.2 && cycle < 0.8) {
    alpha = Math.sin((cycle - 0.2) / 0.6 * Math.PI);
  }
  if (alpha <= 0) return;

  const { startX, endX, baseY, arcHeight } = MOON_POSITION_CONFIG;
  const moonX = width * (startX + (cycle * (endX - startX))); // Moon moves across the sky
  const moonY = height * (baseY - Math.sin(cycle * Math.PI) * arcHeight);
  
  if (typeof document !== 'undefined') {
    if (!moonCanvas) {
      moonCanvas = document.createElement('canvas');
      moonCanvas.width = 100;
      moonCanvas.height = 100;
    }
    const oCtx = moonCanvas.getContext('2d');
    if (oCtx) {
      oCtx.save();
      oCtx.clearRect(0, 0, 100, 100);
      
      // Draw fully opaque solid moon circle
      oCtx.fillStyle = '#fefce8';
      oCtx.beginPath();
      oCtx.arc(50, 50, 30, 0, Math.PI * 2);
      oCtx.fill();
      
      // Draw a solid border outline for sharp shape definition
      oCtx.strokeStyle = '#fefce8';
      oCtx.lineWidth = 1.5;
      oCtx.stroke();
      
      // Use destination-out to bite a piece of the circle and create an opaque crescent.
      // Since it's destination-out, it erases the fill in the bite area,
      // creating a perfect sharp opaque crescent.
      oCtx.globalCompositeOperation = 'destination-out';
      oCtx.beginPath();
      oCtx.arc(60, 45, 28, 0, Math.PI * 2);
      oCtx.fill();
      
      oCtx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 40;
    ctx.shadowColor = 'rgba(254, 252, 232, 0.4)';
    ctx.drawImage(moonCanvas, moonX - 50, moonY - 50);
    ctx.restore();
  }
};

export const drawStars = (ctx: CanvasRenderingContext2D, stars: Star[], width: number, horizonY: number, time: number, cycle: number, starsAlphaMod: number = 1.0) => {
  // Stars visible at night
  let alphaMult = 0;
  if (cycle > 0.1 && cycle < 0.9) {
    alphaMult = Math.sin((cycle - 0.1) / 0.8 * Math.PI);
  }
  if (alphaMult <= 0) return;
  if (starsAlphaMod <= 0.01) return;

  // Calculate moon position if visible
  let moonAlpha = 0;
  if (cycle > 0.2 && cycle < 0.8) {
    moonAlpha = Math.sin((cycle - 0.2) / 0.6 * Math.PI);
  }

  const { startX, endX, baseY, arcHeight } = MOON_POSITION_CONFIG;
  const height = ctx.canvas.height;
  const moonX = width * (startX + (cycle * (endX - startX)));
  const moonY = height * (baseY - Math.sin(cycle * Math.PI) * arcHeight);

  ctx.fillStyle = 'white';
  stars.forEach(s => {
    // Individual threshold for this star to become visible [0, 0.95]
    const threshold = (s.phase / (Math.PI * 2)) * 0.95;
    
    // Calculate individual star opacity relative to threshold
    let starAlpha = 0;
    if (alphaMult > threshold) {
      // Fade in quickly (within 0.1 of alphaMult progress after threshold)
      starAlpha = Math.min(1, (alphaMult - threshold) * 10);
    }
    
    if (starAlpha > 0) {
      const starX = s.x * width;
      const starY = s.y * horizonY * 0.9;

      // Skip drawing stars that are behind the physical round moon sphere
      if (moonAlpha > 0) {
        const dx = starX - moonX;
        const dy = starY - moonY;
        const distSq = dx * dx + dy * dy;
        // The physical moon radius is 30. We include star size as buffer to prevent clipping edges
        const bufferRadius = 30 + s.size;
        if (distSq < bufferRadius * bufferRadius) {
          return;
        }
      }

      const twinkle = Math.sin(time * 0.002 + s.phase) * 0.5 + 0.5;
      ctx.globalAlpha = (0.3 + twinkle * 0.7) * starAlpha * starsAlphaMod;
      ctx.beginPath();
      ctx.arc(starX, starY, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1.0;
};

export const drawDunes = (ctx: CanvasRenderingContext2D, width: number, horizonY: number) => {
  const drawDune = (height: number, color: string, offset: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 20);
    for(let x = 0; x <= width; x += 10) {
      const y = horizonY - height + Math.sin(x * 0.005 + offset) * 20;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, horizonY + 20);
    ctx.fill();
  };
  drawDune(60, '#0a0514', 1);
  drawDune(30, '#0d071a', 5);
};

export const drawMountains = (ctx: CanvasRenderingContext2D, mountains: Mountain[], width: number, horizonY: number) => {
  mountains.forEach(m => {
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.moveTo(m.x * width - m.width / 2, horizonY);
    ctx.lineTo(m.x * width, horizonY - m.height);
    ctx.lineTo(m.x * width + m.width / 2, horizonY);
    ctx.fill();
    
    // Add a highlight on one side
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.moveTo(m.x * width - m.width / 2, horizonY);
    ctx.lineTo(m.x * width, horizonY - m.height);
    ctx.lineTo(m.x * width + m.width / 4, horizonY);
    ctx.fill();
  });
};

export const drawClouds = (ctx: CanvasRenderingContext2D, clouds: Cloud[], width: number, time: number, density: number, alpha: number) => {
  clouds.forEach(c => {
    // Only draw if within current density threshold
    if (c.threshold > density) return;

    // Smooth fade-in as density approaches threshold
    const localDensityAlpha = Math.min(1, (density - c.threshold) * 5);
    
    const x = ((c.x * width) + (time * c.speed)) % (width + 400 * c.scale) - 200 * c.scale;
    ctx.save();
    ctx.globalAlpha = c.opacity * alpha * localDensityAlpha;
    ctx.fillStyle = '#fff';
    ctx.translate(x, c.y);
    ctx.scale(c.scale, c.scale);
    
    ctx.beginPath();
    c.puffs.forEach(p => {
      ctx.moveTo(p.dx + p.radius, p.dy);
      ctx.arc(p.dx, p.dy, p.radius, 0, Math.PI * 2);
    });
    ctx.fill();
    ctx.restore();
  });
};

export const drawCabin = (ctx: CanvasRenderingContext2D, width: number, horizonY: number, time: number) => {
  const cabinX = width * 0.8;
  const cabinY = horizonY - 15 + Math.sin(cabinX * 0.005 + 1) * 5;
  ctx.fillStyle = '#05020a';
  ctx.beginPath();
  ctx.moveTo(cabinX - 20, cabinY);
  ctx.lineTo(cabinX - 20, cabinY - 15);
  ctx.lineTo(cabinX, cabinY - 25);
  ctx.lineTo(cabinX + 20, cabinY - 15);
  ctx.lineTo(cabinX + 20, cabinY);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillRect(cabinX + 8, cabinY - 22, 5, -8);
  const smokeFlick = (time * 0.001) % 1;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * (1 - smokeFlick)})`;
  ctx.beginPath();
  ctx.arc(cabinX + 10 + Math.sin(time * 0.005) * 5, cabinY - 30 - smokeFlick * 20, 4 + smokeFlick * 6, 0, Math.PI * 2);
  ctx.fill();

  const flick = Math.sin(time * 0.01) * 0.2 + 0.8;
  ctx.fillStyle = `rgba(255, 200, 50, ${flick * 0.8})`;
  ctx.fillRect(cabinX - 5, cabinY - 10, 10, 8);
  ctx.shadowBlur = 15 * flick;
  ctx.shadowColor = 'orange';
  ctx.strokeRect(cabinX - 5, cabinY - 10, 10, 8);
  ctx.shadowBlur = 0;
};

export const drawRocks = (ctx: CanvasRenderingContext2D, rocks: Rock[], width: number, horizonY: number) => {
  rocks.forEach(r => {
    ctx.save();
    ctx.translate(r.x * width, horizonY + r.y);
    ctx.rotate(r.rotation);
    ctx.fillStyle = r.color;
    
    // Draw a jagged rock shape
    ctx.beginPath();
    ctx.moveTo(-r.size, 0);
    ctx.lineTo(-r.size * 0.8, -r.size * 0.6);
    ctx.lineTo(0, -r.size);
    ctx.lineTo(r.size * 0.7, -r.size * 0.7);
    ctx.lineTo(r.size, 0);
    ctx.closePath();
    ctx.fill();
    
    // Lowlight
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, -r.size);
    ctx.lineTo(r.size * 0.7, -r.size * 0.7);
    ctx.lineTo(r.size, 0);
    ctx.lineTo(0, 0);
    ctx.fill();
    
    ctx.restore();
  });
};

export const drawTrees = (ctx: CanvasRenderingContext2D, trees: Tree[], width: number, horizonY: number, time: number) => {
  trees.forEach(t => {
    const sway = Math.sin(time * 0.001 + t.phase) * 0.05;
    ctx.save();
    const treeY = horizonY + (t.y - 0.75) * 100;
    ctx.translate(t.x * width, treeY);
    ctx.rotate(sway);
    ctx.fillStyle = '#05020a';
    ctx.fillRect(-2, 0, 4, -t.height);
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const levelY = -t.height * (0.4 + i * 0.3);
        const levelWidth = 15 - i * 4;
        ctx.moveTo(0, levelY - 15);
        ctx.lineTo(-levelWidth, levelY + 10);
        ctx.lineTo(levelWidth, levelY + 10);
        ctx.fill();
    }
    ctx.restore();
  });
};

export const drawGrass = (ctx: CanvasRenderingContext2D, grass: Grass[], width: number, horizonY: number, time: number) => {
  grass.forEach(g => {
    const sway = Math.sin(time * 0.002 + g.phase) * 5;
    ctx.save();
    ctx.translate(g.x * width, horizonY + g.y);
    ctx.strokeStyle = '#05020a';
    ctx.lineWidth = 1.5;
    
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 3, 0);
      ctx.quadraticCurveTo(i * 3 + sway * 0.5, -g.height * 0.5, i * 3 + sway, -g.height);
      ctx.stroke();
    }
    ctx.restore();
  });
};

export const drawWolf = (ctx: CanvasRenderingContext2D, wolf: any, width: number, horizonY: number, time: number) => {
  if (wolf.state === 'HIDDEN') return;

  const { x, y, state, direction, timer, eyeBrightness } = wolf;
  
  ctx.save();
  ctx.translate(x, horizonY + y);
  
  // Use horizontal scale for walking/exiting
  if (state !== 'SITTING' && state !== 'HOWLING') {
     ctx.scale(direction, 1);
  }

  ctx.fillStyle = '#05020a'; 
  
  // Body - Angled/Geometric style
  ctx.beginPath();
  if (state === 'SITTING' || state === 'HOWLING') {
     // Symmetrical sitting silhouette (facing player)
     ctx.moveTo(-14, 0);
     ctx.lineTo(14, 0);
     ctx.lineTo(11, -12);
     ctx.lineTo(15, -14); // hip out
     ctx.lineTo(8, -26);  // shoulder in
     ctx.lineTo(-8, -26); // shoulder in
     ctx.lineTo(-15, -14); // hip out
     ctx.lineTo(-11, -12);
     ctx.closePath();
     ctx.fill();

     // Tail (geometric, off to one side)
     ctx.beginPath();
     ctx.moveTo(-10, 0);
     ctx.lineTo(-18, 4);
     ctx.lineTo(-12, 10);
     ctx.closePath();
     ctx.fill();
  } else {
     // Standing/Walking silhouette (angular)
     ctx.moveTo(-18, -14);
     ctx.lineTo(12, -18);  // Back
     ctx.lineTo(18, -8);   // Chest
     ctx.lineTo(15, -4);   // Belly front
     ctx.lineTo(-12, -4);  // Belly back
     ctx.lineTo(-20, -8);  // Hip
     ctx.closePath();
     ctx.fill();

     // Legs (walking - angular)
     const walkPhase = time * 0.01;
     const legPositions = [
       { x: -14, bounce: Math.sin(walkPhase) * 6 },
       { x: -6, bounce: Math.cos(walkPhase) * 6 },
       { x: 4, bounce: Math.sin(walkPhase + Math.PI) * 6 },
       { x: 12, bounce: Math.cos(walkPhase + Math.PI) * 6 }
     ];

     legPositions.forEach(leg => {
       ctx.beginPath();
       ctx.moveTo(leg.x, -6);
       ctx.lineTo(leg.x + 2, -6);
       ctx.lineTo(leg.x + 1, 4 + leg.bounce);
       ctx.lineTo(leg.x - 1, 4 + leg.bounce);
       ctx.closePath();
       ctx.fill();
     });
  }

  // Head (modularly angled)
  ctx.save();
  const howlOffset = state === 'HOWLING' ? Math.min(1, timer / 1000) : 0;
  
  if (state === 'SITTING' || state === 'HOWLING') {
     ctx.translate(0, -28); // Center the head
     if (state === 'HOWLING') {
        const lift = howlOffset * 6;
        ctx.translate(0, -lift);
     }
     
     // Angular head shape (facing forward)
     ctx.beginPath();
     ctx.moveTo(-8, -4);
     ctx.lineTo(0, -10);
     ctx.lineTo(8, -4);
     ctx.lineTo(0, 10); // Nose area
     ctx.closePath();
     ctx.fill();

     // Snout detail (facing forward)
     ctx.fillRect(-2, 4, 4, 3);

     // Angular Ears (two)
     ctx.beginPath();
     ctx.moveTo(-5, -6);
     ctx.lineTo(-9, -17);
     ctx.lineTo(-1, -8);
     ctx.fill();

     ctx.beginPath();
     ctx.moveTo(5, -6);
     ctx.lineTo(9, -17);
     ctx.lineTo(1, -8);
     ctx.fill();

     // Two Eyes
     if (eyeBrightness > 0) {
        ctx.shadowBlur = 6 * eyeBrightness;
        ctx.shadowColor = '#00ffff';
        ctx.fillStyle = `rgba(100, 255, 255, ${eyeBrightness})`;
        
        // Left Eye
        ctx.beginPath();
        ctx.moveTo(-5, -2);
        ctx.lineTo(-2, -3);
        ctx.lineTo(-3.5, 0);
        ctx.closePath();
        ctx.fill();

        // Right Eye
        ctx.beginPath();
        ctx.moveTo(5, -2);
        ctx.lineTo(2, -3);
        ctx.lineTo(3.5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
     }

  } else {
     ctx.translate(16, -20);
     ctx.rotate(Math.sin(time * 0.005) * 0.05); // Subtle head bob
     
     // Profile head shape
     ctx.beginPath();
     ctx.moveTo(0, -6);
     ctx.lineTo(10, -2); // Snout top
     ctx.lineTo(9, 2);   // Snout bottom
     ctx.lineTo(0, 4);   // Chin
     ctx.lineTo(-4, 0);  // Back head
     ctx.closePath();
     ctx.fill();

     ctx.fillRect(8, -1, 3, 2);

     ctx.beginPath();
     ctx.moveTo(-1, -4);
     ctx.lineTo(-5, -12);
     ctx.lineTo(1, -6);
     ctx.fill();

     ctx.beginPath();
     ctx.moveTo(2, -3);
     ctx.lineTo(3, -13);
     ctx.lineTo(5, -5);
     ctx.fill();

     if (eyeBrightness > 0) {
        ctx.shadowBlur = 6 * eyeBrightness;
        ctx.shadowColor = '#00ffff';
        ctx.fillStyle = `rgba(100, 255, 255, ${eyeBrightness})`;
        ctx.beginPath();
        ctx.moveTo(3, -1);
        ctx.lineTo(5, -2);
        ctx.lineTo(4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
     }
  }
  
  ctx.restore();
  ctx.restore();
};

export const drawFireflies = (ctx: CanvasRenderingContext2D, fireflies: Firefly[], width: number, height: number, time: number) => {
  ctx.save();
  ctx.shadowBlur = 8;
  fireflies.forEach(f => {
      const x = (f.x * width) + Math.sin(time * f.speed + f.phase) * 30;
      const y = (f.y * height) + Math.cos(time * f.speed + f.phase) * 30;
      const flick = Math.sin(time * 0.005 + f.offset) * 0.5 + 0.5;
      ctx.shadowColor = '#d4d4d8';
      ctx.fillStyle = `rgba(187, 247, 208, ${flick * 0.8})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
  });
  ctx.restore();
};

export const drawGlow = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, intensity: number, width: number, height: number) => {
  const intensityNorm = intensity / 100;
  const groundGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 300 * intensityNorm);
  groundGlow.addColorStop(0, `rgba(255, 80, 0, ${0.2 * intensityNorm})`);
  groundGlow.addColorStop(0.5, `rgba(150, 40, 0, ${0.1 * intensityNorm})`);
  groundGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = groundGlow;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, 300 * intensityNorm, 100 * intensityNorm, 0, 0, Math.PI * 2);
  ctx.fill();

  const bgGrade = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, 150 + intensity * 3.5);
  bgGrade.addColorStop(0, `rgba(255, 120, 40, ${intensityNorm * 0.25})`);
  bgGrade.addColorStop(0.4, `rgba(180, 60, 20, ${intensityNorm * 0.15})`);
  bgGrade.addColorStop(1, 'rgba(0, 0, 0, 0)');
  
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = bgGrade;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
};

export const drawWeatherOverlay = (ctx: CanvasRenderingContext2D, weatherWeights: Record<string, number>, width: number, height: number) => {
  ctx.save();
  
  // Windy overlay
  const windyWeight = weatherWeights.WINDY || 0;
  if (windyWeight > 0.01) {
    ctx.fillStyle = `rgba(200, 200, 200, ${0.05 * windyWeight})`;
    const numStreaks = Math.round(5 * windyWeight);
    for (let i = 0; i < numStreaks; i++) {
        ctx.fillRect(0, Math.random() * height, width, 2);
    }
  }

  // Rainy overlay
  const rainyWeight = weatherWeights.RAINY || 0;
  if (rainyWeight > 0.01) {
    const gloom = ctx.createLinearGradient(0, 0, 0, height);
    gloom.addColorStop(0, `rgba(30, 40, 80, ${0.2 * rainyWeight})`);
    gloom.addColorStop(1, `rgba(10, 15, 30, ${0.4 * rainyWeight})`);
    ctx.fillStyle = gloom;
    ctx.fillRect(0, 0, width, height);

    const fog = ctx.createLinearGradient(0, height * 0.4, 0, height * 0.6);
    fog.addColorStop(0, 'rgba(0,0,0,0)');
    fog.addColorStop(0.5, `rgba(100, 110, 140, ${0.2 * rainyWeight})`);
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, height * 0.4, width, height * 0.2);
  }

  // Snowy overlay
  const snowyWeight = weatherWeights.SNOWY || 0;
  if (snowyWeight > 0.01) {
    ctx.fillStyle = `rgba(200, 230, 255, ${0.1 * snowyWeight})`;
    ctx.fillRect(0, 0, width, height);

    const snowFog = ctx.createRadialGradient(width/2, height*0.6, 0, width/2, height*0.6, width);
    snowFog.addColorStop(0, `rgba(255, 255, 255, ${0.05 * snowyWeight})`);
    snowFog.addColorStop(1, `rgba(200, 220, 255, ${0.2 * snowyWeight})`);
    ctx.fillStyle = snowFog;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
};

export const drawWoods = (ctx: CanvasRenderingContext2D, woods: Wood[], dt: number, intensity: number, time: number) => {
  const centerX = ctx.canvas.width / 2;
  const gravity = 1200; // pixels per second squared

  return woods.filter(w => {
    // Physics: Falling logic
    if (w.y < w.targetY) {
      w.vy += gravity * dt;
      w.y += w.vy * dt;
      
      // Hit target (ground/pile)
      if (w.y >= w.targetY) {
        w.y = w.targetY;
        w.vy = 0;
        
        // Check for ignition on impact if not already burning
        if (!w.isBurning) {
          const dist = Math.sqrt((w.x - centerX) ** 2 + (w.y - w.targetY) ** 2);
          const fireRadius = 25 + (intensity * 0.5);
          if (dist < fireRadius) {
            w.isBurning = true;
          }
        }
      }
    }

    const decayRate = w.isBurning ? 0.15 : 0.05;
    w.life -= decayRate * dt;
    
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.rotation);
    
    // Add fade out as wood decays
    ctx.globalAlpha = Math.max(0, Math.min(1, w.life * 3));
    
    ctx.fillStyle = w.type === 'log' ? '#5d4037' : '#8d6e63';
    
    if (w.isBurning) {
      const pulsate = Math.sin(time * 0.01 + w.x) * 0.2 + 0.8;
      ctx.shadowBlur = 10 * pulsate * w.life;
      ctx.shadowColor = '#ff5500';
      ctx.fillStyle = `rgb(${80 + 175 * pulsate}, ${40 + 80 * pulsate}, 20)`;
    }

    // Shrink slightly as it decays
    const sizeMod = 0.8 + 0.2 * Math.max(0, w.life);
    const w_width = (w.type === 'log' ? 40 : 20) * sizeMod;
    const w_height = (w.type === 'log' ? 12 : 5) * sizeMod;
    ctx.fillRect(-w_width / 2, -w_height / 2, w_width, w_height);
    
    if (w.isBurning && Math.random() > 0.95) {
       const sx = (Math.random() - 0.5) * w_width;
       const sy = (Math.random() - 0.5) * w_height;
       ctx.fillStyle = '#fff';
       ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.restore();
    return w.life > 0;
  });
};

export const drawCacti = (ctx: CanvasRenderingContext2D, cacti: Cactus[], width: number, horizonY: number) => {
  cacti.forEach(c => {
    ctx.save();
    ctx.translate(c.x * width, horizonY + c.y);
    ctx.rotate(c.rotation);
    ctx.fillStyle = '#05020a';
    
    // Main body
    ctx.fillRect(-4, 0, 8, -c.height);
    
    // Left arm
    ctx.fillRect(-4, -c.height * 0.6, -8, 4);
    ctx.fillRect(-12, -c.height * 0.6, 4, -15);
    
    // Right arm
    ctx.fillRect(4, -c.height * 0.4, 8, 4);
    ctx.fillRect(8, -c.height * 0.4, 4, -20);
    
    ctx.restore();
  });
};

export const drawComet = (ctx: CanvasRenderingContext2D, comet: Comet) => {
  if (!comet.active) return;
  
  ctx.save();
  ctx.globalAlpha = comet.life;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(comet.x, comet.y);
  ctx.lineTo(comet.x - comet.vx * 0.1, comet.y - comet.vy * 0.1);
  ctx.stroke();
  
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(comet.x, comet.y, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};
