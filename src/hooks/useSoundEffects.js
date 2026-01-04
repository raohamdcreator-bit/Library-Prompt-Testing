// src/hooks/useSoundEffects.js
import { useCallback, useRef, useEffect } from 'react';

// Import sound files
import notificationSound from '../assets/sounds/notification.mp3';
import enhancementSound from '../assets/sounds/enhancement-complete.mp3';

export function useSoundEffects() {
  // Create audio element refs
  const notificationAudioRef = useRef(null);
  const enhancementAudioRef = useRef(null);

  // Initialize audio elements on mount
  useEffect(() => {
    // Create notification audio element
    notificationAudioRef.current = new Audio(notificationSound);
    notificationAudioRef.current.volume = 0.5; // 50% volume
    notificationAudioRef.current.preload = 'auto';

    // Create enhancement audio element
    enhancementAudioRef.current = new Audio(enhancementSound);
    enhancementAudioRef.current.volume = 0.6; // 60% volume
    enhancementAudioRef.current.preload = 'auto';

    // Cleanup function
    return () => {
      if (notificationAudioRef.current) {
        notificationAudioRef.current.pause();
        notificationAudioRef.current = null;
      }
      if (enhancementAudioRef.current) {
        enhancementAudioRef.current.pause();
        enhancementAudioRef.current = null;
      }
    };
  }, []);

  // Play notification sound
  const playNotification = useCallback(() => {
    try {
      if (notificationAudioRef.current) {
        // Reset to start if already playing
        notificationAudioRef.current.currentTime = 0;
        
        // Play with error handling
        const playPromise = notificationAudioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn('Notification sound playback failed:', error);
          });
        }
      }
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, []);

  // Play enhancement complete sound
  const playEnhancement = useCallback(() => {
    try {
      if (enhancementAudioRef.current) {
        // Reset to start if already playing
        enhancementAudioRef.current.currentTime = 0;
        
        // Play with error handling
        const playPromise = enhancementAudioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn('Enhancement sound playback failed:', error);
          });
        }
      }
    } catch (error) {
      console.error('Error playing enhancement sound:', error);
    }
  }, []);

  return {
    playNotification,
    playEnhancement,
  };
}
