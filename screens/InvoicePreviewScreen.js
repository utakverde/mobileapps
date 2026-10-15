import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../src/constants/colors';
import {
  computeAndSaveInvoice,
  getPrintableInvoiceForReading,
  getReadingRecord,
  saveInvoice,
} from '../database/invoiceRepository';
import { getBluetoothPrinterConfig } from '../database/configRepository';
import { computeInvoice } from '../services/invoiceCalculator';
import { printInvoice } from '../services/printerService';
import { sendBluetoothPrint } from '../src/lib/bluetoothPrinter';
import { getActiveReadingMode } from '../src/lib/session';

function money(value) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Row({ label, value, strong, danger }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong, danger && styles.rowDanger]}>
        {value ?? '-'}
      </Text>
    </View>
  );
}

export default function InvoicePreviewScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const db = useSQLiteContext();
  const [invoice, setInvoice] = useState(null);
  const [readingRecord, setReadingRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadInvoice = useCallback(async () => {
    setLoading(true);
    try {
      const mode = getActiveReadingMode();
      const record = await getReadingRecord(db, id, { mode });
      setReadingRecord(record);
      if (!record) {
        setInvoice(null);
        return;
      }
      const saved = await getPrintableInvoiceForReading(db, id, { mode });
      setInvoice(saved || computeInvoice(record, record.present_reading ?? record.Reading_KWH ?? record.Reading_KWH_Prev));
    } catch (error) {
      Alert.alert('Invoice error', error instanceof Error ? error.message : 'Could not load invoice.');
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleSaveInvoice = async () => {
    if (!invoice || !readingRecord) return;
    try {
      const saved = await saveInvoice(db, readingRecord, invoice);
      setInvoice(saved);
      Alert.alert('Invoice saved', 'Invoice was saved locally and queued for sync.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save invoice.');
    }
  };

  const handleRecompute = async () => {
    if (!readingRecord) return;
    try {
      const present = invoice?.presentReading ?? readingRecord.present_reading ?? readingRecord.Reading_KWH;
      const saved = await computeAndSaveInvoice(db, id, present, { allowAdminOverride: true });
      setInvoice(saved);
      Alert.alert('Recomputed', 'Invoice was recomputed from the local reading table.');
    } catch (error) {
      Alert.alert('Recompute failed', error instanceof Error ? error.message : 'Could not recompute invoice.');
    }
  };

  const handlePrint = async () => {
    if (!invoice) return;
    const printer = await getBluetoothPrinterConfig(db);
    if (!printer.address) {
      Alert.alert('Print Invoice', 'No saved Bluetooth printer was found. Connect a printer from Bluetooth Printer first.');
      return;
    }

    try {
      const result = await printInvoice(invoice, {
        printerType: printer.printerType,
        printerName: printer.name,
        printerAddress: printer.address,
      });
      await sendBluetoothPrint(printer.address, result.transportPayload);
      Alert.alert('Print Invoice', `Invoice sent to ${printer.name || printer.address}.`);
    } catch (error) {
      Alert.alert('Print failed', error instanceof Error ? error.message : 'Could not send invoice to printer.');
    }
  };

  const p = invoice?.printableInvoice || {};

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoice Preview</Text>
        <TouchableOpacity onPress={handlePrint} style={styles.printBtn}>
          <MaterialCommunityIcons name="printer" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <Text style={styles.loading}>Loading invoice...</Text>
        ) : !invoice ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.emptyTitle}>No reading record found</Text>
              <Text style={styles.emptyText}>The selected account was not found in the local SQLite reading table.</Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            <Card style={styles.invoiceCard}>
              <Card.Content>
                <Text style={styles.coop}>SAMAR ELECTRIC COOPERATIVE II</Text>
                <Text style={styles.title}>BILLING INVOICE</Text>
                <Text style={styles.ref}>{p.referenceNumber}</Text>
                <Divider style={styles.divider} />
                <Row label="Account No." value={p.accountNumber} strong />
                <Row label="Consumer" value={p.consumerName} strong />
                <Row label="Address" value={p.address} />
                <Row label="Area / Book / Seq." value={`${p.area || '-'} / ${p.book || '-'} / ${p.sequence || '-'}`} />
                <Row label="Serial No." value={p.serialNumber} />
                <Row label="Bill Month" value={p.billMonth} />
                <Row label="Rate Code" value={p.rateCode} />
              </Card.Content>
            </Card>

            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.section}>Reading</Text>
                <Row label="Present" value={p.presentReading} />
                <Row label="Multiplier" value={p.multiplier} />
                <Row label="Computed kWh" value={p.computedKwh} strong />
                {p.importKwh != null && <Row label="Import kWh" value={p.importKwh} />}
                {p.exportKwh != null && <Row label="Export kWh" value={p.exportKwh} />}
                {p.netKwh != null && <Row label="Net kWh" value={p.netKwh} strong />}
              </Card.Content>
            </Card>

            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.section}>Charge Breakdown</Text>
                <Row label="Generation" value={money(p.generationSubtotal)} />
                <Row label="Transmission" value={money(p.transmissionSubtotal)} />
                <Row label="System Loss" value={money(p.systemLossSubtotal)} />
                <Row label="Distribution" value={money(p.distributionSubtotal)} />
                <Row label="Other/OCC" value={money(p.otherChargesTotal)} />
                {p.arrearsTotal ? <Row label="Previous Balance" value={money(p.arrearsTotal)} /> : null}
                {p.arrearsBreakdown ? <Row label="Arrears Detail" value={p.arrearsBreakdown} /> : null}
                <Row label="VAT" value={money(p.vatSubtotal)} />
                <Row label="Lifeline Discount" value={money(p.lifelineDiscount)} danger={p.lifelineDiscount < 0} />
                <Row label="Senior Discount" value={money(p.seniorDiscount)} danger={p.seniorDiscount < 0} />
                {p.netMeteringCredit ? <Row label="Net Metering Credit" value={money(p.netMeteringCredit)} danger /> : null}
                <Divider style={styles.divider} />
                <Row label="Total Amount Due" value={money(p.totalBill)} strong />
              </Card.Content>
            </Card>

            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.section}>Payment / Schedule</Text>
                <Row label="Due Date" value={p.dueDate} />
                <Row label="Disconnection" value={p.disconnectionDate} />
                <Row label="Meter Reader" value={p.meterReaderName || '-'} />
                <Row label="Paid Status" value={p.isPaid ? 'Paid' : 'Unpaid'} strong={p.isPaid} />
                {p.paidAt ? <Row label="Date Paid" value={p.paidAt} /> : null}
                <Row label="Official Receipt" value={p.officialReceiptNo || '-'} />
                <Row label="QR / Reference" value={p.referenceNumber} />
              </Card.Content>
            </Card>

            <View style={styles.actions}>
              <Button mode="contained" icon="content-save" onPress={handleSaveInvoice} style={styles.actionBtn}>
                Save Invoice
              </Button>
              <Button mode="outlined" icon="printer" onPress={handlePrint} style={styles.actionBtn}>
                Print Invoice
              </Button>
              <Button mode="outlined" icon="cash" onPress={() => router.push(`/(drawer)/payment/${id}`)} style={styles.actionBtn}>
                Payment
              </Button>
              <Button mode="outlined" icon="calculator" onPress={handleRecompute} style={styles.actionBtn}>
                Recompute
              </Button>
              <Button mode="text" icon="arrow-left" onPress={() => router.back()}>
                Back
              </Button>
            </View>
          </>
        )}
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
    paddingHorizontal: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, color: Colors.white, fontSize: 18, fontWeight: '800' },
  printBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 6 },
  content: { padding: 12, paddingBottom: 30 },
  loading: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
  invoiceCard: { backgroundColor: Colors.white, borderRadius: 12, marginBottom: 10, borderLeftWidth: 5, borderLeftColor: Colors.primary },
  card: { backgroundColor: Colors.white, borderRadius: 12, marginBottom: 10 },
  coop: { textAlign: 'center', fontSize: 13, fontWeight: '900', color: Colors.primaryDark },
  title: { textAlign: 'center', fontSize: 16, fontWeight: '900', color: Colors.textPrimary, marginTop: 4 },
  ref: { textAlign: 'center', fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  divider: { marginVertical: 10, backgroundColor: Colors.divider },
  section: { fontSize: 12, fontWeight: '900', color: Colors.primaryDark, marginBottom: 8, letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  rowLabel: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  rowValue: { flex: 1, fontSize: 12, color: Colors.textPrimary, textAlign: 'right', fontWeight: '600' },
  rowStrong: { fontSize: 14, fontWeight: '900', color: Colors.primary },
  rowDanger: { color: Colors.error },
  actions: { gap: 8, paddingTop: 4 },
  actionBtn: { borderRadius: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
});
