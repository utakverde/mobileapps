import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Divider, ProgressBar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useSQLiteContext } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Colors } from '@constants/colors';
import SectionHeader from '@components/common/SectionHeader';
import {
  SQLITE_DATABASE_NAME,
  SQLITE_PATH,
  backupActiveDatabase,
  ensureAppStorageFolders,
  exportAdbDatabaseCopy,
  importNewestDatabaseCopy,
  stageLatestRestorePoint,
} from '@lib/databaseFiles';

const DB_ACTIONS = [
  { icon: 'database-import', label: 'Upload / Import DB', color: Colors.primary, desc: 'Load database.db from Import.' },
  { icon: 'database-export', label: 'Download / Export DB', color: Colors.success, desc: 'Copy active DB to Export.' },
  { icon: 'cloud-download', label: 'ADB Export Copy', color: Colors.primaryDark, desc: 'Create Export/database.db for PC.' },
  { icon: 'cloud-upload', label: 'ADB Import Now', color: Colors.warning, desc: 'Load Import/database.db.' },
  { icon: 'backup-restore', label: 'Backup Database', color: Colors.success, desc: 'Create local backup' },
  { icon: 'history', label: 'Restore Before Update', color: Colors.error, desc: 'Stage previous restore point' },
  { icon: 'database-refresh', label: 'Refresh Info', color: '#F9A825', desc: 'Reload table and file status.' },
  { icon: 'zip-box', label: 'Vacuum Database', color: Colors.neutral, desc: 'Compact the active database.' },
  { icon: 'sync', label: 'Sync Database', color: Colors.primary, desc: 'Sync with server' },
] as const;

export default function SQLiteScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const db = useSQLiteContext();
  const [transferring, setTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);

  const refreshInfo = async () => {
    try {
      await ensureAppStorageFolders();
      await FileSystem.getInfoAsync(SQLITE_PATH);
    } catch (e) {
      Alert.alert('Refresh failed', e instanceof Error ? e.message : 'Could not refresh database status.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await ensureAppStorageFolders();
        if (cancelled) return;
        await FileSystem.getInfoAsync(SQLITE_PATH);
      } catch {
        // Keep the management screen available even if file metadata is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUsbTransfer = async (direction: 'upload' | 'download') => {
    setTransferring(true);
    setTransferProgress(0);
    try {
      setTransferProgress(0.35);
      if (direction === 'download') {
        const exported = await exportAdbDatabaseCopy();
        setTransferProgress(1);
        Alert.alert(
          'ADB Download Copy Ready',
          exported.compatPath && exported.backupPath
            ? 'Device export copy and backup were created. Use the desktop transfer tool to download the database.'
            : 'Device export copy was created. Use the desktop transfer tool to download the database.'
        );
      } else {
        const imported = await importNewestDatabaseCopy();
        setTransferProgress(1);
        if (imported) {
          Alert.alert('ADB Import Complete', 'Database was loaded from the secured import location. Restart the app to reopen the SQLite connection.');
          return;
        } else {
          Alert.alert(
            'No Import Found',
            'No database.db was found in the secured import location. Upload from the desktop app first, then tap Upload DB again.'
          );
        }
      }
      await refreshInfo();
    } catch (error) {
      Alert.alert('ADB transfer failed', error instanceof Error ? error.message : 'Could not complete transfer.');
    } finally {
      setTransferring(false);
    }
  };

  const exportDatabase = async () => {
    const fileInfo = await FileSystem.getInfoAsync(SQLITE_PATH);
    if (!fileInfo.exists) {
      Alert.alert('Export SQLite', 'The active database file was not found in app storage.');
      return;
    }

    const exported = await exportAdbDatabaseCopy();
    Alert.alert(
      'Download DB Ready',
      exported.compatPath && exported.backupPath
        ? 'Current database was exported and a backup was created. Use the desktop transfer tool to download it.'
        : 'Current database was exported. Use the desktop transfer tool to download it.'
    );
  };

  const handleDatabaseAction = (label: string) => {
    if (label === 'Export SQLite' || label === 'Download / Share DB' || label === 'Download / Export DB') {
      exportDatabase()
        .catch((error) => Alert.alert('Export failed', error instanceof Error ? error.message : 'Could not export database.'));
      return;
    }

    if (label === 'Pick DB File' || label === 'Upload / Import DB') {
      handleUsbTransfer('upload');
      return;
    }

    if (label === 'Import SQLite' || label === 'ADB Import Now') {
      handleUsbTransfer('upload');
      return;
    }

    if (label === 'ADB Download Copy' || label === 'ADB Export Copy') {
      handleUsbTransfer('download');
      return;
    }

    if (label === 'Backup Database') {
      backupActiveDatabase('manual')
        .then((path) => Alert.alert('Backup created', path || 'No active database found.'))
        .catch((error) => Alert.alert('Backup failed', error instanceof Error ? error.message : 'Could not back up database.'));
      return;
    }

    if (label === 'Restore Before Update') {
      Alert.alert('Restore previous database', 'The newest restore point will replace the active database after the app restarts. The current database will remain backed up first.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stage Restore',
          style: 'destructive',
          onPress: () => stageLatestRestorePoint()
            .then((path) => Alert.alert('Restore staged', path ? 'Restart the app to activate the previous database.' : 'No restore point was found.'))
            .catch((error) => Alert.alert('Restore failed', error instanceof Error ? error.message : 'Could not stage the restore point.')),
        },
      ]);
      return;
    }

    if (label === 'Refresh Info') {
      refreshInfo();
      return;
    }

    if (label === 'Vacuum Database') {
      db.execAsync('VACUUM')
        .then(refreshInfo)
        .then(() => Alert.alert('Vacuum Database', 'Database compacted successfully.'))
        .catch((error) => Alert.alert('Vacuum failed', error instanceof Error ? error.message : 'Could not compact database.'));
      return;
    }

    Alert.alert(label, 'This operation needs the backend/file-picker integration before it can run safely.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
          <MaterialCommunityIcons name="menu" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SQLite Database Manager</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* DB Info card */}
        <Card style={styles.dbCard} elevation={2}>
          <Card.Content>
            <View style={styles.dbHeader}>
              <View style={styles.dbIcon}>
                <MaterialCommunityIcons name="database" size={32} color={Colors.primary} />
              </View>
              <View style={styles.dbInfo}>
                <Text style={styles.dbName}>{SQLITE_DATABASE_NAME}</Text>
                <View style={styles.dbStatusRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.dbStatus}>Local database</Text>
                </View>
              </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.dbStatsRow}>
              <View style={styles.dbStat}>
                <Text style={styles.dbStatNum}>Hidden</Text>
                <Text style={styles.dbStatLabel}>Records</Text>
              </View>
              <View style={[styles.dbStat, styles.dbStatBorder]}>
                <Text style={styles.dbStatNum}>Hidden</Text>
                <Text style={styles.dbStatLabel}>File Size</Text>
              </View>
              <View style={styles.dbStat}>
                <Text style={styles.dbStatNum}>Local</Text>
                <Text style={styles.dbStatLabel}>Engine</Text>
              </View>
            </View>
            <Text style={styles.lastModified}>Live database details are hidden for security.</Text>
            <Text style={styles.bundledHint}>
              Database transfer and image folders are available, but internal paths are hidden for security.
            </Text>
          </Card.Content>
        </Card>

        {/* DB Actions */}
        <SectionHeader title="Database Operations" />
        <View style={styles.actionsGrid}>
          {DB_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionTile}
              onPress={() => handleDatabaseAction(action.label)}
              activeOpacity={0.7}
            >
              <View style={[styles.tileIcon, { backgroundColor: action.color + '18' }]}>
                <MaterialCommunityIcons name={action.icon as any} size={26} color={action.color} />
              </View>
              <Text style={styles.tileLabel}>{action.label}</Text>
              <Text style={styles.tileDesc}>{action.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* USB ADB */}
        <SectionHeader title="USB ADB Transfer" />
        <Card style={styles.usbCard} elevation={1}>
          <Card.Content>
            <View style={styles.usbInfo}>
              <MaterialCommunityIcons name="usb" size={20} color={Colors.primary} />
              <Text style={styles.usbInfoText}>
                USB/ADB transfer uses secured app folders. Internal commands and paths are hidden for security.
              </Text>
            </View>
            {transferring && (
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>Transferring...</Text>
                  <Text style={styles.progressPct}>{Math.round(transferProgress * 100)}%</Text>
                </View>
                <ProgressBar progress={transferProgress} color={Colors.primary} style={styles.progressBar} />
              </View>
            )}
            <View style={styles.usbBtns}>
              <Button
                mode="contained"
                icon="download"
                onPress={() => exportDatabase().catch((error) => Alert.alert('Download failed', error instanceof Error ? error.message : 'Could not export database.'))}
                style={styles.usbBtn}
                disabled={transferring}
              >
                Download DB
              </Button>
              <Button
                mode="outlined"
                icon="upload"
                onPress={() => handleUsbTransfer('upload')}
                style={styles.usbBtn}
                disabled={transferring}
              >
                Upload DB
              </Button>
            </View>
          </Card.Content>
        </Card>

        <SectionHeader title="App Image Folders" />
        <Card style={styles.liveCard} elevation={1}>
          <Card.Content>
            <View style={styles.usbInfo}>
              <MaterialCommunityIcons name="shield-lock" size={20} color={Colors.primary} />
              <Text style={styles.usbInfoText}>
                Image folder locations are hidden for security. Captured photos are still saved by module.
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuBtn: { padding: 2 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: Colors.white },
  dbCard: {
    margin: 10,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderLeftWidth: 5,
    borderLeftColor: Colors.primary,
  },
  dbHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  dbIcon: {
    width: 58, height: 58, borderRadius: 14, backgroundColor: Colors.primarySurface,
    justifyContent: 'center', alignItems: 'center',
  },
  dbInfo: { flex: 1 },
  dbName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  dbStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.warning },
  dbStatus: { fontSize: 12, color: Colors.warning, fontWeight: '600' },
  divider: { marginVertical: 12, backgroundColor: Colors.divider },
  dbStatsRow: { flexDirection: 'row' },
  dbStat: { flex: 1, alignItems: 'center' },
  dbStatBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.divider },
  dbStatNum: { fontSize: 18, fontWeight: '800', color: Colors.primary },
  dbStatLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  lastModified: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 8 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, paddingBottom: 4 },
  actionTile: {
    width: '47%', margin: '1.5%', backgroundColor: Colors.white,
    borderRadius: 12, padding: 14, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.border, elevation: 1,
  },
  tileIcon: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  tileLabel: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  tileDesc: { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  usbCard: { margin: 10, marginTop: 0, borderRadius: 12, backgroundColor: Colors.white },
  usbInfo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.primarySurface, borderRadius: 10, padding: 10, marginBottom: 14,
  },
  usbInfoText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  commandBox: { backgroundColor: Colors.background, borderRadius: 10, padding: 10, marginBottom: 14, gap: 4 },
  commandTitle: { fontSize: 10, fontWeight: '800', color: Colors.primaryDark, textTransform: 'uppercase' },
  commandText: { fontSize: 10, color: Colors.textSecondary, fontFamily: 'monospace', marginBottom: 6 },
  progressSection: { marginBottom: 14 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  progressPct: { fontSize: 13, color: Colors.primary, fontWeight: '800' },
  progressBar: { height: 8, borderRadius: 4 },
  usbBtns: { flexDirection: 'row', gap: 8 },
  usbBtn: { flex: 1, borderRadius: 8 },
  bundledHint: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 14,
  },
  liveCard: { marginHorizontal: 10, marginBottom: 10, borderRadius: 12, backgroundColor: Colors.white },
  liveLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  liveLoadingText: { fontSize: 13, color: Colors.textSecondary },
  liveError: { fontSize: 13, color: Colors.error },
  liveMeta: { fontSize: 12, fontWeight: '700', color: Colors.primaryDark, marginBottom: 10 },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
    gap: 8,
  },
  tableName: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.textPrimary },
  tableRows: { fontSize: 11, color: Colors.textMuted },
  moreTables: { fontSize: 11, color: Colors.textMuted, marginTop: 8, fontStyle: 'italic' },
});
