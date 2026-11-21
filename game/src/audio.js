// Night Ledger — sound, synthesized live with WebAudio. No audio files.
// One file, one job: footsteps that tell you where a guard is, and the few
// stings that mark spotting, pickups and the win. Silence costs nothing: every
// sound is built from oscillators and filtered noise at play time.

export function createAudio() {
  let context = null;
  let muted = false;
  let master = null;

  // Browsers only allow audio after a user gesture; call from the first click
  // or keypress, and it is safe to call again afterwards.
  function ensure() {
    if (context !== null) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(frequency, duration, type, volume, when = 0, slideTo = null) {
    if (context === null || muted) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  // A short burst of filtered noise: a footstep, a coin clink, a thud.
  function noiseBurst(duration, volume, filterFrequency, when = 0) {
    if (context === null || muted) return;
    const start = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    ensure,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    // The player's own step: soft, low, always the same.
    playerStep(sneaking) {
      noiseBurst(0.05, sneaking ? 0.05 : 0.11, sneaking ? 500 : 900);
    },
    // A guard's step: the nearer the guard, the louder — so you can hear a
    // patrol coming around a corner before you see its cone.
    guardStep(distance) {
      const volume = Math.max(0.02, 0.34 * (1 - distance / 560));
      noiseBurst(0.07, volume, 420);
    },
    coinThrow() {
      noiseBurst(0.06, 0.16, 3200);
    },
    coinLand() {
      tone(2093, 0.09, 'sine', 0.22);
      tone(1568, 0.14, 'sine', 0.18, 0.07);
      noiseBurst(0.05, 0.12, 5000, 0.02);
    },
    seal() {
      tone(523, 0.12, 'sine', 0.22);
      tone(784, 0.18, 'sine', 0.22, 0.09);
    },
    // Two rising notes: a guard just got sure of you.
    spotted() {
      tone(233, 0.16, 'square', 0.14);
      tone(311, 0.28, 'square', 0.16, 0.13);
    },
    caught() {
      tone(196, 0.3, 'sawtooth', 0.2, 0, 98);
      noiseBurst(0.18, 0.25, 300);
    },
    levelClear() {
      tone(523, 0.14, 'sine', 0.22);
      tone(659, 0.14, 'sine', 0.22, 0.12);
      tone(784, 0.3, 'sine', 0.24, 0.24);
    },
    win() {
      const notes = [523, 659, 784, 1047, 784, 1047];
      notes.forEach((note, i) => tone(note, 0.22, 'sine', 0.22, i * 0.14));
    },
    locked() {
      tone(140, 0.12, 'square', 0.12);
    },
  };
}
