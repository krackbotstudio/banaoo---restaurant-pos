import { useCallback, useRef } from "react";

/** Kitchen new-order ringtone (served from public/sounds/). */
export const KITCHEN_NEW_ORDER_SOUND_URL = "/sounds/kitchen-new-order.mp3";

const STORAGE_KEY = "banaoo-kitchen-sound-enabled";

export function readKitchenSoundEnabled(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function writeKitchenSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function useKitchenOrderSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(KITCHEN_NEW_ORDER_SOUND_URL);
      audioRef.current.preload = "auto";
    }
    return audioRef.current;
  }, []);

  /** Call after a user gesture so later play() is allowed by the browser. */
  const unlockAudio = useCallback(async () => {
    const audio = getAudio();
    audio.volume = 1;
    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Blocked until a real gesture — caller may retry on button tap
    }
  }, [getAudio]);

  const playSound = useCallback(async () => {
    const audio = getAudio();
    audio.volume = 1;
    audio.currentTime = 0;
    try {
      await audio.play();
    } catch (error) {
      console.warn("Kitchen order sound blocked:", error);
    }
  }, [getAudio]);

  return { playSound, unlockAudio };
}
