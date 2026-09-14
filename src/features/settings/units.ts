export type UnitSystem = 'metric' | 'imperial';

export const LB_PER_KG = 2.2046226218;

export function kgToLb(kg: number): number {
  return Math.round(kg * LB_PER_KG * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 100) / 100;
}

export function cmToInch(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}

/** Depolama her zaman kg; gosterim kullanicinin tercihine gore degisir. */
export function formatWeight(kg: number, unit: UnitSystem): string {
  return unit === 'imperial' ? `${kgToLb(kg)} lb` : `${kg} kg`;
}