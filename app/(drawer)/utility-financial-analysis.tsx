import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NeuSurface from '@components/ui/NeuSurface';
import DashboardNeuHeader from '@components/layout/DashboardNeuHeader';
import SummaryCard from '@components/common/SummaryCard';
import { Colors } from '@constants/colors';
import type { Consumer } from '@constants/types';
import { getReportSummary, listConsumers } from '../../database/consumerRepository';
import { getActiveReadingMode } from '@lib/session';

type TrendBucket = {
  key: string;
  label: string;
  count: number;
  billTotal: number;
  collectionTotal: number;
  kwhTotal: number;
};

function money(value: number): string {
  return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function buildBuckets(consumers: Consumer[], field: 'billMonth' | 'areaCode' | 'bookNumber' | 'rateCode'): TrendBucket[] {
  const buckets = new Map<string, TrendBucket>();
  for (const consumer of consumers) {
    const key = String(consumer[field] || 'Unknown').trim() || 'Unknown';
    const current = buckets.get(key) || {
      key,
      label: key,
      count: 0,
      billTotal: 0,
      collectionTotal: 0,
      kwhTotal: 0,
    };
    current.count += 1;
    current.billTotal += Number(consumer.totalDue || consumer.billAmount || 0);
    current.kwhTotal += Number(consumer.kwhUsed || 0);
    current.collectionTotal += Number(consumer.status === 'paid' ? consumer.totalDue || consumer.billAmount || 0 : 0);
    buckets.set(key, current);
  }
  return Array.from(buckets.values()).sort((a, b) => b.billTotal - a.billTotal);
}

function buildFlags(consumers: Consumer[]) {
  const lifeline = consumers.filter((c) => /lifeline/i.test(`${c.rateCode} ${c.remarks} ${c.name}`));
  const senior = consumers.filter((c) => /senior/i.test(`${c.rateCode} ${c.remarks} ${c.name}`));
  const zeroKwhBill = consumers.filter((c) => Number(c.billAmount || 0) > 0 && Number(c.kwhUsed || 0) <= 0);
  const disconnectedWithBalance = consumers.filter((c) => c.status === 'disconnected' && Number(c.totalDue || 0) > 0);
  const negativeOrZeroTotals = consumers.filter((c) => Number(c.totalDue || 0) <= 0 && c.status !== 'unread');
  const overdue = consumers.filter((c) => {
    if (!c.dueDate) return false;
    const due = new Date(c.dueDate);
    return Number.isFinite(due.getTime()) && due.getTime() < Date.now() && c.status !== 'paid';
  });
  return { lifeline, senior, zeroKwhBill, disconnectedWithBalance, negativeOrZeroTotals, overdue };
}

export default function UtilityFinancialAnalysisScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const activeMode = getActiveReadingMode();
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState<any | null>(null);
  const [consumers, setConsumers] = useState<Consumer[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([getReportSummary(db, { mode: activeMode }), listConsumers(db, { limit: 1000, mode: activeMode })])
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
  const rateBuckets = useMemo(() => buildBuckets(consumers, 'rateCode'), [consumers]);
  const areaBuckets = useMemo(() => buildBuckets(consumers, 'areaCode'), [consumers]);
  const bookBuckets = useMemo(() => buildBuckets(consumers, 'bookNumber'), [consumers]);
  const monthBuckets = useMemo(() => buildBuckets(consumers, 'billMonth'), [consumers]);

  const filteredRateBuckets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rateBuckets;
    return rateBuckets.filter((bucket) => bucket.key.toLowerCase().includes(q));
  }, [query, rateBuckets]);

  const totalBill = consumers.reduce((sum, item) => sum + Number(item.totalDue || item.billAmount || 0), 0);
  const billedEnergy = consumers.reduce((sum, item) => sum + Number(item.kwhUsed || 0), 0);
  const avgBill = consumers.length > 0 ? totalBill / consumers.length : 0;
  const avgKwh = consumers.length > 0 ? billedEnergy / consumers.length : 0;
  const collectionMonth = Number(stats.totalCollectionMonth || 0);
  const receivableBalance = Math.max(0, Number(stats.totalAmountDue || totalBill) - collectionMonth);
  const variance = collectionMonth - Number(stats.totalAmountDue || totalBill);
  const collectionRate = Number(stats.totalAmountDue || totalBill) > 0 ? collectionMonth / Number(stats.totalAmountDue || totalBill) : 0;
  const lifelineExposure = flags.lifeline.reduce((sum, consumer) => sum + Number(consumer.totalDue || consumer.billAmount || 0), 0);
  const seniorExposure = flags.senior.reduce((sum, consumer) => sum + Number(consumer.totalDue || consumer.billAmount || 0), 0);
  const bottomPad = Math.max(insets.bottom, 12) + 18;
  const topArea = areaBuckets[0];
  const topBook = bookBuckets[0];
  const topMonth = monthBuckets[0];

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Financial Analysis" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="chart-line" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Financial analysis and anomaly review</Text>
              <Text style={styles.heroText}>
                This page compares collections, receivables, rate groups, and kWh patterns so you can spot lifeline,
                senior, zero-kWh, and variance risks before export or correction.
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <SummaryCard label="Consumers" value={consumers.length} icon="account-group" />
            <SummaryCard label="Total Bill" value={money(totalBill)} icon="cash-multiple" />
            <SummaryCard label="Collection" value={money(collectionMonth)} icon="cash" />
            <SummaryCard label="Variance" value={money(variance)} icon="scale-balance" />
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Anomaly Flags</Text>
            <View style={styles.flagGrid}>
              <View style={styles.flagCard}>
                <Text style={styles.flagValue}>{flags.lifeline.length}</Text>
                <Text style={styles.flagLabel}>Lifeline-sensitive</Text>
              </View>
              <View style={styles.flagCard}>
                <Text style={styles.flagValue}>{flags.senior.length}</Text>
                <Text style={styles.flagLabel}>Senior-sensitive</Text>
              </View>
              <View style={styles.flagCard}>
                <Text style={styles.flagValue}>{flags.zeroKwhBill.length}</Text>
                <Text style={styles.flagLabel}>Zero kWh with bill</Text>
              </View>
              <View style={styles.flagCard}>
                <Text style={styles.flagValue}>{flags.overdue.length}</Text>
                <Text style={styles.flagLabel}>Overdue rows</Text>
              </View>
              <View style={styles.flagCard}>
                <Text style={styles.flagValue}>{flags.disconnectedWithBalance.length}</Text>
                <Text style={styles.flagLabel}>Disconnected with balance</Text>
              </View>
              <View style={styles.flagCard}>
                <Text style={styles.flagValue}>{flags.negativeOrZeroTotals.length}</Text>
                <Text style={styles.flagLabel}>Zero or negative totals</Text>
              </View>
            </View>
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Collections and Receivables</Text>
            <View style={styles.checkGrid}>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Collection Rate</Text>
                <Text style={styles.checkValue}>{`${(collectionRate * 100).toFixed(1)}%`}</Text>
                <Text style={styles.checkNote}>Based on summary totals already in SQLite.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Receivable Balance</Text>
                <Text style={styles.checkValue}>{money(receivableBalance)}</Text>
                <Text style={styles.checkNote}>Open balance after current collection month totals.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Expected vs Actual</Text>
                <Text style={styles.checkValue}>{money(variance)}</Text>
                <Text style={styles.checkNote}>Positive means collections exceed due totals; negative means gap.</Text>
              </View>
            </View>
          </NeuSurface>
        </View>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Trend and Variance Signals</Text>
          <View style={styles.sectionRow}>
            <View style={styles.trendCard}>
              <Text style={styles.trendLabel}>Top Month</Text>
              <Text style={styles.trendValue}>{topMonth?.key || 'N/A'}</Text>
              <Text style={styles.trendNote}>{money(topMonth?.billTotal || 0)} due</Text>
            </View>
            <View style={styles.trendCard}>
              <Text style={styles.trendLabel}>Top Area</Text>
              <Text style={styles.trendValue}>{topArea?.key || 'N/A'}</Text>
              <Text style={styles.trendNote}>{money(topArea?.billTotal || 0)} due</Text>
            </View>
            <View style={styles.trendCard}>
              <Text style={styles.trendLabel}>Top Book</Text>
              <Text style={styles.trendValue}>{topBook?.key || 'N/A'}</Text>
              <Text style={styles.trendNote}>{money(topBook?.billTotal || 0)} due</Text>
            </View>
          </View>
          <View style={styles.sectionList}>
            {monthBuckets.slice(0, 5).map((bucket) => (
              <View key={bucket.key} style={styles.bucketCard}>
                <View style={styles.bucketRow}>
                  <View style={styles.bucketLeft}>
                    <Text style={styles.bucketRate}>{bucket.key}</Text>
                    <Text style={styles.bucketMeta}>{bucket.count} account(s)</Text>
                  </View>
                  <View style={styles.bucketRight}>
                    <Text style={styles.bucketBill}>{money(bucket.billTotal)}</Text>
                    <Text style={styles.bucketMeta}>{bucket.kwhTotal.toFixed(1)} kWh</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Rate Analysis</Text>
            <Text style={styles.panelSub}>Filter rate buckets or review the average bill and kWh per rate code.</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search rate code"
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
            />
            <FlatList
              scrollEnabled={false}
              data={filteredRateBuckets}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <View style={styles.bucketCard}>
                  <View style={styles.bucketRow}>
                    <View style={styles.bucketLeft}>
                      <Text style={styles.bucketRate}>{item.key}</Text>
                      <Text style={styles.bucketMeta}>{item.count} consumer(s)</Text>
                    </View>
                    <View style={styles.bucketRight}>
                      <Text style={styles.bucketBill}>{money(item.billTotal)}</Text>
                      <Text style={styles.bucketMeta}>{item.kwhTotal.toFixed(1)} kWh</Text>
                    </View>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="filter-off" size={40} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>No rate buckets matched</Text>
                </View>
              }
            />
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Area and Book Performance</Text>
            <View style={styles.rankList}>
              {areaBuckets.slice(0, 4).map((bucket) => (
                <View key={`area-${bucket.key}`} style={styles.rankCard}>
                  <Text style={styles.rankTitle}>Area {bucket.key}</Text>
                  <Text style={styles.rankMeta}>
                    {bucket.count} account(s) · {money(bucket.billTotal)} due
                  </Text>
                </View>
              ))}
              {bookBuckets.slice(0, 4).map((bucket) => (
                <View key={`book-${bucket.key}`} style={styles.rankCard}>
                  <Text style={styles.rankTitle}>Book {bucket.key}</Text>
                  <Text style={styles.rankMeta}>
                    {bucket.count} account(s) · {money(bucket.billTotal)} due
                  </Text>
                </View>
              ))}
            </View>
          </NeuSurface>
        </View>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Discount and Subsidy Review</Text>
          <View style={styles.checkGrid}>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Lifeline Count</Text>
              <Text style={styles.checkValue}>{flags.lifeline.length}</Text>
              <Text style={styles.checkNote}>Accounts that may need lifeline discount consistency.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Lifeline Exposure</Text>
              <Text style={styles.checkValue}>{money(lifelineExposure)}</Text>
              <Text style={styles.checkNote}>Aggregate amount tied to lifeline-sensitive rows.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Senior Count</Text>
              <Text style={styles.checkValue}>{flags.senior.length}</Text>
              <Text style={styles.checkNote}>Accounts that may require senior discount handling.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Senior Exposure</Text>
              <Text style={styles.checkValue}>{money(seniorExposure)}</Text>
              <Text style={styles.checkNote}>Aggregate amount tied to senior-sensitive rows.</Text>
            </View>
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Operational Checks</Text>
          <View style={styles.checkGrid}>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Bill Spread</Text>
              <Text style={styles.checkValue}>{money(avgBill)}</Text>
              <Text style={styles.checkNote}>Average amount due across the current selection.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>kWh Spread</Text>
              <Text style={styles.checkValue}>{avgKwh.toFixed(1)}</Text>
              <Text style={styles.checkNote}>Average consumption used to spot outliers and zero-postings.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Null or Zero Risk</Text>
              <Text style={styles.checkValue}>{flags.zeroKwhBill.length}</Text>
              <Text style={styles.checkNote}>Bills with positive charges but zero or missing kWh.</Text>
            </View>
          </View>
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
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  panelSub: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  flagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flagCard: {
    flexGrow: 1,
    flexBasis: 150,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 4,
  },
  flagValue: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  flagLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  checkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  checkCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 4,
  },
  checkTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  checkValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  checkNote: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  sectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trendCard: {
    flexGrow: 1,
    flexBasis: 160,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 4,
  },
  trendLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  trendValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  trendNote: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sectionList: {
    gap: 10,
  },
  bucketCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  bucketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  bucketLeft: {
    flex: 1,
    gap: 2,
  },
  bucketRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  bucketRate: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  bucketBill: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  bucketMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 22,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
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
  rankList: {
    gap: 10,
  },
  rankCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  rankTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  rankMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
});
