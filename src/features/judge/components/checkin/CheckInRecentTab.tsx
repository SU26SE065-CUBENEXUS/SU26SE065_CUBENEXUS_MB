import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { CheckInRecord } from '../../types';

interface Props {
  history: CheckInRecord[];
}

export default function CheckInRecentTab({ history }: Props) {
  const colors = Colors.dark;

  if (history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons name="history" size={36} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Recent Check-ins</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Competitors you check in will appear here.{'\n'}This list is current session only.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Session notice */}
      <View style={[styles.sessionNotice, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="information-outline" size={12} color={colors.textSecondary} />
        <Text style={[styles.sessionNoticeText, { color: colors.textSecondary }]}>
          Current session only — {history.length} check-in{history.length !== 1 ? 's' : ''} recorded
        </Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={item => item.registrationId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.item, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <View style={[styles.statusDot, {
              backgroundColor: item.statusCode === 'ALREADY_CHECKED_IN' ? '#f59e0b' : '#10b981'
            }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemName, { color: colors.text }]}>{item.competitorName}</Text>
              <Text style={[styles.itemStatus, { color: item.statusCode === 'ALREADY_CHECKED_IN' ? '#f59e0b' : '#10b981' }]}>
                {item.statusCode === 'ALREADY_CHECKED_IN' ? 'ALREADY CHECKED IN' : 'CHECKED IN'}
              </Text>
              <Text style={[styles.itemTime, { color: colors.textSecondary }]}>
                {new Date(item.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </Text>
            </View>
            <MaterialCommunityIcons
              name={item.statusCode === 'ALREADY_CHECKED_IN' ? 'check-circle-outline' : 'check-circle'}
              size={18}
              color={item.statusCode === 'ALREADY_CHECKED_IN' ? '#f59e0b' : '#10b981'}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 20 },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
  emptySub: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  sessionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    margin: 12,
    marginBottom: 4,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  sessionNoticeText: { fontSize: 10 },
  listContent: { paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  itemName: { fontSize: 13, fontWeight: '800' },
  itemStatus: { fontSize: 11, fontWeight: '800' },
  itemTime: { fontSize: 10, marginTop: 2 },
});
