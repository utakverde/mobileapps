import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Card, Text, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@constants/colors';
import type { Consumer } from '@constants/types';
import { hasPayableBill } from '@lib/billing';
import StatusBadge from './StatusBadge';

interface ConsumerCardProps {
  consumer: Consumer;
  showActions?: boolean;
}

const CARD_BORDER: Record<string, string> = {
  paid:         Colors.success,
  read:         Colors.warning,
  unread:       Colors.border,
  disconnected: Colors.error,
  problem:      '#F9A825',
};

function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export default function ConsumerCard({ consumer, showActions = true }: ConsumerCardProps) {
  const router = useRouter();
  const borderColor = CARD_BORDER[consumer.status] ?? Colors.border;
  const canPay = hasPayableBill({
    billAmount: consumer.billAmount,
    arrearsTotal: (consumer as any).arrearsTotal,
    totalDue: consumer.totalDue,
    status: consumer.status,
  });

  const goToReading = () => router.push(`/(drawer)/reading/${consumer.id}`);
  const goToPayment = () => router.push(`/(drawer)/payment/${consumer.id}`);
  const goToMap = () => router.push(`/(drawer)/map/${consumer.id}`);
  const goToAudit = () => router.push(`/(drawer)/utility-bill-audit/${consumer.id}` as any);

  return (
    <Card
      style={[styles.card, { borderLeftColor: borderColor }]}
      elevation={2}
      onPress={goToReading}
    >
      <Card.Content style={styles.content}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.seqBadge}>
            <Text style={styles.seqText}>{consumer.sequenceNumber}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.accountNo}>{consumer.accountNumber}</Text>
            <Text style={styles.name} numberOfLines={1}>{consumer.name}</Text>
            <Text style={styles.address} numberOfLines={1}>{consumer.address}</Text>
          </View>
          <StatusBadge status={consumer.status} size="small" />
        </View>

        <Divider style={styles.divider} />

        {/* Meter info grid */}
        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>METER NO.</Text>
            <Text style={styles.gridValue}>{consumer.meterNumber}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>RATE</Text>
            <Text style={styles.gridValue}>{consumer.rateCode}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>CURR. RDG</Text>
            <Text style={[styles.gridValue, consumer.currentReading === null && styles.unread]}>
              {consumer.currentReading ?? 'Not Read'}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>kWh USED</Text>
            <Text style={styles.gridValue}>{consumer.kwhUsed ?? '—'}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>TOTAL BILL</Text>
            <Text style={[styles.gridValue, styles.billAmount]}>
              {formatCurrency(consumer.totalDue)}
            </Text>
          </View>
        </View>

        {/* Due date row */}
        <View style={styles.dueRow}>
          <MaterialCommunityIcons name="calendar-clock" size={13} color={Colors.textMuted} />
          <Text style={styles.dueText}> Due: {consumer.dueDate}</Text>
          {consumer.gpsLat !== null && (
            <View style={styles.gpsTag}>
              <MaterialCommunityIcons name="map-marker-check" size={12} color={Colors.success} />
              <Text style={styles.gpsTagText}> GPS</Text>
            </View>
          )}
        </View>

        {showActions && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionBtn, styles.readingBtn]} onPress={goToReading}>
                <MaterialCommunityIcons name="counter" size={16} color={Colors.white} />
                <Text style={styles.actionBtnText}>Reading</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.payBtn, !canPay && styles.actionBtnDisabled]}
                onPress={canPay ? goToPayment : undefined}
                disabled={!canPay}
              >
                <MaterialCommunityIcons name="cash" size={16} color={Colors.white} />
                <Text style={styles.actionBtnText}>Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.mapBtn]} onPress={goToMap}>
                <MaterialCommunityIcons name="map-marker" size={16} color={Colors.white} />
                <Text style={styles.actionBtnText}>Map</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.auditBtn]} onPress={goToAudit}>
                <MaterialCommunityIcons name="clipboard-check" size={16} color={Colors.white} />
                <Text style={styles.actionBtnText}>Audit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.moreBtn]}
                onPress={() => router.push(`/(drawer)/complaint/${consumer.id}`)}
              >
                <MaterialCommunityIcons name="dots-horizontal" size={16} color={Colors.primary} />
                <Text style={[styles.actionBtnText, { color: Colors.primary }]}>More</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 5,
    borderRadius: 12,
    borderLeftWidth: 5,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  seqBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  seqText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  headerInfo: {
    flex: 1,
    marginRight: 6,
  },
  accountNo: {
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  address: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  divider: {
    marginVertical: 8,
    backgroundColor: Colors.divider,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  gridItem: {
    width: '33.33%',
    paddingHorizontal: 4,
    paddingVertical: 3,
  },
  gridLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: Colors.textMuted,
  },
  gridValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  unread: {
    color: Colors.neutral,
    fontStyle: 'italic',
  },
  billAmount: {
    color: Colors.primary,
    fontWeight: '800',
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  dueText: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
  },
  gpsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  gpsTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  readingBtn: {
    backgroundColor: Colors.primary,
  },
  payBtn: {
    backgroundColor: Colors.success,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  mapBtn: {
    backgroundColor: Colors.warning,
  },
  auditBtn: {
    backgroundColor: '#5E35B1',
  },
  moreBtn: {
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
});
