import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Card, Divider, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Location from 'expo-location';
import { Colors } from '@constants/colors';
import CameraCaptureModal, { type CapturedPhoto } from '@components/common/CameraCaptureModal';
import { ensureLocationPermission } from '@lib/devicePermissions';
import { getMapConsumerById, listConsumers, updateConsumerGps } from '../../../database/consumerRepository';
import { getActiveReadingMode } from '@lib/session';

export default function MapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useSQLiteContext();
  const [consumer, setConsumer] = useState<any | null>(null);
  const [mapConsumers, setMapConsumers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cameraVisible, setCameraVisible] = useState(false);
  const [sitePhoto, setSitePhoto] = useState<CapturedPhoto | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const activeMode = getActiveReadingMode();
    const load =
      id === 'all'
        ? listConsumers(db, { limit: 10000, mode: activeMode }).then((rows: any[]) => {
            const withGps = rows.filter((row) => row.gpsLat !== null && row.gpsLng !== null);
            if (alive) {
              setMapConsumers(withGps);
              setConsumer(null);
            }
          })
        : getMapConsumerById(db, id, { mode: activeMode }).then((row: any) => {
            if (alive) {
              setConsumer(row);
              setMapConsumers([]);
            }
          });

    load
      .catch(() => {
        if (alive) {
          setConsumer(null);
          setMapConsumers([]);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db, id]);

  const updateGpsPressed = () => {
    if (!canCaptureGps) {
      Alert.alert('Save Reading First', 'Please save the reading before capturing GPS in map view.');
      return;
    }
    Alert.alert(
      'Update GPS',
      'Save current phone GPS as the meter location for this consumer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: async () => {
            const allowed = await ensureLocationPermission();
            if (!allowed) return;
            const position = await Location.getCurrentPositionAsync({});
            await updateConsumerGps(db, id, position.coords.latitude, position.coords.longitude, {
              mode: getActiveReadingMode(),
            });
            setConsumer({
              ...consumer,
              gpsLat: position.coords.latitude,
              gpsLng: position.coords.longitude,
            });
            Alert.alert(
              'GPS Captured',
              `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}\n\nSaved locally and queued for sync.`
            );
          },
        },
      ]
    );
  };

  const renderHeader = (title = 'Map View', coords?: string) => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      {coords ? (
        <View style={styles.headerCoords}>
          <Text style={styles.coordText}>{coords}</Text>
        </View>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.noGpsContainer}>
        {renderHeader('Map View')}
        <View style={styles.noGpsBody}>
          <MaterialCommunityIcons name="map-search" size={76} color={Colors.primary} />
          <Text style={styles.noGpsTitle}>Loading Map</Text>
          <Text style={styles.noGpsText}>Checking GPS records from the active SQLite database.</Text>
        </View>
      </View>
    );
  }

  if (id === 'all') {
    return (
      <View style={styles.container}>
        {renderHeader('GPS Map')}
        <View style={styles.mapPlaceholder}>
          <View style={styles.mapBase}>
            {Array.from({ length: 96 }).map((_, i) => (
              <View key={i} style={styles.mapCell} />
            ))}
            <View style={[styles.roadLine, styles.roadLineA]} />
            <View style={[styles.roadLine, styles.roadLineB]} />
            <View style={[styles.roadLine, styles.roadLineC]} />
          </View>
          {mapConsumers.slice(0, 24).map((row, index) => (
            <View
              key={`${row.id}-${index}`}
              style={[
                styles.smallMapPin,
                {
                  left: `${12 + ((index * 23) % 76)}%`,
                  top: `${16 + ((index * 17) % 62)}%`,
                },
              ]}
            />
          ))}
          <View style={styles.mapOverlay}>
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.legendText}>{mapConsumers.length} GPS records</Text>
              </View>
            </View>
          </View>
        </View>
        <Card style={styles.bottomPanel} elevation={4}>
          <Card.Content>
            <Text style={styles.consumerName}>Consumers with GPS</Text>
            <Text style={styles.consumerAddress}>Tap a row to open the consumer map details.</Text>
            <Divider style={styles.divider} />
            <ScrollView style={styles.gpsList}>
              {mapConsumers.length === 0 ? (
                <Text style={styles.noGpsText}>No saved GPS coordinates found.</Text>
              ) : (
                mapConsumers.slice(0, 100).map((row) => (
                  <TouchableOpacity
                    key={row.id}
                    style={styles.gpsListRow}
                    onPress={() => router.replace(`/(drawer)/map/${row.id}`)}
                  >
                    <MaterialCommunityIcons name="map-marker" size={18} color={Colors.primary} />
                    <View style={styles.gpsListText}>
                      <Text style={styles.consumerName} numberOfLines={1}>{row.name}</Text>
                      <Text style={styles.consumerAddress} numberOfLines={1}>
                        {row.accountNumber} • {row.gpsLat?.toFixed(6)}, {row.gpsLng?.toFixed(6)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </Card.Content>
        </Card>
      </View>
    );
  }

  if (!consumer) {
    return (
      <View style={styles.noGpsContainer}>
        {renderHeader('Map View')}
        <View style={styles.noGpsBody}>
          <MaterialCommunityIcons name="database-search" size={80} color={Colors.border} />
          <Text style={styles.noGpsTitle}>Account not found</Text>
          <Text style={styles.noGpsText}>This record was not found in the active SQLite database.</Text>
        </View>
      </View>
    );
  }

  const hasGPS = consumer.gpsLat !== null && consumer.gpsLng !== null;
  const canCaptureGps =
    getActiveReadingMode() !== 'reading' ||
    Boolean(consumer.canCaptureGps) ||
    consumer.status === 'read' ||
    consumer.status === 'paid';

  const openDirections = () => {
    const lat = consumer.gpsLat;
    const lng = consumer.gpsLng;
    if (lat == null || lng == null) {
      Alert.alert('Navigation', 'No GPS coordinates for this account.');
      return;
    }
    const dest = `${lat},${lng}`;
    const url =
      Platform.OS === 'ios'
        ? `maps://app?daddr=${dest}&dirflg=d`
        : `google.navigation:q=${dest}`;
    Linking.canOpenURL(url)
      .then((ok) =>
        ok ? Linking.openURL(url) : Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`)
      )
      .catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`));
  };

  if (!hasGPS) {
    return (
      <View style={styles.noGpsContainer}>
        {renderHeader('Map View')}
        <View style={styles.noGpsBody}>
          <MaterialCommunityIcons name="map-marker-off" size={80} color={Colors.border} />
          <Text style={styles.noGpsTitle}>No GPS Found</Text>
          <Text style={styles.noGpsSubtitle}>{consumer.name}</Text>
          <Text style={styles.noGpsText}>No GPS coordinates recorded for this consumer.</Text>
          <Button
            mode="contained"
            icon="crosshairs-gps"
            onPress={updateGpsPressed}
            style={styles.captureGpsBtn}
            contentStyle={styles.captureGpsBtnContent}
            disabled={!canCaptureGps}
          >
            {canCaptureGps ? 'Capture GPS Now' : 'Save Reading First'}
          </Button>
        </View>
        <CameraCaptureModal
          visible={cameraVisible}
          title="Site Photo"
          onClose={() => setCameraVisible(false)}
          onCaptured={setSitePhoto}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader('Map View', `${consumer.gpsLat?.toFixed(5)}, ${consumer.gpsLng?.toFixed(5)}`)}

      {/* Map placeholder */}
      <View style={styles.mapPlaceholder}>
        <View style={styles.mapBase}>
          {Array.from({ length: 96 }).map((_, i) => (
            <View key={i} style={styles.mapCell} />
          ))}
          <View style={[styles.roadLine, styles.roadLineA]} />
          <View style={[styles.roadLine, styles.roadLineB]} />
          <View style={[styles.roadLine, styles.roadLineC]} />
        </View>
        {/* Meter marker */}
        <View style={[styles.marker, styles.meterMarker]}>
          <MaterialCommunityIcons name="counter" size={20} color={Colors.white} />
        </View>
        {/* User location */}
        <View style={[styles.marker, styles.userMarker]}>
          <MaterialCommunityIcons name="account" size={16} color={Colors.white} />
        </View>
        {/* Labels */}
        <View style={styles.mapOverlay}>
          <View style={styles.mapLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.legendText}>Meter Location</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
              <Text style={styles.legendText}>Your Location</Text>
            </View>
          </View>
          <View style={styles.distanceBadge}>
            <MaterialCommunityIcons name="map-marker-distance" size={16} color={Colors.white} />
            <Text style={styles.distanceText}>~48m away</Text>
          </View>
        </View>
        <Text style={styles.mapPlaceholderText}>react-native-maps</Text>
        <Text style={styles.mapPlaceholderSub}>Map renders here in production</Text>
      </View>

      {/* Bottom panel */}
      <Card style={styles.bottomPanel} elevation={4}>
        <Card.Content>
          <View style={styles.consumerRow}>
            <View style={styles.consumerInfo}>
              <Text style={styles.consumerAccount}>{consumer.accountNumber}</Text>
              <Text style={styles.consumerName}>{consumer.name}</Text>
              <Text style={styles.consumerAddress}>{consumer.address}</Text>
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.serialLabel}>Serial</Text>
              <Text style={styles.serialValue}>{consumer.serialNumber}</Text>
            </View>
          </View>
          <Divider style={styles.divider} />
          <View style={styles.coordsRow}>
            <MaterialCommunityIcons name="crosshairs-gps" size={14} color={Colors.primary} />
            <Text style={styles.coordsText}>
              {consumer.gpsLat?.toFixed(6)}, {consumer.gpsLng?.toFixed(6)}
            </Text>
          </View>
          {sitePhoto ? (
            <View style={styles.photoPreviewRow}>
              <Image source={{ uri: sitePhoto.uri }} style={styles.photoPreview} />
              <Text style={styles.photoPreviewText}>Site photo captured for this location.</Text>
            </View>
          ) : null}
          <View style={styles.mapActions}>
            <Button
              mode="contained"
              icon="navigation"
              style={styles.mapActionBtn}
              contentStyle={styles.mapActionContent}
              onPress={openDirections}
            >
              Navigate
            </Button>
            <Button
              mode="outlined"
              icon="crosshairs-gps"
              style={styles.mapActionBtn}
              contentStyle={styles.mapActionContent}
              onPress={updateGpsPressed}
              disabled={!canCaptureGps}
            >
              {canCaptureGps ? 'Update GPS' : 'Save Reading First'}
            </Button>
          </View>
          <View style={styles.mapActionsRow2}>
            <Button mode="text" icon="alert-circle" onPress={() => router.push(`/(drawer)/complaint/${consumer.id}`)} compact>Report Problem</Button>
            <Button mode="text" icon="camera" onPress={() => setCameraVisible(true)} compact>
              {sitePhoto ? 'Retake' : 'Capture'}
            </Button>
          </View>
        </Card.Content>
      </Card>
      <CameraCaptureModal
        visible={cameraVisible}
        title="Site Photo"
        onClose={() => setCameraVisible(false)}
        onCaptured={setSitePhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  noGpsContainer: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  noGpsHeader: {
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
  headerCoords: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coordText: { fontSize: 10, color: Colors.white, fontWeight: '600' },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#FFF5F5',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mapBase: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mapCell: {
    width: '10%',
    aspectRatio: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(21,101,192,0.08)',
    backgroundColor: 'transparent',
  },
  roadLine: {
    position: 'absolute',
    height: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(211,47,47,0.12)',
  },
  roadLineA: {
    left: '-10%',
    right: '-10%',
    top: '32%',
    transform: [{ rotate: '-14deg' }],
  },
  roadLineB: {
    left: '6%',
    right: '8%',
    top: '58%',
    transform: [{ rotate: '11deg' }],
  },
  roadLineC: {
    left: '45%',
    width: 22,
    top: '-5%',
    bottom: '-5%',
    height: undefined,
    transform: [{ rotate: '6deg' }],
  },
  smallMapPin: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.white,
    elevation: 3,
  },
  marker: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  meterMarker: { backgroundColor: Colors.primary, top: '40%', left: '50%' },
  userMarker: { backgroundColor: Colors.success, top: '55%', left: '45%' },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mapLegend: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 8,
    gap: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: Colors.textPrimary, fontWeight: '500' },
  distanceBadge: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: { fontSize: 12, color: Colors.white, fontWeight: '700' },
  mapPlaceholderText: { fontSize: 14, color: Colors.textMuted, fontWeight: '600' },
  mapPlaceholderSub: { fontSize: 11, color: Colors.textMuted },
  bottomPanel: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 8 },
  consumerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  consumerInfo: { flex: 1 },
  consumerAccount: { fontSize: 10, color: Colors.textMuted, letterSpacing: 0.5 },
  consumerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  consumerAddress: { fontSize: 12, color: Colors.textSecondary },
  statusInfo: { alignItems: 'flex-end' },
  serialLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  serialValue: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  divider: { marginVertical: 10, backgroundColor: Colors.divider },
  coordsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  coordsText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    backgroundColor: Colors.primarySurface,
    padding: 8,
    marginBottom: 10,
  },
  photoPreview: { width: 54, height: 54, borderRadius: 8, backgroundColor: Colors.border },
  photoPreviewText: { flex: 1, fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  mapActions: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  mapActionBtn: { flex: 1, borderRadius: 8 },
  mapActionContent: { height: 44 },
  mapActionsRow2: { flexDirection: 'row', justifyContent: 'space-around' },
  gpsList: { maxHeight: 230 },
  gpsListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  gpsListText: { flex: 1 },
  noGpsBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  noGpsTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  noGpsSubtitle: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  noGpsText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  captureGpsBtn: { marginTop: 8, borderRadius: 10 },
  captureGpsBtnContent: { height: 50 },
});
