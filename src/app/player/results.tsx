import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCompetitorRegistrations } from '@/services/competitorService';
import { RegistrationDto, SolveDetailDto } from '@/types/competitor';
import { formatEventLabel } from '@/utils/eventFormatter';

interface SolveRecord {
  solveNumber: number;
  timeMs: number | null; // null if DNF
  formattedTime: string;
  isPenalty2?: boolean;
  isDnf?: boolean;
  isTrimmed?: boolean; // Trimmed min/max in WCA Ao5
}

interface RoundResultBreakdown {
  id: string;
  tournamentName: string;
  tournamentDate: string;
  eventName: string;
  puzzleTypeCode: string;
  roundNumber: number;
  groupName: string;
  stationNumber?: number | null;
  solves: SolveRecord[];
  bestSingleMs: number | null;
  averageMs: number | null;
  bestSingleFormatted: string;
  averageFormatted: string;
  isCompleted: boolean;
}

interface EventSummary {
  puzzleTypeName: string;
  puzzleTypeCode: string;
  eventFormatCode: string;
  pbSingleMs: number | null;
  pbAverageMs: number | null;
  pbSingleFormatted: string;
  pbAverageFormatted: string;
  totalRounds: number;
  rounds: RoundResultBreakdown[];
}

// ─── Format ms into human readable time string ──────────────────────────────────
function formatMs(ms: number | null, isDnf?: boolean, isPenalty2?: boolean): string {
  if (isDnf || ms === null || ms <= 0) return 'DNF';
  const totalMs = isPenalty2 ? ms + 2000 : ms;
  const seconds = Math.floor(totalMs / 1000);
  const remainderMs = totalMs % 1000;
  const centiseconds = Math.floor(remainderMs / 10).toString().padStart(2, '0');
  
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}.${centiseconds}${isPenalty2 ? ' (+2)' : ''}`;
  }
  return `${seconds}.${centiseconds}s${isPenalty2 ? ' (+2)' : ''}`;
}

// ─── Calculate WCA Ao5 Average ───────────────────────────────────────────────────
function calculateAo5(solves: SolveRecord[]): { averageMs: number | null; averageFormatted: string } {
  if (!solves || solves.length < 5) {
    return { averageMs: null, averageFormatted: solves.length > 0 ? 'In Progress' : '—' };
  }

  const validSolves = solves.map((s) => s.timeMs);
  const dnfCount = validSolves.filter((t) => t === null).length;

  if (dnfCount >= 2) {
    return { averageMs: null, averageFormatted: 'DNF' };
  }

  const numbers = validSolves.map((t) => (t === null ? Infinity : t));
  const minVal = Math.min(...numbers);
  const maxVal = Math.max(...numbers);

  // Mark trimmed min and max
  let trimmedMin = false;
  let trimmedMax = false;

  solves.forEach((s) => {
    const val = s.timeMs === null ? Infinity : s.timeMs;
    if (!trimmedMin && val === minVal) {
      s.isTrimmed = true;
      trimmedMin = true;
    } else if (!trimmedMax && val === maxVal) {
      s.isTrimmed = true;
      trimmedMax = true;
    } else {
      s.isTrimmed = false;
    }
  });

  const activeThree = numbers.filter((_, idx) => {
    if (idx === numbers.indexOf(minVal)) return false;
    if (idx === numbers.indexOf(maxVal)) return false;
    return true;
  });

  if (activeThree.length < 3 || activeThree.some((t) => t === Infinity)) {
    return { averageMs: null, averageFormatted: 'DNF' };
  }

  const sum = activeThree.reduce((acc, curr) => acc + curr, 0);
  const avg = Math.round(sum / 3);
  return { averageMs: avg, averageFormatted: formatMs(avg) };
}

export default function ResultsScreen() {
  const colors = useTheme();
  const scheme = useColorScheme();
  const { accessToken } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [registrations, setRegistrations] = useState<RegistrationDto[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('ALL');

  const loadResultsData = useCallback(async (showIndicator = true) => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }
    if (showIndicator) setIsLoading(true);
    try {
      const data = await fetchCompetitorRegistrations(accessToken);
      setRegistrations(data);
    } catch (err) {
      console.warn('Failed loading competitor real results:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadResultsData();
  }, [loadResultsData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadResultsData(false);
  };

  // ─── Process REAL backend registrations and solve records ──────────────────────
  const eventSummaries: EventSummary[] = useMemo(() => {
    const map = new Map<string, EventSummary>();

    registrations.forEach((reg) => {
      if (!reg.registeredEvents) return;

      reg.registeredEvents.forEach((evt) => {
        const formattedLabel = formatEventLabel(evt);
        const typeCode = evt.eventId || evt.puzzleTypeName.toUpperCase().replace(/\s+/g, '_');
        
        if (!map.has(typeCode)) {
          map.set(typeCode, {
            puzzleTypeName: formattedLabel,
            puzzleTypeCode: typeCode,
            eventFormatCode: evt.eventFormatCode || 'Ao5',
            pbSingleMs: null,
            pbAverageMs: null,
            pbSingleFormatted: '—',
            pbAverageFormatted: '—',
            totalRounds: 0,
            rounds: [],
          });
        }

        const currentSum = map.get(typeCode)!;
        const assignmentsList = evt.assignments || (evt.assignment ? [evt.assignment] : []);

        assignmentsList.forEach((a) => {
          const roundId = `${reg.registrationId}_${evt.registrationEventId}_${a.roundNumber}`;
          
          // Map real solve details returned from backend
          const realSolves: SolveRecord[] = (a.solves || []).map((s: SolveDetailDto) => {
            const isDnf = s.isDnf || s.finalTimeMs === null;
            return {
              solveNumber: s.solveNumber,
              timeMs: isDnf ? null : s.finalTimeMs ?? s.rawTimeMs ?? null,
              formattedTime: formatMs(s.finalTimeMs ?? s.rawTimeMs ?? null, isDnf),
              isDnf,
            };
          });

          // Calculate Round Single & Average
          const validTimes = realSolves.map((s) => s.timeMs).filter((t): t is number => t !== null);
          const bestSingleMs = validTimes.length > 0 ? Math.min(...validTimes) : null;
          const bestSingleFormatted = bestSingleMs !== null ? formatMs(bestSingleMs) : '—';
          
          const { averageMs, averageFormatted } = calculateAo5(realSolves);

          const existingIdx = currentSum.rounds.findIndex((r) => r.id === roundId);
          const roundData: RoundResultBreakdown = {
            id: roundId,
            tournamentName: reg.tournamentName,
            tournamentDate: reg.tournamentStartDate 
              ? new Date(reg.tournamentStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Official',
            eventName: formattedLabel,
            puzzleTypeCode: typeCode,
            roundNumber: a.roundNumber,
            groupName: a.groupName || `Group ${a.groupId?.substring(0, 4)}`,
            stationNumber: a.stationNumber,
            solves: realSolves,
            bestSingleMs,
            averageMs,
            bestSingleFormatted,
            averageFormatted,
            isCompleted: reg.tournamentStatusCode === 'COMPLETED' || a.groupStatusCode === 'COMPLETED' || a.competitorStatusCode === 'COMPLETED' || realSolves.length >= 5,
          };

          if (existingIdx !== -1) {
            currentSum.rounds[existingIdx] = roundData;
          } else {
            currentSum.rounds.push(roundData);
          }
        });

        currentSum.totalRounds = currentSum.rounds.length;

        // Calculate Event PBs across all rounds
        let minSingle: number | null = null;
        let minAverage: number | null = null;

        currentSum.rounds.forEach((rd) => {
          if (rd.bestSingleMs !== null) {
            if (minSingle === null || rd.bestSingleMs < minSingle) {
              minSingle = rd.bestSingleMs;
            }
          }
          if (rd.averageMs !== null) {
            if (minAverage === null || rd.averageMs < minAverage) {
              minAverage = rd.averageMs;
            }
          }
        });

        currentSum.pbSingleMs = minSingle;
        currentSum.pbSingleFormatted = minSingle !== null ? formatMs(minSingle) : '—';
        currentSum.pbAverageMs = minAverage;
        currentSum.pbAverageFormatted = minAverage !== null ? formatMs(minAverage) : '—';
      });
    });

    return Array.from(map.values());
  }, [registrations]);

  // ─── Filtered Events List ────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (selectedEventId === 'ALL') return eventSummaries;
    return eventSummaries.filter((e) => e.puzzleTypeCode === selectedEventId);
  }, [eventSummaries, selectedEventId]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        
        {/* Header Branding */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Personal Solve Results</Text>
          <View style={[styles.headerBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
            <Text style={[styles.headerBadgeText, { color: colors.primary }]}>LIVE DATABASE</Text>
          </View>
        </View>

        {/* Event Filter Chip Bar */}
        {eventSummaries.length > 0 && (
          <View style={[styles.filterBar, { backgroundColor: colors.backgroundElement, borderBottomColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedEventId === 'ALL'
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.backgroundSelected, borderColor: colors.border }
                ]}
                onPress={() => setSelectedEventId('ALL')}
              >
                <MaterialCommunityIcons
                  name="format-list-bulleted"
                  size={14}
                  color={selectedEventId === 'ALL' ? '#ffffff' : colors.text}
                />
                <Text style={[styles.filterChipText, { color: selectedEventId === 'ALL' ? '#ffffff' : colors.text }]}>
                  All Events ({eventSummaries.length})
                </Text>
              </TouchableOpacity>

              {eventSummaries.map((evt) => {
                const isSelected = selectedEventId === evt.puzzleTypeCode;
                return (
                  <TouchableOpacity
                    key={evt.puzzleTypeCode}
                    style={[
                      styles.filterChip,
                      isSelected
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.backgroundSelected, borderColor: colors.border }
                    ]}
                    onPress={() => setSelectedEventId(evt.puzzleTypeCode)}
                  >
                    <MaterialCommunityIcons
                      name="cube-outline"
                      size={14}
                      color={isSelected ? '#ffffff' : colors.primary}
                    />
                    <Text style={[styles.filterChipText, { color: isSelected ? '#ffffff' : colors.text }]}>
                      {evt.puzzleTypeName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Main Content List */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Fetching your official competition results...</Text>
            </View>
          ) : filteredEvents.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="trophy-outline" size={48} color={colors.textSecondary + '60'} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Tournament Results Found</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                You have not registered for any tournament rounds yet. Register for a competition in the Tournament Hub to record your official solve times!
              </Text>
            </View>
          ) : (
            <View style={styles.eventGroupContainer}>
              {filteredEvents.map((evt) => (
                <View key={evt.puzzleTypeCode} style={styles.eventSection}>
                  
                  {/* Event Group Title Bar */}
                  <View style={styles.eventHeaderRow}>
                    <View style={styles.eventHeaderTitleBox}>
                      <MaterialCommunityIcons name="cube" size={20} color={colors.primary} />
                      <Text style={[styles.eventHeaderTitle, { color: colors.text }]}>
                        {evt.puzzleTypeName}
                      </Text>
                      <View style={[styles.formatTag, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '35' }]}>
                        <Text style={[styles.formatTagText, { color: colors.accent }]}>
                          {evt.eventFormatCode}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.roundsCountText, { color: colors.textSecondary }]}>
                      {evt.rounds.length} {evt.rounds.length === 1 ? 'Round' : 'Rounds'}
                    </Text>
                  </View>

                  {/* Personal Best Summary Card */}
                  <View style={[styles.pbCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                    <View style={styles.pbHeader}>
                      <MaterialCommunityIcons name="star-circle-outline" size={16} color={colors.accent} />
                      <Text style={[styles.pbTitle, { color: colors.text }]}>PERSONAL BESTS (PB)</Text>
                    </View>

                    <View style={styles.pbStatsRow}>
                      <View style={styles.pbStatItem}>
                        <Text style={[styles.pbStatLabel, { color: colors.textSecondary }]}>BEST SINGLE</Text>
                        <Text style={[styles.pbStatValue, { color: colors.accent }]}>{evt.pbSingleFormatted}</Text>
                      </View>

                      <View style={[styles.pbDivider, { backgroundColor: colors.border }]} />

                      <View style={styles.pbStatItem}>
                        <Text style={[styles.pbStatLabel, { color: colors.textSecondary }]}>BEST AVERAGE</Text>
                        <Text style={[styles.pbStatValue, { color: colors.success }]}>{evt.pbAverageFormatted}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Competition Rounds & Solves Breakdown */}
                  {evt.rounds && evt.rounds.length > 0 && (
                    <View style={styles.roundsList}>
                      <Text style={[styles.roundsSectionHeading, { color: colors.textSecondary }]}>
                        OFFICIAL ROUND SOLVES
                      </Text>

                      {evt.rounds.map((rd) => (
                        <View
                          key={rd.id}
                          style={[
                            styles.roundCard,
                            { backgroundColor: colors.backgroundElement, borderColor: colors.border }
                          ]}
                        >
                          {/* Round Header */}
                          <View style={styles.roundCardHeader}>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.roundTourName, { color: colors.text }]} numberOfLines={1}>
                                {rd.tournamentName}
                              </Text>
                              <Text style={[styles.roundMeta, { color: colors.textSecondary }]}>
                                {rd.tournamentDate} • Round {rd.roundNumber} • {rd.groupName}
                                {rd.stationNumber ? ` • Station ${rd.stationNumber}` : ''}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor: rd.isCompleted ? colors.success + '15' : colors.primary + '15',
                                  borderColor: rd.isCompleted ? colors.success + '30' : colors.primary + '30',
                                }
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  { color: rd.isCompleted ? colors.success : colors.primary }
                                ]}
                              >
                                {rd.isCompleted ? 'COMPLETED' : 'IN PROGRESS'}
                              </Text>
                            </View>
                          </View>

                          {/* Solves List Grid */}
                          <View style={[styles.solvesGrid, { backgroundColor: colors.background, borderColor: colors.border }]}>
                            {rd.solves && rd.solves.length > 0 ? (
                              rd.solves.map((s) => (
                                <View key={s.solveNumber} style={styles.solveChipItem}>
                                  <Text style={[styles.solveNumLabel, { color: colors.textSecondary }]}>
                                    S{s.solveNumber}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.solveTimeVal,
                                      {
                                        color: s.isDnf ? '#ef4444' : s.isTrimmed ? colors.textSecondary : colors.text,
                                        textDecorationLine: s.isTrimmed ? 'line-through' : 'none',
                                      }
                                    ]}
                                  >
                                    {s.isTrimmed ? `(${s.formattedTime})` : s.formattedTime}
                                  </Text>
                                </View>
                              ))
                            ) : (
                              <Text style={[styles.noSolvesNotice, { color: colors.textSecondary }]}>
                                Scheduled round — no solve times recorded by station judge yet.
                              </Text>
                            )}
                          </View>

                          {/* Round Summary Bar */}
                          <View style={[styles.roundSummaryBar, { borderTopColor: colors.border }]}>
                            <View style={styles.roundStatBox}>
                              <Text style={[styles.roundStatLabel, { color: colors.textSecondary }]}>Round Single</Text>
                              <Text style={[styles.roundStatVal, { color: colors.accent }]}>{rd.bestSingleFormatted}</Text>
                            </View>
                            <View style={styles.roundStatBox}>
                              <Text style={[styles.roundStatLabel, { color: colors.textSecondary }]}>Round Average ({evt.eventFormatCode})</Text>
                              <Text style={[styles.roundStatVal, { color: colors.success }]}>{rd.averageFormatted}</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                </View>
              ))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 54,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  headerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerBadgeText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5 },

  // Filter Chip Bar
  filterBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterChipRow: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 11.5, fontWeight: '700' },

  // Scroll Content
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  loadingContainer: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, fontWeight: '600' },

  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  emptySub: { fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // Event Groups
  eventGroupContainer: { gap: 24 },
  eventSection: { gap: 12 },
  eventHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventHeaderTitleBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventHeaderTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  formatTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  formatTagText: { fontSize: 9, fontWeight: '800' },
  roundsCountText: { fontSize: 11, fontWeight: '700' },

  // Personal Best Card
  pbCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  pbHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pbTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  pbStatsRow: { flexDirection: 'row', alignItems: 'center' },
  pbStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  pbStatLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  pbStatValue: { fontSize: 18, fontWeight: '900' },
  pbDivider: { width: 1, height: 36 },

  // Rounds List
  roundsList: { gap: 10, marginTop: 4 },
  roundsSectionHeading: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  roundCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  roundCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  roundTourName: { fontSize: 14, fontWeight: '800' },
  roundMeta: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5 },

  // Solves Grid
  solvesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  solveChipItem: { alignItems: 'center', minWidth: 44 },
  solveNumLabel: { fontSize: 8.5, fontWeight: '800', marginBottom: 1 },
  solveTimeVal: { fontSize: 11.5, fontWeight: '800' },
  noSolvesNotice: { fontSize: 11, fontStyle: 'italic', textAlign: 'center', width: '100%' },

  // Round Summary Bar
  roundSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  roundStatBox: { alignItems: 'center', gap: 1 },
  roundStatLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  roundStatVal: { fontSize: 13, fontWeight: '900' },
});
