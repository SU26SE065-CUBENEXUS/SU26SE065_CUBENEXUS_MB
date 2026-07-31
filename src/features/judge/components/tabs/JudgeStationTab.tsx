import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, useColorScheme,
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
  const scheme = useColorScheme();

  if (isLoadingTournaments) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Đang nạp danh sách giải đấu…</Text>
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
          {isHubConnected ? 'ĐÃ KẾT NỐI TRẠM SẮN SÀNG' : 'CHƯA KẾT NỐI TRẠM'}
        </Text>
        {laneConfig && (
          <Text style={[styles.connectionDetail, { color: colors.textSecondary }]}>
            · Station {laneConfig.stationNumber}
          </Text>
        )}
        {isHubConnected && (
          <TouchableOpacity onPress={onDisconnect} style={[styles.disconnectButton, { backgroundColor: '#ef444410', borderColor: '#ef444430' }]}>
            <MaterialCommunityIcons name="link-off" size={10} color="#ef4444" />
            <Text style={[styles.disconnectText, { color: '#ef4444' }]}>Ngắt Kết Nối</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Active lane summary (when connected) */}
      {laneConfig && isHubConnected ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.primary + '50' }]}>
          <Text style={[styles.cardLabel, { color: colors.primary }]}>TRẠM ĐANG TRỰC CHẤM ĐIỂM</Text>
          <View style={styles.laneGrid}>
            <View style={styles.laneCell}>
              <Text style={styles.laneCellKey}>GIẢI ĐẤU</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]} numberOfLines={1}>
                {activeTournament?.name || '—'}
              </Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={styles.laneCellKey}>HẠNG MỤC</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]}>
                {activeEvent?.puzzleTypeName || '—'}
              </Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={styles.laneCellKey}>VÒNG THI</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]}>Vòng {laneConfig.roundNumber}</Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={styles.laneCellKey}>NHÓM THI</Text>
              <Text style={[styles.laneCellVal, { color: colors.text }]}>
                {laneConfig.groupNumber === 0 || !laneConfig.groupNumber ? 'Tất cả các Group' : `Group ${laneConfig.groupNumber}`}
              </Text>
            </View>
            <View style={styles.laneCell}>
              <Text style={styles.laneCellKey}>TRẠM CHẤM</Text>
              <Text style={[styles.laneCellVal, { color: colors.accent }]}>Station {laneConfig.stationNumber}</Text>
            </View>
          </View>
          <Text style={[styles.statusMsg, { color: colors.textSecondary }]}>
            {statusMessage === 'Configure lane and click Register Lane Connection.' ? 'Vui lòng chọn Vòng thi và kết nối trạm chấm điểm.' : statusMessage}
          </Text>
        </View>
      ) : (
        /* Lane configuration form */
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <MaterialCommunityIcons name="cog-outline" size={14} color={colors.accent} />
            <Text style={[styles.cardLabel, { color: colors.accent }]}>CẤU HÌNH THÔNG TIN TRẠM CHẤM</Text>
          </View>

          {/* Tournament Selection */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>1. Giải đấu (Tournament)</Text>
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
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>2. Hạng mục thi đấu (Event)</Text>
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

          {/* Round Selection */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 10 }]}>3. Chọn Vòng thi (Round)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {['1', '2', '3', '4'].map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, roundNumber === r && { backgroundColor: colors.primary }]}
                onPress={() => setRoundNumber(r)}
              >
                <Text style={[styles.chipText, { color: colors.text }]}>Round {r}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Pre-assigned Station & Group Auto Banner */}
          <View style={{ backgroundColor: colors.primary + '15', borderColor: colors.primary + '35', borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <MaterialCommunityIcons name="shield-check" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: '800' }}>
                Trạm thi đấu: <Text style={{ color: colors.accent, fontWeight: '900' }}>Station {stationNumber || '1'}</Text>
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2, lineHeight: 14 }}>
                Trạm thi đấu chính thức được Ban Tổ Chức phân công. Tự động nạp danh sách đấu thủ trong Vòng thi.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.registerBtn, { backgroundColor: isConfigComplete ? '#10b981' : colors.border, opacity: isConfigComplete ? 1 : 0.5 }]}
            onPress={onRegister}
            disabled={!isConfigComplete}
          >
            <MaterialCommunityIcons name="connection" size={16} color="#fff" />
            <Text style={styles.registerBtnText}>
              Kết Nối Vòng {roundNumber || '1'}
            </Text>
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
