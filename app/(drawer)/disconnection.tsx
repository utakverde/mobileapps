import React, { useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Card, Divider, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { Colors } from '@constants/colors';
import type { Consumer } from '@constants/types';
import { getDisconnectionCandidates, markConsumerDisconnected } from '../../database/consumerRepository';
import { getBluetoothPrinterConfig } from '../../database/configRepository';
import { getPrintableInvoiceForReading } from '../../database/invoiceRepository';
import StatusBadge from '@components/common/StatusBadge';
import { getActiveReadingMode } from '@lib/session';
import { createDisconnectionNoticePrintText, createPrinterPayload } from '../../services/printerService';
import { sendBluetoothPrint } from '@lib/bluetoothPrinter';
import { getReportSummary } from '../../database/consumerRepository';
import { getSmsSettings } from '../../database/smsRepository';
import { openSmsComposer, queueDisconnectionSms } from '../../services/smsService';

export default function DisconnectionScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const router = useRouter();
  const db = useSQLiteContext();
  const isDisconnectionMode = getActiveReadingMode() === 'disconnection';
  const [disconnectList, setDisconnectList] = useState<Consumer[]>([]);
  const [summary, setSummary] = useState<any | null>(null);

  const printNotice = async (item: Consumer) => {
    try {
      const printer = await getBluetoothPrinterConfig(db);
      if (!printer.address) {
        Alert.alert('Disconnection Notice', 'Connect a Bluetooth printer first.');
        return;
      }
      const invoice = await getPrintableInvoiceForReading(db, item.id, { mode: 'disconnection' });
      if (!invoice) {
        Alert.alert('Disconnection Notice', 'No disconnection bill was found for this account.');
        return;
      }
      const text = createDisconnectionNoticePrintText(invoice);
      await sendBluetoothPrint(printer.address, createPrinterPayload(text, { printerType: printer.printerType }));
      Alert.alert('Disconnection Notice', `Notice sent to ${printer.name || printer.address}.`);
    } catch (error) {
      Alert.alert('Print failed', error instanceof Error ? error.message : 'Could not print disconnection notice.');
    }
  };

  const markDisconnected = async (item: Consumer) => {
    try {
      await markConsumerDisconnected(db, item.id);
      setDisconnectList((rows) => rows.map((row) => (row.id === item.id ? { ...row, status: 'disconnected' } : row)));
      Alert.alert('Recorded', 'Disconnection recorded locally. Sync when online to update billing.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not record disconnection.');
    }
  };

  const sendDisconnectionSms = async (item: Consumer) => {
    try {
      const settings = await getSmsSettings(db);
      if (!settings.enabled) {
        Alert.alert('SMS disabled', 'Enable SMS in the SMS Center before sending notices.');
        return;
      }
      const sms = await queueDisconnectionSms(db, item, item, settings);
      if (!sms.queued) {
        Alert.alert('SMS unavailable', 'No valid mobile number was found for this consumer.');
        return;
      }
      await openSmsComposer(sms.row);
    } catch (error) {
      Alert.alert('SMS failed', error instanceof Error ? error.message : 'Could not prepare the notice.');
    }
  };

  useEffect(() => {
    let alive = true;
    if (!isDisconnectionMode) {
      Alert.alert('Reading mode', 'Disconnection is only available when you log in using Disconnection mode.');
      router.replace('/(drawer)/dashboard');
      return () => {
        alive = false;
      };
    }
    getReportSummary(db, { mode: 'disconnection' })
      .then((report) => {
        if (alive) setSummary(report);
      })
      .catch(() => {
        if (alive) setSummary(null);
      });
    getDisconnectionCandidates(db)
      .then((rows: Consumer[]) => {
        if (alive) setDisconnectList(rows);
      })
      .catch(() => {
        if (alive) setDisconnectList([]);
      });
    return () => {
      alive = false;
    };
  }, [db, isDisconnectionMode, router]);

  if (!isDisconnectionMode) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
          <MaterialCommunityIcons name="menu" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Disconnection Mode</Text>
          <Text style={styles.headerSub}>{disconnectList.length} consumers pending</Text>
        </View>
        <MaterialCommunityIcons name="flash-off" size={22} color="rgba(255,255,255,0.7)" />
      </View>

      {/* Warning banner */}
      <View style={styles.warningBanner}>
        <MaterialCommunityIcons name="alert" size={18} color={Colors.error} />
        <Text style={styles.warningText}>
          Disconnection Mode Active — Only disconnect accounts listed below
        </Text>
      </View>

      <View style={styles.summaryStrip}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{disconnectList.length}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{disconnectList.filter((item) => item.status === 'disconnected').length}</Text>
          <Text style={styles.summaryLabel}>Disconnected</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{disconnectList.filter((item) => item.status === 'paid').length}</Text>
          <Text style={styles.summaryLabel}>Paid</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>
            {
              disconnectList.filter(
                (item) => item.status === 'paid' && Boolean(item.disconnectionDate || item.remarks || (item as any).app_disconnected_at)
              ).length
            }
          </Text>
          <Text style={styles.summaryLabel}>Reconn. Proxy</Text>
        </View>
      </View>

      <View style={styles.noteBanner}>
        <MaterialCommunityIcons name="calendar-clock" size={16} color={Colors.primaryDark} />
        <Text style={styles.noteText}>
          Monthly totals: {summary?.stats?.disconnectedRecords || 0} disconnected, {summary?.stats?.paidRecords || 0} paid, {summary?.stats?.totalCollectionMonth ? 'collection data available' : 'no collection data yet'}.
        </Text>
      </View>

      <FlatList
        data={disconnectList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card style={styles.card} elevation={2}>
            <Card.Content style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <View style={styles.seqBadge}>
                  <Text style={styles.seqText}>{item.sequenceNumber}</Text>
                </View>
                <View style={styles.consumerInfo}>
                  <Text style={styles.accountNo}>{item.accountNumber}</Text>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
                </View>
                <StatusBadge status={item.status} size="small" />
              </View>
              <Divider style={styles.divider} />
              <View style={styles.billGrid}>
                <View style={styles.billItem}>
                  <Text style={styles.billLabel}>BILL MONTH</Text>
                  <Text style={styles.billValue}>{item.billMonth}</Text>
                </View>
                <View style={styles.billItem}>
                  <Text style={styles.billLabel}>TOTAL BALANCE</Text>
                  <Text style={[styles.billValue, styles.billAmount]}>
                    ₱{item.totalDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <View style={styles.billItem}>
                  <Text style={styles.billLabel}>DUE DATE</Text>
                  <Text style={[styles.billValue, { color: Colors.error }]}>{item.dueDate}</Text>
                </View>
                <View style={styles.billItem}>
                  <Text style={styles.billLabel}>DISCONN. DATE</Text>
                  <Text style={[styles.billValue, { color: Colors.error, fontWeight: '700' }]}>{item.disconnectionDate}</Text>
                </View>
              </View>
              {item.remarks ? (
                <View style={styles.remarksWrap}>
                  <MaterialCommunityIcons name="note-text" size={12} color={Colors.textMuted} />
                  <Text style={styles.remarksText}> {item.remarks}</Text>
                </View>
              ) : null}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.disconnectBtn]}
                  onPress={() =>
                    Alert.alert('Mark Disconnected', `Confirm disconnection for ${item.name}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Confirm',
                        style: 'destructive',
                        onPress: () => markDisconnected(item),
                      },
                    ])
                  }
                >
                  <MaterialCommunityIcons name="flash-off" size={14} color={Colors.white} />
                  <Text style={styles.actionBtnText}>Disconnect</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.paidBtn]}
                  onPress={() => router.push(`/(drawer)/payment/${item.id}`)}
                >
                  <MaterialCommunityIcons name="cash" size={14} color={Colors.white} />
                  <Text style={styles.actionBtnText}>Mark Paid</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.noticeBtn]}
                  onPress={() => printNotice(item)}
                >
                  <MaterialCommunityIcons name="printer" size={14} color={Colors.primary} />
                  <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Notice</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.noticeBtn]}
                  onPress={() => sendDisconnectionSms(item)}
                >
                  <MaterialCommunityIcons name="message-text" size={14} color={Colors.primary} />
                  <Text style={[styles.actionBtnText, { color: Colors.primary }]}>SMS</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.mapBtn]}
                  onPress={() => router.push(`/(drawer)/map/${item.id}`)}
                >
                  <MaterialCommunityIcons name="map-marker" size={14} color={Colors.warning} />
                  <Text style={[styles.actionBtnText, { color: Colors.warning }]}>Map</Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="check-circle" size={64} color={Colors.success} />
            <Text style={styles.emptyText}>No pending disconnections</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.error,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuBtn: { padding: 2 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: Colors.error,
  },
  warningText: { flex: 1, fontSize: 12, color: Colors.error, fontWeight: '600' },
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  summaryCard: {
    flexBasis: '23%',
    minWidth: 80,
    borderRadius: 12,
    backgroundColor: Colors.white,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.1)',
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.error,
  },
  summaryLabel: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  noteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primarySurface,
    marginHorizontal: 10,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  listContent: { padding: 10, paddingBottom: 30 },
  card: { marginBottom: 10, borderRadius: 12, backgroundColor: Colors.white, borderLeftWidth: 5, borderLeftColor: Colors.error },
  cardContent: { paddingHorizontal: 12, paddingVertical: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  seqBadge: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.errorLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  seqText: { fontSize: 12, fontWeight: '800', color: Colors.error },
  consumerInfo: { flex: 1, marginRight: 8 },
  accountNo: { fontSize: 10, color: Colors.textMuted, letterSpacing: 0.5 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  address: { fontSize: 12, color: Colors.textSecondary },
  divider: { marginVertical: 8, backgroundColor: Colors.divider },
  billGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  billItem: { width: '50%', paddingHorizontal: 4, paddingVertical: 3 },
  billLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: Colors.textMuted },
  billValue: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  billAmount: { color: Colors.error, fontWeight: '800', fontSize: 15 },
  remarksWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.warningLight, borderRadius: 6, padding: 6, marginTop: 6 },
  remarksText: { fontSize: 11, color: Colors.warning, flex: 1 },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 8, gap: 4,
  },
  actionBtnText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  disconnectBtn: { backgroundColor: Colors.error },
  paidBtn: { backgroundColor: Colors.success },
  noticeBtn: { backgroundColor: Colors.primarySurface, borderWidth: 1, borderColor: Colors.primary },
  mapBtn: { backgroundColor: Colors.warningLight, borderWidth: 1, borderColor: Colors.warning },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, color: Colors.textMuted },
});
