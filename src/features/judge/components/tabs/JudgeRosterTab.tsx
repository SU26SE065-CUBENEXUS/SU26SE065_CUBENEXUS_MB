import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { JudgeStationCompetitor } from '../../types';

interface Props {
  queue: JudgeStationCompetitor[];
  selectedCompetitorId: string | null;
  onSelectCompetitor: (competitor: JudgeStationCompetitor) => void;
}

function getDisplayState(competitor: JudgeStationCompetitor, colors: any): { label: string; color: string; background: string } {
  if (competitor.isCutoffReached) {
    return { label: 'TRƯỢT CUTOFF', color: '#f97316', background: '#f9731612' };
  }
  if (competitor.sessionState === 'ISSUE') {
    return { label: 'CÓ LỖI', color: '#ef4444', background: '#ef444412' };
  }
  if (competitor.sessionState === 'SCORING') {
    return { label: 'ĐANG CHẤM', color: colors.primary, background: colors.primary + '15' };
  }
  if (competitor.sessionState === 'VERIFIED') {
    return { label: 'ĐÃ XÁC NHẬN', color: '#f59e0b', background: '#f59e0b15' };
  }
  if (competitor.backendStatus === 'DONE') {
    return { label: 'HOÀN THÀNH', color: '#10b981', background: '#10b98115' };
  }
  if (competitor.backendStatus === 'PARTIAL') {
    return { label: 'ĐANG THI', color: '#38bdf8', background: '#38bdf815' };
  }
  if (competitor.backendStatus === 'ABSENT' || competitor.backendStatus === 'DNS') {
    return { label: competitor.backendStatus, color: '#ef4444', background: '#ef444415' };
  }
  return { label: 'CHỜ QUÉT MÃ', color: colors.textSecondary, background: colors.backgroundSelected };
}

export default function JudgeRosterTab({
  queue,
  selectedCompetitorId,
  onSelectCompetitor,
}: Props) {
  const colors = useTheme();

  if (queue.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <MaterialCommunityIcons name="account-group-outline" size={40} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Chưa Có Danh Sách Thí Sinh</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Vui lòng sang tab Cấu Hình để kết nối Vòng thi. Danh sách đấu thủ sẽ tự động tải theo trạm được phân công.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.sessionNotice, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="information-outline" size={11} color={colors.textSecondary} />
        <Text style={[styles.sessionNoticeText, { color: colors.textSecondary }]}>
          Danh sách thi đấu chính thức | {queue.length} đấu thủ tại Trạm này
        </Text>
      </View>

      <FlatList
        data={queue}
        keyExtractor={item => item.groupCompetitorId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = selectedCompetitorId === item.groupCompetitorId;
          const status = getDisplayState(item, colors);
          const canScore = !item.isCutoffReached && item.canSubmit && (item.sessionState === 'VERIFIED' || item.sessionState === 'SCORING' || item.backendStatus === 'PARTIAL');

          return (
            <View style={[
              styles.rosterItem,
              {
                backgroundColor: colors.backgroundElement,
                borderColor: isSelected ? colors.primary + '80' : colors.border,
                borderWidth: isSelected ? 1.5 : 1,
              },
            ]}>
              <View style={{ flex: 1 }}>
                <View style={styles.rosterNameRow}>
                  <Text style={[styles.rosterName, { color: colors.text }]} numberOfLines={1}>
                    {item.competitorName}
                  </Text>
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
                      <Text style={[styles.selectedBadgeText, { color: colors.primary }]}>ĐANG CHỌN</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.rosterMeta, { color: colors.textSecondary }]}>
                  {item.groupName} | Station {item.stationNumber} | {item.solveProgress}
                </Text>
                <Text style={[styles.rosterTime, { color: colors.textSecondary }]}>
                  Đã hoàn thành {item.submittedSolveCount}/{item.totalSolveCount} lượt thi
                  {item.lastScannedAt ? ` | Quét lúc ${new Date(item.lastScannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </Text>
              </View>

              <View style={styles.rosterActions}>
                <View style={[styles.statusBadge, { backgroundColor: status.background }]}>
                  <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
                </View>

                {canScore ? (
                  <TouchableOpacity
                    style={[styles.scoreBtn, { backgroundColor: colors.primary }]}
                    onPress={() => onSelectCompetitor(item)}
                  >
                    <Text style={styles.scoreBtnText}>Chấm Điểm</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.verifyHint, { color: colors.textSecondary }]}>
                    {item.isCutoffReached ? 'Dừng thi (Cutoff)' : item.backendStatus === 'DONE' ? 'Đã Xong' : 'Quét QR xác nhận'}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 24 },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
  emptySub: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  sessionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    margin: 12,
    marginBottom: 4,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  sessionNoticeText: { fontSize: 10, flex: 1 },
  listContent: { paddingHorizontal: 12, paddingTop: 6, gap: 8, paddingBottom: 20 },
  rosterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  rosterNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rosterName: { fontSize: 14, fontWeight: '900', flexShrink: 1 },
  rosterMeta: { fontSize: 11, marginTop: 2 },
  rosterTime: { fontSize: 9, marginTop: 2 },
  selectedBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  selectedBadgeText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  rosterActions: { alignItems: 'flex-end', gap: 6 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  scoreBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  scoreBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  verifyHint: { fontSize: 10, fontWeight: '700' },
});
