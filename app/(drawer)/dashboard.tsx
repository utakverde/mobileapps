import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@constants/colors';
import type { Consumer, ConsumerStatus } from '@constants/types';
import NeuSurface from '@components/ui/NeuSurface';
import DashboardNeuHeader from '@components/layout/DashboardNeuHeader';
import CameraCaptureModal, { type CapturedPhoto } from '@components/common/CameraCaptureModal';
import {
  getDashboardSummary,
  getDisconnectionCandidates,
  getReadingAssignment,
  listConsumers,
} from '../../database/consumerRepository';
import { getActiveCollectorName, getActiveReadingMode, getModeLabel } from '@lib/session';

const PAGE_SIZE = 6;

const FILTER_CHIPS: { label: string; value: ConsumerStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Read', value: 'read' },
  { label: 'Paid', value: 'paid' },
];

type TabKey = 'profile' | 'recent';

function NeuRecentRow({ consumer }: { consumer: Consumer }) {
  const router = useRouter();
  const initial = consumer.name.trim().charAt(0).toUpperCase();
  const mode = getActiveReadingMode();
  const target =
    mode === 'disconnection'
      ? `/(drawer)/payment/${consumer.id}`
      : mode === 'net_metering'
      ? `/(drawer)/net-metering/${consumer.id}`
      : `/(drawer)/reading/${consumer.id}`;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => router.push(target as any)}
      style={styles.recentRowWrap}
    >
      <NeuSurface compact style={styles.recentRow}>
        <View style={styles.recentAvatar}>
          <Text style={styles.recentAvatarText}>{initial}</Text>
        </View>
        <View style={styles.recentMid}>
          <Text style={styles.recentName} numberOfLines={1}>
            {consumer.name}
          </Text>
          <Text style={styles.recentAddr} numberOfLines={1}>
            {consumer.address}
          </Text>
          <Text style={styles.recentMeta}>
            {consumer.accountNumber} · {consumer.dueDate}
          </Text>
        </View>
        <MaterialCommunityIcons name="dots-vertical" size={20} color={Colors.textSecondary} />
      </NeuSurface>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const router = useRouter();
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<TabKey>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ConsumerStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [fieldSync, setFieldSync] = useState(true);
  const [activeMode] = useState(getActiveReadingMode());
  const [profileCameraVisible, setProfileCameraVisible] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<CapturedPhoto | null>(null);
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [assignment, setAssignment] = useState({
    areaName: 'SQLite Assignment',
    bookNumber: '',
    billMonth: '',
    readerName: getActiveCollectorName() || 'Field Reader',
  });
  const [reportStats, setReportStats] = useState({
    totalRecords: 0,
    readRecords: 0,
    unreadRecords: 0,
    paidRecords: 0,
    disconnectedRecords: 0,
  });

  const loadDashboard = useCallback(() => {
    let alive = true;
    const consumerSource =
      activeMode === 'disconnection' ? getDisconnectionCandidates(db) : listConsumers(db, { limit: 500, mode: activeMode });
    Promise.all([consumerSource, getDashboardSummary(db, { mode: activeMode }), getReadingAssignment(db, { mode: activeMode })])
      .then(([consumerRows, stats, currentAssignment]) => {
        if (!alive) return;
        setConsumers(consumerRows);
        setReportStats(stats);
        setAssignment({
          ...currentAssignment,
          readerName: getActiveCollectorName() || currentAssignment.readerName,
        });
      })
      .catch(() => {
        if (alive) setConsumers([]);
      });
    return () => {
      alive = false;
    };
  }, [activeMode, db]);

  useFocusEffect(
    useCallback(() => {
      const cleanup = loadDashboard();
      return cleanup;
    }, [loadDashboard])
  );

  const filtered = useMemo(
    () =>
      consumers.filter((c) => {
        const matchStatus = activeFilter === 'all' || c.status === activeFilter;
        const q = searchQuery.toLowerCase();
        const matchSearch =
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.accountNumber.includes(q) ||
          c.address.toLowerCase().includes(q) ||
          c.meterNumber.toLowerCase().includes(q);
        return matchStatus && matchSearch;
      }),
    [consumers, searchQuery, activeFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilterChange = (val: ConsumerStatus | 'all') => {
    setActiveFilter(val);
    setPage(1);
  };

  const bottomPad = Math.max(insets.bottom, 12) + 88;

  return (
    <View style={styles.screen}>
      <DashboardNeuHeader onMenuPress={() => navigation.openDrawer()} title={`${getModeLabel(activeMode)} Dashboard`} />

      {/* Tabs — PROFILE / RECENT */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'profile' && styles.tabBtnActive]}
          onPress={() => setTab('profile')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, tab === 'profile' && styles.tabTextActive]}>PROFILE</Text>
          {tab === 'profile' ? <View style={styles.tabUnderline} /> : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'recent' && styles.tabBtnActive]}
          onPress={() => setTab('recent')}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, tab === 'recent' && styles.tabTextActive]}>RECENT</Text>
          {tab === 'recent' ? <View style={styles.tabUnderline} /> : null}
        </TouchableOpacity>
      </View>

      {tab === 'profile' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollPad, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <NeuSurface style={styles.profileCard}>
            <View style={styles.profileToolbar}>
              <Text style={styles.toolbarLabel}>PROFILE MODE</Text>
              <TouchableOpacity
                style={styles.dropdownNeu}
                activeOpacity={0.85}
                onPress={() =>
                  Alert.alert(
                    'Profile mode',
                    'Dashboard actions follow the mode selected on the login screen. Log out from the menu to switch.'
                  )
                }
              >
                <Text style={styles.dropdownText}>{getModeLabel(activeMode)} Mode</Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color={Colors.primaryDark} />
              </TouchableOpacity>
            </View>
            <View style={styles.profileToolbar}>
              <Text style={styles.toolbarLabel}>FIELD SYNC</Text>
              <Switch
                value={fieldSync}
                onValueChange={setFieldSync}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={fieldSync ? Colors.white : '#f4f3f4'}
              />
            </View>

            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={styles.sideSq}
                activeOpacity={0.85}
                onPress={() => Alert.alert('Gallery', 'Choose an existing photo from the gallery.')}
              >
                <MaterialCommunityIcons name="image-edit" size={18} color={Colors.primary} />
              </TouchableOpacity>
              <View style={styles.avatarBig}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto.uri }} style={styles.avatarPhoto} />
                ) : (
                  <MaterialCommunityIcons name="account" size={52} color={Colors.primaryDark} />
                )}
              </View>
              <TouchableOpacity
                style={styles.sideSq}
                activeOpacity={0.85}
                onPress={() => setProfileCameraVisible(true)}
              >
                <MaterialCommunityIcons name="camera" size={18} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.profileName}>{assignment.readerName}</Text>
            <Text style={styles.profileSub}>
              {assignment.areaName} · Book {assignment.bookNumber || 'N/A'} · {assignment.billMonth || 'N/A'}
            </Text>
            <Text style={styles.aboutLabel}>About route</Text>
            <Text style={styles.aboutBody}>
              SAMELCO II field reader — assigned accounts for the current billing cycle. Use RECENT to
              open consumers and capture readings offline.
            </Text>
          </NeuSurface>

          <View style={styles.statsNeuRow}>
            {[
              { label: 'Total', value: reportStats.totalRecords, c: Colors.primaryDark },
              { label: 'Paid', value: reportStats.paidRecords, c: Colors.success },
              { label: 'Unread', value: reportStats.unreadRecords, c: Colors.neutral },
            ].map((s) => (
              <NeuSurface key={s.label} compact style={styles.statNeu}>
                <Text style={[styles.statNeuNum, { color: s.c }]}>{s.value}</Text>
                <Text style={styles.statNeuLbl}>{s.label}</Text>
              </NeuSurface>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={paged}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NeuRecentRow consumer={item} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.recentHeader}>
              <NeuSurface compact style={styles.statsStripNeu}>
                <View style={styles.miniStat}>
                  <Text style={styles.miniStatNum}>{reportStats.totalRecords}</Text>
                  <Text style={styles.miniStatLbl}>Total</Text>
                </View>
                <View style={styles.miniDiv} />
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatNum, { color: Colors.success }]}>
                    {reportStats.paidRecords}
                  </Text>
                  <Text style={styles.miniStatLbl}>Paid</Text>
                </View>
                <View style={styles.miniDiv} />
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatNum, { color: Colors.warning }]}>
                    {reportStats.readRecords}
                  </Text>
                  <Text style={styles.miniStatLbl}>Read</Text>
                </View>
                <View style={styles.miniDiv} />
                <View style={styles.miniStat}>
                  <Text style={[styles.miniStatNum, { color: Colors.error }]}>
                    {reportStats.disconnectedRecords}
                  </Text>
                  <Text style={styles.miniStatLbl}>Disc.</Text>
                </View>
              </NeuSurface>

              <NeuSurface compact style={styles.searchNeu}>
                <Searchbar
                  placeholder="Search name, account, meter..."
                  value={searchQuery}
                  onChangeText={(q) => {
                    setSearchQuery(q);
                    setPage(1);
                  }}
                  style={styles.searchbarInner}
                  inputStyle={styles.searchInput}
                  iconColor={Colors.primary}
                  elevation={0}
                />
              </NeuSurface>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {FILTER_CHIPS.map((chip) => {
                  const on = activeFilter === chip.value;
                  return (
                    <TouchableOpacity
                      key={chip.value}
                      onPress={() => handleFilterChange(chip.value)}
                      style={[styles.neuChip, on && styles.neuChipOn]}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.neuChipTxt, on && styles.neuChipTxtOn]}>{chip.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.swipeHint}>
                Tap a row to open reading · Swipe list to scroll
              </Text>
            </View>
          }
          ListEmptyComponent={
            <NeuSurface style={styles.emptyNeu}>
              <MaterialCommunityIcons name="database-search" size={44} color={Colors.neuShadowDark} />
              <Text style={styles.emptyText}>No records match</Text>
            </NeuSurface>
          }
          ListFooterComponent={
            totalPages <= 1 ? null : (
              <NeuSurface compact style={styles.paginationNeu}>
                <TouchableOpacity
                  style={[styles.pageArrow, page === 1 && styles.pageDisabled]}
                  disabled={page === 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.primaryDark} />
                </TouchableOpacity>
                <View style={styles.pageCenter}>
                  <Text style={styles.pageMain}>
                    {page} / {totalPages}
                  </Text>
                  <Text style={styles.pageSub}>{filtered.length} accounts</Text>
                </View>
                <TouchableOpacity
                  style={[styles.pageArrow, page === totalPages && styles.pageDisabled]}
                  disabled={page === totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <MaterialCommunityIcons name="chevron-right" size={26} color={Colors.primaryDark} />
                </TouchableOpacity>
              </NeuSurface>
            )
          }
        />
      )}

      {/* Bottom bar — dark strip + floating READ */}
      <View style={[styles.bottomDock, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.fabAnchor}>
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.92}
            onPress={() => router.push(activeMode === 'disconnection' ? '/(drawer)/disconnection' : '/(drawer)/search')}
          >
            <MaterialCommunityIcons
              name={activeMode === 'disconnection' ? 'flash-off' : activeMode === 'large_load' ? 'factory' : 'counter'}
              size={26}
              color={Colors.white}
            />
            <Text style={styles.fabLbl}>{activeMode === 'disconnection' ? 'DISCO' : activeMode === 'large_load' ? 'LARGE' : 'READ'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomDockInner}>
          <View style={styles.bottomSide}>
            <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#81C784" />
            <Text style={styles.bottomDockTxt}>GPS ON</Text>
          </View>
          <View style={[styles.bottomSide, { justifyContent: 'flex-end' }]}>
            <MaterialCommunityIcons name="database-check" size={16} color="#FFCDD2" />
            <Text style={[styles.bottomDockTxt, { textAlign: 'right' }]}>SQLITE OK</Text>
          </View>
        </View>
      </View>
      <CameraCaptureModal
        visible={profileCameraVisible}
        title="Profile Photo"
        defaultFacing="front"
        onClose={() => setProfileCameraVisible(false)}
        onCaptured={setProfilePhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.neuCanvas,
  },
  scroll: { flex: 1 },
  scrollPad: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.neuCanvas,
    paddingHorizontal: 20,
    gap: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  tabBtn: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    position: 'relative',
  },
  tabBtnActive: {},
  tabText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primaryDark,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  profileCard: {
    padding: 20,
    marginBottom: 16,
  },
  profileToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  toolbarLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.primaryDark,
  },
  dropdownNeu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.neuCanvas,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.neuShadowDark + '55',
  },
  dropdownText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    gap: 14,
  },
  sideSq: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.neuCanvas,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.neuShadowDark,
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  avatarBig: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: Colors.neuCanvas,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: Colors.neuShadowDark,
        shadowOffset: { width: 6, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primaryDark,
    textAlign: 'center',
    marginBottom: 6,
  },
  profileSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  aboutLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  aboutBody: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  statsNeuRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  statNeu: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statNeuNum: {
    fontSize: 20,
    fontWeight: '900',
  },
  statNeuLbl: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  recentHeader: {
    gap: 12,
    marginBottom: 10,
  },
  statsStripNeu: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  miniStat: { flex: 1, alignItems: 'center' },
  miniStatNum: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  miniStatLbl: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  miniDiv: {
    width: 1,
    height: 28,
    backgroundColor: Colors.neuShadowDark + '44',
  },
  searchNeu: {
    padding: 6,
    paddingVertical: 4,
  },
  searchbarInner: {
    backgroundColor: 'transparent',
    elevation: 0,
    borderRadius: 14,
    height: 42,
  },
  searchInput: { fontSize: 14, minHeight: 0 },
  chipsScroll: {
    gap: 8,
    paddingVertical: 2,
    flexDirection: 'row',
  },
  neuChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.neuPlate,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.neuShadowDark + '44',
  },
  neuChipOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  neuChipTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  neuChipTxtOn: {
    color: Colors.white,
  },
  swipeHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 6,
  },
  recentRowWrap: {
    marginBottom: 10,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  recentAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.neuCanvas,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  recentAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.primaryDark,
  },
  recentMid: { flex: 1 },
  recentName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginBottom: 2,
  },
  recentAddr: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  recentMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  emptyNeu: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 12,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  paginationNeu: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  pageArrow: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: Colors.neuCanvas,
  },
  pageDisabled: { opacity: 0.35 },
  pageCenter: { alignItems: 'center' },
  pageMain: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  pageSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  fabAnchor: {
    position: 'absolute',
    top: -36,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  bottomDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bottomBar,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 22,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
      android: { elevation: 16 },
    }),
  },
  bottomDockInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    minHeight: 36,
  },
  bottomSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  bottomDockTxt: {
    color: Colors.bottomBarMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  fab: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.neuCanvas,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.55,
        shadowRadius: 14,
      },
      android: {
        elevation: 14,
      },
    }),
  },
  fabLbl: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 2,
  },
});
