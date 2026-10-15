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

type RateBucket = {
  rate: string;
  count: number;
  totalBill: number;
  totalKwh: number;
  lifelineCount: number;
  seniorCount: number;
  zeroKwhCount: number;
};

function money(value: number): string {
  return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function buildBuckets(consumers: Consumer[]): RateBucket[] {
  const buckets = new Map<string, RateBucket>();
  for (const consumer of consumers) {
    const rate = consumer.rateCode || 'Unknown';
    const current =
      buckets.get(rate) || {
        rate,
        count: 0,
        totalBill: 0,
        totalKwh: 0,
        lifelineCount: 0,
        seniorCount: 0,
        zeroKwhCount: 0,
      };

    const bill = Number(consumer.totalDue || consumer.billAmount || 0);
    const kwh = Number(consumer.kwhUsed || 0);
    current.count += 1;
    current.totalBill += bill;
    current.totalKwh += kwh;
    if (/lifeline/i.test(`${consumer.rateCode} ${consumer.remarks} ${consumer.name}`)) current.lifelineCount += 1;
    if (/senior/i.test(`${consumer.rateCode} ${consumer.remarks} ${consumer.name}`)) current.seniorCount += 1;
    if (bill > 0 && kwh <= 0) current.zeroKwhCount += 1;
    buckets.set(rate, current);
  }

  return Array.from(buckets.values()).sort((a, b) => b.count - a.count || a.rate.localeCompare(b.rate));
}

export default function UtilityRatesSchedulesScreen() {
  const db = useSQLiteContext();
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
  const assignment = summary?.assignment || {};
  const buckets = useMemo(() => buildBuckets(consumers), [consumers]);
  const filteredBuckets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buckets;
    return buckets.filter((bucket) => bucket.rate.toLowerCase().includes(q));
  }, [query, buckets]);

  const totalBill = consumers.reduce((sum, item) => sum + Number(item.totalDue || item.billAmount || 0), 0);
  const totalKwh = consumers.reduce((sum, item) => sum + Number(item.kwhUsed || 0), 0);
  const avgBill = consumers.length > 0 ? totalBill / consumers.length : 0;
  const avgKwh = consumers.length > 0 ? totalKwh / consumers.length : 0;
  const distinctRates = buckets.length;
  const lifelineConsumers = buckets.reduce((sum, item) => sum + item.lifelineCount, 0);
  const seniorConsumers = buckets.reduce((sum, item) => sum + item.seniorCount, 0);
  const zeroKwhBills = buckets.reduce((sum, item) => sum + item.zeroKwhCount, 0);
  const scheduleCoverage = [assignment.prevReadingDate, assignment.presentReadingDate, assignment.dueDate, assignment.disconnectionDate]
    .filter(Boolean)
    .length;
  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Rates & Scheduling" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="cash-lock" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Rates and schedule reference</Text>
              <Text style={styles.heroText}>
                Mirror the desktop finance references for ERC, tax, reading, due, and disconnection schedules before
                any future write flow is enabled.
              </Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <SummaryCard label="Consumers" value={consumers.length} icon="account-group" />
            <SummaryCard label="Distinct Rates" value={distinctRates} icon="tag-multiple" />
            <SummaryCard label="Avg Bill" value={money(avgBill)} icon="calculator" />
            <SummaryCard label="Avg kWh" value={avgKwh.toFixed(1)} icon="chart-bar" />
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Schedule Snapshot</Text>
            <View style={styles.scheduleGrid}>
              <View style={styles.scheduleCard}>
                <Text style={styles.scheduleLabel}>Area</Text>
                <Text style={styles.scheduleValue}>{assignment.areaName || 'Not available'}</Text>
              </View>
              <View style={styles.scheduleCard}>
                <Text style={styles.scheduleLabel}>Book</Text>
                <Text style={styles.scheduleValue}>{assignment.bookNumber || 'Not available'}</Text>
              </View>
              <View style={styles.scheduleCard}>
                <Text style={styles.scheduleLabel}>Bill Month</Text>
                <Text style={styles.scheduleValue}>{assignment.billMonth || 'Not available'}</Text>
              </View>
              <View style={styles.scheduleCard}>
                <Text style={styles.scheduleLabel}>Prev Reading</Text>
                <Text style={styles.scheduleValue}>{assignment.prevReadingDate || 'Not available'}</Text>
              </View>
              <View style={styles.scheduleCard}>
                <Text style={styles.scheduleLabel}>Present Reading</Text>
                <Text style={styles.scheduleValue}>{assignment.presentReadingDate || 'Not available'}</Text>
              </View>
              <View style={styles.scheduleCard}>
                <Text style={styles.scheduleLabel}>Due / Disco</Text>
                <Text style={styles.scheduleValue}>
                  {assignment.dueDate || 'No due date'} / {assignment.disconnectionDate || 'No disco date'}
                </Text>
              </View>
            </View>
            <Text style={styles.scheduleNote}>
              Schedule coverage captured: {scheduleCoverage}/4 shared schedule fields are present in the current SQLite
              slice.
            </Text>
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Rate Health Checks</Text>
            <View style={styles.checkGrid}>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Lifeline-sensitive</Text>
                <Text style={styles.checkValue}>{lifelineConsumers}</Text>
                <Text style={styles.checkNote}>Accounts that may follow lifeline discount rules.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Senior-sensitive</Text>
                <Text style={styles.checkValue}>{seniorConsumers}</Text>
                <Text style={styles.checkNote}>Accounts that may trigger senior discount or subsidy logic.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Zero-kWh Bills</Text>
                <Text style={styles.checkValue}>{zeroKwhBills}</Text>
                <Text style={styles.checkNote}>Bills with positive charges but no computed usage.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Collection Coverage</Text>
                <Text style={styles.checkValue}>
                  {Number(stats.totalAmountDue || 0) > 0
                    ? `${((Number(stats.totalCollectionMonth || 0) / Number(stats.totalAmountDue || 0)) * 100).toFixed(1)}%`
                    : 'N/A'}
                </Text>
                <Text style={styles.checkNote}>Summary-based coverage view for the active mode.</Text>
              </View>
            </View>
          </NeuSurface>
        </View>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Rate Buckets</Text>
          <Text style={styles.panelSub}>Filter by rate code to compare bill size, kWh, and discount-sensitive counts.</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search rate code"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <FlatList
            scrollEnabled={false}
            data={filteredBuckets}
            keyExtractor={(item) => item.rate}
            renderItem={({ item }) => (
              <View style={styles.bucketCard}>
                <View style={styles.bucketRow}>
                  <View style={styles.bucketLeft}>
                    <Text style={styles.bucketRate}>{item.rate}</Text>
                    <Text style={styles.bucketMeta}>{item.count} consumer(s)</Text>
                  </View>
                  <View style={styles.bucketRight}>
                    <Text style={styles.bucketBill}>{money(item.totalBill)}</Text>
                    <Text style={styles.bucketMeta}>{item.totalKwh.toFixed(1)} kWh</Text>
                  </View>
                </View>
                <View style={styles.bucketFlags}>
                  <Text style={styles.bucketFlag}>Lifeline: {item.lifelineCount}</Text>
                  <Text style={styles.bucketFlag}>Senior: {item.seniorCount}</Text>
                  <Text style={styles.bucketFlag}>Zero-kWh bills: {item.zeroKwhCount}</Text>
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
          <Text style={styles.panelTitle}>Desktop Reference</Text>
          <Text style={styles.panelText}>
            This slice maps the desktop finance references into one read-only web page so the next write-enabled phase
            can inherit the same fields and scheduling rules.
          </Text>
          <View style={styles.refList}>
            <Text style={styles.refItem}>- ERC and Tax Rates</Text>
            <Text style={styles.refItem}>- Reading Schedule</Text>
            <Text style={styles.refItem}>- Service Grid</Text>
            <Text style={styles.refItem}>- Billing preview dependencies</Text>
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
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  panelSub: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  panelText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  scheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scheduleCard: {
    width: '48%',
    minWidth: 160,
    borderRadius: 16,
    backgroundColor: 'rgba(183,28,28,0.05)',
    padding: 12,
    gap: 6,
  },
  scheduleLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  scheduleValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  scheduleNote: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
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
  bucketCard: {
    borderRadius: 16,
    backgroundColor: Colors.white,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  bucketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  bucketLeft: {
    flex: 1,
    gap: 4,
  },
  bucketRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  bucketRate: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  bucketBill: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  bucketMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  bucketFlags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bucketFlag: {
    fontSize: 11,
    color: Colors.textSecondary,
    backgroundColor: 'rgba(183,28,28,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  refList: {
    gap: 6,
  },
  refItem: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});
