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

export const WEATHER_CHANGE_INTERVAL = 60 * 1000; // 60s
export const WEATHER_CONFIG = {
  CLEAR: { fuelDecay: 1.0, tempStability: 1.0, visibility: 1.0 },
  WINDY: { fuelDecay: 1.4, tempStability: 0.8, visibility: 0.9 },
  RAINY: { fuelDecay: 1.8, tempStability: 0.6, visibility: 0.7 },
  SNOWY: { fuelDecay: 2.2, tempStability: 0.4, visibility: 0.6 },
};
