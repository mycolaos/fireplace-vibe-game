/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameEvent = 'NONE' | 'WIND_GUST' | 'DAMP_WOOD' | 'PERFECT_AIR';

export type WeatherType = 'CLEAR' | 'WINDY' | 'RAINY' | 'SNOWY';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number; // 0 to 1
  type: 'fire' | 'smoke' | 'rain' | 'snow';
  color: string;
}

export interface Wood {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  type: 'stick' | 'log';
  rotation: number;
  life: number;
  isBurning: boolean;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  phase: number;
}

export interface Firefly {
  x: number;
  y: number;
  phase: number;
  speed: number;
  offset: number;
}

export interface Tree {
  x: number;
  y: number;
  height: number;
  phase: number;
}

export interface UIState {
  score: number;
  intensity: number;
  oxygen: number;
  smoke: number;
  wind: number;
  weather: WeatherType;
  gameOver: boolean;
  sticks: number;
  logs: number;
  currentEvent: GameEvent;
}
