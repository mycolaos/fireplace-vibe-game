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

  playHowl(isMuted: boolean) {
    if (!this.ctx || isMuted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    
    // Primary howl oscillator
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const masterGain = this.ctx.createGain();
    
    // Sound qualities
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc2.detune.value = 7; // Slight detune for richness
    
    // LFO for pitch vibrato (essential for natural howls)
    lfo.type = 'sine';
    lfo.frequency.value = 5; // 5Hz vibrato
    lfoGain.gain.value = 10; // Vibrato depth
    
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);
    
    // Frequency envelope (The classic rise and fall)
    const baseFreq = 380 + Math.random() * 40;
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 1.2);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 3.5);
    
    osc2.frequency.setValueAtTime(baseFreq, now);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 1.2);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 3.5);

    // Amplitude envelope
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.04, now + 0.5);
    masterGain.gain.linearRampToValueAtTime(0.03, now + 2.5);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);
    
    // Filtering for "hollow" distance effect
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 1;
    
    osc1.connect(masterGain);
    osc2.connect(masterGain);
    masterGain.connect(filter);
    filter.connect(this.ctx.destination);
    
    lfo.start(now);
    osc1.start(now);
    osc2.start(now);
    
    lfo.stop(now + 4.1);
    osc1.stop(now + 4.1);
    osc2.stop(now + 4.1);
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
