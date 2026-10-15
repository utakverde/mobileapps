import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NeuSurface from '@components/ui/NeuSurface';
import DashboardNeuHeader from '@components/layout/DashboardNeuHeader';
import SummaryCard from '@components/common/SummaryCard';
import { Colors } from '@constants/colors';
import {
  UTILITY_ACCOUNTING_EXPORT_CANDIDATES,
  UTILITY_RECONCILIATION_CHECKPOINTS,
  UTILITY_SHARED_ENTITIES,
  UTILITY_SYNC_RULES,
  UTILITY_WRITE_SAFETY_RULES,
} from '@constants/utilityContracts';
import { UTILITY_MODULE_GROUPS } from '@constants/utilityPlatform';

export default function UtilityAccountingIntegrationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const exportRows = UTILITY_ACCOUNTING_EXPORT_CANDIDATES;

  const filteredExports = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exportRows;
    return exportRows.filter((row) => `${row.title} ${row.description}`.toLowerCase().includes(q));
  }, [query, exportRows]);

  const bottomPad = Math.max(insets.bottom, 12) + 18;
  const mappingGroups = UTILITY_MODULE_GROUPS.filter((group) =>
    ['Operations', 'Analytics', 'Audit and Control'].includes(group.area),
  );
  const previewRows = filteredExports.slice(0, 3);
  const previewKeys = previewRows.map((item) => item.key);

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Accounting Integration" />

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="calculator" size={24} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Accounting handoff and export preview</Text>
              <Text style={styles.heroText}>
                The billing platform remains the source of truth. This page exposes export candidates, preview and
                rollback expectations, and the shared rules that protect against duplicate posting.
              </Text>
            </View>
          </View>
          <View style={styles.metricRow}>
            <SummaryCard label="Export Candidates" value={exportRows.length} icon="file-export" />
            <SummaryCard label="Shared Entities" value={UTILITY_SHARED_ENTITIES.length} icon="table-network" />
            <SummaryCard label="Write Rules" value={UTILITY_WRITE_SAFETY_RULES.length} icon="shield-check" />
            <SummaryCard
              label="Reconciliation Checks"
              value={UTILITY_RECONCILIATION_CHECKPOINTS.length}
              icon="scale-balance"
            />
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Posting Contract</Text>
          <View style={styles.contractBox}>
            {[
              'transaction_id',
              'source_name',
              'account_number',
              'bill_month',
              'document_type',
              'document_number',
              'posting_date',
              'debit_account',
              'credit_account',
              'amount',
              'tax_amount',
              'reference',
              'description',
              'audit_status',
              'sync_status',
            ].map((field) => (
              <View key={field} style={styles.contractChip}>
                <Text style={styles.contractText}>{field}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.panelSub}>
            Every exported row needs a stable transaction_id, a duplicate key, preview and approval state, and a
            rollback path before it leaves the billing source of truth.
          </Text>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Safe Posting Checklist</Text>
          <View style={styles.checklist}>
            {[
              'Preview the source rows and the resulting GL totals before export.',
              'Match the transaction_id against the source bill, collection, or adjustment event.',
              'Block duplicates by export batch, source reference, and receipt or document number.',
              'Record audit status, sync status, and any reversal reference for future rollback.',
              'Keep accounting posting logic separate from billing computation logic.',
            ].map((item, index) => (
              <View key={item} style={styles.checkItem}>
                <View style={styles.checkIndex}>
                  <Text style={styles.checkIndexText}>{index + 1}</Text>
                </View>
                <Text style={styles.checkText}>{item}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Preview Snapshot</Text>
          <Text style={styles.panelSub}>
            These rows are the first candidates that should be shown in a future export preview before any approval or posting step.
          </Text>
          <View style={styles.previewBar}>
            <View style={styles.previewChip}>
              <Text style={styles.previewLabel}>Preview Count</Text>
              <Text style={styles.previewValue}>{previewRows.length}</Text>
            </View>
            <View style={styles.previewChip}>
              <Text style={styles.previewLabel}>Stable Keys</Text>
              <Text style={styles.previewValue}>{previewKeys.join(' · ') || 'N/A'}</Text>
            </View>
          </View>
          <View style={styles.previewList}>
            {previewRows.map((item) => (
              <View key={item.key} style={styles.previewCard}>
                <View style={styles.previewCardHeader}>
                  <Text style={styles.previewCardTitle}>{item.title}</Text>
                  <Text style={styles.previewBadge}>Preview only</Text>
                </View>
                <Text style={styles.previewCardText}>{item.description}</Text>
                <Text style={styles.previewCardMeta}>duplicate key: {item.key}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Export Candidates</Text>
          <Text style={styles.panelSub}>
            Search the accounting groups that can be exported or posted in a later approval step.
          </Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search export rows"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
          />
          <FlatList
            scrollEnabled={false}
            data={filteredExports}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <View style={styles.exportCard}>
                <Text style={styles.exportTitle}>{item.title}</Text>
                <Text style={styles.exportText}>{item.description}</Text>
                <View style={styles.exportFooter}>
                  <Text style={styles.exportMeta}>Duplicate key: {item.key}</Text>
                  <Text style={styles.exportMeta}>Approval required</Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="filter-off" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No accounting export rows matched</Text>
              </View>
            }
          />
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Reconciliation Checkpoints</Text>
          <View style={styles.ruleList}>
            {UTILITY_RECONCILIATION_CHECKPOINTS.map((item) => (
              <View key={item.key} style={styles.ruleCard}>
                <Text style={styles.ruleTitle}>{item.title}</Text>
                <Text style={styles.ruleText}>{item.description}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Sync and Duplicate Rules</Text>
          <View style={styles.ruleList}>
            {UTILITY_SYNC_RULES.map((rule) => (
              <View key={rule.key} style={styles.ruleCard}>
                <Text style={styles.ruleTitle}>{rule.title}</Text>
                <Text style={styles.ruleText}>{rule.description}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Rules and Controls</Text>
          <View style={styles.ruleList}>
            {UTILITY_WRITE_SAFETY_RULES.map((rule) => (
              <View key={rule.key} style={styles.ruleCard}>
                <Text style={styles.ruleTitle}>{rule.title}</Text>
                <Text style={styles.ruleText}>{rule.description}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Action Links</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.primaryAction]} onPress={() => router.push('/(drawer)/utility-reconciliation' as any)}>
              <MaterialCommunityIcons name="scale-balance" size={18} color={Colors.white} />
              <Text style={styles.primaryActionText}>Open Reconciliation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(drawer)/utility-audit-trail' as any)}>
              <MaterialCommunityIcons name="clipboard-text-clock" size={18} color={Colors.primaryDark} />
              <Text style={styles.actionText}>Open Audit Trail</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/(drawer)/reports' as any)}>
              <MaterialCommunityIcons name="chart-bar" size={18} color={Colors.primaryDark} />
              <Text style={styles.actionText}>Open Reports</Text>
            </TouchableOpacity>
          </View>
        </NeuSurface>

        <NeuSurface style={styles.panel}>
          <Text style={styles.panelTitle}>Mapping Focus</Text>
          <View style={styles.mapGrid}>
            {mappingGroups.map((group) => (
              <View key={group.title} style={styles.mapCard}>
                <Text style={styles.mapTitle}>{group.title}</Text>
                <Text style={styles.mapArea}>{group.area}</Text>
                <Text style={styles.mapText}>{group.modules.join(' / ')}</Text>
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
  panelSub: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  previewBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  previewChip: {
    flexGrow: 1,
    flexBasis: 180,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 4,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  previewList: {
    gap: 10,
  },
  previewCard: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 4,
  },
  previewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  previewCardTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  previewBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primaryDark,
    backgroundColor: Colors.primarySurface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewCardText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  previewCardMeta: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  contractBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contractChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(183,28,28,0.08)',
  },
  contractText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  checklist: {
    gap: 10,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
  },
  checkIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183,28,28,0.12)',
    marginTop: 1,
  },
  checkIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  checkText: {
    flex: 1,
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
  exportCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
    gap: 6,
    marginBottom: 10,
  },
  exportTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  exportText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  exportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  exportMeta: {
    fontSize: 10,
    fontWeight: '700',
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
  ruleList: {
    gap: 10,
  },
  ruleCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  ruleText: {
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
  mapGrid: {
    gap: 10,
  },
  mapCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  mapTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  mapArea: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
  },
  mapText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
});
