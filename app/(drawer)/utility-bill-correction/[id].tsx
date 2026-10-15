import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Button, Card, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@constants/colors';
import InfoRow from '@components/common/InfoRow';
import SectionHeader from '@components/common/SectionHeader';
import { getPrintableInvoiceForReading } from '../../../database/invoiceRepository';
import { getActiveReadingMode } from '@lib/session';
import { computeInvoice } from '../../../services/invoiceCalculator';

function peso(value: number) {
  return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function safeSqlValue(value: unknown) {
  if (value == null || value === '') return 'NULL';
  const text = String(value).replace(/'/g, "''");
  return `'${text}'`;
}

function buildCorrectionSql(params: {
  tableName: string;
  historyTable: string;
  readingRecord: any;
  original: any;
  corrected: any;
  correctedPresentReading: number;
  correctedBillMonth: string;
}) {
  const { tableName, historyTable, readingRecord, original, corrected, correctedPresentReading, correctedBillMonth } = params;
  const account = readingRecord.AccountNumber || original.accountNumber || '';
  const code = readingRecord.code || readingRecord.Code || original.code || '';
  const rowKey = code ? `Code = ${safeSqlValue(code)} AND BillMonth = ${safeSqlValue(correctedBillMonth)}` : `AccountNumber = ${safeSqlValue(account)} AND BillMonth = ${safeSqlValue(correctedBillMonth)}`;
  const updatedAt = new Date().toISOString();

  const previewSql = [
    `UPDATE ${tableName} SET`,
    `  present_reading = ${safeSqlValue(correctedPresentReading)},`,
    `  computed_kwh = ${safeSqlValue(corrected.computedKwh)},`,
    `  total_bill = ${safeSqlValue(corrected.totalBill)},`,
    `  lifeline_discount = ${safeSqlValue(corrected.lifelineDiscount)},`,
    `  senior_discount = ${safeSqlValue(corrected.seniorDiscount)},`,
    `  invoice_status = ${safeSqlValue('previewed')},`,
    `  is_synced = 0,`,
    `  updated_at = ${safeSqlValue(updatedAt)}`,
    `WHERE ${rowKey};`,
  ].join('\n');

  const rollbackSql = [
    `UPDATE ${tableName} SET`,
    `  present_reading = ${safeSqlValue(original.presentReading)},`,
    `  computed_kwh = ${safeSqlValue(original.computedKwh)},`,
    `  total_bill = ${safeSqlValue(original.totalBill)},`,
    `  lifeline_discount = ${safeSqlValue(original.lifelineDiscount)},`,
    `  senior_discount = ${safeSqlValue(original.seniorDiscount)},`,
    `  invoice_status = ${safeSqlValue(original.invoiceStatus || 'pending')},`,
    `  is_synced = 0,`,
    `  updated_at = ${safeSqlValue(updatedAt)}`,
    `WHERE ${rowKey};`,
  ].join('\n');

  const historyPreviewSql = [
    `UPDATE ${historyTable} SET`,
    `  PresentReadingKWH = ${safeSqlValue(correctedPresentReading)},`,
    `  PreviousReadingKWH = ${safeSqlValue(readingRecord.Reading_KWH_Prev ?? readingRecord.previous_reading ?? original.previousReading)},`,
    `  KilowattHour = ${safeSqlValue(corrected.computedKwh)},`,
    `  KilowattUsed = ${safeSqlValue(corrected.billableKwh)},`,
    `  TotalBill = ${safeSqlValue(corrected.totalBill)},`,
    `  LifelineDiscSubs = ${safeSqlValue(corrected.lifelineDiscount)},`,
    `  senior_citizen_disc = ${safeSqlValue(corrected.seniorDiscount)},`,
    `  EVAT = ${safeSqlValue(corrected.vatSubtotal)},`,
    `  is_synced = 0,`,
    `  updated_at = ${safeSqlValue(updatedAt)}`,
    `WHERE ${rowKey};`,
  ].join('\n');

  return { previewSql, rollbackSql, historyPreviewSql };
}

export default function UtilityBillCorrectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [invoice, setInvoice] = useState<any | null>(null);
  const [correctedReading, setCorrectedReading] = useState('');
  const [allowRollover, setAllowRollover] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');

  useEffect(() => {
    let alive = true;
    getPrintableInvoiceForReading(db, id, { mode: getActiveReadingMode() })
      .then((row) => {
        if (!alive) return;
        setInvoice(row);
        const reading = row?.printSources?.reading?.present_reading ?? row?.printSources?.reading?.Reading_KWH ?? row?.printableInvoice?.presentReading ?? '';
        setCorrectedReading(String(reading || ''));
      })
      .catch(() => {
        if (alive) setInvoice(null);
      });
    return () => {
      alive = false;
    };
  }, [db, id]);

  const readingRecord = invoice?.printSources?.reading || {};
  const printable = invoice?.printableInvoice || {};

  const originalInvoice = useMemo(
    () => ({
      previousReading: Number(printable.previousReading ?? readingRecord.Reading_KWH_Prev ?? 0),
      presentReading: Number(printable.presentReading ?? readingRecord.present_reading ?? 0),
      computedKwh: Number(printable.computedKwh ?? printable.computedKwh ?? printable.computedKWH ?? printable.computed_kwh ?? invoice?.computedKwh ?? 0),
      billableKwh: Number(printable.computedKwh ?? invoice?.billableKwh ?? invoice?.computedKwh ?? 0),
      totalBill: Number(printable.totalBill ?? invoice?.totalBill ?? 0),
      lifelineDiscount: Number(printable.lifelineDiscount ?? invoice?.lifelineDiscount ?? 0),
      seniorDiscount: Number(printable.seniorDiscount ?? invoice?.seniorDiscount ?? 0),
      vatSubtotal: Number(printable.vatSubtotal ?? invoice?.vatSubtotal ?? 0),
      invoiceStatus: String(readingRecord.invoice_status || 'pending'),
    }),
    [invoice, printable, readingRecord]
  );

  const correctedInvoice = useMemo(() => {
    const nextReading = Number(correctedReading);
    if (!Number.isFinite(nextReading)) return null;
    try {
      return computeInvoice(readingRecord, nextReading, { allowRollover });
    } catch {
      return null;
    }
  }, [allowRollover, correctedReading, readingRecord]);

  const sqlBundle = useMemo(() => {
    if (!correctedInvoice || !invoice?.printSources?.source) return null;
    const tableName = invoice.printSources.source === 'disconnection' ? 'billhistory_disco' : 'reading';
    const historyTable = invoice.printSources.source === 'disconnection' ? 'billhistory_disco' : 'billhistory';
    return buildCorrectionSql({
      tableName,
      historyTable,
      readingRecord,
      original: originalInvoice,
      corrected: correctedInvoice,
      correctedPresentReading: Number(correctedReading),
      correctedBillMonth: String(readingRecord.BillMonth || printable.billMonth || ''),
    });
  }, [correctedInvoice, correctedReading, invoice?.printSources?.source, originalInvoice, printable.billMonth, readingRecord]);

  const billDelta = correctedInvoice ? Number((correctedInvoice.totalBill - originalInvoice.totalBill).toFixed(2)) : 0;
  const kwhDelta = correctedInvoice ? Number((correctedInvoice.computedKwh - originalInvoice.computedKwh).toFixed(2)) : 0;

  if (!invoice) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bill Correction Preview</Text>
        </View>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="database-search" size={64} color={Colors.border} />
          <Text style={styles.emptyTitle}>No bill record found</Text>
          <Text style={styles.emptyText}>Open a saved bill first so the preview can reuse the live reading record.</Text>
        </View>
      </View>
    );
  }

  const canPreview = Number.isFinite(Number(correctedReading)) && Boolean(correctionReason.trim());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Bill Correction Preview</Text>
          <Text style={styles.headerSub}>
            {String(printable.accountNumber || readingRecord.AccountNumber || '')} · {String(printable.billMonth || readingRecord.BillMonth || '')}
          </Text>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/(drawer)/utility-bill-audit/${id}` as any)}>
          <MaterialCommunityIcons name="clipboard-text" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.card} elevation={2}>
          <Card.Content>
            <InfoRow label="Consumer" value={String(printable.consumerName || readingRecord.Name || '')} />
            <InfoRow label="Address" value={String(printable.address || readingRecord.Address || '')} />
            <InfoRow label="Previous Reading" value={String(originalInvoice.previousReading)} />
            <InfoRow label="Original Reading" value={String(originalInvoice.presentReading)} />
            <InfoRow label="Original kWh" value={String(originalInvoice.computedKwh)} />
            <InfoRow label="Original Bill" value={peso(originalInvoice.totalBill)} />
          </Card.Content>
        </Card>

        <SectionHeader title="Correction Inputs" />
        <Card style={styles.card} elevation={1}>
          <Card.Content style={styles.formCard}>
            <TextInput
              value={correctedReading}
              onChangeText={setCorrectedReading}
              placeholder="Corrected present reading"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />
            <TextInput
              value={correctionReason}
              onChangeText={setCorrectionReason}
              placeholder="Reason for correction"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.reasonInput]}
            />
            <TouchableOpacity style={styles.toggleRow} onPress={() => setAllowRollover((value) => !value)}>
              <MaterialCommunityIcons name={allowRollover ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={Colors.primaryDark} />
              <Text style={styles.toggleText}>Allow meter wrap-around in preview</Text>
            </TouchableOpacity>
            <Button mode="contained" icon="eye" disabled={!canPreview} style={styles.previewBtn}>
              Build Preview
            </Button>
          </Card.Content>
        </Card>

        <SectionHeader title="Corrected Preview" />
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            {correctedInvoice ? (
              <>
                <InfoRow label="Corrected Reading" value={String(correctedInvoice.presentReading)} />
                <InfoRow label="Corrected kWh" value={String(correctedInvoice.computedKwh)} />
                <InfoRow label="Corrected Bill" value={peso(correctedInvoice.totalBill)} />
                <InfoRow label="Bill Delta" value={peso(billDelta)} valueColor={billDelta >= 0 ? Colors.error : Colors.success} />
                <InfoRow label="kWh Delta" value={String(kwhDelta)} valueColor={kwhDelta >= 0 ? Colors.warning : Colors.success} />
                <InfoRow label="Lifeline Discount" value={peso(Number(correctedInvoice.lifelineDiscount || 0))} />
                <InfoRow label="Senior Discount" value={peso(Number(correctedInvoice.seniorDiscount || 0))} />
              </>
            ) : (
              <Text style={styles.emptyText}>Enter a valid corrected reading to compute the preview.</Text>
            )}
          </Card.Content>
        </Card>

        <SectionHeader title="Preview SQL" />
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            <Text style={styles.sqlLabel}>Preview SQL</Text>
            <Text selectable style={styles.sqlBlock}>
              {sqlBundle?.previewSql || '-- Enter a valid correction to generate preview SQL'}
            </Text>
            <Divider style={styles.sqlDivider} />
            <Text style={styles.sqlLabel}>Rollback SQL</Text>
            <Text selectable style={styles.sqlBlock}>
              {sqlBundle?.rollbackSql || '-- Rollback SQL will appear after a valid preview is generated'}
            </Text>
            <Divider style={styles.sqlDivider} />
            <Text style={styles.sqlLabel}>History Sync SQL</Text>
            <Text selectable style={styles.sqlBlock}>
              {sqlBundle?.historyPreviewSql || '-- History synchronization SQL will appear after a valid preview is generated'}
            </Text>
          </Card.Content>
        </Card>

        <SectionHeader title="Safety Notes" />
        <Card style={styles.card} elevation={1}>
          <Card.Content>
            <Text style={styles.noteText}>
              This screen is preview-only. It does not save changes, does not post adjustments, and does not run SQL.
              The next implementation step can wire an approval step that executes the preview after verification.
            </Text>
            <View style={styles.actionsRow}>
              <Button mode="outlined" icon="clipboard-check" onPress={() => router.push(`/(drawer)/utility-bill-audit/${id}` as any)} style={styles.secondaryBtn}>
                Back to Audit
              </Button>
              <Button mode="outlined" icon="cash" onPress={() => router.push(`/(drawer)/payment/${id}`)} style={styles.secondaryBtn}>
                Open Payment
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  backBtn: {
    padding: 4,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  headerSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 6,
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 28,
    gap: 10,
  },
  card: {
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  formCard: {
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  reasonInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  previewBtn: {
    borderRadius: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  sqlLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: Colors.primaryDark,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sqlBlock: {
    fontSize: 11,
    lineHeight: 17,
    color: Colors.textPrimary,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 10,
    padding: 10,
  },
  sqlDivider: {
    marginVertical: 10,
    backgroundColor: Colors.divider,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  secondaryBtn: {
    borderRadius: 10,
  },
});
