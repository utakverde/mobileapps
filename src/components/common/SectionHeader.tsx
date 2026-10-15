import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '@constants/colors';

interface SectionHeaderProps {
  title: string;
  rightContent?: React.ReactNode;
}

export default function SectionHeader({ title, rightContent }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.accent} />
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {rightContent && <View style={styles.right}>{rightContent}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceVariant,
    marginBottom: 2,
  },
  accent: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.primaryDark,
    flex: 1,
  },
  right: {
    marginLeft: 8,
  },
});
