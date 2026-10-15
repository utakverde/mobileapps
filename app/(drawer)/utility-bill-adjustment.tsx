import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NeuSurface from '@components/ui/NeuSurface';
import DashboardNeuHeader from '@components/layout/DashboardNeuHeader';
import SummaryCard from '@components/common/SummaryCard';
import { Colors } from '@constants/colors';
import type { Consumer } from '@constants/types';
import { getReportSummary, listConsumers } from '../../database/consumerRepository';
import { getActiveReadingMode } from '@lib/session';

function money(value: number): string {
  return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function buildFlags(consumers: Consumer[]) {
  const zeroKwhPosted = consumers.filter((item) => Number(item.totalDue || 0) > 0 && Number(item.kwhUsed || 0) <= 0);
  const negativeOrZero = consumers.filter((item) => Number(item.totalDue || 0) <= 0 && item.status !== 'unread');
  const lifelineSensitive = consumers.filter((item) => /lifeline/i.test(`${item.rateCode} ${item.remarks} ${item.name}`));
  const seniorSensitive = consumers.filter((item) => /senior/i.test(`${item.rateCode} ${item.remarks} ${item.name}`));
  const billReady = consumers.filter((item) => item.currentReading != null && item.status !== 'paid');
  return { zeroKwhPosted, negativeOrZero, lifelineSensitive, seniorSensitive, billReady };
}

export default function UtilityBillAdjustmentScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeMode = getActiveReadingMode();
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState<any | null>(null);
  const [consumers, setConsumers] = useState<Consumer[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getReportSummary(db, { mode: activeMode }),
      listConsumers(db, { limit: 1000, mode: activeMode }),
    ])
      .then(([report, rows]) => {
        if (!alive) return;
        setSummary(report);
        setConsumers(rows);
      })
      .catch(() => {
        if (alive) {
          setSummary(null);
          setConsumers([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [activeMode, db]);

  const stats = summary?.stats || {};
  const flags = useMemo(() => buildFlags(consumers), [consumers]);
  const adjustmentCandidates = useMemo(() => {
    const set = new Set<string>();
    [...flags.zeroKwhPosted, ...flags.negativeOrZero, ...flags.lifelineSensitive, ...flags.seniorSensitive].forEach((item) => set.add(item.id));
    return consumers.filter((item) => set.has(item.id));
  }, [consumers, flags]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return adjustmentCandidates;
    return adjustmentCandidates.filter((item) => {
      const blob = [item.accountNumber, item.name, item.address, item.rateCode, item.billMonth, item.remarks]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [adjustmentCandidates, query]);

  const totalDue = consumers.reduce((sum, item) => sum + Number(item.totalDue || 0), 0);
  const totalKwh = consumers.reduce((sum, item) => sum + Number(item.kwhUsed || 0), 0);
  const avgBill = consumers.length ? totalDue / consumers.length : 0;
  const avgKwh = consumers.length ? totalKwh / consumers.length : 0;
  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Bill Update / Adjustment" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="file-document-edit-outline" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Bill correction workspace</Text>
              <Text style={styles.heroText}>
                Surface the bills that most likely need a correction, then jump to the existing correction preview
                screen where preview SQL and rollback SQL are already defined.
              </Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <SummaryCard label="Adjustment Candidates" value={adjustmentCandidates.length} icon="clipboard-edit" />
            <SummaryCard label="Zero-kWh" value={flags.zeroKwhPosted.length} icon="flash-off" />
            <SummaryCard label="Avg Bill" value={money(avgBill)} icon="calculator" />
            <SummaryCard label="Avg kWh" value={avgKwh.toFixed(1)} icon="chart-bar" />
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Adjustment Guardrails</Text>
            <View style={styles.ruleList}>
              <Text style={styles.ruleItem}>- Use the same bill computation path as bill creation.</Text>
              <Text style={styles.ruleItem}>- Preserve original values in audit history.</Text>
              <Text style={styles.ruleItem}>- Generate rollback SQL before any write.</Text>
              <Text style={styles.ruleItem}>- Prevent duplicate corrections for the same bill month.</Text>
              <Text style={styles.ruleItem}>- Keep a stable transaction identifier per correction.</Text>
            </View>
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Adjustment Health Checks</Text>
            <View style={styles.checkGrid}>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Lifeline-sensitive</Text>
                <Text style={styles.checkValue}>{flags.lifelineSensitive.length}</Text>
                <Text style={styles.checkNote}>May need subsidy or discount review.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Senior-sensitive</Text>
                <Text style={styles.checkValue}>{flags.seniorSensitive.length}</Text>
                <Text style={styles.checkNote}>May need 5% or subsidy review.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Zero-kWh Bills</Text>
                <Text style={styles.checkValue}>{flags.zeroKwhPosted.length}</Text>
                <Text style={styles.checkNote}>Charges exist but usage is zero or missing.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Non-positive Totals</Text>
                <Text style={styles.checkValue}>{flags.negativeOrZero.length}</Text>
                <Text style={styles.checkNote}>Likely settled, reversed, or needing correction.</Text>
              </View>
            </View>
            <Text style={styles.panelSub}>
              Collection coverage: {Number(stats.totalAmountDue || 0) > 0
                ? `${((Number(stats.totalCollectionMonth || 0) / Number(stats.totalAmountDue || 0)) * 100).toFixed(1)}%`
                : 'N/A'}
            </Text>
          </NeuSurface>
        </View>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Candidate Rows</Text>
          <Text style={styles.panelSub}>
            Open a row to continue into the existing bill correction preview and SQL bundle.
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search account, name, rate, bill month, or remark"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <FlatList
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.rowCard}
                onPress={() => router.push(`/(drawer)/utility-bill-correction/${item.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.rowTop}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowTitle}>{item.accountNumber}</Text>
                    <Text style={styles.rowMeta}>{item.name}</Text>
                    <Text style={styles.rowMeta}>{item.address}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.statusChip}>Adjustment</Text>
                    <Text style={styles.rowValue}>{item.rateCode || 'No rate'}</Text>
                  </View>
                </View>
                <View style={styles.rowGrid}>
                  <View style={styles.rowMetric}>
                    <Text style={styles.rowMetricLabel}>Current Reading</Text>
                    <Text style={styles.rowMetricValue}>{item.currentReading == null ? 'N/A' : item.currentReading}</Text>
                  </View>
                  <View style={styles.rowMetric}>
                    <Text style={styles.rowMetricLabel}>kWh</Text>
                    <Text style={styles.rowMetricValue}>{item.kwhUsed == null ? 'N/A' : item.kwhUsed.toFixed(1)}</Text>
                  </View>
                  <View style={styles.rowMetric}>
                    <Text style={styles.rowMetricLabel}>Bill</Text>
                    <Text style={styles.rowMetricValue}>{money(Number(item.billAmount || 0))}</Text>
                  </View>
                  <View style={styles.rowMetric}>
                    <Text style={styles.rowMetricLabel}>Due</Text>
                    <Text style={styles.rowMetricValue}>{money(Number(item.totalDue || 0))}</Text>
                  </View>
                </View>
                <Text style={styles.rowNote}>
                  {item.currentReading == null
                    ? 'No reading posted yet.'
                    : 'Candidate for bill update, correction, or audit review.'}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="database-search" size={42} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No adjustment candidates matched</Text>
                <Text style={styles.emptyText}>Try another search or verify bill rows in SQLite.</Text>
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
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  grid: {
    gap: 16,
  },
  panel: {
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  panelSub: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  ruleList: {
    gap: 6,
  },
  ruleItem: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  checkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  checkCard: {
    flexBasis: '48%',
    minWidth: 150,
    borderRadius: 16,
    backgroundColor: Colors.white,
    padding: 12,
    gap: 4,
  },
  checkTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  checkValue: {
    fontSize: 18,
    color: Colors.textPrimary,
    fontWeight: '900',
  },
  checkNote: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  searchInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(183,28,28,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    color: Colors.textPrimary,
  },
  rowCard: {
    borderRadius: 16,
    backgroundColor: Colors.white,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    gap: 4,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  rowMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  statusChip: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    backgroundColor: 'rgba(183,28,28,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  rowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowMetric: {
    flexBasis: '23%',
    minWidth: 72,
    borderRadius: 12,
    backgroundColor: 'rgba(183,28,28,0.04)',
    padding: 10,
    gap: 4,
  },
  rowMetricLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  rowMetricValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '900',
  },
  rowNote: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
