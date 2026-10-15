import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@constants/colors';
import { ensureAppStorageFolders } from '@lib/databaseFiles';

type LoadStep = {
  message: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  done: boolean;
};

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const [steps, setSteps] = useState<LoadStep[]>([
    { message: 'Preparing app folders...', icon: 'folder-cog', done: false },
    { message: 'Initializing database...', icon: 'database', done: false },
    { message: 'Checking sync status...', icon: 'cloud-sync', done: false },
    { message: 'Ready', icon: 'check-circle', done: false },
  ]);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    const storageTask = ensureAppStorageFolders().catch(() => {
      // Let the app continue; screens that need storage will surface any remaining error.
    });

    // Step through loading messages
    let step = 0;
    const interval = setInterval(() => {
      if (step < 4) {
        setCurrentStep(step);
        setSteps((prev) =>
          prev.map((s, i) => (i === step ? { ...s, done: true } : s))
        );
        Animated.timing(progressAnim, {
          toValue: (step + 1) / 4,
          duration: 400,
          useNativeDriver: false,
        }).start();
        step++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          storageTask.finally(() => router.replace('/login'));
        }, 600);
      }
    }, 700);

    return () => clearInterval(interval);
  }, [fadeAnim, progressAnim, pulseAnim, router, scaleAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      {/* Background gradient simulation */}
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Logo */}
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: pulseAnim }] }]}>
          <MaterialCommunityIcons name="lightning-bolt-circle" size={88} color={Colors.white} />
        </Animated.View>

        <Text style={styles.appName}>SAMELCO II</Text>
        <Text style={styles.appSub}>Mobile</Text>

        <View style={styles.coopBadge}>
          <MaterialCommunityIcons name="shield-check" size={14} color={Colors.primarySurface} />
          <Text style={styles.coopText}> Samar Electric Cooperative II</Text>
        </View>

        <Text style={styles.tagline}>Field Operations System</Text>
      </Animated.View>

      {/* Loading section */}
      <Animated.View style={[styles.loadSection, { opacity: fadeAnim, bottom: Math.max(24, insets.bottom + 16) }]}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        {/* Steps */}
        <View style={styles.steps}>
          {steps.map((step, i) => (
            <View key={step.message} style={[styles.stepRow, i > currentStep && styles.stepRowPending]}>
              <MaterialCommunityIcons
                name={step.done ? 'check-circle' : i === currentStep ? 'progress-clock' : 'circle-outline'}
                size={14}
                color={step.done ? Colors.success : i === currentStep ? Colors.warning : 'rgba(255,255,255,0.55)'}
              />
              <Text style={[styles.stepText, i > currentStep && styles.stepTextFaded]}>
                {step.message}
              </Text>
            </View>
          ))}
        </View>

        {/* Status chips */}
        <View style={styles.statusRow}>
          <View style={[styles.statusChip, styles.chipOffline]}>
            <View style={styles.statusDot} />
            <Text style={styles.chipText}>SQLite Connected</Text>
          </View>
          <View style={[styles.statusChip, styles.chipWarning]}>
            <MaterialCommunityIcons name="cloud-off-outline" size={12} color={Colors.warning} />
            <Text style={[styles.chipText, { color: Colors.warning }]}>  Offline Mode</Text>
          </View>
        </View>

        <Text style={styles.version}>Version 1.0.4  •  Build 2026.05.12</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  bgTop: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(21,101,192,0.4)',
  },
  bgBottom: {
    position: 'absolute',
    bottom: -80,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(21,101,192,0.25)',
  },
  content: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoWrap: {
    width: 130,
    height: 130,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  appName: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.white,
    letterSpacing: 1,
    lineHeight: 46,
  },
  appSub: {
    fontSize: 18,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  coopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 8,
  },
  coopText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  loadSection: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.success,
    borderRadius: 2,
  },
  steps: {
    width: '100%',
    gap: 6,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepRowPending: {
    opacity: 0.55,
  },
  stepText: {
    fontSize: 12,
    color: Colors.white,
    fontWeight: '500',
  },
  stepTextFaded: {
    color: 'rgba(255,255,255,0.7)',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  chipOffline: {
    backgroundColor: Colors.successLight,
  },
  chipWarning: {
    backgroundColor: Colors.warningLight,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success,
  },
  version: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.3,
  },
});
