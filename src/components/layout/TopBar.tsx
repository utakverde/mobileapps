import React, { useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@constants/colors';
import { getReadingAssignment } from '../../../database/consumerRepository';
import { getActiveReadingMode } from '@lib/session';

interface TopBarProps {
  onMenuPress?: () => void;
  onSearchPress?: () => void;
  btConnected?: boolean;
  gpsActive?: boolean;
  batteryLevel?: number;
}

export default function TopBar({
  onMenuPress,
  onSearchPress,
  btConnected = false,
  gpsActive = true,
  batteryLevel = 78,
}: TopBarProps) {
  const router = useRouter();
  const db = useSQLiteContext();
  const [assignment, setAssignment] = useState({
    areaName: 'SQLite Assignment',
    bookNumber: '',
    billMonth: '',
  });
  const goSearch = onSearchPress ?? (() => router.push('/(drawer)/search'));

  useEffect(() => {
    let alive = true;
    getReadingAssignment(db, { mode: getActiveReadingMode() })
      .then((value: any) => {
        if (alive) setAssignment(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [db]);

  const batteryIcon =
    batteryLevel > 80
      ? 'battery'
      : batteryLevel > 50
      ? 'battery-60'
      : batteryLevel > 20
      ? 'battery-30'
      : 'battery-alert';
  const batteryColor = batteryLevel > 30 ? Colors.success : Colors.error;

  return (
    <View style={styles.container}>
      {/* Left: Menu + Area/Book info */}
      <View style={styles.left}>
        <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialCommunityIcons name="menu" size={26} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.areaInfo}>
          <Text style={styles.areaName} numberOfLines={1}>
            {assignment.areaName}
          </Text>
          <Text style={styles.areaMeta}>
            Book {assignment.bookNumber || 'N/A'}  •  {assignment.billMonth || 'N/A'}
          </Text>
        </View>
      </View>

      {/* Right: Status indicators */}
      <View style={styles.right}>
        {/* Bluetooth */}
        <View style={styles.statusItem}>
          <MaterialCommunityIcons
            name={btConnected ? 'bluetooth-connect' : 'bluetooth-off'}
            size={18}
            color={btConnected ? '#FFCDD2' : Colors.drawerTextMuted}
          />
        </View>
        {/* GPS */}
        <View style={styles.statusItem}>
          <MaterialCommunityIcons
            name={gpsActive ? 'crosshairs-gps' : 'crosshairs-off'}
            size={18}
            color={gpsActive ? '#A5D6A7' : Colors.drawerTextMuted}
          />
        </View>
        {/* Battery */}
        <View style={styles.statusItem}>
          <MaterialCommunityIcons name={batteryIcon} size={20} color={batteryColor} />
          <Text style={[styles.battText, { color: batteryColor }]}>{batteryLevel}%</Text>
        </View>
        {/* Search */}
        <TouchableOpacity onPress={goSearch} style={styles.searchBtn} hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}>
          <MaterialCommunityIcons name="magnify" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    elevation: 4,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuBtn: {
    marginRight: 10,
  },
  areaInfo: {
    flex: 1,
  },
  areaName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
    lineHeight: 18,
  },
  areaMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.92)',
    fontWeight: '600',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 3,
  },
  battText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 1,
  },
  searchBtn: {
    marginLeft: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 5,
  },
});
