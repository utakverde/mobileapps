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
import { UTILITY_ACCOUNTING_EXPORT_CANDIDATES, UTILITY_RECONCILIATION_CHECKPOINTS, UTILITY_SYNC_RULES } from '@constants/utilityContracts';
import { getReportSummary, listConsumers } from '../../database/consumerRepository';
import { getActiveReadingMode } from '@lib/session';

function money(value: number): string {
  return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export default function UtilityReconciliationScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeMode = getActiveReadingMode();
  const [query, setQuery] = useState('');
  const [report, setReport] = useState<any | null>(null);
  const [rows, setRows] = useState<Consumer[]>([]);

  useEffect(() => {
    let alive = true;
    getReportSummary(db, { mode: activeMode })
      .then((value) => {
        if (alive) setReport(value);
      })
      .catch(() => {
        if (alive) setReport(null);
      });
    listConsumers(db, { limit: 1000, mode: activeMode })
      .then((items) => {
        if (alive) setRows(items);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [activeMode, db]);

  const stats = report?.stats || {};
  const payments = Array.isArray(report?.payments) ? report.payments : [];
  const complaints = Array.isArray(report?.complaints) ? report.complaints : [];
  const dueTotal = Number(stats.totalAmountDue || 0);
  const collectionTotal = Number(stats.totalCollectionMonth || 0);
  const variance = Number((collectionTotal - dueTotal).toFixed(2));
  const collectionRate = dueTotal > 0 ? collectionTotal / dueTotal : 0;

  const exportRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return UTILITY_ACCOUNTING_EXPORT_CANDIDATES;
    return UTILITY_ACCOUNTING_EXPORT_CANDIDATES.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(q));
  }, [query]);

  const duplicateProtection = useMemo(
    () => [
      'transaction_id + source_name + document_number',
      'account_number + bill_month + document_type',
      'export_batch_id + transaction_id',
    ],
    []
  );

  const duplicateRows = payments.filter((payment: any, index: number, arr: any[]) => {
    const key = `${payment.AccountNumber || payment.accountNumber || ''}-${payment.BillMonth || payment.billMonth || ''}-${payment.ornumber || payment.orNumber || ''}`;
    return arr.findIndex((row) => `${row.AccountNumber || row.accountNumber || ''}-${row.BillMonth || row.billMonth || ''}-${row.ornumber || row.orNumber || ''}` === key) !== index;
  });

  const unmatchedComplaints = complaints.filter((complaint: any) => String(complaint.status || '').toLowerCase() !== 'pending');
  const exportReadyRows = rows.filter((row) => Number(row.totalDue || row.billAmount || 0) > 0 && Number(row.kwhUsed || 0) >= 0);
  const lifelineRows = rows.filter((row) => /lifeline/i.test(`${row.rateCode} ${row.remarks} ${row.name}`));
  const seniorRows = rows.filter((row) => /senior/i.test(`${row.rateCode} ${row.remarks} ${row.name}`));
  const zeroKwhRows = rows.filter((row) => Number(row.totalDue || row.billAmount || 0) > 0 && Number(row.kwhUsed || 0) <= 0);
  const areaBuckets = useMemo(() => {
    const buckets = new Map<string, { key: string; count: number; totalDue: number; totalKwh: number; sampleId: string; sampleName: string }>();
    rows.forEach((row) => {
      const key = row.areaCode || 'Unknown';
      const current = buckets.get(key) || { key, count: 0, totalDue: 0, totalKwh: 0, sampleId: row.id, sampleName: row.name };
      current.count += 1;
      current.totalDue += Number(row.totalDue || row.billAmount || 0);
      current.totalKwh += Number(row.kwhUsed || 0);
      if (!current.sampleName) {
        current.sampleId = row.id;
        current.sampleName = row.name;
      }
      buckets.set(key, current);
    });
    return Array.from(buckets.values()).sort((a, b) => b.totalDue - a.totalDue);
  }, [rows]);
  const rateBuckets = useMemo(() => {
    const buckets = new Map<string, { key: string; count: number; totalDue: number; totalKwh: number }>();
    rows.forEach((row) => {
      const key = row.rateCode || 'Unknown';
      const current = buckets.get(key) || { key, count: 0, totalDue: 0, totalKwh: 0 };
      current.count += 1;
      current.totalDue += Number(row.totalDue || row.billAmount || 0);
      current.totalKwh += Number(row.kwhUsed || 0);
      buckets.set(key, current);
    });
    return Array.from(buckets.values()).sort((a, b) => b.totalDue - a.totalDue);
  }, [rows]);
  const topArea = areaBuckets[0];
  const topRate = rateBuckets[0];
  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Reconciliation" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="transmission-tower" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Utility reconciliation summary</Text>
              <Text style={styles.heroText}>
                This read-only page compares current collection totals against due totals and highlights duplicate
                prevention, export candidates, and reconciliation checkpoints for future accounting handoff.
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <SummaryCard label="Due Total" value={money(dueTotal)} icon="cash" />
            <SummaryCard label="Collected" value={money(collectionTotal)} icon="cash-multiple" />
            <SummaryCard label="Variance" value={money(variance)} icon="scale-balance" />
            <SummaryCard label="Rate" value={`${(collectionRate * 100).toFixed(1)}%`} icon="chart-bar" />
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Handoff Summary</Text>
          <View style={styles.checkGrid}>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Export Ready</Text>
              <Text style={styles.checkValue}>{exportReadyRows.length}</Text>
              <Text style={styles.checkNote}>Rows with a billable total that can be included in export review.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Duplicate Payments</Text>
              <Text style={styles.checkValue}>{duplicateRows.length}</Text>
              <Text style={styles.checkNote}>Potential OR/account/month duplicates to block before posting.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Lifeline Rows</Text>
              <Text style={styles.checkValue}>{lifelineRows.length}</Text>
              <Text style={styles.checkNote}>Discount-sensitive rows that need subsidy-safe handling.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Senior Rows</Text>
              <Text style={styles.checkValue}>{seniorRows.length}</Text>
              <Text style={styles.checkNote}>Senior-sensitive rows that need separate validation.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Zero kWh</Text>
              <Text style={styles.checkValue}>{zeroKwhRows.length}</Text>
              <Text style={styles.checkNote}>Bills with charges but no measured consumption.</Text>
            </View>
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Reconciliation Checks</Text>
          <View style={styles.checkGrid}>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Matched Totals</Text>
              <Text style={styles.checkValue}>{Math.abs(variance) < 0.01 ? 'PASS' : 'REVIEW'}</Text>
              <Text style={styles.checkNote}>Compares collection month totals to total amount due.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Duplicate Payments</Text>
              <Text style={styles.checkValue}>{duplicateRows.length}</Text>
              <Text style={styles.checkNote}>Potential OR / account / month duplicates to stop in later export flows.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Non-pending Complaints</Text>
              <Text style={styles.checkValue}>{unmatchedComplaints.length}</Text>
              <Text style={styles.checkNote}>Queued complaint rows that should be tracked separately from billing exports.</Text>
            </View>
            <View style={styles.checkCard}>
              <Text style={styles.checkTitle}>Top Area</Text>
              <Text style={styles.checkValue}>{topArea?.key || 'N/A'}</Text>
              <Text style={styles.checkNote}>
                {money(topArea?.totalDue || 0)} due across {topArea?.count || 0} accounts.
              </Text>
            </View>
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Review Actions</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryAction]}
              onPress={() => router.push('/(drawer)/utility-audit-trail' as any)}
            >
              <MaterialCommunityIcons name="clipboard-text-clock" size={18} color={Colors.white} />
              <Text style={styles.primaryActionText}>Open Audit Trail</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(drawer)/utility-accounting-integration' as any)}>
              <MaterialCommunityIcons name="calculator" size={18} color={Colors.primaryDark} />
              <Text style={styles.actionText}>Open Accounting</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(drawer)/utility-system-map' as any)}>
              <MaterialCommunityIcons name="map-marker-radius" size={18} color={Colors.primaryDark} />
              <Text style={styles.actionText}>Open System Map</Text>
            </TouchableOpacity>
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Duplicate Prevention Rules</Text>
          <View style={styles.ruleList}>
            {duplicateProtection.map((rule) => (
              <View key={rule} style={styles.ruleCard}>
                <MaterialCommunityIcons name="shield-check" size={16} color={Colors.primaryDark} />
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Reconciliation Checkpoints</Text>
          <FlatList
            scrollEnabled={false}
            data={[
              ...UTILITY_RECONCILIATION_CHECKPOINTS,
              ...UTILITY_SYNC_RULES,
            ]}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <View style={styles.itemCard}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemText}>{item.description}</Text>
              </View>
            )}
          />
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Export Candidate Review</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search export candidate"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <View style={styles.sectionRow}>
            <View style={styles.exportMiniCard}>
              <Text style={styles.exportMiniLabel}>Top Area</Text>
              <Text style={styles.exportMiniValue}>{topArea?.key || 'N/A'}</Text>
            </View>
            <View style={styles.exportMiniCard}>
              <Text style={styles.exportMiniLabel}>Top Area Due</Text>
              <Text style={styles.exportMiniValue}>{money(topArea?.totalDue || 0)}</Text>
            </View>
            <View style={styles.exportMiniCard}>
              <Text style={styles.exportMiniLabel}>Top Rate</Text>
              <Text style={styles.exportMiniValue}>{topRate?.key || 'N/A'}</Text>
            </View>
            <View style={styles.exportMiniCard}>
              <Text style={styles.exportMiniLabel}>Top Rate Due</Text>
              <Text style={styles.exportMiniValue}>{money(topRate?.totalDue || 0)}</Text>
            </View>
          </View>
          <View style={styles.topList}>
            {areaBuckets.slice(0, 3).map((item) => (
              <View key={item.key} style={styles.topRow}>
                <Text style={styles.topLabel}>Area {item.key}</Text>
                <Text style={styles.topMeta}>
                  {item.count} account(s) · {money(item.totalDue)} due · {item.totalKwh.toFixed(1)} kWh
                </Text>
                <TouchableOpacity style={styles.topBtn} onPress={() => router.push('/(drawer)/utility-audit-trail' as any)}>
                  <Text style={styles.topBtnText}>Audit</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={styles.exportList}>
            {exportRows.map((item) => (
              <View key={item.key} style={styles.exportCard}>
                <Text style={styles.exportTitle}>{item.title}</Text>
                <Text style={styles.exportText}>{item.description}</Text>
              </View>
            ))}
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
    fontSize: 20,
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
    marginBottom: 4,
  },
  topList: {
    gap: 8,
    marginBottom: 8,
  },
  topRow: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 4,
  },
  topLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  topMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  topBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.primarySurface,
  },
  topBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  exportMiniCard: {
    flexBasis: '48%',
    minWidth: 140,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 12,
    gap: 4,
  },
  exportMiniLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  exportMiniValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  ruleList: {
    gap: 8,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 14,
    padding: 12,
  },
  ruleText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
    gap: 4,
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  itemText: {
    fontSize: 12,
    lineHeight: 17,
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
  exportList: {
    gap: 10,
  },
  exportCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  exportTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  exportText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionBtn: {
    flexGrow: 1,
    flexBasis: 160,
    borderRadius: 12,
    minWidth: '30%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryAction: {
    backgroundColor: Colors.primary,
  },
  primaryActionText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 12,
  },
  actionText: {
    color: Colors.primaryDark,
    fontWeight: '800',
    fontSize: 12,
  },
});
