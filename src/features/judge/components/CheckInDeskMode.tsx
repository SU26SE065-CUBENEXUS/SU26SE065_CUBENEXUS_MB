import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/AuthContext';
import { useCheckInDesk } from '../services/judgeService';
import CheckInScanTab from './checkin/CheckInScanTab';
import CheckInRecentTab from './checkin/CheckInRecentTab';

type CheckInTab = 'scan' | 'recent';

interface Props {
  token: string | null;
  onChangeDuty: () => void;
  onLogout: () => void;
}

export default function CheckInDeskMode({ token, onChangeDuty, onLogout }: Props) {
  const colors = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<CheckInTab>('scan');
  const {
    isScanning,
    lastResult,
    allRegistrations,
    checkedInIds,
    isLoadingRoster,
    performCheckIn,
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
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onChangeDuty} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <MaterialCommunityIcons name="account-check-outline" size={16} color="#10b981" />
            <Text style={[styles.headerTitle, { color: '#10b981' }]}>CHECK-IN DESK</Text>
            {user?.assignedTournamentName ? (
              <Text style={[styles.tournamentTag, { color: colors.textSecondary }]} numberOfLines={1}>
                · {user.assignedTournamentName}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

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

        {/* Tab content */}
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
    paddingHorizontal: 12,
    height: 52,
    borderBottomWidth: 1,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'center' },
  headerTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  tournamentTag: { fontSize: 10, fontWeight: '700', maxWidth: 120 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  logoutBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
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
