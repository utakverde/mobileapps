import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, ProgressBar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { Colors } from '@constants/colors';
import type { SyncLog } from '@constants/types';
import SectionHeader from '@components/common/SectionHeader';
import { getApiBaseUrl, isApiConfigured, pingApiHealth } from '@lib/api';
import { runSyncQueue } from '@lib/sync';
import { getSyncSummary } from '../../database/consumerRepository';

export default function SyncScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [apiTesting, setApiTesting] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);

  React.useEffect(() => {
    let alive = true;
    getSyncSummary(db)
      .then((logs: SyncLog[]) => {
        if (alive) setSyncLogs(logs);
      })
      .catch(() => {
        if (alive) setSyncLogs([]);
      });
    return () => {
      alive = false;
    };
  }, [db]);

  const testApi = async () => {
    if (!isApiConfigured()) {
      Alert.alert(
        'API URL not set',
        'Create a .env file in the mobile app folder with:\n\nEXPO_PUBLIC_API_URL=https://your-worker.workers.dev\n\nThen restart Expo (npx expo start -c). See .env.example.'
      );
      return;
    }
    setApiTesting(true);
    try {
      const r = await pingApiHealth();
      if (r.ok) {
        Alert.alert('API reachable', `Base URL:\n${getApiBaseUrl()}\n\nResponse preview:\n${r.body ?? ''}`);
      } else {
        Alert.alert('API error', `Could not reach:\n${getApiBaseUrl()}\n\n(${r.body})`);
      }
    } catch (e) {
      Alert.alert('API error', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setApiTesting(false);
    }
  };

  const handleSyncNow = async (direction: 'sync' | 'upload' | 'download' = 'sync') => {
    if (!isApiConfigured()) {
      Alert.alert(
        'API URL not set',
        'Configure EXPO_PUBLIC_API_URL before running sync. Local records will stay queued until the server is available.'
      );
      return;
    }

    setSyncing(true);
    setSyncProgress(0);
    const interval = setInterval(() => {
      setSyncProgress((p) => {
        if (p >= 0.9) return p;
        return p + 0.05;
      });
    }, 100);

    try {
      const queue = await getSyncSummary(db);
      setSyncLogs(queue);
      const result = await runSyncQueue(direction, queue);
      const failed = result.filter((item) => item.status === 'failed');
      setSyncProgress(1);
      Alert.alert(
        failed.length > 0 ? 'Sync completed with errors' : 'Sync complete',
        failed.length > 0
          ? `${failed.length} module(s) need attention. Check the server logs for details.`
          : `${result.length} module(s) synchronized successfully.`
      );
    } catch (error) {
      Alert.alert('Sync failed', error instanceof Error ? error.message : 'Could not complete sync.');
    } finally {
      clearInterval(interval);
      setSyncing(false);
    }
  };

  const totalPending = syncLogs.reduce((a, b) => a + b.pendingCount, 0);
  const totalFailed = syncLogs.reduce((a, b) => a + b.failedCount, 0);
  const totalSynced = syncLogs.reduce((a, b) => a + b.syncedCount, 0);
  const activeModules = syncLogs.filter((log) => log.pendingCount > 0 || log.failedCount > 0).length;
  const healthyModules = syncLogs.filter((log) => log.pendingCount === 0 && log.failedCount === 0).length;
  const queueHealth = syncLogs.length > 0 ? ((healthyModules / syncLogs.length) * 100).toFixed(1) : '0.0';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
          <MaterialCommunityIcons name="menu" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Online Sync</Text>
        <MaterialCommunityIcons name="cloud-sync" size={22} color="rgba(255,255,255,0.7)" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Server status */}
        <Card style={styles.serverCard} elevation={2}>
          <Card.Content style={styles.serverContent}>
            <View style={styles.serverIconWrap}>
              <MaterialCommunityIcons
                name="server-network"
                size={28}
                color={isApiConfigured() ? Colors.success : Colors.neutral}
              />
            </View>
            <View style={styles.serverInfo}>
              <Text style={styles.serverStatus}>
                {isApiConfigured() ? 'API URL configured' : 'API URL not set'}
              </Text>
              <Text style={styles.serverUrl} numberOfLines={3}>
                {isApiConfigured() ? getApiBaseUrl() : 'Add EXPO_PUBLIC_API_URL to .env (see .env.example)'}
              </Text>
              <Text style={styles.lastSyncText}>Local API: apiconnect/local-api</Text>
            </View>
            <View style={[styles.connDot, { backgroundColor: isApiConfigured() ? Colors.success : Colors.neutral }]} />
          </Card.Content>
          <Card.Actions style={styles.serverActions}>
            <Button mode="contained-tonal" onPress={testApi} loading={apiTesting} disabled={apiTesting}>
              Test API connection
            </Button>
          </Card.Actions>
        </Card>

        {/* Pending summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryItem, { backgroundColor: Colors.warningLight }]}>
            <Text style={[styles.summaryNum, { color: Colors.warning }]}>{totalPending}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: Colors.successLight }]}>
            <Text style={[styles.summaryNum, { color: Colors.success }]}>{totalSynced}</Text>
            <Text style={styles.summaryLabel}>Synced</Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: Colors.errorLight }]}>
            <Text style={[styles.summaryNum, { color: Colors.error }]}>{totalFailed}</Text>
            <Text style={styles.summaryLabel}>Failed</Text>
          </View>
        </View>

        {/* Sync progress */}
        {syncing && (
          <Card style={styles.progressCard} elevation={1}>
            <Card.Content>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>Syncing...</Text>
                <Text style={styles.progressPct}>{Math.round(syncProgress * 100)}%</Text>
              </View>
              <ProgressBar progress={syncProgress} color={Colors.primary} style={styles.progressBar} />
            </Card.Content>
          </Card>
        )}

        {/* Sync actions */}
        <Card style={styles.healthCard} elevation={1}>
          <Card.Content>
            <View style={styles.healthRow}>
              <View style={styles.healthItem}>
                <Text style={styles.healthLabel}>Queue Health</Text>
                <Text style={styles.healthValue}>{queueHealth}%</Text>
              </View>
              <View style={styles.healthItem}>
                <Text style={styles.healthLabel}>Active Modules</Text>
                <Text style={styles.healthValue}>{activeModules}</Text>
              </View>
              <View style={styles.healthItem}>
                <Text style={styles.healthLabel}>Healthy Modules</Text>
                <Text style={styles.healthValue}>{healthyModules}</Text>
              </View>
            </View>
            <Text style={styles.healthNote}>
              Duplicate prevention uses account, bill month, receipt number, and export batch keys before local uploads are accepted.
            </Text>
          </Card.Content>
        </Card>

        <View style={styles.syncActionsRow}>
          <Button
            mode="contained"
            icon={syncing ? 'progress-clock' : 'cloud-sync'}
            onPress={() => handleSyncNow('sync')}
            loading={syncing}
            disabled={syncing}
            style={styles.syncNowBtn}
            contentStyle={styles.syncNowContent}
            labelStyle={styles.syncNowLabel}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </View>
        <View style={styles.secondaryActions}>
          <Button
            mode="outlined"
            icon="refresh"
            compact
            style={styles.secBtn}
            disabled={syncing}
            onPress={() => {
              if (syncing) return;
              Alert.alert('Retry Failed', 'Retry queued failed sync operations?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Retry', onPress: () => handleSyncNow('sync') },
              ]);
            }}
          >
            Retry Failed
          </Button>
          <Button
            mode="outlined"
            icon="upload-multiple"
            compact
            style={styles.secBtn}
            disabled={syncing}
            onPress={() => {
              if (syncing) return;
              Alert.alert('Force Upload', 'Upload all pending local changes to the server?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Upload', onPress: () => handleSyncNow('upload') },
              ]);
            }}
          >
            Force Upload
          </Button>
          <Button
            mode="outlined"
            icon="download-multiple"
            compact
            style={styles.secBtn}
            disabled={syncing}
            onPress={() => {
              if (syncing) return;
              Alert.alert('Force Download', 'Download latest master data from the server?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Download', onPress: () => handleSyncNow('download') },
              ]);
            }}
          >
            Force Download
          </Button>
        </View>

        <Card style={styles.reviewCard} elevation={1}>
          <Card.Content>
            <Text style={styles.reviewTitle}>Review Links</Text>
            <View style={styles.reviewRow}>
              <TouchableOpacity style={styles.reviewBtn} onPress={() => router.push('/(drawer)/utility-audit-trail' as any)}>
                <MaterialCommunityIcons name="clipboard-text-clock" size={18} color={Colors.primaryDark} />
                <Text style={styles.reviewBtnText}>Audit Trail</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reviewBtn} onPress={() => router.push('/(drawer)/utility-reconciliation' as any)}>
                <MaterialCommunityIcons name="scale-balance" size={18} color={Colors.primaryDark} />
                <Text style={styles.reviewBtnText}>Reconciliation</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reviewBtn} onPress={() => router.push('/(drawer)/sqlite' as any)}>
                <MaterialCommunityIcons name="database-import" size={18} color={Colors.primaryDark} />
                <Text style={styles.reviewBtnText}>SQLite Manager</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Module sync logs */}
        <SectionHeader title="Sync Modules" />
        {syncLogs.map((log: SyncLog) => (
          <Card key={log.module} style={styles.logCard} elevation={1}>
            <Card.Content style={styles.logContent}>
              <View style={styles.logIconWrap}>
                <MaterialCommunityIcons
                  name={log.failedCount > 0 ? 'alert-circle' : log.pendingCount > 0 ? 'clock-outline' : 'check-circle'}
                  size={22}
                  color={log.failedCount > 0 ? Colors.error : log.pendingCount > 0 ? Colors.warning : Colors.success}
                />
              </View>
              <View style={styles.logInfo}>
                <Text style={styles.logModule}>{log.module}</Text>
                <View style={styles.logStats}>
                  {log.pendingCount > 0 && (
                    <View style={[styles.logBadge, { backgroundColor: Colors.warningLight }]}>
                      <Text style={[styles.logBadgeText, { color: Colors.warning }]}>{log.pendingCount} pending</Text>
                    </View>
                  )}
                  {log.failedCount > 0 && (
                    <View style={[styles.logBadge, { backgroundColor: Colors.errorLight }]}>
                      <Text style={[styles.logBadgeText, { color: Colors.error }]}>{log.failedCount} failed</Text>
                    </View>
                  )}
                  <View style={[styles.logBadge, { backgroundColor: Colors.successLight }]}>
                    <Text style={[styles.logBadgeText, { color: Colors.success }]}>{log.syncedCount} synced</Text>
                  </View>
                </View>
                <Text style={styles.logLastSync}>
                  {log.lastSync ? `Last: ${log.lastSync}` : 'Never synced'} · Queue checked
                </Text>
              </View>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  if (log.failedCount === 0) {
                    Alert.alert('Retry', `No failed items for ${log.module}.`);
                    return;
                  }
                  Alert.alert('Retry', `Retry enqueued for ${log.module}.`);
                }}
              >
                <MaterialCommunityIcons
                  name="refresh"
                  size={18}
                  color={log.failedCount > 0 ? Colors.primary : Colors.border}
                />
              </TouchableOpacity>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
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
  serverCard: { margin: 10, borderRadius: 12, backgroundColor: Colors.white, borderLeftWidth: 5, borderLeftColor: Colors.neutral },
  serverContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  serverIconWrap: { width: 50, height: 50, borderRadius: 12, backgroundColor: Colors.neutralLight, justifyContent: 'center', alignItems: 'center' },
  serverInfo: { flex: 1 },
  serverStatus: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  serverUrl: { fontSize: 11, color: Colors.textMuted, fontFamily: 'monospace' },
  lastSyncText: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  connDot: { width: 10, height: 10, borderRadius: 5 },
  serverActions: { paddingHorizontal: 12, paddingBottom: 8, justifyContent: 'flex-end' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 10, gap: 8, marginBottom: 4 },
  summaryItem: { flex: 1, alignItems: 'center', borderRadius: 12, padding: 14 },
  summaryNum: { fontSize: 26, fontWeight: '900' },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '600' },
  progressCard: { margin: 10, marginTop: 0, borderRadius: 12, backgroundColor: Colors.white },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  progressPct: { fontSize: 13, color: Colors.primary, fontWeight: '800' },
  progressBar: { height: 8, borderRadius: 4 },
  healthCard: { margin: 10, marginTop: 0, borderRadius: 12, backgroundColor: Colors.white },
  healthRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  healthItem: {
    flexGrow: 1,
    flexBasis: 100,
    borderRadius: 12,
    padding: 12,
    backgroundColor: Colors.background,
    gap: 4,
  },
  healthLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },
  healthValue: { fontSize: 18, fontWeight: '900', color: Colors.primaryDark },
  healthNote: { fontSize: 11, lineHeight: 16, color: Colors.textSecondary, marginTop: 10 },
  syncActionsRow: { paddingHorizontal: 10, marginBottom: 8 },
  syncNowBtn: { borderRadius: 10 },
  syncNowContent: { height: 50 },
  syncNowLabel: { fontSize: 16, fontWeight: '700' },
  secondaryActions: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, marginBottom: 4 },
  secBtn: { flex: 1, borderRadius: 8 },
  reviewCard: { margin: 10, marginTop: 0, borderRadius: 12, backgroundColor: Colors.white },
  reviewTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, marginBottom: 10 },
  reviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reviewBtn: {
    flexGrow: 1,
    flexBasis: 110,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.primarySurface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewBtnText: { fontSize: 11, fontWeight: '800', color: Colors.primaryDark },
  logCard: { marginHorizontal: 10, marginBottom: 8, borderRadius: 12, backgroundColor: Colors.white },
  logContent: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  logIconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  logInfo: { flex: 1 },
  logModule: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  logStats: { flexDirection: 'row', gap: 6, marginTop: 4 },
  logBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  logBadgeText: { fontSize: 10, fontWeight: '700' },
  logLastSync: { fontSize: 10, color: Colors.textMuted, marginTop: 3 },
  retryBtn: { padding: 6 },
});
