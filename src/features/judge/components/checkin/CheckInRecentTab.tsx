import React, { useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';

interface Registration {
  registrationId: string;
  competitorName: string;
  statusCode: string;
}

interface Props {
  allRegistrations: Registration[];
  checkedInIds: Set<string>;
  isLoadingRoster: boolean;
  onRefresh: () => void;
}

export default function CheckInRecentTab({
  allRegistrations,
  checkedInIds,
  isLoadingRoster,
  onRefresh,
}: Props) {
  const colors = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const checkedCount = allRegistrations.filter(r => checkedInIds.has(r.registrationId)).length;
  const totalCount = allRegistrations.length;

  if (isLoadingRoster && allRegistrations.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading competitor roster...
        </Text>
      </View>
    );
  }

  if (allRegistrations.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <MaterialCommunityIcons name="account-group-outline" size={40} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
          No competitors
        </Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Checked-in competitors will appear here. Pull down to refresh.
        </Text>
      </View>
    );
  }

  // Sort: checked-in first, then alphabetical by name
  const sorted = [...allRegistrations].sort((a, b) => {
    const aChecked = checkedInIds.has(a.registrationId) ? 0 : 1;
    const bChecked = checkedInIds.has(b.registrationId) ? 0 : 1;
    if (aChecked !== bChecked) return aChecked - bChecked;
    return a.competitorName.localeCompare(b.competitorName);
  });

  return (
    <View style={{ flex: 1 }}>
      {/* Stats bar */}
      <View style={styles.topHeaderContainer}>
        <View style={[styles.statsBar, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="check-circle" size={14} color="#10b981" />
            <Text style={[styles.statValue, { color: '#10b981' }]}>{checkedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Checked In</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="account-clock-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{totalCount - checkedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Not Yet In</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="account-group-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{totalCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={sorted}
        keyExtractor={item => item.registrationId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingRoster}
            onRefresh={onRefresh}
            colors={['#10b981']}
            tintColor="#10b981"
          />
        }
        renderItem={({ item, index }) => {
          const isCheckedIn = checkedInIds.has(item.registrationId);
          return (
            <View
              style={[
                styles.item,
                {
                  backgroundColor: isCheckedIn
                    ? '#10b98112'
                    : colors.backgroundElement,
                  borderColor: isCheckedIn ? '#10b98140' : colors.border,
                  opacity: isCheckedIn ? 1 : 0.5,
                },
              ]}
            >
              {/* Avatar circle */}
              <View style={[
                styles.avatar,
                {
                  backgroundColor: isCheckedIn ? '#10b981' : colors.border,
                }
              ]}>
                <Text style={styles.avatarText}>
                  {item.competitorName.trim().slice(0, 2).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.itemName,
                    { color: isCheckedIn ? '#065f46' : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {item.competitorName}
                </Text>
                <Text style={[styles.itemOrder, { color: colors.textSecondary }]}>
                  #{index + 1}
                </Text>
              </View>

              {isCheckedIn ? (
                <View style={styles.checkedBadge}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="#10b981" />
                  <Text style={styles.checkedText}>Checked In</Text>
                </View>
              ) : (
                <MaterialCommunityIcons name="circle-outline" size={18} color={colors.border} />
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 24,
  },
  loadingText: { fontSize: 12, marginTop: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  emptySub: { fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 4 },
  topHeaderContainer: {
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  statDivider: { width: 1, height: 36 },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 4,
    gap: 6,
    paddingBottom: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  itemName: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  itemOrder: { fontSize: 10, marginTop: 1 },
  checkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#10b98118',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  checkedText: { fontSize: 10, fontWeight: '800', color: '#10b981' },
});
