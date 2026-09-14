import { cmToInch, formatWeight, kgToLb, lbToKg } from './units';

describe('kgToLb', () => {
  it('kilogrami pounda cevirir', () => {
    expect(kgToLb(100)).toBe(220.5);
  });

  it('sifiri korur', () => {
    expect(kgToLb(0)).toBe(0);
  });
});

describe('lbToKg', () => {
  it('poundu kilograma cevirir', () => {
    expect(lbToKg(220.5)).toBeCloseTo(100, 1);
  });

  it('cevrim ileri geri tutarli', () => {
    expect(lbToKg(kgToLb(80))).toBeCloseTo(80, 1);
  });
});

describe('cmToInch', () => {
  it('santimi ince cevirir', () => {
    expect(cmToInch(180)).toBe(70.9);
  });
});

describe('formatWeight', () => {
  it('metrik sistemde kg gosterir', () => {
    expect(formatWeight(80, 'metric')).toBe('80 kg');
  });

  it('imperial sistemde lb gosterir', () => {
    expect(formatWeight(80, 'imperial')).toBe('176.4 lb');
  });
});