import { cancelScheduled, scheduleRestFinished } from '@/lib/notifications';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { clampRest, remainingSeconds } from './duration';

export type RestTimer = {
  running: boolean;
  remaining: number;
  total: number;
  start: (seconds: number) => void;
  addSeconds: (delta: number) => void;
  stop: () => void;
};

export function useRestTimer(): RestTimer {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const notifId = useRef<string | null>(null);

  // Render is not triggered unless seconds change: React skips if setRemaining receives the same value.
  useEffect(() => {
    if (endsAt === null) return;

    const tick = () => setRemaining(remainingSeconds(endsAt, Date.now()));
    tick();

    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [endsAt]);

  // Clean up and trigger haptics when time is up.
  useEffect(() => {
    if (endsAt === null || remaining > 0) return;

    setEndsAt(null);
    setTotal(0);
    notifId.current = null;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [endsAt, remaining]);

  // Schedule notification from a single place; side effects are kept outside of state updater.
  const reschedule = useCallback((seconds: number) => {
    const previous = notifId.current;
    notifId.current = null;
    cancelScheduled(previous);

    scheduleRestFinished(seconds).then((id) => {
      notifId.current = id;
    });
  }, []);

  const start = useCallback((seconds: number) => {
    const safe = clampRest(seconds);
    setTotal(safe);
    setRemaining(safe);
    setEndsAt(Date.now() + safe * 1000);
    reschedule(safe);
  }, [reschedule]);

  const addSeconds = useCallback((delta: number) => {
    if (endsAt === null) return;

    const nextEnd = endsAt + delta * 1000;
    const left = Math.max(1, Math.round((nextEnd - Date.now()) / 1000));

    setEndsAt(nextEnd);
    setTotal((prev) => (prev > 0 ? prev + delta : prev));
    setRemaining(left);
    reschedule(left);
  }, [endsAt, reschedule]);

  const stop = useCallback(() => {
    const previous = notifId.current;
    notifId.current = null;
    cancelScheduled(previous);

    setEndsAt(null);
    setTotal(0);
    setRemaining(0);
  }, []);

  return {
    running: endsAt !== null && remaining > 0,
    remaining,
    total,
    start,
    addSeconds,
    stop,
  };
}