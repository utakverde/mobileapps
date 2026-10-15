import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Button, Divider, Surface, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@constants/colors';
import type { ReadingMode } from '@constants/types';
import { loginUser } from '@lib/auth';
import { setActiveSession } from '@lib/session';
import { clearRememberedLogin, getRememberedLogin, saveLoginOrNumber, saveRememberedLogin } from '../database/configRepository';
import { UTILITY_ACCOUNT_FAMILIES } from '@constants/utilityPlatform';

const MODE_CHOICES: { value: ReadingMode; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; note: string }[] = [
  { value: 'reading', label: 'Reading', icon: 'counter', note: 'Daily field posting and bill creation' },
  { value: 'disconnection', label: 'Disconnection', icon: 'flash-off', note: 'Pending disco review and notice printing' },
  { value: 'net_metering', label: 'Net Metering', icon: 'solar-power', note: 'Import/export posting with credits' },
  { value: 'large_load', label: 'Large Load', icon: 'factory', note: 'Demand-based billing and analysis' },
];

export default function UtilityLoginScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [orNumber, setOrNumber] = useState('');
  const [rememberUser, setRememberUser] = useState(false);
  const [connectionMode, setConnectionMode] = useState<'offline' | 'online'>('offline');
  const [readingMode, setReadingMode] = useState<ReadingMode>('reading');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

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
        // Best effort only.
      }
    })();
    return () => {
      alive = false;
    };
  }, [db]);

  const handleLogin = async () => {
    const u = username.trim();
    const p = password.trim();
    const or = orNumber.trim();
    if (!u || !p || !or) {
      Alert.alert('Required fields', 'Enter username, password, and OR number before logging in.');
      return;
    }

    setLoading(true);
    const result = await loginUser({ username: u, password: p, mode: connectionMode, db });
    setLoading(false);
    if (!result.ok) {
      Alert.alert('Login failed', result.message);
      return;
    }

    try {
      await saveLoginOrNumber(db, or);
    } catch {
      // Non-blocking.
    }
    try {
      if (rememberUser) {
        await saveRememberedLogin(db, { remember: true, username: u, password: p });
      } else {
        await clearRememberedLogin(db);
      }
    } catch {
      // Non-blocking.
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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, wide && styles.heroWide]}>
          <View style={styles.heroPanel}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <MaterialCommunityIcons name="transmission-tower" size={24} color={Colors.white} />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandTitle}>Utility Web Portal</Text>
                <Text style={styles.brandSubtitle}>SAMELCO II field operations and billing workspace</Text>
              </View>
            </View>
            <Text style={styles.heroText}>
              Sign in once to open the shared utility hub, bill audit, collections, complaints, and the billing
              correction preview flow in the browser.
            </Text>
            <View style={styles.modeCards}>
              {MODE_CHOICES.map((mode) => {
                const active = readingMode === mode.value;
                return (
                  <TouchableOpacity
                    key={mode.value}
                    style={[styles.modeCard, active && styles.modeCardActive]}
                    onPress={() => setReadingMode(mode.value)}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name={mode.icon} size={18} color={active ? Colors.white : Colors.primaryDark} />
                    <Text style={[styles.modeCardTitle, active && styles.modeCardTitleActive]}>{mode.label}</Text>
                    <Text style={[styles.modeCardNote, active && styles.modeCardNoteActive]}>{mode.note}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Surface style={styles.formPanel} elevation={4}>
            <Text style={styles.formTitle}>Login</Text>
            <Text style={styles.formSubtitle}>Use your collector credentials and OR number to continue.</Text>
            <TextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              mode="outlined"
              left={<TextInput.Icon icon="account" />}
              style={styles.input}
              textColor={Colors.textPrimary}
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              secureTextEntry={!showPass}
              left={<TextInput.Icon icon="lock" />}
              right={<TextInput.Icon icon={showPass ? 'eye-off' : 'eye'} onPress={() => setShowPass((v) => !v)} />}
              style={styles.input}
              textColor={Colors.textPrimary}
            />
            <TextInput
              label="OR Number"
              value={orNumber}
              onChangeText={setOrNumber}
              mode="outlined"
              left={<TextInput.Icon icon="receipt" />}
              style={styles.input}
              textColor={Colors.textPrimary}
            />
            <View style={styles.optionRow}>
              <TouchableOpacity style={styles.checkRow} onPress={() => setRememberUser((v) => !v)} activeOpacity={0.75}>
                <View style={[styles.checkbox, rememberUser && styles.checkboxChecked]}>
                  {rememberUser ? <MaterialCommunityIcons name="check" size={14} color={Colors.white} /> : null}
                </View>
                <Text style={styles.checkLabel}>Remember User</Text>
              </TouchableOpacity>
              <View style={styles.connRow}>
                <TouchableOpacity style={[styles.connChip, connectionMode === 'offline' && styles.connChipActive]} onPress={() => setConnectionMode('offline')}>
                  <MaterialCommunityIcons name="wifi-off" size={14} color={connectionMode === 'offline' ? Colors.white : Colors.textMuted} />
                  <Text style={[styles.connChipText, connectionMode === 'offline' && styles.connChipTextActive]}>Offline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.connChip, connectionMode === 'online' && styles.connChipOnline]} onPress={() => setConnectionMode('online')}>
                  <MaterialCommunityIcons name="wifi" size={14} color={connectionMode === 'online' ? Colors.white : Colors.textMuted} />
                  <Text style={[styles.connChipText, connectionMode === 'online' && styles.connChipTextActive]}>Online</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Button mode="contained" loading={loading} disabled={loading} icon="login" style={styles.loginBtn} contentStyle={styles.loginContent} onPress={handleLogin}>
              Enter Portal
            </Button>
            <Divider style={styles.divider} />
            <View style={styles.statusBox}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.statusText}>Offline SQLite ready</Text>
              </View>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: Colors.neutral }]} />
                <Text style={styles.statusText}>Web sync later through API</Text>
              </View>
              <View style={styles.statusRow}>
                <MaterialCommunityIcons name="cash-multiple" size={12} color={Colors.textMuted} />
                <Text style={styles.statusText}> Billing, collections, complaints, and accounting share one contract</Text>
              </View>
            </View>
          </Surface>
        </View>

        <View style={[styles.infoGrid, wide && styles.infoGridWide]}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Account Families</Text>
            <View style={styles.familyWrap}>
              {UTILITY_ACCOUNT_FAMILIES.map((family) => (
                <View key={family} style={styles.familyPill}>
                  <Text style={styles.familyText}>{family}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Next Web Paths</Text>
            <Text style={styles.infoText}>Utility Hub · Consumer Bills · Bill Audit · Correction Preview · Collections · Complaints</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 18,
    gap: 16,
  },
  hero: {
    gap: 16,
  },
  heroWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroPanel: {
    flex: 1.1,
    borderRadius: 24,
    backgroundColor: Colors.primaryDark,
    padding: 18,
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCopy: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.white,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.9)',
  },
  modeCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeCard: {
    flexGrow: 1,
    flexBasis: 150,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modeCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.white,
  },
  modeCardTitleActive: {
    color: Colors.white,
  },
  modeCardNote: {
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.75)',
  },
  modeCardNoteActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  formPanel: {
    flex: 0.9,
    borderRadius: 24,
    backgroundColor: Colors.white,
    padding: 18,
    gap: 10,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  formSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.white,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  checkLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  connRow: {
    flexDirection: 'row',
    gap: 8,
  },
  connChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.primarySurface,
  },
  connChipActive: {
    backgroundColor: Colors.primary,
  },
  connChipOnline: {
    backgroundColor: Colors.success,
  },
  connChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  connChipTextActive: {
    color: Colors.white,
  },
  loginBtn: {
    borderRadius: 12,
    marginTop: 4,
  },
  loginContent: {
    height: 52,
  },
  divider: {
    marginVertical: 8,
    backgroundColor: Colors.divider,
  },
  statusBox: {
    gap: 7,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  infoGrid: {
    gap: 12,
  },
  infoGridWide: {
    flexDirection: 'row',
  },
  infoCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    backgroundColor: Colors.white,
    gap: 10,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  familyWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  familyPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(183,28,28,0.08)',
  },
  familyText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
});
