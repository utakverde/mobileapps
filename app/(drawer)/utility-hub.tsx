import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NeuSurface from '@components/ui/NeuSurface';
import DashboardNeuHeader from '@components/layout/DashboardNeuHeader';
import { Colors } from '@constants/colors';
import {
  PHASE_1_TARGETS,
  UTILITY_ACCOUNT_FAMILIES,
  UTILITY_MODULE_GROUPS,
  UTILITY_PLATFORM_SECTIONS,
} from '@constants/utilityPlatform';
import {
  UTILITY_ACCOUNTING_EXPORT_CANDIDATES,
  UTILITY_FIELD_ALIAS_MAP,
  UTILITY_RECONCILIATION_CHECKPOINTS,
  UTILITY_SHARED_ENTITIES,
  UTILITY_SYNC_RULES,
  UTILITY_WRITE_SAFETY_RULES,
} from '@constants/utilityContracts';

function CardList({ items }: { items: readonly string[] }) {
  return (
    <View style={styles.cardList}>
      {items.map((item) => (
        <View key={item} style={styles.cardChip}>
          <Text style={styles.cardChipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function UtilityHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 12) + 24;
  const workflowShortcuts = [
    { title: 'Audit Trail', icon: 'clipboard-text-clock', route: '/(drawer)/utility-audit-trail' },
    { title: 'System Map', icon: 'map-marker-radius', route: '/(drawer)/utility-system-map' },
    { title: 'Complaints', icon: 'alert-circle', route: '/(drawer)/utility-complaints' },
    { title: 'Accounting', icon: 'calculator', route: '/(drawer)/utility-accounting-integration' },
    { title: 'Reconciliation', icon: 'scale-balance', route: '/(drawer)/utility-reconciliation' },
    { title: 'Financial Analysis', icon: 'chart-line', route: '/(drawer)/utility-financial-analysis' },
    { title: 'Online Sync', icon: 'cloud-sync', route: '/(drawer)/sync' },
    { title: 'SQLite Manager', icon: 'database-import', route: '/(drawer)/sqlite' },
  ] as const;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader title="Utility Hub" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollPad, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <NeuSurface style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="transmission-tower" size={24} color={Colors.primaryDark} />
          </View>
          <Text style={styles.heroTitle}>Shared Utility Platform</Text>
          <Text style={styles.heroText}>
            One contract layer for desktop, web, and Android so billing, collections, sync, audit, and accounting stay
            in harmony.
          </Text>
        </NeuSurface>

        <NeuSurface style={styles.section}>
          <Text style={styles.sectionTitle}>Workflow Shortcuts</Text>
          <View style={styles.shortcutGrid}>
            {workflowShortcuts.map((item) => (
              <TouchableOpacity key={item.title} style={styles.shortcutCard} onPress={() => router.push(item.route as any)} activeOpacity={0.85}>
                <View style={styles.shortcutIcon}>
                  <MaterialCommunityIcons name={item.icon} size={20} color={Colors.primaryDark} />
                </View>
                <Text style={styles.shortcutTitle}>{item.title}</Text>
                <Text style={styles.shortcutText}>Open module</Text>
              </TouchableOpacity>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.section}>
          <Text style={styles.sectionTitle}>Account Families</Text>
          <CardList items={UTILITY_ACCOUNT_FAMILIES} />
        </NeuSurface>

        <NeuSurface style={styles.section}>
          <Text style={styles.sectionTitle}>Phase 1 Targets</Text>
          <CardList items={PHASE_1_TARGETS} />
        </NeuSurface>

        <NeuSurface style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Areas</Text>
          <View style={styles.areaGrid}>
            {UTILITY_PLATFORM_SECTIONS.map((section) => (
              <View key={section.title} style={styles.areaCard}>
                <Text style={styles.areaTitle}>{section.title}</Text>
                <Text style={styles.areaDescription}>{section.description}</Text>
                <CardList items={section.items} />
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.section}>
          <Text style={styles.sectionTitle}>Module Inventory</Text>
          <View style={styles.moduleGroups}>
            {UTILITY_MODULE_GROUPS.map((group) => (
              <View key={group.title} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <Text style={styles.groupArea}>{group.area}</Text>
                </View>
                <CardList items={group.modules} />
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.section}>
          <Text style={styles.sectionTitle}>Shared Contract Map</Text>
          <View style={styles.moduleGroups}>
            {UTILITY_SHARED_ENTITIES.map((entity) => (
              <View key={entity.key} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{entity.label}</Text>
                  <Text style={styles.groupArea}>{entity.domain.replace('_', ' ')}</Text>
                </View>
                <Text style={styles.areaDescription}>{entity.description}</Text>
                <Text style={styles.contractMeta}>
                  Write safety: {entity.writeSafety} | Sync: {entity.syncEnabled ? 'enabled' : 'read only'}
                </Text>
                <Text style={styles.contractMeta}>Duplicate key: {entity.duplicateKey}</Text>
                <Text style={styles.contractMeta}>Reconciliation key: {entity.reconciliationKey}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.section}>
          <Text style={styles.sectionTitle}>Field Aliases and Rules</Text>
          <View style={styles.moduleGroups}>
            {UTILITY_FIELD_ALIAS_MAP.map((field) => (
              <View key={field.canonical} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{field.canonical}</Text>
                  <Text style={styles.groupArea}>Field Alias</Text>
                </View>
                <Text style={styles.areaDescription}>{field.note}</Text>
                <Text style={styles.contractMeta}>{field.aliases.join(', ')}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.section}>
          <Text style={styles.sectionTitle}>Write, Sync, and Reconciliation Rules</Text>
          <View style={styles.moduleGroups}>
            {[...UTILITY_WRITE_SAFETY_RULES, ...UTILITY_SYNC_RULES, ...UTILITY_RECONCILIATION_CHECKPOINTS].map((rule) => (
              <View key={rule.key} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{rule.title}</Text>
                </View>
                <Text style={styles.areaDescription}>{rule.description}</Text>
              </View>
            ))}
          </View>
        </NeuSurface>

        <NeuSurface style={styles.section}>
          <Text style={styles.sectionTitle}>Accounting Export Candidates</Text>
          <View style={styles.moduleGroups}>
            {UTILITY_ACCOUNTING_EXPORT_CANDIDATES.map((item) => (
              <View key={item.key} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{item.title}</Text>
                </View>
                <Text style={styles.areaDescription}>{item.description}</Text>
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
  scrollPad: {
    padding: 16,
    gap: 16,
  },
  hero: {
    padding: 18,
    borderRadius: 22,
    gap: 10,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(183,28,28,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  section: {
    padding: 16,
    borderRadius: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shortcutCard: {
    flexGrow: 1,
    flexBasis: 140,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 6,
  },
  shortcutIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(183,28,28,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  shortcutText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  cardList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(183,28,28,0.08)',
  },
  cardChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  areaGrid: {
    gap: 12,
  },
  areaCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 10,
  },
  areaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  areaDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  moduleGroups: {
    gap: 12,
  },
  groupCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 10,
  },
  groupHeader: {
    gap: 4,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  groupArea: {
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  contractMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
});
