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
import { listConsumers } from '../../database/consumerRepository';
import { UTILITY_ACCOUNT_FAMILIES } from '@constants/utilityPlatform';
import { getActiveReadingMode } from '@lib/session';

function detectFamily(consumer: Consumer) {
  const blob = `${consumer.rateCode} ${consumer.name} ${consumer.remarks}`.toLowerCase();
  if (blob.includes('bapa')) return 'BAPA';
  if (blob.includes('net')) return 'Net Metering';
  if (blob.includes('lifeline')) return 'Lifeline';
  if (blob.includes('senior')) return 'Senior';
  if (blob.includes('disconnection')) return 'Disconnection';
  return 'Regular Consumer';
}

export default function UtilityConsumerManagementScreen() {
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

  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const item of rows) {
      const key = item.accountNumber.trim();
      seen.set(key, (seen.get(key) || 0) + 1);
    }
    return Array.from(seen.entries()).filter(([, count]) => count > 1);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((item) => {
      if (!q) return true;
      return [item.accountNumber, item.name, item.address, item.rateCode, item.status, detectFamily(item)]
        .map((value) => String(value || '').toLowerCase())
        .join(' ')
        .includes(q);
    });
  }, [query, rows]);

  const readiness = useMemo(
    () => rows.filter((item) => !item.accountNumber || !item.name || !item.address || !item.serialNumber || !item.meterNumber).length,
    [rows]
  );
  const families = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of rows) {
      const family = detectFamily(item);
      counts.set(family, (counts.get(family) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([family, count]) => ({ family, count }));
  }, [rows]);
  const bottomPad = Math.max(insets.bottom, 12) + 18;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Consumer Management" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="account-group" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Consumer master data</Text>
              <Text style={styles.heroText}>
                This is the master-data entry point for consumers, new-connection readiness, family grouping, and
                duplicate-watch checks. It stays read-only for now while the write contract is prepared.
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <SummaryCard label="Consumers" value={rows.length} icon="account-group" />
            <SummaryCard label="Families" value={families.length} icon="shape" />
            <SummaryCard label="Readiness Gaps" value={readiness} icon="alert-circle" />
            <SummaryCard label="Duplicates" value={duplicates.length} icon="alert-octagon" />
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Master Search</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search account, name, address, rate, or family"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <View style={styles.familyWrap}>
            {UTILITY_ACCOUNT_FAMILIES.map((family) => (
              <View key={family} style={styles.familyPill}>
                <Text style={styles.familyText}>{family}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Family Distribution</Text>
          <View style={styles.familyGrid}>
            {families.map((item) => (
              <View key={item.family} style={styles.familyCard}>
                <Text style={styles.familyCount}>{item.count}</Text>
                <Text style={styles.familyName}>{item.family}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Consumers</Text>
          <FlatList
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const family = detectFamily(item);
              const readinessFlags = [
                !item.name ? 'Missing name' : null,
                !item.address ? 'Missing address' : null,
                !item.serialNumber ? 'Missing serial' : null,
                !item.meterNumber ? 'Missing meter' : null,
              ].filter(Boolean) as string[];
              return (
                <View style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <View style={styles.rowIcon}>
                      <MaterialCommunityIcons name="account" size={18} color={Colors.primaryDark} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {item.name || 'Unnamed consumer'}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {item.accountNumber} · {item.rateCode} · {family}
                      </Text>
                    </View>
                    <Text style={styles.statusTag}>{String(item.status || '').toUpperCase()}</Text>
                  </View>
                  <Text style={styles.rowText2} numberOfLines={2}>
                    {item.address || 'No address recorded'}
                  </Text>
                  {readinessFlags.length > 0 ? (
                    <View style={styles.flagWrap}>
                      {readinessFlags.map((flag) => (
                        <View key={flag} style={styles.flagPill}>
                          <Text style={styles.flagText}>{flag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.rowBottom}>
                    <Text style={styles.rowFooter}>
                      {item.bookNumber || 'Book N/A'} · {item.areaCode || 'Area N/A'} · Seq {item.sequenceNumber}
                    </Text>
                    <TouchableOpacity style={styles.linkBtn}>
                      <Text style={styles.linkText}>Open</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="database-search" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No consumers found</Text>
                <Text style={styles.emptyText}>Try another search or sync master data from the desktop utility.</Text>
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
  familyWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  familyPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(183,28,28,0.08)',
  },
  familyText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  familyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  familyCard: {
    flexGrow: 1,
    flexBasis: 160,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 4,
  },
  familyCount: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  familyName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
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
  rowText2: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  flagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  flagPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.errorLight,
  },
  flagText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.error,
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
  linkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primarySurface,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primaryDark,
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
