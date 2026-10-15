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
import { isDesktopWrapAroundCandidate, validateReadingInput } from '../../services/readingValidation';

function money(value: number): string {
  return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function readingValue(value: number | null | undefined): string {
  return value == null ? 'N/A' : String(value);
}

function buildFlags(consumers: Consumer[]) {
  const unread = consumers.filter((item) => item.status === 'unread');
  const missingReading = consumers.filter((item) => item.status === 'read' && item.currentReading == null);
  const zeroKwhPosted = consumers.filter((item) => Number(item.totalDue || 0) > 0 && Number(item.kwhUsed || 0) <= 0);
  const wrapAroundCandidates = consumers.filter((item) => {
    if (item.currentReading == null) return false;
    const validation = validateReadingInput({
      previousReading: item.previousReading,
      presentReading: item.currentReading,
      multiplier: item.multiplier,
      allowRollover: true,
    });
    return item.currentReading < item.previousReading && isDesktopWrapAroundCandidate(item.previousReading) && validation.rolloverApplied;
  });
  const nonPositiveBills = consumers.filter((item) => Number(item.totalDue || 0) <= 0 && item.status !== 'unread');
  return { unread, missingReading, zeroKwhPosted, wrapAroundCandidates, nonPositiveBills };
}

export default function UtilityMeterReadingScreen() {
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
  const assignment = summary?.assignment || {};
  const flags = useMemo(() => buildFlags(consumers), [consumers]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return consumers;
    return consumers.filter((item) => {
      const blob = [item.accountNumber, item.name, item.address, item.meterNumber, item.billMonth, item.rateCode]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [consumers, query]);

  const totalDue = consumers.reduce((sum, item) => sum + Number(item.totalDue || 0), 0);
  const totalKwh = consumers.reduce((sum, item) => sum + Number(item.kwhUsed || 0), 0);
  const avgKwh = consumers.length ? totalKwh / consumers.length : 0;
  const avgBill = consumers.length ? totalDue / consumers.length : 0;
  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Meter Reading" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="gauge" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Meter reading overview</Text>
              <Text style={styles.heroText}>
                Review posted readings, kWh, and validation flags before bill creation. This page keeps the desktop
                reading rules visible without changing the underlying calculation path.
              </Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <SummaryCard label="Total Rows" value={consumers.length} icon="database" />
            <SummaryCard label="Total Due" value={money(totalDue)} icon="cash" />
            <SummaryCard label="Avg Bill" value={money(avgBill)} icon="calculator" />
            <SummaryCard label="Avg kWh" value={avgKwh.toFixed(1)} icon="chart-bar" />
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Reading Assignment</Text>
            <View style={styles.assignmentGrid}>
              <View style={styles.assignmentCard}>
                <Text style={styles.assignmentLabel}>Area / Book</Text>
                <Text style={styles.assignmentValue}>
                  {assignment.areaName || 'Not available'} · {assignment.bookNumber || 'N/A'}
                </Text>
              </View>
              <View style={styles.assignmentCard}>
                <Text style={styles.assignmentLabel}>Bill Month</Text>
                <Text style={styles.assignmentValue}>{assignment.billMonth || 'Not available'}</Text>
              </View>
              <View style={styles.assignmentCard}>
                <Text style={styles.assignmentLabel}>Prev Reading Date</Text>
                <Text style={styles.assignmentValue}>{assignment.prevReadingDate || 'Not available'}</Text>
              </View>
              <View style={styles.assignmentCard}>
                <Text style={styles.assignmentLabel}>Present Reading Date</Text>
                <Text style={styles.assignmentValue}>{assignment.presentReadingDate || 'Not available'}</Text>
              </View>
              <View style={styles.assignmentCard}>
                <Text style={styles.assignmentLabel}>Due / Disco</Text>
                <Text style={styles.assignmentValue}>
                  {assignment.dueDate || 'No due date'} / {assignment.disconnectionDate || 'No disco date'}
                </Text>
              </View>
            </View>
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Reading Health Checks</Text>
            <View style={styles.checkGrid}>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Unread Rows</Text>
                <Text style={styles.checkValue}>{flags.unread.length}</Text>
                <Text style={styles.checkNote}>Accounts still waiting for a valid present reading.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Missing Current Reading</Text>
                <Text style={styles.checkValue}>{flags.missingReading.length}</Text>
                <Text style={styles.checkNote}>Marked as read but with no saved reading value.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Zero-kWh Bills</Text>
                <Text style={styles.checkValue}>{flags.zeroKwhPosted.length}</Text>
                <Text style={styles.checkNote}>Bills with charges but no computed usage.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Wrap-around Candidates</Text>
                <Text style={styles.checkValue}>{flags.wrapAroundCandidates.length}</Text>
                <Text style={styles.checkNote}>Possible meter rollovers that need review before posting.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Non-positive Bills</Text>
                <Text style={styles.checkValue}>{flags.nonPositiveBills.length}</Text>
                <Text style={styles.checkNote}>Rows already settled or needing correction.</Text>
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
          <Text style={styles.panelTitle}>Reading Rows</Text>
          <Text style={styles.panelSub}>Search accounts, then open the existing reading detail screen for verification.</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search account, name, meter, rate, or bill month"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <FlatList
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const validation =
                item.currentReading == null
                  ? null
                  : validateReadingInput({
                      previousReading: item.previousReading,
                      presentReading: item.currentReading,
                      multiplier: item.multiplier,
                      allowRollover: true,
                    });
              const statusLabel =
                item.status === 'read'
                  ? 'Read'
                  : item.status === 'paid'
                    ? 'Paid'
                    : item.status === 'disconnected'
                      ? 'Disconnected'
                      : item.status === 'problem'
                        ? 'Problem'
                        : 'Unread';
              return (
                <TouchableOpacity style={styles.rowCard} onPress={() => router.push(`/(drawer)/reading/${item.id}` as any)} activeOpacity={0.85}>
                  <View style={styles.rowTop}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowTitle}>{item.accountNumber}</Text>
                      <Text style={styles.rowMeta}>{item.name}</Text>
                      <Text style={styles.rowMeta}>{item.address}</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.statusChip}>{statusLabel}</Text>
                      <Text style={styles.rowValue}>{item.rateCode || 'No rate'}</Text>
                    </View>
                  </View>

                  <View style={styles.rowGrid}>
                    <View style={styles.rowMetric}>
                      <Text style={styles.rowMetricLabel}>Previous</Text>
                      <Text style={styles.rowMetricValue}>{readingValue(item.previousReading)}</Text>
                    </View>
                    <View style={styles.rowMetric}>
                      <Text style={styles.rowMetricLabel}>Current</Text>
                      <Text style={styles.rowMetricValue}>{readingValue(item.currentReading)}</Text>
                    </View>
                    <View style={styles.rowMetric}>
                      <Text style={styles.rowMetricLabel}>kWh</Text>
                      <Text style={styles.rowMetricValue}>{item.kwhUsed == null ? 'N/A' : item.kwhUsed.toFixed(1)}</Text>
                    </View>
                    <View style={styles.rowMetric}>
                      <Text style={styles.rowMetricLabel}>Total Due</Text>
                      <Text style={styles.rowMetricValue}>{money(Number(item.totalDue || 0))}</Text>
                    </View>
                  </View>

                  <Text style={styles.rowNote}>
                    {validation
                      ? validation.ok
                        ? validation.rolloverApplied
                          ? 'Potential wrap-around detected. Review before posting.'
                          : 'Reading is within the expected validation range.'
                        : validation.message
                      : 'No current reading saved yet.'}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="database-search" size={42} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No matching reading rows</Text>
                <Text style={styles.emptyText}>Try another search term or review a different mode.</Text>
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
  assignmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  assignmentCard: {
    width: '48%',
    minWidth: 160,
    borderRadius: 16,
    backgroundColor: 'rgba(183,28,28,0.05)',
    padding: 12,
    gap: 6,
  },
  assignmentLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  assignmentValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '800',
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
