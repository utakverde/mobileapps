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
  const netCandidates = consumers.filter((item) => /net/i.test(`${item.rateCode} ${item.remarks} ${item.name}`));
  const zeroNet = consumers.filter((item) => Number(item.kwhUsed || 0) <= 0 && Number(item.totalDue || 0) > 0);
  const billable = consumers.filter((item) => Number(item.kwhUsed || 0) > 0 || Number(item.totalDue || 0) > 0);
  const negativeTotals = consumers.filter((item) => Number(item.totalDue || 0) <= 0 && item.status !== 'unread');
  return { netCandidates, zeroNet, billable, negativeTotals };
}

export default function UtilityNetMeteringScreen() {
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
      getReportSummary(db, { mode: 'net_metering' }),
      listConsumers(db, { limit: 1000, mode: 'net_metering' }),
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
  }, [db]);

  const stats = summary?.stats || {};
  const flags = useMemo(() => buildFlags(consumers), [consumers]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return consumers;
    return consumers.filter((item) => {
      const blob = [item.accountNumber, item.name, item.address, item.rateCode, item.remarks, item.billMonth]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [consumers, query]);

  useEffect(() => {
    let alive = true;
    const first = filtered[0];
    if (!first) {
      setSampleInvoice(null);
      return;
    }
    getPrintableInvoiceForReading(db, first.id, { mode: 'net_metering' })
      .then((invoice) => {
        if (alive) setSampleInvoice(invoice);
      })
      .catch(() => {
        if (alive) setSampleInvoice(null);
      });
    return () => {
      alive = false;
    };
  }, [db, filtered]);

  const totalBill = consumers.reduce((sum, item) => sum + Number(item.totalDue || item.billAmount || 0), 0);
  const importKwhTotal = Number(sampleInvoice?.printableInvoice?.importKwh || 0);
  const exportKwhTotal = Number(sampleInvoice?.printableInvoice?.exportKwh || 0);
  const netCredit = Number(sampleInvoice?.printableInvoice?.netMeteringCredit || 0);
  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Net Metering" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="solar-power" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Net metering review workspace</Text>
              <Text style={styles.heroText}>
                Review import and export energy separately, then confirm the net kWh and export credit before any
                future posting flow is allowed.
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <SummaryCard label="Candidates" value={flags.netCandidates.length} icon="solar-power" />
            <SummaryCard label="Zero/Negative" value={flags.negativeTotals.length} icon="alert-circle" />
            <SummaryCard label="Total Due" value={money(totalBill)} icon="cash-multiple" />
            <SummaryCard label="Billable Rows" value={flags.billable.length} icon="file-document-outline" />
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Net Metering Guardrails</Text>
            <View style={styles.ruleList}>
              <Text style={styles.ruleItem}>- Keep import kWh and export kWh separate in every view.</Text>
              <Text style={styles.ruleItem}>- Preserve the desktop export credit calculation path.</Text>
              <Text style={styles.ruleItem}>- Use the same bill calculator and snapshot fields as the desktop net metering post.</Text>
              <Text style={styles.ruleItem}>- Preview and rollback SQL are required before any future write.</Text>
              <Text style={styles.ruleItem}>- Duplicate prevention must use account number, bill month, and transaction ID.</Text>
            </View>
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Net Metering Summary</Text>
            <View style={styles.checkGrid}>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Import kWh</Text>
                <Text style={styles.checkValue}>{importKwhTotal.toFixed(1)}</Text>
                <Text style={styles.checkNote}>Sample invoice import energy.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Export kWh</Text>
                <Text style={styles.checkValue}>{exportKwhTotal.toFixed(1)}</Text>
                <Text style={styles.checkNote}>Sample invoice export energy.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Net Credit</Text>
                <Text style={styles.checkValue}>{money(netCredit)}</Text>
                <Text style={styles.checkNote}>Export credit applied by the invoice calculator.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Collection Coverage</Text>
                <Text style={styles.checkValue}>
                  {Number(stats.totalAmountDue || 0) > 0
                    ? `${((Number(stats.totalCollectionMonth || 0) / Number(stats.totalAmountDue || 0)) * 100).toFixed(1)}%`
                    : 'N/A'}
                </Text>
                <Text style={styles.checkNote}>Based on the current summary totals.</Text>
              </View>
            </View>
          </NeuSurface>
        </View>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Sample Invoice Preview</Text>
          <Text style={styles.panelSub}>The first filtered row is used to show the current import/export split.</Text>
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
                <Text style={styles.previewLabel}>Import kWh</Text>
                <Text style={styles.previewValue}>{Number(sampleInvoice.printableInvoice?.importKwh || 0).toFixed(1)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Export kWh</Text>
                <Text style={styles.previewValue}>{Number(sampleInvoice.printableInvoice?.exportKwh || 0).toFixed(1)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Net kWh</Text>
                <Text style={styles.previewValue}>{Number(sampleInvoice.printableInvoice?.computedKwh || 0).toFixed(1)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Net Metering Credit</Text>
                <Text style={styles.previewValue}>{money(Number(sampleInvoice.printableInvoice?.netMeteringCredit || 0))}</Text>
              </View>
              <View style={[styles.previewRow, styles.previewTotal]}>
                <Text style={styles.previewTotalLabel}>Total Bill</Text>
                <Text style={styles.previewTotalValue}>{money(Number(sampleInvoice.printableInvoice?.totalBill || 0))}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="solar-power" size={42} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No net metering preview available</Text>
              <Text style={styles.emptyText}>Try a different search term or review the SQLite net metering rows.</Text>
            </View>
          )}
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Net Metering Rows</Text>
          <Text style={styles.panelSub}>Search accounts and open the existing net metering detail route for deeper review.</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search account, name, rate, or bill month"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <FlatList
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.rowCard} onPress={() => router.push(`/(drawer)/net-metering/${item.id}` as any)} activeOpacity={0.85}>
                <View style={styles.rowTop}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowTitle}>{item.accountNumber}</Text>
                    <Text style={styles.rowMeta}>{item.name}</Text>
                    <Text style={styles.rowMeta}>{item.address}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.statusTag}>Net Metering</Text>
                    <Text style={styles.rowValue}>{item.rateCode || 'No rate'}</Text>
                  </View>
                </View>
                <View style={styles.rowGrid}>
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
                  <View style={styles.rowMetric}>
                    <Text style={styles.rowMetricLabel}>Status</Text>
                    <Text style={styles.rowMetricValue}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.rowNote}>
                  Import and export totals are preserved in the underlying invoice snapshot for this account.
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="database-search" size={42} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No net metering rows matched</Text>
                <Text style={styles.emptyText}>Try another search or verify the active mode and local data.</Text>
              </View>
            }
          />
        </NeuSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
  hero: { borderRadius: 24, padding: 18, gap: 14 },
  heroRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(183,28,28,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, gap: 6 },
  heroTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: Colors.textPrimary },
  heroText: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  grid: { gap: 16 },
  panel: { borderRadius: 22, padding: 16, gap: 12 },
  panelTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  panelSub: { fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  ruleList: { gap: 6 },
  ruleItem: { fontSize: 13, lineHeight: 18, color: Colors.textPrimary, fontWeight: '600' },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  checkCard: {
    flexBasis: '48%',
    minWidth: 150,
    borderRadius: 16,
    backgroundColor: Colors.white,
    padding: 12,
    gap: 4,
  },
  checkTitle: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  checkValue: { fontSize: 18, color: Colors.textPrimary, fontWeight: '900' },
  checkNote: { fontSize: 11, lineHeight: 16, color: Colors.textSecondary },
  previewBox: {
    borderRadius: 16,
    backgroundColor: 'rgba(183,28,28,0.05)',
    padding: 14,
    gap: 8,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  previewLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  previewValue: { fontSize: 12, color: Colors.textPrimary, fontWeight: '800' },
  previewTotal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(183,28,28,0.12)',
    paddingTop: 8,
    marginTop: 4,
  },
  previewTotalLabel: { fontSize: 13, color: Colors.primaryDark, fontWeight: '800' },
  previewTotalValue: { fontSize: 15, color: Colors.primaryDark, fontWeight: '900' },
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
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLeft: { flex: 1, gap: 4 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowTitle: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
  rowMeta: { fontSize: 12, color: Colors.textSecondary },
  rowValue: { fontSize: 13, fontWeight: '800', color: Colors.primaryDark },
  statusTag: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    backgroundColor: 'rgba(183,28,28,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  rowGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowMetric: {
    flexBasis: '23%',
    minWidth: 72,
    borderRadius: 12,
    backgroundColor: 'rgba(183,28,28,0.04)',
    padding: 10,
    gap: 4,
  },
  rowMetricLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '700' },
  rowMetricValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '900' },
  rowNote: { fontSize: 12, lineHeight: 18, color: Colors.textSecondary },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 12, color: Colors.textSecondary },
});
