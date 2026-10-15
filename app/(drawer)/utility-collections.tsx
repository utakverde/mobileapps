import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NeuSurface from '@components/ui/NeuSurface';
import DashboardNeuHeader from '@components/layout/DashboardNeuHeader';
import SummaryCard from '@components/common/SummaryCard';
import { Colors } from '@constants/colors';
import { getReportSummary } from '../../database/consumerRepository';
import { getActiveReadingMode } from '@lib/session';
import { useRouter } from 'expo-router';

function money(value: number): string {
  return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export default function UtilityCollectionsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeMode = getActiveReadingMode();
  const [query, setQuery] = useState('');
  const [report, setReport] = useState<any>({
    assignment: {},
    stats: {
      totalCollectionToday: 0,
      totalCollectionMonth: 0,
      totalAmountDue: 0,
      totalRecords: 0,
      paidRecords: 0,
      readRecords: 0,
      unreadRecords: 0,
      disconnectedRecords: 0,
      problemReports: 0,
    },
    payments: [],
  });

  useEffect(() => {
    let alive = true;
    getReportSummary(db, { mode: activeMode })
      .then((value) => {
        if (alive) setReport(value);
      })
      .catch(() => {
        if (alive) setReport((current: any) => ({ ...current, payments: [] }));
      });
    return () => {
      alive = false;
    };
  }, [activeMode, db]);

  const assignment = report.assignment || {};
  const stats = report.stats || {};
  const payments = Array.isArray(report.payments) ? report.payments : [];
  const duplicateOrCount = useMemo(() => {
    const seen = new Map<string, number>();
    for (const item of payments as any[]) {
      const key = String(item.ornumber || item.orNumber || '').trim();
      if (!key) continue;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    return Array.from(seen.values()).filter((count) => count > 1).length;
  }, [payments]);
  const missingOrCount = useMemo(
    () => payments.filter((item: any) => !String(item.ornumber || item.orNumber || '').trim()).length,
    [payments]
  );
  const cashTotal = useMemo(
    () =>
      payments
        .filter((item: any) => String(item.paymentMethod || item.method || '').toLowerCase() === 'cash')
        .reduce((sum: number, item: any) => sum + Number(item.TotalBill || item.amountPaid || 0), 0),
    [payments]
  );
  const filteredPayable = useMemo(
    () => payments.filter((item: any) => Number(item.TotalBill || item.amountPaid || 0) > 0),
    [payments]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((item: any) => {
      const values = [
        item.Name,
        item.AccountNumber,
        item.BillMonth,
        item.ornumber,
        item.orNumber,
        item.collectorName,
        item.CollectorName,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return values.includes(q);
    });
  }, [payments, query]);

  const collectionRate = Number(stats.totalAmountDue || 0) > 0 ? Number(stats.totalCollectionMonth || 0) / Number(stats.totalAmountDue || 0) : 0;
  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Collections Summary" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="cash-register" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Collections and reconciliation workspace</Text>
              <Text style={styles.heroText}>
                This page focuses on payments, collection totals, and OR-level review without touching the posting
                logic.
              </Text>
            </View>
          </View>
          <View style={styles.metricsRow}>
            <SummaryCard label="Today" value={money(stats.totalCollectionToday || 0)} icon="calendar-today" />
            <SummaryCard label="This Month" value={money(stats.totalCollectionMonth || 0)} icon="calendar-month" />
            <SummaryCard label="Cash Total" value={money(cashTotal)} icon="cash" />
            <SummaryCard label="Payable Rows" value={filteredPayable.length} icon="file-document-outline" />
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Collection Reconciliation</Text>
            <Text style={styles.panelSubtitle}>
              {assignment.areaName || 'Area'} · Book {assignment.bookNumber || 'N/A'} · {assignment.billMonth || 'N/A'}
            </Text>
          </View>
          <View style={styles.statStrip}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{money(stats.totalAmountDue || 0)}</Text>
              <Text style={styles.statLabel}>Total Amount Due</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: Colors.success }]}>{(collectionRate * 100).toFixed(1)}%</Text>
              <Text style={styles.statLabel}>Collection Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: Colors.warning }]}>{duplicateOrCount}</Text>
              <Text style={styles.statLabel}>Duplicate ORs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: Colors.error }]}>{missingOrCount}</Text>
              <Text style={styles.statLabel}>Missing OR</Text>
            </View>
          </View>
          <View style={styles.searchWrap}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search account, OR number, collector, bill month"
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
            />
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Payment List</Text>
            <Text style={styles.panelSubtitle}>{filtered.length} payment rows matched</Text>
          </View>
          <FlatList
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item: any, index) => `${item.AccountNumber || item.accountNumber || index}-${item.ornumber || item.orNumber || index}`}
            renderItem={({ item }: any) => (
              <TouchableOpacity style={styles.paymentCard} activeOpacity={0.85} onPress={() => router.push(`/(drawer)/payment/${item.id || item.AccountNumber || item.accountNumber}` as any)}>
                <View style={styles.paymentTopRow}>
                  <View style={styles.paymentIcon}>
                    <MaterialCommunityIcons name="receipt" size={18} color={Colors.primaryDark} />
                  </View>
                  <View style={styles.paymentText}>
                    <Text style={styles.paymentName} numberOfLines={1}>
                      {item.Name || item.consumerName || item.AccountNumber}
                    </Text>
                    <Text style={styles.paymentMeta} numberOfLines={1}>
                      {item.AccountNumber || item.accountNumber} · {item.BillMonth || item.billMonth} · OR {item.ornumber || item.orNumber || '-'}
                    </Text>
                  </View>
                  <Text style={styles.paymentAmount}>{money(Number(item.TotalBill || item.amountPaid || 0))}</Text>
                </View>
                <View style={styles.paymentBottomRow}>
                  <Text style={styles.paymentFooter}>Collector: {item.collectorName || item.CollectorName || 'N/A'}</Text>
                  <Text style={styles.paymentFooter}>{String(item.date_paid || item.paymentDate || '')}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="database-search" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No payments found</Text>
                <Text style={styles.emptyText}>Try a different search or sync collection rows first.</Text>
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
  metricsRow: {
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
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primaryDark,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.divider,
  },
  searchWrap: {
    gap: 10,
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
  paymentCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  paymentTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  paymentIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(183,28,28,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentText: {
    flex: 1,
    gap: 2,
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  paymentMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  paymentAmount: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  paymentBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  paymentFooter: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 30,
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
    textAlign: 'center',
  },
});
