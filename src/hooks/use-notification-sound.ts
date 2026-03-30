import { useCallback, useRef } from "react";

// Simple notification sound using Web Audio API
export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playSound = useCallback(() => {
    try {
      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      const ctx = audioContextRef.current;
      
      // Resume if suspended (required by browsers)
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Create oscillator for a pleasant two-tone chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Pleasant frequencies (C5 and E5 - major third)
      osc1.frequency.value = 523.25;
      osc2.frequency.value = 659.25;
      osc1.type = "sine";
      osc2.type = "sine";

      // Volume envelope
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);

      // Play second chime slightly delayed
      setTimeout(() => {
        const osc3 = ctx.createOscillator();
        const osc4 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        osc3.connect(gain2);
        osc4.connect(gain2);
        gain2.connect(ctx.destination);

        // Higher frequencies (E5 and G5)
        osc3.frequency.value = 659.25;
        osc4.frequency.value = 783.99;
        osc3.type = "sine";
        osc4.type = "sine";

        const t = ctx.currentTime;
        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.25, t + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        osc3.start(t);
        osc4.start(t);
        osc3.stop(t + 0.4);
        osc4.stop(t + 0.4);
      }, 150);

    } catch (error) {
      console.error("Error playing notification sound:", error);
    }
  }, []);

  return { playSound };
}
