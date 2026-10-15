import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Colors } from '@constants/colors';
import InfoRow from '@components/common/InfoRow';
import SectionHeader from '@components/common/SectionHeader';
import StatusBadge from '@components/common/StatusBadge';
import CameraCaptureModal, { type CapturedPhoto } from '@components/common/CameraCaptureModal';
import { computeAndSaveInvoice, getPaymentSummary, getReadingRecord } from '../../../database/invoiceRepository';
import { listConsumers } from '../../../database/consumerRepository';
import { IMAGE_DIRS, ensureAppStorageFolders } from '@lib/databaseFiles';
import { getActiveCollectorId, getActiveReadingMode } from '@lib/session';
import { hasPayableBill } from '@lib/billing';
import { isDesktopWrapAroundCandidate, validateReadingInput } from '../../../services/readingValidation';
import { getSmsSettings } from '../../../database/smsRepository';
import { openSmsComposer, queueReadingSms } from '../../../services/smsService';

const RATE_PER_KWH = 11.2348; // SAMELCO II sample rate

function sqlName(name: string) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function safeFilePart(value: unknown, fallback: string) {
  const cleaned = String(value ?? '')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
}

function numberText(value: unknown) {
  if (value == null || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : '';
}

function firstDemandValue(record: any) {
  return record?.Demand ?? record?.DemandKWH ?? record?.DemandTrans ?? record?.demand_kwh ?? record?.demand ?? '';
}

function imageExtension(uri: string) {
  const match = uri.match(/\.([a-z0-9]+)(?:\?|$)/i);
  const ext = match?.[1]?.toLowerCase();
  return ext && ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
}

function hasSavedReading(row: any) {
  return (
    row?.flag_read === 1 ||
    row?.flag_read === '1' ||
    row?.present_reading != null ||
    row?.computed_kwh != null ||
    row?.PresentReadingKWH != null ||
    row?.KilowattHour != null ||
    row?.KilowattUsed != null
  );
}

function readingStatusFor(row: any, summary: any) {
  const paid =
    Boolean(summary?.isPaid) ||
    row?.flag_paid === 1 ||
    row?.flag_paid === '1' ||
    row?.flag_paid === 'Y';
  if (paid) return 'paid';

  const connStatus = String(row?.ConnStatus ?? row?.StatusCode ?? '').toLowerCase();
  const remarks = String(row?.remarks ?? row?.Remarks ?? row?.FeedBackCode ?? '').toLowerCase();
  if (row?.app_disconnected_at || row?.date_disconnected || row?.disconnected_at) return 'disconnected';
  if (connStatus.includes('disconnect') || connStatus === 'd') return 'disconnected';
  if (remarks.includes('problem') || remarks.includes('tamper') || remarks.includes('not found')) return 'problem';

  const invoiceStatus = String(row?.invoice_status ?? '').toLowerCase();
  if (hasSavedReading(row) || (invoiceStatus && invoiceStatus !== 'pending')) return 'read';
  return 'unread';
}

export default function ReadingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const activeMode = getActiveReadingMode();
  const isLargeLoadMode = activeMode === 'large_load';
  const [readingRecord, setReadingRecord] = useState<any | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<any | null>(null);
  const blankConsumer: any = {
    id,
    accountNumber: '',
    name: 'Loading...',
    address: '',
    serialNumber: '',
    sequenceNumber: 0,
    meterNumber: '',
    rateCode: '',
    poleNumber: '',
    transformer: '',
    previousReading: 0,
    currentReading: null,
    multiplier: 1,
    kwhUsed: null,
    billAmount: 0,
    penalty: 0,
    totalDue: 0,
    dueDate: '',
    disconnectionDate: '',
    status: 'unread',
    gpsLat: null,
    gpsLng: null,
    remarks: '',
    bookNumber: '',
    areaCode: '',
    billMonth: '',
  };
  const consumer = readingRecord
    ? {
        ...blankConsumer,
        id: String(readingRecord.code ?? readingRecord.AccountNumber ?? id),
        accountNumber: String(readingRecord.AccountNumber ?? ''),
        name: String(readingRecord.Name ?? ''),
        address: String(readingRecord.Address ?? ''),
        serialNumber: String(readingRecord.Serial ?? ''),
        sequenceNumber: Number(readingRecord.Sequence ?? 0),
        meterNumber: String(readingRecord.Serial ?? ''),
        rateCode: String(readingRecord.RateCode ?? ''),
        previousReading: Number(readingRecord.Reading_KWH_Prev ?? 0),
        currentReading: hasSavedReading(readingRecord)
          ? Number(readingRecord.present_reading ?? readingRecord.Reading_KWH ?? 0)
          : null,
        multiplier: Number(readingRecord.Multiplier ?? 1) || 1,
        kwhUsed: readingRecord.computed_kwh ?? null,
        billAmount: Number(readingRecord.total_bill ?? 0),
        penalty: 0,
        totalDue: Number(readingRecord.total_bill ?? 0),
        dueDate: String(readingRecord.Sched_DueDate ?? ''),
        disconnectionDate: String(readingRecord.Sched_DisconnectionDate ?? ''),
        bookNumber: String(readingRecord.Book ?? ''),
        areaCode: String(readingRecord.Area ?? ''),
        billMonth: String(readingRecord.BillMonth ?? ''),
        status: readingStatusFor(readingRecord, paymentSummary),
      }
    : blankConsumer;

  const [presentReading, setPresentReading] = useState(
    consumer.currentReading?.toString() ?? ''
  );
  const [demandReading, setDemandReading] = useState('');
  const [remarks, setRemarks] = useState(consumer.remarks);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activePhotoType, setActivePhotoType] = useState<'meter' | 'house' | null>(null);
  const [photos, setPhotos] = useState<{ meter?: CapturedPhoto; house?: CapturedPhoto }>({});
  const [dirtyPhotos, setDirtyPhotos] = useState<{ meter?: boolean; house?: boolean }>({});

  useEffect(() => {
    let alive = true;
    getReadingRecord(db, id, { mode: activeMode })
      .then(async (row: any) => {
        if (!alive || !row) return;
        setReadingRecord(row);
        setPaymentSummary(await getPaymentSummary(db, id, { mode: activeMode }));
        setPresentReading(
          hasSavedReading(row) ? String(row.present_reading ?? row.Reading_KWH ?? '') : ''
        );
        setDemandReading(numberText(firstDemandValue(row)));
        setRemarks(String(row.remarks ?? row.Remarks ?? ''));
        setPhotos({
          ...(row.meter_photo ? { meter: { uri: String(row.meter_photo) } } : {}),
          ...(row.house_photo ? { house: { uri: String(row.house_photo) } } : {}),
        });
        setDirtyPhotos({});
      })
      .catch(() => {
        // Keep the existing mock fallback if the SQLite record is not found.
      });
    return () => {
      alive = false;
    };
  }, [activeMode, db, id]);

  const readingValidation = useMemo(() => {
    return validateReadingInput({
      previousReading: consumer.previousReading,
      presentReading,
      multiplier: consumer.multiplier,
      allowRollover: false,
    });
  }, [consumer.multiplier, consumer.previousReading, presentReading]);

  const wrapAroundValidation = useMemo(() => {
    return validateReadingInput({
      previousReading: consumer.previousReading,
      presentReading,
      multiplier: consumer.multiplier,
      allowRollover: true,
    });
  }, [consumer.multiplier, consumer.previousReading, presentReading]);

  const canUseWrapAround = useMemo(() => {
    const present = Number(presentReading);
    return (
      Number.isFinite(present) &&
      present < Number(consumer.previousReading || 0) &&
      isDesktopWrapAroundCandidate(consumer.previousReading) &&
      wrapAroundValidation.ok &&
      wrapAroundValidation.rolloverApplied
    );
  }, [consumer.previousReading, presentReading, wrapAroundValidation]);

  const kwhUsed = useMemo(() => {
    return readingValidation.ok ? readingValidation.computedKwh : null;
  }, [readingValidation]);

  const readingError = useMemo(() => {
    if (!presentReading.trim()) return '';
    if (canUseWrapAround) {
      return `Possible meter wrap-around. Saving will compute ${wrapAroundValidation.computedKwh} kWh after confirmation.`;
    }
    return readingValidation.ok ? '' : readingValidation.message;
  }, [canUseWrapAround, presentReading, readingValidation, wrapAroundValidation]);

  const demandError = useMemo(() => {
    if (!isLargeLoadMode || !demandReading.trim()) return '';
    const n = Number(demandReading);
    return Number.isFinite(n) && n >= 0 ? '' : 'Enter a valid demand reading.';
  }, [demandReading, isLargeLoadMode]);

  const demandKwh = useMemo(() => {
    if (!isLargeLoadMode || !demandReading.trim() || demandError) return null;
    const n = Number(demandReading);
    return Number.isFinite(n) ? n : null;
  }, [demandError, demandReading, isLargeLoadMode]);

  const estimatedBill = useMemo(() => {
    if (kwhUsed === null) return null;
    return kwhUsed * RATE_PER_KWH;
  }, [kwhUsed]);

  const isPaid = Boolean(paymentSummary?.isPaid);
  const triesUsed = Number(readingRecord?.tries_count ?? 0);
  const triesExceeded = triesUsed >= 2;
  const readingLocked = isPaid || triesExceeded;
  const canPay = hasPayableBill({
    billAmount: paymentSummary?.billAmount ?? consumer.billAmount,
    arrearsTotal: paymentSummary?.arrearsTotal ?? 0,
    totalDue: paymentSummary?.totalDue ?? consumer.totalDue,
    status: paymentSummary?.isPaid ? 'paid' : consumer.status,
  });

  const saveReadingPhotos = async () => {
    if (!readingRecord || (!dirtyPhotos.meter && !dirtyPhotos.house)) return {};

    await ensureAppStorageFolders();

    const mode = activeMode;
    const tableName = mode === 'disconnection' ? 'billhistory_disco' : 'reading';
    const tableColumns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${sqlName(tableName)})`);
    const columnNames = tableColumns.map((column) => column.name);
    for (const column of ['meter_photo', 'house_photo', 'is_synced', 'updated_at']) {
      if (!columnNames.includes(column)) {
        const type = column === 'is_synced' ? 'INTEGER DEFAULT 0' : 'TEXT';
        await db.execAsync(`ALTER TABLE ${sqlName(tableName)} ADD COLUMN ${sqlName(column)} ${type}`);
        columnNames.push(column);
      }
    }

    const account = safeFilePart(readingRecord.AccountNumber || consumer.accountNumber, 'account');
    const serial = safeFilePart(readingRecord.Serial || consumer.serialNumber, 'serial');
    const billMonth = safeFilePart(readingRecord.BillMonth || consumer.billMonth, 'billmonth');
    const photoBaseName = `${account}-${serial}-${billMonth}`;
    const savedPaths: { meter?: string; house?: string } = {};

    for (const [type, photo] of Object.entries(photos) as ['meter' | 'house', CapturedPhoto | undefined][]) {
      if (!dirtyPhotos[type]) continue;
      if (!photo?.uri) continue;
      const destination = `${IMAGE_DIRS[type]}${photoBaseName}.${imageExtension(photo.uri)}`;
      if (
        photo.uri === destination
      ) {
        savedPaths[type] = photo.uri;
        continue;
      }

      await FileSystem.deleteAsync(destination, { idempotent: true });
      await FileSystem.copyAsync({ from: photo.uri, to: destination });
      savedPaths[type] = destination;
    }

    if (savedPaths.meter || savedPaths.house) {
      const keyColumn = readingRecord._rowid ? 'rowid' : mode === 'disconnection' ? 'Code' : 'code';
      const keyValue = readingRecord._rowid || readingRecord.Code || readingRecord.code;
      const updates = [
        ...(savedPaths.meter ? ['meter_photo = ?'] : []),
        ...(savedPaths.house ? ['house_photo = ?'] : []),
        'is_synced = 0',
        'updated_at = ?',
      ];
      const values = [
        ...(savedPaths.meter ? [savedPaths.meter] : []),
        ...(savedPaths.house ? [savedPaths.house] : []),
        new Date().toISOString(),
        keyValue,
      ];
      await db.runAsync(`UPDATE ${sqlName(tableName)} SET ${updates.join(', ')} WHERE ${sqlName(keyColumn)} = ?`, values);
      setReadingRecord((current: any) => current ? {
        ...current,
        ...(savedPaths.meter ? { meter_photo: savedPaths.meter } : {}),
        ...(savedPaths.house ? { house_photo: savedPaths.house } : {}),
      } : current);
      setPhotos((current) => ({
        meter: savedPaths.meter ? { ...(current.meter || {}), uri: savedPaths.meter } : current.meter,
        house: savedPaths.house ? { ...(current.house || {}), uri: savedPaths.house } : current.house,
      }));
      setDirtyPhotos((current) => ({
        ...current,
        ...(savedPaths.meter ? { meter: false } : {}),
        ...(savedPaths.house ? { house: false } : {}),
      }));
    }

    return savedPaths;
  };

  const goToNextConsumer = async () => {
    try {
      await saveReadingPhotos();
      setPhotos({});
      const consumers = await listConsumers(db, { limit: 500, mode: activeMode });
      const idx = consumers.findIndex((c: any) => c.id === consumer.id);
      const next = consumers[idx + 1];
      if (next) router.replace(`/(drawer)/reading/${next.id}`);
      else router.back();
    } catch (error) {
      Alert.alert('Photo save failed', error instanceof Error ? error.message : 'Could not save the captured photo.');
    }
  };

  const goToPreviousConsumer = async () => {
    try {
      await saveReadingPhotos();
      setPhotos({});
      const consumers = await listConsumers(db, { limit: 500, mode: activeMode });
      const idx = consumers.findIndex((c: any) => c.id === consumer.id);
      const prev = consumers[idx - 1];
      if (prev) router.replace(`/(drawer)/reading/${prev.id}`);
      else router.back();
    } catch (error) {
      Alert.alert('Photo save failed', error instanceof Error ? error.message : 'Could not save the captured photo.');
    }
  };

  const saveConfirmedReading = async (allowRollover = false) => {
    if (readingRecord) {
      try {
        setSaving(true);
        await saveReadingPhotos();
        const savedInvoice = await computeAndSaveInvoice(db, id, presentReading, {
          allowAdminOverride: false,
          allowRollover,
          collectorCode: getActiveCollectorId() || undefined,
          demandReading: demandKwh,
          mode: activeMode,
        });
        setSaved(true);
        const smsSettings = await getSmsSettings(db);
        if (smsSettings.enabled && smsSettings.readingMode === 'after_reading') {
          const sms = await queueReadingSms(db, savedInvoice, readingRecord, smsSettings);
          if (sms.queued) {
            Alert.alert('Reading Saved', 'Send the reading and estimated bill by SMS?', [
              { text: 'Skip', onPress: () => router.push(`/(drawer)/invoice/${id}` as any) },
              {
                text: 'Send SMS',
                onPress: () => openSmsComposer(sms.row).catch((error) => Alert.alert('SMS failed', error.message)),
              },
            ]);
          } else {
            Alert.alert('Reading Saved', 'No valid mobile number was found for this consumer.', [
              { text: 'OK', onPress: () => router.push(`/(drawer)/invoice/${id}` as any) },
            ]);
          }
        } else {
          router.push(`/(drawer)/invoice/${id}` as any);
        }
      } catch (error) {
        Alert.alert('Invoice computation failed', error instanceof Error ? error.message : 'Could not save invoice.');
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaved(true);
    Alert.alert('Reading Saved', `kWh: ${kwhUsed ?? '—'}  |  Est. Bill: ₱${estimatedBill?.toFixed(2) ?? '—'}`, [
      { text: 'Print Bill', onPress: () => router.push(`/(drawer)/receipt/${consumer.id}`) },
      { text: 'Next Consumer', onPress: () => router.back() },
    ]);
  };

  const handleSave = async () => {
    if (saving) return;
    if (isPaid) {
      Alert.alert('Reading locked', 'This bill is already paid. Reading cannot be edited.');
      return;
    }
    if (triesExceeded) {
      Alert.alert('Reading locked', 'Reading can only be attempted up to 2 times.');
      return;
    }
    if (demandError) {
      Alert.alert('Invalid demand', demandError);
      return;
    }
    if (canUseWrapAround) {
      Alert.alert(
        'Confirm wrap-around',
        `Previous reading is ${consumer.previousReading} and present reading is ${presentReading}. Compute as meter wrap-around with ${wrapAroundValidation.computedKwh} kWh?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Compute', onPress: () => { void saveConfirmedReading(true); } },
        ]
      );
      return;
    }
    if (!readingValidation.ok || kwhUsed === null || estimatedBill === null) {
      Alert.alert(
        'Invalid reading',
        readingValidation.message || 'Enter a valid present reading. The previous reading is protected and used internally for computation.'
      );
      return;
    }

    await saveConfirmedReading(false);
  };

  const handlePhotoCaptured = (photo: CapturedPhoto) => {
    if (!activePhotoType) return;
    setPhotos((current) => ({ ...current, [activePhotoType]: photo }));
    setDirtyPhotos((current) => ({ ...current, [activePhotoType]: true }));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{consumer.name}</Text>
          <Text style={styles.headerSub}>{consumer.accountNumber}</Text>
        </View>
        <StatusBadge status={consumer.status} size="small" />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Consumer Info */}
        <SectionHeader title="Consumer Information" />
        <Card style={styles.infoCard} elevation={1}>
          <Card.Content style={styles.cardContent}>
            <InfoRow label="Account Number" value={consumer.accountNumber} bold />
            <InfoRow label="Consumer Name" value={consumer.name} bold />
            <InfoRow label="Address" value={consumer.address} />
            <InfoRow label="Serial Number" value={consumer.serialNumber} />
            <InfoRow label="Sequence No." value={consumer.sequenceNumber} />
            <InfoRow label="Meter Number" value={consumer.meterNumber} />
            <InfoRow label="Rate Code" value={consumer.rateCode} />
            <InfoRow label="Pole Number" value={consumer.poleNumber} />
            <InfoRow label="Transformer" value={consumer.transformer} />
            <InfoRow label="Multiplier" value={`× ${consumer.multiplier}`} />
            {isLargeLoadMode ? (
              <InfoRow
                label="Demand"
                value={demandKwh !== null ? `${demandKwh} x ${consumer.multiplier}` : 'Required when applicable'}
                valueColor={Colors.primary}
              />
            ) : null}
            <InfoRow label="Read Attempts" value={`${triesUsed}/2`} valueColor={triesExceeded ? Colors.error : undefined} />
            {isPaid ? <InfoRow label="Payment Status" value="Paid - locked" valueColor={Colors.success} bold /> : null}
          </Card.Content>
        </Card>

        {/* Reading Info */}
        <SectionHeader title="Meter Reading" />
        <Card style={styles.infoCard} elevation={1}>
          <Card.Content style={styles.cardContent}>
            <InfoRow
              label="kWh Used"
              value={consumer.kwhUsed !== null ? `${consumer.kwhUsed} kWh` : '—'}
              valueColor={Colors.primary}
              bold
            />
            <InfoRow label="Bill Amount" value={`₱${consumer.billAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} />
            <InfoRow label="Penalty" value={consumer.penalty > 0 ? `₱${consumer.penalty.toFixed(2)}` : '₱0.00'} valueColor={consumer.penalty > 0 ? Colors.error : undefined} />
            <InfoRow
              label="Total Due"
              value={`₱${consumer.totalDue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}
              bold
              large
              valueColor={Colors.primary}
            />
            <InfoRow label="Due Date" value={consumer.dueDate} />
            <InfoRow label="Disconnection Date" value={consumer.disconnectionDate} valueColor={Colors.error} />
          </Card.Content>
        </Card>

        {/* GPS */}
        <SectionHeader title="GPS Location" />
        <Card style={styles.infoCard} elevation={1}>
          <Card.Content style={styles.cardContent}>
            <InfoRow
              label="Latitude"
              value={consumer.gpsLat !== null ? consumer.gpsLat.toFixed(6) : 'No GPS'}
              valueColor={consumer.gpsLat !== null ? Colors.success : Colors.neutral}
            />
            <InfoRow
              label="Longitude"
              value={consumer.gpsLng !== null ? consumer.gpsLng.toFixed(6) : 'No GPS'}
              valueColor={consumer.gpsLng !== null ? Colors.success : Colors.neutral}
            />
          </Card.Content>
        </Card>

        {/* Photo placeholders */}
        <SectionHeader title="Field Photos" />
        <View style={styles.photoRow}>
          <View style={styles.photoPlaceholder}>
            {photos.meter ? (
              <Image source={{ uri: photos.meter.uri }} style={styles.photoPreview} />
            ) : (
              <MaterialCommunityIcons name="counter" size={36} color={Colors.border} />
            )}
            <Text style={styles.photoLabel}>Meter Photo</Text>
            <TouchableOpacity
              style={styles.captureBtn}
              onPress={() => setActivePhotoType('meter')}
            >
              <Text style={styles.captureBtnText}>{photos.meter ? 'Retake' : 'Capture'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.photoPlaceholder}>
            {photos.house ? (
              <Image source={{ uri: photos.house.uri }} style={styles.photoPreview} />
            ) : (
              <MaterialCommunityIcons name="home" size={36} color={Colors.border} />
            )}
            <Text style={styles.photoLabel}>House Photo</Text>
            <TouchableOpacity
              style={styles.captureBtn}
              onPress={() => setActivePhotoType('house')}
            >
              <Text style={styles.captureBtnText}>{photos.house ? 'Retake' : 'Capture'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Enter Reading */}
        <SectionHeader title="Enter Present Reading" />
        <Card style={[styles.infoCard, styles.inputCard]} elevation={2}>
          <Card.Content style={styles.cardContent}>
            <TextInput
              label="Present Reading (kWh)"
              value={presentReading}
              onChangeText={setPresentReading}
              mode="outlined"
              keyboardType="numeric"
              left={<TextInput.Icon icon="counter" />}
              style={styles.readingInput}
              outlineColor={Colors.primary}
              activeOutlineColor={Colors.primaryDark}
              textColor={Colors.textPrimary}
              placeholderTextColor={Colors.textMuted}
              disabled={readingLocked}
            />
            {readingError ? (
              <View style={styles.warningBox}>
                <MaterialCommunityIcons name="alert-circle" size={18} color={Colors.error} />
                <Text style={styles.warningText}>{readingError}</Text>
              </View>
            ) : null}
            {isLargeLoadMode ? (
              <>
                <TextInput
                  label="Demand Reading"
                  value={demandReading}
                  onChangeText={setDemandReading}
                  mode="outlined"
                  keyboardType="numeric"
                  left={<TextInput.Icon icon="factory" />}
                  style={styles.readingInput}
                  outlineColor={Colors.primary}
                  activeOutlineColor={Colors.primaryDark}
                  textColor={Colors.textPrimary}
                  placeholderTextColor={Colors.textMuted}
                  disabled={readingLocked}
                />
                {demandError ? (
                  <View style={styles.warningBox}>
                    <MaterialCommunityIcons name="alert-circle" size={18} color={Colors.error} />
                    <Text style={styles.warningText}>{demandError}</Text>
                  </View>
                ) : null}
              </>
            ) : null}

            {/* Auto compute display */}
            {(saved || hasSavedReading(readingRecord)) && kwhUsed !== null && (
              <View style={styles.computeBox}>
                <View style={styles.computeRow}>
                  <MaterialCommunityIcons name="flash" size={18} color={Colors.warning} />
                  <Text style={styles.computeLabel}> kWh Used:</Text>
                  <Text style={styles.computeValue}>{kwhUsed.toFixed(1)} kWh</Text>
                </View>
                <View style={styles.computeRow}>
                  <MaterialCommunityIcons name="currency-php" size={18} color={Colors.primary} />
                  <Text style={styles.computeLabel}> Est. Bill:</Text>
                  <Text style={[styles.computeValue, styles.computeBill]}>
                    ₱{estimatedBill?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            )}

            <TextInput
              label="Remarks (optional)"
              value={remarks}
              onChangeText={setRemarks}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.remarksInput}
              textColor={Colors.textPrimary}
              placeholderTextColor={Colors.textMuted}
              disabled={readingLocked}
            />
          </Card.Content>
        </Card>

        {/* Action buttons */}
        <View style={styles.actionsSection}>
          <Button
            mode="contained"
            onPress={handleSave}
            icon={saving ? 'progress-clock' : saved ? 'check' : 'content-save'}
            style={styles.saveBtn}
            contentStyle={styles.btnContent}
            labelStyle={styles.btnLabel}
            loading={saving}
            disabled={saving || (kwhUsed === null && !canUseWrapAround) || Boolean(demandError) || readingLocked}
          >
            {saving ? 'Saving...' : saved ? 'Reading Saved' : 'Save Reading'}
          </Button>
          <View style={styles.secondaryBtns}>
            <Button
              mode="outlined"
              onPress={() => router.push(`/(drawer)/payment/${consumer.id}`)}
              icon="cash"
              style={[styles.secondBtn, !canPay && styles.secondBtnDisabled]}
              labelStyle={styles.secondBtnLabel}
              disabled={!canPay}
            >
              Payment
            </Button>
            <Button
              mode="outlined"
              onPress={() => router.push(`/(drawer)/map/${consumer.id}`)}
              icon="map-marker"
              style={styles.secondBtn}
              labelStyle={styles.secondBtnLabel}
            >
              Map
            </Button>
            <Button
              mode="outlined"
              onPress={() => router.push(`/(drawer)/invoice/${consumer.id}` as any)}
              icon="file-document"
              style={styles.secondBtn}
              labelStyle={styles.secondBtnLabel}
            >
              Invoice
            </Button>
          </View>
          <Button
            mode="text"
            onPress={goToNextConsumer}
            icon="skip-next"
            labelStyle={{ color: Colors.primary }}
          >
            Next Consumer
          </Button>
          <Button
            mode="text"
            onPress={goToPreviousConsumer}
            icon="skip-previous"
            labelStyle={{ color: Colors.primary }}
          >
            Previous Consumer
          </Button>
        </View>
      </ScrollView>
      <CameraCaptureModal
        visible={activePhotoType !== null}
        title={activePhotoType === 'house' ? 'House Photo' : 'Meter Photo'}
        onClose={() => setActivePhotoType(null)}
        onCaptured={handlePhotoCaptured}
      />
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
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.white },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  scroll: { flex: 1 },
  infoCard: { margin: 10, marginTop: 0, borderRadius: 12, backgroundColor: Colors.white },
  cardContent: { paddingHorizontal: 14, paddingVertical: 6 },
  inputCard: { borderWidth: 2, borderColor: Colors.primarySurface },
  photoRow: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    gap: 10,
    marginBottom: 0,
  },
  photoPlaceholder: {
    flex: 1,
    height: 110,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  photoPreview: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  photoLabel: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  captureBtn: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  captureBtnText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  readingInput: { marginBottom: 12, backgroundColor: Colors.white, color: Colors.textPrimary, fontSize: 22 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: Colors.errorLight,
    padding: 10,
    marginBottom: 12,
  },
  warningText: { flex: 1, color: Colors.error, fontSize: 13, fontWeight: '700' },
  computeBox: {
    backgroundColor: Colors.primarySurface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  computeRow: { flexDirection: 'row', alignItems: 'center' },
  computeLabel: { flex: 1, fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },
  computeValue: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  computeBill: { color: Colors.primary, fontSize: 18 },
  remarksInput: { backgroundColor: Colors.white, color: Colors.textPrimary },
  actionsSection: { padding: 12, gap: 10, marginBottom: 30 },
  saveBtn: { borderRadius: 10 },
  btnContent: { height: 50 },
  btnLabel: { fontSize: 16, fontWeight: '700' },
  secondaryBtns: { flexDirection: 'row', gap: 8 },
  secondBtn: { flex: 1, borderRadius: 8 },
  secondBtnDisabled: { opacity: 0.45 },
  secondBtnLabel: { fontSize: 12 },
});
