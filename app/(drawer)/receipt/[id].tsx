import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@constants/colors';
import { getPaymentSummary, getPrintableInvoiceForReading } from '../../../database/invoiceRepository';
import { getReadingAssignment } from '../../../database/consumerRepository';
import { getBluetoothPrinterConfig, getInvoicePrintSetup } from '../../../database/configRepository';
import { getActiveCollectorName } from '@lib/session';
import { createPrinterPayload, createProvisionalReceiptPrintText } from '../../../services/printerService';
import { sendBluetoothPrint } from '@lib/bluetoothPrinter';
import { getActiveReadingMode } from '@lib/session';

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<any | null>(null);
  const [collectorName, setCollectorName] = useState(getActiveCollectorName() || 'Field Reader');
  const [printSetup, setPrintSetup] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getPaymentSummary(db, id, { mode: getActiveReadingMode() }), getReadingAssignment(db, { mode: getActiveReadingMode() })])
      .then(([paymentSummary, assignment]: any[]) => {
        if (!alive) return;
        setSummary(paymentSummary);
        setCollectorName(getActiveCollectorName() || assignment.readerName || 'Field Reader');
      })
      .catch(() => {
        if (alive) setSummary(null);
      });
    return () => {
      alive = false;
    };
  }, [db, id]);

  useEffect(() => {
    getInvoicePrintSetup(db).then(setPrintSetup).catch(() => setPrintSetup(null));
  }, [db]);

  const record = summary?.readingRecord || {};
  const payment = summary?.payment || null;
  const consumer = {
    id,
    accountNumber: String(record.AccountNumber ?? ''),
    name: String(record.Name ?? ''),
    billMonth: String(record.BillMonth ?? ''),
    meterNumber: String(record.Serial ?? ''),
    currentReading: record.present_reading ?? record.Reading_KWH ?? payment?.PresentReadingKWH ?? null,
    kwhUsed: record.computed_kwh ?? payment?.KilowattHour ?? null,
    dueDate: String(record.Sched_DueDate ?? ''),
  };

  const handlePrintReceipt = async (label = 'Printing') => {
    if (!payment) return;
    const printer = await getBluetoothPrinterConfig(db);
    const savedPrintSetup = await getInvoicePrintSetup(db);
    const invoice = await getPrintableInvoiceForReading(db, id, { mode: getActiveReadingMode() });
    if (!invoice) {
      Alert.alert(label, 'No saved bill was found for this account.');
      return;
    }
    const text = createProvisionalReceiptPrintText(
      invoice,
      {
        accountNumber: consumer.accountNumber,
        name: consumer.name,
        billMonth: consumer.billMonth,
        meterNumber: consumer.meterNumber,
        presentReading: consumer.currentReading,
        kwhUsed: consumer.kwhUsed,
        dueDate: consumer.dueDate,
        datePaid: payment.date_paid || payment.paymentDate,
        collectorName,
        orNumber: payment.ornumber || payment.orNumber || '',
        billAmount: summary?.billAmount ?? payment.billAmount ?? payment.TotalBill ?? 0,
        arrearsTotal: summary?.arrearsTotal ?? payment.penalty ?? 0,
        amountDue: summary?.totalDue ?? payment.TotalBill ?? payment.totalDue ?? 0,
        amountPaid: payment.amt_tendered ?? payment.amountPaid ?? payment.TotalBill ?? 0,
        change: payment.amt_change ?? payment.change ?? 0,
        paymentMethod: payment.paymentMethod || 'cash',
        arrears: summary?.arrears || [],
      },
      { collectorName, printSetup: savedPrintSetup, tin: savedPrintSetup.tin }
    );
    const payload = createPrinterPayload(text, { printerType: printer.printerType });
    if (!printer.isConnected || !printer.address) {
      Alert.alert(label, 'No saved Bluetooth printer was found in config.');
      return;
    }
    try {
      await sendBluetoothPrint(printer.address, payload);
      Alert.alert(label, `Receipt sent to ${printer.name || printer.address}.`);
    } catch (error) {
      Alert.alert('Print failed', error instanceof Error ? error.message : 'Could not send receipt to printer.');
    }
  };

  if (!payment) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receipt Preview</Text>
        </View>

        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="receipt" size={64} color={Colors.border} />
          <Text style={styles.emptyTitle}>No payment found</Text>
          <Text style={styles.emptyText}>
            Collect or sync a payment for {consumer.accountNumber} before printing a receipt.
          </Text>
          <Button
            mode="contained"
            icon="cash"
            onPress={() => router.replace(`/(drawer)/payment/${id}`)}
            style={styles.emptyAction}
          >
            Collect Payment
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Receipt Preview</Text>
        <TouchableOpacity onPress={() => handlePrintReceipt('Printing')} style={styles.printBtn}>
          <MaterialCommunityIcons name="printer" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Receipt paper */}
        <View style={styles.receiptWrap}>
          <View style={styles.receipt}>
            {/* Header */}
            <View style={styles.receiptHeader}>
              <MaterialCommunityIcons name="lightning-bolt-circle" size={36} color={Colors.primaryDark} />
              <Text style={styles.coopName}>SAMAR ELECTRIC COOPERATIVE II</Text>
              <Text style={styles.coopAddr}>Allen-Catbalogan District, Samar</Text>
              <Text style={styles.coopAddr}>Tel: (055) 251-8301{printSetup?.tin ? `  •  VAT Reg. TIN: ${printSetup.tin}` : ''}</Text>
            </View>

            <View style={styles.receiptDivider} />
            <Text style={styles.receiptTitle}>OFFICIAL RECEIPT</Text>
            <View style={styles.receiptDivider} />

            {/* OR Info */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>OR Number:</Text>
              <Text style={styles.rowValue}>{payment.ornumber || payment.orNumber || ''}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Date:</Text>
              <Text style={styles.rowValue}>{payment.date_paid || payment.paymentDate || ''}</Text>
            </View>

            <View style={styles.receiptDivider} />

            {/* Consumer */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Account No.:</Text>
              <Text style={styles.rowValue}>{consumer.accountNumber}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Consumer:</Text>
              <Text style={styles.rowValue}>{consumer.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Bill Month:</Text>
              <Text style={styles.rowValue}>{consumer.billMonth}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Meter No.:</Text>
              <Text style={styles.rowValue}>{consumer.meterNumber}</Text>
            </View>

            <View style={styles.receiptDivider} />

            {/* Reading */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Pres. Reading:</Text>
              <Text style={styles.rowValue}>{consumer.currentReading ?? 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>kWh Used:</Text>
              <Text style={styles.rowValue}>{consumer.kwhUsed ?? 'N/A'} kWh</Text>
            </View>

            <View style={styles.receiptDivider} />

            {/* Amounts */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Bill Amount:</Text>
              <Text style={styles.rowValue}>₱{Number(summary?.billAmount ?? payment.TotalBill ?? payment.billAmount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Penalty:</Text>
              <Text style={styles.rowValue}>₱{Number(summary?.arrearsTotal ?? payment.penalty ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>AMOUNT DUE:</Text>
              <Text style={styles.totalValue}>₱{Number(summary?.totalDue ?? payment.TotalBill ?? payment.totalDue ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={[styles.row, styles.paidRow]}>
              <Text style={styles.paidLabel}>AMOUNT PAID:</Text>
              <Text style={styles.paidValue}>₱{Number(payment.amt_tendered ?? payment.amountPaid ?? payment.TotalBill ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Change:</Text>
              <Text style={[styles.rowValue, { color: Colors.success }]}>₱{Number(payment.amt_change ?? payment.change ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Method:</Text>
              <Text style={styles.rowValue}>{String(payment.paymentMethod || 'cash').toUpperCase()}</Text>
            </View>

            <View style={styles.receiptDivider} />

            {/* Collector */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Collector:</Text>
              <Text style={styles.rowValue}>{collectorName}</Text>
            </View>

            <View style={styles.receiptDivider} />

            {/* QR placeholder */}
            <View style={styles.qrPlaceholder}>
              <MaterialCommunityIcons name="qrcode" size={80} color={Colors.textPrimary} />
              <Text style={styles.qrText}>{payment.ornumber || payment.orNumber || ''}</Text>
            </View>

            <View style={styles.receiptDivider} />
            <Text style={styles.footer}>Thank you for your payment!</Text>
            <Text style={styles.footer}>Due Date: {consumer.dueDate}</Text>
            <Text style={styles.footerSmall}>This is a computer-generated receipt.</Text>

            {/* Perforated edge */}
            <View style={styles.perforated}>
              {Array.from({ length: 30 }).map((_, i) => (
                <View key={i} style={styles.perfDot} />
              ))}
            </View>
          </View>
        </View>

        {/* Print actions */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="printer"
            onPress={() => handlePrintReceipt('Printing')}
            style={styles.printActionBtn}
            contentStyle={styles.printActionContent}
          >
            Print Receipt
          </Button>
          <Button
            mode="outlined"
            icon="printer-pos-refresh"
            onPress={() => handlePrintReceipt('Reprinting')}
            style={styles.reprintBtn}
          >
            Reprint
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
    paddingHorizontal: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.white },
  printBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 6,
  },
  scrollContent: { padding: 16, paddingBottom: 30 },
  receiptWrap: { alignItems: 'center' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyAction: { marginTop: 8, borderRadius: 10 },
  receipt: {
    backgroundColor: Colors.white,
    width: '90%',
    maxWidth: 320,
    borderRadius: 4,
    padding: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  receiptHeader: { alignItems: 'center', gap: 3, marginBottom: 6 },
  coopName: { fontSize: 11, fontWeight: '800', textAlign: 'center', color: Colors.textPrimary, letterSpacing: 0.3 },
  coopAddr: { fontSize: 9, color: Colors.textMuted, textAlign: 'center' },
  receiptDivider: {
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    marginVertical: 8,
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    color: Colors.textPrimary,
    letterSpacing: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 },
  rowLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
  rowValue: { fontSize: 10, color: Colors.textPrimary, fontWeight: '700', textAlign: 'right', flex: 1, marginLeft: 8 },
  totalRow: { backgroundColor: Colors.primarySurface, padding: 6, borderRadius: 4, marginVertical: 4 },
  totalLabel: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  totalValue: { fontSize: 12, fontWeight: '900', color: Colors.primary },
  paidRow: { backgroundColor: Colors.successLight, padding: 6, borderRadius: 4, marginVertical: 4 },
  paidLabel: { fontSize: 11, fontWeight: '800', color: Colors.success },
  paidValue: { fontSize: 12, fontWeight: '900', color: Colors.success },
  qrPlaceholder: { alignItems: 'center', paddingVertical: 8 },
  qrText: { fontSize: 9, color: Colors.textMuted, marginTop: 4, letterSpacing: 1 },
  footer: { fontSize: 10, textAlign: 'center', color: Colors.textPrimary, fontWeight: '600', marginVertical: 1 },
  footerSmall: { fontSize: 8, textAlign: 'center', color: Colors.textMuted, marginTop: 4 },
  perforated: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  perfDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.background, margin: 1 },
  actions: { marginTop: 20, gap: 10 },
  printActionBtn: { borderRadius: 10 },
  printActionContent: { height: 50 },
  reprintBtn: { borderRadius: 10 },
});
