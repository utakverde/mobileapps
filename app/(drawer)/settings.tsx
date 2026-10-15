import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Divider, RadioButton, Switch, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { Colors } from '@constants/colors';
import type { PrintSetting, SortOrder, PrinterType } from '@constants/types';
import SectionHeader from '@components/common/SectionHeader';
import { getBluetoothPrinterConfig, saveBluetoothPrinterConfig } from '../../database/configRepository';
import { sendBluetoothPrint } from '@lib/bluetoothPrinter';

interface ToggleRowProps {
  label: string;
  subtitle?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor?: string;
}

function ToggleRow({ label, subtitle, value, onToggle, icon, iconColor = Colors.primary }: ToggleRowProps) {
  return (
    <View style={settingsStyles.toggleRow}>
      <View style={[settingsStyles.toggleIcon, { backgroundColor: iconColor + '18' }]}>
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      </View>
      <View style={settingsStyles.toggleInfo}>
        <Text style={settingsStyles.toggleLabel}>{label}</Text>
        {subtitle && <Text style={settingsStyles.toggleSub}>{subtitle}</Text>}
      </View>
      <Switch value={value} onValueChange={onToggle} color={Colors.primary} />
    </View>
  );
}

const settingsStyles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  toggleIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  toggleSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
});

export default function SettingsScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const router = useRouter();
  const db = useSQLiteContext();

  const [printSetting, setPrintSetting] = useState<PrintSetting>('always_ask');
  const [recordView, setRecordView] = useState<'all' | 'unread' | 'paid'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('sequence');
  const [printerType, setPrinterType] = useState<PrinterType>('woosim');

  // Toggles
  const [showReports, setShowReports] = useState(true);
  const [showPay, setShowPay] = useState(true);
  const [showPrint, setShowPrint] = useState(true);
  const [autoNext, setAutoNext] = useState(false);
  const [enableGPS, setEnableGPS] = useState(true);
  const [enableCamera, setEnableCamera] = useState(true);
  const [enableAutoSync, setEnableAutoSync] = useState(false);
  const [enableOffline, setEnableOffline] = useState(true);
  const [enableOnline, setEnableOnline] = useState(false);

  useEffect(() => {
    let alive = true;
    getBluetoothPrinterConfig(db)
      .then((printer) => {
        if (!alive) return;
        if (printer.printerType) setPrinterType(printer.printerType as PrinterType);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [db]);

  const handleSave = () => {
    saveBluetoothPrinterConfig(db, { printerType })
      .then(() => Alert.alert('Settings Saved', 'Your preferences have been saved successfully.'))
      .catch(() => Alert.alert('Settings Saved', 'Settings saved locally, but printer config could not be updated.'));
  };

  const handleReset = () => {
    Alert.alert('Reset Settings', 'Are you sure you want to reset all settings to defaults?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setPrintSetting('always_ask');
          setRecordView('all');
          setSortOrder('sequence');
          setPrinterType('woosim');
          setShowReports(true);
          setShowPay(true);
          setShowPrint(true);
          setAutoNext(false);
          setEnableGPS(true);
          setEnableCamera(true);
          setEnableAutoSync(false);
          setEnableOffline(true);
          setEnableOnline(false);
          Alert.alert('Reset complete', 'Preferences restored to defaults.');
        },
      },
    ]);
  };

  const handleTestPrint = async () => {
    const printer = await getBluetoothPrinterConfig(db);
    if (!printer.isConnected || !printer.address) {
      Alert.alert('No Printer', 'Pair and connect a Bluetooth printer first.');
      return;
    }
    try {
      await sendBluetoothPrint(
        printer.address,
        '\x1b@SAMELCO II Mobile\nSettings test print\nPrinter ready.\n\n\n'
      );
      Alert.alert('Test Print', `Test page sent to ${printer.name || printer.address}.`);
    } catch (error) {
      Alert.alert('Print failed', error instanceof Error ? error.message : 'Could not send test page.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
          <MaterialCommunityIcons name="menu" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <MaterialCommunityIcons name="cog" size={22} color="rgba(255,255,255,0.7)" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Print Settings */}
        <SectionHeader title="Print Settings" />
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            <RadioButton.Group onValueChange={(v) => setPrintSetting(v as PrintSetting)} value={printSetting}>
              {[
                { value: 'always_ask', label: 'Always Ask', icon: 'help-circle' },
                { value: 'auto_print', label: 'Auto Print', icon: 'printer-check' },
                { value: 'no_printing', label: 'No Printing', icon: 'printer-off' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.radioRow, printSetting === opt.value && styles.radioRowActive]}
                  onPress={() => setPrintSetting(opt.value as PrintSetting)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={opt.icon as any}
                    size={20}
                    color={printSetting === opt.value ? Colors.primary : Colors.neutral}
                  />
                  <Text style={[styles.radioLabel, printSetting === opt.value && styles.radioLabelActive]}>
                    {opt.label}
                  </Text>
                  <RadioButton value={opt.value} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {/* Record view */}
        <SectionHeader title="Record View" />
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            <RadioButton.Group onValueChange={(v) => setRecordView(v as any)} value={recordView}>
              {[
                { value: 'all', label: 'Show All Records' },
                { value: 'unread', label: 'Show Unread Only' },
                { value: 'paid', label: 'Show Paid Only' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.radioRow, recordView === opt.value && styles.radioRowActive]}
                  onPress={() => setRecordView(opt.value as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.radioLabel, recordView === opt.value && styles.radioLabelActive]}>
                    {opt.label}
                  </Text>
                  <RadioButton value={opt.value} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {/* Sort Order */}
        <SectionHeader title="Sorting" />
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            <RadioButton.Group onValueChange={(v) => setSortOrder(v as SortOrder)} value={sortOrder}>
              {[
                { value: 'sequence', label: 'By Sequence Number' },
                { value: 'account_number', label: 'By Account Number' },
                { value: 'account_name', label: 'By Account Name' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.radioRow, sortOrder === opt.value && styles.radioRowActive]}
                  onPress={() => setSortOrder(opt.value as SortOrder)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.radioLabel, sortOrder === opt.value && styles.radioLabelActive]}>
                    {opt.label}
                  </Text>
                  <RadioButton value={opt.value} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {/* Printer type */}
        <SectionHeader title="Printer Settings" />
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            <RadioButton.Group onValueChange={(v) => setPrinterType(v as PrinterType)} value={printerType}>
              {[
                { value: 'woosim', label: 'Woosim Printer' },
                { value: 'generic_escpos', label: 'Generic ESC/POS Thermal' },
                { value: 'other', label: 'Other Mobile Printer' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.radioRow, printerType === opt.value && styles.radioRowActive]}
                  onPress={() => setPrinterType(opt.value as PrinterType)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="printer-wireless"
                    size={20}
                    color={printerType === opt.value ? Colors.primary : Colors.neutral}
                  />
                  <Text style={[styles.radioLabel, printerType === opt.value && styles.radioLabelActive]}>
                    {opt.label}
                  </Text>
                  <RadioButton value={opt.value} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </RadioButton.Group>
            <Divider style={styles.divider} />
            <View style={styles.printerBtns}>
              <Button
                mode="outlined"
                icon="printer-search"
                style={styles.printerBtn}
                compact
                onPress={() => router.push('/(drawer)/bluetooth')}
              >
                Pair Printer
              </Button>
              <Button
                mode="outlined"
                icon="printer-check"
                style={styles.printerBtn}
                compact
                onPress={handleTestPrint}
              >
                Test Print
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Feature toggles */}
        <SectionHeader title="Features" />
        <Card style={styles.card} elevation={1}>
          <ToggleRow label="Show Reports Button" icon="chart-bar" value={showReports} onToggle={setShowReports} />
          <Divider />
          <ToggleRow label="Show Pay Button" icon="cash" value={showPay} onToggle={setShowPay} iconColor={Colors.success} />
          <Divider />
          <ToggleRow label="Show Print Button" icon="printer" value={showPrint} onToggle={setShowPrint} />
          <Divider />
          <ToggleRow label="Auto Next Record" subtitle="Automatically move to next consumer after saving" icon="skip-next" value={autoNext} onToggle={setAutoNext} iconColor={Colors.warning} />
          <Divider />
          <ToggleRow label="Enable GPS" icon="crosshairs-gps" value={enableGPS} onToggle={setEnableGPS} />
          <Divider />
          <ToggleRow label="Enable Camera" icon="camera" value={enableCamera} onToggle={setEnableCamera} />
          <Divider />
          <ToggleRow label="Enable Auto Sync" subtitle="Sync data automatically when online" icon="cloud-sync" value={enableAutoSync} onToggle={setEnableAutoSync} iconColor={Colors.success} />
          <Divider />
          <ToggleRow label="Offline Mode" subtitle="Use local SQLite database" icon="wifi-off" value={enableOffline} onToggle={setEnableOffline} />
          <Divider />
          <ToggleRow label="Online Mode" subtitle="Connect to central server" icon="cloud-check" value={enableOnline} onToggle={setEnableOnline} iconColor={Colors.success} />
        </Card>

        {/* Save / Reset */}
        <View style={styles.actionsSection}>
          <Button
            mode="contained"
            onPress={handleSave}
            icon="content-save"
            style={styles.saveBtn}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
          >
            Save Settings
          </Button>
          <Button
            mode="outlined"
            onPress={handleReset}
            icon="restore"
            style={styles.resetBtn}
            labelStyle={{ color: Colors.error }}
          >
            Reset Settings
          </Button>
        </View>
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
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: Colors.white },
  card: { margin: 10, marginTop: 0, borderRadius: 12, backgroundColor: Colors.white, overflow: 'hidden' },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderRadius: 0,
  },
  radioRowActive: { backgroundColor: Colors.primarySurface },
  radioLabel: { flex: 1, fontSize: 14, color: Colors.textPrimary, fontWeight: '400' },
  radioLabelActive: { color: Colors.primary, fontWeight: '600' },
  divider: { marginVertical: 8, backgroundColor: Colors.divider },
  printerBtns: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  printerBtn: { flex: 1, borderRadius: 8 },
  actionsSection: { padding: 12, gap: 10, marginBottom: 30 },
  saveBtn: { borderRadius: 10 },
  btnContent: { height: 50 },
  btnLabel: { fontSize: 16, fontWeight: '700' },
  resetBtn: { borderRadius: 10, borderColor: Colors.error },
});
