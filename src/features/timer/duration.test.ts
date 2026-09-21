import {
  clampRest,
  formatDuration,
  MAX_REST_SECONDS,
  MIN_REST_SECONDS,
  remainingSeconds,
  restProgress,
  suggestRestSeconds,
} from './duration';

describe('formatDuration', () => {
  it('splits minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(120)).toBe('2:00');
  });

  it('pads seconds to two digits', () => {
    expect(formatDuration(61)).toBe('1:01');
  });

  it('treats negative values as zero', () => {
    expect(formatDuration(-10)).toBe('0:00');
  });
});

describe('remainingSeconds', () => {
  it('rounds up the remaining seconds', () => {
    expect(remainingSeconds(10_500, 0)).toBe(11);
  });

  it('returns 0 for a past end time', () => {
    expect(remainingSeconds(1_000, 5_000)).toBe(0);
  });
});

describe('clampRest', () => {
  it('enforces the lower bound', () => {
    expect(clampRest(5)).toBe(MIN_REST_SECONDS);
  });

  it('enforces the upper bound', () => {
    expect(clampRest(5000)).toBe(MAX_REST_SECONDS);
  });

  it('preserves valid values', () => {
    expect(clampRest(90)).toBe(90);
  });

  it('falls back to lower bound for invalid numbers', () => {
    expect(clampRest(Number.NaN)).toBe(MIN_REST_SECONDS);
  });
});

describe('suggestRestSeconds', () => {
  it('works with the default 90 seconds', () => {
    expect(suggestRestSeconds({ reps: 10, is_warmup: false })).toBe(90);
  });

  it('halves duration for warmups', () => {
    expect(suggestRestSeconds({ reps: 3, is_warmup: true }, 120)).toBe(60);
  });

  it('doubles duration for heavy sets', () => {
    expect(suggestRestSeconds({ reps: 5, is_warmup: false }, 90)).toBe(180);
  });

  it('shortens duration for high reps', () => {
    expect(suggestRestSeconds({ reps: 20, is_warmup: false }, 100)).toBe(70);
  });

  it('is based on user preference', () => {
    const short = suggestRestSeconds({ reps: 10, is_warmup: false }, 60);
    const long = suggestRestSeconds({ reps: 10, is_warmup: false }, 180);
    expect(short).toBe(60);
    expect(long).toBe(180);
  });

  it('result always stays within bounds', () => {
    expect(suggestRestSeconds({ reps: 5, is_warmup: false }, 900)).toBe(MAX_REST_SECONDS);
  });
});

describe('restProgress', () => {
  it('returns 0.5 when half is elapsed', () => {
    expect(restProgress(100, 50)).toBe(0.5);
  });

  it('does not exceed the 0..1 range', () => {
    expect(restProgress(100, 200)).toBe(0);
    expect(restProgress(100, -50)).toBe(1);
    expect(restProgress(0, 0)).toBe(1);
  });
});