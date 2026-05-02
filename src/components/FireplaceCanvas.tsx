/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { 
  INITIAL_INTENSITY, 
  MAX_INTENSITY, 
  INTENSITY_DECAY_BASE, 
  SMOKE_DECAY, 
  MAX_STICKS, 
  MAX_LOGS, 
  STICK_REGEN_TIME, 
  LOG_REGEN_TIME,
  DIFFICULTY_INCREMENT,
  WEATHER_MIN_DURATION,
  WEATHER_MAX_DURATION,
  WEATHER_CONFIG,
  DAY_CYCLE_DURATION,
  DECORATION_CONFIG
} from '../constants';
import { GameEvent, UIState, Star, Firefly, Tree, WeatherType } from '../types';
import { fireAudio } from '../services/audioService';
import { spawnParticle, updateParticles } from '../services/particleService';
import * as renderer from '../services/rendererService';

interface FireplaceCanvasProps {
  state: React.MutableRefObject<any>;
  updateUI: () => void;
  isMuted: boolean;
  onGameOver: (score: number) => void;
}

export const FireplaceCanvas: React.FC<FireplaceCanvasProps> = ({ 
  state, 
  updateUI, 
  isMuted,
  onGameOver
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    let rafId: number;

    const loop = (time: number) => {
      // Calculate delta time for frame-independent movement/physics
      const dt = (time - state.current.lastTick) / 1000;
      state.current.lastTick = time;

      // Initialize Game Elements if not done (triggers on start and after restart)
      if (state.current.stars.length === 0) {
        for (let i = 0; i < 150; i++) {
          state.current.stars.push({
            x: Math.random(),
            y: Math.random() * 0.7,
            size: 0.5 + Math.random() * 1.5,
            phase: Math.random() * Math.PI * 2
          });
        }
        for (let i = 0; i < 20; i++) {
          state.current.fireflies.push({
            x: Math.random(),
            y: 0.5 + Math.random() * 0.4,
            phase: Math.random() * Math.PI * 2,
            speed: 0.0001 + Math.random() * 0.001,
            offset: Math.random() * 100
          });
        }
        for (let i = 0; i < DECORATION_CONFIG.TREES.count; i++) {
          state.current.trees.push({
            x: 0.1 + Math.random() * 0.8,
            y: 0.75 + Math.random() * 0.1,
            height: DECORATION_CONFIG.TREES.minHeight + Math.random() * (DECORATION_CONFIG.TREES.maxHeight - DECORATION_CONFIG.TREES.minHeight),
            phase: Math.random() * Math.PI * 2
          });
        }
        for (let i = 0; i < DECORATION_CONFIG.MOUNTAINS.count; i++) {
          state.current.mountains.push({
            x: 0.1 + Math.random() * 0.8,
            y: 0,
            width: DECORATION_CONFIG.MOUNTAINS.minWidth + Math.random() * (DECORATION_CONFIG.MOUNTAINS.maxWidth - DECORATION_CONFIG.MOUNTAINS.minWidth),
            height: DECORATION_CONFIG.MOUNTAINS.minHeight + Math.random() * (DECORATION_CONFIG.MOUNTAINS.maxHeight - DECORATION_CONFIG.MOUNTAINS.minHeight),
            color: Math.random() > 0.5 ? '#05020a' : '#08040d'
          });
        }
        for (let i = 0; i < DECORATION_CONFIG.CLOUDS.count; i++) {
          const puffs = [];
          const puffCount = 3 + Math.floor(Math.random() * 4);
          for (let j = 0; j < puffCount; j++) {
            puffs.push({
              dx: j * 20 - (puffCount * 10),
              dy: (Math.random() - 0.5) * 20,
              radius: 15 + Math.random() * 20
            });
          }

          state.current.clouds.push({
            x: Math.random(),
            y: 50 + Math.random() * 150,
            scale: DECORATION_CONFIG.CLOUDS.minScale + Math.random() * (DECORATION_CONFIG.CLOUDS.maxScale - DECORATION_CONFIG.CLOUDS.minScale),
            speed: DECORATION_CONFIG.CLOUDS.minSpeed + Math.random() * (DECORATION_CONFIG.CLOUDS.maxSpeed - DECORATION_CONFIG.CLOUDS.minSpeed),
            opacity: DECORATION_CONFIG.CLOUDS.minOpacity + Math.random() * (DECORATION_CONFIG.CLOUDS.maxOpacity - DECORATION_CONFIG.CLOUDS.minOpacity),
            threshold: Math.random(),
            puffs
          });
        }
        for (let i = 0; i < DECORATION_CONFIG.ROCKS.count; i++) {
          state.current.rocks.push({
            x: 0.2 + Math.random() * 0.6,
            y: (Math.random() - 0.5) * 60,
            size: DECORATION_CONFIG.ROCKS.minSize + Math.random() * (DECORATION_CONFIG.ROCKS.maxSize - DECORATION_CONFIG.ROCKS.minSize),
            rotation: Math.random() * Math.PI * 2,
            color: Math.random() > 0.5 ? '#0a0a1a' : '#1a1a2a'
          });
        }
        for (let i = 0; i < DECORATION_CONFIG.GRASS.count; i++) {
          state.current.grass.push({
            x: Math.random(),
            y: (Math.random() - 0.5) * 100,
            height: DECORATION_CONFIG.GRASS.minHeight + Math.random() * (DECORATION_CONFIG.GRASS.maxHeight - DECORATION_CONFIG.GRASS.minHeight),
            phase: Math.random() * Math.PI * 2
          });
        }
        for (let i = 0; i < DECORATION_CONFIG.CACTI.count; i++) {
          state.current.cacti.push({
            x: 0.1 + Math.random() * 0.8,
            y: 0.7 + Math.random() * 0.1,
            height: DECORATION_CONFIG.CACTI.minHeight + Math.random() * (DECORATION_CONFIG.CACTI.maxHeight - DECORATION_CONFIG.CACTI.minHeight),
            rotation: (Math.random() - 0.5) * 0.2
          });
        }

        // Initialize with some embers (burning wood)
        const centerX = canvas.width / 2;
        const centerY = canvas.height * 0.75;
        
        // Add a few initial burning logs
        for (let i = 0; i < 3; i++) {
          state.current.woods.push({
            x: centerX + (Math.random() - 0.5) * 50,
            y: centerY + (Math.random() - 0.5) * 20,
            vy: 0,
            targetY: centerY + (Math.random() - 0.5) * 20,
            type: 'log',
            rotation: Math.random() * Math.PI,
            life: 0.5 + Math.random() * 0.5,
            isBurning: true
          });
        }
        // Add a few initial burning sticks
        for (let i = 0; i < 4; i++) {
          state.current.woods.push({
            x: centerX + (Math.random() - 0.5) * 40,
            y: centerY + (Math.random() - 0.5) * 15,
            vy: 0,
            targetY: centerY + (Math.random() - 0.5) * 15,
            type: 'stick',
            rotation: Math.random() * Math.PI,
            life: 0.3 + Math.random() * 0.7,
            isBurning: true
          });
        }
      }

      if (!state.current.gameOver) {
        // --- 1. CORE STATS UPDATE ---
        const totalTime = (time - state.current.startTime) / 1000;
        state.current.score = Math.floor(totalTime);
        
        // Intensity decay gets faster as time goes on (difficulty scaling)
        const weatherMod = WEATHER_CONFIG[state.current.weather].fuelDecay;
        state.current.decayRate = (INTENSITY_DECAY_BASE + Math.floor(totalTime / 10) * DIFFICULTY_INCREMENT) * weatherMod;

        // --- 1.5 DAY CYCLE UPDATE ---
        const cycleDurationSeconds = DAY_CYCLE_DURATION / 1000;
        state.current.cycleProgress = ((totalTime / cycleDurationSeconds) + state.current.initialCycle) % 1.0;

        // --- 2. WEATHER SYSTEM ---
        if (time > state.current.nextWeatherTime) {
          const weathers: WeatherType[] = ['CLEAR', 'WINDY', 'RAINY', 'SNOWY'];
          let nextWeather: WeatherType;
          do {
            nextWeather = weathers[Math.floor(Math.random() * weathers.length)];
          } while (nextWeather === state.current.weather);
          
          state.current.weather = nextWeather;
          const config = WEATHER_CONFIG[nextWeather];
          const randomDuration = (WEATHER_MIN_DURATION + Math.random() * (WEATHER_MAX_DURATION - WEATHER_MIN_DURATION)) * config.durationMult;
          state.current.nextWeatherTime = time + randomDuration;
        }

        // Smoothly transition cloud density and alpha based on weather
        const targetCloudDensity = (WEATHER_CONFIG[state.current.weather] as any).clouds;
        const targetCloudAlpha = (WEATHER_CONFIG[state.current.weather] as any).cloudLikelihood;
        state.current.cloudDensity += (targetCloudDensity - state.current.cloudDensity) * 0.5 * dt;
        state.current.cloudAlpha += (targetCloudAlpha - state.current.cloudAlpha) * 0.5 * dt;

        // --- 3. RESOURCE REGENERATION ---
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

        // --- 3. RANDOM EVENT SYSTEM ---
        // Events happen periodically to alter game dynamics
        if (time > state.current.nextEventTime && state.current.currentEvent === 'NONE') {
          const events: GameEvent[] = ['WIND_GUST', 'DAMP_WOOD', 'PERFECT_AIR'];
          state.current.currentEvent = events[Math.floor(Math.random() * events.length)];
          state.current.eventEndTime = time + 5000 + Math.random() * 5000;
        }

        // Return to normal state after event duration
        if (state.current.currentEvent !== 'NONE' && time > state.current.eventEndTime) {
          state.current.currentEvent = 'NONE';
          state.current.nextEventTime = time + 8000 + Math.random() * 7000;
        }

      // Specific event logic modifiers
      if (state.current.currentEvent === 'WIND_GUST' || state.current.weather === 'WINDY') {
        const factor = state.current.currentEvent === 'WIND_GUST' ? 1.0 : 0.4;
        state.current.oxygen += 10 * factor * dt; // Wind feeds the fire but can scatter embers
        state.current.intensity -= 0.3 * factor * dt;
        if (Math.random() > 0.98) state.current.wind = (Math.random() > 0.5 ? 1 : -1);
      } else if (state.current.currentEvent === 'PERFECT_AIR') {
        state.current.oxygen = Math.min(100, state.current.oxygen + 10 * dt);
      }

        // Normal wind fluctuation
        if (state.current.currentEvent === 'NONE' && time > state.current.nextWindChange) {
          state.current.wind = (Math.floor(Math.random() * 3) - 1) as -1 | 0 | 1;
          state.current.nextWindChange = time + 5000 + Math.random() * 5000;
        }

        // --- 4. FIRE SYSTEMS (OXYGEN & INTENSITY) ---
        // Oxygen is consumed by the fire's intensity
        const consumptionMult = state.current.currentEvent === 'PERFECT_AIR' ? 0.5 : 1.0;
        const oxygenConsumption = (3 + state.current.intensity * 0.08) * consumptionMult * dt;
        state.current.oxygen -= oxygenConsumption;
        state.current.oxygen += 4 * dt; // Passive oxygen recovery
        
        // High smoke levels choke the fire
        if (state.current.smoke > 40) state.current.oxygen -= 12 * dt;
        state.current.oxygen = Math.max(0, Math.min(100, state.current.oxygen));

      // Interaction between Oxygen and Intensity
      const stabilityMod = WEATHER_CONFIG[state.current.weather].tempStability;
      if (state.current.oxygen < 30) state.current.intensity -= (2.0 / stabilityMod) * dt; // Choking
      else if (state.current.oxygen > 60) state.current.intensity += 0.3 * stabilityMod * dt; // Thriving

        // Apply decay to Intensity
        let effectiveDecay = state.current.decayRate;
        if (state.current.intensity < 20) effectiveDecay *= 2.0; // Faster decay when fire is small
        state.current.intensity -= effectiveDecay * dt;
        if (state.current.wind !== 0) state.current.intensity -= 0.2 * dt;
        
        // GAME OVER CHECK
        if (state.current.intensity <= 0 || state.current.oxygen <= 0) {
          state.current.intensity = Math.max(0, state.current.intensity);
          state.current.gameOver = true;
          onGameOver(state.current.score);
        }

        // Smoke slowly fades
        state.current.smoke = Math.max(0, state.current.smoke - SMOKE_DECAY * dt);

        // --- COMET LOGIC ---
        if (!state.current.comet.active && Math.random() < DECORATION_CONFIG.COMET.chance) {
          state.current.comet = {
            active: true,
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height * 0.3),
            vx: DECORATION_CONFIG.COMET.minVx + Math.random() * (DECORATION_CONFIG.COMET.maxVx - DECORATION_CONFIG.COMET.minVx),
            vy: DECORATION_CONFIG.COMET.minVy + Math.random() * (DECORATION_CONFIG.COMET.maxVy - DECORATION_CONFIG.COMET.minVy),
            life: 1.0
          };
        }
        if (state.current.comet.active) {
          state.current.comet.x += state.current.comet.vx * dt;
          state.current.comet.y += state.current.comet.vy * dt;
          state.current.comet.life -= DECORATION_CONFIG.COMET.decayTime * dt;
          if (state.current.comet.life <= 0 || state.current.comet.x > canvas.width || state.current.comet.y > canvas.height) {
            state.current.comet.active = false;
          }
        }

        // Throttle UI state updates for performance
        if (Math.random() > 0.8) updateUI();
        
        // Update audio based on new intensity
        fireAudio.update(state.current.intensity, isMuted);
      } else {
        updateUI();
        fireAudio.update(0, isMuted);
      }

      // --- RENDERING PIPELINE ---
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const horizonY = canvas.height * 0.55;
      const centerX = canvas.width / 2;
      const centerY = canvas.height * 0.75;

      // Layered Drawing
      renderer.drawSky(ctx, canvas.width, horizonY, state.current.cycleProgress);
      renderer.drawClouds(ctx, state.current.clouds, canvas.width, time, state.current.cloudDensity, state.current.cloudAlpha);
      renderer.drawGround(ctx, canvas.width, canvas.height, horizonY, state.current.cycleProgress);
      renderer.drawMoon(ctx, canvas.width, canvas.height, state.current.cycleProgress);
      if (state.current.weather === 'CLEAR' || state.current.weather === 'WINDY') {
        renderer.drawStars(ctx, state.current.stars, canvas.width, horizonY, time, state.current.cycleProgress);
      }
      renderer.drawComet(ctx, state.current.comet);
      renderer.drawMountains(ctx, state.current.mountains, canvas.width, horizonY);
      renderer.drawDunes(ctx, canvas.width, horizonY);
      renderer.drawRocks(ctx, state.current.rocks, canvas.width, horizonY);
      renderer.drawCabin(ctx, canvas.width, horizonY, time);
      renderer.drawTrees(ctx, state.current.trees, canvas.width, horizonY, time);
      renderer.drawCacti(ctx, state.current.cacti, canvas.width, horizonY);
      renderer.drawGrass(ctx, state.current.grass, canvas.width, horizonY, time);
      
      renderer.drawWeatherOverlay(ctx, state.current.weather, canvas.width, canvas.height);

      // Fire Glow (Ground and Air illumination)
      renderer.drawGlow(ctx, centerX, centerY, state.current.intensity, canvas.width, canvas.height);
      
      renderer.drawFireflies(ctx, state.current.fireflies, canvas.width, canvas.height, time);
      
      // Render Wood and update life cycles
      state.current.woods = renderer.drawWoods(ctx, state.current.woods, dt, state.current.intensity, time);

      // --- EMITTER SYSTEM: Particles (Fire, Smoke, & Weather) ---
      if (!state.current.gameOver) {
        if (state.current.intensity > 0) {
          const pCount = Math.floor(state.current.intensity / 20) + 1;
          for (let i = 0; i < pCount; i++) {
            state.current.particles.push(spawnParticle('fire', centerX + (Math.random() - 0.5) * 30, centerY, state.current.wind, state.current.intensity));
          }
          if (state.current.smoke > 10 && Math.random() < state.current.smoke / 200) {
            state.current.particles.push(spawnParticle('smoke', centerX + (Math.random() - 0.5) * 40, centerY - 20, state.current.wind, state.current.intensity));
          }
        }

        // Spawn Weather Particles
        if (state.current.weather === 'RAINY') {
          for (let i = 0; i < 5; i++) {
            state.current.particles.push(spawnParticle('rain', Math.random() * canvas.width, -10, state.current.wind, state.current.intensity));
          }
        } else if (state.current.weather === 'SNOWY') {
          if (Math.random() > 0.6) {
             state.current.particles.push(spawnParticle('snow', Math.random() * canvas.width, -10, state.current.wind, state.current.intensity));
          }
        }
      }
      
      // Physics Update and Render for all particles
      state.current.particles = updateParticles(state.current.particles, ctx);

      // --- POST-PROCESSING: Atmospheric Effects ---
      // Smoke Overlay
      if (state.current.smoke > 50) {
        ctx.fillStyle = `rgba(50, 50, 50, ${Math.min(0.6, (state.current.smoke - 50) / 100)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Critical Low Fire Vignette
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
  }, [isMuted, updateUI, onGameOver]);

  return <canvas ref={canvasRef} className="absolute inset-0 block" />;
};
