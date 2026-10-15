import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NeuSurface from '@components/ui/NeuSurface';
import DashboardNeuHeader from '@components/layout/DashboardNeuHeader';
import SummaryCard from '@components/common/SummaryCard';
import { Colors } from '@constants/colors';
import type { Consumer } from '@constants/types';
import { getDisconnectionCandidates, getReportSummary, listConsumers } from '../../database/consumerRepository';
import { getActiveReadingMode } from '@lib/session';

function isReconnectionProxy(item: Consumer) {
  return item.status === 'paid' && Boolean(item.disconnectionDate || item.remarks || (item as any).app_disconnected_at);
}

export default function UtilityServiceStatusScreen() {
  const db = useSQLiteContext();
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
  const pendingDisconnect = summary?.candidates?.length ?? 0;
  const disconnectedCount = rows.filter((row) => row.status === 'disconnected').length;
  const reconnectionProxyCount = rows.filter(isReconnectionProxy).length;
  const activeCount = rows.filter((row) => row.status !== 'disconnected').length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
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
  }, [query, rows]);

  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Service Status" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="flash-off" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Disconnection and reconnection summary</Text>
              <Text style={styles.heroText}>
                This page summarizes the current disconnection workload and shows a proxy count for accounts that look
                ready for reconnection review. It does not alter service status.
              </Text>
            </View>
          </View>
          <View style={styles.metricsRow}>
            <SummaryCard label="Pending Disco" value={pendingDisconnect} icon="flash-off" />
            <SummaryCard label="Disconnected" value={disconnectedCount} icon="power-plug-off" />
            <SummaryCard label="Active Service" value={activeCount} icon="power-plug" />
            <SummaryCard label="Reconn. Proxy" value={reconnectionProxyCount} icon="restore" />
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Service Review</Text>
            <Text style={styles.panelSubtitle}>
              Current mode: {activeMode} · Disconnection counts are based on the local SQLite record state
            </Text>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search account, name, bill month, remarks, or status"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickChip} onPress={() => setQuery('disconnected')}>
              <Text style={styles.quickText}>Show disconnected</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickChip} onPress={() => setQuery('paid')}>
              <Text style={styles.quickText}>Show paid</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickChip} onPress={() => setQuery('')}>
              <Text style={styles.quickText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Service Rows</Text>
            <Text style={styles.panelSubtitle}>
              {loading ? 'Loading service rows...' : `${filtered.length} rows matched`}
            </Text>
          </View>
          <FlatList
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <View style={styles.rowIcon}>
                    <MaterialCommunityIcons
                      name={item.status === 'disconnected' ? 'flash-off' : item.status === 'paid' ? 'check-circle' : 'flash'}
                      size={18}
                      color={item.status === 'disconnected' ? Colors.error : item.status === 'paid' ? Colors.success : Colors.primaryDark}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.name || item.accountNumber}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {item.accountNumber} · {item.billMonth} · {item.status}
                    </Text>
                  </View>
                  <Text style={[styles.statusTag, item.status === 'disconnected' && styles.statusTagBad, item.status === 'paid' && styles.statusTagGood]}>
                    {String(item.status || '').toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.rowText2} numberOfLines={2}>
                  {item.address}
                </Text>
                <View style={styles.rowBottom}>
                  <Text style={styles.rowFooter}>Due {item.dueDate || 'N/A'} · Disco {item.disconnectionDate || 'N/A'}</Text>
                  {isReconnectionProxy(item) ? <Text style={styles.reconnectHint}>Reconnection proxy</Text> : null}
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="database-search" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No service rows found</Text>
                <Text style={styles.emptyText}>Try a different search or switch the active mode.</Text>
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
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(183,28,28,0.08)',
  },
  quickText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  rowCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(183,28,28,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  rowMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusTag: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primaryDark,
    backgroundColor: Colors.primarySurface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusTagBad: {
    backgroundColor: Colors.errorLight,
    color: Colors.error,
  },
  statusTagGood: {
    backgroundColor: Colors.successLight,
    color: Colors.success,
  },
  rowText2: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  rowFooter: {
    flex: 1,
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  reconnectHint: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.success,
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
