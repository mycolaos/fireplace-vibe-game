/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Particle } from '../types';

export const spawnParticle = (type: 'fire' | 'smoke' | 'rain' | 'snow', x: number, y: number, wind: number, intensity: number): Particle => {
  let angle = 0;
  let speed = 0;
  let color = '';
  let size = 0;

  if (type === 'fire') {
    angle = (Math.PI * 1.5) + (Math.random() - 0.5) * 0.5 + (wind * 0.3);
    speed = 1 + Math.random() * 2;
    if (intensity > 70) color = `rgba(255, 255, ${150 + Math.random() * 105}, 0.8)`;
    else if (intensity > 40) color = `rgba(255, ${100 + Math.random() * 100}, 20, 0.8)`;
    else color = `rgba(${150 + Math.random() * 105}, 20, 20, 0.8)`;
    size = 2 + Math.random() * 6;
  } else if (type === 'smoke') {
    angle = (Math.PI * 1.5) + (Math.random() - 0.5) * 0.4 + (wind * 0.25);
    speed = 0.5 + Math.random() * 0.8;
    const gray = 45 + Math.floor(Math.random() * 30);
    // Store as clean rgb to allow dynamic opacity interpolation in updater
    color = `rgb(${gray}, ${gray}, ${gray + 2})`;
    size = 12 + Math.random() * 10;
  } else if (type === 'rain') {
    angle = (Math.PI * 0.5) + (wind * 0.2); // Falling down
    speed = 8 + Math.random() * 4;
    color = 'rgba(150, 150, 255, 0.4)';
    size = 1 + Math.random() * 2;
  } else if (type === 'snow') {
    angle = (Math.PI * 0.5) + (wind * 0.4); // Falling down wanderingly
    speed = 1 + Math.random() * 1;
    color = 'rgba(255, 255, 255, 0.8)';
    size = 2 + Math.random() * 3;
  }

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size,
    life: 1.0,
    type,
    color
  };
};

export const updateParticles = (particles: Particle[], ctx: CanvasRenderingContext2D): Particle[] => {
  const remaining = particles.filter(p => {
    // 1. Particle Physics / State Update
    if (p.type === 'smoke') {
      p.y += p.vy;
      // Add visual horizontal swaying
      const sway = Math.sin((1 - p.life) * 8 + p.size) * 0.35;
      p.x += p.vx + sway;
      // Slow down slightly as they rise and expand
      p.vy *= 0.992;
      // Graceful slower decay for smoke (150-250 frames)
      p.life -= 0.0035 + Math.random() * 0.0035;
    } else {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.type === 'fire' ? (0.015 + Math.random() * 0.02) : (0.01 + Math.random() * 0.02);
    }
    
    // 2. Custom Draw Render Paths
    if (p.life > 0) {
      ctx.save();
      
      if (p.type === 'smoke') {
        ctx.globalCompositeOperation = 'source-over';
        
        // Dynamic swelling size behavior (fluffy cloud starts dense and rolls out)
        const progress = 1 - p.life;
        const currentSize = p.size * (1.0 + progress * 3.8);
        
        // Double-ended fade curve so clouds don't suddenly pop into existence
        const maxAlpha = 0.24;
        const opacity = Math.sin(p.life * Math.PI) * maxAlpha;
        
        // Draw real volumetric smoke cloud puff using radial gradient lighting
        const grad = ctx.createRadialGradient(p.x, p.y, currentSize * 0.08, p.x, p.y, currentSize);
        
        const innerColor = p.color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
        const midColor = p.color.replace('rgb', 'rgba').replace(')', `, ${opacity * 0.65})`);
        const outerColor = p.color.replace('rgb', 'rgba').replace(')', `, 0)`);
        
        grad.addColorStop(0, innerColor);
        grad.addColorStop(0.35, midColor);
        grad.addColorStop(1, outerColor);
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
        
      } else if (p.type === 'fire') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      } else {
        // Rain, Snow, etc.
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      
      ctx.restore();
    }
    
    return p.life > 0;
  });
  
  return remaining;
};
