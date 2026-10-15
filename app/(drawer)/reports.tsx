import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Divider, ProgressBar, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PieChart } from 'react-native-chart-kit';
import { useNavigation } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { Colors } from '@constants/colors';
import SummaryCard from '@components/common/SummaryCard';
import SectionHeader from '@components/common/SectionHeader';
import { getReportSummary } from '../../database/consumerRepository';
import { getBluetoothPrinterConfig } from '../../database/configRepository';
import { createCollectionReportPrintText, createComplaintReportPrintText, createPrinterPayload, createSummaryReportPrintText } from '../../services/printerService';
import { sendBluetoothPrint } from '@lib/bluetoothPrinter';
import { getActiveReadingMode } from '@lib/session';
import type { Consumer } from '@constants/types';
import { listConsumers } from '../../database/consumerRepository';

const screenWidth = Dimensions.get('window').width;

const CHART_CONFIG = {
  backgroundColor: Colors.white,
  backgroundGradientFrom: Colors.white,
  backgroundGradientTo: Colors.white,
  color: (opacity = 1) => `rgba(21, 101, 192, ${opacity})`,
  labelColor: () => Colors.textPrimary,
};

function formatCurrency(n: number) {
  return `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export default function ReportsScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const db = useSQLiteContext();
  const [assignment, setAssignment] = useState({
    areaName: 'SQLite Assignment',
    bookNumber: '',
    billMonth: '',
    prevReadingDate: '',
    presentReadingDate: '',
    dueDate: '',
    disconnectionDate: '',
  });
  const [reportStats, setReportStats] = useState({
    totalRecords: 0,
    readRecords: 0,
    unreadRecords: 0,
    paidRecords: 0,
    disconnectedRecords: 0,
    problemReports: 0,
    totalCollectionToday: 0,
    totalCollectionMonth: 0,
    totalAmountDue: 0,
    lastReadingTimestamp: '',
    lastDiscoTimestamp: '',
    mode: 'reading',
  });
  const [payments, setPayments] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [rows, setRows] = useState<Consumer[]>([]);
  const activeMode = getActiveReadingMode();

  useEffect(() => {
    let alive = true;
    getReportSummary(db, { mode: activeMode })
      .then(({ assignment: currentAssignment, stats, payments: paymentRows, complaints: complaintRows }: any) => {
        if (!alive) return;
        setAssignment(currentAssignment);
        setReportStats(stats);
        setPayments(paymentRows || []);
        setComplaints(complaintRows || []);
      })
      .catch(() => {});
    listConsumers(db, { limit: 1000, mode: activeMode })
      .then((value) => {
        if (alive) setRows(value);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [activeMode, db]);

  const pieData = useMemo(
    () => [
      { name: 'Paid', population: reportStats.paidRecords, color: Colors.success, legendFontColor: Colors.textPrimary, legendFontSize: 12 },
      { name: 'Unread', population: reportStats.unreadRecords, color: Colors.neutral, legendFontColor: Colors.textPrimary, legendFontSize: 12 },
      { name: 'Read', population: reportStats.readRecords, color: Colors.warning, legendFontColor: Colors.textPrimary, legendFontSize: 12 },
      { name: 'Disconn.', population: reportStats.disconnectedRecords, color: Colors.error, legendFontColor: Colors.textPrimary, legendFontSize: 12 },
      { name: 'Problem', population: reportStats.problemReports, color: '#F9A825', legendFontColor: Colors.textPrimary, legendFontSize: 12 },
    ].filter((item) => item.population > 0),
    [reportStats]
  );

  const collectionRate = reportStats.totalAmountDue > 0 ? reportStats.totalCollectionMonth / reportStats.totalAmountDue : 0;
  const reportsData = useMemo(() => {
    const area = new Map<string, { key: string; count: number; totalDue: number; totalKwh: number }>();
    const rate = new Map<string, { key: string; count: number; totalDue: number; totalKwh: number }>();
    const aging = new Map<string, { key: string; count: number; totalDue: number }>();
    let lifelineCount = 0;
    let seniorCount = 0;
    let zeroKwhCount = 0;
    let disconnectedWithBalance = 0;

    rows.forEach((row) => {
      const due = Number(row.totalDue || row.billAmount || 0);
      const kwh = Number(row.kwhUsed || 0);
      const areaKey = row.areaCode || 'Unknown';
      const rateKey = row.rateCode || 'Unknown';

      const currentArea = area.get(areaKey) || { key: areaKey, count: 0, totalDue: 0, totalKwh: 0 };
      currentArea.count += 1;
      currentArea.totalDue += due;
      currentArea.totalKwh += kwh;
      area.set(areaKey, currentArea);

      const currentRate = rate.get(rateKey) || { key: rateKey, count: 0, totalDue: 0, totalKwh: 0 };
      currentRate.count += 1;
      currentRate.totalDue += due;
      currentRate.totalKwh += kwh;
      rate.set(rateKey, currentRate);

      const dueDate = new Date(String(row.dueDate || ''));
      const overdueDays = Number.isNaN(dueDate.getTime())
        ? null
        : Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const agingKey = overdueDays == null ? 'Unknown' : overdueDays <= 0 ? 'Current' : overdueDays <= 30 ? '1-30' : overdueDays <= 60 ? '31-60' : '61+';
      const currentAging = aging.get(agingKey) || { key: agingKey, count: 0, totalDue: 0 };
      currentAging.count += 1;
      currentAging.totalDue += due;
      aging.set(agingKey, currentAging);

      if (/lifeline/i.test(`${row.rateCode} ${row.remarks} ${row.name}`)) lifelineCount += 1;
      if (/senior/i.test(`${row.rateCode} ${row.remarks} ${row.name}`)) seniorCount += 1;
      if (due > 0 && kwh <= 0) zeroKwhCount += 1;
      if (row.status === 'disconnected' && due > 0) disconnectedWithBalance += 1;
    });

    return {
      area: Array.from(area.values()).sort((a, b) => b.totalDue - a.totalDue),
      rate: Array.from(rate.values()).sort((a, b) => b.totalDue - a.totalDue),
      aging: Array.from(aging.values()),
      lifelineCount,
      seniorCount,
      zeroKwhCount,
      disconnectedWithBalance,
    };
  }, [rows]);
  const reportPayload = { assignment, stats: reportStats, payments, complaints, mode: activeMode };

  const printReport = async (kind: 'summary' | 'collection' | 'complaint') => {
    try {
      const printer = await getBluetoothPrinterConfig(db);
      if (!printer.address) {
        Alert.alert('No Printer', 'Please connect a Bluetooth printer first.');
        return;
      }
      const text =
        kind === 'collection'
          ? createCollectionReportPrintText(reportPayload, { mode: activeMode })
          : kind === 'complaint'
          ? createComplaintReportPrintText(reportPayload, { mode: activeMode })
          : createSummaryReportPrintText(reportPayload, { mode: activeMode });
      await sendBluetoothPrint(printer.address, createPrinterPayload(text, { printerType: printer.printerType }));
      Alert.alert('Print Report', 'Report sent to Bluetooth printer.');
    } catch (error) {
      Alert.alert('Print failed', error instanceof Error ? error.message : 'Could not print report.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.menuBtn}>
          <MaterialCommunityIcons name="menu" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports & Analytics</Text>
        <MaterialCommunityIcons name="chart-bar" size={22} color="rgba(255,255,255,0.7)" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Reading schedule info */}
        <Card style={styles.schedCard} elevation={2}>
          <Card.Content>
            <Text style={styles.schedTitle}>
              {assignment.areaName} – Book {assignment.bookNumber || 'N/A'}
            </Text>
            <Text style={styles.schedBillMonth}>{assignment.billMonth || 'No bill month found'}</Text>
            <Divider style={styles.divider} />
            <View style={styles.schedGrid}>
              {[
                { label: 'Prev. Reading', value: assignment.prevReadingDate || 'N/A', icon: 'calendar-arrow-left' },
                { label: 'Present Reading', value: assignment.presentReadingDate || 'N/A', icon: 'calendar-check' },
                { label: 'Due Date', value: assignment.dueDate || 'N/A', icon: 'calendar-clock' },
                { label: 'Disconnection', value: assignment.disconnectionDate || 'N/A', icon: 'calendar-remove' },
                {
                  label: activeMode === 'disconnection' ? 'Last Disco' : 'Last Reading',
                  value: activeMode === 'disconnection' ? reportStats.lastDiscoTimestamp || 'N/A' : reportStats.lastReadingTimestamp || 'N/A',
                  icon: activeMode === 'disconnection' ? 'flash-off' : 'clock-check',
                },
              ].map((item) => (
                <View key={item.label} style={styles.schedItem}>
                  <MaterialCommunityIcons name={item.icon as any} size={16} color={Colors.primary} />
                  <View>
                    <Text style={styles.schedItemLabel}>{item.label}</Text>
                    <Text style={styles.schedItemValue}>{item.value}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Summary cards grid */}
        <SectionHeader title="Database Records" />
        <View style={styles.cardsRow}>
          <SummaryCard label="Total Records" value={reportStats.totalRecords} icon="database" color={Colors.primary} bgColor={Colors.primarySurface} />
          <SummaryCard label="Read" value={reportStats.readRecords} icon="counter" color={Colors.warning} bgColor={Colors.warningLight} />
        </View>
        <View style={styles.cardsRow}>
          <SummaryCard label="Unread" value={reportStats.unreadRecords} icon="eye-off" color={Colors.neutral} bgColor={Colors.neutralLight} />
          <SummaryCard label="Paid" value={reportStats.paidRecords} icon="check-circle" color={Colors.success} bgColor={Colors.successLight} />
        </View>
        <View style={styles.cardsRow}>
          <SummaryCard label="Disconnected" value={reportStats.disconnectedRecords} icon="flash-off" color={Colors.error} bgColor={Colors.errorLight} />
          <SummaryCard label="Problems" value={reportStats.problemReports} icon="alert-circle" color="#F9A825" bgColor="#FFF8E1" />
        </View>

        {/* Progress bars */}
        <SectionHeader title="Reading Progress" />
        <Card style={styles.progressCard} elevation={1}>
          <Card.Content>
            {[
              { label: 'Paid', count: reportStats.paidRecords, color: Colors.success },
              { label: 'Read (Unpaid)', count: reportStats.readRecords, color: Colors.warning },
              { label: 'Unread', count: reportStats.unreadRecords, color: Colors.neutral },
              { label: 'Disconnected', count: reportStats.disconnectedRecords, color: Colors.error },
            ].map((item) => {
              const pct = reportStats.totalRecords > 0 ? item.count / reportStats.totalRecords : 0;
              return (
                <View key={item.label} style={styles.progressRow}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressLabel}>{item.label}</Text>
                    <Text style={[styles.progressCount, { color: item.color }]}>
                      {item.count} ({(pct * 100).toFixed(1)}%)
                    </Text>
                  </View>
                  <ProgressBar progress={pct} color={item.color} style={styles.progressBar} />
                </View>
              );
            })}
          </Card.Content>
        </Card>

        {/* Pie chart */}
        <SectionHeader title="Status Distribution" />
        <Card style={styles.chartCard} elevation={1}>
          <Card.Content>
            <PieChart
              data={pieData.length > 0 ? pieData : [{ name: 'No data', population: 1, color: Colors.border, legendFontColor: Colors.textPrimary, legendFontSize: 12 }]}
              width={screenWidth - 40}
              height={180}
              chartConfig={CHART_CONFIG}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="0"
              absolute
            />
          </Card.Content>
        </Card>

        <SectionHeader title="Sales Summary" />
        <Card style={styles.collectionCard} elevation={2}>
          <Card.Content>
            <View style={styles.reportGrid}>
              <View style={styles.reportBlock}>
                <Text style={styles.reportBlockTitle}>Sales by Area</Text>
                {reportsData.area.length === 0 ? (
                  <Text style={styles.emptyText}>No area data found.</Text>
                ) : (
                  reportsData.area.slice(0, 5).map((item) => (
                    <View key={item.key} style={styles.reportRow}>
                      <Text style={styles.reportKey}>{item.key}</Text>
                      <Text style={styles.reportValue}>{formatCurrency(item.totalDue)}</Text>
                    </View>
                  ))
                )}
              </View>
              <View style={styles.reportBlock}>
                <Text style={styles.reportBlockTitle}>Sales by Rate</Text>
                {reportsData.rate.length === 0 ? (
                  <Text style={styles.emptyText}>No rate data found.</Text>
                ) : (
                  reportsData.rate.slice(0, 5).map((item) => (
                    <View key={item.key} style={styles.reportRow}>
                      <Text style={styles.reportKey}>{item.key}</Text>
                      <Text style={styles.reportValue}>{formatCurrency(item.totalDue)}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </Card.Content>
        </Card>

        <SectionHeader title="Aging Summary" />
        <Card style={styles.collectionCard} elevation={2}>
          <Card.Content>
            <View style={styles.reportGrid}>
              {reportsData.aging.map((item) => (
                <View key={item.key} style={styles.agingCard}>
                  <Text style={styles.reportBlockTitle}>{item.key}</Text>
                  <Text style={styles.agingCount}>{item.count}</Text>
                  <Text style={styles.agingAmount}>{formatCurrency(item.totalDue)}</Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>

        <SectionHeader title="Discount and Anomaly Summary" />
        <Card style={styles.collectionCard} elevation={2}>
          <Card.Content>
            <View style={styles.reportGrid}>
              <SummaryCard label="Lifeline" value={reportsData.lifelineCount} icon="heart" />
              <SummaryCard label="Senior" value={reportsData.seniorCount} icon="account-heart" />
              <SummaryCard label="Zero-kWh Bills" value={reportsData.zeroKwhCount} icon="flash-off" />
              <SummaryCard label="Disc. w/ Balance" value={reportsData.disconnectedWithBalance} icon="power-plug-off" />
            </View>
          </Card.Content>
        </Card>

        {/* Collection summary */}
        <SectionHeader title={`${activeMode === 'disconnection' ? 'Disco ' : ''}Collection Summary`} />
        <Card style={styles.collectionCard} elevation={2}>
          <Card.Content>
            <View style={styles.collectionRow}>
              <View style={[styles.collectionItem, { borderRightWidth: 1, borderRightColor: Colors.divider }]}>
                <MaterialCommunityIcons name="calendar-today" size={20} color={Colors.primary} />
                <Text style={styles.collectionLabel}>Collection Today</Text>
                <Text style={styles.collectionValue}>{formatCurrency(reportStats.totalCollectionToday)}</Text>
              </View>
              <View style={styles.collectionItem}>
                <MaterialCommunityIcons name="calendar-month" size={20} color={Colors.primaryDark} />
                <Text style={styles.collectionLabel}>This Month</Text>
                <Text style={styles.collectionValue}>{formatCurrency(reportStats.totalCollectionMonth)}</Text>
              </View>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.totalAmountRow}>
              <Text style={styles.totalAmountLabel}>Total Amount Due</Text>
              <Text style={styles.totalAmountValue}>{formatCurrency(reportStats.totalAmountDue)}</Text>
            </View>
            <View style={styles.collectionProgress}>
              <Text style={styles.collectionPct}>
                Collection Rate: {(collectionRate * 100).toFixed(1)}%
              </Text>
              <ProgressBar
                progress={collectionRate}
                color={Colors.success}
                style={styles.progressBar}
              />
            </View>
          </Card.Content>
        </Card>

        <SectionHeader title="Collection Report" />
        <Card style={styles.collectionCard} elevation={2}>
          <Card.Content>
            {payments.length === 0 ? (
              <Text style={styles.emptyText}>No payments found for this mode.</Text>
            ) : (
              payments.slice(0, 50).map((payment) => (
                <View key={`${payment.Code || payment.AccountNumber}-${payment.BillMonth}-${payment.ornumber}`} style={styles.paymentRow}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentName} numberOfLines={1}>{payment.Name || payment.AccountNumber}</Text>
                    <Text style={styles.paymentMeta}>{payment.AccountNumber} • {payment.BillMonth} • OR {payment.ornumber || '-'}</Text>
                  </View>
                  <Text style={styles.paymentAmount}>{formatCurrency(Number(payment.TotalBill || 0))}</Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        <SectionHeader title="Complaint Report" />
        <Card style={styles.collectionCard} elevation={2}>
          <Card.Content>
            {complaints.length === 0 ? (
              <Text style={styles.emptyText}>No complaint reports found.</Text>
            ) : (
              complaints.slice(0, 20).map((complaint) => (
                <View key={complaint.id} style={styles.paymentRow}>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentName} numberOfLines={1}>{complaint.consumerName || complaint.accountNumber || 'Complaint'}</Text>
                    <Text style={styles.paymentMeta}>{complaint.accountNumber || '-'} â€¢ {String(complaint.reportType || '').replace(/_/g, ' ')} â€¢ {complaint.priority}</Text>
                  </View>
                  <Text style={[styles.paymentAmount, { color: Colors.warning }]}>{complaint.status || 'pending'}</Text>
                </View>
              ))
            )}
          </Card.Content>
        </Card>

        {/* Action buttons */}
        <View style={styles.actionsSection}>
          {[
            { icon: 'printer', label: 'Print Summary', color: Colors.primary, kind: 'summary' },
            { icon: 'printer-pos', label: 'Print Collection', color: Colors.success, kind: 'collection' },
            { icon: 'alert-circle', label: 'Print Complaints', color: Colors.warning, kind: 'complaint' },
          ].map((action) => (
            <Button
              key={action.label}
              mode="outlined"
              icon={action.icon as any}
              style={[styles.actionBtn, { borderColor: action.color }]}
              labelStyle={{ color: action.color, fontWeight: '700' }}
              onPress={() => printReport(action.kind as 'summary' | 'collection' | 'complaint')}
            >
              {action.label}
            </Button>
          ))}
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
  schedCard: {
    margin: 10,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderLeftWidth: 5,
    borderLeftColor: Colors.primary,
  },
  schedTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  schedBillMonth: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginTop: 2 },
  divider: { marginVertical: 10, backgroundColor: Colors.divider },
  schedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  schedItem: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '48%' },
  schedItemLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', letterSpacing: 0.4 },
  schedItemValue: { fontSize: 12, color: Colors.textPrimary, fontWeight: '600' },
  cardsRow: { flexDirection: 'row', paddingHorizontal: 6 },
  progressCard: { margin: 10, marginTop: 0, borderRadius: 12, backgroundColor: Colors.white },
  progressRow: { marginBottom: 14 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  progressLabel: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  progressCount: { fontSize: 12, fontWeight: '700' },
  progressBar: { height: 8, borderRadius: 4 },
  chartCard: { margin: 10, marginTop: 0, borderRadius: 12, backgroundColor: Colors.white },
  collectionCard: {
    margin: 10,
    marginTop: 0,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderLeftWidth: 5,
    borderLeftColor: Colors.success,
  },
  collectionRow: { flexDirection: 'row' },
  collectionItem: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 4 },
  collectionLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  collectionValue: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  totalAmountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  totalAmountLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  totalAmountValue: { fontSize: 16, fontWeight: '800', color: Colors.error },
  collectionProgress: { gap: 5 },
  collectionPct: { fontSize: 12, color: Colors.success, fontWeight: '700' },
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  reportBlock: {
    flexGrow: 1,
    flexBasis: 220,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 12,
    gap: 8,
  },
  reportBlockTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  reportKey: { flex: 1, fontSize: 12, color: Colors.textSecondary },
  reportValue: { fontSize: 12, color: Colors.textPrimary, fontWeight: '800' },
  agingCard: {
    flexGrow: 1,
    flexBasis: 140,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    padding: 12,
    gap: 4,
  },
  agingCount: { fontSize: 22, fontWeight: '900', color: Colors.primaryDark },
  agingAmount: { fontSize: 12, fontWeight: '800', color: Colors.textSecondary },
  actionsSection: { padding: 12, gap: 8, marginBottom: 30, flexDirection: 'row', flexWrap: 'wrap' },
  actionBtn: { flex: 1, borderRadius: 8, minWidth: '45%' },
  emptyText: { color: Colors.textMuted, textAlign: 'center', paddingVertical: 10 },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingVertical: 8,
    gap: 8,
  },
  paymentInfo: { flex: 1 },
  paymentName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  paymentMeta: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  paymentAmount: { fontSize: 13, fontWeight: '800', color: Colors.success },
});
