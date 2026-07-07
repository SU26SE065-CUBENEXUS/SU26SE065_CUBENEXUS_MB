import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { JudgeHistoryRecord } from '../../types';
import { getJudgeSessionHistory } from '../../services/judgeStore';

export default function JudgeHistoryTab() {
  const colors = Colors.dark;
  const [history, setHistory] = useState<JudgeHistoryRecord[]>(getJudgeSessionHistory());

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
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Submissions Yet</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Submitted scores will appear here.{'\n'}This is current session data only.
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
          Current session · {history.length} result{history.length !== 1 ? 's' : ''} submitted
        </Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item, idx) => `${item.groupCompetitorId}-${item.solveNumber}-${idx}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.historyItem, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <View style={[styles.solveCircle, { borderColor: item.isDnf ? '#ef4444' : '#10b981' }]}>
              <Text style={[styles.solveCircleText, { color: item.isDnf ? '#ef4444' : '#10b981' }]}>
                S{item.solveNumber}
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
                {new Date(item.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            </View>
          </View>
        )}
      />
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
  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, borderWidth: 1, padding: 12, gap: 10,
  },
  solveCircle: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  solveCircleText: { fontSize: 10, fontWeight: '900' },
  historyName: { fontSize: 13, fontWeight: '800' },
  historyMeta: { fontSize: 10, marginTop: 1 },
  historyTime: { fontSize: 14, fontWeight: '900' },
  historyTimestamp: { fontSize: 9, marginTop: 1 },
});
