/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const INITIAL_INTENSITY = 50;
export const MAX_INTENSITY = 100;
export const INTENSITY_DECAY_BASE = 0.8;
export const SMOKE_DECAY = 0.5;
export const DIFFICULTY_INTERVAL = 10000; // 10 seconds
export const DIFFICULTY_INCREMENT = 0.15;
export const CABIN_HIT_RADIUS = 45;

export const MAX_STICKS = 15;
export const MAX_LOGS = 5;
export const STICK_REGEN_TIME = 3000; // 3s per stick
export const LOG_REGEN_TIME = 8000; // 8s per log

export const WEATHER_MIN_DURATION = 15000; // 15s
export const WEATHER_MAX_DURATION = 45000; // 45s

export const DAY_CYCLE_DURATION = 24 * 60 * 1000; // 24 minutes for a full cycle
export const CYCLE_START_DUSK = 0.0;
export const CYCLE_START_NIGHT = 0.4;
export const CYCLE_START_DAWN = 0.7;
export const DEFAULT_CYCLE_START = CYCLE_START_NIGHT;

export const SKY_COLORS = {
  DUSK: { top: '#1a0b2e', bottom: '#e96443' },
  NIGHT: { top: '#020205', bottom: '#0a0a1a' },
  DAWN: { top: '#7474bf', bottom: '#348ac7' }
};

export const MOON_POSITION_CONFIG = {
  startX: 0, // Start X position as % of width
  endX: 0.8,   // End X position as % of width
  baseY: 0.25, // Base Y position as % of height
  arcHeight: 0.15 // Height of the orbital arc as % of height
};

export const WEATHER_CONFIG = {
  CLEAR: { fuelDecay: 1.0, tempStability: 1.0, visibility: 1.0, durationMult: 1.5, clouds: 0.1, cloudLikelihood: 0.1 },
  WINDY: { fuelDecay: 1.4, tempStability: 0.8, visibility: 0.9, durationMult: 1.0, clouds: 0.5, cloudLikelihood: 0.4 },
  RAINY: { fuelDecay: 1.8, tempStability: 0.6, visibility: 0.7, durationMult: 0.8, clouds: 1.0, cloudLikelihood: 0.9 },
  SNOWY: { fuelDecay: 2.2, tempStability: 0.4, visibility: 0.6, durationMult: 1.2, clouds: 0.9, cloudLikelihood: 0.8 },
};

export const DECORATION_CONFIG = {
  TREES: { count: 8, minHeight: 40, maxHeight: 60 },
  MOUNTAINS: { count: 5, minHeight: 100, maxHeight: 150, minWidth: 200, maxWidth: 300 },
  CLOUDS: { count: 12, minScale: 0.5, maxScale: 2.0, minSpeed: 0.005, maxSpeed: 0.05, minOpacity: 0.1, maxOpacity: 0.3 },
  ROCKS: { count: 3, minSize: 5, maxSize: 15 },
  GRASS: { count: 5, minHeight: 5, maxHeight: 15 },
  CACTI: { count: 1, minHeight: 15, maxHeight: 20 },
  COMET: { chance: 0.0002, minVx: 300, maxVx: 600, minVy: 80, maxVy: 230, decayTime: 0.5 }
};
