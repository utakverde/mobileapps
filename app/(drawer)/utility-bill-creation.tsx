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
import { getPrintableInvoiceForReading } from '../../database/invoiceRepository';
import { getActiveReadingMode } from '@lib/session';

function money(value: number): string {
  return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function buildFlags(consumers: Consumer[]) {
  const billReady = consumers.filter((item) => item.currentReading != null && Number(item.kwhUsed || 0) >= 0 && item.status !== 'paid');
  const unread = consumers.filter((item) => item.status === 'unread');
  const zeroKwhPosted = consumers.filter((item) => Number(item.totalDue || 0) > 0 && Number(item.kwhUsed || 0) <= 0);
  const lifelineSensitive = consumers.filter((item) => /lifeline/i.test(`${item.rateCode} ${item.remarks} ${item.name}`));
  const seniorSensitive = consumers.filter((item) => /senior/i.test(`${item.rateCode} ${item.remarks} ${item.name}`));
  return { billReady, unread, zeroKwhPosted, lifelineSensitive, seniorSensitive };
}

export default function UtilityBillCreationScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeMode = getActiveReadingMode();
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState<any | null>(null);
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [sampleInvoice, setSampleInvoice] = useState<any | null>(null);

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
  const billReadyRows = flags.billReady;
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return billReadyRows;
    return billReadyRows.filter((item) => {
      const blob = [item.accountNumber, item.name, item.address, item.rateCode, item.billMonth].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [billReadyRows, query]);

  useEffect(() => {
    let alive = true;
    const first = filteredRows[0];
    if (!first) {
      setSampleInvoice(null);
      return;
    }
    getPrintableInvoiceForReading(db, first.id, { mode: activeMode })
      .then((invoice) => {
        if (alive) setSampleInvoice(invoice);
      })
      .catch(() => {
        if (alive) setSampleInvoice(null);
      });
    return () => {
      alive = false;
    };
  }, [activeMode, db, filteredRows]);

  const totalDue = consumers.reduce((sum, item) => sum + Number(item.totalDue || 0), 0);
  const totalKwh = consumers.reduce((sum, item) => sum + Number(item.kwhUsed || 0), 0);
  const avgBill = consumers.length ? totalDue / consumers.length : 0;
  const avgKwh = consumers.length ? totalKwh / consumers.length : 0;
  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Bill Creation" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="file-document-edit" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Bill creation workspace</Text>
              <Text style={styles.heroText}>
                This slice mirrors the desktop bill creation path in read-only form. It shows bill-ready rows,
                preview values, and the same checks that should pass before any future posting step.
              </Text>
            </View>
          </View>

          <View style={styles.metricRow}>
            <SummaryCard label="Bill Ready" value={billReadyRows.length} icon="check-circle" />
            <SummaryCard label="Unread" value={flags.unread.length} icon="eye-off" />
            <SummaryCard label="Avg Bill" value={money(avgBill)} icon="calculator" />
            <SummaryCard label="Avg kWh" value={avgKwh.toFixed(1)} icon="chart-bar" />
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Posting Safety Rules</Text>
            <View style={styles.ruleList}>
              <Text style={styles.ruleItem}>- Preview SQL must be generated before any write.</Text>
              <Text style={styles.ruleItem}>- Rollback SQL must restore the original bill row.</Text>
              <Text style={styles.ruleItem}>- Bill transaction IDs must stay stable across retries.</Text>
              <Text style={styles.ruleItem}>- Duplicate prevention must use account, bill month, and transaction key.</Text>
              <Text style={styles.ruleItem}>- Audit history must retain before and after values.</Text>
            </View>
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Bill Creation Checks</Text>
            <View style={styles.checkGrid}>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Bill-ready rows</Text>
                <Text style={styles.checkValue}>{billReadyRows.length}</Text>
                <Text style={styles.checkNote}>Accounts with a saved reading and computed kWh.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Zero-kWh bills</Text>
                <Text style={styles.checkValue}>{flags.zeroKwhPosted.length}</Text>
                <Text style={styles.checkNote}>Positive totals with zero or missing usage.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Lifeline-sensitive</Text>
                <Text style={styles.checkValue}>{flags.lifelineSensitive.length}</Text>
                <Text style={styles.checkNote}>Accounts that may need lifeline discount validation.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Senior-sensitive</Text>
                <Text style={styles.checkValue}>{flags.seniorSensitive.length}</Text>
                <Text style={styles.checkNote}>Accounts that may need senior discount validation.</Text>
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
          <Text style={styles.panelTitle}>Preview Sample</Text>
          <Text style={styles.panelSub}>The first filtered bill-ready row is used as a sample invoice preview.</Text>
          {sampleInvoice ? (
            <View style={styles.previewBox}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Account</Text>
                <Text style={styles.previewValue}>{sampleInvoice.printableInvoice?.accountNumber || 'N/A'}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Bill Month</Text>
                <Text style={styles.previewValue}>{sampleInvoice.printableInvoice?.billMonth || 'N/A'}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Computed kWh</Text>
                <Text style={styles.previewValue}>{sampleInvoice.computedKwh ?? 'N/A'}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total Before Discount</Text>
                <Text style={styles.previewValue}>{money(Number(sampleInvoice.totalBeforeDiscount || 0))}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Lifeline Discount</Text>
                <Text style={styles.previewValue}>{money(Number(sampleInvoice.lifelineDiscount || 0))}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Senior Discount</Text>
                <Text style={styles.previewValue}>{money(Number(sampleInvoice.seniorDiscount || 0))}</Text>
              </View>
              <View style={[styles.previewRow, styles.previewTotal]}>
                <Text style={styles.previewTotalLabel}>Total Bill</Text>
                <Text style={styles.previewTotalValue}>{money(Number(sampleInvoice.totalBill || 0))}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="file-search-outline" size={42} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No bill preview available</Text>
              <Text style={styles.emptyText}>Select a bill-ready account or verify the SQLite billing rows.</Text>
            </View>
          )}
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Bill Ready Rows</Text>
          <Text style={styles.panelSub}>Open the existing bill preview for a row to validate the current calculation output.</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search account, name, rate, or bill month"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <FlatList
            scrollEnabled={false}
            data={filteredRows}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.rowCard} onPress={() => router.push(`/(drawer)/bill/${item.id}` as any)} activeOpacity={0.85}>
                <View style={styles.rowTop}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowTitle}>{item.accountNumber}</Text>
                    <Text style={styles.rowMeta}>{item.name}</Text>
                    <Text style={styles.rowMeta}>{item.address}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.statusChip}>Bill Ready</Text>
                    <Text style={styles.rowValue}>{item.rateCode || 'No rate'}</Text>
                  </View>
                </View>
                <View style={styles.rowGrid}>
                  <View style={styles.rowMetric}>
                    <Text style={styles.rowMetricLabel}>Reading</Text>
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
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="database-search" size={42} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No bill-ready rows matched</Text>
                <Text style={styles.emptyText}>Try another search term or verify that meter readings have been saved.</Text>
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
  previewBox: {
    borderRadius: 16,
    backgroundColor: 'rgba(183,28,28,0.05)',
    padding: 14,
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  previewValue: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  previewTotal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(183,28,28,0.12)',
    paddingTop: 8,
    marginTop: 4,
  },
  previewTotalLabel: {
    fontSize: 13,
    color: Colors.primaryDark,
    fontWeight: '800',
  },
  previewTotalValue: {
    fontSize: 15,
    color: Colors.primaryDark,
    fontWeight: '900',
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
