import { describe, expect, it } from '@jest/globals';

import { localIsoDate, parseDecimal, validateHeight, validateMetricForm } from './schemas';

const TODAY = '2026-09-11';

function form(weightText: string, bodyFatText = '', measuredOn = TODAY) {
  return validateMetricForm({ measuredOn, weightText, bodyFatText }, TODAY);
}

describe('localIsoDate', () => {
  it('ay ve gunu sifirla doldurur', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 1, 30))).toBe('2026-01-05');
  });

  it('gece yarisina yakin saatte yerel gunu korur', () => {
    expect(localIsoDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('parseDecimal', () => {
  it('virgullu ondalik kabul eder', () => {
    expect(parseDecimal('80,5')).toBe(80.5);
  });

  it('bosluklari temizler', () => {
    expect(parseDecimal('  80.5 ')).toBe(80.5);
  });

  it('bos metinde null', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('   ')).toBeNull();
  });

  it('sayi olmayan metinde NaN', () => {
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('-5')).toBeNaN();
    expect(parseDecimal('80,5,1')).toBeNaN();
  });
});

describe('validateMetricForm', () => {
  it('gecerli kilo ve yag oranini kabul eder', () => {
    expect(form('80,5', '18')).toEqual({
      ok: true,
      data: { measured_on: TODAY, weight_kg: 80.5, body_fat_pct: 18 },
    });
  });

  it('sadece yag orani girilebilir', () => {
    expect(form('', '20').ok).toBe(true);
  });

  it('iki alan da bossa hata', () => {
    expect(form('', '').ok).toBe(false);
  });

  it('aralik disi kiloda hata', () => {
    expect(form('15').ok).toBe(false);
    expect(form('401').ok).toBe(false);
  });

  it('aralik disi yag oraninda hata', () => {
    expect(form('', '2').ok).toBe(false);
    expect(form('', '71').ok).toBe(false);
  });

  it('gecersiz sayida hata', () => {
    expect(form('abc').ok).toBe(false);
  });

  it('gelecek tarihte hata', () => {
    expect(form('80', '', '2026-09-12').ok).toBe(false);
  });

  it('gecmis tarih kabul edilir', () => {
    expect(form('80', '', '2026-09-01').ok).toBe(true);
  });

  it('bozuk tarih formatinda hata', () => {
    expect(form('80', '', '11.09.2026').ok).toBe(false);
  });
});

describe('validateHeight', () => {
  it('gecerli boyu kabul eder', () => {
    expect(validateHeight('180')).toEqual({ ok: true, data: 180 });
    expect(validateHeight('175,5')).toEqual({ ok: true, data: 175.5 });
  });

  it('aralik disi veya bos girdide hata', () => {
    expect(validateHeight('50').ok).toBe(false);
    expect(validateHeight('').ok).toBe(false);
    expect(validateHeight('abc').ok).toBe(false);
  });
});