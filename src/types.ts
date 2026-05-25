/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameEvent = 'NONE' | 'WIND_GUST' | 'DAMP_WOOD' | 'PERFECT_AIR';

export type WeatherType = 'CLEAR' | 'WINDY' | 'RAINY' | 'SNOWY';

export type WolfState = 'WALKING' | 'SITTING' | 'HOWLING' | 'EXITING' | 'HIDDEN';

export interface Wolf {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: WolfState;
  timer: number;
  direction: 1 | -1;
  eyeBrightness: number;
  eyeBrightnessBase?: number;
}

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

export interface Mountain {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  opacity: number;
  threshold: number;
  puffs: { dx: number; dy: number; radius: number }[];
}

export interface Rock {
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
}

export interface Grass {
  x: number;
  y: number;
  height: number;
  phase: number;
}

export interface Cactus {
  x: number;
  y: number;
  height: number;
  rotation: number;
}

export interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  active: boolean;
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
  cycleProgress: number; // 0 to 1
}
