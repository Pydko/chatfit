// Pure time calculations. No side effects, fully testable.

export const REST_PRESETS = [60, 90, 120, 180] as const;

export const MIN_REST_SECONDS = 15;
export const MAX_REST_SECONDS = 900;

/** 90 -> "1:30", 45 -> "0:45", 3661 -> "61:01" */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Remaining seconds until end time. Cannot be negative. */
export function remainingSeconds(endsAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));
}

/** Clamp within boundaries. */
export function clampRest(seconds: number): number {
  if (!Number.isFinite(seconds)) return MIN_REST_SECONDS;
  return Math.min(MAX_REST_SECONDS, Math.max(MIN_REST_SECONDS, Math.round(seconds)));
}

/**
 * Rest duration based on the set. Based on user's default,
 * scaled according to set type. Heavy/low rep sets require longer rest.
 */
export function suggestRestSeconds(
  set: { reps: number; is_warmup: boolean },
  baseSeconds = 90,
): number {
  const base = clampRest(baseSeconds);

  if (set.is_warmup) return clampRest(base * 0.5);
  if (set.reps <= 5) return clampRest(base * 2);
  if (set.reps <= 8) return clampRest(base * 1.35);
  if (set.reps <= 12) return base;
  return clampRest(base * 0.7);
}

/** Progress ratio 0..1 (elapsed portion). */
export function restProgress(totalSeconds: number, remaining: number): number {
  if (totalSeconds <= 0) return 1;
  const done = (totalSeconds - remaining) / totalSeconds;
  return Math.min(1, Math.max(0, done));
}