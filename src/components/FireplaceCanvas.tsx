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
  DAY_CYCLE_DURATION
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

    // Initialize Game Elements if not done
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
      for (let i = 0; i < 8; i++) {
        state.current.trees.push({
          x: 0.1 + Math.random() * 0.8,
          y: 0.75 + Math.random() * 0.1,
          height: 40 + Math.random() * 60,
          phase: Math.random() * Math.PI * 2
        });
      }
    }

    let rafId: number;

    const loop = (time: number) => {
      // Calculate delta time for frame-independent movement/physics
      const dt = (time - state.current.lastTick) / 1000;
      state.current.lastTick = time;

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
          const randomDuration = WEATHER_MIN_DURATION + Math.random() * (WEATHER_MAX_DURATION - WEATHER_MIN_DURATION);
          state.current.nextWeatherTime = time + randomDuration;
        }

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
      renderer.drawGround(ctx, canvas.width, canvas.height, horizonY, state.current.cycleProgress);
      renderer.drawMoon(ctx, canvas.width, canvas.height, state.current.cycleProgress);
      if (state.current.weather === 'CLEAR' || state.current.weather === 'WINDY') {
        renderer.drawStars(ctx, state.current.stars, canvas.width, horizonY, time, state.current.cycleProgress);
      }
      renderer.drawDunes(ctx, canvas.width, horizonY);
      renderer.drawCabin(ctx, canvas.width, horizonY, time);
      renderer.drawTrees(ctx, state.current.trees, canvas.width, horizonY, time);
      
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
