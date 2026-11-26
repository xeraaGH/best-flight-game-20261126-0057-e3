// Gale Strip — synthesised sound only: a WebAudio engine hum, wind rush, a
// touchdown thud, clicks for flaps and gear, and a short chime for a good
// landing. Nothing is loaded from a file, so the game stays fully offline.
export function createAudioEngine() {
  return {
    context: null,
    engineOscillator: null,
    engineOscillator2: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    muted: false,
    // Start the graph on the first user gesture; browsers block it before one.
    ensureStarted() {
      if (this.context) {
        if (this.context.state === 'suspended') void this.context.resume();
        return;
      }
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      this.context = context;
      // Engine: two detuned sawtooths through a low-pass, gain by throttle.
      this.engineOscillator = context.createOscillator();
      this.engineOscillator.type = 'sawtooth';
      this.engineOscillator.frequency.value = 62;
      this.engineOscillator2 = context.createOscillator();
      this.engineOscillator2.type = 'sawtooth';
      this.engineOscillator2.frequency.value = 93;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      this.engineGain = context.createGain();
      this.engineGain.gain.value = 0;
      this.engineOscillator.connect(engineFilter);
      this.engineOscillator2.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(context.destination);
      this.engineOscillator.start();
      this.engineOscillator2.start();
      // Wind: looped noise through a band-pass, gain by airspeed.
      const noiseLength = context.sampleRate * 2;
      const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseLength; i += 1) data[i] = Math.random() * 2 - 1;
      this.windSource = context.createBufferSource();
      this.windSource.buffer = noiseBuffer;
      this.windSource.loop = true;
      this.windFilter = context.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 480;
      this.windFilter.Q.value = 0.6;
      this.windGain = context.createGain();
      this.windGain.gain.value = 0;
      this.windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(context.destination);
      this.windSource.start();
    },
    // Called every frame while flying: engine note follows throttle, wind
    // follows airspeed, both silent on the title screen.
    updateFlying(throttle, speedKts, flying) {
      if (!this.context || this.muted) return;
      const target = flying ? 0.05 + throttle * 0.075 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.context.currentTime, 0.12);
      this.engineOscillator.frequency.setTargetAtTime(58 + throttle * 46, this.context.currentTime, 0.1);
      this.engineOscillator2.frequency.setTargetAtTime(87 + throttle * 68, this.context.currentTime, 0.1);
      const windTarget = flying ? Math.min(0.16, speedKts * 0.0011) : 0;
      this.windGain.gain.setTargetAtTime(windTarget, this.context.currentTime, 0.2);
      this.windFilter.frequency.setTargetAtTime(320 + speedKts * 4, this.context.currentTime, 0.2);
    },
    // A short low thud for a touchdown, harder when the sink rate is high.
    playTouchdownThud(sinkFpm) {
      if (!this.context || this.muted) return;
      const strength = Math.min(1, 0.35 + sinkFpm / 1200);
      const osc = this.context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(82, this.context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(38, this.context.currentTime + 0.22);
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.5 * strength, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(this.context.destination);
      osc.start();
      osc.stop(this.context.currentTime + 0.3);
    },
    // A click for a flap or gear change.
    playClick() {
      if (!this.context || this.muted) return;
      const osc = this.context.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 620;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.08, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(this.context.destination);
      osc.start();
      osc.stop(this.context.currentTime + 0.08);
    },
    // Three rising notes for a landing that scored.
    playLandingChime() {
      if (!this.context || this.muted) return;
      [523, 659, 784].forEach((frequency, index) => {
        const osc = this.context.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = frequency;
        const gain = this.context.createGain();
        const start = this.context.currentTime + index * 0.13;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
        osc.connect(gain);
        gain.connect(this.context.destination);
        osc.start(start);
        osc.stop(start + 0.55);
      });
    },
  };
}
