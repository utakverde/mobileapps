import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@constants/colors';
import InfoRow from '@components/common/InfoRow';
import SectionHeader from '@components/common/SectionHeader';
import { getConsumerById } from '../../../database/consumerRepository';
import { getPrintableInvoiceForReading, getPaymentSummary } from '../../../database/invoiceRepository';
import { getActiveReadingMode } from '@lib/session';

function peso(value: number) {
  return `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function buildAuditNotes(consumer: any, invoice: any, paymentSummary: any) {
  const notes: { key: string; label: string; detail: string; tone: 'good' | 'warn' | 'bad' }[] = [];
  const billAmount = Number(consumer?.billAmount || 0);
  const totalDue = Number(consumer?.totalDue || 0);
  const kwhUsed = Number(consumer?.kwhUsed ?? invoice?.printableInvoice?.kwhUsed ?? 0);
  const multiplier = Number(consumer?.multiplier || 1);
  const presentReading = Number(consumer?.currentReading ?? invoice?.printableInvoice?.presentReading ?? 0);
  const previousReading = Number(consumer?.previousReading ?? invoice?.printableInvoice?.previousReading ?? 0);
  const computedDelta = Number.isFinite(presentReading) && Number.isFinite(previousReading) ? presentReading - previousReading : 0;

  if (paymentSummary?.isPaid) {
    notes.push({
      key: 'paid',
      label: 'Already collected',
      detail: 'The bill is already paid, so correction should preserve the receipt trail and reverse only by approved adjustment.',
      tone: 'good',
    });
  }
  if (Number.isFinite(computedDelta) && computedDelta < 0) {
    notes.push({
      key: 'negative-delta',
      label: 'Reading wrap-around or correction needed',
      detail: 'Present reading is below previous reading. Confirm wrap-around handling before changing the bill.',
      tone: 'warn',
    });
  }
  if (billAmount <= 0 && totalDue > 0) {
    notes.push({
      key: 'missing-bill',
      label: 'Bill amount missing',
      detail: 'A balance is present but the bill amount is zero. This usually points to a missing posted computation.',
      tone: 'bad',
    });
  }
  if (kwhUsed <= 0 && billAmount > 0) {
    notes.push({
      key: 'zero-kwh',
      label: 'Zero kWh with charges',
      detail: 'Charges exist but computed usage is zero or missing. Check reading capture and rate application.',
      tone: 'warn',
    });
  }
  if (/lifeline/i.test(`${consumer?.rateCode || ''} ${consumer?.remarks || ''}`)) {
    notes.push({
      key: 'lifeline',
      label: 'Lifeline-sensitive account',
      detail: 'Apply the existing lifeline rule set carefully. The audit view is read-only and only highlights potential subsidy drift.',
      tone: 'good',
    });
  }
  if (multiplier > 1 && kwhUsed > 0) {
    notes.push({
      key: 'multiplier',
      label: 'Multiplier applied',
      detail: `Meter multiplier ${multiplier} is part of the current computation and must be preserved in any correction.`,
      tone: 'good',
    });
  }
  return notes;
}

export default function UtilityBillAuditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [consumer, setConsumer] = useState<any | null>(null);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      getConsumerById(db, id, { mode: getActiveReadingMode() }),
      getPrintableInvoiceForReading(db, id, { mode: getActiveReadingMode() }),
      getPaymentSummary(db, id, { mode: getActiveReadingMode() }),
    ])
      .then(([consumerRow, invoiceRow, paymentRow]) => {
        if (!alive) return;
        setConsumer(consumerRow);
        setInvoice(invoiceRow);
        setPaymentSummary(paymentRow);
      })
      .catch(() => {
        if (alive) {
          setConsumer(null);
          setInvoice(null);
          setPaymentSummary(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [db, id]);

  const auditNotes = useMemo(() => buildAuditNotes(consumer, invoice, paymentSummary), [consumer, invoice, paymentSummary]);

  const printable = invoice?.printableInvoice || {};
  const generationSubtotal = Number(invoice?.generationSubtotal ?? (consumer?.billAmount ? consumer.billAmount * 0.52 : 0));
  const transmissionSubtotal = Number(invoice?.transmissionSubtotal ?? (consumer?.billAmount ? consumer.billAmount * 0.13 : 0));
  const distributionSubtotal = Number(invoice?.distributionSubtotal ?? (consumer?.billAmount ? consumer.billAmount * 0.18 : 0));
  const otherChargesTotal = Number(invoice?.otherChargesTotal ?? (consumer?.billAmount ? consumer.billAmount * 0.05 : 0));
  const vatSubtotal = Number(invoice?.vatSubtotal ?? (consumer?.billAmount ? consumer.billAmount * 0.12 : 0));
  const amountDue = Number(consumer?.totalDue ?? 0);

  if (!consumer) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bill Audit</Text>
        </View>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="database-search" size={64} color={Colors.border} />
          <Text style={styles.emptyTitle}>No bill record found</Text>
          <Text style={styles.emptyText}>The selected account is not available in the active SQLite database.</Text>
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
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Bill Audit</Text>
          <Text style={styles.headerSub}>{consumer.accountNumber} · {consumer.billMonth}</Text>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/(drawer)/utility-bill-correction/${id}` as any)}>
          <MaterialCommunityIcons name="file-document-edit" size={20} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.summaryCard} elevation={2}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <View style={styles.summaryIcon}>
                <MaterialCommunityIcons name="counter" size={24} color={Colors.primaryDark} />
              </View>
              <View style={styles.summaryText}>
                <Text style={styles.summaryTitle}>{consumer.name}</Text>
                <Text style={styles.summarySub}>{consumer.address}</Text>
              </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.summaryGrid}>
              <InfoRow label="Previous Reading" value={String(consumer.previousReading ?? '')} />
              <InfoRow label="Current Reading" value={String(consumer.currentReading ?? printable.presentReading ?? 'N/A')} />
              <InfoRow label="Multiplier" value={String(consumer.multiplier ?? 1)} />
              <InfoRow label="Computed kWh" value={String(consumer.kwhUsed ?? printable.kwhUsed ?? 'N/A')} />
              <InfoRow label="Bill Amount" value={peso(Number(consumer.billAmount || 0))} />
              <InfoRow label="Amount Due" value={peso(amountDue)} />
            </View>
          </Card.Content>
        </Card>

        <SectionHeader title="Invoice Breakdown" />
        <Card style={styles.breakdownCard} elevation={1}>
          <Card.Content>
            {[
              { label: 'Generation', value: generationSubtotal },
              { label: 'Transmission', value: transmissionSubtotal },
              { label: 'Distribution', value: distributionSubtotal },
              { label: 'Other Charges', value: otherChargesTotal },
              { label: 'VAT', value: vatSubtotal },
            ].map((item) => (
              <View key={item.label} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <Text style={styles.breakdownValue}>{peso(item.value)}</Text>
              </View>
            ))}
            <Divider style={styles.divider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownTotalLabel}>TOTAL BILL</Text>
              <Text style={styles.breakdownTotalValue}>{peso(Number(consumer.billAmount || 0))}</Text>
            </View>
            <View style={[styles.breakdownRow, styles.amountDueRow]}>
              <Text style={styles.breakdownTotalLabel}>TOTAL DUE</Text>
              <Text style={styles.breakdownTotalValue}>{peso(amountDue)}</Text>
            </View>
          </Card.Content>
        </Card>

        <SectionHeader title="Audit Notes" />
        <View style={styles.noteList}>
          {auditNotes.map((note) => (
            <View
              key={note.key}
              style={[
                styles.noteCard,
                note.tone === 'good' && styles.noteGood,
                note.tone === 'warn' && styles.noteWarn,
                note.tone === 'bad' && styles.noteBad,
              ]}
            >
              <View style={styles.noteHead}>
                <MaterialCommunityIcons
                  name={note.tone === 'bad' ? 'alert-circle' : note.tone === 'warn' ? 'alert' : 'check-circle'}
                  size={18}
                  color={note.tone === 'bad' ? Colors.error : note.tone === 'warn' ? Colors.warning : Colors.success}
                />
                <Text style={styles.noteTitle}>{note.label}</Text>
              </View>
              <Text style={styles.noteText}>{note.detail}</Text>
            </View>
          ))}
          {!auditNotes.length && (
            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>No obvious audit flags</Text>
              <Text style={styles.noteText}>The current bill values look internally consistent at a summary level.</Text>
            </View>
          )}
        </View>

        <SectionHeader title="Correction Guidance" />
        <Card style={styles.actionCard} elevation={1}>
          <Card.Content>
            <Text style={styles.actionText}>
              Use this page to validate a wrong reading, wrong kWh, or lifeline subsidy issue before any future correction
              workflow writes a preview and rollback script.
            </Text>
            <View style={styles.buttonRow}>
              <Button mode="contained" icon="eye" onPress={() => router.push(`/(drawer)/utility-bill-correction/${id}` as any)} style={styles.previewBtn}>
                Preview Correction
              </Button>
              <Button mode="outlined" icon="cash" onPress={() => router.push(`/(drawer)/payment/${id}`)} style={styles.paymentBtn}>
                Go to Payment
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
  },
  summaryCard: {
    borderRadius: 12,
    backgroundColor: Colors.white,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  summarySub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  divider: {
    marginVertical: 10,
    backgroundColor: Colors.divider,
  },
  summaryGrid: {
    gap: 2,
  },
  breakdownCard: {
    borderRadius: 12,
    backgroundColor: Colors.white,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  breakdownLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  breakdownValue: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  breakdownTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryDark,
  },
  breakdownTotalValue: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  amountDueRow: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  noteList: {
    gap: 10,
    marginBottom: 10,
  },
  noteCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderLeftWidth: 4,
    borderLeftColor: Colors.border,
  },
  noteGood: {
    borderLeftColor: Colors.success,
    backgroundColor: Colors.successLight,
  },
  noteWarn: {
    borderLeftColor: Colors.warning,
    backgroundColor: '#FFF8E1',
  },
  noteBad: {
    borderLeftColor: Colors.error,
    backgroundColor: Colors.errorLight,
  },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
  actionCard: {
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  actionText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  previewBtn: {
    borderRadius: 10,
  },
  paymentBtn: {
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
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
