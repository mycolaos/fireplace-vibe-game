/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Logs as LogIcon, Wind, Timer as TimerIcon, RotateCcw, Volume2, VolumeX } from 'lucide-react';

// --- Constants ---
const INITIAL_INTENSITY = 50;
const MAX_INTENSITY = 100;
const INTENSITY_DECAY_BASE = 0.8;
const SMOKE_DECAY = 0.5;
const DIFFICULTY_INTERVAL = 10000; // 10 seconds
const DIFFICULTY_INCREMENT = 0.15;
const CABIN_HIT_RADIUS = 45;

// --- Audio Class ---
class FireAudio {
  ctx: AudioContext | null = null;
  gainNode: GainNode | null = null;
  noiseFilter: BiquadFilterNode | null = null;
  isMuted: boolean = false;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
    this.gainNode.gain.value = 0;

    // Create a noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Noise Source
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Main Rumble (Low-end 'roar' of fire)
    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = 'lowpass';
    this.noiseFilter.frequency.value = 250;
    this.noiseFilter.Q.value = 0.5;

    noise.connect(this.noiseFilter);
    this.noiseFilter.connect(this.gainNode);
    noise.start();

    // Crackle Loop - refined for sharper 'pops'
    this.scheduleCrackle();
  }

  scheduleCrackle() {
    if (!this.ctx || !this.gainNode) return;
    
    const baseVol = this.gainNode.gain.value;
    // Only crackle if there's significant heat
    if (baseVol > 0.02 && Math.random() < 0.4) {
      // Use noise burst followed by resonant filter for a 'pop'
      const burstSize = this.ctx.sampleRate * 0.01; // very short
      const burstBuffer = this.ctx.createBuffer(1, burstSize, this.ctx.sampleRate);
      const data = burstBuffer.getChannelData(0);
      for (let i = 0; i < burstSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / burstSize);
      }

      const source = this.ctx.createBufferSource();
      source.buffer = burstBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000 + Math.random() * 3000;
      filter.Q.value = 2;

      const g = this.ctx.createGain();
      g.gain.value = (0.2 + Math.random() * 0.4) * baseVol;

      source.connect(filter);
      filter.connect(g);
      g.connect(this.ctx.destination);
      
      source.start();
    }

    setTimeout(() => this.scheduleCrackle(), 30 + Math.random() * 400);
  }

  update(intensity: number, muted: boolean) {
    if (!this.ctx || !this.gainNode) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    // Mute/Unmute logic
    const targetGain = muted ? 0 : (intensity / 100) * 0.18;
    this.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.2);
    
    // Low-end roar frequency moves with size
    if (this.noiseFilter) {
      const freq = 100 + (intensity * 1.5);
      this.noiseFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.5);
    }
  }
}

const fireAudio = new FireAudio();

// --- Types ---
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number; // 0 to 1
  type: 'fire' | 'smoke';
  color: string;
}

interface Wood {
  x: number;
  y: number;
  type: 'stick' | 'log';
  rotation: number;
  life: number;
}

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
  });

  const [uiState, setUiState] = useState({
    score: 0,
    intensity: INITIAL_INTENSITY,
    oxygen: 100,
    smoke: 0,
    wind: 0,
    gameOver: false,
  });

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
    };
    setUiState({
      score: 0,
      intensity: INITIAL_INTENSITY,
      oxygen: 100,
      smoke: 0,
      wind: 0,
      gameOver: false,
    });
    setLogCharge(0);
  };

  const handleInteraction = useCallback((type: 'stick' | 'log', x: number, y: number) => {
    if (state.current.gameOver) return;
    
    // Initialize audio on first interaction
    fireAudio.init();

    const fireGainMult = state.current.smoke > 50 ? 0.9 : 1.0;
    
    // Perfect Timing Bonus
    const timingBonus = (state.current.oxygen > 40 && state.current.oxygen < 70) ? 1.25 : 1.0;
    
    if (type === 'stick') {
      state.current.intensity = Math.min(MAX_INTENSITY, state.current.intensity + 8 * fireGainMult * timingBonus);
      state.current.smoke += 5;
      state.current.woods.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        type: 'stick',
        rotation: Math.random() * Math.PI,
        life: 1.0
      });
    } else {
      state.current.intensity = Math.min(MAX_INTENSITY, state.current.intensity + 20 * fireGainMult * timingBonus);
      state.current.smoke += 22; // Increased smoke for logs
      state.current.woods.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 40,
        type: 'log',
        rotation: Math.random() * Math.PI,
        life: 1.0
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

        // Wind System
        if (time > state.current.nextWindChange) {
          state.current.wind = (Math.floor(Math.random() * 3) - 1) as -1 | 0 | 1;
          state.current.nextWindChange = time + 5000 + Math.random() * 5000;
        }

        // --- Oxygen System ---
        // Constant consumption: base rate + intensity-based drain
        const oxygenConsumption = (3 + state.current.intensity * 0.08) * dt;
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

        // Intensity Decay
        state.current.intensity -= state.current.decayRate * dt;
        if (state.current.wind !== 0) {
          state.current.intensity -= 0.2 * dt;
        }
        
        if (state.current.intensity <= 0 || state.current.oxygen <= 0) {
          state.current.intensity = Math.max(0, state.current.intensity);
          state.current.gameOver = true;
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
        w.life -= 0.05 * dt;
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(w.rotation);
        ctx.fillStyle = w.type === 'log' ? '#5d4037' : '#8d6e63';
        const w_width = w.type === 'log' ? 40 : 20;
        const w_height = w.type === 'log' ? 12 : 5;
        ctx.fillRect(-w_width / 2, -w_height / 2, w_width, w_height);
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

    // Center spawn since logic focuses on main fire area
    const spawnX = canvas.width / 2;
    const spawnY = canvas.height * 0.75;

    if (duration > 600) {
      handleInteraction('log', spawnX, spawnY);
    } else {
      handleInteraction('stick', spawnX, spawnY);
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
      <AnimatePresence>
        {hoveringCabin && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute z-50 pointer-events-none backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded bg-black/40 border border-white/10 shadow-lg whitespace-nowrap"
            style={{ 
              right: '10%', 
              top: '40%',
              transform: 'translate(-50%, -100%)'
            }}
          >
            Vibe portal
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- HUD --- */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-none">
        <div className="flex justify-end items-center gap-3 text-white shadow-2xl">
          <TimerIcon className="w-5 h-5" />
          <span className="font-bold tracking-widest font-mono">
            {String(uiState.score).padStart(3, '0')}s
          </span>
        </div>
      </div>

      {/** Oxygen */}
      <div className="absolute bottom-10 left-6 right-6 flex gap-4 pointer-events-none">
        <div className="w-full flex flex-col gap-2">
           <div className="flex gap-1 items-center px-1 text-[10px]">
             <span className="uppercase font-bold text-sky-400/60 tracking-tighter">Oxygen</span>
             <Wind className="w-3 h-3 text-sky-400" />
             {uiState.smoke > 20 &&  <span className="ml-auto text-gray-300">Smoke Level: {Math.floor(uiState.smoke)}%</span>}
           </div>
           <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className={`h-full ${uiState.oxygen < 30 ? 'bg-red-400' : 'bg-sky-400'}`}
                animate={{ width: `${uiState.oxygen}%` }}
                transition={{ type: 'spring', stiffness: 50 }}
              />
           </div>
        </div>
      </div>

      <div className="absolute top-6 right-6 flex items-center gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
          className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors pointer-events-auto"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>
      </div>

      {/** State log */}
      <div className="absolute bottom-80 left-1/2 -translate-x-1/2 ">
        <AnimatePresence mode="wait">
            {uiState.wind !== 0 && (
              <motion.div 
                key={uiState.wind}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/10 pointer-events-none"
              >
                <Wind className={`w-5 h-5 text-sky-300 ${uiState.wind === -1 ? 'rotate-180' : ''}`} />
                <span className="text-xs font-bold text-white/80">
                  {uiState.wind === 1 ? 'East Breeze' : 'West Breeze'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
      </div>

      {/* --- Controls--- */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 pointer-events-none">
        {isPressing && (
          <div className="flex flex-col items-center gap-2 mb-4">
            <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
               <div className="h-full bg-white transition-all" style={{ width: `${logCharge}%` }} />
            </div>
            <span className="text-[10px] text-white/60 uppercase font-black tracking-[0.2em]">Charging Log</span>
          </div>
        )}
        
        {!uiState.gameOver && (
          <div className="flex flex-col items-center gap-6">
            <button
              onMouseDown={(e) => { e.stopPropagation(); handleBlow(); }}
              onTouchStart={(e) => { e.stopPropagation(); handleBlow(); }}
              className="group pointer-events-auto flex items-center gap-3 bg-white/5 hover:bg-white/10 active:scale-95 px-6 py-3 rounded-full border border-white/10 transition-all backdrop-blur-md"
            >
              <Wind className="w-5 h-5 text-sky-400 group-hover:animate-bounce" />
              <div className="flex flex-col items-start">
                <span className="text-xs font-black text-white uppercase tracking-widest">Blow Air</span>
                <span className="text-[9px] text-white/40 uppercase font-bold">[Spacebar]</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* --- Game Over --- */}
      <AnimatePresence>
        {uiState.gameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 text-center pointer-events-auto"
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="p-12"
            >
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                  <Flame className="w-10 h-10 text-red-500/40" />
                </div>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tighter">
                {uiState.oxygen <= 0 ? "You Suffocated" : "The Fire Went Out"}
              </h2>
              <p className="text-white/40 mb-10 text-lg">You kept the night at bay for {uiState.score} seconds.</p>
              
              <button 
                onClick={(e) => { e.stopPropagation(); restart(); }}
                className="group relative px-10 py-4 bg-white text-black font-bold rounded-2xl flex items-center gap-3 mx-auto transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <div className="absolute inset-0 bg-white blur-lg opacity-0 group-hover:opacity-40 transition-opacity rounded-2xl" />
                <span className="relative">Light it again</span>
                <RotateCcw className="relative w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Ambient Vibes --- */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
    </div>
  );
}
