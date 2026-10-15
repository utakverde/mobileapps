import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Divider, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@constants/colors';
import type { PaymentMethod } from '@constants/types';
import InfoRow from '@components/common/InfoRow';
import SectionHeader from '@components/common/SectionHeader';
import { getPaymentSummary, savePayment } from '../../../database/invoiceRepository';
import { getReadingAssignment } from '../../../database/consumerRepository';
import { getLoginOrNumber } from '../../../database/configRepository';
import { getActiveCollectorId, getActiveCollectorName, getActiveOrNumber, getActiveReadingMode } from '@lib/session';
import { hasPayableBill } from '@lib/billing';
import { getSmsSettings } from '../../../database/smsRepository';
import { openSmsComposer, queuePaymentSms } from '../../../services/smsService';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string; color: string }[] = [
  { value: 'cash', label: 'Cash', icon: 'cash', color: Colors.success },
  { value: 'check', label: 'Check', icon: 'checkbook', color: Colors.primary },
  { value: 'gcash', label: 'GCash', icon: 'cellphone', color: '#0077B6' },
  { value: 'maya', label: 'Maya', icon: 'credit-card', color: '#5E35B1' },
  { value: 'others', label: 'Others', icon: 'dots-horizontal-circle', color: Colors.neutral },
];

const FALLBACK_ARREARS_KEY = '__previous_balance__';

function peso(value: number) {
  return `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

function arrearsKey(row: any) {
  return String(row.BillMonth || row.billMonth || row.id || row._rowid || '');
}

function arrearsAmount(row: any) {
  return Number(row.TotalBill ?? row.balance_previous ?? row.amount ?? 0);
}

export default function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [orNumber, setOrNumber] = useState(getActiveOrNumber());
  const [amountPaid, setAmountPaid] = useState('');
  const [selectedArrearsKeys, setSelectedArrearsKeys] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [collectorName, setCollectorName] = useState(getActiveCollectorName() || 'Field Reader');
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const consumer = summary
    ? {
        accountNumber: String(summary.readingRecord.AccountNumber ?? ''),
        name: String(summary.readingRecord.Name ?? ''),
        address: String(summary.readingRecord.Address ?? ''),
        billMonth: String(summary.readingRecord.BillMonth ?? ''),
        billAmount: Number(summary.billAmount ?? 0),
        arrearsTotal: Number(summary.arrearsTotal ?? 0),
        totalDue: Number(summary.totalDue ?? 0),
      }
    : {
        accountNumber: '',
        name: '',
        address: '',
        billMonth: '',
        billAmount: 0,
        arrearsTotal: 0,
        totalDue: 0,
      };

  const canPayBill = hasPayableBill({
    billAmount: consumer.billAmount,
    arrearsTotal: consumer.arrearsTotal,
    totalDue: consumer.totalDue,
    status: summary?.isPaid ? 'paid' : null,
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([getPaymentSummary(db, id, { mode: getActiveReadingMode() }), getReadingAssignment(db, { mode: getActiveReadingMode() }), getLoginOrNumber(db)])
      .then((data: any) => {
        if (!alive) return;
        const [paymentData, assignment, savedOrNumber] = data;
        setSummary(paymentData);
        const arrearsKeys = (paymentData.arrears || []).map((row: any) => arrearsKey(row)).filter(Boolean);
        setSelectedArrearsKeys(
          arrearsKeys.length > 0 ? arrearsKeys : Number(paymentData.arrearsTotal || 0) > 0 ? [FALLBACK_ARREARS_KEY] : []
        );
        setCollectorName(getActiveCollectorName() || assignment.readerName || 'Field Reader');
        if (paymentData.isPaid) {
          setPaymentSuccess(true);
          setOrNumber(paymentData.payment?.ornumber || paymentData.bill?.ornumber || '');
          setAmountPaid(String(paymentData.payment?.TotalBill || paymentData.totalDue || ''));
          Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }).start();
        } else if (!getActiveOrNumber() && savedOrNumber) {
          setOrNumber(savedOrNumber);
        }
      })
      .catch((error: Error) => Alert.alert('Payment error', error.message))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db, id, scaleAnim]);

  const arrearsRows = useMemo(() => summary?.arrears || [], [summary?.arrears]);
  const displayArrearsRows = useMemo(
    () =>
      arrearsRows.length > 0
        ? arrearsRows
        : consumer.arrearsTotal > 0
        ? [{ BillMonth: 'Previous Balance', balance_previous: consumer.arrearsTotal, id: FALLBACK_ARREARS_KEY }]
        : [],
    [arrearsRows, consumer.arrearsTotal]
  );

  const selectedArrearsTotal = useMemo(
    () =>
      displayArrearsRows
        .filter((row: any) => selectedArrearsKeys.includes(arrearsKey(row)))
        .reduce((sum: number, row: any) => sum + arrearsAmount(row), 0),
    [displayArrearsRows, selectedArrearsKeys]
  );

  const payableTotal = useMemo(
    () => Number((consumer.billAmount + selectedArrearsTotal).toFixed(2)),
    [consumer.billAmount, selectedArrearsTotal]
  );

  const paidAmount = useMemo(() => {
    if (paymentSuccess) {
      const paid = Number(amountPaid);
      return Number.isFinite(paid) ? paid : consumer.totalDue;
    }
    return payableTotal;
  }, [amountPaid, consumer.totalDue, payableTotal, paymentSuccess]);

  const change = useMemo(() => {
    return paidAmount - (paymentSuccess ? consumer.totalDue : payableTotal);
  }, [paidAmount, consumer.totalDue, payableTotal, paymentSuccess]);

  const canSavePayment =
    canPayBill && !summary?.isPaid && orNumber.trim().length > 0 && payableTotal > 0;

  const handleSavePayment = async () => {
    if (!canSavePayment) {
      Alert.alert('Invalid payment', 'Enter an OR number before saving the payment.');
      return;
    }

    try {
      const payment = await savePayment(db, id, {
        orNumber: orNumber.trim(),
        amountDue: payableTotal,
        amountPaid: payableTotal,
        paymentMethod,
        collectorName,
        collectorCode: getActiveCollectorId() || undefined,
        mode: getActiveReadingMode(),
        selectedArrearsBillMonths: selectedArrearsKeys,
      });
      const refreshed = await getPaymentSummary(db, id, { mode: getActiveReadingMode() });
      setSummary({ ...refreshed, payment });
      setAmountPaid(String(payment.amountPaid || payableTotal));
        setPaymentSuccess(true);
        const smsSettings = await getSmsSettings(db);
        const sms = smsSettings.enabled
          ? await queuePaymentSms(db, payment, summary?.readingRecord || {}, smsSettings)
          : { queued: false, reason: 'disabled' };
        if (sms.queued) {
          Alert.alert('Payment Saved', 'Send a payment confirmation by SMS?', [
            { text: 'Skip', style: 'cancel' },
            { text: 'Send SMS', onPress: () => openSmsComposer(sms.row).catch((error) => Alert.alert('SMS failed', error.message)) },
          ]);
        }
        Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }).start();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save payment.');
    }
  };

  const toggleArrears = (key: string) => {
    setSelectedArrearsKeys((keys) =>
      keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]
    );
  };

  if (paymentSuccess) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successBg} />
        <Animated.View style={[styles.successCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check-circle" size={72} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <View style={styles.successDetails}>
            <InfoRow label="Account No." value={consumer.accountNumber} />
            <InfoRow label="Consumer" value={consumer.name} bold />
            <InfoRow label="Bill Month" value={consumer.billMonth} />
            <InfoRow label="Total Due" value={peso(consumer.totalDue)} />
            <InfoRow label="Amount Paid" value={peso(paidAmount ?? 0)} bold />
            <InfoRow label="Change" value={peso(change ?? 0)} valueColor={Colors.success} bold />
            <InfoRow label="OR Number" value={orNumber} />
            <InfoRow label="Collector" value={collectorName} />
          </View>
          <View style={styles.paidBadge}>
            <MaterialCommunityIcons name="check" size={14} color={Colors.white} />
            <Text style={styles.paidBadgeText}>PAID</Text>
          </View>
          <View style={styles.successActions}>
            <Button
              mode="contained"
              icon="printer"
              onPress={() => router.push(`/(drawer)/receipt/${id}`)}
              style={styles.printReceiptBtn}
              contentStyle={styles.btnContent}
            >
              Print Receipt
            </Button>
            <Button mode="outlined" icon="skip-next" onPress={() => router.back()} style={styles.nextBtn}>
              Next Consumer
            </Button>
          </View>
        </Animated.View>
      </View>
    );
  }

  if (!loading && !canPayBill) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Collection / Payment</Text>
            <Text style={styles.headerSub}>{consumer.name || consumer.accountNumber}</Text>
          </View>
          <View style={styles.cashIcon}>
            <MaterialCommunityIcons name="cash-register" size={24} color={Colors.white} />
          </View>
        </View>
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="file-document" size={64} color={Colors.border} />
          <Text style={styles.emptyTitle}>No bill to collect</Text>
          <Text style={styles.emptyText}>
            Save a reading or wait for an arrears bill before opening payment for this account.
          </Text>
          <Button mode="contained" icon="arrow-left" onPress={() => router.back()} style={styles.emptyAction}>
            Go Back
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
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Collection / Payment</Text>
          <Text style={styles.headerSub}>{consumer.name || consumer.accountNumber}</Text>
        </View>
        <View style={styles.cashIcon}>
          <MaterialCommunityIcons name="cash-register" size={24} color={Colors.white} />
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? <Text style={styles.loading}>Loading payment details...</Text> : null}
        <SectionHeader title="Bill Summary" />
        <Card style={styles.billCard} elevation={2}>
          <Card.Content>
            <View style={styles.billHeader}>
              <View style={styles.billInfo}>
                <Text style={styles.billAccountNo}>{consumer.accountNumber}</Text>
                <Text style={styles.billName}>{consumer.name}</Text>
                <Text style={styles.billAddress}>{consumer.address}</Text>
              </View>
              <View style={styles.billMonthBadge}>
                <Text style={styles.billMonthText}>{consumer.billMonth}</Text>
              </View>
            </View>
            <Divider style={styles.divider} />
            <InfoRow label="Bill Amount" value={peso(consumer.billAmount)} />
            <InfoRow
              label="Arrears Amount"
              value={peso(consumer.arrearsTotal)}
              valueColor={consumer.arrearsTotal > 0 ? Colors.error : undefined}
            />
            <View style={styles.totalDueRow}>
              <Text style={styles.totalDueLabel}>TOTAL DUE</Text>
              <Text style={styles.totalDueValue}>{peso(consumer.totalDue)}</Text>
            </View>
          </Card.Content>
        </Card>

        <SectionHeader title="Payment Details" />
        <Card style={styles.formCard} elevation={1}>
          <Card.Content style={styles.formContent}>
            <TextInput
              label="Official Receipt No. (OR No.) *"
              value={orNumber}
              onChangeText={setOrNumber}
              mode="outlined"
              left={<TextInput.Icon icon="receipt" />}
              style={styles.input}
              textColor={Colors.textPrimary}
              placeholderTextColor={Colors.textMuted}
            />
            {displayArrearsRows.length > 0 ? (
              <View style={styles.arrearsSelector}>
                <Text style={styles.arrearsTitle}>Select Arrears to Include</Text>
                {displayArrearsRows.map((row: any) => {
                  const key = arrearsKey(row);
                  const selected = selectedArrearsKeys.includes(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.arrearsRow, selected && styles.arrearsRowSelected]}
                      onPress={() => toggleArrears(key)}
                      activeOpacity={0.75}
                    >
                      <MaterialCommunityIcons
                        name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                        size={22}
                        color={selected ? Colors.success : Colors.textMuted}
                      />
                      <View style={styles.arrearsInfo}>
                        <Text style={styles.arrearsMonth}>{String(row.BillMonth || row.billMonth || 'Arrears')}</Text>
                        <Text style={styles.arrearsMeta}>Previous unpaid bill</Text>
                      </View>
                      <Text style={styles.arrearsAmount}>{peso(arrearsAmount(row))}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
            <View style={styles.amountDueBox}>
              <MaterialCommunityIcons name="cash-register" size={22} color={Colors.success} />
              <Text style={styles.amountDueLabel}>Amount to Collect</Text>
              <Text style={styles.amountDueValue}>{peso(payableTotal)}</Text>
            </View>
            <View style={styles.collectorBox}>
              <MaterialCommunityIcons name="account-check" size={18} color={Colors.textMuted} />
              <Text style={styles.collectorText}>Collector: {collectorName}</Text>
            </View>
          </Card.Content>
        </Card>

        <SectionHeader title="Payment Method" />
        <Card style={styles.formCard} elevation={1}>
          <Card.Content>
            <View style={styles.methodsGrid}>
              {PAYMENT_METHODS.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.methodChip,
                    paymentMethod === method.value && { backgroundColor: method.color, borderColor: method.color },
                  ]}
                  onPress={() => setPaymentMethod(method.value)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={method.icon as any}
                    size={22}
                    color={paymentMethod === method.value ? Colors.white : method.color}
                  />
                  <Text style={[styles.methodLabel, paymentMethod === method.value && styles.methodLabelActive]}>
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card.Content>
        </Card>

        <View style={styles.actionsSection}>
          <Button
            mode="contained"
            onPress={handleSavePayment}
            icon="content-save"
            style={styles.saveBtn}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
            disabled={!canSavePayment}
          >
            Save Payment
          </Button>
          <Button mode="outlined" onPress={() => router.back()} icon="close" style={styles.cancelBtn}>
            Cancel
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  cashIcon: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 6 },
  scroll: { flex: 1 },
  loading: { margin: 12, color: Colors.textSecondary, textAlign: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  emptyAction: { marginTop: 6, borderRadius: 10 },
  billCard: {
    margin: 10,
    marginTop: 0,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderLeftWidth: 5,
    borderLeftColor: Colors.success,
  },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8 },
  billInfo: { flex: 1, paddingRight: 8 },
  billAccountNo: { fontSize: 11, color: Colors.textMuted, letterSpacing: 0.5 },
  billName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  billAddress: { fontSize: 12, color: Colors.textSecondary },
  billMonthBadge: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  billMonthText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  divider: { marginVertical: 8, backgroundColor: Colors.divider },
  totalDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.primarySurface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 6,
  },
  totalDueLabel: { fontSize: 13, fontWeight: '800', color: Colors.primary, letterSpacing: 0.8 },
  totalDueValue: { fontSize: 20, fontWeight: '900', color: Colors.primary },
  formCard: { margin: 10, marginTop: 0, borderRadius: 12, backgroundColor: Colors.white },
  formContent: { paddingBottom: 4 },
  input: { marginBottom: 12, backgroundColor: Colors.white, color: Colors.textPrimary },
  arrearsSelector: { marginBottom: 12, gap: 8 },
  arrearsTitle: { fontSize: 12, fontWeight: '800', color: Colors.primaryDark, letterSpacing: 0.4 },
  arrearsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
    backgroundColor: Colors.white,
  },
  arrearsRowSelected: { borderColor: Colors.success, backgroundColor: Colors.successLight },
  arrearsInfo: { flex: 1 },
  arrearsMonth: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  arrearsMeta: { fontSize: 10, color: Colors.textMuted },
  arrearsAmount: { fontSize: 13, fontWeight: '800', color: Colors.error },
  amountDueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 8,
  },
  amountDueLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  amountDueValue: { fontSize: 18, fontWeight: '900', color: Colors.success },
  collectorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  collectorText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  changeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    marginBottom: 4,
  },
  changeDisplayError: { backgroundColor: Colors.errorLight },
  changeLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  changeValue: { fontSize: 18, fontWeight: '800' },
  methodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 6 },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 8,
    backgroundColor: Colors.white,
  },
  methodLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  methodLabelActive: { color: Colors.white },
  actionsSection: { padding: 12, gap: 10, marginBottom: 30 },
  saveBtn: { borderRadius: 10, backgroundColor: Colors.success },
  btnContent: { height: 50 },
  btnLabel: { fontSize: 16, fontWeight: '700' },
  cancelBtn: { borderRadius: 10 },
  successContainer: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', padding: 20 },
  successBg: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: Colors.primaryDark },
  successCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    elevation: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  successIcon: { alignItems: 'center', marginBottom: 12 },
  successTitle: { fontSize: 24, fontWeight: '900', color: Colors.success, textAlign: 'center', marginBottom: 18 },
  successDetails: { marginBottom: 16 },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 20,
    gap: 6,
    alignSelf: 'center',
    marginBottom: 18,
  },
  paidBadgeText: { fontSize: 14, fontWeight: '800', color: Colors.white, letterSpacing: 1 },
  successActions: { gap: 10 },
  printReceiptBtn: { borderRadius: 10 },
  nextBtn: { borderRadius: 10 },
});
