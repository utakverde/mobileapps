import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Colors } from '@constants/colors';
import type { ReadingMode } from '@constants/types';
import { getReadingAssignment } from '../../../database/consumerRepository';
import { getActiveCollectorName, getActiveReadingMode } from '@lib/session';

interface DrawerItem {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  route: string;
  badge?: number;
  modes?: ReadingMode[];
}

const DRAWER_ITEMS: DrawerItem[] = [
  { label: 'Dashboard', icon: 'view-dashboard', route: '/(drawer)/dashboard' },
  { label: 'Utility Hub', icon: 'view-grid-plus', route: '/(drawer)/utility-hub' },
  { label: 'Consumers', icon: 'account-group', route: '/(drawer)/utility-consumer-management' },
  { label: 'New Connection', icon: 'account-plus', route: '/(drawer)/utility-new-connection' },
  { label: 'Rates & Schedules', icon: 'cash-lock', route: '/(drawer)/utility-rates-schedules' },
  { label: 'Meter Reading', icon: 'gauge', route: '/(drawer)/utility-meter-reading' },
  { label: 'Bill Creation', icon: 'file-document-edit', route: '/(drawer)/utility-bill-creation' },
  { label: 'Bill Adjustment', icon: 'file-document-edit-outline', route: '/(drawer)/utility-bill-adjustment' },
  { label: 'Utility Operations', icon: 'view-dashboard-edit', route: '/(drawer)/utility-operations' },
  { label: 'Consumer Bills', icon: 'account-cash', route: '/(drawer)/utility-consumers' },
  { label: 'Bill Correction', icon: 'file-document-edit', route: '/(drawer)/utility-bill-correction/first' },
  { label: 'Collections', icon: 'cash-multiple', route: '/(drawer)/utility-collections' },
  { label: 'Complaints', icon: 'alert-circle', route: '/(drawer)/utility-complaints' },
  { label: 'Service Status', icon: 'flash-off', route: '/(drawer)/utility-service-status' },
  { label: 'Financial Analysis', icon: 'chart-line', route: '/(drawer)/utility-financial-analysis' },
  { label: 'System Map', icon: 'map-marker-radius', route: '/(drawer)/utility-system-map' },
  { label: 'Accounting', icon: 'calculator', route: '/(drawer)/utility-accounting-integration' },
  { label: 'Reconciliation', icon: 'scale-balance', route: '/(drawer)/utility-reconciliation' },
  { label: 'Reconnection', icon: 'restore', route: '/(drawer)/utility-reconnection' },
  { label: 'Lifeline/Senior', icon: 'hand-heart', route: '/(drawer)/utility-lifeline-senior' },
  { label: 'Net Metering', icon: 'solar-power', route: '/(drawer)/utility-net-metering', modes: ['net_metering'] },
  { label: 'Audit Trail', icon: 'clipboard-text-clock', route: '/(drawer)/utility-audit-trail' },
  { label: 'Reports', icon: 'chart-bar', route: '/(drawer)/reports' },
  { label: 'Search', icon: 'magnify', route: '/(drawer)/search' },
  { label: 'Net Metering', icon: 'solar-power', route: '/(drawer)/net-metering/first', modes: ['net_metering'] },
  { label: 'GPS Map', icon: 'map-marker-radius', route: '/(drawer)/map/all' },
  { label: 'Complaints', icon: 'alert-circle', route: '/(drawer)/complaint/new', badge: 2 },
  { label: 'Disconnection', icon: 'flash-off', route: '/(drawer)/disconnection', modes: ['disconnection'] },
  { label: 'Bluetooth Printer', icon: 'printer-wireless', route: '/(drawer)/bluetooth' },
];

const SYSTEM_ITEMS: DrawerItem[] = [
  { label: 'Import/Export SQLite', icon: 'database-import', route: '/(drawer)/sqlite' },
  { label: 'Online Sync', icon: 'cloud-sync', route: '/(drawer)/sync', badge: 6 },
  { label: 'SMS Center', icon: 'message-text', route: '/(drawer)/sms' },
  { label: 'Settings', icon: 'cog', route: '/(drawer)/settings' },
];

export default function DrawerContent() {
  const router = useRouter();
  const pathname = usePathname();
  const db = useSQLiteContext();
  const activeMode = getActiveReadingMode();
  const [assignment, setAssignment] = useState({
    readerName: getActiveCollectorName() || 'Field Reader',
    areaName: 'SQLite Assignment',
    bookNumber: '',
    billMonth: '',
  });

  useEffect(() => {
    let alive = true;
    getReadingAssignment(db, { mode: activeMode })
      .then((value: any) => {
        if (alive) {
          setAssignment({
            ...value,
            readerName: getActiveCollectorName() || value.readerName,
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [activeMode, db]);

  const navigate = (route: string) => {
    router.push(route as any);
  };

  const logout = () => {
    router.replace('/login');
  };

  const isActive = (route: string) => pathname.includes(route.replace('/(drawer)/', ''));

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <MaterialCommunityIcons name="lightning-bolt" size={32} color={Colors.white} />
        </View>
        <Text style={styles.appName}>SAMELCO II Mobile</Text>
        <Text style={styles.coopName}>Samar Electric Cooperative II</Text>
        <Divider style={styles.headerDivider} />
        <View style={styles.readerInfo}>
          <MaterialCommunityIcons name="account-circle" size={16} color={Colors.drawerTextMuted} />
          <Text style={styles.readerName}> {assignment.readerName}</Text>
        </View>
        <View style={styles.areaRow}>
          <Text style={styles.areaTag}>{assignment.areaName}</Text>
          <Text style={styles.areaTag}>Book {assignment.bookNumber || 'N/A'}</Text>
          <Text style={styles.areaTag}>{assignment.billMonth || 'N/A'}</Text>
        </View>
      </View>

      <ScrollView style={styles.menu} showsVerticalScrollIndicator={false}>
        {/* Main menu */}
        {DRAWER_ITEMS.filter((item) => !item.modes || item.modes.includes(activeMode)).map((item) => {
          const active = isActive(item.route);
          return (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, active && styles.menuItemActive]}
              onPress={() => navigate(item.route)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={22}
                color={active ? Colors.white : 'rgba(255,255,255,0.78)'}
              />
              <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>{item.label}</Text>
              {item.badge !== undefined && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <Divider style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>SYSTEM</Text>

        {SYSTEM_ITEMS.map((item) => {
          const active = isActive(item.route);
          return (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, active && styles.menuItemActive]}
              onPress={() => navigate(item.route)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={22}
                color={active ? Colors.white : 'rgba(255,255,255,0.78)'}
              />
              <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>{item.label}</Text>
              {item.badge !== undefined && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <Divider style={styles.sectionDivider} />

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <MaterialCommunityIcons name="logout" size={22} color={Colors.errorLight} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.statusDot} />
        <Text style={styles.footerText}>Offline – SQLite Connected</Text>
        <Text style={styles.footerVersion}>v1.0.7</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.drawerBackground,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  logoWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  coopName: {
    fontSize: 12,
    color: Colors.drawerTextMuted,
    marginTop: 2,
    lineHeight: 17,
  },
  headerDivider: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 12,
  },
  readerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  readerName: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: '600',
  },
  areaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  areaTag: {
    fontSize: 10,
    color: Colors.drawerTextMuted,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  menu: {
    flex: 1,
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 0,
    gap: 14,
  },
  menuItemActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRightWidth: 3,
    borderRightColor: Colors.white,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '500',
  },
  menuLabelActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 10,
    color: Colors.white,
    fontWeight: '800',
  },
  sectionDivider: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 8,
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.65)',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
    marginBottom: 8,
  },
  logoutText: {
    fontSize: 14,
    color: Colors.errorLight,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  footerVersion: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
});
