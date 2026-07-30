import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { JudgeHistoryRecord } from '../../types';
import { getJudgeSessionHistory } from '../../services/judgeStore';

export default function JudgeHistoryTab() {
  const colors = Colors.dark;
  const [history, setHistory] = useState<JudgeHistoryRecord[]>(getJudgeSessionHistory());
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(() => {
      const current = getJudgeSessionHistory();
      if (current.length !== history.length) {
        setHistory([...current]);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [history.length]);

  if (history.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <MaterialCommunityIcons name="clipboard-text-clock-outline" size={40} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Chưa Có Lượt Thi Nào Đã Chấm</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Các kết quả thi đấu đã lưu sẽ tự động xuất hiện tại đây để đối soát.
        </Text>
      </View>
    );
  }

  const formatTime = (ms: number | null, isDnf: boolean) => {
    if (isDnf) return 'DNF';
    if (ms === null) return '—';
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.sessionNotice, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="information-outline" size={11} color={colors.textSecondary} />
        <Text style={[styles.sessionNoticeText, { color: colors.textSecondary }]}>
          Lịch sử phiên trực · Đã hoàn thành {history.length} lượt thi
        </Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item, idx) => `${item.groupCompetitorId}-${item.solveNumber}-${idx}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.historyCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <View style={styles.historyRow}>
              <View style={[styles.solveCircle, { borderColor: item.isDnf ? '#ef4444' : '#10b981' }]}>
                <Text style={[styles.solveCircleText, { color: item.isDnf ? '#ef4444' : '#10b981' }]}>
                  Lượt {item.solveNumber}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyName, { color: colors.text }]}>{item.competitorName}</Text>
                <Text style={[styles.historyMeta, { color: colors.textSecondary }]}>
                  {item.eventName} · {item.groupName} · Station {item.stationNumber}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.historyTime, { color: item.isDnf ? '#ef4444' : colors.primary }]}>
                  {formatTime(item.finalTimeMs, item.isDnf)}
                </Text>
                <Text style={[styles.historyTimestamp, { color: colors.textSecondary }]}>
                  {new Date(item.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>

            {/* Evidence Photo Banner */}
            {item.evidencePhotoUrl ? (
              <View style={styles.photoContainer}>
                <TouchableOpacity
                  style={styles.photoThumbBtn}
                  onPress={() => setSelectedPhoto(item.evidencePhotoUrl || null)}
                >
                  <Image source={{ uri: item.evidencePhotoUrl }} style={styles.photoThumb} />
                  <View style={styles.photoBadge}>
                    <MaterialCommunityIcons name="eye-outline" size={12} color="#fff" />
                    <Text style={styles.photoBadgeText}>Xem Tờ Ghi Điểm / Minh Chứng</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      />

      {/* Image Zoom Modal */}
      <Modal visible={Boolean(selectedPhoto)} transparent animationType="fade">
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedPhoto(null)}>
            <MaterialCommunityIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {selectedPhoto ? (
            <Image source={{ uri: selectedPhoto }} style={styles.fullImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 24 },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
  emptySub: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  sessionNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    margin: 12, marginBottom: 4, padding: 8, borderRadius: 8, borderWidth: 1,
  },
  sessionNoticeText: { fontSize: 10, flex: 1 },
  listContent: { paddingHorizontal: 12, paddingTop: 6, gap: 8, paddingBottom: 20 },
  historyCard: {
    borderRadius: 10, borderWidth: 1, padding: 12, gap: 8,
  },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  solveCircle: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  solveCircleText: { fontSize: 10, fontWeight: '900' },
  historyName: { fontSize: 13, fontWeight: '800' },
  historyMeta: { fontSize: 10, marginTop: 1 },
  historyTime: { fontSize: 14, fontWeight: '900' },
  historyTimestamp: { fontSize: 9, marginTop: 1 },
  photoContainer: { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  photoThumbBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 8 },
  photoThumb: { width: 44, height: 44, borderRadius: 6, borderWidth: 1, borderColor: '#334155' },
  photoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  photoBadgeText: { color: '#38bdf8', fontSize: 11, fontWeight: '700' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalCloseBtn: { position: 'absolute', top: 40, right: 20, zIndex: 10, padding: 8 },
  fullImage: { width: '92%', height: '80%' },
});
