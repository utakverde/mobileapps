import React, { useEffect, useState, useRef } from 'react';
import {
  Alert,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Divider,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@constants/colors';
import type { ReadingMode } from '@constants/types';
import { loginUser } from '@lib/auth';
import { setActiveSession } from '@lib/session';
import { clearRememberedLogin, getRememberedLogin, saveLoginOrNumber, saveRememberedLogin } from '../database/configRepository';

const APP_ICON = require('../assets/icon.png');

export default function LoginScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [orNumber, setOrNumber] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberUser, setRememberUser] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'offline' | 'online'>('offline');
  const [readingMode, setReadingMode] = useState<ReadingMode>('reading');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const logoLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await getRememberedLogin(db);
        if (!alive || !saved.remember) return;
        setRememberUser(true);
        if (saved.username) setUsername(saved.username);
        if (saved.password) setPassword(saved.password);
      } catch {
        // Ignore stale config rows and keep the login form usable.
      }
    })();

    return () => {
      alive = false;
    };
  }, [db]);

  const shakeCard = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    const u = username.trim();
    const p = password.trim();
    const or = orNumber.trim();
    if (!u || !p || !or) {
      shakeCard();
      Alert.alert('Required fields', 'Enter username, password, and OR number before logging in.');
      return;
    }

    setLoading(true);
    const result = await loginUser({ username: u, password: p, mode: connectionMode, db });
    if (!result.ok) {
      setLoading(false);
      shakeCard();
      Alert.alert('Login failed', result.message);
      return;
    }
    setLoading(false);
    try {
      await saveLoginOrNumber(db, or);
    } catch {
      // Keep login usable even if the production config table has an unexpected shape.
    }
    try {
      if (rememberUser) {
        await saveRememberedLogin(db, {
          remember: true,
          username: u,
          password: p,
        });
      } else {
        await clearRememberedLogin(db);
      }
    } catch {
      // Remember-user is best effort so login still completes.
    }
    setActiveSession({
      readingMode,
      collectorName: result.displayName,
      collectorId: result.collectorId,
      username: result.username || u,
      orNumber: or,
    });
    router.replace('/(drawer)/dashboard');
  };

  const handleLogoPressIn = () => {
    logoLongPressTimer.current = setTimeout(() => {
      setShowAdminPanel(true);
    }, 2000);
  };

  const handleLogoPressOut = () => {
    if (logoLongPressTimer.current) {
      clearTimeout(logoLongPressTimer.current);
    }
  };

  const ADMIN_ACTIONS = [
    { icon: 'database-import', label: 'Import SQLite', color: Colors.primary },
    { icon: 'database-export', label: 'Export SQLite', color: Colors.primary },
    { icon: 'cloud-download', label: 'Download SQLite', color: Colors.success },
    { icon: 'cloud-upload', label: 'Upload SQLite', color: Colors.success },
    { icon: 'sync', label: 'Sync Database', color: Colors.warning },
    { icon: 'database-remove', label: 'Reset Local Database', color: Colors.error },
    { icon: 'server-network', label: 'Change Server', color: Colors.neutral },
    { icon: 'developer-board', label: 'Developer Mode', color: Colors.neutral },
  ] as const;

  const handleAdminAction = (label: string) => {
    setShowAdminPanel(false);
    setTimeout(() => {
      switch (label) {
        case 'Import SQLite':
        case 'Export SQLite':
        case 'Download SQLite':
        case 'Upload SQLite':
        case 'Reset Local Database':
          router.push('/(drawer)/sqlite');
          break;
        case 'Sync Database':
          router.push('/(drawer)/sync');
          break;
        case 'Change Server':
          Alert.alert(
            'Server URL',
            'Update API endpoint when backend is available. Opening Settings.',
            [{ text: 'OK', onPress: () => router.push('/(drawer)/settings') }]
          );
          break;
        case 'Developer Mode':
          Alert.alert('Developer mode', 'Verbose diagnostics enabled for this session.');
          break;
        default:
          break;
      }
    }, 280);
  };

  return (
    <View style={styles.container}>
      {/* Brand header */}
      <View style={[styles.topPanel, { paddingTop: Math.max(insets.top, 12) + 16 }]}>
        {/* Long-press logo for admin */}
        <TouchableOpacity
          onPressIn={handleLogoPressIn}
          onPressOut={handleLogoPressOut}
          activeOpacity={0.85}
        >
          <View style={styles.logoWrap}>
            <Image source={APP_ICON} style={styles.logoImage} resizeMode="contain" />
          </View>
        </TouchableOpacity>
        <Text style={styles.appTitle}>SAMELCO II Mobile</Text>
        <Text style={styles.appSubtitle}>Field Operations System</Text>
        <Text style={styles.coopName}>Samar Electric Cooperative II</Text>
      </View>

      {/* Login card */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>
          <Surface style={styles.cardSurface} elevation={3}>
            <View style={styles.modeSelector}>
              {[
                { value: 'reading', label: 'Reading', icon: 'counter' },
                { value: 'large_load', label: 'Large Load', icon: 'factory' },
                { value: 'disconnection', label: 'Disconnection', icon: 'flash-off' },
                { value: 'net_metering', label: 'Net Metering', icon: 'solar-power' },
              ].map((mode) => {
                const active = readingMode === mode.value;
                return (
                  <TouchableOpacity
                    key={mode.value}
                    style={[styles.modeButton, active && styles.modeButtonActive]}
                    onPress={() => setReadingMode(mode.value as ReadingMode)}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name={mode.icon as any}
                      size={17}
                      color={active ? Colors.white : Colors.primaryDark}
                    />
                    <Text style={[styles.modeButtonText, active && styles.modeButtonTextActive]} numberOfLines={1}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>CREDENTIALS</Text>

            <TextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              mode="outlined"
              left={<TextInput.Icon icon="account" />}
              style={styles.input}
              textColor={Colors.textPrimary}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPass}
              left={<TextInput.Icon icon="lock" />}
              right={
                <TextInput.Icon
                  icon={showPass ? 'eye-off' : 'eye'}
                  onPress={() => setShowPass(!showPass)}
                />
              }
              style={styles.input}
              textColor={Colors.textPrimary}
              placeholderTextColor={Colors.textMuted}
            />
            <TextInput
              label="OR Number"
              value={orNumber}
              onChangeText={setOrNumber}
              mode="outlined"
              left={<TextInput.Icon icon="receipt" />}
              style={styles.input}
              textColor={Colors.textPrimary}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {/* Remember + Mode */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setRememberUser(!rememberUser)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, rememberUser && styles.checkboxChecked]}>
                  {rememberUser && <MaterialCommunityIcons name="check" size={14} color="#fff" />}
                </View>
                <Text style={styles.checkLabel}>Remember User</Text>
              </TouchableOpacity>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  style={[styles.modeChip, connectionMode === 'offline' && styles.modeChipActive]}
                  onPress={() => setConnectionMode('offline')}
                >
                  <MaterialCommunityIcons
                    name="wifi-off"
                    size={14}
                    color={connectionMode === 'offline' ? Colors.white : Colors.textMuted}
                  />
                  <Text style={[styles.modeChipText, connectionMode === 'offline' && styles.modeChipTextActive]}>
                    Offline
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeChip, connectionMode === 'online' && styles.modeChipOnline]}
                  onPress={() => setConnectionMode('online')}
                >
                  <MaterialCommunityIcons
                    name="wifi"
                    size={14}
                    color={connectionMode === 'online' ? Colors.white : Colors.textMuted}
                  />
                  <Text style={[styles.modeChipText, connectionMode === 'online' && styles.modeChipTextActive]}>
                    Online
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Login button */}
            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              icon="login"
              contentStyle={styles.loginBtnContent}
              style={styles.loginBtn}
              labelStyle={styles.loginBtnLabel}
            >
              Login
            </Button>

            <Divider style={styles.divider} />

            {/* Status indicators */}
            <View style={styles.statusSection}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.statusText}>Offline SQLite Connected</Text>
              </View>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: Colors.neutral }]} />
                <Text style={styles.statusText}>Online: Not Connected</Text>
              </View>
              <View style={styles.statusRow}>
                <MaterialCommunityIcons name="sync" size={12} color={Colors.textMuted} />
                <Text style={styles.statusText}> Last Sync: May 10, 2026 08:46 AM</Text>
              </View>
              <View style={styles.statusRow}>
                <MaterialCommunityIcons name="printer-wireless" size={12} color={Colors.textMuted} />
                <Text style={styles.statusText}> Bluetooth: Not Connected</Text>
              </View>
            </View>
          </Surface>
        </Animated.View>
      </ScrollView>

      {/* Admin Panel Modal */}
      <Modal visible={showAdminPanel} transparent animationType="slide">
        <View style={styles.adminOverlay}>
          <View style={styles.adminPanel}>
            <View style={styles.adminHeader}>
              <MaterialCommunityIcons name="shield-lock" size={22} color={Colors.error} />
              <Text style={styles.adminTitle}> Admin Panel</Text>
              <TouchableOpacity onPress={() => setShowAdminPanel(false)} style={styles.adminClose}>
                <MaterialCommunityIcons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Divider />
            <ScrollView style={styles.adminList}>
              {ADMIN_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={styles.adminAction}
                  activeOpacity={0.7}
                  onPress={() => handleAdminAction(action.label)}
                >
                  <View style={[styles.adminIconWrap, { backgroundColor: action.color + '18' }]}>
                    <MaterialCommunityIcons name={action.icon as any} size={20} color={action.color} />
                  </View>
                  <Text style={styles.adminActionLabel}>{action.label}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.adminHint}>Long-press the app logo to open this panel</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  topPanel: {
    backgroundColor: Colors.primaryDark,
    paddingBottom: 28,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoWrap: {
    width: 90,
    height: 90,
    borderRadius: 20,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  logoImage: { width: 90, height: 90 },
  appTitle: { fontSize: 26, fontWeight: '900', color: Colors.white, letterSpacing: 0.5 },
  appSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 },
  coopName: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: { borderRadius: 16, overflow: 'hidden' },
  cardSurface: { borderRadius: 16, padding: 20, backgroundColor: Colors.white },
  modeSelector: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  modeButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: Colors.white,
  },
  modeButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeButtonText: {
    color: Colors.primaryDark,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    textAlign: 'center',
  },
  modeButtonTextActive: { color: Colors.white },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  input: { marginBottom: 12, backgroundColor: Colors.white, color: Colors.textPrimary },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    marginTop: 2,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.primary },
  checkLabel: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500' },
  modeRow: { flexDirection: 'row', gap: 6 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  modeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeChipOnline: { backgroundColor: Colors.success, borderColor: Colors.success },
  modeChipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  modeChipTextActive: { color: Colors.white },
  loginBtn: { borderRadius: 10, marginBottom: 4 },
  loginBtnContent: { height: 50 },
  loginBtnLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  divider: { marginVertical: 14, backgroundColor: Colors.divider },
  statusSection: { gap: 7 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  statusText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '500' },
  adminOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  adminPanel: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 20,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  adminTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.error },
  adminClose: { padding: 4 },
  adminList: { paddingHorizontal: 8 },
  adminAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 13,
    gap: 12,
    borderRadius: 10,
  },
  adminIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminActionLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  adminHint: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 12 },
});
