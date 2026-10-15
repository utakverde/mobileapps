import React from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NeuSurface from '@components/ui/NeuSurface';
import DashboardNeuHeader from '@components/layout/DashboardNeuHeader';
import { Colors } from '@constants/colors';
import {
  UTILITY_ACCOUNTING_EXPORT_CANDIDATES,
  UTILITY_FIELD_ALIAS_MAP,
  UTILITY_RECONCILIATION_CHECKPOINTS,
  UTILITY_SHARED_ENTITIES,
  UTILITY_SYNC_RULES,
  UTILITY_WRITE_SAFETY_RULES,
} from '@constants/utilityContracts';

function SectionCard({
  title,
  icon,
  subtitle,
  children,
}: {
  title: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <NeuSurface style={styles.sectionCard}>
      <View style={styles.sectionHead}>
        <View style={styles.iconBubble}>
          <MaterialCommunityIcons name={icon} size={20} color={Colors.primaryDark} />
        </View>
        <View style={styles.sectionHeadText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </NeuSurface>
  );
}

function ChipGrid({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.chipGrid}>
      {items.map((item) => (
        <View key={item} style={styles.chip}>
          <Text style={styles.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function UtilityOperationsScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const bottomPad = Math.max(insets.bottom, 12) + 24;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Utility Operations" />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
        <NeuSurface style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="view-grid-plus" size={26} color={Colors.primaryDark} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>Shared web foundation for the utility system</Text>
              <Text style={styles.heroText}>
                This first web slice mirrors the desktop utility workflow in a browser-friendly layout and keeps the
                same contracts for consumers, bills, collections, complaints, sync, and accounting handoff.
              </Text>
            </View>
          </View>

          <View style={styles.heroMetrics}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{UTILITY_SHARED_ENTITIES.length}</Text>
              <Text style={styles.metricLabel}>Shared entities</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{UTILITY_SYNC_RULES.length}</Text>
              <Text style={styles.metricLabel}>Sync rules</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{UTILITY_RECONCILIATION_CHECKPOINTS.length}</Text>
              <Text style={styles.metricLabel}>Reconciliation points</Text>
            </View>
          </View>
        </NeuSurface>

        <View style={[styles.grid, isWide && styles.gridWide]}>
          <SectionCard title="Shared Entities" icon="table-network" subtitle="Canonical records used across desktop and web">
            <ChipGrid items={UTILITY_SHARED_ENTITIES.map((entity) => entity.label)} />
          </SectionCard>

          <SectionCard title="Field Alias Map" icon="tag-multiple" subtitle="Drift control across legacy and canonical names">
            <View style={styles.aliasList}>
              {UTILITY_FIELD_ALIAS_MAP.map((field) => (
                <View key={field.canonical} style={styles.aliasRow}>
                  <Text style={styles.aliasKey}>{field.canonical}</Text>
                  <Text style={styles.aliasValue}>{field.aliases.join(', ')}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        </View>

        <View style={[styles.grid, isWide && styles.gridWide]}>
          <SectionCard title="Write Safety" icon="shield-check" subtitle="Preview and rollback requirements before posting">
            <View style={styles.ruleList}>
              {UTILITY_WRITE_SAFETY_RULES.map((rule) => (
                <View key={rule.key} style={styles.ruleItem}>
                  <Text style={styles.ruleTitle}>{rule.title}</Text>
                  <Text style={styles.ruleText}>{rule.description}</Text>
                </View>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="Sync and Reconciliation" icon="sync" subtitle="Duplicate prevention and ledger checks">
            <View style={styles.ruleList}>
              {UTILITY_SYNC_RULES.concat(UTILITY_RECONCILIATION_CHECKPOINTS).map((rule) => (
                <View key={rule.key} style={styles.ruleItem}>
                  <Text style={styles.ruleTitle}>{rule.title}</Text>
                  <Text style={styles.ruleText}>{rule.description}</Text>
                </View>
              ))}
            </View>
          </SectionCard>
        </View>

        <SectionCard title="Accounting Export Candidates" icon="calculator" subtitle="Possible integration points for finance systems">
          <View style={styles.exportGrid}>
            {UTILITY_ACCOUNTING_EXPORT_CANDIDATES.map((item) => (
              <View key={item.key} style={styles.exportCard}>
                <Text style={styles.exportTitle}>{item.title}</Text>
                <Text style={styles.exportText}>{item.description}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  hero: {
    borderRadius: 24,
    padding: 18,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  heroIcon: {
    width: 52,
    height: 52,
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
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  metric: {
    minWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  grid: {
    gap: 16,
  },
  gridWide: {
    flexDirection: 'row',
  },
  sectionCard: {
    borderRadius: 22,
    padding: 16,
    gap: 12,
    flex: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(183,28,28,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeadText: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  chipGrid: {
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
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  aliasList: {
    gap: 10,
  },
  aliasRow: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 4,
  },
  aliasKey: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  aliasValue: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  ruleList: {
    gap: 10,
  },
  ruleItem: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
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
  exportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  exportCard: {
    flexGrow: 1,
    flexBasis: 220,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 6,
  },
  exportTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  exportText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
});
