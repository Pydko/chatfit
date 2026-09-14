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
  it('dakika ve saniyeyi ayirir', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(120)).toBe('2:00');
  });

  it('saniyeyi iki haneye tamamlar', () => {
    expect(formatDuration(61)).toBe('1:01');
  });

  it('negatif degeri sifir sayar', () => {
    expect(formatDuration(-10)).toBe('0:00');
  });
});

describe('remainingSeconds', () => {
  it('kalan saniyeyi yukari yuvarlar', () => {
    expect(remainingSeconds(10_500, 0)).toBe(11);
  });

  it('gecmis bir bitis icin 0 doner', () => {
    expect(remainingSeconds(1_000, 5_000)).toBe(0);
  });
});

describe('clampRest', () => {
  it('alt siniri uygular', () => {
    expect(clampRest(5)).toBe(MIN_REST_SECONDS);
  });

  it('ust siniri uygular', () => {
    expect(clampRest(5000)).toBe(MAX_REST_SECONDS);
  });

  it('gecerli degeri korur', () => {
    expect(clampRest(90)).toBe(90);
  });

  it('gecersiz sayida alt sinira duser', () => {
    expect(clampRest(Number.NaN)).toBe(MIN_REST_SECONDS);
  });
});

describe('suggestRestSeconds', () => {
  it('varsayilan 90 saniye ile calisir', () => {
    expect(suggestRestSeconds({ reps: 10, is_warmup: false })).toBe(90);
  });

  it('isinma icin sureyi yariya indirir', () => {
    expect(suggestRestSeconds({ reps: 3, is_warmup: true }, 120)).toBe(60);
  });

  it('agir setlerde sureyi iki katina cikarir', () => {
    expect(suggestRestSeconds({ reps: 5, is_warmup: false }, 90)).toBe(180);
  });

  it('yuksek tekrarda sureyi kisaltir', () => {
    expect(suggestRestSeconds({ reps: 20, is_warmup: false }, 100)).toBe(70);
  });

  it('kullanicinin tercihini temel alir', () => {
    const short = suggestRestSeconds({ reps: 10, is_warmup: false }, 60);
    const long = suggestRestSeconds({ reps: 10, is_warmup: false }, 180);
    expect(short).toBe(60);
    expect(long).toBe(180);
  });

  it('sonuc her zaman sinirlar icinde kalir', () => {
    expect(suggestRestSeconds({ reps: 5, is_warmup: false }, 900)).toBe(MAX_REST_SECONDS);
  });
});

describe('restProgress', () => {
  it('yarisi gectiginde 0.5 doner', () => {
    expect(restProgress(100, 50)).toBe(0.5);
  });

  it('0..1 araligini asmaz', () => {
    expect(restProgress(100, 200)).toBe(0);
    expect(restProgress(100, -50)).toBe(1);
    expect(restProgress(0, 0)).toBe(1);
  });
});