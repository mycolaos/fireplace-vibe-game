/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Wood, Star, Firefly, Tree } from '../types';
import { SKY_COLORS } from '../constants';

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

export const drawMoon = (ctx: CanvasRenderingContext2D, width: number, height: number, cycle: number) => {
  // Moon is visible mostly at night (0.2 to 0.8)
  let alpha = 0;
  if (cycle > 0.2 && cycle < 0.8) {
    alpha = Math.sin((cycle - 0.2) / 0.6 * Math.PI);
  }
  if (alpha <= 0) return;

  const moonX = width * (0.2 + (cycle * 0.6)); // Moon moves across the sky
  const moonY = height * (0.25 - Math.sin(cycle * Math.PI) * 0.15);
  
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = 40;
  ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
  ctx.fillStyle = '#fefce8';
  ctx.beginPath();
  ctx.arc(moonX, moonY, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(moonX + 10, moonY - 5, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const drawStars = (ctx: CanvasRenderingContext2D, stars: Star[], width: number, horizonY: number, time: number, cycle: number) => {
  // Stars visible at night
  let alphaMult = 0;
  if (cycle > 0.1 && cycle < 0.9) {
    alphaMult = Math.sin((cycle - 0.1) / 0.8 * Math.PI);
  }
  if (alphaMult <= 0) return;

  ctx.fillStyle = 'white';
  stars.forEach(s => {
    const twinkle = Math.sin(time * 0.002 + s.phase) * 0.5 + 0.5;
    ctx.globalAlpha = (0.3 + twinkle * 0.7) * alphaMult;
    ctx.beginPath();
    ctx.arc(s.x * width, s.y * horizonY * 0.9, s.size, 0, Math.PI * 2);
    ctx.fill();
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

export const drawWeatherOverlay = (ctx: CanvasRenderingContext2D, weather: string, width: number, height: number) => {
  if (weather === 'CLEAR') return;

  ctx.save();
  if (weather === 'WINDY') {
    // Subtle horizontal streaks or dust
    ctx.fillStyle = 'rgba(200, 200, 200, 0.05)';
    for (let i = 0; i < 5; i++) {
        ctx.fillRect(0, Math.random() * height, width, 2);
    }
  } else if (weather === 'RAINY') {
    // Gloomy blueish overlay
    const gloom = ctx.createLinearGradient(0, 0, 0, height);
    gloom.addColorStop(0, 'rgba(30, 40, 80, 0.2)');
    gloom.addColorStop(1, 'rgba(10, 15, 30, 0.4)');
    ctx.fillStyle = gloom;
    ctx.fillRect(0, 0, width, height);

    // Fog at horizon
    const fog = ctx.createLinearGradient(0, height * 0.4, 0, height * 0.6);
    fog.addColorStop(0, 'rgba(0,0,0,0)');
    fog.addColorStop(0.5, 'rgba(100, 110, 140, 0.2)');
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, height * 0.4, width, height * 0.2);
  } else if (weather === 'SNOWY') {
    // Colder, whiteish overlay
    ctx.fillStyle = 'rgba(200, 230, 255, 0.1)';
    ctx.fillRect(0, 0, width, height);

    // Thick fog 
    const snowFog = ctx.createRadialGradient(width/2, height*0.6, 0, width/2, height*0.6, width);
    snowFog.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    snowFog.addColorStop(1, 'rgba(200, 220, 255, 0.2)');
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
    ctx.fillStyle = w.type === 'log' ? '#5d4037' : '#8d6e63';
    
    if (w.isBurning) {
      const pulsate = Math.sin(time * 0.01 + w.x) * 0.2 + 0.8;
      ctx.shadowBlur = 10 * pulsate * w.life;
      ctx.shadowColor = '#ff5500';
      ctx.fillStyle = `rgb(${80 + 175 * pulsate}, ${40 + 80 * pulsate}, 20)`;
    }

    const w_width = w.type === 'log' ? 40 : 20;
    const w_height = w.type === 'log' ? 12 : 5;
    ctx.fillRect(-w_width / 2, -w_height / 2, w_width, w_height);
    
    if (w.isBurning && Math.random() > 0.95) {
       const sx = (Math.random() - 0.5) * w_width;
       const sy = (Math.random() - 0.5) * w_height;
       ctx.fillStyle = '#fff';
       ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.restore();
    return w.life > 0 || intensity > 0;
  });
};
