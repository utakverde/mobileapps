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
import { listConsumers } from '../../database/consumerRepository';
import { getActiveReadingMode } from '@lib/session';

function isReadyForConnection(item: Consumer) {
  return Boolean(item.name && item.address && item.serialNumber && item.meterNumber && item.areaCode && item.bookNumber);
}

function getDuplicateKey(item: Consumer) {
  return `${item.accountNumber || ''}-${item.serialNumber || ''}-${item.meterNumber || ''}`.toLowerCase();
}

export default function UtilityNewConnectionScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const activeMode = getActiveReadingMode();
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Consumer[]>([]);

  useEffect(() => {
    let alive = true;
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

  const readinessGaps = useMemo(() => rows.filter((item) => !isReadyForConnection(item)).length, [rows]);
  const readyCount = useMemo(() => rows.filter((item) => isReadyForConnection(item)).length, [rows]);
  const duplicateBuckets = useMemo(() => {
    const seen = new Map<string, number>();
    for (const item of rows) {
      const key = getDuplicateKey(item);
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    return Array.from(seen.entries()).filter(([, count]) => count > 1);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) =>
      [item.accountNumber, item.name, item.address, item.rateCode, item.areaCode, item.bookNumber, item.serialNumber, item.meterNumber]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')
        .includes(q)
    );
  }, [query, rows]);

  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="New Connection Processing" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="account-plus" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>New connection readiness</Text>
              <Text style={styles.heroText}>
                This page is a read-only bridge for the new-connection module. It highlights consumers that already
                satisfy the minimum record fields and shows duplicate-watch buckets for later posting controls.
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <SummaryCard label="Ready" value={readyCount} icon="check-circle" />
            <SummaryCard label="Gaps" value={readinessGaps} icon="alert-circle" />
            <SummaryCard label="Duplicates" value={duplicateBuckets.length} icon="alert-octagon" />
            <SummaryCard label="Records" value={rows.length} icon="database" />
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Readiness Rules</Text>
          <View style={styles.ruleList}>
            {[
              'Required fields: account, name, address, serial number, meter number, area, and book.',
              'Duplicate prevention: account number + serial number + meter number should be unique.',
              'No write action yet: preview and rollback will be required before the first connection post.',
              'Source of truth remains the desktop and the shared SQLite record set.',
            ].map((text) => (
              <View key={text} style={styles.ruleCard}>
                <MaterialCommunityIcons name="shield-check" size={16} color={Colors.primaryDark} />
                <Text style={styles.ruleText}>{text}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Search Connections</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search account, name, address, area, book, serial, or meter"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <FlatList
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const ready = isReadyForConnection(item);
              return (
                <View style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <View style={styles.rowIcon}>
                      <MaterialCommunityIcons name={ready ? 'check-circle' : 'alert-circle'} size={18} color={ready ? Colors.success : Colors.warning} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {item.name || 'Unnamed consumer'}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {item.accountNumber} · {item.areaCode || 'Area N/A'} · Book {item.bookNumber || 'N/A'}
                      </Text>
                    </View>
                    <Text style={[styles.statusTag, ready ? styles.statusOk : styles.statusWarn]}>
                      {ready ? 'READY' : 'CHECK'}
                    </Text>
                  </View>
                  <Text style={styles.rowText2} numberOfLines={2}>
                    {item.address || 'No address recorded'}
                  </Text>
                  <View style={styles.flagWrap}>
                    {!item.serialNumber ? <View style={styles.flagPill}><Text style={styles.flagText}>Missing serial</Text></View> : null}
                    {!item.meterNumber ? <View style={styles.flagPill}><Text style={styles.flagText}>Missing meter</Text></View> : null}
                    {!item.areaCode ? <View style={styles.flagPill}><Text style={styles.flagText}>Missing area</Text></View> : null}
                    {!item.bookNumber ? <View style={styles.flagPill}><Text style={styles.flagText}>Missing book</Text></View> : null}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="account-search" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No connection records found</Text>
                <Text style={styles.emptyText}>Try another search or sync master data from the desktop utility.</Text>
              </View>
            }
          />
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Duplicate Watch</Text>
          <Text style={styles.panelSub}>Potential duplicate buckets based on account, serial, and meter numbers.</Text>
          <View style={styles.dupList}>
            {duplicateBuckets.length > 0 ? (
              duplicateBuckets.map(([key, count]) => (
                <View key={key} style={styles.dupCard}>
                  <Text style={styles.dupTitle}>{key}</Text>
                  <Text style={styles.dupText}>{count} records share this combination</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No duplicate buckets detected in the current dataset.</Text>
            )}
          </View>
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
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(183,28,28,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, gap: 6 },
  heroTitle: { fontSize: 21, lineHeight: 27, fontWeight: '800', color: Colors.textPrimary },
  heroText: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  panel: { borderRadius: 22, padding: 16, gap: 12 },
  panelTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  panelSub: { fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  ruleList: { gap: 8 },
  ruleCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 14, padding: 12 },
  ruleText: { flex: 1, fontSize: 12, lineHeight: 17, color: Colors.textSecondary, fontWeight: '600' },
  searchInput: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.textPrimary, backgroundColor: 'rgba(255,255,255,0.7)' },
  rowCard: { backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 16, padding: 12, gap: 8, marginBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(183,28,28,0.12)', alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  rowMeta: { fontSize: 12, color: Colors.textSecondary },
  statusTag: { fontSize: 10, fontWeight: '900', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusOk: { backgroundColor: Colors.successLight, color: Colors.success },
  statusWarn: { backgroundColor: Colors.warningLight, color: Colors.warning },
  rowText2: { fontSize: 12, lineHeight: 17, color: Colors.textSecondary },
  flagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flagPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.errorLight },
  flagText: { fontSize: 11, fontWeight: '700', color: Colors.error },
  emptyState: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  dupList: { gap: 10 },
  dupCard: { backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 16, padding: 12, gap: 4 },
  dupTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  dupText: { fontSize: 12, lineHeight: 17, color: Colors.textSecondary },
});
