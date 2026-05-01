/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { CABIN_HIT_RADIUS } from './constants';
import { fireAudio } from './services/audioService';
import { HUD } from './components/HUD';
import { GameOver } from './components/GameOver';
import { Controls } from './components/Controls';
import { VibePortal } from './components/VibePortal';
import { FireplaceCanvas } from './components/FireplaceCanvas';
import { useGameState } from './hooks/useGameState';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const { state, uiState, updateUI, restartGame } = useGameState();
  const [highScore, setHighScore] = useState<number>(0);
  const highScoreRef = useRef<number>(0);

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
  const [hoveringCabin, setHoveringCabin] = useState(false);

  const getCanvasDimensions = () => {
    if (!containerRef.current) return { width: window.innerWidth, height: window.innerHeight };
    return { width: containerRef.current.clientWidth, height: containerRef.current.clientHeight };
  };

  const getCabinPos = () => {
    const { width, height } = getCanvasDimensions();
    const horizonY = height * 0.55;
    const cabinX = width * 0.8;
    const cabinY = horizonY - 15 + Math.sin(cabinX * 0.005 + 1) * 5;
    return { x: cabinX, y: cabinY };
  };

  const checkCabinHit = (x: number, y: number) => {
    const cabin = getCabinPos();
    const dist = Math.sqrt((x - cabin.x) ** 2 + (y - cabin.y) ** 2);
    return dist < CABIN_HIT_RADIUS;
  };

  const handleInteraction = useCallback((type: 'stick' | 'log', x: number, y: number) => {
    if (state.current.gameOver) return;
    if (type === 'stick' && state.current.sticks <= 0) return;
    if (type === 'log' && state.current.logs <= 0) return;

    fireAudio.init();

    let fuelEfficiency = 1.0;
    if (state.current.currentEvent === 'DAMP_WOOD') fuelEfficiency = 0.4;
    if (state.current.currentEvent === 'PERFECT_AIR') fuelEfficiency = 1.3;

    const fireGainMult = state.current.smoke > 50 ? 0.8 : 1.0;
    const timingBonus = (state.current.oxygen > 40 && state.current.oxygen < 70) ? 1.25 : 1.0;
    
    const { width, height } = getCanvasDimensions();
    const centerX = width / 2;
    const centerY = height * 0.75;
    const groundY = centerY;
    const targetY = groundY + (Math.random() - 0.5) * 30;

    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    const fireRadius = 15 + (state.current.intensity * 0.4);
    
    let spatialBonus = 1.0;
    if (dist > fireRadius) {
      spatialBonus = 0;
    } else {
      spatialBonus = Math.max(1.0, 1.5 - (dist / (fireRadius * 2))); 
    }

    const isBurning = spatialBonus > 0;
    if (type === 'stick') {
      state.current.sticks--;
      if (isBurning) {
        state.current.intensity = Math.min(100, state.current.intensity + 8 * fireGainMult * timingBonus * fuelEfficiency * spatialBonus);
        state.current.smoke += state.current.currentEvent === 'DAMP_WOOD' ? 12 : 5;
      }
      state.current.woods.push({ x, y, vy: 0, targetY, type: 'stick', rotation: Math.random() * Math.PI, life: 1.0, isBurning });
    } else {
      state.current.logs--;
      if (isBurning) {
        state.current.intensity = Math.min(100, state.current.intensity + 22 * fireGainMult * timingBonus * fuelEfficiency * spatialBonus);
        state.current.smoke += state.current.currentEvent === 'DAMP_WOOD' ? 35 : 22; 
      }
      state.current.woods.push({ x, y, vy: 0, targetY, type: 'log', rotation: Math.random() * Math.PI, life: 1.0, isBurning });
    }
  }, [state]);

  const handleBlow = useCallback(() => {
    if (state.current.gameOver) return;
    fireAudio.init();
    state.current.oxygen = Math.min(100, state.current.oxygen + 20);
    state.current.smoke = Math.max(0, state.current.smoke - 12);
    state.current.intensity = Math.max(0, state.current.intensity - 5);
  }, [state]);

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

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const hit = checkCabinHit(e.clientX - rect.left, e.clientY - rect.top);
    if (hit !== hoveringCabin) setHoveringCabin(hit);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (state.current.gameOver) return;
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      if (checkCabinHit(clientX - rect.left, clientY - rect.top)) {
        window.location.href = 'https://vibej.am/portal/2026';
        return;
      }
    }
    setIsPressing(true);
    pressStartTime.current = performance.now();
  }, [state, hoveringCabin]);

  const handleMouseUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isPressing || state.current.gameOver) return;
    const duration = performance.now() - (pressStartTime.current || 0);
    let clientX, clientY;
    if ('changedTouches' in e) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      handleInteraction(duration > 600 ? 'log' : 'stick', clientX - rect.left, clientY - rect.top);
    }
    setIsPressing(false);
    pressStartTime.current = null;
    setLogCharge(0);
  }, [isPressing, handleInteraction, state]);

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

  const onGameOver = useCallback((score: number) => {
    if (score > highScoreRef.current) {
      highScoreRef.current = score;
      setHighScore(score);
      localStorage.setItem('fireplace_highscore', score.toString());
    }
  }, []);

  return (
    <div 
      id="game-root"
      ref={containerRef}
      className={`relative w-full h-svh bg-[#0a0a0f] overflow-hidden font-sans select-none touch-none ${hoveringCabin ? 'cursor-pointer' : 'cursor-crosshair'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
    >
      <FireplaceCanvas 
        state={state} 
        updateUI={updateUI} 
        isMuted={isMuted} 
        onGameOver={onGameOver}
      />

      <VibePortal isVisible={hoveringCabin} />
      <HUD uiState={uiState} />

      <div className="absolute top-6 right-6 flex items-center gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
          className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors pointer-events-auto"
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-white/80" />}
        </button>
      </div>

      <Controls uiState={uiState} isPressing={isPressing} logCharge={logCharge} handleBlow={handleBlow} />
      <GameOver uiState={uiState} highScore={highScore} onRestart={restartGame} />

      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
    </div>
  );
}
