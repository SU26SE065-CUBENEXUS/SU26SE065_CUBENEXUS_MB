import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, useColorScheme, StatusBar, Vibration, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type TimerStatus = 'idle' | 'holding' | 'ready' | 'running';

interface Solve {
  id: string;
  time: number; // in ms
  timeString: string;
  scramble: string;
  date: Date;
}

function generateScramble() {
  const moves = ['U', 'D', 'L', 'R', 'F', 'B'];
  const modifiers = ['', "'", '2'];
  const scramble: string[] = [];
  let lastMove = '';
  for (let i = 0; i < 20; i++) {
    let move = moves[Math.floor(Math.random() * moves.length)];
    while (move === lastMove) {
      move = moves[Math.floor(Math.random() * moves.length)];
    }
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    scramble.push(move + modifier);
    lastMove = move;
  }
  return scramble.join(' ');
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
}

export default function PracticeTimer() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'dark']; // Premium dark-theme lock
  const router = useRouter();

  const [status, setStatus] = useState<TimerStatus>('idle');
  const [time, setTime] = useState<number>(0);
  const [scramble, setScramble] = useState<string>('');
  const [solves, setSolves] = useState<Solve[]>([]);

  const timerIntervalRef = useRef<any>(null);
  const startTimestampRef = useRef<number>(0);
  const armingTimeoutRef = useRef<any>(null);

  // Generate initial scramble
  useEffect(() => {
    setScramble(generateScramble());
  }, []);

  const startTimer = useCallback(() => {
    setStatus('running');
    startTimestampRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setTime(Date.now() - startTimestampRef.current);
    }, 10);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const finalTime = Date.now() - startTimestampRef.current;
    setTime(finalTime);
    
    // Add to solves history
    const newSolve: Solve = {
      id: Math.random().toString(),
      time: finalTime,
      timeString: formatTime(finalTime),
      scramble: scramble,
      date: new Date(),
    };
    setSolves((prev) => [newSolve, ...prev]);
    setScramble(generateScramble());
    setStatus('idle');
  }, [scramble]);

  // Touch handlers
  const handleTouchStart = () => {
    if (status === 'running') {
      stopTimer();
    } else if (status === 'idle') {
      setStatus('holding');
      armingTimeoutRef.current = setTimeout(() => {
        setStatus('ready');
        Vibration.vibrate(50); // Light haptic feedback
      }, 700); // 700ms holding to arm
    }
  };

  const handleTouchEnd = () => {
    if (status === 'holding') {
      if (armingTimeoutRef.current) {
        clearTimeout(armingTimeoutRef.current);
      }
      setStatus('idle');
    } else if (status === 'ready') {
      startTimer();
    }
  };

  // Stats calculation
  const getBestTime = () => {
    if (solves.length === 0) return '-';
    const times = solves.map((s) => s.time);
    return formatTime(Math.min(...times)) + 's';
  };

  const getAverage = () => {
    if (solves.length === 0) return '-';
    const sum = solves.reduce((acc, s) => acc + s.time, 0);
    return formatTime(sum / solves.length) + 's';
  };

  const getAo5 = () => {
    if (solves.length < 5) return '-';
    // Take the 5 most recent solves
    const lastFive = solves.slice(0, 5).map((s) => s.time);
    // In cubing, remove best and worst, average middle 3
    const sorted = [...lastFive].sort((a, b) => a - b);
    const middleThree = sorted.slice(1, 4);
    const sum = middleThree.reduce((acc, t) => acc + t, 0);
    return formatTime(sum / 3) + 's';
  };

  // Color selection based on timer status
  const getTimerColor = () => {
    switch (status) {
      case 'holding':
        return '#ef4444'; // Red (holding but not ready)
      case 'ready':
        return '#06d6a0'; // Green (ready to release)
      case 'running':
        return '#ffffff'; // White (running)
      default:
        return colors.text; // Default idle color
    }
  };

  const clearSession = () => {
    setSolves([]);
    setTime(0);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        
        {/* Navigation Header */}
        {status !== 'running' && (
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
            </TouchableOpacity>
            
            <View style={styles.headerLogoRow}>
              <Image
                source={require('@/assets/images/logoCube.png')}
                style={styles.miniLogo}
                resizeMode="contain"
              />
              <View style={styles.miniBrandRow}>
                <Text style={[styles.miniBrandText, { color: colors.text }]}>CUBE</Text>
                <Text style={[styles.miniBrandText, { color: colors.accent }]}>NEXUS</Text>
              </View>
            </View>

            <TouchableOpacity onPress={clearSession} style={styles.clearButton}>
              <MaterialCommunityIcons name="refresh" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Scramble Display */}
        {status !== 'running' && (
          <View style={styles.scrambleContainer}>
            <Text style={[styles.scrambleLabel, { color: colors.primary }]}>SCRAMBLE</Text>
            <Text style={[styles.scrambleText, { color: colors.text }]}>{scramble}</Text>
          </View>
        )}

        {/* Timer Trigger & Visual Display Area */}
        <TouchableOpacity
          style={[
            styles.timerArea,
            status === 'holding' && styles.areaHolding,
            status === 'ready' && styles.areaReady
          ]}
          activeOpacity={1}
          onPressIn={handleTouchStart}
          onPressOut={handleTouchEnd}
        >
          <View style={styles.timerDisplayWrapper}>
            <Text style={[styles.timerText, { color: getTimerColor() }]}>
              {formatTime(time)}
            </Text>
            
            {status === 'idle' && (
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                TOUCH AND HOLD TO ARM TIMER
              </Text>
            )}
            {status === 'holding' && (
              <Text style={[styles.helperText, { color: '#ef4444' }]}>
                WAIT FOR GREEN...
              </Text>
            )}
            {status === 'ready' && (
              <Text style={[styles.helperText, { color: '#06d6a0' }]}>
                RELEASE TO START
              </Text>
            )}
            {status === 'running' && (
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                TAP ANYWHERE TO STOP
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Session Stats & Solve History (Only when not running) */}
        {status !== 'running' && (
          <View style={[styles.historySection, { backgroundColor: colors.backgroundElement, borderTopColor: colors.border }]}>
            
            {/* Quick Stats */}
            <View style={[styles.statsBar, { borderBottomColor: colors.border }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ao5</Text>
                <Text style={[styles.statValue, { color: colors.accent }]}>{getAo5()}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Session Avg</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{getAverage()}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Best</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>{getBestTime()}</Text>
              </View>
            </View>

            {/* Solves History */}
            <View style={styles.historyListWrapper}>
              <View style={styles.historyHeader}>
                <Text style={[styles.historyTitle, { color: colors.text }]}>
                  Solves List ({solves.length})
                </Text>
              </View>
              
              {solves.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="cube-outline" size={48} color={colors.border} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No solves recorded yet in this session.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={solves}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item, index }) => (
                    <View style={[styles.solveItem, { borderBottomColor: colors.border }]}>
                      <View style={styles.solveNumberWrapper}>
                        <Text style={[styles.solveIndex, { color: colors.textSecondary }]}>
                          #{solves.length - index}
                        </Text>
                        <Text style={[styles.solveTime, { color: colors.text }]}>
                          {item.timeString}s
                        </Text>
                      </View>
                      <Text style={[styles.solveScramble, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.scramble}
                      </Text>
                    </View>
                  )}
                />
              )}
            </View>

          </View>
        )}

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  headerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#1f212e',
  },
  miniBrandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  miniBrandText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  clearButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrambleContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrambleLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  scrambleText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  timerArea: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  areaHolding: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  areaReady: {
    backgroundColor: 'rgba(6, 214, 160, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(6, 214, 160, 0.2)',
  },
  timerDisplayWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 72,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  helperText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 12,
  },
  historySection: {
    flex: 1,
    borderTopWidth: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 20,
  },
  statsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  historyListWrapper: {
    flex: 1,
  },
  historyHeader: {
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  solveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  solveNumberWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  solveIndex: {
    fontSize: 12,
    fontWeight: '600',
    width: 32,
  },
  solveTime: {
    fontSize: 15,
    fontWeight: '700',
  },
  solveScramble: {
    fontSize: 12,
    maxWidth: '60%',
  },
});
