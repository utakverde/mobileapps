import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@constants/colors';
import SectionHeader from '@components/common/SectionHeader';
import { getPaymentSummary, getPrintableInvoiceForReading } from '../../database/invoiceRepository';
import { listConsumers } from '../../database/consumerRepository';
import { countSmsOutbox, getSmsSettings, listSmsOutbox, saveSmsSettings } from '../../database/smsRepository';
import { openSmsComposer, queueDisconnectionSms, queuePaymentSms, queueReadingSms, sendPendingSmsViaGateway } from '../../services/smsService';

type BulkMode = 'reading' | 'payment' | 'disconnection';

export default function SmsScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const db = useSQLiteContext();
  const [mode, setMode] = useState<BulkMode>('reading');
  const [readingMode, setReadingMode] = useState('after_reading');
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    const settings = await getSmsSettings(db);
    setReadingMode(settings.readingMode);
    setPending(await countSmsOutbox(db, 'pending'));
    setFailed(await countSmsOutbox(db, 'failed'));
  }, [db]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const updateReadingMode = async (next: string) => {
    await saveSmsSettings(db, { readingMode: next, enabled: next !== 'disabled' });
    setReadingMode(next);
  };

  const queueBulk = async () => {
    setWorking(true);
    try {
      const options = { limit: 500, mode: mode === 'disconnection' ? 'disconnection' : 'reading' } as any;
      const consumers = await listConsumers(db, options);
      let queued = 0;
      let skipped = 0;
      for (const consumer of consumers) {
        if (mode === 'reading') {
          const invoice = await getPrintableInvoiceForReading(db, consumer.id, { mode: 'reading' });
          const result = invoice ? await queueReadingSms(db, invoice, consumer, await getSmsSettings(db)) : { queued: false };
          if (result.queued) queued += 1;
          else skipped += 1;
        } else if (mode === 'payment') {
          const summary = await getPaymentSummary(db, consumer.id, { mode: 'reading' });
          const result = summary.payment ? await queuePaymentSms(db, summary.payment, summary.readingRecord, await getSmsSettings(db)) : { queued: false };
          if (result.queued) queued += 1;
          else skipped += 1;
        } else {
          const result = await queueDisconnectionSms(db, consumer, consumer, await getSmsSettings(db));
          if (result.queued) queued += 1;
          else skipped += 1;
        }
      }
      await refresh();
      Alert.alert('Bulk SMS queued', `${queued} message(s) queued. ${skipped} skipped because the record had no valid mobile number or bill.`);
    } catch (error) {
      Alert.alert('Bulk SMS failed', error instanceof Error ? error.message : 'Could not queue bulk messages.');
    } finally {
      setWorking(false);
    }
  };

  const sendBulk = async () => {
    setWorking(true);
    try {
      const result = await sendPendingSmsViaGateway(db);
      await refresh();
      Alert.alert('Bulk SMS result', `${result.sent} sent, ${result.failed} remaining or failed.`);
    } catch (error) {
      Alert.alert('Gateway unavailable', error instanceof Error ? error.message : 'Could not send bulk SMS.');
    } finally {
      setWorking(false);
    }
  };

  const sendOneFromQueue = async (row: any) => {
    try {
      await openSmsComposer(row);
    } catch (error) {
      Alert.alert('SMS failed', error instanceof Error ? error.message : 'Could not open the SMS composer.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
          <MaterialCommunityIcons name="menu" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>SMS Center</Text>
          <Text style={styles.headerSub}>Offline queue with gateway-ready bulk sending</Text>
        </View>
        <MaterialCommunityIcons name="message-text" size={24} color={Colors.white} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card} elevation={2}>
          <Card.Content>
            <Text style={styles.cardTitle}>Reading SMS mode</Text>
            <Text style={styles.help}>After-reading opens the phone SMS composer after a successful save. Bulk queues all eligible records for gateway sending.</Text>
            <View style={styles.modeRow}>
              {[
                ['after_reading', 'After Reading'],
                ['bulk', 'Bulk'],
                ['disabled', 'Disabled'],
              ].map(([value, label]) => (
                <TouchableOpacity key={value} onPress={() => updateReadingMode(value).catch(() => {})} style={[styles.modeButton, readingMode === value && styles.modeButtonActive]}>
                  <Text style={[styles.modeText, readingMode === value && styles.modeTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card.Content>
        </Card>

        <SectionHeader title="Bulk Queue" />
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            <Text style={styles.cardTitle}>Message type</Text>
            <View style={styles.modeRow}>
              {(['reading', 'payment', 'disconnection'] as BulkMode[]).map((value) => (
                <TouchableOpacity key={value} onPress={() => setMode(value)} style={[styles.modeButton, mode === value && styles.modeButtonActive]}>
                  <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value[0].toUpperCase() + value.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button mode="contained" icon="playlist-plus" onPress={queueBulk} loading={working} disabled={working} style={styles.action}>
              Queue Eligible Records
            </Button>
            <Button mode="outlined" icon="cloud-upload" onPress={sendBulk} disabled={working || pending === 0} style={styles.action}>
              Send Pending Through Gateway
            </Button>
            <Text style={styles.queueText}>Pending: {pending}  |  Failed: {failed}</Text>
          </Card.Content>
        </Card>

        <SectionHeader title="Recent Queue" />
        <QueuePreview db={db} onSend={sendOneFromQueue} />
      </ScrollView>
    </View>
  );
}

function QueuePreview({ db, onSend }: { db: any; onSend: (row: any) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    listSmsOutbox(db, { limit: 12 }).then(setRows).catch(() => setRows([]));
  }, [db]);
  if (rows.length === 0) return <Text style={styles.empty}>No SMS messages queued yet.</Text>;
  return <Card style={styles.card} elevation={1}><Card.Content>{rows.map((row, index) => <View key={row.id}><View style={styles.queueRow}><View style={styles.queueInfo}><Text style={styles.queueRecipient}>{row.recipient}  ·  {row.event_type}</Text><Text style={styles.queueMessage} numberOfLines={2}>{row.message}</Text><Text style={styles.queueStatus}>{row.status}</Text></View>{row.status === 'pending' ? <Button compact onPress={() => onSend(row)}>Open</Button> : null}</View>{index < rows.length - 1 ? <Divider /> : null}</View>)}</Card.Content></Card>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primaryDark, flexDirection: 'row', alignItems: 'center', paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16, gap: 12 },
  menuBtn: { padding: 2 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  content: { padding: 10, paddingBottom: 30 },
  card: { marginBottom: 10, borderRadius: 12, backgroundColor: Colors.white },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: 6 },
  help: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  modeButton: { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12 },
  modeButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  modeTextActive: { color: Colors.white },
  action: { marginTop: 12, borderRadius: 8 },
  queueText: { textAlign: 'center', marginTop: 12, color: Colors.textSecondary, fontWeight: '700' },
  empty: { textAlign: 'center', color: Colors.textMuted, padding: 20 },
  queueRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  queueInfo: { flex: 1 },
  queueRecipient: { fontSize: 12, fontWeight: '800', color: Colors.textPrimary },
  queueMessage: { fontSize: 11, color: Colors.textSecondary, marginTop: 3 },
  queueStatus: { fontSize: 10, color: Colors.primary, marginTop: 3, textTransform: 'uppercase' },
});
