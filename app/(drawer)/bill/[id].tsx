import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@constants/colors';
import { getConsumerById } from '../../../database/consumerRepository';
import { getPrintableInvoiceForReading } from '../../../database/invoiceRepository';
import { getBluetoothPrinterConfig, getInvoicePrintSetup } from '../../../database/configRepository';
import { printInvoice } from '../../../services/printerService';
import { sendBluetoothPrint } from '@lib/bluetoothPrinter';
import { getActiveReadingMode } from '@lib/session';

export default function BillScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [consumer, setConsumer] = useState<any | null>(null);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [printSetup, setPrintSetup] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getConsumerById(db, id, { mode: getActiveReadingMode() }), getPrintableInvoiceForReading(db, id, { mode: getActiveReadingMode() })])
      .then(([consumerRow, invoiceRow]: any[]) => {
        if (!alive) return;
        setConsumer(consumerRow);
        setInvoice(invoiceRow);
      })
      .catch(() => {
        if (alive) {
          setConsumer(null);
          setInvoice(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [db, id]);

  useEffect(() => {
    getInvoicePrintSetup(db).then(setPrintSetup).catch(() => setPrintSetup(null));
  }, [db]);

  if (!consumer) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bill Preview</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <MaterialCommunityIcons name="database-search" size={64} color={Colors.border} />
          <Text style={{ color: Colors.textSecondary, marginTop: 12, textAlign: 'center' }}>
            No bill record was found in the active SQLite database.
          </Text>
        </View>
      </View>
    );
  }

  const printable = invoice?.printableInvoice || {};
  const presentReadingDate = printable.presentReadingDate || '';
  const generationSubtotal = Number(invoice?.generationSubtotal ?? consumer.billAmount * 0.52);
  const transmissionSubtotal = Number(invoice?.transmissionSubtotal ?? consumer.billAmount * 0.13);
  const distributionSubtotal = Number(invoice?.distributionSubtotal ?? consumer.billAmount * 0.18);
  const otherChargesTotal = Number(invoice?.otherChargesTotal ?? consumer.billAmount * 0.05);
  const ancillarySubtotal = Number(invoice?.ancillarySubtotal ?? 0);
  const vatSubtotal = Number(invoice?.vatSubtotal ?? consumer.billAmount * 0.12);
  const billAmount = Number(invoice?.totalBill ?? consumer.billAmount ?? 0);
  const amountDue = invoice
    ? billAmount + Number(printable.arrearsTotal || 0)
    : Number(consumer.totalDue || 0);

  const handlePrintBill = async () => {
    if (!invoice) {
      Alert.alert('Print Bill', 'No saved invoice was found for this reading.');
      return;
    }
    const printer = await getBluetoothPrinterConfig(db);
    const printSetup = await getInvoicePrintSetup(db);
    const result = await printInvoice(invoice, {
      printerType: printer.printerType,
      printerName: printer.name,
      printerAddress: printer.address,
      printSetup,
      tin: printSetup.tin,
    });
    if (!printer.isConnected || !printer.address) {
      Alert.alert('Print Bill', 'No saved Bluetooth printer was found in config.');
      return;
    }
    try {
      await sendBluetoothPrint(printer.address, result.transportPayload);
      Alert.alert('Print Bill', `Bill sent to ${printer.name || printer.address}.`);
    } catch (error) {
      Alert.alert('Print failed', error instanceof Error ? error.message : 'Could not send bill to printer.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bill Preview</Text>
        <TouchableOpacity
          onPress={handlePrintBill}
          style={styles.printBtn}
        >
          <MaterialCommunityIcons name="printer" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.billWrap}>
          <View style={styles.bill}>
            {/* Bill Header */}
            <View style={styles.billHeader}>
              <View style={styles.billLogoRow}>
                <MaterialCommunityIcons name="lightning-bolt-circle" size={40} color={Colors.primaryDark} />
                <View>
                  <Text style={styles.billCoopName}>SAMAR ELECTRIC COOPERATIVE II</Text>
                  <Text style={styles.billCoopSub}>SAMELCO II – Member of Philippine Rural Electric Cooperatives</Text>
                </View>
              </View>
              {!!printSetup?.tin && <Text style={styles.tinText}>VAT Reg. TIN {printSetup.tin}</Text>}
              <View style={styles.billTitleRow}>
                <Text style={styles.billTitle}>STATEMENT OF ACCOUNT</Text>
                <View style={styles.billMonthBadge}>
                  <Text style={styles.billMonthText}>{consumer.billMonth}</Text>
                </View>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* Consumer Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CONSUMER INFORMATION</Text>
              <View style={styles.consumerGrid}>
                <View style={styles.consumerCell}>
                  <Text style={styles.cellLabel}>Account Number</Text>
                  <Text style={styles.cellValue}>{consumer.accountNumber}</Text>
                </View>
                <View style={styles.consumerCell}>
                  <Text style={styles.cellLabel}>Meter Number</Text>
                  <Text style={styles.cellValue}>{consumer.meterNumber}</Text>
                </View>
                <View style={[styles.consumerCell, { width: '100%' }]}>
                  <Text style={styles.cellLabel}>Consumer Name</Text>
                  <Text style={styles.cellValue}>{consumer.name}</Text>
                </View>
                <View style={[styles.consumerCell, { width: '100%' }]}>
                  <Text style={styles.cellLabel}>Address</Text>
                  <Text style={styles.cellValue}>{consumer.address}</Text>
                </View>
                <View style={styles.consumerCell}>
                  <Text style={styles.cellLabel}>Rate Code</Text>
                  <Text style={styles.cellValue}>{consumer.rateCode}</Text>
                </View>
                <View style={styles.consumerCell}>
                  <Text style={styles.cellLabel}>Sequence No.</Text>
                  <Text style={styles.cellValue}>{consumer.sequenceNumber}</Text>
                </View>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* Reading Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>READING DETAILS</Text>
              <View style={styles.readingTable}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={styles.tableHeaderText}>DESCRIPTION</Text>
                  <Text style={styles.tableHeaderText}>DATE</Text>
                  <Text style={styles.tableHeaderText}>READING</Text>
                </View>
                <View style={styles.tableRow}>
                  <Text style={styles.tableCell}>Present</Text>
                  <Text style={styles.tableCell}>{presentReadingDate}</Text>
                  <Text style={styles.tableCell}>{consumer.currentReading ?? 'N/A'}</Text>
                </View>
                <View style={[styles.tableRow, styles.tableHighlight]}>
                  <Text style={[styles.tableCell, { fontWeight: '700' }]}>kWh Used</Text>
                  <Text style={styles.tableCell}>×{consumer.multiplier}</Text>
                  <Text style={[styles.tableCell, { fontWeight: '800', color: Colors.primary }]}>
                    {consumer.kwhUsed ?? 'N/A'} kWh
                  </Text>
                </View>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* Charges */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>CHARGES</Text>
              <View style={styles.chargesTable}>
                {[
                  { label: 'Generation Charge', value: generationSubtotal },
                  { label: 'Transmission Charge', value: transmissionSubtotal },
                   { label: 'Distribution Charge', value: distributionSubtotal },
                  { label: 'Ancillary Charge', value: ancillarySubtotal },
                   { label: 'Other Charges', value: otherChargesTotal },
                  { label: 'VAT', value: vatSubtotal },
                ].map((charge) => (
                  <View key={charge.label} style={styles.chargeRow}>
                    <Text style={styles.chargeLabel}>{charge.label}</Text>
                    <Text style={styles.chargeValue}>₱{charge.value.toFixed(2)}</Text>
                  </View>
                ))}
                <Divider style={styles.innerDivider} />
                <View style={[styles.chargeRow, styles.chargeTotal]}>
                  <Text style={styles.chargeTotalLabel}>TOTAL BILL</Text>
                  <Text style={styles.chargeTotalValue}>
                    ₱{billAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                {consumer.penalty > 0 && (
                  <View style={[styles.chargeRow, { backgroundColor: Colors.errorLight }]}>
                    <Text style={[styles.chargeLabel, { color: Colors.error }]}>Penalty</Text>
                    <Text style={[styles.chargeValue, { color: Colors.error }]}>
                      ₱{consumer.penalty.toFixed(2)}
                    </Text>
                  </View>
                )}
                <View style={[styles.chargeRow, styles.chargeGrandTotal]}>
                  <Text style={styles.chargeGrandLabel}>AMOUNT DUE</Text>
                  <Text style={styles.chargeGrandValue}>
                    ₱{amountDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* Due dates */}
            <View style={styles.dueDatesRow}>
              <View style={styles.dueItem}>
                <Text style={styles.dueLabel}>DUE DATE</Text>
                <Text style={styles.dueValue}>{consumer.dueDate}</Text>
              </View>
              <View style={[styles.dueItem, { borderLeftWidth: 1, borderLeftColor: Colors.border }]}>
                <Text style={[styles.dueLabel, { color: Colors.error }]}>DISCONNECTION DATE</Text>
                <Text style={[styles.dueValue, { color: Colors.error }]}>{consumer.disconnectionDate}</Text>
              </View>
            </View>

            {/* QR */}
            <View style={styles.qrSection}>
              <MaterialCommunityIcons name="qrcode" size={70} color={Colors.textPrimary} />
              <Text style={styles.qrLabel}>{consumer.accountNumber}</Text>
            </View>

            <Text style={styles.billFooter}>
              To avoid disconnection, please pay on or before the due date.{'\n'}
              For inquiries: (077) 771-1234 or inec@example.com
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            icon="printer"
            onPress={handlePrintBill}
            style={styles.printActionBtn}
            contentStyle={styles.printActionContent}
          >
            Print Bill
          </Button>
          <Button
            mode="outlined"
            icon="cash"
            onPress={() => router.push(`/(drawer)/payment/${consumer.id}`)}
            style={styles.payBtn}
          >
            Collect Payment
          </Button>
        </View>
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
    paddingHorizontal: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.white },
  printBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 6 },
  scrollContent: { padding: 12, paddingBottom: 30 },
  billWrap: { alignItems: 'center' },
  bill: {
    backgroundColor: Colors.white,
    width: '100%',
    borderRadius: 8,
    padding: 16,
    elevation: 3,
  },
  billHeader: { gap: 8, marginBottom: 4 },
  billLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  billCoopName: { fontSize: 11, fontWeight: '800', color: Colors.primaryDark, flex: 1 },
  billCoopSub: { fontSize: 9, color: Colors.textMuted },
  tinText: { fontSize: 9, color: Colors.textSecondary, marginTop: 2 },
  billTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  billTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 0.8 },
  billMonthBadge: { backgroundColor: Colors.primarySurface, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  billMonthText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  divider: { marginVertical: 10, backgroundColor: Colors.divider },
  section: { marginBottom: 4 },
  sectionTitle: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: Colors.textMuted, marginBottom: 8 },
  consumerGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  consumerCell: { width: '50%', paddingHorizontal: 4, marginBottom: 8 },
  cellLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600' },
  cellValue: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  readingTable: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  tableRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 7 },
  tableHeader: { backgroundColor: Colors.primaryDark },
  tableHeaderText: { flex: 1, fontSize: 9, fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },
  tableCell: { flex: 1, fontSize: 11, color: Colors.textPrimary },
  tableHighlight: { backgroundColor: Colors.primarySurface },
  chargesTable: { gap: 4 },
  chargeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 4 },
  chargeLabel: { fontSize: 11, color: Colors.textSecondary },
  chargeValue: { fontSize: 11, color: Colors.textPrimary, fontWeight: '600' },
  innerDivider: { backgroundColor: Colors.divider },
  chargeTotal: { backgroundColor: Colors.primarySurface, borderRadius: 6, paddingHorizontal: 8 },
  chargeTotalLabel: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  chargeTotalValue: { fontSize: 14, fontWeight: '900', color: Colors.primary },
  chargeGrandTotal: { backgroundColor: Colors.primaryDark, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 8 },
  chargeGrandLabel: { fontSize: 13, fontWeight: '800', color: Colors.white },
  chargeGrandValue: { fontSize: 16, fontWeight: '900', color: Colors.white },
  dueDatesRow: { flexDirection: 'row' },
  dueItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  dueLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: Colors.primary },
  dueValue: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  qrSection: { alignItems: 'center', paddingVertical: 10 },
  qrLabel: { fontSize: 10, color: Colors.textMuted, letterSpacing: 1, marginTop: 4 },
  billFooter: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', lineHeight: 14, marginTop: 8 },
  actions: { marginTop: 16, gap: 10 },
  printActionBtn: { borderRadius: 10 },
  printActionContent: { height: 50 },
  payBtn: { borderRadius: 10 },
});
