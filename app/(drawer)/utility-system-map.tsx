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
import type { ComplaintReport, Consumer } from '@constants/types';
import { getComplaintReports, listConsumers } from '../../database/consumerRepository';

type AreaNode = {
  areaCode: string;
  count: number;
  gpsCount: number;
  complaintCount: number;
  sampleId: string;
  sampleName: string;
};

function buildAreaNodes(consumers: Consumer[], complaints: ComplaintReport[]): AreaNode[] {
  const complaintByArea = new Map<string, number>();
  complaints.forEach((item) => {
    const key = String(item.accountNumber || '').trim();
    if (!key) return;
    complaintByArea.set(key, (complaintByArea.get(key) || 0) + 1);
  });

  const nodes = new Map<string, AreaNode>();
  for (const consumer of consumers) {
    const key = consumer.areaCode || 'Unknown';
    const current = nodes.get(key) || {
      areaCode: key,
      count: 0,
      gpsCount: 0,
      complaintCount: 0,
      sampleId: consumer.id,
      sampleName: consumer.name,
    };
    current.count += 1;
    if (consumer.gpsLat !== null && consumer.gpsLng !== null) current.gpsCount += 1;
    if (complaintByArea.has(consumer.accountNumber)) current.complaintCount += complaintByArea.get(consumer.accountNumber) || 0;
    if (!current.sampleName) {
      current.sampleId = consumer.id;
      current.sampleName = consumer.name;
    }
    nodes.set(key, current);
  }
  return Array.from(nodes.values()).sort((a, b) => b.count - a.count);
}

export default function UtilitySystemMapScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [complaints, setComplaints] = useState<ComplaintReport[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([listConsumers(db, { limit: 1000 }), getComplaintReports(db, { limit: 500 })])
      .then(([consumerRows, complaintRows]) => {
        if (!alive) return;
        setConsumers(consumerRows);
        setComplaints(complaintRows as ComplaintReport[]);
      })
      .catch(() => {
        if (alive) {
          setConsumers([]);
          setComplaints([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const bottomPad = Math.max(insets.bottom, 12) + 18;
  const gpsConsumers = consumers.filter((row) => row.gpsLat !== null && row.gpsLng !== null);
  const mapReadyComplaints = complaints.filter((row) => row.gpsLat !== null && row.gpsLng !== null);
  const areaNodes = useMemo(() => buildAreaNodes(consumers, complaints), [complaints, consumers]);
  const locationFields = [
    'accountNumber',
    'areaCode',
    'bookNumber',
    'sequenceNumber',
    'gpsLat',
    'gpsLng',
    'reportType',
    'photoUri',
    'status',
  ];

  const filteredAreas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return areaNodes;
    return areaNodes.filter((node) => `${node.areaCode} ${node.sampleName}`.toLowerCase().includes(q));
  }, [areaNodes, query]);

  const topArea = areaNodes[0];

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="System Map Integration" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="map-marker-radius" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Consumer, route, and complaint map overview</Text>
              <Text style={styles.heroText}>
                This read-only screen shows map-ready consumers, complaint locations, and area nodes so the utility
                team can drill into field records without breaking billing or sync contracts.
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <SummaryCard label="GPS Consumers" value={gpsConsumers.length} icon="map-marker-check" />
            <SummaryCard label="Map Complaints" value={mapReadyComplaints.length} icon="alert-circle" />
            <SummaryCard label="Areas" value={areaNodes.length} icon="map" />
            <SummaryCard label="Top Area" value={topArea?.areaCode || 'N/A'} icon="home-map-marker" />
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Location Reference Fields</Text>
          <View style={styles.chipWrap}>
            {locationFields.map((field) => (
              <View key={field} style={styles.chip}>
                <Text style={styles.chipText}>{field}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Drilldown Rules</Text>
            <View style={styles.ruleList}>
              {[
                'Open the per-consumer map view for GPS capture and navigation.',
                'Use account number, area code, and book number to cross-check route placement.',
                'Treat complaints with GPS as map-linked service events, not billing writes.',
                'Keep location edits idempotent and queued for sync like other offline actions.',
              ].map((item) => (
                <View key={item} style={styles.ruleCard}>
                  <MaterialCommunityIcons name="check-circle-outline" size={16} color={Colors.primaryDark} />
                  <Text style={styles.ruleText}>{item}</Text>
                </View>
              ))}
            </View>
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Sync and Audit Notes</Text>
            <View style={styles.ruleList}>
              {[
                'GPS capture remains local-first until sync uploads the new coordinates.',
                'Map-linked complaints retain ticket history and status transitions.',
                'Location updates should preserve the before-image for audit review.',
                'Duplicate map rows are prevented by account and location reference keys.',
              ].map((item) => (
                <View key={item} style={styles.ruleCard}>
                  <MaterialCommunityIcons name="shield-check" size={16} color={Colors.primaryDark} />
                  <Text style={styles.ruleText}>{item}</Text>
                </View>
              ))}
            </View>
          </NeuSurface>
        </View>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Area Nodes</Text>
          <Text style={styles.panelSub}>
            Search areas or open a sample record to review the existing consumer map detail screen.
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search area or consumer"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <FlatList
            scrollEnabled={false}
            data={filteredAreas}
            keyExtractor={(item) => item.areaCode}
            renderItem={({ item }) => (
              <View style={styles.areaCard}>
                <View style={styles.areaRow}>
                  <View style={styles.areaLeft}>
                    <Text style={styles.areaCode}>Area {item.areaCode}</Text>
                    <Text style={styles.areaMeta}>
                      {item.count} consumer(s) · {item.gpsCount} with GPS · {item.complaintCount} complaint link(s)
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.openBtn}
                    onPress={() => router.push(`/(drawer)/map/${item.sampleId}` as any)}
                  >
                    <Text style={styles.openBtnText}>Open Sample</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.areaSample}>Sample: {item.sampleName || 'No sample available'}</Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="map-search-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No area nodes matched</Text>
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
  panelSub: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(183,28,28,0.08)',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  grid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  ruleList: {
    gap: 10,
  },
  ruleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  ruleText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
    fontWeight: '600',
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
  areaCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
    gap: 6,
    marginBottom: 10,
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  areaLeft: {
    flex: 1,
    gap: 2,
  },
  areaCode: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  areaMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  areaSample: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  openBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primarySurface,
  },
  openBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 22,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
