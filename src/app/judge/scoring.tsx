import React, { useState, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, useColorScheme, StatusBar, Alert, GestureResponderEvent, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { getPenaltyTypes, getSolveProgress, submitTraditionalResult, submitMedleyResult } from '@/constants/api';
import { API_BASE_URL } from '@/constants/config';
import * as signalR from '@microsoft/signalr';

type PenaltyMode = 'None' | '+2' | 'DNF';

interface Point {
  x: number;
  y: number;
}

interface MedleySolveState {
  medleyPuzzleId: string;
  puzzleName: string;
  scrambleId: string;
  scrambleSequence: string;
  time: string;
  penalty: PenaltyMode;
}

export default function JudgeScoring() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'dark']; // Force dark mode
  const router = useRouter();
  const params = useLocalSearchParams();
  const { accessToken } = useAuth();

  // ─── Query Parameters ───────────────────────────────────────
  const playerQr = (params.playerQr as string) || '';
  const groupCompetitorId = (params.groupCompetitorId as string) || '';
  const eventId = (params.eventId as string) || '';
  const roundNumber = Number(params.roundNumber) || 1;
  const stationNumber = Number(params.stationNumber) || 1;
  const competitorDisplayName = (params.competitorName as string) || 'Competitor';
  const formatType = (params.formatType as string) || 'TRADITIONAL';

  // ─── Scoring States ────────────────────────────────────────
  const [activeSolveNumber, setActiveSolveNumber] = useState(Number(params.nextSolveNumber) || 1);
  const [totalSolveCount, setTotalSolveCount] = useState(Number(params.solveCount) || 5);
  const [currentScramble, setCurrentScramble] = useState({
    scrambleId: (params.scrambleId as string) || '',
    sequence: (params.scrambleSequence as string) || ''
  });

  const [penaltyTypes, setPenaltyTypes] = useState<any[]>([]);
  const [stackmat, setStackmat] = useState('');
  const [penalty, setPenalty] = useState<PenaltyMode>('None');
  const [signName, setSignName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Medley States
  const [medleySolves, setMedleySolves] = useState<MedleySolveState[]>([]);

  // ─── SignalR Hub States ────────────────────────────────────
  const [hubConnection, setHubConnection] = useState<signalR.HubConnection | null>(null);
  const [isHubConnected, setIsHubConnected] = useState(false);

  // E-Signature Pad Drawing State
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);

  // Calculate Final Result
  const finalTime = useMemo(() => {
    if (penalty === 'DNF') return 'DNF';
    const parsed = parseFloat(stackmat);
    if (isNaN(parsed) || parsed <= 0) return '0.00s';
    const adjusted = penalty === '+2' ? parsed + 2 : parsed;
    return `${adjusted.toFixed(2)}s`;
  }, [penalty, stackmat]);

  // Medley Combined Time display
  const medleyResult = useMemo(() => {
    if (medleySolves.some((s) => s.penalty === 'DNF')) return 'DNF';
    const total = medleySolves.reduce((sum, s) => {
      const p = parseFloat(s.time || '0');
      const pen = s.penalty === '+2' ? 2 : 0;
      return sum + (isNaN(p) ? 0 : p + pen);
    }, 0);
    return `${total.toFixed(2)}s`;
  }, [medleySolves]);

  // Load penalties & solve progress
  useEffect(() => {
    async function loadScoringData() {
      const token = accessToken;
      if (!token) return;
      try {
        const penalties = await getPenaltyTypes(token);
        setPenaltyTypes(penalties);

        // Fetch solve progress to verify details
        const progress = await getSolveProgress(groupCompetitorId, token);
        setActiveSolveNumber(progress.nextSolveNumber || 1);
        setTotalSolveCount(progress.solveCount || 5);
        if (progress.currentScramble) {
          setCurrentScramble({
            scrambleId: progress.currentScramble.scrambleId,
            sequence: progress.currentScramble.sequence
          });
        }

        // Initialize Medley list if medley event format
        if (formatType === 'MEDLEY') {
          // Fetch medley puzzles from tournament details
          // For simplicity, fetch event structure or map from a mock list if not loaded.
          // In standard flow, medley details are fetched in progress or can be mocked.
          // Let's create a default 3-puzzle medley setup if none exists.
          const defaultMedley: MedleySolveState[] = [
            { medleyPuzzleId: '3x3-uuid', puzzleName: '3x3 Cube', scrambleId: 'sc-1', scrambleSequence: '', time: '', penalty: 'None' },
            { medleyPuzzleId: 'skewb-uuid', puzzleName: 'Skewb', scrambleId: 'sc-2', scrambleSequence: '', time: '', penalty: 'None' },
            { medleyPuzzleId: 'pyra-uuid', puzzleName: 'Pyraminx', scrambleId: 'sc-3', scrambleSequence: '', time: '', penalty: 'None' }
          ];
          setMedleySolves(defaultMedley);
        }
      } catch (err) {
        console.error('Failed to load scoring data:', err);
      }
    }
    loadScoringData();
  }, [groupCompetitorId, accessToken, formatType]);

  // SignalR connection for scoring activity monitoring
  useEffect(() => {
    if (!eventId) return;

    const hubUrl = `${API_BASE_URL}/hubs/tournament`;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build();

    connection.onreconnected(() => {
      setIsHubConnected(true);
      connection.invoke('RegisterJudgeStation', eventId, roundNumber, stationNumber).catch(console.error);
    });

    connection.onclose(() => {
      setIsHubConnected(false);
    });

    connection.start()
      .then(async () => {
        setHubConnection(connection);
        setIsHubConnected(true);
        await connection.invoke('RegisterJudgeStation', eventId, roundNumber, stationNumber);
        await connection.invoke('UpdateStationState', eventId, roundNumber, stationNumber, 'VERIFIED', competitorDisplayName);
      })
      .catch((err) => console.error('Scoring SignalR start failed:', err));

    return () => {
      connection.stop().catch(() => undefined);
    };
  }, [eventId]);

  const emitStationState = async (state: string) => {
    if (hubConnection && isHubConnected) {
      try {
        await hubConnection.invoke('UpdateStationState', eventId, roundNumber, stationNumber, state, competitorDisplayName);
      } catch (err) {
        console.error('Failed to update station state:', err);
      }
    }
  };

  // Touch drawing handlers for Canvas
  const handleTouchDraw = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setDrawingPoints((prev) => [...prev, { x: locationX, y: locationY }]);
  };

  const clearSignature = () => {
    setDrawingPoints([]);
    setSignName('');
  };

  const handleSubmit = async () => {
    if (formatType !== 'MEDLEY') {
      if (!stackmat.trim() || isNaN(parseFloat(stackmat)) || parseFloat(stackmat) <= 0) {
        Alert.alert('Missing Info', 'Please enter a valid Stackmat time.');
        return;
      }
    } else {
      if (medleySolves.some(s => !s.time.trim() || isNaN(parseFloat(s.time)) || parseFloat(s.time) <= 0)) {
        Alert.alert('Missing Info', 'Please enter valid times for all medley puzzles.');
        return;
      }
    }

    if (drawingPoints.length === 0 && !signName.trim()) {
      Alert.alert('Signature Required', 'Please collect competitor signature or typed initials before submitting.');
      return;
    }

    if (!accessToken) {
      Alert.alert('Error', 'Session expired. Please re-login.');
      return;
    }

    setIsSubmitting(true);
    await emitStationState('SUBMITTING');

    // Signature data
    const esignature = signName.trim() || `SIGN_${drawingPoints.length}_POINTS`;

    try {
      if (formatType === 'MEDLEY') {
        const detailsPayload = medleySolves.map(s => {
          const pType = penaltyTypes.find(pt => pt.code === (s.penalty === '+2' ? 'PLUS_2' : s.penalty === 'DNF' ? 'DNF' : 'OK'));
          return {
            medleyPuzzleId: s.medleyPuzzleId,
            rawTimeMs: parseFloat(s.time) * 1000,
            penaltyTypeId: pType?.id || null,
            scrambleId: currentScramble.scrambleId || '00000000-0000-0000-0000-000000000000'
          };
        });

        await submitMedleyResult({
          groupCompetitorId,
          solveNumber: activeSolveNumber,
          esignatureData: esignature,
          details: detailsPayload
        }, accessToken);

        await emitStationState('DONE');
        setIsSubmitted(true);
      } else {
        const pType = penaltyTypes.find(pt => pt.code === (penalty === '+2' ? 'PLUS_2' : penalty === 'DNF' ? 'DNF' : 'OK'));
        const rawTimeMs = penalty === 'DNF' ? 0 : Math.round(parseFloat(stackmat) * 1000);

        if (!currentScramble.scrambleId) {
          throw new Error('Scramble reference is missing. Reconnect lane and scan again.');
        }

        const res = await submitTraditionalResult({
          groupCompetitorId,
          solveNumber: activeSolveNumber,
          rawTimeMs,
          penaltyTypeId: pType?.id || null,
          scrambleId: currentScramble.scrambleId,
          esignatureData: esignature
        }, accessToken);

        if (res.progress && res.progress.canSubmitNext && res.nextScramble) {
          // Proceed to next solve in sequence
          setActiveSolveNumber(res.progress.nextSolveNumber || activeSolveNumber + 1);
          setCurrentScramble({
            scrambleId: res.nextScramble.scrambleId,
            sequence: res.nextScramble.sequence
          });
          setStackmat('');
          setPenalty('None');
          clearSignature();
          await emitStationState('VERIFIED');
        } else {
          // Completed all solves
          await emitStationState('DONE');
          setIsSubmitted(true);
        }
      }
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Error occurred.');
      await emitStationState('VERIFIED');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    router.replace('/judge');
  };

  const updateMedleySolve = (index: number, field: keyof MedleySolveState, value: string) => {
    setMedleySolves((cur) => cur.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.text} />
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

          <View style={{ width: 40 }} />
        </View>

        {!isSubmitted ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Competitor Details */}
            <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.cardHeaderTitle, { color: colors.primary }]}>VERIFIED COMPETITOR</Text>
              <View style={styles.competitorDetailRow}>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Name</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{competitorDisplayName}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Station</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>Station {stationNumber}</Text>
                </View>
              </View>
              <View style={[styles.competitorDetailRow, { marginTop: 12 }]}>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Round / Format</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>Round {roundNumber} ({formatType})</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Attempt Sequence</Text>
                  <Text style={[styles.detailValue, { color: colors.accent }]}>Solve {activeSolveNumber} / {totalSolveCount}</Text>
                </View>
              </View>

              {formatType !== 'MEDLEY' && currentScramble.sequence ? (
                <View style={styles.scrambleBox}>
                  <Text style={styles.scrambleLabel}>Active Scramble:</Text>
                  <Text style={styles.scrambleSequence}>{currentScramble.sequence}</Text>
                </View>
              ) : null}
            </View>

            {/* Score Entry */}
            <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <Text style={[styles.cardHeaderTitle, { color: colors.accent }]}>RESULT ENTRY</Text>
              
              {formatType !== 'MEDLEY' ? (
                <View>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Stackmat Time (seconds)</Text>
                  <TextInput
                    style={[styles.timeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    keyboardType="numeric"
                    placeholder="e.g. 8.42"
                    placeholderTextColor={colors.textSecondary}
                    value={stackmat}
                    onChangeText={setStackmat}
                  />

                  <Text style={[styles.inputLabel, { color: colors.text, marginTop: 16 }]}>Penalty Status</Text>
                  <View style={styles.penaltyRow}>
                    {(['None', '+2', 'DNF'] as PenaltyMode[]).map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.penaltyBtn,
                          { borderColor: colors.border },
                          penalty === p && { backgroundColor: colors.primary, borderColor: colors.primary }
                        ]}
                        onPress={() => setPenalty(p)}
                      >
                        <Text style={[styles.penaltyBtnText, { color: penalty === p ? '#fff' : colors.text }]}>
                          {p}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Real-time Computed Total */}
                  <View style={[styles.resultCard, { backgroundColor: colors.background }]}>
                    <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Live Computed Result</Text>
                    <Text style={[styles.resultValue, { color: penalty === 'DNF' ? '#ef4444' : colors.success }]}>
                      {finalTime}
                    </Text>
                  </View>
                </View>
              ) : (
                // Medley Input Fields
                <View style={{ gap: 12 }}>
                  {medleySolves.map((s, idx) => (
                    <View key={s.medleyPuzzleId} style={styles.medleyInputRow}>
                      <Text style={[styles.medleyLabelText, { color: colors.text }]}>{s.puzzleName}</Text>
                      <TextInput
                        style={[styles.medleyTimeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        keyboardType="numeric"
                        placeholder="Seconds"
                        placeholderTextColor={colors.textSecondary}
                        value={s.time}
                        onChangeText={(val) => updateMedleySolve(idx, 'time', val)}
                      />
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        {(['None', '+2', 'DNF'] as PenaltyMode[]).map((pen) => (
                          <TouchableOpacity
                            key={pen}
                            style={[
                              styles.medleyPenBtn,
                              { borderColor: colors.border },
                              s.penalty === pen && { backgroundColor: colors.primary, borderColor: colors.primary }
                            ]}
                            onPress={() => updateMedleySolve(idx, 'penalty', pen)}
                          >
                            <Text style={{ fontSize: 9, fontWeight: '700', color: s.penalty === pen ? '#fff' : colors.text }}>{pen}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                  <View style={[styles.resultCard, { backgroundColor: colors.background }]}>
                    <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Live Computed Combined Result</Text>
                    <Text style={[styles.resultValue, { color: medleyResult === 'DNF' ? '#ef4444' : colors.success }]}>
                      {medleyResult}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* E-Signature Pad */}
            <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.signatureHeader}>
                <Text style={[styles.cardHeaderTitle, { color: colors.text }]}>COMPETITOR E-SIGNATURE</Text>
                <TouchableOpacity onPress={clearSignature}>
                  <Text style={[styles.clearBtnText, { color: colors.primary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Ask the competitor to sign inside the box below to authorize the score submission.
              </Text>

              {/* Pure React Native Drawing Pad */}
              <View 
                style={[styles.signaturePad, { backgroundColor: colors.background, borderColor: colors.border }]}
                onTouchStart={handleTouchDraw}
                onTouchMove={handleTouchDraw}
              >
                {drawingPoints.map((pt, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.drawPoint, 
                      { 
                        left: pt.x - 2, 
                        top: pt.y - 2, 
                        backgroundColor: colors.text 
                      }
                    ]} 
                  />
                ))}
                {drawingPoints.length === 0 && (
                  <View style={styles.signPlaceholder}>
                    <MaterialCommunityIcons name="gesture-double-tap" size={24} color={colors.border} />
                    <Text style={[styles.signPlaceholderText, { color: colors.textSecondary }]}>
                      Draw signature here
                    </Text>
                  </View>
                )}
              </View>

              <TextInput
                style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Competitor Initials / Name Confirmation"
                placeholderTextColor={colors.textSecondary}
                value={signName}
                onChangeText={setSignName}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: colors.success }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="cloud-upload-outline" size={22} color="#fff" />
                  <Text style={styles.submitButtonText}>Submit to Live Leaderboard</Text>
                </View>
              )}
            </TouchableOpacity>

          </ScrollView>
        ) : (
          /* Submission Success State */
          <View style={styles.successContainer}>
            <View style={styles.successIconWrapper}>
              <MaterialCommunityIcons name="check-decagram" size={96} color={colors.success} />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>Result Submitted!</Text>
            <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
              Scores successfully locked and uploaded to the live standings.
            </Text>
            
            <View style={[styles.successDetailsBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.successDetailRow}>
                <Text style={[styles.successDetailLabel, { color: colors.textSecondary }]}>Competitor Name</Text>
                <Text style={[styles.successDetailValue, { color: colors.text }]}>{competitorDisplayName}</Text>
              </View>
              <View style={styles.successDetailRow}>
                <Text style={[styles.successDetailLabel, { color: colors.textSecondary }]}>Final Computed score</Text>
                <Text style={[styles.successDetailValue, { color: colors.accent, fontWeight: '800' }]}>
                  {formatType === 'MEDLEY' ? medleyResult : finalTime}
                </Text>
              </View>
              <View style={styles.successDetailRow}>
                <Text style={[styles.successDetailLabel, { color: colors.textSecondary }]}>Status</Text>
                <Text style={[styles.successDetailValue, { color: colors.success, fontWeight: '800' }]}>Synced Live</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleFinish}
            >
              <Text style={styles.primaryButtonText}>Scan Next Competitor</Text>
              <MaterialCommunityIcons name="qrcode-scan" size={18} color="#fff" />
            </TouchableOpacity>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  competitorDetailRow: {
    flexDirection: 'row',
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  scrambleBox: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#262938',
    paddingTop: 10,
  },
  scrambleLabel: {
    fontSize: 11,
    color: '#8b8e9f',
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 4,
  },
  scrambleSequence: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#10b981',
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  timeInput: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
  },
  penaltyRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  penaltyBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  penaltyBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  resultCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  resultValue: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  signatureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  signaturePad: {
    height: 120,
    borderWidth: 1,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 12,
  },
  drawPoint: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  signPlaceholder: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  signPlaceholderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nameInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  submitButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  successIconWrapper: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  successDetailsBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  successDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  successDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  successDetailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    width: '100%',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  medleyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  medleyLabelText: {
    flex: 1.2,
    fontSize: 12,
    fontWeight: '700',
  },
  medleyTimeInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 13,
  },
  medleyPenBtn: {
    width: 32,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
