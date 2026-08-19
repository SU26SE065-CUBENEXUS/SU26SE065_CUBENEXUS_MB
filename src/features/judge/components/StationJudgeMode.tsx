import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/AuthContext';
import { useJudgeLaneConfig, useJudgeStationQueue } from '../services/judgeService';
import { getSelectedCompetitorId, setSelectedCompetitorId, subscribeJudgeStore } from '../services/judgeStore';
import { JudgeStationCompetitor } from '../types';

import JudgeStationTab from './tabs/JudgeStationTab';
import JudgeScanTab from './tabs/JudgeScanTab';
import JudgeRosterTab from './tabs/JudgeRosterTab';
import JudgeScoreTab from './tabs/JudgeScoreTab';
import JudgeHistoryTab from './tabs/JudgeHistoryTab';

type StationTab = 'station' | 'scan' | 'roster' | 'score' | 'history';

interface Props {
  token: string | null;
  onChangeDuty: () => void;
  onLogout: () => void;
}

export default function StationJudgeMode({ token, onChangeDuty, onLogout }: Props) {
  const colors = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<StationTab>('station');
  const [selectedCompId, setSelectedCompId] = useState<string | null>(getSelectedCompetitorId());

  useEffect(() => {
    return subscribeJudgeStore(() => {
      setSelectedCompId(getSelectedCompetitorId());
    });
  }, []);

  const laneConfig = useJudgeLaneConfig(token);
  const stationQueue = useJudgeStationQueue(token);

  const selectedCompetitor = stationQueue.queue.find(
    competitor => competitor.groupCompetitorId === selectedCompId
  ) || null;

  const handleSelectCompetitor = (competitor: JudgeStationCompetitor) => {
    setSelectedCompId(competitor.groupCompetitorId);
    setSelectedCompetitorId(competitor.groupCompetitorId);
    setActiveTab('score');
  };

  const handleVerified = (competitor: JudgeStationCompetitor) => {
    setSelectedCompId(competitor.groupCompetitorId);
    setSelectedCompetitorId(competitor.groupCompetitorId);
  };

  const tabs: { key: StationTab; label: string; icon: string }[] = [
    { key: 'station', label: 'Cấu Hình', icon: 'cog-outline' },
    { key: 'scan', label: 'Quét Mã', icon: 'qrcode-scan' },
    { key: 'roster', label: 'Danh Sách', icon: 'account-group-outline' },
    { key: 'score', label: 'Chấm Điểm', icon: 'timer-check-outline' },
    { key: 'history', label: 'Lịch Sử', icon: 'clipboard-text-clock-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onLogout} style={styles.logoutHeaderBtn}>
            <MaterialCommunityIcons name="logout" size={16} color="#ef4444" />
            <Text style={[styles.logoutHeaderText, { color: '#ef4444' }]}>Đăng Xuất</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <TouchableOpacity onPress={onChangeDuty} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={16} color={colors.text} />
            </TouchableOpacity>
            <Image
              source={require('@/assets/images/logoCube.png')}
              style={styles.miniLogo}
              resizeMode="contain"
            />
            <Text style={[styles.brandCube, { color: colors.text }]}>CUBE</Text>
            <Text style={[styles.brandNexus, { color: colors.accent }]}>NEXUS</Text>
            {user?.assignedTournamentName ? (
              <Text style={[styles.tournamentTag, { color: colors.textSecondary }]} numberOfLines={1}>
                · {user.assignedTournamentName}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.connBadge, {
              backgroundColor: laneConfig.isHubConnected ? '#10b98112' : '#ef444412',
              borderColor: laneConfig.isHubConnected ? '#10b98140' : '#ef444440',
            }]}>
              <Text style={[styles.connBadgeText, {
                color: laneConfig.isHubConnected ? '#10b981' : '#ef4444',
              }]}>
                {laneConfig.hubStatus.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {activeTab === 'station' && (
            <JudgeStationTab
              tournaments={laneConfig.tournaments}
              selectedTournamentId={laneConfig.selectedTournamentId}
              setSelectedTournamentId={laneConfig.setSelectedTournamentId}
              selectedEventId={laneConfig.selectedEventId}
              setSelectedEventId={laneConfig.setSelectedEventId}
              roundNumber={laneConfig.roundNumber}
              setRoundNumber={laneConfig.setRoundNumber}
              groupNumber={laneConfig.groupNumber}
              setGroupNumber={laneConfig.setGroupNumber}
              stationNumber={laneConfig.stationNumber}
              setStationNumber={laneConfig.setStationNumber}
              activeTournament={laneConfig.activeTournament}
              isLoadingTournaments={laneConfig.isLoadingTournaments}
              isHubConnected={laneConfig.isHubConnected}
              hubStatus={laneConfig.hubStatus}
              statusMessage={laneConfig.statusMessage}
              isConfigComplete={laneConfig.isConfigComplete}
              onRegister={laneConfig.registerStation}
              onDisconnect={laneConfig.disconnectStation}
              laneConfig={laneConfig.laneConfig}
              activeEvent={laneConfig.activeEvent}
            />
          )}
          {activeTab === 'scan' && (
            <JudgeScanTab
              laneConfig={laneConfig.laneConfig}
              token={token}
              isHubConnected={laneConfig.isHubConnected}
              hubConnection={laneConfig.hubConnection}
              activeEvent={laneConfig.activeEvent}
              onVerified={handleVerified}
              onSelectForScoring={handleSelectCompetitor}
              verifyCompetitorInRoster={stationQueue.verifyCompetitorInRoster}
            />
          )}
          {activeTab === 'roster' && (
            <JudgeRosterTab
              queue={stationQueue.queue}
              selectedCompetitorId={selectedCompId}
              onSelectCompetitor={handleSelectCompetitor}
            />
          )}
          {activeTab === 'score' && (
            <JudgeScoreTab
              selectedCompetitor={selectedCompetitor}
              token={token}
              onGoToRoster={() => setActiveTab('roster')}
              onScoreComplete={() => setActiveTab('roster')}
              onGoToScan={() => setActiveTab('scan')}
            />
          )}
          {activeTab === 'history' && (
            <JudgeHistoryTab />
          )}
        </View>

        <View style={[styles.tabBar, { backgroundColor: colors.backgroundElement, borderTopColor: colors.border }]}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            const badge = tab.key === 'roster' && stationQueue.queue.length > 0
              ? stationQueue.queue.length
              : null;

            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabItem}
                onPress={() => setActiveTab(tab.key)}
              >
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={20}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.textSecondary }]}>
                  {tab.label}
                </Text>
                {badge !== null && (
                  <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.tabBadgeText}>{badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
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
    height: 48,
    borderBottomWidth: 1,
  },
  logoutHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef444415',
    borderColor: '#ef444435',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logoutHeaderText: { fontSize: 10, fontWeight: '800' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backBtn: { padding: 4, marginRight: 2 },
  miniLogo: { width: 18, height: 18, borderRadius: 4 },
  brandCube: { fontSize: 11, fontWeight: '900', letterSpacing: -0.3 },
  brandNexus: { fontSize: 11, fontWeight: '900', letterSpacing: -0.3 },
  tournamentTag: { fontSize: 9, fontWeight: '700', maxWidth: 100 },
  headerRight: { minWidth: 60, alignItems: 'flex-end' },
  connBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
  connBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.4 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 76 : 58,
    paddingBottom: Platform.OS === 'ios' ? 20 : 6,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    position: 'relative',
  },
  tabLabel: { fontSize: 9, fontWeight: '700' },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: '20%',
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  tabBadgeText: { fontSize: 8, fontWeight: '900', color: '#fff' },
});
