import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface PersonalBest {
  eventId: string;
  eventName: string;
  single: string;
  average: string;
  nationalRankSingle?: number;
  nationalRankAverage?: number;
}

export default function ResultsScreen() {
  const colors = Colors.dark;

  // Real or mock personal best records
  const personalBests: PersonalBest[] = [
    {
      eventId: '333',
      eventName: '3x3x3 Cube',
      single: '8.54s',
      average: '10.21s',
      nationalRankSingle: 45,
      nationalRankAverage: 52,
    },
    {
      eventId: '444',
      eventName: '4x4x4 Cube',
      single: '42.31s',
      average: '48.95s',
      nationalRankSingle: 72,
      nationalRankAverage: 68,
    },
    {
      eventId: '222',
      eventName: '2x2x2 Cube',
      single: '2.12s',
      average: '3.45s',
      nationalRankSingle: 102,
      nationalRankAverage: 120,
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>My Results</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {personalBests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="trophy-outline" size={64} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No official results yet</Text>
              <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                Participate in official tournament rounds to record your solve times, averages, and national ranks.
              </Text>
            </View>
          ) : (
            <View style={styles.statsContainer}>
              
              {/* PB Section Heading */}
              <View style={styles.sectionHeader}>
                <MaterialCommunityIcons name="star-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Bests (PBs)</Text>
              </View>

              {/* PB Grid */}
              <View style={styles.pbList}>
                {personalBests.map((pb) => (
                  <View 
                    key={pb.eventId} 
                    style={[styles.pbCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
                  >
                    <View style={styles.pbCardHeader}>
                      <Text style={[styles.pbEventName, { color: colors.text }]}>{pb.eventName}</Text>
                      <MaterialCommunityIcons name="cube-outline" size={16} color={colors.primary} />
                    </View>

                    <View style={styles.pbStatsRow}>
                      <View style={styles.pbStatItem}>
                        <Text style={[styles.pbStatLabel, { color: colors.textSecondary }]}>Single</Text>
                        <Text style={[styles.pbStatValue, { color: colors.accent }]}>{pb.single}</Text>
                        {pb.nationalRankSingle && (
                          <Text style={[styles.pbRank, { color: colors.textSecondary }]}>
                            Rank: #{pb.nationalRankSingle}
                          </Text>
                        )}
                      </View>

                      <View style={[styles.divider, { backgroundColor: colors.border }]} />

                      <View style={styles.pbStatItem}>
                        <Text style={[styles.pbStatLabel, { color: colors.textSecondary }]}>Average</Text>
                        <Text style={[styles.pbStatValue, { color: colors.success }]}>{pb.average}</Text>
                        {pb.nationalRankAverage && (
                          <Text style={[styles.pbRank, { color: colors.textSecondary }]}>
                            Rank: #{pb.nationalRankAverage}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Achievements banner */}
              <View style={[styles.achievementBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                <MaterialCommunityIcons name="medal-outline" size={24} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.achievementTitle, { color: colors.text }]}>National Contender</Text>
                  <Text style={[styles.achievementDesc, { color: colors.textSecondary }]}>
                    You rank in the top 100 nationally for multiple events! Keep practicing to claim a podium spot.
                  </Text>
                </View>
              </View>

            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    height: 56,
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  
  // Empty
  emptyContainer: { paddingVertical: 120, alignItems: 'center', gap: 10, paddingHorizontal: 24 },
  emptyText: { fontSize: 16, fontWeight: '800' },
  emptySubText: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // Content
  statsContainer: { gap: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },

  // PB Grid
  pbList: { gap: 12 },
  pbCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
  pbCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pbEventName: { fontSize: 14, fontWeight: '800' },
  pbStatsRow: { flexDirection: 'row', alignItems: 'center' },
  pbStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  pbStatLabel: { fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  pbStatValue: { fontSize: 16, fontWeight: '900' },
  pbRank: { fontSize: 10, fontWeight: '500' },
  divider: { width: 1, height: 40 },

  // Banner
  achievementBanner: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginTop: 10, alignItems: 'center' },
  achievementTitle: { fontSize: 13, fontWeight: '800' },
  achievementDesc: { fontSize: 11, fontWeight: '500', lineHeight: 16, marginTop: 2 },
});
