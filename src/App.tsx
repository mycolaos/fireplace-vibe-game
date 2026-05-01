/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { 
  INITIAL_INTENSITY, 
  MAX_INTENSITY, 
  INTENSITY_DECAY_BASE, 
  SMOKE_DECAY, 
  CABIN_HIT_RADIUS, 
  MAX_STICKS, 
  MAX_LOGS, 
  STICK_REGEN_TIME, 
  LOG_REGEN_TIME,
  DIFFICULTY_INCREMENT
} from './constants';
import { Particle, Wood, GameEvent, UIState } from './types';
import { fireAudio } from './services/audioService';
import { HUD } from './components/HUD';
import { GameOver } from './components/GameOver';
import { Controls } from './components/Controls';
import { VibePortal } from './components/VibePortal';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  // Game State Refs (avoid stale closures in RAF)
  const state = useRef({
    intensity: INITIAL_INTENSITY,
    oxygen: 100,
    smoke: 0,
    wind: 0 as -1 | 0 | 1,
    score: 0,
    lastTick: 0,
    particles: [] as Particle[],
    woods: [] as Wood[],
    stars: [] as { x: number, y: number, size: number, phase: number }[],
    fireflies: [] as { x: number, y: number, phase: number, speed: number, offset: number }[],
    trees: [] as { x: number, y: number, height: number, phase: number }[],
    gameOver: false,
    startTime: 0,
    nextWindChange: 0,
    decayRate: INTENSITY_DECAY_BASE,
    sticks: MAX_STICKS,
    logs: MAX_LOGS,
    stickTimer: 0,
    logTimer: 0,
    currentEvent: 'NONE' as GameEvent,
    eventEndTime: 0,
    nextEventTime: performance.now() + 8000,
  });

  const [uiState, setUiState] = useState<UIState>({
    score: 0,
    intensity: INITIAL_INTENSITY,
    oxygen: 100,
    smoke: 0,
    wind: 0,
    gameOver: false,
    sticks: MAX_STICKS,
    logs: MAX_LOGS,
    currentEvent: 'NONE',
  });

  const [highScore, setHighScore] = useState<number>(0);
  const highScoreRef = useRef<number>(0);

  // Initialize high score from local storage
  useEffect(() => {
    const saved = localStorage.getItem('fireplace_highscore');
    if (saved) {
      const val = parseInt(saved, 10);
      setHighScore(val);
      highScoreRef.current = val;
    }
  }, []);

  const [isPressing, setIsPressing] = useState(false);
  const pressStartTime = useRef<number | null>(null);
  const [logCharge, setLogCharge] = useState(0);

  // --- Particle Helpers ---
  const spawnParticle = (type: 'fire' | 'smoke', x: number, y: number, wind: number, intensity: number) => {
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

  const restart = () => {
    state.current = {
      ...state.current,
      intensity: INITIAL_INTENSITY,
      oxygen: 100,
      smoke: 0,
      wind: 0,
      score: 0,
      lastTick: performance.now(),
      particles: [],
      woods: [],
      gameOver: false,
      startTime: performance.now(),
      nextWindChange: performance.now() + 5000,
      decayRate: INTENSITY_DECAY_BASE,
      sticks: MAX_STICKS,
      logs: MAX_LOGS,
      stickTimer: 0,
      logTimer: 0,
      currentEvent: 'NONE',
      eventEndTime: 0,
      nextEventTime: performance.now() + 8000,
    };
    setUiState({
      score: 0,
      intensity: INITIAL_INTENSITY,
      oxygen: 100,
      smoke: 0,
      wind: 0,
      gameOver: false,
      sticks: MAX_STICKS,
      logs: MAX_LOGS,
      currentEvent: 'NONE',
    });
    setLogCharge(0);
  };

  const handleInteraction = useCallback((type: 'stick' | 'log', x: number, y: number) => {
    if (state.current.gameOver) return;
    
    // Resource check
    if (type === 'stick' && state.current.sticks <= 0) return;
    if (type === 'log' && state.current.logs <= 0) return;

    // Initialize audio on first interaction
    fireAudio.init();

    // Event modifiers
    let fuelEfficiency = 1.0;
    if (state.current.currentEvent === 'DAMP_WOOD') fuelEfficiency = 0.4;
    if (state.current.currentEvent === 'PERFECT_AIR') fuelEfficiency = 1.3;

    const fireGainMult = state.current.smoke > 50 ? 0.8 : 1.0;
    
    // Perfect Timing Bonus
    const timingBonus = (state.current.oxygen > 40 && state.current.oxygen < 70) ? 1.25 : 1.0;
    
    // Spatial Bonus (Positioning)
    const canvas = canvasRef.current;
    let spatialBonus = 1.0;
    if (canvas) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height * 0.75;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      // Dynamic range based on fire state
      // Matches the base spread (+/- 15px) plus particle size
      const fireRadius = 15 + (state.current.intensity * 0.4);
      
      if (dist > fireRadius) {
        spatialBonus = 0; // Sticks or logs out of range shouldn't burn
      } else {
        // bonus from 1.0 (at boundary) up to 1.5 (at center)
        spatialBonus = Math.max(1.0, 1.5 - (dist / (fireRadius * 2))); 
      }
    }

    if (type === 'stick') {
      state.current.sticks--;
      const isBurning = spatialBonus > 0;
      if (isBurning) {
        state.current.intensity = Math.min(MAX_INTENSITY, state.current.intensity + 8 * fireGainMult * timingBonus * fuelEfficiency * spatialBonus);
        state.current.smoke += state.current.currentEvent === 'DAMP_WOOD' ? 12 : 5;
      }
      state.current.woods.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        type: 'stick',
        rotation: Math.random() * Math.PI,
        life: 1.0,
        isBurning
      });
    } else {
      state.current.logs--;
      const isBurning = spatialBonus > 0;
      if (isBurning) {
        state.current.intensity = Math.min(MAX_INTENSITY, state.current.intensity + 22 * fireGainMult * timingBonus * fuelEfficiency * spatialBonus);
        state.current.smoke += state.current.currentEvent === 'DAMP_WOOD' ? 35 : 22; 
      }
      state.current.woods.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        type: 'log',
        rotation: Math.random() * Math.PI,
        life: 1.0,
        isBurning
      });
    }
  }, []);

  const handleBlow = useCallback(() => {
    if (state.current.gameOver) return;
    fireAudio.init();
    
    state.current.oxygen = Math.min(100, state.current.oxygen + 20);
    state.current.smoke = Math.max(0, state.current.smoke - 12);
    state.current.intensity = Math.max(0, state.current.intensity - 5);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleBlow();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleBlow]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      if (containerRef.current) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = containerRef.current.clientHeight;
      }
    };
    window.addEventListener('resize', resize);
    resize();

    state.current.lastTick = performance.now();
    state.current.startTime = performance.now();
    state.current.nextWindChange = performance.now() + 5000 + Math.random() * 5000;

    // Initialize Stars
    const starCount = 150;
    const newStars = [];
    for (let i = 0; i < starCount; i++) {
      newStars.push({
        x: Math.random(),
        y: Math.random() * 0.7, // Top 70% of sky
        size: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2
      });
    }
    state.current.stars = newStars;
    
    // Initialize Fireflies
    const fireflies = [];
    for (let i = 0; i < 20; i++) {
      fireflies.push({
        x: Math.random(),
        y: 0.5 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0001 + Math.random() * 0.001,
        offset: Math.random() * 100
      });
    }
    state.current.fireflies = fireflies;

    // Initialize Trees
    const trees = [];
    for (let i = 0; i < 8; i++) {
        trees.push({
            x: 0.1 + Math.random() * 0.8,
            y: 0.75 + Math.random() * 0.1,
            height: 40 + Math.random() * 60,
            phase: Math.random() * Math.PI * 2
        });
    }
    state.current.trees = trees;

    let rafId: number;

    const loop = (time: number) => {
      const dt = (time - state.current.lastTick) / 1000;
      state.current.lastTick = time;

      if (!state.current.gameOver) {
        // --- Difficulty & Systems ---
        const totalTime = (time - state.current.startTime) / 1000;
        state.current.score = Math.floor(totalTime);
        state.current.decayRate = INTENSITY_DECAY_BASE + Math.floor(totalTime / 10) * DIFFICULTY_INCREMENT;

        // Resource Regeneration
        if (state.current.sticks < MAX_STICKS) {
          state.current.stickTimer += dt * 1000;
          if (state.current.stickTimer >= STICK_REGEN_TIME) {
            state.current.sticks++;
            state.current.stickTimer = 0;
          }
        }
        if (state.current.logs < MAX_LOGS) {
          state.current.logTimer += dt * 1000;
          if (state.current.logTimer >= LOG_REGEN_TIME) {
            state.current.logs++;
            state.current.logTimer = 0;
          }
        }

        // Random Event System
        if (time > state.current.nextEventTime && state.current.currentEvent === 'NONE') {
          const events: GameEvent[] = ['WIND_GUST', 'DAMP_WOOD', 'PERFECT_AIR'];
          state.current.currentEvent = events[Math.floor(Math.random() * events.length)];
          state.current.eventEndTime = time + 5000 + Math.random() * 5000;
        }

        if (state.current.currentEvent !== 'NONE' && time > state.current.eventEndTime) {
          state.current.currentEvent = 'NONE';
          state.current.nextEventTime = time + 8000 + Math.random() * 7000;
        }

        // Apply Event Logic
        if (state.current.currentEvent === 'WIND_GUST') {
          state.current.oxygen += 15 * dt;
          state.current.intensity -= 0.5 * dt;
          // Forced wind direction if gusting
          if (Math.random() > 0.95) state.current.wind = (Math.random() > 0.5 ? 1 : -1);
        } else if (state.current.currentEvent === 'PERFECT_AIR') {
          state.current.oxygen = Math.min(100, state.current.oxygen + 10 * dt);
        }

        // Wind System (normal behavior)
        if (state.current.currentEvent === 'NONE' && time > state.current.nextWindChange) {
          state.current.wind = (Math.floor(Math.random() * 3) - 1) as -1 | 0 | 1;
          state.current.nextWindChange = time + 5000 + Math.random() * 5000;
        }

        // --- Oxygen System ---
        // Constant consumption: base rate + intensity-based drain
        const consumptionMult = state.current.currentEvent === 'PERFECT_AIR' ? 0.5 : 1.0;
        const oxygenConsumption = (3 + state.current.intensity * 0.08) * consumptionMult * dt;
        state.current.oxygen -= oxygenConsumption;

        // Passive recovery (natural draft)
        state.current.oxygen += 4 * dt;

        // Smoke blocks oxygen flow
        if (state.current.smoke > 40) {
          state.current.oxygen -= 12 * dt;
        }
        state.current.oxygen = Math.max(0, Math.min(100, state.current.oxygen));

        // --- Intensity Impact ---
        // Oxygen Impact on intensity
        if (state.current.oxygen < 30) {
          state.current.intensity -= 2.0 * dt; // Choking
        } else if (state.current.oxygen > 60) {
          state.current.intensity += 0.3 * dt; // Healthy burn
        }

        // Intensity Decay (Faster at low intensity - Critical State)
        let effectiveDecay = state.current.decayRate;
        if (state.current.intensity < 20) effectiveDecay *= 2.0;
        
        state.current.intensity -= effectiveDecay * dt;
        if (state.current.wind !== 0) {
          state.current.intensity -= 0.2 * dt;
        }
        
        if (state.current.intensity <= 0 || state.current.oxygen <= 0) {
          state.current.intensity = Math.max(0, state.current.intensity);
          state.current.gameOver = true;
          
          // Save high score
          if (state.current.score > highScoreRef.current) {
            highScoreRef.current = state.current.score;
            setHighScore(state.current.score);
            localStorage.setItem('fireplace_highscore', state.current.score.toString());
          }
        }

        // Smoke Decay
        state.current.smoke = Math.max(0, state.current.smoke - SMOKE_DECAY * dt);

        // Update UI every few frames
        if (Math.random() > 0.8) {
          setUiState({
            score: state.current.score,
            intensity: state.current.intensity,
            oxygen: state.current.oxygen,
            smoke: state.current.smoke,
            wind: state.current.wind,
            gameOver: state.current.gameOver,
            sticks: state.current.sticks,
            logs: state.current.logs,
            currentEvent: state.current.currentEvent,
          });
        }
        
        // Update Audio
        fireAudio.update(state.current.intensity, isMuted);
      } else {
        setUiState(prev => ({ ...prev, gameOver: true }));
        fireAudio.update(0, isMuted);
      }

      // --- Rendering ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const horizonY = canvas.height * 0.55;
      const centerX = canvas.width / 2;
      const centerY = canvas.height * 0.75;

      // 1. Sky Gradient (Deep Midnight)
      const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGradient.addColorStop(0, '#020205');
      skyGradient.addColorStop(1, '#0a0a1a');
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, canvas.width, horizonY);

      // 1.2 Ground (Dark Desert/Floor)
      const groundGradient = ctx.createLinearGradient(0, horizonY, 0, canvas.height);
      groundGradient.addColorStop(0, '#0a0714'); // Closer to horizon
      groundGradient.addColorStop(1, '#05020a'); // Towards viewer
      ctx.fillStyle = groundGradient;
      ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

      // 1.5 Moon
      const moonX = canvas.width * 0.20;
      const moonY = canvas.height * 0.20;
      ctx.save();
      ctx.shadowBlur = 40;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
      ctx.fillStyle = '#fefce8';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 30, 0, Math.PI * 2);
      ctx.fill();
      // Moon crater/shadow effect
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(moonX + 10, moonY - 5, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Stars (with twinkle)
      ctx.fillStyle = 'white';
      state.current.stars.forEach(s => {
        const twinkle = Math.sin(time * 0.002 + s.phase) * 0.5 + 0.5;
        ctx.globalAlpha = 0.3 + twinkle * 0.7;
        ctx.beginPath();
        // Keep stars above horizon
        ctx.arc(s.x * canvas.width, s.y * horizonY * 0.9, s.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // 3. Distant Dunes Silhouette (sitting on horizon)
      const drawDune = (height: number, color: string, offset: number) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, horizonY + 20);
        for(let x = 0; x <= canvas.width; x += 10) {
          const y = horizonY - height + Math.sin(x * 0.005 + offset) * 20;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(canvas.width, horizonY + 20);
        ctx.fill();
      };
      drawDune(60, '#0a0514', 1); // Furthest
      drawDune(30, '#0d071a', 5);  // Mid
      
      // 3.5 Distant Cabin (drawn after dunes to be visible)
      const cabinX = canvas.width * 0.8;
      const cabinY = horizonY - 15 + Math.sin(cabinX * 0.005 + 1) * 5;
      ctx.fillStyle = '#05020a';
      ctx.beginPath();
      // Slightly larger cabin
      ctx.moveTo(cabinX - 20, cabinY);
      ctx.lineTo(cabinX - 20, cabinY - 15);
      ctx.lineTo(cabinX, cabinY - 25);
      ctx.lineTo(cabinX + 20, cabinY - 15);
      ctx.lineTo(cabinX + 20, cabinY);
      ctx.closePath();
      ctx.fill();
      
      // Chimney
      ctx.fillRect(cabinX + 8, cabinY - 22, 5, -8);
      // Chimney Smoke
      const smokeFlick = (time * 0.001) % 1;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.15 * (1 - smokeFlick)})`;
      ctx.beginPath();
      ctx.arc(cabinX + 10 + Math.sin(time * 0.005) * 5, cabinY - 30 - smokeFlick * 20, 4 + smokeFlick * 6, 0, Math.PI * 2);
      ctx.fill();

      // Flickering window
      const flick = Math.sin(time * 0.01) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(255, 200, 50, ${flick * 0.8})`;
      ctx.fillRect(cabinX - 5, cabinY - 10, 10, 8);
      ctx.shadowBlur = 15 * flick;
      ctx.shadowColor = 'orange';
      ctx.strokeRect(cabinX - 5, cabinY - 10, 10, 8);
      ctx.shadowBlur = 0;

      // 3.6 Swaying Trees (placed near the horizon line)
      state.current.trees.forEach(t => {
          const sway = Math.sin(time * 0.001 + t.phase) * 0.05;
          ctx.save();
          // Adjust t.y to be relative to horizon
          const treeY = horizonY + (t.y - 0.75) * 100;
          ctx.translate(t.x * canvas.width, treeY);
          ctx.rotate(sway);
          ctx.fillStyle = '#05020a';
          // Trunk
          ctx.fillRect(-2, 0, 4, -t.height);
          // Leaves (Multi-layered pine)
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

      // 5. Fire Glow (Enhanced and reactive to ground)
      const intensityNorm = state.current.intensity / 100;
      
      // Ground-specific illumination (Local to fireplace)
      const groundGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 300 * intensityNorm);
      groundGlow.addColorStop(0, `rgba(255, 80, 0, ${0.2 * intensityNorm})`);
      groundGlow.addColorStop(0.5, `rgba(150, 40, 0, ${0.1 * intensityNorm})`);
      groundGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = groundGlow;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 300 * intensityNorm, 100 * intensityNorm, 0, 0, Math.PI * 2);
      ctx.fill();

      const bgGrade = ctx.createRadialGradient(
        centerX, centerY, 
        10, 
        centerX, centerY, 
        150 + state.current.intensity * 3.5
      );
      
      bgGrade.addColorStop(0, `rgba(255, 120, 40, ${intensityNorm * 0.25})`);
      bgGrade.addColorStop(0.4, `rgba(180, 60, 20, ${intensityNorm * 0.15})`);
      bgGrade.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = bgGrade;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';

      // 5.5 Fireflies
      ctx.save();
      ctx.shadowBlur = 8;
      state.current.fireflies.forEach(f => {
          const x = (f.x * canvas.width) + Math.sin(time * f.speed + f.phase) * 30;
          const y = (f.y * canvas.height) + Math.cos(time * f.speed + f.phase) * 30;
          const flick = Math.sin(time * 0.005 + f.offset) * 0.5 + 0.5;
          ctx.shadowColor = '#d4d4d8';
          ctx.fillStyle = `rgba(187, 247, 208, ${flick * 0.8})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
      });
      ctx.restore();

      // Draw Wood
      state.current.woods = state.current.woods.filter(w => {
        const decayRate = w.isBurning ? 0.15 : 0.05;
        w.life -= decayRate * dt;
        
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(w.rotation);
        
        // Base Wood Color
        ctx.fillStyle = w.type === 'log' ? '#5d4037' : '#8d6e63';
        
        // Glow Effect for Burning Wood
        if (w.isBurning) {
          const pulsate = Math.sin(time * 0.01 + w.x) * 0.2 + 0.8;
          ctx.shadowBlur = 10 * pulsate * w.life;
          ctx.shadowColor = '#ff5500';
          // Ember logic: color shifts to glowing orange as it burns
          ctx.fillStyle = `rgb(${80 + 175 * pulsate}, ${40 + 80 * pulsate}, 20)`;
        }

        const w_width = w.type === 'log' ? 40 : 20;
        const w_height = w.type === 'log' ? 12 : 5;
        ctx.fillRect(-w_width / 2, -w_height / 2, w_width, w_height);
        
        // Embers/Sparks on burning wood
        if (w.isBurning && Math.random() > 0.95) {
           const sx = (Math.random() - 0.5) * w_width;
           const sy = (Math.random() - 0.5) * w_height;
           ctx.fillStyle = '#fff';
           ctx.fillRect(sx, sy, 2, 2);
        }

        ctx.restore();
        return w.life > 0 || state.current.intensity > 0;
      });

      // Spawn Particles
      if (!state.current.gameOver && state.current.intensity > 0) {
        const pCount = Math.floor(state.current.intensity / 20) + 1;
        for (let i = 0; i < pCount; i++) {
          state.current.particles.push(spawnParticle('fire', centerX + (Math.random() - 0.5) * 30, centerY, state.current.wind, state.current.intensity));
        }
        if (state.current.smoke > 10 && Math.random() < state.current.smoke / 200) {
          state.current.particles.push(spawnParticle('smoke', centerX + (Math.random() - 0.5) * 40, centerY - 20, state.current.wind, state.current.intensity));
        }
      }

      // Update & Draw Particles
      ctx.globalCompositeOperation = 'lighter';
      state.current.particles = state.current.particles.filter(p => {
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

      // Smoke overlay logic
      if (state.current.smoke > 50) {
        ctx.fillStyle = `rgba(50, 50, 50, ${Math.min(0.6, (state.current.smoke - 50) / 100)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Critical State Vignette
      if (state.current.intensity < 25) {
        const critFactor = 1 - (state.current.intensity / 25);
        const vig = ctx.createRadialGradient(centerX, centerY, 100, centerX, centerY, canvas.width);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, `rgba(0,0,0, ${0.8 * critFactor})`);
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [isMuted]);

  const [hoveringCabin, setHoveringCabin] = useState(false);

  const checkCabinHit = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const horizonY = canvas.height * 0.55;
    const cabinX = canvas.width * 0.8;
    const cabinY = horizonY - 15 + Math.sin(cabinX * 0.005 + 1) * 5;
    const dist = Math.sqrt((x - cabinX) ** 2 + (y - cabinY) ** 2);
    return dist < CABIN_HIT_RADIUS;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = checkCabinHit(x, y);
    if (hit !== hoveringCabin) {
      setHoveringCabin(hit);
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (state.current.gameOver) return;
    
    // Check for cabin click
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (checkCabinHit(x, y)) {
        window.location.href = 'https://vibej.am/portal/2026';
        return;
      }
    }

    setIsPressing(true);
    pressStartTime.current = performance.now();
  }, [hoveringCabin]);

  const handleMouseUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isPressing || state.current.gameOver) return;
    
    const duration = performance.now() - (pressStartTime.current || 0);
    const canvas = canvasRef.current;
    if (!canvas) return;

    let clientX, clientY;
    if ('changedTouches' in e) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (duration > 600) {
      handleInteraction('log', x, y);
    } else {
      handleInteraction('stick', x, y);
    }

    setIsPressing(false);
    pressStartTime.current = null;
    setLogCharge(0);
  }, [isPressing, handleInteraction]);

  // Track charge progress
  useEffect(() => {
    let interval: number;
    if (isPressing) {
      interval = window.setInterval(() => {
        const duration = performance.now() - (pressStartTime.current || 0);
        setLogCharge(Math.min(100, (duration / 600) * 100));
      }, 16);
    }
    return () => clearInterval(interval);
  }, [isPressing]);

  return (
    <div 
      id="game-root"
      ref={containerRef}
      className={`relative w-full h-screen bg-[#0a0a0f] overflow-hidden font-sans select-none touch-none ${hoveringCabin ? 'cursor-pointer' : 'cursor-crosshair'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* --- Cabin Tooltip --- */}
      <VibePortal isVisible={hoveringCabin} />

      {/* --- HUD (Score, Oxygen, Resources, Events) --- */}
      <HUD uiState={uiState} />

      {/* --- Mute Toggle --- */}
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
          className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors pointer-events-auto"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>
      </div>

      {/* --- Controls (Blow, Charge) --- */}
      <Controls 
        uiState={uiState} 
        isPressing={isPressing} 
        logCharge={logCharge} 
        handleBlow={handleBlow} 
      />

      {/* --- Game Over --- */}
      <GameOver 
        uiState={uiState} 
        highScore={highScore} 
        onRestart={restart} 
      />

      {/* --- Ambient Vibes --- */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
    </div>
  );
}
