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
  const lifeline = consumers.filter((item) => /lifeline/i.test(`${item.rateCode} ${item.remarks} ${item.name}`));
  const senior = consumers.filter((item) => /senior/i.test(`${item.rateCode} ${item.remarks} ${item.name}`));
  const lifelineAndSenior = consumers.filter(
    (item) => /lifeline/i.test(`${item.rateCode} ${item.remarks} ${item.name}`) && /senior/i.test(`${item.rateCode} ${item.remarks} ${item.name}`)
  );
  const zeroKwh = consumers.filter((item) => Number(item.totalDue || 0) > 0 && Number(item.kwhUsed || 0) <= 0);
  const disconnectedWithBalance = consumers.filter((item) => item.status === 'disconnected' && Number(item.totalDue || 0) > 0);
  return { lifeline, senior, lifelineAndSenior, zeroKwh, disconnectedWithBalance };
}

export default function UtilityLifelineSeniorScreen() {
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

  const totalBill = consumers.reduce((sum, item) => sum + Number(item.totalDue || item.billAmount || 0), 0);
  const lifelineBill = flags.lifeline.reduce((sum, item) => sum + Number(item.totalDue || item.billAmount || 0), 0);
  const seniorBill = flags.senior.reduce((sum, item) => sum + Number(item.totalDue || item.billAmount || 0), 0);
  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Lifeline and Senior" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="hand-heart" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Discount-sensitive accounts</Text>
              <Text style={styles.heroText}>
                Review lifeline and senior accounts using the same flags the billing engine already reads. This page
                stays read-only and helps spot subsidy drift before correction or export.
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <SummaryCard label="Lifeline" value={flags.lifeline.length} icon="heart" />
            <SummaryCard label="Senior" value={flags.senior.length} icon="account-heart" />
            <SummaryCard label="Both Flags" value={flags.lifelineAndSenior.length} icon="heart-multiple" />
            <SummaryCard label="Zero-kWh" value={flags.zeroKwh.length} icon="flash-off" />
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Discount Guardrails</Text>
            <View style={styles.ruleList}>
              <Text style={styles.ruleItem}>- Preserve the desktop lifeline percent and senior 5 percent logic.</Text>
              <Text style={styles.ruleItem}>- Keep lifeline and senior discounts separate from the base bill.</Text>
              <Text style={styles.ruleItem}>- Use the same flag aliases from desktop and mobile records.</Text>
              <Text style={styles.ruleItem}>- Surface subsidy drift before any future correction write.</Text>
              <Text style={styles.ruleItem}>- Require preview and rollback SQL for future updates.</Text>
            </View>
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Discount Summary</Text>
            <View style={styles.checkGrid}>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Lifeline Bill Total</Text>
                <Text style={styles.checkValue}>{money(lifelineBill)}</Text>
                <Text style={styles.checkNote}>Total due across accounts tagged as lifeline-sensitive.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Senior Bill Total</Text>
                <Text style={styles.checkValue}>{money(seniorBill)}</Text>
                <Text style={styles.checkNote}>Total due across accounts tagged as senior-sensitive.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Disconnected w/ Balance</Text>
                <Text style={styles.checkValue}>{flags.disconnectedWithBalance.length}</Text>
                <Text style={styles.checkNote}>Disconnected accounts still carrying a payable balance.</Text>
              </View>
              <View style={styles.checkCard}>
                <Text style={styles.checkTitle}>Collection Coverage</Text>
                <Text style={styles.checkValue}>
                  {Number(stats.totalAmountDue || 0) > 0
                    ? `${((Number(stats.totalCollectionMonth || 0) / Number(stats.totalAmountDue || 0)) * 100).toFixed(1)}%`
                    : 'N/A'}
                </Text>
                <Text style={styles.checkNote}>Based on current report summary totals.</Text>
              </View>
            </View>
          </NeuSurface>
        </View>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Filtered Accounts</Text>
          <Text style={styles.panelSub}>Search discount-sensitive accounts by name, account number, rate, or remarks.</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search lifeline or senior accounts"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <FlatList
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isLifeline = /lifeline/i.test(`${item.rateCode} ${item.remarks} ${item.name}`);
              const isSenior = /senior/i.test(`${item.rateCode} ${item.remarks} ${item.name}`);
              return (
                <TouchableOpacity style={styles.rowCard} activeOpacity={0.85} onPress={() => router.push('/(drawer)/utility-financial-analysis' as any)}>
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
                    {isLifeline ? <Text style={styles.badge}>Lifeline</Text> : null}
                    {isSenior ? <Text style={styles.badge}>Senior</Text> : null}
                    {item.status === 'disconnected' ? <Text style={styles.badgeDanger}>Disconnected</Text> : null}
                    {Number(item.kwhUsed || 0) <= 0 ? <Text style={styles.badgeWarning}>Zero kWh</Text> : null}
                  </View>
                  <Text style={styles.rowFooter}>
                    Bill month {item.billMonth || 'N/A'} · Due {item.dueDate || 'N/A'} · Disco {item.disconnectionDate || 'N/A'}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="database-search" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No discount-sensitive accounts found</Text>
                <Text style={styles.emptyText}>Try another search or review the billing flags first.</Text>
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
