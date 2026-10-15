import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@constants/colors';
import { UTILITY_ACCOUNT_FAMILIES, UTILITY_MODULE_GROUPS, UTILITY_PLATFORM_SECTIONS } from '@constants/utilityPlatform';
import { UTILITY_ACCOUNTING_EXPORT_CANDIDATES } from '@constants/utilityContracts';

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export default function UtilityWebHomeScreen() {
  const router = useRouter();
  const workflowIndex = [
    {
      title: 'Operations',
      items: [
        { label: 'Consumers', route: '/(drawer)/utility-consumer-management' },
        { label: 'New Connection', route: '/(drawer)/utility-new-connection' },
        { label: 'Meter Reading', route: '/(drawer)/utility-meter-reading' },
        { label: 'Bill Creation', route: '/(drawer)/utility-bill-creation' },
      ],
    },
    {
      title: 'Finance',
      items: [
        { label: 'Rates & Scheduling', route: '/(drawer)/utility-rates-schedules' },
        { label: 'Bill Adjustment', route: '/(drawer)/utility-bill-adjustment' },
        { label: 'Financial Analysis', route: '/(drawer)/utility-financial-analysis' },
        { label: 'Reconciliation', route: '/(drawer)/utility-reconciliation' },
      ],
    },
    {
      title: 'Control',
      items: [
        { label: 'Audit Trail', route: '/(drawer)/utility-audit-trail' },
        { label: 'System Map', route: '/(drawer)/utility-system-map' },
        { label: 'Complaints', route: '/(drawer)/utility-complaints' },
        { label: 'Accounting', route: '/(drawer)/utility-accounting-integration' },
      ],
    },
    {
      title: 'Sync',
      items: [
        { label: 'Online Sync', route: '/(drawer)/sync' },
        { label: 'SQLite Manager', route: '/(drawer)/sqlite' },
        { label: 'Reports', route: '/(drawer)/reports' },
        { label: 'Hub', route: '/(drawer)/utility-hub' },
      ],
    },
  ] as const;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="web" size={22} color={Colors.white} />
          </View>
          <Text style={styles.title}>Utility Web Portal</Text>
          <Text style={styles.subtitle}>
            Shared browser entry for the utility conversion. Use this page to jump into login, module review,
            and the shared billing, collections, complaints, and accounting paths.
          </Text>
          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/utility-login' as any)}>
              <MaterialCommunityIcons name="login" size={18} color={Colors.white} />
              <Text style={styles.primaryBtnText}>Open Login</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-hub' as any)}>
              <MaterialCommunityIcons name="view-grid-plus" size={18} color={Colors.primaryDark} />
              <Text style={styles.secondaryBtnText}>Open Hub</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Workflow Index</Text>
          <Text style={styles.cardText}>
            Quick links grouped by how the utility team actually works, from operations to sync and audit.
          </Text>
          <View style={styles.workflowGrid}>
            {workflowIndex.map((section) => (
              <View key={section.title} style={styles.workflowSection}>
                <Text style={styles.workflowTitle}>{section.title}</Text>
                <View style={styles.workflowItems}>
                  {section.items.map((item) => (
                    <TouchableOpacity key={item.label} style={styles.workflowItem} onPress={() => router.push(item.route as any)} activeOpacity={0.85}>
                      <Text style={styles.workflowItemText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mode Selection</Text>
          <Text style={styles.cardText}>Reading, Disconnection, Net Metering, and Large Load remain the core operational modes.</Text>
          <View style={styles.pillWrap}>
              <Pill label="Reading" />
              <Pill label="Disconnection" />
              <Pill label="Net Metering" />
              <Pill label="Large Load" />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Families</Text>
            <Text style={styles.cardText}>Shared families that need consistent logic across desktop, web, and mobile.</Text>
            <View style={styles.pillWrap}>
              {UTILITY_ACCOUNT_FAMILIES.map((family) => (
                <Pill key={family} label={family} />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Consumer Management</Text>
          <Text style={styles.cardText}>
            Review master records, family groupings, and readiness gaps before bill creation or new connection work.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-consumer-management' as any)}>
            <MaterialCommunityIcons name="account-group" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Consumers</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>New Connection Processing</Text>
          <Text style={styles.cardText}>
            Review readiness for new service accounts, duplicate checks, and the fields that must exist before a
            future write flow is allowed.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-new-connection' as any)}>
            <MaterialCommunityIcons name="account-plus" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open New Connection</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Meter Reading</Text>
          <Text style={styles.cardText}>
            Review posted readings, kWh validation, wrap-around candidates, and zero-usage bills before bill
            creation or correction.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-meter-reading' as any)}>
            <MaterialCommunityIcons name="gauge" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Meter Reading</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bill Creation</Text>
          <Text style={styles.cardText}>
            Review bill-ready rows, preview totals, and the write-safety rules that must stay in place before any
            future posting workflow is enabled.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-bill-creation' as any)}>
            <MaterialCommunityIcons name="file-document-edit" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Bill Creation</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bill Update / Adjustment</Text>
          <Text style={styles.cardText}>
            Review likely correction candidates and jump into the existing preview-and-rollback correction flow.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-bill-adjustment' as any)}>
            <MaterialCommunityIcons name="file-document-edit-outline" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Bill Adjustment</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Disconnection</Text>
          <Text style={styles.cardText}>
            Review pending disconnections, paid-but-still-flagged accounts, and monthly service-status counts.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/disconnection' as any)}>
            <MaterialCommunityIcons name="flash-off" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Disconnection</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reconnection</Text>
          <Text style={styles.cardText}>
            Review paid accounts that still look tied to a disconnection record and are ready for restoration review.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-reconnection' as any)}>
            <MaterialCommunityIcons name="restore" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Reconnection</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lifeline and Senior</Text>
          <Text style={styles.cardText}>
            Review discount-sensitive accounts, subsidy drift risks, and the records that carry lifeline or senior
            flags in the billing engine.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-lifeline-senior' as any)}>
            <MaterialCommunityIcons name="hand-heart" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Lifeline/Senior</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Net Metering</Text>
          <Text style={styles.cardText}>
            Review import and export kWh, net credit, and billable totals before any future posting flow is enabled.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-net-metering' as any)}>
            <MaterialCommunityIcons name="solar-power" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Net Metering</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shared Platform Areas</Text>
          <View style={styles.sectionList}>
            {UTILITY_PLATFORM_SECTIONS.map((section) => (
              <View key={section.title} style={styles.sectionRow}>
                <Text style={styles.sectionName}>{section.title}</Text>
                <Text style={styles.sectionDesc}>{section.description}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Module Map</Text>
          <View style={styles.moduleMap}>
            {UTILITY_MODULE_GROUPS.map((group) => (
              <View key={group.title} style={styles.moduleCard}>
                <Text style={styles.moduleTitle}>{group.title}</Text>
                <Text style={styles.moduleArea}>{group.area}</Text>
                <Text style={styles.moduleList}>{group.modules.join(' · ')}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rates and Scheduling</Text>
          <Text style={styles.cardText}>
            Review ERC, tax, reading schedule, due date, and disconnection reference fields before any write-enabled
            maintenance work.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-rates-schedules' as any)}>
            <MaterialCommunityIcons name="cash-lock" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Rates & Scheduling</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Financial Analysis</Text>
          <Text style={styles.cardText}>
            Review rate buckets, lifeline-sensitive accounts, zero-kWh bills, and collection coverage before export.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-financial-analysis' as any)}>
            <MaterialCommunityIcons name="chart-line" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Analysis</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>System Map Integration</Text>
          <Text style={styles.cardText}>
            Review GPS-ready consumers, area nodes, and complaint-linked field records before drilling into the
            existing consumer map view.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-system-map' as any)}>
            <MaterialCommunityIcons name="map-marker-radius" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open System Map</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Complaints Workflow</Text>
          <Text style={styles.cardText}>
            Review queued field reports, intake history, and the account-linked complaint detail flow used by the
            mobile collector.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-complaints' as any)}>
            <MaterialCommunityIcons name="alert-circle" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Complaints</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sync and SQLite</Text>
          <Text style={styles.cardText}>
            Check upload queues, retry health, and the local database manager used for offline-first transfer work.
          </Text>
          <View style={styles.secondaryRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/sync' as any)}>
              <MaterialCommunityIcons name="cloud-sync" size={18} color={Colors.primaryDark} />
              <Text style={styles.secondaryBtnText}>Open Sync</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/sqlite' as any)}>
              <MaterialCommunityIcons name="database-import" size={18} color={Colors.primaryDark} />
              <Text style={styles.secondaryBtnText}>Open SQLite</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accounting Integration</Text>
          <Text style={styles.cardText}>
            Review export candidates, posting contract fields, and rollback-safe handoff rules for accounting.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-accounting-integration' as any)}>
            <MaterialCommunityIcons name="calculator" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Accounting</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reconciliation</Text>
          <Text style={styles.cardText}>
            Compare due totals, collections, duplicates, and export candidates before any future accounting post.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-reconciliation' as any)}>
            <MaterialCommunityIcons name="scale-balance" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Reconciliation</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reports</Text>
          <Text style={styles.cardText}>
            Open the desktop-style reporting dashboard for sales, aging, collections, complaints, and print output.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/reports' as any)}>
            <MaterialCommunityIcons name="chart-bar" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Reports</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Audit Trail</Text>
          <Text style={styles.cardText}>
            Review audit-sensitive rows, rollback guidance, and the per-bill audit detail flow before any future
            correction write.
          </Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(drawer)/utility-audit-trail' as any)}>
            <MaterialCommunityIcons name="clipboard-text-clock" size={18} color={Colors.primaryDark} />
            <Text style={styles.secondaryBtnText}>Open Audit Trail</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Accounting Handoff</Text>
          <View style={styles.moduleMap}>
            {UTILITY_ACCOUNTING_EXPORT_CANDIDATES.map((item) => (
              <View key={item.key} style={styles.moduleCard}>
                <Text style={styles.moduleTitle}>{item.title}</Text>
                <Text style={styles.moduleList}>{item.description}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 18,
    gap: 16,
  },
  hero: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: Colors.white,
    gap: 10,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  secondaryBtnText: {
    color: Colors.primaryDark,
    fontWeight: '800',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  card: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: Colors.white,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  cardText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  workflowGrid: {
    gap: 12,
  },
  workflowSection: {
    gap: 8,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  workflowTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  workflowItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workflowItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primarySurface,
  },
  workflowItemText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(183,28,28,0.08)',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  sectionList: {
    gap: 10,
  },
  sectionRow: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 4,
  },
  sectionName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  moduleMap: {
    gap: 10,
  },
  moduleCard: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: 4,
  },
  moduleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  moduleArea: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
  },
  moduleList: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
});
