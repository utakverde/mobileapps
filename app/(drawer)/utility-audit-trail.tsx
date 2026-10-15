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
import {
  UTILITY_RECONCILIATION_CHECKPOINTS,
  UTILITY_SYNC_RULES,
  UTILITY_WRITE_SAFETY_RULES,
} from '@constants/utilityContracts';
import { getActiveReadingMode } from '@lib/session';

type AuditBucket = {
  label: string;
  count: number;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route: string;
  description: string;
};

function money(value: number): string {
  return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function buildAuditCandidates(consumers: Consumer[]) {
  const zeroKwhBill = consumers.filter((item) => Number(item.totalDue || 0) > 0 && Number(item.kwhUsed || 0) <= 0);
  const disconnectedWithBalance = consumers.filter((item) => item.status === 'disconnected' && Number(item.totalDue || 0) > 0);
  const lifelineSensitive = consumers.filter((item) => /lifeline/i.test(`${item.rateCode} ${item.remarks} ${item.name}`));
  const seniorSensitive = consumers.filter((item) => /senior/i.test(`${item.rateCode} ${item.remarks} ${item.name}`));
  return { zeroKwhBill, disconnectedWithBalance, lifelineSensitive, seniorSensitive };
}

export default function UtilityAuditTrailScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
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
  const assignment = summary?.assignment || {};
  const candidates = useMemo(() => buildAuditCandidates(consumers), [consumers]);
  const auditRows = useMemo(() => {
    const rows = [
      ...candidates.zeroKwhBill,
      ...candidates.disconnectedWithBalance,
      ...candidates.lifelineSensitive,
      ...candidates.seniorSensitive,
    ];
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [candidates]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return auditRows;
    return auditRows.filter((item) => {
      const blob = [item.accountNumber, item.name, item.address, item.rateCode, item.remarks, item.billMonth]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [auditRows, query]);

  const auditCoverage = consumers.length > 0 ? (auditRows.length / consumers.length) * 100 : 0;
  const bottomPad = Math.max(insets.bottom, 12) + 18;
  const navigationCards: AuditBucket[] = [
    {
      label: 'Bill Audit',
      count: auditRows.length,
      icon: 'clipboard-text-search',
      route: '/(drawer)/utility-bill-audit/first',
      description: 'Open the record-level bill audit view for before/after and correction evidence.',
    },
    {
      label: 'Bill Correction',
      count: auditRows.length,
      icon: 'file-document-edit',
      route: '/(drawer)/utility-bill-correction/first',
      description: 'Inspect the rollback-safe correction page linked to the audit trail.',
    },
    {
      label: 'Reconciliation',
      count: Number(stats.totalRecords || consumers.length),
      icon: 'scale-balance',
      route: '/(drawer)/utility-reconciliation',
      description: 'Compare due totals, collections, and duplicate-prevention signals.',
    },
    {
      label: 'Complaints',
      count: Number(summary?.complaints?.length || 0),
      icon: 'alert-circle',
      route: '/(drawer)/utility-complaints',
      description: 'Trace complaints back to account and field history.',
    },
    {
      label: 'System Map',
      count: consumers.filter((item) => item.gpsLat !== null && item.gpsLng !== null).length,
      icon: 'map-marker-radius',
      route: '/(drawer)/utility-system-map',
      description: 'Drill into GPS-linked accounts and map-linked service actions.',
    },
    {
      label: 'Accounting',
      count: Number(stats.totalAmountDue || 0),
      icon: 'calculator',
      route: '/(drawer)/utility-accounting-integration',
      description: 'Review posting candidates, duplicate keys, and export readiness.',
    },
  ];

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Audit Trail" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="clipboard-text-clock" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Audit trail overview</Text>
              <Text style={styles.heroText}>
                Use this surface to trace bill evidence, rollback guidance, sync safety, and the supporting modules
                that already capture the record-level story.
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <SummaryCard label="Audit Candidates" value={auditRows.length} icon="clipboard-text" />
            <SummaryCard label="Coverage" value={`${auditCoverage.toFixed(1)}%`} icon="shield-check" />
            <SummaryCard
              label="Collection Rate"
              value={Number(stats.totalAmountDue || 0) > 0 ? `${((Number(stats.totalCollectionMonth || 0) / Number(stats.totalAmountDue || 0)) * 100).toFixed(1)}%` : 'N/A'}
              icon="cash-multiple"
            />
            <SummaryCard label="Mode" value={activeMode} icon="account-box" />
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Trace Navigation</Text>
          <View style={styles.navGrid}>
            {navigationCards.map((item) => (
              <TouchableOpacity key={item.label} style={styles.navCard} onPress={() => router.push(item.route as any)} activeOpacity={0.85}>
                <View style={styles.navTopRow}>
                  <View style={styles.navIcon}>
                    <MaterialCommunityIcons name={item.icon} size={18} color={Colors.primaryDark} />
                  </View>
                  <Text style={styles.navCount}>{item.count}</Text>
                </View>
                <Text style={styles.navTitle}>{item.label}</Text>
                <Text style={styles.navText}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Audit Guardrails</Text>
            <View style={styles.ruleList}>
              {UTILITY_WRITE_SAFETY_RULES.map((rule) => (
                <View key={rule.key} style={styles.ruleCard}>
                  <MaterialCommunityIcons name="shield-check" size={16} color={Colors.primaryDark} />
                  <View style={styles.ruleTextWrap}>
                    <Text style={styles.ruleTitle}>{rule.title}</Text>
                    <Text style={styles.ruleText}>{rule.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Audit Checkpoints</Text>
            <View style={styles.checkGrid}>
              {UTILITY_RECONCILIATION_CHECKPOINTS.map((item) => (
                <View key={item.key} style={styles.checkCard}>
                  <Text style={styles.checkTitle}>{item.title}</Text>
                  <Text style={styles.checkNote}>{item.description}</Text>
                </View>
              ))}
              {UTILITY_SYNC_RULES.map((item) => (
                <View key={item.key} style={styles.checkCard}>
                  <Text style={styles.checkTitle}>{item.title}</Text>
                  <Text style={styles.checkNote}>{item.description}</Text>
                </View>
              ))}
            </View>
          </NeuSurface>
        </View>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Current Audit Context</Text>
          <View style={styles.contextGrid}>
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>Area / Book</Text>
              <Text style={styles.contextValue}>
                {assignment.areaName || 'N/A'} · {assignment.bookNumber || 'N/A'}
              </Text>
            </View>
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>Bill Month</Text>
              <Text style={styles.contextValue}>{assignment.billMonth || 'N/A'}</Text>
            </View>
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>Due / Disco</Text>
              <Text style={styles.contextValue}>
                {assignment.dueDate || 'N/A'} / {assignment.disconnectionDate || 'N/A'}
              </Text>
            </View>
            <View style={styles.contextCard}>
              <Text style={styles.contextLabel}>Traceable Rows</Text>
              <Text style={styles.contextValue}>{auditRows.length}</Text>
            </View>
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Audit Candidate Queue</Text>
          <Text style={styles.panelSub}>
            Search the rows that need audit attention before any future correction or reconciliation write.
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search account, name, rate, bill month, or remarks"
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
                onPress={() => router.push(`/(drawer)/utility-bill-audit/${item.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={styles.rowTop}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowTitle}>{item.accountNumber}</Text>
                    <Text style={styles.rowMeta}>{item.name}</Text>
                    <Text style={styles.rowMeta}>{item.address}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.statusTag}>{item.rateCode || 'No rate'}</Text>
                    <Text style={styles.rowValue}>{money(Number(item.totalDue || item.billAmount || 0))}</Text>
                  </View>
                </View>
                <View style={styles.badgeRow}>
                  {Number(item.kwhUsed || 0) <= 0 ? <Text style={styles.badgeWarning}>Zero kWh</Text> : null}
                  {item.status === 'disconnected' ? <Text style={styles.badgeDanger}>Disconnected</Text> : null}
                  {/lifeline/i.test(`${item.rateCode} ${item.remarks} ${item.name}`) ? <Text style={styles.badge}>Lifeline</Text> : null}
                  {/senior/i.test(`${item.rateCode} ${item.remarks} ${item.name}`) ? <Text style={styles.badge}>Senior</Text> : null}
                </View>
                <Text style={styles.rowFooter}>
                  Bill month {item.billMonth || 'N/A'} · Due {item.dueDate || 'N/A'} · Disconnection {item.disconnectionDate || 'N/A'}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="database-search" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No audit candidates matched</Text>
                <Text style={styles.emptyText}>Try another search or review the bill audit detail page first.</Text>
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
  panel: { borderRadius: 22, padding: 16, gap: 12 },
  panelTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  panelSub: { fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  navCard: {
    flexGrow: 1,
    flexBasis: 170,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 12,
    gap: 6,
  },
  navTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183,28,28,0.1)',
  },
  navCount: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  navText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  grid: { gap: 16 },
  ruleList: { gap: 8 },
  ruleCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  ruleTextWrap: { flex: 1, gap: 2 },
  ruleTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  ruleText: { fontSize: 12, lineHeight: 17, color: Colors.textSecondary },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  checkCard: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 16,
    backgroundColor: Colors.white,
    padding: 12,
    gap: 4,
  },
  checkTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  checkNote: { fontSize: 12, lineHeight: 17, color: Colors.textSecondary },
  contextGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  contextCard: {
    flexBasis: '48%',
    minWidth: 150,
    borderRadius: 16,
    backgroundColor: 'rgba(183,28,28,0.05)',
    padding: 12,
    gap: 4,
  },
  contextLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '700' },
  contextValue: { fontSize: 13, color: Colors.textPrimary, fontWeight: '800' },
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
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    fontSize: 11,
    color: Colors.primaryDark,
    backgroundColor: 'rgba(183,28,28,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '700',
  },
  badgeWarning: {
    fontSize: 11,
    color: Colors.warning,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '700',
  },
  badgeDanger: {
    fontSize: 11,
    color: Colors.error,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    fontWeight: '700',
  },
  rowFooter: { fontSize: 11, lineHeight: 16, color: Colors.textSecondary },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 12, color: Colors.textSecondary },
});
