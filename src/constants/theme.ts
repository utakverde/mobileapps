import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { Colors } from './colors';

/** Slightly larger default typography for small screens and outdoor use */
const lightFonts = {
  ...MD3LightTheme.fonts,
  displayLarge: { ...MD3LightTheme.fonts.displayLarge, fontWeight: '700' as const },
  bodyLarge: { ...MD3LightTheme.fonts.bodyLarge, fontSize: 17, lineHeight: 24, letterSpacing: 0.15 },
  bodyMedium: { ...MD3LightTheme.fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  bodySmall: { ...MD3LightTheme.fonts.bodySmall, fontSize: 13, lineHeight: 18 },
  labelLarge: { ...MD3LightTheme.fonts.labelLarge, fontSize: 15, fontWeight: '600' as const },
  labelMedium: { ...MD3LightTheme.fonts.labelMedium, fontSize: 13 },
};

const darkFonts = {
  ...MD3DarkTheme.fonts,
  bodyLarge: { ...MD3DarkTheme.fonts.bodyLarge, fontSize: 17, lineHeight: 24 },
  bodyMedium: { ...MD3DarkTheme.fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  labelLarge: { ...MD3DarkTheme.fonts.labelLarge, fontSize: 15, fontWeight: '600' as const },
};

/** SAMELCO II — red & white light theme */
export const SamelcoTheme = {
  ...MD3LightTheme,
  fonts: lightFonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.primary,
    primaryContainer: Colors.primarySurface,
    onPrimary: Colors.textOnPrimary,
    onPrimaryContainer: Colors.primaryDark,
    secondary: Colors.primaryDark,
    secondaryContainer: Colors.primarySurface,
    onSecondary: Colors.textOnPrimary,
    surface: Colors.surface,
    surfaceVariant: Colors.surfaceVariant,
    background: Colors.background,
    onBackground: Colors.textPrimary,
    onSurface: Colors.textPrimary,
    onSurfaceVariant: Colors.textSecondary,
    outline: Colors.border,
    error: Colors.error,
    errorContainer: Colors.errorLight,
  },
  roundness: 3,
};

/** Dark mode tuned for red primary accents */
export const SamelcoDarkTheme = {
  ...MD3DarkTheme,
  fonts: darkFonts,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#EF5350',
    primaryContainer: '#B71C1C',
    onPrimary: Colors.textOnPrimary,
    secondary: '#FF8A80',
    surface: '#252222',
    surfaceVariant: '#2E2A2A',
    background: '#151212',
    onBackground: '#FAFAFA',
    onSurface: '#FAFAFA',
    onSurfaceVariant: '#D4D4D4',
    outline: '#6E6E6E',
    outlineVariant: '#4A4A4A',
  },
  roundness: 3,
};
