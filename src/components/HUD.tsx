/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wind, Timer as TimerIcon, Logs as LogIcon, Flame } from 'lucide-react';
import { UIState } from '../types';
import { MAX_STICKS, MAX_LOGS } from '../constants';

interface HUDProps {
  uiState: UIState;
}

export const HUD: React.FC<HUDProps> = ({ uiState }) => {
  return (
    <>
      {/* --- Score & Warning --- */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
        <div className="flex justify-end items-center gap-3 text-white shadow-2xl">
          <TimerIcon className="w-5 h-5" />
          <span className="font-bold tracking-widest font-mono">
            {String(uiState.score)}
          </span>
        </div>
        
        <AnimatePresence>
          {uiState.intensity < 20 && !uiState.gameOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-xs text-center font-black text-red-500 tracking-[0.3em] animate-pulse"
            >
              The embers are cooling
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- Resources --- */}
      {!uiState.gameOver && (
        <div className="absolute bottom-20 left-6 right-6 flex justify-between pointer-events-none">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Sticks</span>
            <div className="flex gap-1">
              {[...Array(MAX_STICKS)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1 h-3 rounded-full transition-colors ${i < uiState.sticks ? 'bg-orange-400' : 'bg-white/10'}`} 
                />
              ))}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Logs</span>
            <div className="flex gap-1.5">
              {[...Array(MAX_LOGS)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-3 h-3 rounded-sm transition-colors ${i < uiState.logs ? 'bg-[#5d4037]' : 'bg-white/10'}`} 
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- Oxygen Bar --- */}
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

      {/* --- Events & Wind --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3">
        <AnimatePresence mode="wait">
          {uiState.currentEvent !== 'NONE' ? (
            <motion.div 
              key={uiState.currentEvent}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`flex items-center gap-3 backdrop-blur-md px-6 py-2.5 rounded-full border shadow-2xl pointer-events-none
                ${uiState.currentEvent === 'WIND_GUST' ? 'bg-sky-500/20 border-sky-400/30' : 
                  uiState.currentEvent === 'DAMP_WOOD' ? 'bg-stone-500/20 border-stone-400/30' : 
                  'bg-emerald-500/20 border-emerald-400/30'}`}
            >
              {uiState.currentEvent === 'WIND_GUST' && <Wind className="w-5 h-5 text-sky-400" />}
              {uiState.currentEvent === 'DAMP_WOOD' && <LogIcon className="w-5 h-5 text-stone-400" />}
              {uiState.currentEvent === 'PERFECT_AIR' && <Flame className="w-5 h-5 text-emerald-400" />}
              
              <div className="flex flex-col">
                <span className="text-xs font-black text-white uppercase tracking-widest">
                  {uiState.currentEvent.replace('_', ' ')}
                </span>
                <span className="text-[8px] text-white/60 font-bold uppercase tracking-tight">
                  {uiState.currentEvent === 'WIND_GUST' ? 'Intensity Penalty / Oxygen Boost' :
                   uiState.currentEvent === 'DAMP_WOOD' ? 'Reduced Fuel Efficiency' :
                   'High Efficiency Burn'}
                </span>
              </div>
            </motion.div>
          ) : uiState.wind !== 0 && (
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
    </>
  );
};
