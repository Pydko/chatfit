export const colors = {
  // Turkuaz - marka rengi
  primary: '#14B8A6',
  primaryDark: '#0F766E',
  primarySoft: '#99F6E4',

  // Acik gri - arka planlar
  background: '#F3F4F6',
  surface: '#FFFFFF',
  surfaceMuted: '#E5E7EB',
  border: '#D1D5DB',

  // Metin
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textOnPrimary: '#FFFFFF',

  // Durumlar
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
} as const;

export type ColorKey = keyof typeof colors;