import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NeuSurface from '@components/ui/NeuSurface';
import DashboardNeuHeader from '@components/layout/DashboardNeuHeader';
import ConsumerCard from '@components/common/ConsumerCard';
import SummaryCard from '@components/common/SummaryCard';
import { Colors } from '@constants/colors';
import type { Consumer, ConsumerStatus } from '@constants/types';
import { listConsumers } from '../../database/consumerRepository';
import { getActiveReadingMode } from '@lib/session';

const FILTERS: { label: string; value: ConsumerStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
  { label: 'Paid', value: 'paid' },
  { label: 'Problem', value: 'problem' },
];

function money(value: number): string {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function buildAnomalies(consumers: Consumer[]) {
  const anomalies: { key: string; title: string; description: string; count: number }[] = [];
  const missingReading = consumers.filter((c) => c.status === 'read' && c.currentReading == null);
  const zeroKwhPosted = consumers.filter((c) => Number(c.kwhUsed || 0) <= 0 && Number(c.totalDue || 0) > 0);
  const lifelineCandidates = consumers.filter((c) => /lifeline/i.test(`${c.rateCode} ${c.remarks} ${c.name}`));
  const negativeOrZeroBill = consumers.filter((c) => Number(c.totalDue || 0) <= 0 && c.status !== 'unread');
  const disconnectedButBilled = consumers.filter((c) => c.status === 'disconnected' && Number(c.totalDue || 0) > 0);

  if (missingReading.length) {
    anomalies.push({
      key: 'missing-reading',
      title: 'Missing posted reading',
      description: 'Accounts marked as read but without a persisted current reading.',
      count: missingReading.length,
    });
  }
  if (zeroKwhPosted.length) {
    anomalies.push({
      key: 'zero-kwh',
      title: 'Zero kWh with posted bill',
      description: 'Accounts with a bill amount but no computed consumption.',
      count: zeroKwhPosted.length,
    });
  }
  if (lifelineCandidates.length) {
    anomalies.push({
      key: 'lifeline',
      title: 'Lifeline-sensitive accounts',
      description: 'Accounts that may need discount or subsidy validation before posting.',
      count: lifelineCandidates.length,
    });
  }
  if (negativeOrZeroBill.length) {
    anomalies.push({
      key: 'nonpositive',
      title: 'Non-positive totals',
      description: 'Rows that are already settled, zeroed, or need correction before report export.',
      count: negativeOrZeroBill.length,
    });
  }
  if (disconnectedButBilled.length) {
    anomalies.push({
      key: 'disconnected',
      title: 'Disconnected but billed',
      description: 'Disconnected accounts still carrying payable balances or bill snapshots.',
      count: disconnectedButBilled.length,
    });
  }

  return anomalies;
}

export default function UtilityConsumersScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const activeMode = getActiveReadingMode();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ConsumerStatus | 'all'>('all');
  const [rows, setRows] = useState<Consumer[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    listConsumers(db, { limit: 1000, mode: activeMode })
      .then((items: Consumer[]) => {
        if (alive) setRows(items);
      })
      .catch(() => {
        if (alive) setRows([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeMode, db]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((item) => {
      const matchFilter = filter === 'all' || item.status === filter;
      const matchQuery =
        !q ||
        item.accountNumber.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q) ||
        item.meterNumber.toLowerCase().includes(q) ||
        item.billMonth.toLowerCase().includes(q);
      return matchFilter && matchQuery;
    });
  }, [filter, query, rows]);

  const anomalies = useMemo(() => buildAnomalies(rows), [rows]);
  const totalDue = useMemo(() => rows.reduce((sum, item) => sum + Number(item.totalDue || 0), 0), [rows]);
  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Consumer and Bill View" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="account-cash" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Shared consumer and bill workspace</Text>
              <Text style={styles.heroText}>
                This screen reuses the desktop billing fields and shows the first anomaly checks for kWh, lifeline,
                and totals without changing the underlying computation.
              </Text>
            </View>
          </View>
          <View style={styles.metrics}>
            <SummaryCard label="Accounts" value={rows.length} icon="account-group" />
            <SummaryCard label="Total Due" value={money(totalDue)} icon="cash" />
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Search and Filter</Text>
            <Text style={styles.panelSubtitle}>{loading ? 'Loading shared billing rows...' : `${filtered.length} rows matched`}</Text>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, account number, meter, bill month"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <View style={styles.filterRow}>
            {FILTERS.map((item) => {
              const active = filter === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setFilter(item.value)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  activeOpacity={0.86}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Anomaly Checks</Text>
            <Text style={styles.panelSubtitle}>Preview-only indicators for correction and reconciliation</Text>
          </View>
          <View style={styles.anomalyGrid}>
            {anomalies.map((item) => (
              <View key={item.key} style={styles.anomalyCard}>
                <View style={styles.anomalyTopRow}>
                  <MaterialCommunityIcons name="alert-rhombus" size={18} color={Colors.warning} />
                  <Text style={styles.anomalyCount}>{item.count}</Text>
                </View>
                <Text style={styles.anomalyTitle}>{item.title}</Text>
                <Text style={styles.anomalyText}>{item.description}</Text>
              </View>
            ))}
            {!anomalies.length && (
              <View style={styles.anomalyCard}>
                <Text style={styles.anomalyTitle}>No obvious anomalies</Text>
                <Text style={styles.anomalyText}>The current rows do not show common posting mismatches.</Text>
              </View>
            )}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Consumer Rows</Text>
            <Text style={styles.panelSubtitle}>Tap a card to continue reading, payment, or complaint workflow</Text>
          </View>
          <FlatList
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ConsumerCard consumer={item} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="database-search" size={42} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No matching consumer rows</Text>
                <Text style={styles.emptyText}>Try another search term or remove the filter.</Text>
              </View>
            }
          />
        </NeuSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  hero: {
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(183,28,28,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  panel: {
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  panelHeader: {
    gap: 3,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  panelSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(183,28,28,0.08)',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  anomalyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  anomalyCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 12,
    gap: 6,
  },
  anomalyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  anomalyCount: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  anomalyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  anomalyText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
