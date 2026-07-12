import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

  if (isLoadingTournaments) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading tournaments…</Text>
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
        <View style={[styles.dot, { backgroundColor: isHubConnected ? '#10b981' : '#ef4444' }]} />
        <Text style={[styles.connectionText, { color: isHubConnected ? '#10b981' : '#ef4444' }]}>
          {hubStatus.toUpperCase()}
        </Text>
        {laneConfig && (
          <Text style={[styles.connectionDetail, { color: colors.textSecondary }]}>
            · Station {laneConfig.stationNumber}
          </Text>
        )}
        {isHubConnected && (
          <TouchableOpacity onPress={onDisconnect} style={[styles.disconnectButton, { backgroundColor: '#ef444410', borderColor: '#ef444430' }]}>
            <MaterialCommunityIcons name="link-off" size={10} color="#ef4444" />
            <Text style={[styles.disconnectText, { color: '#ef4444' }]}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Active lane summary (when connected) */}
      {laneConfig && isHubConnected ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.primary + '50' }]}>
          <Text style={[styles.cardLabel, { color: colors.primary }]}>ACTIVE LANE</Text>
          <View style={styles.laneGrid}>
            <View style={styles.laneCell}>
              <Text style={styles.laneCellKey}>TOURNAMENT</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]} numberOfLines={1}>
                {activeTournament?.name || '—'}
              </Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={styles.laneCellKey}>EVENT</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]}>
                {activeEvent?.puzzleTypeName || '—'}
              </Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={styles.laneCellKey}>ROUND</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]}>Round {laneConfig.roundNumber}</Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={styles.laneCellKey}>GROUP</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]}>Group {laneConfig.groupNumber}</Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={styles.laneCellKey}>STATION</Text>
              <Text style={[styles.laneCellVal, { color: colors.accent }]}>Station {laneConfig.stationNumber}</Text>
            </View>
          </View>
          <Text style={[styles.statusMsg, { color: colors.textSecondary }]}>{statusMessage}</Text>
        </View>
      ) : (
        /* Lane configuration form */
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <MaterialCommunityIcons name="cog-outline" size={14} color={colors.accent} />
            <Text style={[styles.cardLabel, { color: colors.accent }]}>LANE CONFIGURATION</Text>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tournament</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {tournaments.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.chip, selectedTournamentId === t.id && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedTournamentId(t.id)}
              >
                <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>Event</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {activeTournament?.events?.map((e: any) => (
              <TouchableOpacity
                key={e.id}
                style={[styles.chip, selectedEventId === e.id && { backgroundColor: colors.primary }]}
                onPress={() => setSelectedEventId(e.id)}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>
                  {e.puzzleTypeName} ({e.eventFormatCode})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.numberRow}>
            {([
              { label: 'Round', value: roundNumber, set: setRoundNumber },
              { label: 'Group', value: groupNumber, set: setGroupNumber },
              { label: 'Station', value: stationNumber, set: setStationNumber },
            ] as const).map(({ label, value, set }) => (
              <View key={label} style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
                <TextInput
                  style={[styles.numberInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  keyboardType="numeric"
                  value={value}
                  onChangeText={set as any}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, { backgroundColor: isConfigComplete ? colors.primary : colors.border, opacity: isConfigComplete ? 1 : 0.5 }]}
            onPress={onRegister}
            disabled={!isConfigComplete}
          >
            <MaterialCommunityIcons name="connection" size={14} color="#fff" />
            <Text style={styles.registerBtnText}>Register Lane Connection</Text>
          </TouchableOpacity>

          {statusMessage ? (
            <Text style={[styles.statusMsg, { color: colors.textSecondary, marginTop: 8 }]}>{statusMessage}</Text>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 12, gap: 10 },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loaderText: { fontSize: 12, fontWeight: '600' },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { fontSize: 10, fontWeight: '900' },
  connectionDetail: { fontSize: 10, flex: 1 },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  disconnectText: { fontSize: 9, fontWeight: '800' },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  laneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  laneCell: { minWidth: '45%' },
  laneCellKey: { fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: '800' },
  laneCellVal: { fontSize: 12, fontWeight: '800', marginTop: 1 },
  fieldLabel: { fontSize: 9, fontWeight: '800', marginBottom: 4 },
  chipRow: { gap: 6, marginBottom: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#1e2030' },
  chipText: { fontSize: 10, fontWeight: '700' },
  numberRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  numberInput: { height: 36, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, fontSize: 13, fontWeight: '800' },
  registerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 8, marginTop: 12 },
  registerBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  statusMsg: { fontSize: 10, marginTop: 4 },
});
