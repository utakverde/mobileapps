import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Colors } from '@constants/colors';
import type { ReportType } from '@constants/types';
import CameraCaptureModal, { type CapturedPhoto } from '@components/common/CameraCaptureModal';
import SectionHeader from '@components/common/SectionHeader';
import { getConsumerById, saveComplaintReport } from '../../../database/consumerRepository';
import { getBluetoothPrinterConfig } from '../../../database/configRepository';
import { createComplaintReportPrintText, createPrinterPayload } from '../../../services/printerService';
import { sendBluetoothPrint } from '@lib/bluetoothPrinter';
import { getActiveReadingMode } from '@lib/session';
import { IMAGE_DIRS, ensureAppStorageFolders } from '@lib/databaseFiles';

const REPORT_TYPES: { value: ReportType; label: string; icon: string; color: string }[] = [
  { value: 'dead_meter', label: 'Dead Meter', icon: 'meter-electric-outline', color: Colors.error },
  { value: 'rotten_pole', label: 'Rotten Pole', icon: 'transmission-tower-off', color: Colors.warning },
  { value: 'leaning_pole', label: 'Leaning Pole', icon: 'transmission-tower', color: Colors.warning },
  { value: 'illegal_connection', label: 'Illegal Connection', icon: 'flash-off', color: Colors.error },
  { value: 'wrong_serial', label: 'Wrong Serial', icon: 'barcode-off', color: '#F9A825' },
  { value: 'low_clearance', label: 'Low Clearance', icon: 'arrow-collapse-down', color: Colors.warning },
  { value: 'update_gps', label: 'Update GPS', icon: 'crosshairs-gps', color: Colors.primary },
  { value: 'not_registered', label: 'Not Registered', icon: 'account-off', color: Colors.neutral },
  { value: 'others', label: 'Others', icon: 'dots-horizontal-circle', color: Colors.neutral },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: Colors.success },
  { value: 'normal', label: 'Normal', color: Colors.warning },
  { value: 'high', label: 'High', color: Colors.error },
] as const;

function safeFilePart(value: unknown, fallback: string) {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
}

function imageExtension(uri: string) {
  const match = uri.match(/\.([a-z0-9]+)(?:\?|$)/i);
  const ext = match?.[1]?.toLowerCase();
  return ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
}

export default function ComplaintScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [consumer, setConsumer] = useState<any | null>(null);

  const [reportType, setReportType] = useState<ReportType>('dead_meter');
  const [remarks, setRemarks] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [assignedTeam, setAssignedTeam] = useState('');
  const [meterSerial, setMeterSerial] = useState('');
  const [cameraVisible, setCameraVisible] = useState(false);
  const [reportPhoto, setReportPhoto] = useState<CapturedPhoto | null>(null);

  useEffect(() => {
    if (id === 'new') return;
    let alive = true;
    getConsumerById(db, id, { mode: getActiveReadingMode() })
      .then((row: any) => {
        if (alive) {
          setConsumer(row);
          setMeterSerial(String(row?.serialNumber || ''));
        }
      })
      .catch(() => {
        if (alive) setConsumer(null);
      });
    return () => {
      alive = false;
    };
  }, [db, id]);

  const saveComplaintPhoto = async () => {
    if (!reportPhoto?.uri) return '';
    await ensureAppStorageFolders();
    const serial = safeFilePart(meterSerial || consumer?.serialNumber, 'serial');
    const account = safeFilePart(consumer?.accountNumber, reportType === 'not_registered' ? '' : 'account');
    const baseName = account ? `${account}-${serial}` : serial;
    const destination = `${IMAGE_DIRS.complaint}${baseName}.${imageExtension(reportPhoto.uri)}`;
    if (reportPhoto.uri === destination) return destination;
    await FileSystem.deleteAsync(destination, { idempotent: true });
    await FileSystem.copyAsync({ from: reportPhoto.uri, to: destination });
    setReportPhoto({ ...reportPhoto, uri: destination });
    return destination;
  };

  const handleSave = async () => {
    if (reportType === 'not_registered' && !meterSerial.trim()) {
      Alert.alert('Serial required', 'Enter the meter serial number so the complaint photo can be named correctly.');
      return;
    }
    try {
      const photoUri = await saveComplaintPhoto();
      await saveComplaintReport(db, {
        accountNumber: consumer?.accountNumber || '',
        serialNumber: meterSerial || consumer?.serialNumber || '',
        reportType,
        remarks,
        priority,
        assignedTeam,
        photoUri,
      });
      Alert.alert('Report Saved', 'Field report has been saved locally and queued for upload.', [
        { text: 'Upload Now', onPress: () => {} },
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save report.');
    }
  };

  const handlePrint = async () => {
    try {
      const printer = await getBluetoothPrinterConfig(db);
      if (!printer.address) {
        Alert.alert('No Printer', 'Please connect a Bluetooth printer first.');
        return;
      }
      const text = createComplaintReportPrintText({
        complaints: [
          {
            accountNumber: consumer?.accountNumber || '',
            consumerName: consumer?.name || '',
            address: consumer?.address || '',
            reportType,
            remarks,
            priority,
            assignedTeam,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        ],
      });
      await sendBluetoothPrint(printer.address, createPrinterPayload(text, { printerType: printer.printerType }));
      Alert.alert('Print Report', 'Complaint report sent to Bluetooth printer.');
    } catch (error) {
      Alert.alert('Print failed', error instanceof Error ? error.message : 'Could not print complaint report.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Field Report / Complaint</Text>
        <MaterialCommunityIcons name="alert-circle" size={22} color="rgba(255,255,255,0.7)" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Consumer info */}
        {consumer && (
          <>
            <SectionHeader title="Consumer Information" />
            <Card style={styles.infoCard} elevation={1}>
              <Card.Content style={styles.infoContent}>
                <Text style={styles.consumerAccount}>{consumer.accountNumber}</Text>
                <Text style={styles.consumerName}>{consumer.name}</Text>
                <Text style={styles.consumerAddress}>{consumer.address}</Text>
                <View style={styles.coordsRow}>
                  <MaterialCommunityIcons
                    name={consumer.gpsLat ? 'map-marker-check' : 'map-marker-off'}
                    size={14}
                    color={consumer.gpsLat ? Colors.success : Colors.neutral}
                  />
                  <Text style={styles.coordsText}>
                    {consumer.gpsLat ? `${consumer.gpsLat.toFixed(6)}, ${consumer.gpsLng?.toFixed(6)}` : 'No GPS coordinates'}
                  </Text>
                </View>
              </Card.Content>
            </Card>
          </>
        )}

        {/* Report type */}
        <SectionHeader title="Report Type" />
        <Card style={styles.typeCard} elevation={1}>
          <Card.Content>
            <View style={styles.typeGrid}>
              {REPORT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeChip,
                    reportType === type.value && { backgroundColor: type.color, borderColor: type.color },
                  ]}
                  onPress={() => setReportType(type.value)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={type.icon as any}
                    size={20}
                    color={reportType === type.value ? Colors.white : type.color}
                  />
                  <Text style={[styles.typeLabel, reportType === type.value && styles.typeLabelActive]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Priority */}
        <SectionHeader title="Priority" />
        <Card style={styles.infoCard} elevation={1}>
          <Card.Content>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.priorityChip, priority === p.value && { backgroundColor: p.color, borderColor: p.color }]}
                  onPress={() => setPriority(p.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.priorityLabel, priority === p.value && styles.priorityLabelActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Remarks */}
        <SectionHeader title="Details" />
        <Card style={styles.infoCard} elevation={1}>
          <Card.Content>
            <TextInput
              label="Remarks / Description *"
              value={remarks}
              onChangeText={setRemarks}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.remarksInput}
              left={<TextInput.Icon icon="text-box-edit" />}
            />
            <TextInput
              label="Assigned Team (optional)"
              value={assignedTeam}
              onChangeText={setAssignedTeam}
              mode="outlined"
              style={styles.teamInput}
              left={<TextInput.Icon icon="account-group" />}
            />
            {(reportType === 'not_registered' || id === 'new' || !consumer) && (
              <TextInput
                label="Meter Serial Number *"
                value={meterSerial}
                onChangeText={setMeterSerial}
                mode="outlined"
                style={styles.teamInput}
                left={<TextInput.Icon icon="barcode" />}
              />
            )}
          </Card.Content>
        </Card>

        {/* Photo */}
        <SectionHeader title="Field Photo" />
        <Card style={styles.infoCard} elevation={1}>
          <Card.Content>
            <TouchableOpacity
              style={styles.photoArea}
              onPress={() => setCameraVisible(true)}
            >
              {reportPhoto ? (
                <Image source={{ uri: reportPhoto.uri }} style={styles.photoPreview} />
              ) : (
                <MaterialCommunityIcons name="camera-plus" size={40} color={Colors.border} />
              )}
              <Text style={styles.photoText}>{reportPhoto ? 'Photo captured' : 'Tap to capture photo'}</Text>
              <Text style={styles.photoSub}>{reportPhoto ? 'Tap to retake report photo' : 'Photo will be attached to this report'}</Text>
            </TouchableOpacity>
          </Card.Content>
        </Card>

        {/* Actions */}
        <View style={styles.actionsSection}>
          <Button
            mode="contained"
            onPress={handleSave}
            icon="content-save"
            style={styles.saveBtn}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
            disabled={!remarks}
          >
            Save Report
          </Button>
          <View style={styles.secondaryBtns}>
            <Button
              mode="outlined"
              icon="cloud-upload"
              style={styles.secondBtn}
              onPress={() =>
                Alert.alert('Upload Report', 'Report queued for upload when the server is reachable.')
              }
            >
              Upload Report
            </Button>
            <Button
              mode="outlined"
              icon="printer"
              style={styles.secondBtn}
              onPress={handlePrint}
              disabled={!remarks}
            >
              Print Report
            </Button>
          </View>
        </View>
      </ScrollView>
      <CameraCaptureModal
        visible={cameraVisible}
        title="Complaint Photo"
        onClose={() => setCameraVisible(false)}
        onCaptured={setReportPhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: '#F9A825',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.white },
  infoCard: { margin: 10, marginTop: 0, borderRadius: 12, backgroundColor: Colors.white },
  infoContent: { paddingVertical: 10 },
  consumerAccount: { fontSize: 10, color: Colors.textMuted, letterSpacing: 0.5 },
  consumerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  consumerAddress: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  coordsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coordsText: { fontSize: 11, color: Colors.textMuted },
  typeCard: { margin: 10, marginTop: 0, borderRadius: 12, backgroundColor: Colors.white },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 6,
    backgroundColor: Colors.white,
  },
  typeLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  typeLabelActive: { color: Colors.white },
  priorityRow: { flexDirection: 'row', gap: 10 },
  priorityChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  priorityLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  priorityLabelActive: { color: Colors.white },
  remarksInput: { marginBottom: 12, backgroundColor: Colors.white },
  teamInput: { backgroundColor: Colors.white },
  photoArea: {
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  photoPreview: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.72,
  },
  photoText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  photoSub: { fontSize: 11, color: Colors.textMuted },
  actionsSection: { padding: 12, gap: 10, marginBottom: 30 },
  saveBtn: { borderRadius: 10, backgroundColor: '#F9A825' },
  btnContent: { height: 50 },
  btnLabel: { fontSize: 16, fontWeight: '700' },
  secondaryBtns: { flexDirection: 'row', gap: 8 },
  secondBtn: { flex: 1, borderRadius: 8 },
});
