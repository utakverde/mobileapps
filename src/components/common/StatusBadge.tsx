import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '@constants/colors';
import type { ConsumerStatus } from '@constants/types';

interface StatusBadgeProps {
  status: ConsumerStatus;
  size?: 'small' | 'medium';
}

const STATUS_CONFIG: Record<ConsumerStatus, { label: string; bg: string; text: string }> = {
  unread:       { label: 'UNREAD',       bg: Colors.neutralLight,  text: Colors.neutral },
  read:         { label: 'READ',         bg: Colors.warningLight,  text: Colors.warning },
  paid:         { label: 'PAID',         bg: Colors.successLight,  text: Colors.success },
  disconnected: { label: 'DISCONNECTED', bg: Colors.errorLight,    text: Colors.error },
  problem:      { label: 'PROBLEM',      bg: '#FFF8E1',            text: '#F9A825' },
};

export default function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const isSmall = size === 'small';

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, isSmall && styles.small]}>
      <Text
        style={[
          styles.label,
          { color: cfg.text },
          isSmall && styles.labelSmall,
        ]}
        numberOfLines={1}
      >
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  labelSmall: {
    fontSize: 9,
  },
});
