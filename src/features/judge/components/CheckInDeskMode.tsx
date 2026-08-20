import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCheckInDesk } from '../services/judgeService';
import CheckInScanTab from './checkin/CheckInScanTab';
import CheckInRecentTab from './checkin/CheckInRecentTab';
import FaceCheckInModal from '@/features/face-verification/FaceCheckInModal';

type CheckInTab = 'scan' | 'recent';

interface Props {
  token: string | null;
  onLogout: () => void;
}

export default function CheckInDeskMode({ token, onLogout }: Props) {
  const colors = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<CheckInTab>('scan');
  const {
    isScanning,
    lastResult,
    allRegistrations,
    checkedInIds,
    isLoadingRoster,
    pendingFace,
    performCheckIn,
    completeCheckInAfterFace,
    cancelFaceCheckIn,
    clearResult,
    refreshRegistrations,
  } = useCheckInDesk(token);

  const tabs: { key: CheckInTab; label: string; icon: string }[] = [
    { key: 'scan', label: 'Scan', icon: 'qrcode-scan' },
    { key: 'recent', label: 'Danh Sách', icon: 'account-group-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <View style={styles.headerBadge}>
              <MaterialCommunityIcons name="account-check-outline" size={18} color="#10b981" />
              <Text style={styles.headerTitle}>CHECK-IN DESK</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={onLogout} style={styles.iconBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="logout" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tournament Name Banner Card (Spacious & No Truncation) */}
        {user?.assignedTournamentName ? (
          <View style={[styles.tournamentBanner, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <View style={styles.bannerIconBox}>
              <MaterialCommunityIcons name="trophy-outline" size={16} color="#10b981" />
            </View>
            <View style={styles.bannerContent}>
              <Text style={[styles.bannerLabel, { color: colors.textSecondary }]}>TOURNAMENT ON-DUTY</Text>
              <Text style={[styles.tournamentName, { color: colors.text }]}>
                {user.assignedTournamentName}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: colors.backgroundElement, borderBottomColor: colors.border }]}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            const badge = tab.key === 'recent' && checkedInIds.size > 0 ? checkedInIds.size : null;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && { borderBottomColor: '#10b981', borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(tab.key)}
              >
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={16}
                  color={isActive ? '#10b981' : colors.textSecondary}
                />
                <Text style={[styles.tabLabel, { color: isActive ? '#10b981' : colors.textSecondary }]}>
                  {tab.label}
                </Text>
                {badge !== null && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flex: 1 }}>
          {activeTab === 'scan' ? (
            <CheckInScanTab
              isScanning={isScanning}
              lastResult={lastResult}
              onScan={performCheckIn}
              onClearResult={clearResult}
            />
          ) : (
            <CheckInRecentTab
              allRegistrations={allRegistrations}
              checkedInIds={checkedInIds}
              isLoadingRoster={isLoadingRoster}
              onRefresh={refreshRegistrations}
            />
          )}
        </View>
      </SafeAreaView>

      {token && pendingFace ? (
        <FaceCheckInModal
          visible
          token={token}
          session={pendingFace.session}
          onVerified={completeCheckInAfterFace}
          onCancel={cancelFaceCheckIn}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 13, fontWeight: '900', color: '#10b981', letterSpacing: 0.8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },

  tournamentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  bannerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#10b98115',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerContent: { flex: 1 },
  bannerLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginBottom: 1 },
  tournamentName: { fontSize: 13, fontWeight: '700', lineHeight: 18 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 12, fontWeight: '700' },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },
});
