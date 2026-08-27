import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, useColorScheme,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatEventLabel } from '@/utils/eventFormatter';

interface Props {
  tournaments: any[];
  selectedTournamentId: string;
  setSelectedTournamentId: (id: string) => void;
  selectedEventId: string;
  setSelectedEventId: (id: string) => void;
  roundNumber: string;
  setRoundNumber: (v: string) => void;
  groupNumber: string;
  setGroupNumber: (v: string) => void;
  stationNumber: string;
  setStationNumber: (v: string) => void;
  activeTournament: any;
  isLoadingTournaments: boolean;
  isHubConnected: boolean;
  hubStatus: string;
  statusMessage: string;
  isConfigComplete: any;
  onRegister: () => void;
  onDisconnect: () => void;
  laneConfig: any;
  activeEvent: any;
}

export default function JudgeStationTab({
  tournaments, selectedTournamentId, setSelectedTournamentId,
  selectedEventId, setSelectedEventId,
  roundNumber, setRoundNumber,
  groupNumber, setGroupNumber,
  stationNumber, setStationNumber,
  activeTournament, isLoadingTournaments,
  isHubConnected, hubStatus, statusMessage,
  isConfigComplete, onRegister, onDisconnect,
  laneConfig, activeEvent,
}: Props) {
  const colors = useTheme();
  const scheme = useColorScheme();

  const totalRoundsCount = activeEvent?.totalRounds && activeEvent.totalRounds > 0 ? activeEvent.totalRounds : 1;
  const roundOptions = Array.from({ length: totalRoundsCount }, (_, i) => String(i + 1));

  if (isLoadingTournaments) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading assigned tournament…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Connection status badge */}
      <View style={[styles.connectionBanner, {
        backgroundColor: isHubConnected ? '#10b98112' : '#ef444412',
        borderColor: isHubConnected ? '#10b98130' : '#ef444430',
      }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1, flexWrap: 'wrap' }}>
          <View style={[styles.dot, { backgroundColor: isHubConnected ? '#10b981' : '#ef4444' }]} />
          <Text style={[styles.connectionText, { color: isHubConnected ? '#10b981' : '#ef4444' }]}>
            {isHubConnected ? 'STATION CONNECTED & READY' : 'STATION DISCONNECTED'}
          </Text>
          {laneConfig && (
            <Text style={[styles.connectionDetail, { color: colors.textSecondary }]}>
              · Station {laneConfig.stationNumber}
            </Text>
          )}
        </View>
        {isHubConnected && (
          <TouchableOpacity onPress={onDisconnect} style={[styles.disconnectButton, { backgroundColor: '#ef444410', borderColor: '#ef444430' }]}>
            <MaterialCommunityIcons name="link-off" size={12} color="#ef4444" />
            <Text style={[styles.disconnectText, { color: '#ef4444' }]}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Active lane summary (when connected) */}
      {laneConfig && isHubConnected ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.primary + '50' }]}>
          <Text style={[styles.cardLabel, { color: colors.primary }]}>STATION ON-DUTY STATUS</Text>
          <View style={styles.laneGrid}>
            <View style={styles.laneCell}>
              <Text style={[styles.laneCellKey, { color: colors.textSecondary }]}>TOURNAMENT</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]} numberOfLines={1}>
                {activeTournament?.name || '—'}
              </Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={[styles.laneCellKey, { color: colors.textSecondary }]}>EVENT</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]}>
                {activeEvent ? formatEventLabel(activeEvent) : '—'}
              </Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={[styles.laneCellKey, { color: colors.textSecondary }]}>ROUND</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]}>Round {laneConfig.roundNumber}</Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={[styles.laneCellKey, { color: colors.textSecondary }]}>GROUP</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]}>
                {laneConfig.groupNumber === 0 || !laneConfig.groupNumber ? 'All Groups' : `Group ${laneConfig.groupNumber}`}
              </Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={[styles.laneCellKey, { color: colors.textSecondary }]}>STATION</Text>
              <Text style={[styles.laneCellVal, { color: colors.accent }]}>Station {laneConfig.stationNumber}</Text>
            </View>
          </View>
          <Text style={[styles.statusMsg, { color: colors.textSecondary }]}>
            {statusMessage === 'Configure lane and click Register Lane Connection.' ? 'Please select Round and connect Station.' : statusMessage}
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <MaterialCommunityIcons name="cog-outline" size={20} color={colors.accent} />
            <Text style={[styles.cardLabel, { color: colors.accent }]}>STATION CONFIGURATION</Text>
          </View>

          {/* Tournament Selection */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>1. Tournament</Text>
            {tournaments.length === 1 && (
              <View style={{ backgroundColor: colors.primary + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MaterialCommunityIcons name="lock-outline" size={11} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }}>ASSIGNED</Text>
              </View>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {tournaments.map(t => {
              const isSelected = selectedTournamentId === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected
                        ? colors.primary
                        : (scheme === 'dark' ? '#1e2030' : '#e2e8f0'),
                    }
                  ]}
                  onPress={() => setSelectedTournamentId(t.id)}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#ffffff' : colors.text }]} numberOfLines={1}>{t.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Event Selection */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>2. Event</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {activeTournament?.events?.map((e: any) => {
              const isSelected = selectedEventId === e.id;
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.backgroundSelected,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => setSelectedEventId(e.id)}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#ffffff' : colors.text }]}>
                    {formatEventLabel(e)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Round Selection */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 14 }]}>3. Select Round</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {roundOptions.map(r => {
              const isSelected = roundNumber === r;
              return (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.backgroundSelected,
                      borderColor: isSelected ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => setRoundNumber(r)}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#ffffff' : colors.text }]}>Round {r}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Pre-assigned Station Banner */}
          <View style={{ backgroundColor: colors.primary + '15', borderColor: colors.primary + '35', borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <MaterialCommunityIcons name="shield-check" size={26} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>
                Assigned Station: <Text style={{ color: colors.accent, fontWeight: '900' }}>Station {stationNumber || '1'}</Text>
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 3, lineHeight: 16 }}>
                Official Station assigned by Organizers. Automatically loads competitor queue for this Round.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, { backgroundColor: isConfigComplete ? '#10b981' : colors.border, opacity: isConfigComplete ? 1 : 0.5 }]}
            onPress={onRegister}
            disabled={!isConfigComplete}
          >
            <MaterialCommunityIcons name="connection" size={20} color="#fff" />
            <Text style={styles.registerBtnText}>
              Connect Round {roundNumber || '1'}
            </Text>
          </TouchableOpacity>

          {statusMessage ? (
            <Text style={[styles.statusMsg, { color: colors.textSecondary, marginTop: 10 }]}>{statusMessage}</Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 14, gap: 14 },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loaderText: { fontSize: 14, fontWeight: '600' },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  connectionText: { fontSize: 10, fontWeight: '900' },
  connectionDetail: { fontSize: 12, flex: 1 },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  disconnectText: { fontSize: 11, fontWeight: '800' },
  card: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  cardLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  laneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  laneCell: { minWidth: '45%' },
  laneCellKey: { fontSize: 10, fontWeight: '800' },
  laneCellVal: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  chipRow: { gap: 10, marginBottom: 6 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '800' },
  numberRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  numberInput: { height: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, fontWeight: '800' },
  registerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12, marginTop: 16 },
  registerBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  statusMsg: { fontSize: 11, marginTop: 6, lineHeight: 16 },
});
