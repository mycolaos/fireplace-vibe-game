/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface VibePortalProps {
  isVisible: boolean;
}

export const VibePortal: React.FC<VibePortalProps> = ({ isVisible }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          className="absolute z-50 pointer-events-none backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded bg-black/40 border border-white/10 shadow-lg whitespace-nowrap"
          style={{ 
            right: '10%', 
            top: '40%',
            transform: 'translate(-50%, -100%)'
          }}
        >
          Vibe portal
        </motion.div>
      )}
    </AnimatePresence>
  );
};
