import type { SetLog } from '@/types/workout';
import { describe, expect, it } from '@jest/globals';
import {
  analyzeTrend,
  buildTrend,
  estimateWeeksToTarget,
} from './trend';

function makeSet(
  weight: number,
  reps: number,
  sessionId: string,
  daysAgo = 0,
  isWarmup = false,
): SetLog {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  
  return {
    id: `s-${weight}-${reps}-${Math.random()}`,
    user_id: 'u1',
    session_id: sessionId,
    exercise_id: 'ex1',
    set_index: 1,
    weight_kg: weight,
    reps,
    rpe: null,
    is_warmup: isWarmup,
    performed_at: date.toISOString(),
  };
}

describe('buildTrend', () => {
  it("seansa göre gruplayıp her seansın özetini çıkarır", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 0),
      makeSet(80, 5, 'sess1', 0),
      makeSet(70, 8, 'sess2', 7),
    ];
    const points = buildTrend(sets);

    expect(points.length).toBe(2);
    // 'toBeLessThanOrEqual' yerine tam ağırlık beklentisi (toBe) kullanmak daha sağlıklıdır.
    expect(points[0].topWeight).toBe(70); 
    expect(points[1].topWeight).toBe(80);
  });

  it("ısınma setlerini dışarıda bırakır", () => {
    const sets = [
      makeSet(20, 10, 'sess1', 0, true), // ısınma seti
      makeSet(80, 5, 'sess1', 0),
    ];
    const points = buildTrend(sets);

    expect(points.length).toBe(1);
    expect(points[0].topWeight).toBe(80);
  });

  it("tarih sırasına göre sıralar", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 0),  // En yeni
      makeSet(70, 8, 'sess2', 14), // En eski
      makeSet(75, 6, 'sess3', 7),  // Ortanca
    ];
    const points = buildTrend(sets);

    expect(points.length).toBe(3);
    expect(points[0].topWeight).toBe(70); // 14 gün önceki
    expect(points[1].topWeight).toBe(75); // 7 gün önceki (eksikti eklendi)
    expect(points[2].topWeight).toBe(80); // Bugünkü
  });
});

describe('analyzeTrend', () => {
  it("3 antrenman altında insufficient döner", () => {
    const sets = [makeSet(80, 5, 'sess1', 0)];
    const trend = analyzeTrend(sets);

    expect(trend.direction).toBe('insufficient');
    expect(trend.summary).toContain('3');
  });

  it("yukarıya doğru trend tespit eder", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 28),
      makeSet(85, 5, 'sess2', 21),
      makeSet(90, 5, 'sess3', 14),
      makeSet(95, 5, 'sess4', 7),
    ];
    const trend = analyzeTrend(sets);

    expect(trend.direction).toBe('up');
    expect(trend.changePercent).toBeGreaterThan(0);
    expect(trend.summary).toContain('artmis');
  });

  it("aşağıya doğru trend tespit eder", () => {
    const sets = [
      makeSet(100, 5, 'sess1', 28),
      makeSet(95, 5, 'sess2', 21),
      makeSet(90, 5, 'sess3', 14),
      makeSet(85, 5, 'sess4', 7),
    ];
    const trend = analyzeTrend(sets);

    expect(trend.direction).toBe('down');
    expect(trend.changePercent).toBeLessThan(0);
    expect(trend.summary).toContain('dusmus');
  });

  it("flat trend (%2 toleransı)", () => {
    const sets = [
      makeSet(90, 5, 'sess1', 14),
      makeSet(90.5, 5, 'sess2', 7),
      makeSet(89.8, 5, 'sess3', 0),
    ];
    const trend = analyzeTrend(sets);

    expect(trend.direction).toBe('flat');
  });

  it("son 6 seansa bakar (varsayılan pencere)", () => {
    const sets = [
      makeSet(70, 5, 'sess1', 49),
      makeSet(75, 5, 'sess2', 42),
      makeSet(80, 5, 'sess3', 35),
      makeSet(85, 5, 'sess4', 28),
      makeSet(90, 5, 'sess5', 21),
      makeSet(95, 5, 'sess6', 14),
      makeSet(100, 5, 'sess7', 7), // Toplam 7 antrenman
    ];

    const trend = analyzeTrend(sets);
    // En fazla 6 veri noktası alındığından emin oluyoruz
    expect(trend.points.length).toBeLessThanOrEqual(6); 
  });
});

describe('estimateWeeksToTarget', () => {
  it("4 antrenman altında tahmin yapamaz", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 14),
      makeSet(85, 5, 'sess2', 7),
      makeSet(90, 5, 'sess3', 0),
    ];
    const result = estimateWeeksToTarget(sets, 110);

    expect(result.weeks).toBeNull();
    expect(result.note).toContain('4');
  });

  it("hedef zaten ulaşılmışsa weeks = 0 döner", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 28),
      makeSet(85, 5, 'sess2', 21),
      makeSet(90, 5, 'sess3', 14),
      makeSet(110, 5, 'sess4', 7),
    ];
    const result = estimateWeeksToTarget(sets, 100); // Hedef 100, ulaşılan 110

    expect(result.weeks).toBe(0);
  });

  it("ilerleme hızını temel alarak hafta tahmini yapar", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 28),
      makeSet(85, 5, 'sess2', 21),
      makeSet(90, 5, 'sess3', 14),
      makeSet(100, 5, 'sess4', 7),
    ];
    const result = estimateWeeksToTarget(sets, 120);

    expect(result.weeks).toBeLessThanOrEqual(5);
    expect(result.weeks).toBeGreaterThanOrEqual(3);
  });

  it("geri ilerleme varsa null döner", () => {
    const sets = [
      makeSet(100, 5, 'sess1', 21),
      makeSet(95, 5, 'sess2', 14),
      makeSet(90, 5, 'sess3', 7),
      makeSet(80, 5, 'sess4', 0), // Ağırlık sürekli düşmüş
    ];
    const result = estimateWeeksToTarget(sets, 150);

    expect(result.weeks).toBeNull();
    expect(result.note).toContain('hizi hesaplanamiyor');
  });

  it("1 haftadan kısa veri için tahmin yapamaz", () => {
    const sets = [
      makeSet(80, 5, 'sess1', 0),
      makeSet(85, 5, 'sess2', 0),
      makeSet(90, 5, 'sess3', 0),
      makeSet(100, 5, 'sess4', 0),
    ];
    const result = estimateWeeksToTarget(sets, 120);

    expect(result.weeks).toBeNull();
  });
});