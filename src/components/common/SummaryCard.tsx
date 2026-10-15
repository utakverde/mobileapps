import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@constants/colors';

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color?: string;
  bgColor?: string;
  subtitle?: string;
}

export default function SummaryCard({
  label,
  value,
  icon,
  color = Colors.primary,
  bgColor = Colors.primarySurface,
  subtitle,
}: SummaryCardProps) {
  return (
    <Card style={styles.card} elevation={1}>
      <Card.Content style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.label}>{label}</Text>
          <Text style={[styles.value, { color }]}>{value}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 4,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
});
