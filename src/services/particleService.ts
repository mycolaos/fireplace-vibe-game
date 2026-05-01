/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Particle } from '../types';

export const spawnParticle = (type: 'fire' | 'smoke', x: number, y: number, wind: number, intensity: number): Particle => {
  const angle = (Math.PI * 1.5) + (Math.random() - 0.5) * 0.5 + (wind * 0.3);
  const speed = type === 'fire' ? 1 + Math.random() * 2 : 0.5 + Math.random() * 1;
  
  let color = '';
  if (type === 'fire') {
    if (intensity > 70) color = `rgba(255, 255, ${150 + Math.random() * 105}, 0.8)`;
    else if (intensity > 40) color = `rgba(255, ${100 + Math.random() * 100}, 20, 0.8)`;
    else color = `rgba(${150 + Math.random() * 105}, 20, 20, 0.8)`;
  } else {
    const gray = 50 + Math.random() * 50;
    color = `rgba(${gray}, ${gray}, ${gray}, 0.4)`;
  }

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: type === 'fire' ? 2 + Math.random() * 6 : 5 + Math.random() * 10,
    life: 1.0,
    type,
    color
  };
};

export const updateParticles = (particles: Particle[], ctx: CanvasRenderingContext2D): Particle[] => {
  ctx.globalCompositeOperation = 'lighter';
  const remaining = particles.filter(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.01 + Math.random() * 0.02;
    
    if (p.life > 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    
    return p.life > 0;
  });
  ctx.globalCompositeOperation = 'source-over';
  return remaining;
};
