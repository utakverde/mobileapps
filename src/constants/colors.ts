export const Colors = {
  // Primary palette — SAMELCO II (red & white)
  primary: '#D32F2F',
  primaryDark: '#B71C1C',
  primaryLight: '#E53935',
  primarySurface: '#FFEBEE',

  // Status colors
  success: '#2E7D32',
  successLight: '#E8F5E9',
  warning: '#E65100',
  warningLight: '#FFF3E0',
  error: '#C62828',
  errorLight: '#FFEBEE',
  neutral: '#757575',
  neutralLight: '#F5F5F5',

  // Surface / Background (slightly higher contrast for outdoor / budget phones)
  white: '#FFFFFF',
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceVariant: '#FFF0F0',
  border: '#D5D5D5',
  divider: '#E8E8E8',

  // Text — darker mids for WCAG-friendly contrast on gray surfaces
  textPrimary: '#121212',
  textSecondary: '#353535',
  textMuted: '#5A5A5A',
  textOnPrimary: '#FFFFFF',
  textOnDark: '#FFFFFF',

  // Drawer
  drawerBackground: '#B71C1C',
  drawerText: '#FFFFFF',
  drawerTextMuted: '#FFE4E6',
  drawerActive: 'rgba(255,255,255,0.15)',

  // Neumorphic (soft UI) — light gray canvas, red accents
  neuCanvas: '#E8EAEF',
  neuPlate: '#F4F5F9',
  neuShadowDark: '#A8B0BE',
  neuShadowLight: '#FFFFFF',
  bottomBar: '#1A1A1F',
  bottomBarMuted: '#C8C8D4',

  // Misc
  shadow: 'rgba(0,0,0,0.08)',
  overlay: 'rgba(0,0,0,0.5)',
  transparent: 'transparent',
} as const;

export type ColorKey = keyof typeof Colors;
