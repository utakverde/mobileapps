import React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';
import { Colors } from '@constants/colors';

type NeuSurfaceProps = ViewProps & {
  /** Smaller radius + lighter shadow */
  compact?: boolean;
};

/**
 * Soft-UI raised plate — neumorphic outset shadow (approximation on RN).
 */
export default function NeuSurface({ style, compact, children, ...rest }: NeuSurfaceProps) {
  return (
    <View
      style={[styles.base, compact ? styles.compactRadius : styles.radius, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.neuPlate,
    ...Platform.select({
      ios: {
        shadowColor: Colors.neuShadowDark,
        shadowOffset: { width: 6, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
      default: {},
    }),
    borderWidth: Platform.select({
      ios: StyleSheet.hairlineWidth,
      android: 1,
      default: 0,
    }),
    borderColor: Platform.select({
      ios: 'rgba(255,255,255,0.65)',
      android: 'rgba(0,0,0,0.08)',
      default: 'transparent',
    }),
  },
  radius: { borderRadius: 22 },
  compactRadius: { borderRadius: 16 },
});
