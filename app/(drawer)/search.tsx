import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Card, Chip, Searchbar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { Colors } from '@constants/colors';
import StatusBadge from '@components/common/StatusBadge';
import { listConsumers } from '../../database/consumerRepository';
import { getActiveReadingMode } from '@lib/session';
import { hasPayableBill } from '@lib/billing';

type SearchField = 'name' | 'account' | 'address' | 'serial' | 'sequence' | 'meter';

const SEARCH_FIELDS: { value: SearchField; label: string }[] = [
  { value: 'account', label: 'Account No.' },
  { value: 'name', label: 'Consumer Name' },
  { value: 'address', label: 'Address' },
  { value: 'serial', label: 'Serial No.' },
  { value: 'sequence', label: 'Sequence' },
  { value: 'meter', label: 'Meter No.' },
];

export default function SearchScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [query, setQuery] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('name');
  const [results, setResults] = useState<any[]>([]);
  const activeMode = getActiveReadingMode();
  const openRoute = activeMode === 'disconnection' ? 'payment' : activeMode === 'net_metering' ? 'net-metering' : 'reading';

  useEffect(() => {
    let alive = true;
    const value = query.length < 2 ? '' : query;
    listConsumers(db, { query: value, limit: query.length < 2 ? 25 : 100, mode: activeMode })
      .then((rows: any[]) => {
        if (!alive) return;
        const q = query.toLowerCase();
        const filtered = query.length < 2
          ? rows
          : rows.filter((c) => {
              switch (searchField) {
                case 'name': return String(c.name ?? '').toLowerCase().includes(q);
                case 'account': return String(c.accountNumber ?? '').includes(q);
                case 'address': return String(c.address ?? '').toLowerCase().includes(q);
                case 'serial': return String(c.serialNumber ?? '').toLowerCase().includes(q);
                case 'sequence': return String(c.sequenceNumber ?? '').includes(q);
                case 'meter': return String(c.meterNumber ?? '').toLowerCase().includes(q);
                default: return false;
              }
            });
        setResults(filtered);
      })
      .catch(() => setResults([]));
    return () => {
      alive = false;
    };
  }, [activeMode, db, query, searchField]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
          <MaterialCommunityIcons name="menu" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Consumers</Text>
      </View>

      <View style={styles.searchArea}>
        <Searchbar
          placeholder={`Search by ${SEARCH_FIELDS.find(f => f.value === searchField)?.label}...`}
          value={query}
          onChangeText={setQuery}
          style={styles.searchbar}
          iconColor={Colors.primary}
          autoFocus
        />
        <View style={styles.fieldChips}>
          {SEARCH_FIELDS.map((field) => (
            <Chip
              key={field.value}
              selected={searchField === field.value}
              onPress={() => setSearchField(field.value)}
              style={[styles.chip, searchField === field.value && styles.chipActive]}
              textStyle={[styles.chipText, searchField === field.value && styles.chipTextActive]}
              compact
            >
              {field.label}
            </Chip>
          ))}
        </View>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id ?? item.accountNumber)}
        renderItem={({ item }) => (
          <Card style={styles.resultCard} elevation={1} onPress={() => router.push(`/(drawer)/${openRoute}/${item.id}` as any)}>
            <Card.Content style={styles.resultContent}>
              <View style={styles.resultHeader}>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultAccount}>{item.accountNumber}</Text>
                  <Text style={styles.resultName}>{item.name}</Text>
                  <Text style={styles.resultAddress}>{item.address}</Text>
                </View>
                <StatusBadge status={item.status} size="small" />
              </View>
              <View style={styles.resultMeta}>
                <View style={styles.metaTag}>
                  <MaterialCommunityIcons name="counter" size={12} color={Colors.textMuted} />
                  <Text style={styles.metaText}> {item.serialNumber}</Text>
                </View>
                {item.gpsLat ? (
                  <View style={styles.metaTag}>
                    <MaterialCommunityIcons name="map-marker-check" size={12} color={Colors.success} />
                    <Text style={[styles.metaText, { color: Colors.success }]}> GPS Available</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.resultBtn} onPress={() => router.push(`/(drawer)/${openRoute}/${item.id}` as any)}>
                  <MaterialCommunityIcons name="counter" size={14} color={Colors.primary} />
                  <Text style={styles.resultBtnText}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resultBtn} onPress={() => router.push(`/(drawer)/map/${item.id}`)}>
                  <MaterialCommunityIcons name="map-marker" size={14} color={Colors.warning} />
                  <Text style={[styles.resultBtnText, { color: Colors.warning }]}>Map</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.resultBtn, !hasPayableBill(item) && styles.resultBtnDisabled]}
                  onPress={() => hasPayableBill(item) && router.push(`/(drawer)/payment/${item.id}`)}
                  disabled={!hasPayableBill(item)}
                >
                  <MaterialCommunityIcons name="cash" size={14} color={Colors.success} />
                  <Text style={[styles.resultBtnText, { color: Colors.success }]}>Pay</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resultBtn}
                  onPress={() => router.push(`/(drawer)/invoice/${item.id}` as any)}
                >
                  <MaterialCommunityIcons name="file-document" size={14} color={Colors.textMuted} />
                  <Text style={[styles.resultBtnText, { color: Colors.textMuted }]}>Invoice</Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {query.length < 2 ? (
              <>
                <MaterialCommunityIcons name="magnify" size={64} color={Colors.border} />
                <Text style={styles.emptyTitle}>Search Consumers</Text>
                <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="database-search-outline" size={64} color={Colors.border} />
                <Text style={styles.emptyTitle}>No Results</Text>
                <Text style={styles.emptyText}>No consumers found for "{query}"</Text>
              </>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuBtn: { padding: 2 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.white },
  searchArea: { backgroundColor: Colors.white, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, elevation: 2 },
  searchbar: { backgroundColor: Colors.background, elevation: 0, borderWidth: 1, borderColor: Colors.border },
  fieldChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, paddingBottom: 4 },
  chip: { backgroundColor: Colors.background, borderColor: Colors.border, borderWidth: 1 },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: Colors.white },
  listContent: { padding: 10, flexGrow: 1 },
  resultCard: { marginBottom: 8, borderRadius: 12, backgroundColor: Colors.white },
  resultContent: { paddingHorizontal: 12, paddingVertical: 10 },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  resultInfo: { flex: 1, marginRight: 8 },
  resultAccount: { fontSize: 10, color: Colors.textMuted, letterSpacing: 0.5 },
  resultName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  resultAddress: { fontSize: 12, color: Colors.textSecondary },
  resultMeta: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  metaTag: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 11, color: Colors.textMuted, fontWeight: '500' },
  resultActions: { flexDirection: 'row', gap: 4, borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 8 },
  resultBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 4, borderRadius: 6, backgroundColor: Colors.background },
  resultBtnDisabled: { opacity: 0.45 },
  resultBtnText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.textSecondary },
  emptyText: { fontSize: 13, color: Colors.textMuted },
});
