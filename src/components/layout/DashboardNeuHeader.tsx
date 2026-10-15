import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Alert,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@constants/colors';

interface Props {
  onMenuPress?: () => void;
  title?: string;
  notificationCount?: number;
}

export default function DashboardNeuHeader({
  onMenuPress,
  title = 'Dashboard',
  notificationCount = 3,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
      <TouchableOpacity
        onPress={onMenuPress}
        style={styles.iconNeu}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="menu" size={22} color={Colors.primaryDark} />
      </TouchableOpacity>

      <Text style={styles.title}>{title}</Text>

      <View style={styles.right}>
        <TouchableOpacity
          style={styles.iconNeu}
          onPress={() =>
            Alert.alert('SAMELCO II Mobile', 'Field operations dashboard — v1.0')
          }
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="information-outline" size={22} color={Colors.primaryDark} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconNeu}
          onPress={() => Alert.alert('Notifications', 'No critical alerts.')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="bell-outline" size={22} color={Colors.primaryDark} />
          {notificationCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {notificationCount > 9 ? '9+' : String(notificationCount)}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: Colors.neuCanvas,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 88,
    justifyContent: 'flex-end',
  },
  iconNeu: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.neuPlate,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.neuShadowDark,
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
    borderWidth: Platform.OS === 'ios' ? StyleSheet.hairlineWidth : 0,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '900',
  },
});
