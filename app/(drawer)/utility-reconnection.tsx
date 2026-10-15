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
import { getDisconnectionCandidates, getReportSummary, listConsumers } from '../../database/consumerRepository';
import { getActiveReadingMode } from '@lib/session';

function isReconnectionCandidate(item: Consumer) {
  return item.status === 'paid' && Boolean(item.disconnectionDate || item.remarks || (item as any).app_disconnected_at);
}

export default function UtilityReconnectionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeMode = getActiveReadingMode();
  const [query, setQuery] = useState('');
  const [summary, setSummary] = useState<any | null>(null);
  const [serviceRows, setServiceRows] = useState<Consumer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      getReportSummary(db, { mode: 'disconnection' }),
      getDisconnectionCandidates(db),
      listConsumers(db, { limit: 1000, mode: 'disconnection' }),
    ])
      .then(([report, candidates, rows]) => {
        if (!alive) return;
        setSummary({ ...report, candidates });
        setServiceRows(rows);
      })
      .catch(() => {
        if (alive) {
          setSummary(null);
          setServiceRows([]);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const rows = useMemo(() => serviceRows, [serviceRows]);
  const reconnectionCandidates = useMemo(() => rows.filter(isReconnectionCandidate), [rows]);
  const activeCount = rows.filter((row) => row.status !== 'disconnected').length;
  const disconnectedCount = rows.filter((row) => row.status === 'disconnected').length;
  const pendingDisco = summary?.candidates?.length ?? 0;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reconnectionCandidates;
    return reconnectionCandidates.filter((row) => {
      const haystack = [
        row.accountNumber,
        row.name,
        row.address,
        row.billMonth,
        row.remarks,
        row.status,
        row.disconnectionDate,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(q);
    });
  }, [query, reconnectionCandidates]);

  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Reconnection" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="restore" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Reconnection review workspace</Text>
              <Text style={styles.heroText}>
                Review paid accounts that still look tied to a disconnection record. This is read-only and keeps the
                desktop reconnection logic visible without changing service state.
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <SummaryCard label="Reconn. Candidates" value={reconnectionCandidates.length} icon="restore" />
            <SummaryCard label="Pending Disco" value={pendingDisco} icon="flash-off" />
            <SummaryCard label="Disconnected" value={disconnectedCount} icon="power-plug-off" />
            <SummaryCard label="Active Service" value={activeCount} icon="power-plug" />
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Reconnection Guardrails</Text>
            <View style={styles.ruleList}>
              <Text style={styles.ruleItem}>- Use the paid/disconnected proxy state as the source of truth.</Text>
              <Text style={styles.ruleItem}>- Keep the reconnection record separate until approval.</Text>
              <Text style={styles.ruleItem}>- Require preview SQL and rollback SQL for the future write flow.</Text>
              <Text style={styles.ruleItem}>- Prevent duplicate reconnection posts by account and bill month.</Text>
              <Text style={styles.ruleItem}>- Preserve audit history and monthly service-status counts.</Text>
            </View>
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Current Mode</Text>
            <Text style={styles.panelSub}>
              Active mode: {activeMode} · Reconnection review is based on the shared disconnection ledger and the paid-status proxy.
            </Text>
          </NeuSurface>
        </View>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Reconnection Candidates</Text>
          <Text style={styles.panelSub}>
            Filter the paid rows that still need reconciliation before they can be restored to active service.
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search account, name, bill month, remarks, or status"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <FlatList
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.rowCard} activeOpacity={0.85} onPress={() => router.push('/(drawer)/utility-service-status' as any)}>
                <View style={styles.rowTop}>
                  <View style={styles.rowIcon}>
                    <MaterialCommunityIcons name="restore" size={18} color={Colors.primaryDark} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.name || item.accountNumber}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {item.accountNumber} · {item.billMonth} · {item.status}
                    </Text>
                  </View>
                  <Text style={styles.statusTag}>REVIEW</Text>
                </View>
                <Text style={styles.rowText2} numberOfLines={2}>
                  {item.address}
                </Text>
                <View style={styles.rowBottom}>
                  <Text style={styles.rowFooter}>Due {item.dueDate || 'N/A'} · Disco {item.disconnectionDate || 'N/A'}</Text>
                  <Text style={styles.reconnectHint}>
                    {item.disconnectionDate || item.remarks || (item as any).app_disconnected_at ? 'Reconnection proxy' : 'No disconnection proxy'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="database-search" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>{loading ? 'Loading reconnection rows...' : 'No reconnection candidates found'}</Text>
                <Text style={styles.emptyText}>Try a different search or review the service-status summary first.</Text>
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
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(183,28,28,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 16, fontWeight: '900', color: Colors.textPrimary },
  rowMeta: { fontSize: 12, color: Colors.textSecondary },
  statusTag: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primaryDark,
    backgroundColor: 'rgba(183,28,28,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  rowText2: { fontSize: 12, lineHeight: 17, color: Colors.textSecondary },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  rowFooter: { flex: 1, fontSize: 11, color: Colors.textSecondary },
  reconnectHint: { fontSize: 11, fontWeight: '700', color: Colors.primaryDark },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 12, color: Colors.textSecondary },
});
