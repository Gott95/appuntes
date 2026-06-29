export const Colors = {
  light: {
    primary: '#0891b2',
    primaryLight: '#22d3ee',
    primaryDark: '#0e7490',
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceVariant: '#f1f5f9',
    text: '#0f172a',
    textSecondary: '#64748b',
    textTertiary: '#94a3b8',
    border: '#e2e8f0',
    borderLight: '#f1f5f9',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    income: '#10b981',
    expense: '#ef4444',
    shadow: '#0f172a',
  },
  dark: {
    primary: '#22d3ee',
    primaryLight: '#67e8f9',
    primaryDark: '#0891b2',
    background: '#0f172a',
    surface: '#1e293b',
    surfaceVariant: '#334155',
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    textTertiary: '#64748b',
    border: '#334155',
    borderLight: '#1e293b',
    success: '#34d399',
    error: '#f87171',
    warning: '#fbbf24',
    income: '#34d399',
    expense: '#f87171',
    shadow: '#000000',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 14,
  base: 15,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 28,
};

export const FontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
