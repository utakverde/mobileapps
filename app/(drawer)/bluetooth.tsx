import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { Colors } from '@constants/colors';
import type { BluetoothDevice } from '@constants/types';
import SectionHeader from '@components/common/SectionHeader';
import { getBluetoothPrinterConfig, saveBluetoothPrinterConfig } from '../../database/configRepository';
import { getReportSummary } from '../../database/consumerRepository';
import { createCollectionReportPrintText, createComplaintReportPrintText, createPrinterPayload, createSummaryReportPrintText } from '../../services/printerService';
import { connectBluetoothPrinter, listBondedBluetoothPrinters, sendBluetoothPrint } from '@lib/bluetoothPrinter';
import { getActiveReadingMode } from '@lib/session';

type PrintAction = {
  icon: string;
  label: string;
  color: string;
  action: 'summary' | 'collection' | 'complaint' | 'test';
};

export default function BluetoothScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const db = useSQLiteContext();
  const [scanning, setScanning] = useState(false);
  const [connectedId, setConnectedId] = useState<string>('');
  const [savedPrinter, setSavedPrinter] = useState<any | null>(null);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const activeMode = getActiveReadingMode();
  const printActions: PrintAction[] = [
    {
      icon: activeMode === 'disconnection' ? 'flash-off' : 'file-chart',
      label: activeMode === 'disconnection' ? 'Print Disco Summary' : 'Print Reading Summary',
      color: activeMode === 'disconnection' ? Colors.error : Colors.primary,
      action: 'summary',
    },
    {
      icon: 'printer-pos',
      label: activeMode === 'disconnection' ? 'Print Disco Collection' : 'Print Reading Collection',
      color: Colors.success,
      action: 'collection',
    },
    { icon: 'alert-circle', label: 'Print Complaint Report', color: Colors.warning, action: 'complaint' },
    { icon: 'printer-check', label: 'Test Print', color: Colors.neutral, action: 'test' },
  ];

  useEffect(() => {
    let alive = true;
    getBluetoothPrinterConfig(db)
      .then((printer) => {
        if (!alive) return;
        setSavedPrinter(printer);
        setConnectedId(printer.isConnected ? printer.id : '');
        if (printer.isConnected && printer.address) {
          setDevices([
            {
              id: printer.id,
              name: printer.name || 'Saved Bluetooth Printer',
              address: printer.address,
              isPaired: true,
              isConnected: true,
            },
          ]);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [db]);

  const handleScan = () => {
    setScanning(true);
    listBondedBluetoothPrinters()
      .then((pairedDevices) => {
        setDevices(pairedDevices);
        if (pairedDevices.length === 0) {
          Alert.alert('No paired printers', 'Pair the printer in Android Bluetooth settings first, then scan again.');
        }
      })
      .catch((error: Error) => {
        Alert.alert('Bluetooth scan failed', error.message);
      })
      .finally(() => {
      setScanning(false);
      });
  };

  const handleConnect = async (device: BluetoothDevice) => {
    if (device.isConnected || device.id === connectedId) {
      Alert.alert('Disconnect', `Disconnect from ${device.name}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          onPress: async () => {
            setConnectedId('');
            await saveBluetoothPrinterConfig(db, { ...device, isConnected: false });
          },
        },
      ]);
    } else {
      try {
        const connected = await connectBluetoothPrinter(device.address || device.id);
        setConnectedId(connected.id);
        setSavedPrinter(connected);
        setDevices((items) =>
          items.map((item) => ({
            ...item,
            isConnected: item.address === connected.address || item.id === connected.id,
          }))
        );
        await saveBluetoothPrinterConfig(db, { ...connected, isConnected: true });
      } catch (error) {
        Alert.alert('Connection failed', error instanceof Error ? error.message : 'Could not connect to printer.');
      }
    }
  };

  const handleTestPrint = async () => {
    const printer = savedPrinter || devices.find((item) => item.id === connectedId);
    if (!printer?.address && !printer?.id) {
      Alert.alert('No Printer', 'Please connect a Bluetooth printer first.');
      return;
    }
    try {
      await sendBluetoothPrint(
        printer.address || printer.id,
        '\x1b@SAMELCO II Mobile\nBluetooth test print\nPrinter ready.\n\n\n'
      );
      Alert.alert('Test Print', 'Test page sent to printer.');
    } catch (error) {
      Alert.alert('Print failed', error instanceof Error ? error.message : 'Could not print test page.');
    }
  };

  const handlePrintAction = async (action: PrintAction) => {
    if (action.action === 'test') {
      await handleTestPrint();
      return;
    }
    const printer = savedPrinter || devices.find((item) => item.id === connectedId);
    if (!printer?.address && !printer?.id) {
      Alert.alert('No Printer', 'Please connect a Bluetooth printer first.');
      return;
    }
    try {
      const mode = activeMode;
      const summary = await getReportSummary(db, { mode });
      const text =
        action.action === 'collection'
          ? createCollectionReportPrintText(summary, { mode })
          : action.action === 'complaint'
          ? createComplaintReportPrintText(summary, { mode })
          : createSummaryReportPrintText(summary, { mode });
      const payload = createPrinterPayload(text, { printerType: printer.printerType });
      await sendBluetoothPrint(printer.address || printer.id, payload);
      Alert.alert(action.label, 'Report sent to Bluetooth printer.');
    } catch (error) {
      Alert.alert('Print failed', error instanceof Error ? error.message : 'Could not print report.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
          <MaterialCommunityIcons name="menu" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bluetooth Printer</Text>
        <MaterialCommunityIcons name="printer-wireless" size={22} color="rgba(255,255,255,0.7)" />
      </View>

      {/* Connection status */}
      <Card style={styles.statusCard} elevation={2}>
        <Card.Content style={styles.statusContent}>
          <View style={[styles.statusIcon, { backgroundColor: connectedId ? Colors.successLight : Colors.neutralLight }]}>
            <MaterialCommunityIcons
              name={connectedId ? 'bluetooth-connect' : 'bluetooth-off'}
              size={32}
              color={connectedId ? Colors.success : Colors.neutral}
            />
          </View>
          <View style={styles.statusInfo}>
            <Text style={styles.statusTitle}>
              {connectedId ? 'Printer Connected' : 'No Printer Connected'}
            </Text>
            <Text style={styles.statusDevice}>
              {connectedId
                ? savedPrinter?.name || savedPrinter?.address || devices.find(d => d.id === connectedId)?.name || ''
                : 'Scan to find printers'}
            </Text>
            {savedPrinter?.printerType ? (
              <Text style={styles.statusDevice}>Profile: {String(savedPrinter.printerType).toUpperCase()}</Text>
            ) : null}
            {connectedId && (
              <View style={styles.batteryRow}>
                <MaterialCommunityIcons name="battery-80" size={14} color={Colors.success} />
                <Text style={styles.batteryText}> Printer Battery: 82%</Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* Scan button */}
      <View style={styles.scanSection}>
        <Button
          mode="contained"
          icon={scanning ? 'progress-clock' : 'bluetooth-search'}
          onPress={handleScan}
          loading={scanning}
          style={styles.scanBtn}
          contentStyle={styles.scanBtnContent}
        >
          {scanning ? 'Scanning...' : 'Scan Bluetooth Devices'}
        </Button>
      </View>

      <SectionHeader title="Available Devices" />

      {/* Device list */}
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.deviceList}
        renderItem={({ item }) => (
          <Card style={styles.deviceCard} elevation={1}>
            <Card.Content style={styles.deviceContent}>
              <View style={styles.deviceIcon}>
                <MaterialCommunityIcons
                  name="printer-wireless"
                  size={22}
                  color={item.id === connectedId ? Colors.success : Colors.neutral}
                />
              </View>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{item.name}</Text>
                <Text style={styles.deviceAddr}>{item.address}</Text>
                <View style={styles.deviceTags}>
                  {item.isPaired && (
                    <View style={[styles.tag, { backgroundColor: Colors.primarySurface }]}>
                      <Text style={[styles.tagText, { color: Colors.primary }]}>Paired</Text>
                    </View>
                  )}
                  {item.id === connectedId && (
                    <View style={[styles.tag, { backgroundColor: Colors.successLight }]}>
                      <Text style={[styles.tagText, { color: Colors.success }]}>Connected</Text>
                    </View>
                  )}
                  <Text style={styles.rssiText}>{item.rssi} dBm</Text>
                </View>
              </View>
              <Button
                mode={item.id === connectedId ? 'contained' : 'outlined'}
                onPress={() => handleConnect(item)}
                compact
                style={styles.connectBtn}
                buttonColor={item.id === connectedId ? Colors.success : undefined}
              >
                {item.id === connectedId ? 'Disconnect' : item.isPaired ? 'Connect' : 'Pair'}
              </Button>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <Card style={styles.deviceCard} elevation={1}>
            <Card.Content>
              <Text style={styles.statusDevice}>
                No paired Bluetooth printers found yet. Pair the printer in Android Bluetooth settings, then tap Scan Bluetooth Devices.
              </Text>
            </Card.Content>
          </Card>
        }
        ListFooterComponent={
          <>
            <SectionHeader title="Print Actions" />
            <View style={styles.printActions}>
              {printActions.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={[styles.printBtn, !connectedId && styles.printBtnDisabled]}
                  onPress={() => handlePrintAction(action)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name={action.icon as any} size={22} color={connectedId ? action.color : Colors.border} />
                  <Text style={[styles.printBtnText, !connectedId && styles.printBtnTextDisabled]}>
                    {action.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
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
  statusCard: { margin: 10, borderRadius: 12, backgroundColor: Colors.white },
  statusContent: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  statusIcon: { width: 60, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  statusDevice: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  batteryRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  batteryText: { fontSize: 11, color: Colors.success, fontWeight: '600' },
  scanSection: { paddingHorizontal: 10, paddingBottom: 6 },
  scanBtn: { borderRadius: 10 },
  scanBtnContent: { height: 46 },
  deviceList: { paddingHorizontal: 10, paddingBottom: 30 },
  deviceCard: { marginBottom: 8, borderRadius: 12, backgroundColor: Colors.white },
  deviceContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  deviceIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  deviceAddr: { fontSize: 11, color: Colors.textMuted, fontFamily: 'monospace' },
  deviceTags: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 3 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '700' },
  rssiText: { fontSize: 10, color: Colors.textMuted },
  connectBtn: { borderRadius: 8 },
  printActions: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, gap: 8 },
  printBtn: {
    width: '47%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: 14, borderRadius: 12, backgroundColor: Colors.white,
    borderWidth: 1.5, borderColor: Colors.border, gap: 6,
  },
  printBtnDisabled: { opacity: 0.5 },
  printBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  printBtnTextDisabled: { color: Colors.textMuted },
});
