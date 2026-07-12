import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  GestureResponderEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { JudgeStationCompetitor, PenaltyMode } from '../../types';
import { useJudgeScoring } from '../../services/judgeService';
import { getActiveEvent, getActiveTournament, getLaneConfig } from '../../services/judgeStore';

interface Props {
  selectedCompetitor: JudgeStationCompetitor | null;
  token: string | null;
  onGoToRoster: () => void;
  onScoreComplete: () => void;
  onGoToScan: () => void;
}

interface Point {
  x: number;
  y: number;
}

export default function JudgeScoreTab({
  selectedCompetitor,
  token,
  onGoToRoster,
  onScoreComplete,
  onGoToScan,
}: Props) {
  const colors = useTheme();
  const laneConfig = getLaneConfig();
  const tournament = getActiveTournament();
  const event = getActiveEvent();
  const formatType = event?.eventFormatCode || 'TRADITIONAL';

  const groupCompetitorId = selectedCompetitor?.groupCompetitorId || '';

  const {
    activeSolveNumber,
    totalSolveCount,
    submittedSolveCount,
    currentScramble,
    stackmat,
    setStackmat,
    penalty,
    setPenalty,
    signName,
    setSignName,
    isSubmitted,
    isSubmitting,
    drawingPoints,
    setDrawingPoints,
    medleySolves,
    setMedleySolves,
    isLoading,
    submitScore,
    prepareNextSolve,
    leaveScoreScreen,
  } = useJudgeScoring(groupCompetitorId, token, formatType);

  const finalTime = useMemo(() => {
    if (penalty === 'DNF') return 'DNF';
    const parsed = parseFloat(stackmat);
    if (isNaN(parsed) || parsed <= 0) return '0.00s';
    return `${(penalty === '+2' ? parsed + 2 : parsed).toFixed(2)}s`;
  }, [penalty, stackmat]);

  const medleyResult = useMemo(() => {
    if (medleySolves.some((solve: any) => solve.penalty === 'DNF')) return 'DNF';
    const total = medleySolves.reduce((sum: number, solve: any) => {
      const parsed = parseFloat(solve.time || '0');
      return sum + (isNaN(parsed) ? 0 : parsed + (solve.penalty === '+2' ? 2 : 0));
    }, 0);
    return `${total.toFixed(2)}s`;
  }, [medleySolves]);

  const isFormValid = useMemo(() => {
    const timeOk = formatType === 'MEDLEY'
      ? medleySolves.length > 0 && !medleySolves.some((solve: any) => !solve.time.trim() || isNaN(parseFloat(solve.time)) || parseFloat(solve.time) <= 0)
      : (stackmat.trim() && !isNaN(parseFloat(stackmat)) && parseFloat(stackmat) > 0) || penalty === 'DNF';
    const signOk = drawingPoints.length > 0 || signName.trim().length > 0;
    return timeOk && signOk;
  }, [drawingPoints, formatType, medleySolves, penalty, signName, stackmat]);

  const hasNextSolve = Boolean(selectedCompetitor?.canSubmit && selectedCompetitor?.nextSolveNumber);

  const handleTouchDraw = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setDrawingPoints((prev: Point[]) => [...prev, { x: locationX, y: locationY }]);
  };

  const clearSignature = () => {
    setDrawingPoints([]);
    setSignName('');
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      Alert.alert('Missing Fields', 'Please complete score duration and competitor signature.');
      return;
    }
    const result = await submitScore();
    if (!result.success) {
      Alert.alert('Submission Failed', result.message || 'An error occurred during submission.');
    }
  };

  const handleSaveContinue = async () => {
    await prepareNextSolve();
  };

  const handleBackToRoster = () => {
    leaveScoreScreen();
    onScoreComplete();
  };

  const handleBackToScan = () => {
    leaveScoreScreen();
    onGoToScan();
  };

  const updateMedleySolve = (index: number, field: string, value: string) => {
    setMedleySolves((current: any[]) => current.map((solve: any, solveIndex: number) => (
      solveIndex === index ? { ...solve, [field]: value } : solve
    )));
  };

  if (!selectedCompetitor) {
    return (
      <View style={styles.emptyWrap}>
        <MaterialCommunityIcons name="timer-off-outline" size={40} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Competitor Selected</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Select a verified competitor from the Roster tab to begin scoring.
        </Text>
        <TouchableOpacity style={[styles.goRosterBtn, { borderColor: colors.border }]} onPress={onGoToRoster}>
          <Text style={[styles.goRosterText, { color: colors.primary }]}>Go to Roster</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading solve info...</Text>
      </View>
    );
  }

  if (selectedCompetitor.backendStatus === 'DONE' && !isSubmitted) {
    return (
      <View style={styles.emptyWrap}>
        <MaterialCommunityIcons name="check-decagram" size={40} color="#10b981" />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Competitor Already Completed</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Backend reports {selectedCompetitor.submittedSolveCount}/{selectedCompetitor.totalSolveCount} solves submitted.
        </Text>
        <TouchableOpacity style={[styles.goRosterBtn, { borderColor: colors.border }]} onPress={handleBackToRoster}>
          <Text style={[styles.goRosterText, { color: colors.primary }]}>Back to Roster</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isSubmitted) {
    return (
      <View style={styles.successWrap}>
        <MaterialCommunityIcons name="check-decagram" size={64} color="#10b981" />
        <Text style={[styles.successTitle, { color: colors.text }]}>Result Submitted</Text>
        <Text style={[styles.successSub, { color: colors.textSecondary }]}>
          Score saved to backend. Continue with the same competitor or move to another tab.
        </Text>

        <View style={[styles.successBox, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.successRow}>
            <Text style={[styles.successLabel, { color: colors.textSecondary }]}>Competitor</Text>
            <Text style={[styles.successVal, { color: colors.text }]}>{selectedCompetitor.competitorName}</Text>
          </View>
          <View style={styles.successRow}>
            <Text style={[styles.successLabel, { color: colors.textSecondary }]}>Submitted</Text>
            <Text style={[styles.successVal, { color: colors.text }]}>{submittedSolveCount}/{totalSolveCount}</Text>
          </View>
        </View>

        <View style={{ gap: 10, width: '100%' }}>
          {hasNextSolve && (
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleSaveContinue}>
              <Text style={styles.primaryBtnText}>Save and Continue Next Solve</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={handleBackToRoster}>
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Save and Back to Competitor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={handleBackToScan}>
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Save and Scan Next Competitor</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.topActions}>
        <TouchableOpacity style={[styles.topActionBtn, { borderColor: colors.border }]} onPress={handleBackToRoster}>
          <MaterialCommunityIcons name="arrow-left" size={14} color={colors.text} />
          <Text style={[styles.topActionText, { color: colors.text }]}>Competitor</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.topActionBtn, { borderColor: colors.border }]} onPress={handleBackToScan}>
          <MaterialCommunityIcons name="qrcode-scan" size={14} color={colors.text} />
          <Text style={[styles.topActionText, { color: colors.text }]}>Scan</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.ctxCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <Text style={[styles.ctxTournament, { color: colors.primary }]}>{tournament?.name || 'Tournament'}</Text>
        <Text style={[styles.ctxLine, { color: colors.text }]}>
          {event?.puzzleTypeName || 'Event'} | Round {laneConfig?.roundNumber || 1} | Group {laneConfig?.groupNumber || 1} | Station {laneConfig?.stationNumber || 1}
        </Text>
        <View style={styles.ctxSep} />
        <View style={styles.ctxRow}>
          <View>
            <Text style={styles.ctxLabel}>COMPETITOR</Text>
            <Text style={[styles.ctxValue, { color: colors.text }]}>{selectedCompetitor.competitorName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.ctxLabel}>PROGRESS</Text>
            <Text style={[styles.ctxValue, { color: colors.accent }]}>Solve {activeSolveNumber}/{totalSolveCount}</Text>
          </View>
        </View>
      </View>

      {formatType !== 'MEDLEY' && currentScramble.sequence ? (
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="cube-outline" size={14} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>ATTEMPT SCRAMBLE</Text>
          </View>
          <View style={[styles.scrambleBox, { backgroundColor: colors.background }]}>
            <Text style={styles.scrambleText}>{currentScramble.sequence}</Text>
          </View>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="timer-outline" size={14} color={colors.accent} />
          <Text style={[styles.cardTitle, { color: colors.accent }]}>SOLVE RECORDING</Text>
        </View>

        {formatType !== 'MEDLEY' ? (
          <View>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Stackmat Timer (seconds)</Text>
            <TextInput
              style={[styles.timeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor={colors.textSecondary}
              value={stackmat}
              onChangeText={value => { if (!value.includes('-')) setStackmat(value); }}
            />
            <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 12 }]}>WCA Penalty Status</Text>
            <View style={styles.penaltyRow}>
              {(['None', '+2', 'DNF'] as PenaltyMode[]).map(mode => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.penaltyBtn, { borderColor: colors.border }, penalty === mode && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setPenalty(mode)}
                >
                  <Text style={[styles.penaltyBtnText, { color: penalty === mode ? '#fff' : colors.text }]}>{mode}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.resultCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Final Time</Text>
              <Text style={[styles.resultValue, { color: penalty === 'DNF' ? '#ef4444' : colors.primary }]}>{finalTime}</Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {medleySolves.map((solve: any, index: number) => (
              <View key={solve.medleyPuzzleId} style={styles.medleyRow}>
                <Text style={[styles.medleyLabel, { color: colors.text }]}>{solve.puzzleName}</Text>
                <TextInput
                  style={[styles.medleyInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  keyboardType="numeric"
                  placeholder="Time"
                  placeholderTextColor={colors.textSecondary}
                  value={solve.time}
                  onChangeText={value => { if (!value.includes('-')) updateMedleySolve(index, 'time', value); }}
                />
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {(['None', '+2', 'DNF'] as PenaltyMode[]).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.medleyPenBtn, { borderColor: colors.border }, solve.penalty === mode && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => updateMedleySolve(index, 'penalty', mode)}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '800', color: solve.penalty === mode ? '#fff' : colors.text }}>{mode}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <View style={[styles.resultCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>Combined Medley Score</Text>
              <Text style={[styles.resultValue, { color: medleyResult === 'DNF' ? '#ef4444' : colors.primary }]}>{medleyResult}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <View style={styles.signatureHeader}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="signature" size={14} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>COMPETITOR E-SIGNATURE</Text>
          </View>
          <TouchableOpacity onPress={clearSignature}>
            <Text style={[styles.clearText, { color: colors.primary }]}>Clear Pad</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.signSubtitle, { color: colors.textSecondary }]}>
          Competitor must sign inside the frame to confirm result entry validation.
        </Text>
        <View
          style={[styles.signPad, { backgroundColor: colors.background, borderColor: colors.border }]}
          onTouchStart={handleTouchDraw}
          onTouchMove={handleTouchDraw}
        >
          {drawingPoints.map((point: Point, index: number) => (
            <View
              key={index}
              style={[styles.drawPoint, { left: point.x - 2, top: point.y - 2, backgroundColor: colors.text } as any]}
            />
          ))}
          {drawingPoints.length === 0 && (
            <View style={styles.signPlaceholder as any}>
              <MaterialCommunityIcons name="gesture-double-tap" size={14} color={colors.border} />
              <Text style={[styles.signPlaceholderText, { color: colors.textSecondary }]}>Sign initials here</Text>
            </View>
          )}
        </View>
        <TextInput
          style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          placeholder="Or type full competitor initials"
          placeholderTextColor={colors.textSecondary}
          value={signName}
          onChangeText={setSignName}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: isFormValid ? '#10b981' : colors.border, opacity: isFormValid ? 1 : 0.5 }]}
        onPress={handleSubmit}
        disabled={isSubmitting || !isFormValid}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
            <Text style={styles.submitBtnText}>Submit to Backend</Text>
          </View>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 24 },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
  emptySub: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  goRosterBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8, marginTop: 8 },
  goRosterText: { fontSize: 12, fontWeight: '800' },
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loaderText: { fontSize: 12, fontWeight: '600' },
  scroll: { padding: 14, gap: 12, paddingBottom: 30 },
  topActions: { flexDirection: 'row', gap: 8 },
  topActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topActionText: { fontSize: 11, fontWeight: '800' },
  ctxCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  ctxTournament: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  ctxLine: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  ctxSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },
  ctxRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ctxLabel: { fontSize: 8, color: 'rgba(255,255,255,0.4)', fontWeight: '800' },
  ctxValue: { fontSize: 14, fontWeight: '900', marginTop: 1 },
  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardTitle: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  scrambleBox: { borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#262938' },
  scrambleText: { fontSize: 12, fontFamily: 'monospace', color: '#10b981', lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  fieldLabel: { fontSize: 10, fontWeight: '800', marginBottom: 4 },
  timeInput: { height: 42, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, fontWeight: '800' },
  penaltyRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  penaltyBtn: { flex: 1, height: 34, borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  penaltyBtnText: { fontSize: 11, fontWeight: '800' },
  resultCard: { marginTop: 12, padding: 10, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  resultLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  resultValue: { fontSize: 20, fontWeight: '900', marginTop: 2 },
  medleyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  medleyLabel: { fontSize: 10, fontWeight: '800', flex: 1.2 },
  medleyInput: { flex: 1, height: 32, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, fontSize: 11, fontWeight: '800' },
  medleyPenBtn: { width: 28, height: 24, borderRadius: 5, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  signatureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  clearText: { fontSize: 11, fontWeight: '800' },
  signSubtitle: { fontSize: 10, lineHeight: 14, marginBottom: 8 },
  signPad: { height: 90, borderWidth: 1, borderRadius: 8, position: 'relative', overflow: 'hidden', marginBottom: 8 },
  drawPoint: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5 },
  signPlaceholder: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 2 },
  signPlaceholderText: { fontSize: 10, fontWeight: '800' },
  nameInput: { height: 34, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, fontSize: 11 },
  submitBtn: { flexDirection: 'row', height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', gap: 6 },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingTop: 30 },
  successTitle: { fontSize: 18, fontWeight: '900', marginTop: 8, marginBottom: 4 },
  successSub: { fontSize: 11, textAlign: 'center', lineHeight: 16, marginBottom: 16 },
  successBox: { width: '100%', borderRadius: 12, borderWidth: 1, padding: 12, gap: 8, marginBottom: 20 },
  successRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  successLabel: { fontSize: 10, fontWeight: '700' },
  successVal: { fontSize: 12, fontWeight: '800' },
  primaryBtn: { flexDirection: 'row', height: 42, borderRadius: 8, justifyContent: 'center', alignItems: 'center', gap: 6, width: '100%' },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  secondaryBtn: { borderWidth: 1, height: 42, borderRadius: 8, justifyContent: 'center', alignItems: 'center', width: '100%' },
  secondaryBtnText: { fontWeight: '800', fontSize: 12 },
});
