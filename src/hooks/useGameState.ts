/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef, useCallback, useState } from 'react';
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
  DEFAULT_CYCLE_START
} from '../constants';
import { Particle, Wood, GameEvent, UIState, Star, Firefly, Tree, WeatherType, Mountain, Cloud, Rock, Grass, Cactus, Comet } from '../types';

export function useGameState() {
  const initialWeather: WeatherType = 'CLEAR';
  const state = useRef({
    intensity: INITIAL_INTENSITY,
    oxygen: 100,
    smoke: 0,
    wind: 0 as -1 | 0 | 1,
    score: 0,
    lastTick: 0,
    particles: [] as Particle[],
    woods: [] as Wood[],
    stars: [] as Star[],
    fireflies: [] as Firefly[],
    trees: [] as Tree[],
    mountains: [] as Mountain[],
    clouds: [] as Cloud[],
    rocks: [] as Rock[],
    grass: [] as Grass[],
    cacti: [] as Cactus[],
    comet: { x: 0, y: 0, vx: 0, vy: 0, life: 0, active: false } as Comet,
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
    weather: initialWeather,
    cloudDensity: (WEATHER_CONFIG[initialWeather] as any).clouds,
    cloudAlpha: (WEATHER_CONFIG[initialWeather] as any).cloudLikelihood,
    nextWeatherTime: performance.now() + (WEATHER_MIN_DURATION + Math.random() * (WEATHER_MAX_DURATION - WEATHER_MIN_DURATION)) * WEATHER_CONFIG[initialWeather].durationMult,
    cycleProgress: DEFAULT_CYCLE_START,
    initialCycle: DEFAULT_CYCLE_START,
  });

  const [uiState, setUiState] = useState<UIState>({
    score: 0,
    intensity: INITIAL_INTENSITY,
    oxygen: 100,
    smoke: 0,
    wind: 0,
    weather: 'CLEAR',
    gameOver: false,
    sticks: MAX_STICKS,
    logs: MAX_LOGS,
    currentEvent: 'NONE',
    cycleProgress: DEFAULT_CYCLE_START,
  });

  const updateUI = useCallback(() => {
    setUiState({
      score: state.current.score,
      intensity: state.current.intensity,
      oxygen: state.current.oxygen,
      smoke: state.current.smoke,
      wind: state.current.wind,
      weather: state.current.weather,
      gameOver: state.current.gameOver,
      sticks: state.current.sticks,
      logs: state.current.logs,
      currentEvent: state.current.currentEvent,
      cycleProgress: state.current.cycleProgress,
    });
  }, []);

  const restartGame = useCallback((initialCycle: number = DEFAULT_CYCLE_START) => {
    const now = performance.now();
    state.current = {
      ...state.current,
      intensity: INITIAL_INTENSITY,
      oxygen: 100,
      smoke: 0,
      wind: 0,
      score: 0,
      lastTick: now,
      particles: [],
      woods: [],
      stars: [],
      fireflies: [],
      trees: [],
      mountains: [],
      clouds: [],
      rocks: [],
      grass: [],
      cacti: [],
      comet: { x: 0, y: 0, vx: 0, vy: 0, life: 0, active: false },
      gameOver: false,
      startTime: now,
      nextWindChange: now + 5000,
      decayRate: INTENSITY_DECAY_BASE,
      sticks: MAX_STICKS,
      logs: MAX_LOGS,
      stickTimer: 0,
      logTimer: 0,
      currentEvent: 'NONE',
      eventEndTime: 0,
      nextEventTime: now + 8000,
      weather: 'CLEAR',
      cloudDensity: (WEATHER_CONFIG['CLEAR'] as any).clouds,
      cloudAlpha: (WEATHER_CONFIG['CLEAR'] as any).cloudLikelihood,
      nextWeatherTime: now + (WEATHER_MIN_DURATION + Math.random() * (WEATHER_MAX_DURATION - WEATHER_MIN_DURATION)) * WEATHER_CONFIG['CLEAR'].durationMult,
      cycleProgress: initialCycle,
      initialCycle: initialCycle,
    };
    updateUI();
  }, [updateUI]);

  return { state, uiState, setUiState, updateUI, restartGame };
}
