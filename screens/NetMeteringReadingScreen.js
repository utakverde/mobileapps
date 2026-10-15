import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '../src/constants/colors';
import { computeAndSaveNetMeteringInvoice, getReadingRecord } from '../database/invoiceRepository';
import { computeNetMetering } from '../services/netMeteringCalculator';

function numberText(value) {
  return value == null ? '' : String(value);
}

export default function NetMeteringReadingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const db = useSQLiteContext();
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({
    importPrevious: '',
    importPresent: '',
    exportPrevious: '',
    exportPresent: '',
    importMultiplier: '1',
    exportMultiplier: '1',
    previousMonthCredit: '',
  });

  useEffect(() => {
    let alive = true;
    getReadingRecord(db, id)
      .then((row) => {
        if (!alive || !row) return;
        setRecord(row);
        setForm({
          importPrevious: numberText(row.Import_Previous ?? row.Reading_KWH_Prev),
          importPresent: numberText(row.Import_Present ?? row.Reading_KWH),
          exportPrevious: numberText(row.Export_Previous ?? 0),
          exportPresent: numberText(row.Export_Present ?? 0),
          importMultiplier: numberText(row.Import_Multiplier ?? row.Multiplier ?? 1),
          exportMultiplier: numberText(row.Export_Multiplier ?? row.Multiplier ?? 1),
          previousMonthCredit: numberText(row.net_metering_previous_credit ?? row.PreviousMonthCredit ?? 0),
        });
      })
      .catch((error) => Alert.alert('Net metering', error instanceof Error ? error.message : 'Could not load record.'));
    return () => {
      alive = false;
    };
  }, [db, id]);

  const net = computeNetMetering(form);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    try {
      await computeAndSaveNetMeteringInvoice(db, id, form, { allowAdminOverride: true });
      router.replace(`/(drawer)/invoice/${id}`);
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save net metering invoice.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Net Metering Reading</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.account}>{record?.AccountNumber || id}</Text>
            <Text style={styles.name}>{record?.Name || 'Local SQLite reading record'}</Text>
            <Text style={styles.address}>{record?.Address || ''}</Text>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.section}>Import Register</Text>
            <TextInput label="Import Previous Reading" value={form.importPrevious} onChangeText={(v) => update('importPrevious', v)} mode="outlined" keyboardType="numeric" style={styles.input} />
            <TextInput label="Import Present Reading" value={form.importPresent} onChangeText={(v) => update('importPresent', v)} mode="outlined" keyboardType="numeric" style={styles.input} />
            <TextInput label="Import Multiplier" value={form.importMultiplier} onChangeText={(v) => update('importMultiplier', v)} mode="outlined" keyboardType="numeric" style={styles.input} />

            <Text style={styles.section}>Export Register</Text>
            <TextInput label="Export Previous Reading" value={form.exportPrevious} onChangeText={(v) => update('exportPrevious', v)} mode="outlined" keyboardType="numeric" style={styles.input} />
            <TextInput label="Export Present Reading" value={form.exportPresent} onChangeText={(v) => update('exportPresent', v)} mode="outlined" keyboardType="numeric" style={styles.input} />
            <TextInput label="Export Multiplier" value={form.exportMultiplier} onChangeText={(v) => update('exportMultiplier', v)} mode="outlined" keyboardType="numeric" style={styles.input} />

            <Text style={styles.section}>Net Metering Credit</Text>
            <TextInput label="Previous Month Credit" value={form.previousMonthCredit} onChangeText={(v) => update('previousMonthCredit', v)} mode="outlined" keyboardType="numeric" style={styles.input} />
          </Card.Content>
        </Card>

        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Import kWh</Text>
              <Text style={styles.summaryValue}>{net.importKwh}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Export kWh</Text>
              <Text style={styles.summaryValue}>{net.exportKwh}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Net kWh</Text>
              <Text style={[styles.summaryValue, net.netKwh < 0 && styles.credit]}>{net.netKwh}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Previous Credit</Text>
              <Text style={[styles.summaryValue, net.previousMonthCredit < 0 && styles.credit]}>{net.previousMonthCredit}</Text>
            </View>
            {net.exportKwh > 0 ? <Text style={styles.creditText}>Outgoing kWh will be applied as a generation credit.</Text> : null}
          </Card.Content>
        </Card>

        <Button mode="contained" icon="content-save" onPress={save} style={styles.saveBtn} contentStyle={styles.saveContent}>
          Save Net Metering Invoice
        </Button>
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
  content: { padding: 12, paddingBottom: 30 },
  card: { backgroundColor: Colors.white, borderRadius: 12, marginBottom: 10 },
  summaryCard: { backgroundColor: Colors.primarySurface, borderRadius: 12, marginBottom: 12 },
  account: { fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  name: { fontSize: 17, color: Colors.textPrimary, fontWeight: '800', marginTop: 2 },
  address: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  section: { fontSize: 12, fontWeight: '900', color: Colors.primaryDark, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: Colors.white, marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: '700' },
  summaryValue: { fontSize: 16, color: Colors.primary, fontWeight: '900' },
  credit: { color: Colors.error },
  creditText: { fontSize: 12, color: Colors.error, marginTop: 8 },
  saveBtn: { borderRadius: 10 },
  saveContent: { height: 50 },
});
