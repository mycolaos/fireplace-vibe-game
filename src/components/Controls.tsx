/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Wind } from 'lucide-react';
import { UIState } from '../types';

interface ControlsProps {
  uiState: UIState;
  isPressing: boolean;
  logCharge: number;
  handleBlow: () => void;
}

export const Controls: React.FC<ControlsProps> = ({ uiState, isPressing, logCharge, handleBlow }) => {
  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
      {isPressing && (
        <div className="flex flex-col items-center gap-1">
          <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
             <div className="h-full bg-red-500 transition-all" style={{ width: `${logCharge}%` }} />
          </div>
          <span className="text-[10px] text-white/60 uppercase font-black tracking-[0.2em]">Charging Log</span>
        </div>
      )}
      
      {!uiState.gameOver && (
        <div className="flex flex-col items-center gap-6">
          <button
            onMouseDown={(e) => { e.stopPropagation(); handleBlow(); }}
            onTouchStart={(e) => { e.stopPropagation(); handleBlow(); }}
            className="group pointer-events-auto flex items-center gap-3 active:scale-95 py-1 px-2 bg-white/5 hover:bg-white/10 active:scale-95 rounded-full border border-white/10 transition-all backdrop-blur-md"
          >
            <div className="flex flex-col items-start">
              <span className="text-xs font-black text-white uppercase tracking-widest">Air</span>
            </div>
            <Wind className="w-5 h-5 text-sky-400 group-hover:animate-bounce" />
          </button>
        </div>
      )}
    </div>
  );
};
