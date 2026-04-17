import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

/**
 * Listens for user activity and locks the app after `autoLockMinutes` of inactivity.
 * Mount this hook only when a member is active (inside the authenticated shell).
 * If autoLockMinutes === 0, the timer is disabled.
 */
export function useIdleTimer() {
  const lock = useAuthStore((s) => s.lock);
  const autoLockMinutes = useAppStore((s) => s.autoLockMinutes);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autoLockMinutes === 0) return;

    const delay = autoLockMinutes * 60 * 1000;

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(lock, delay);
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    // Start the timer immediately
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [autoLockMinutes, lock]);
}
