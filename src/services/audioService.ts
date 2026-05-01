/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export class FireAudio {
  ctx: AudioContext | null = null;
  gainNode: GainNode | null = null;
  noiseFilter: BiquadFilterNode | null = null;
  isMuted: boolean = false;

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.gainNode = this.ctx.createGain();
    this.gainNode.connect(this.ctx.destination);
    this.gainNode.gain.value = 0;

    // Create a noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Noise Source
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Main Rumble (Low-end 'roar' of fire)
    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = 'lowpass';
    this.noiseFilter.frequency.value = 250;
    this.noiseFilter.Q.value = 0.5;

    noise.connect(this.noiseFilter);
    this.noiseFilter.connect(this.gainNode);
    noise.start();

    // Crackle Loop - refined for sharper 'pops'
    this.scheduleCrackle();
  }

  scheduleCrackle() {
    if (!this.ctx || !this.gainNode) return;
    
    const baseVol = this.gainNode.gain.value;
    // Only crackle if there's significant heat
    if (baseVol > 0.02 && Math.random() < 0.4) {
      // Use noise burst followed by resonant filter for a 'pop'
      const burstSize = this.ctx.sampleRate * 0.01; // very short
      const burstBuffer = this.ctx.createBuffer(1, burstSize, this.ctx.sampleRate);
      const data = burstBuffer.getChannelData(0);
      for (let i = 0; i < burstSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / burstSize);
      }

      const source = this.ctx.createBufferSource();
      source.buffer = burstBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000 + Math.random() * 3000;
      filter.Q.value = 2;

      const g = this.ctx.createGain();
      g.gain.value = (0.2 + Math.random() * 0.4) * baseVol;

      source.connect(filter);
      filter.connect(g);
      g.connect(this.ctx.destination);
      
      source.start();
    }

    setTimeout(() => this.scheduleCrackle(), 30 + Math.random() * 400);
  }

  update(intensity: number, muted: boolean) {
    if (!this.ctx || !this.gainNode) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    // Mute/Unmute logic
    const targetGain = muted ? 0 : (intensity / 100) * 0.18;
    this.gainNode.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.2);
    
    // Low-end roar frequency moves with size
    if (this.noiseFilter) {
      const freq = 100 + (intensity * 1.5);
      this.noiseFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.5);
    }
  }
}

export const fireAudio = new FireAudio();
