// src/hooks/useSoundEffects.js

export function useSoundEffects() {
  const playNotification = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      const oscillator = ctx.createOscillator();
      const gainNode   = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);

      oscillator.onended = () => ctx.close();
    } catch {
      // Sound is non-critical — fail silently
    }
  };

  return { playNotification };
}
