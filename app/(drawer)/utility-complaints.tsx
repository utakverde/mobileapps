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
import type { ComplaintReport } from '@constants/types';
import { getComplaintReports, getReportSummary, listConsumers } from '../../database/consumerRepository';

type WorkflowBucket = {
  label: string;
  count: number;
  color: string;
};

type ComplaintRow = ComplaintReport & {
  assignedTeam?: string;
  area?: string;
  book?: string;
  updatedAt?: string;
};

function countPriority(rows: ComplaintRow[], target: string) {
  return rows.filter((row) => String(row.priority || '').toLowerCase() === target).length;
}

function buildStatusBuckets(rows: ComplaintRow[]): WorkflowBucket[] {
  const states = new Map<string, number>();
  rows.forEach((row) => {
    const key = String(row.status || 'pending').toLowerCase();
    states.set(key, (states.get(key) || 0) + 1);
  });
  return [
    { label: 'pending', count: states.get('pending') || 0, color: Colors.warning },
    { label: 'synced', count: states.get('synced') || 0, color: Colors.success },
    { label: 'failed', count: states.get('failed') || 0, color: Colors.error },
  ];
}

export default function UtilityComplaintsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any | null>(null);
  const [consumerCount, setConsumerCount] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      getComplaintReports(db, { limit: 1000 }),
      getReportSummary(db, {}),
      listConsumers(db, { limit: 1000 }),
    ])
      .then(([rows, summary, consumers]) => {
        if (!alive) return;
        setComplaints(rows as ComplaintRow[]);
        setReport(summary);
        setConsumerCount(consumers.length);
      })
      .catch(() => {
        if (alive) {
          setComplaints([]);
          setReport(null);
          setConsumerCount(0);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return complaints;
    return complaints.filter((row) => {
      const haystack = [
        row.accountNumber,
        row.consumerName,
        row.address,
        row.reportType,
        row.remarks,
        row.priority,
        row.assignedTeam,
        row.status,
        row.area,
        row.book,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(q);
    });
  }, [complaints, query]);

  const bottomPad = Math.max(insets.bottom, 12) + 18;
  const pending = complaints.filter((row) => String(row.status || '').toLowerCase() === 'pending').length;
  const highPriority = countPriority(complaints, 'high');
  const today = new Date();
  const recent = complaints.filter((row) => {
    const created = new Date(row.createdAt);
    if (!Number.isFinite(created.getTime())) return false;
    return today.getTime() - created.getTime() <= 1000 * 60 * 60 * 24 * 7;
  }).length;
  const statusBuckets = useMemo(() => buildStatusBuckets(complaints), [complaints]);
  const topAreas = useMemo(() => {
    const counts = new Map<string, number>();
    complaints.forEach((row) => {
      const key = row.area || 'Unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [complaints]);
  const summaryStats = report?.stats || {};

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Complaints and Field Reports" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="alert-circle" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Complaint workflow and field tracking</Text>
              <Text style={styles.heroText}>
                This page surfaces saved field reports, keeps the intake path linked to consumer data, and shows the
                shared audit and sync boundaries that protect complaint history.
              </Text>
            </View>
          </View>
          <View style={styles.metricsRow}>
            <SummaryCard label="Reports" value={complaints.length} icon="clipboard-text" />
            <SummaryCard label="Pending" value={pending} icon="clock-alert" />
            <SummaryCard label="High Priority" value={highPriority} icon="priority-high" />
            <SummaryCard label="Recent" value={recent} icon="timeline-clock" />
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Search and Quick Actions</Text>
            <Text style={styles.panelSubtitle}>
              {loading ? 'Loading complaint rows...' : `${filtered.length} reports matched`}
            </Text>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search account, report type, remarks, team, status, or area"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionChip, styles.primaryChip]} onPress={() => router.push('/(drawer)/complaint/new')}>
              <MaterialCommunityIcons name="plus-circle" size={18} color={Colors.white} />
              <Text style={styles.actionChipTextActive}>New Complaint</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionChip} onPress={() => router.push('/(drawer)/utility-system-map' as any)}>
              <MaterialCommunityIcons name="map-marker-radius" size={18} color={Colors.primaryDark} />
              <Text style={styles.actionChipText}>Open Map</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionChip} onPress={() => router.push('/(drawer)/reports')}>
              <MaterialCommunityIcons name="chart-bar" size={18} color={Colors.primaryDark} />
              <Text style={styles.actionChipText}>Open Reports</Text>
            </TouchableOpacity>
          </View>
        </NeuSurface>

        <View style={styles.grid}>
          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Workflow Summary</Text>
            <View style={styles.bucketGrid}>
              {statusBuckets.map((bucket) => (
                <View key={bucket.label} style={styles.bucketCard}>
                  <View style={[styles.bucketDot, { backgroundColor: bucket.color }]} />
                  <Text style={styles.bucketValue}>{bucket.count}</Text>
                  <Text style={styles.bucketLabel}>{bucket.label}</Text>
                </View>
              ))}
            </View>
          </NeuSurface>

          <NeuSurface style={styles.panel}>
            <Text style={styles.panelTitle}>Linked Coverage</Text>
            <View style={styles.coverageGrid}>
              <View style={styles.coverageCard}>
                <Text style={styles.coverageValue}>{consumerCount}</Text>
                <Text style={styles.coverageLabel}>Consumer records</Text>
              </View>
              <View style={styles.coverageCard}>
                <Text style={styles.coverageValue}>{summaryStats.totalRecords || 0}</Text>
                <Text style={styles.coverageLabel}>Summary records</Text>
              </View>
              <View style={styles.coverageCard}>
                <Text style={styles.coverageValue}>{summaryStats.problemReports || complaints.length}</Text>
                <Text style={styles.coverageLabel}>Problem reports</Text>
              </View>
            </View>
          </NeuSurface>
        </View>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Area Breakdown</Text>
          <View style={styles.areaList}>
            {topAreas.length === 0 ? (
              <Text style={styles.emptyHint}>No area summary is available yet.</Text>
            ) : (
              topAreas.map((area) => (
                <View key={area.label} style={styles.areaRow}>
                  <Text style={styles.areaName}>{area.label}</Text>
                  <Text style={styles.areaCount}>{area.count}</Text>
                </View>
              ))
            )}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Complaint Queue</Text>
            <Text style={styles.panelSubtitle}>Saved reports and sync-ready records</Text>
          </View>
          <FlatList
            scrollEnabled={false}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.complaintCard}>
                <View style={styles.complaintTopRow}>
                  <View style={styles.typeIcon}>
                    <MaterialCommunityIcons name="alert-box" size={18} color={Colors.primaryDark} />
                  </View>
                  <View style={styles.complaintText}>
                    <Text style={styles.complaintName} numberOfLines={1}>
                      {item.consumerName || item.accountNumber || 'Complaint'}
                    </Text>
                    <Text style={styles.complaintMeta} numberOfLines={1}>
                      {item.accountNumber || '-'} · {String(item.reportType || '').replace(/_/g, ' ')} · {item.priority}
                    </Text>
                  </View>
                  <Text style={styles.statusBadge}>{String(item.status || 'pending').toUpperCase()}</Text>
                </View>
                <Text style={styles.complaintRemarks} numberOfLines={2}>
                  {item.remarks || 'No remarks provided.'}
                </Text>
                <View style={styles.complaintBottomRow}>
                  <Text style={styles.complaintFooter}>
                    {(item.assignedTeam || 'Unassigned') + ' · ' + (item.area || 'No area')}
                  </Text>
                  <TouchableOpacity style={styles.viewBtn} onPress={() => router.push(`/(drawer)/complaint/${item.id}` as any)}>
                    <Text style={styles.viewBtnText}>Open</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.complaintStamp}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'No timestamp'} · Updated{' '}
                  {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'No update'}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="clipboard-alert-outline" size={44} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No complaints found</Text>
                <Text style={styles.emptyText}>Create a new complaint or sync field reports from the mobile collector.</Text>
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
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(183,28,28,0.08)',
  },
  primaryChip: {
    backgroundColor: Colors.primary,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  actionChipTextActive: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  grid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  bucketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bucketCard: {
    flexGrow: 1,
    flexBasis: 120,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    gap: 4,
  },
  bucketDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bucketValue: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  bucketLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  coverageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  coverageCard: {
    flexGrow: 1,
    flexBasis: 120,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 4,
  },
  coverageValue: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  coverageLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  areaList: {
    gap: 10,
  },
  areaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  areaName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  areaCount: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  emptyHint: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  complaintCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  complaintTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  typeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(183,28,28,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  complaintText: {
    flex: 1,
    gap: 2,
  },
  complaintName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  complaintMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primaryDark,
    backgroundColor: Colors.primarySurface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  complaintRemarks: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  complaintBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  complaintFooter: {
    flex: 1,
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  complaintStamp: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  viewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.white,
  },
  viewBtnText: {
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
