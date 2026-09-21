export const colors = {
  // Turquoise - brand color
  primary: '#14B8A6',
  primaryDark: '#0F766E',
  primarySoft: '#99F6E4',

  // Light gray - backgrounds
  background: '#F3F4F6',
  surface: '#FFFFFF',
  surfaceMuted: '#E5E7EB',
  border: '#D1D5DB',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textOnPrimary: '#FFFFFF',

  // Statuses
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
} as const;

export type ColorKey = keyof typeof colors;