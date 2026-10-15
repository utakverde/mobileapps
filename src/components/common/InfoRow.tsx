import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '@constants/colors';

interface InfoRowProps {
  label: string;
  value: string | number;
  valueColor?: string;
  bold?: boolean;
  large?: boolean;
}

export default function InfoRow({ label, value, valueColor, bold, large }: InfoRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          styles.value,
          valueColor ? { color: valueColor } : undefined,
          bold && styles.valueBold,
          large && styles.valueLarge,
        ]}
      >
        {value ?? '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.3,
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '400',
    flex: 1.2,
    textAlign: 'right',
  },
  valueBold: {
    fontWeight: '700',
  },
  valueLarge: {
    fontSize: 18,
  },
});
