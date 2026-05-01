/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, RotateCcw, Sunrise } from 'lucide-react';
import { UIState } from '../types';
import { CYCLE_START_DUSK, CYCLE_START_NIGHT } from '../constants';

interface GameOverProps {
  uiState: UIState;
  highScore: number;
  onRestart: (initialCycle?: number) => void;
}

export const GameOver: React.FC<GameOverProps> = ({ uiState, highScore, onRestart }) => {
  return (
    <AnimatePresence>
      {uiState.gameOver && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
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
            <div className="flex flex-col gap-1 mb-10">
              <p className="text-white/40 text-lg">You kept the night at bay for {uiState.score} seconds.</p>
              <div className="flex items-center justify-center gap-2 text-sky-400 font-mono text-sm font-bold tracking-widest">
                Best Session: {highScore} seconds
              </div>
            </div>
            
            <div className="flex flex-col gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); onRestart(CYCLE_START_NIGHT); }}
                className="group relative px-10 py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-3 mx-auto transition-all hover:scale-105 active:scale-95 cursor-pointer w-64"
              >
                <div className="absolute inset-0 bg-white blur-lg opacity-0 group-hover:opacity-40 transition-opacity rounded-2xl" />
                <span className="relative">Light it again</span>
                <RotateCcw className="relative w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); onRestart(CYCLE_START_DUSK); }}
                className="group px-10 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl flex items-center justify-center gap-3 mx-auto transition-all hover:scale-105 active:scale-95 cursor-pointer w-64"
              >
                <span>Begin at Dusk</span>
                <Sunrise className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
