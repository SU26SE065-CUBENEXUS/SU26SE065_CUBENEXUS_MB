import { useCallback, useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { API_BASE_URL } from '@/constants/config';
import {
  checkInRegistration,
  getJudgeStationRoster,
  getPenaltyTypes,
  getPublicTournaments,
  getSolveProgress,
  getTournamentById,
  submitMedleyResult,
  submitTraditionalResult,
  verifyJudgeStation,
} from '@/constants/api';
import {
  CheckInRecord,
  JudgeCompetitorSessionState,
  JudgeLaneConfig,
  JudgeRosterBackendStatus,
  JudgeStationCompetitor,
  PenaltyMode,
} from '../types';
import {
  addCheckInRecord,
  addJudgeHistoryRecord,
  clearJudgeStore,
  clearLaneConfig,
  clearLaneConnection,
  clearQueue,
  getActiveEvent,
  getActiveTournament,
  getLaneConfig,
  getLocalCheckInHistory,
  getSelectedCompetitorId,
  getStationQueue,
  markCompetitorVerified,
  replaceStationCompetitor,
  setActiveEvent,
  setActiveScoringSession,
  setActiveTournament,
  setLaneConfig,
  setSelectedCompetitorId,
  setStationQueue,
  subscribeJudgeStore,
  updateCompetitor,
} from './judgeStore';

function deriveBackendStatus(submittedCount: number, solveCount: number, explicitStatus?: string | null): JudgeRosterBackendStatus {
  const normalized = explicitStatus?.toUpperCase();
  if (normalized === 'ABSENT' || normalized === 'DNS') {
    return normalized;
  }
  if (submittedCount >= solveCount && solveCount > 0) {
    return 'DONE';
  }
  if (submittedCount > 0) {
    return 'PARTIAL';
  }
  return 'WAITING';
}

function buildSolveProgress(nextSolveNumber: number | null, solveCount: number, submittedCount: number): string {
  if (solveCount <= 0) {
    return 'Solve 0/0';
  }
  if (nextSolveNumber === null || submittedCount >= solveCount) {
    return `Solve ${solveCount}/${solveCount}`;
  }
  return `Solve ${Math.min(nextSolveNumber, solveCount)}/${solveCount}`;
}

function mapRosterItem(dto: {
  groupCompetitorId: string;
  groupId: string;
  groupName: string;
  competitorName: string;
  eventId: string;
  eventName: string;
  roundNumber: number;
  stationNumber: number;
  solveCount: number;
  submittedCount: number;
  nextSolveNumber?: number | null;
  canSubmit: boolean;
  status?: string | null;
}): JudgeStationCompetitor {
  const backendStatus = deriveBackendStatus(dto.submittedCount, dto.solveCount, dto.status);
  return {
    groupCompetitorId: dto.groupCompetitorId,
    groupId: dto.groupId,
    groupName: dto.groupName,
    roundNumber: dto.roundNumber,
    stationNumber: dto.stationNumber,
    eventId: dto.eventId,
    eventName: dto.eventName,
    competitorName: dto.competitorName,
    totalSolveCount: dto.solveCount,
    submittedSolveCount: dto.submittedCount,
    nextSolveNumber: dto.nextSolveNumber ?? null,
    canSubmit: dto.canSubmit,
    backendStatus,
    currentSolveNumber: dto.nextSolveNumber ?? dto.solveCount,
    solveProgress: buildSolveProgress(dto.nextSolveNumber ?? null, dto.solveCount, dto.submittedCount),
    lastScannedAt: null,
    sessionState: 'IDLE',
  };
}

function applyProgressToCompetitor(
  competitor: JudgeStationCompetitor,
  progress: {
    solveCount: number;
    submittedCount: number;
    nextSolveNumber?: number | null;
    canSubmit: boolean;
  },
  sessionState?: JudgeCompetitorSessionState
): JudgeStationCompetitor {
  const backendStatus = deriveBackendStatus(progress.submittedCount, progress.solveCount);
  return {
    ...competitor,
    totalSolveCount: progress.solveCount,
    submittedSolveCount: progress.submittedCount,
    nextSolveNumber: progress.nextSolveNumber ?? null,
    canSubmit: progress.canSubmit,
    backendStatus,
    currentSolveNumber: progress.nextSolveNumber ?? progress.solveCount,
    solveProgress: buildSolveProgress(progress.nextSolveNumber ?? null, progress.solveCount, progress.submittedCount),
    sessionState: sessionState ?? competitor.sessionState,
  };
}

export function useJudgeLaneConfig(token: string | null) {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [roundNumber, setRoundNumber] = useState('1');
  const [groupNumber, setGroupNumber] = useState('1');
  const [stationNumber, setStationNumber] = useState('1');

  const [activeTournament, setActiveTournamentState] = useState<any | null>(null);
  const [activeEvent, setActiveEventState] = useState<any | null>(null);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(false);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);

  const [hubConnection, setHubConnection] = useState<signalR.HubConnection | null>(null);
  const [isHubConnected, setIsHubConnected] = useState(false);
  const [hubStatus, setHubStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Failed'>('Disconnected');
  const [statusMessage, setStatusMessage] = useState('Configure lane and click Register Lane Connection.');

  const [laneConfigState, setLaneConfigState] = useState<JudgeLaneConfig | null>(getLaneConfig());

  useEffect(() => {
    async function loadTournaments() {
      setIsLoadingTournaments(true);
      try {
        const tournList = await getPublicTournaments();
        setTournaments(tournList);
        if (tournList.length > 0) {
          setSelectedTournamentId(tournList[0].id);
        }
      } catch (err) {
        console.error('Failed to load tournaments:', err);
      } finally {
        setIsLoadingTournaments(false);
      }
    }
    loadTournaments();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) return;
    async function loadDetail() {
      try {
        const detail = await getTournamentById(selectedTournamentId);
        setActiveTournamentState(detail);
        setActiveTournament(detail);
        if (detail.events && detail.events.length > 0) {
          setSelectedEventId(detail.events[0].id);
          setActiveEventState(detail.events[0]);
          setActiveEvent(detail.events[0]);
        } else {
          setSelectedEventId('');
          setActiveEventState(null);
          setActiveEvent(null);
        }
      } catch (err) {
        console.error('Error fetching tournament details:', err);
      }
    }
    loadDetail();
  }, [selectedTournamentId]);

  useEffect(() => {
    if (!selectedEventId || !activeTournament) {
      setActiveEventState(null);
      setActiveEvent(null);
      return;
    }
    const event = activeTournament.events?.find((item: any) => item.id === selectedEventId) || null;
    setActiveEventState(event);
    setActiveEvent(event);
  }, [selectedEventId, activeTournament]);

  useEffect(() => {
    const currentConfig = getLaneConfig();
    if (!currentConfig) return;

    const hasChanged =
      currentConfig.tournamentId !== selectedTournamentId ||
      currentConfig.eventId !== selectedEventId ||
      currentConfig.roundNumber !== Number(roundNumber) ||
      currentConfig.groupNumber !== Number(groupNumber) ||
      currentConfig.stationNumber !== Number(stationNumber);

    if (hasChanged) {
      clearQueue();
      clearLaneConfig();
      setLaneConfigState(null);
      if (hubConnection) {
        hubConnection.stop().catch(() => undefined);
        setHubConnection(null);
      }
      setIsHubConnected(false);
      setHubStatus('Disconnected');
      setStatusMessage('Station context changed. Register lane connection again to reload roster.');
    }
  }, [selectedTournamentId, selectedEventId, roundNumber, groupNumber, stationNumber, hubConnection]);

  const loadStationRoster = useCallback(async (config: JudgeLaneConfig) => {
    if (!token) {
      throw new Error('Authorization required. Please log in again.');
    }
    setIsLoadingRoster(true);
    try {
      const response = await getJudgeStationRoster(
        config.eventId,
        config.roundNumber,
        config.groupNumber,
        config.stationNumber,
        token
      );

      const roster = response.competitors.map(mapRosterItem);
      setStationQueue(roster);
      setStatusMessage(
        roster.length > 0
          ? `Connected. Loaded ${roster.length} competitors for Group ${config.groupNumber}, Station ${config.stationNumber}.`
          : `Connected. No competitors assigned yet for Group ${config.groupNumber}, Station ${config.stationNumber}.`
      );
      return roster;
    } finally {
      setIsLoadingRoster(false);
    }
  }, [token]);

  const registerStation = useCallback(async () => {
    if (hubConnection) {
      await hubConnection.stop().catch(() => undefined);
      setHubConnection(null);
      setIsHubConnected(false);
      setHubStatus('Disconnected');
    }

    if (!selectedEventId || !roundNumber || !groupNumber || !stationNumber) {
      setStatusMessage('Missing lane configurations.');
      return;
    }

    const config = {
      tournamentId: selectedTournamentId,
      eventId: selectedEventId,
      roundNumber: Number(roundNumber),
      groupNumber: Number(groupNumber),
      stationNumber: Number(stationNumber),
    };

    const hubUrl = `${API_BASE_URL}/hubs/tournament`;
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .build();

    connection.onreconnecting(() => {
      setIsHubConnected(false);
      setHubStatus('Connecting');
    });

    connection.onreconnected(() => {
      setIsHubConnected(true);
      setHubStatus('Connected');
      connection.invoke('RegisterJudgeStation', selectedEventId, Number(roundNumber), Number(stationNumber))
        .catch(console.error);
    });

    connection.onclose(() => {
      setIsHubConnected(false);
      setHubStatus('Disconnected');
    });

    try {
      setHubStatus('Connecting');
      await connection.start();
      await connection.invoke('RegisterJudgeStation', selectedEventId, Number(roundNumber), Number(stationNumber));

      setHubConnection(connection);
      setIsHubConnected(true);
      setHubStatus('Connected');
      setLaneConfig(config);
      setLaneConfigState(config);
      setActiveTournament(activeTournament);
      setActiveEvent(activeEvent);

      await loadStationRoster(config);
    } catch (err: any) {
      setHubStatus('Failed');
      setIsHubConnected(false);
      const missingRosterApi = err?.status === 404 && String(err.message || '').includes('station-roster');
      setStatusMessage(
        missingRosterApi
          ? 'Lane connected, but backend is missing station roster API `/api/tournament-operation/judge/station-roster`.'
          : `Connection failed: ${err.message || err}`
      );
    }
  }, [
    activeEvent,
    activeTournament,
    groupNumber,
    hubConnection,
    loadStationRoster,
    roundNumber,
    selectedEventId,
    selectedTournamentId,
    stationNumber,
  ]);

  const disconnectStation = useCallback(async () => {
    if (hubConnection) {
      await hubConnection.stop().catch(() => undefined);
      setHubConnection(null);
    }
    setIsHubConnected(false);
    setHubStatus('Disconnected');
    setStatusMessage('Configure lane and click Register Lane Connection.');
    clearLaneConnection();
    setLaneConfigState(null);
  }, [hubConnection]);

  const isConfigComplete = selectedTournamentId && selectedEventId && roundNumber && groupNumber && stationNumber;

  return {
    tournaments,
    selectedTournamentId,
    setSelectedTournamentId,
    selectedEventId,
    setSelectedEventId,
    roundNumber,
    setRoundNumber,
    groupNumber,
    setGroupNumber,
    stationNumber,
    setStationNumber,
    activeTournament,
    activeEvent,
    isLoadingTournaments,
    hubConnection,
    isHubConnected,
    hubStatus,
    statusMessage,
    setStatusMessage,
    registerStation,
    disconnectStation,
    isConfigComplete,
    laneConfig: laneConfigState,
    isLoadingRoster,
    loadStationRoster,
  };
}

export function useJudgeStationQueue(token: string | null) {
  const [queue, setQueueState] = useState<JudgeStationCompetitor[]>(getStationQueue());

  useEffect(() => subscribeJudgeStore(() => {
    setQueueState([...getStationQueue()]);
  }), []);

  const refreshRoster = useCallback(async (config: JudgeLaneConfig) => {
    if (!token) {
      return { success: false, message: 'Authorization required. Please log in again.' };
    }
    try {
      const response = await getJudgeStationRoster(
        config.eventId,
        config.roundNumber,
        config.groupNumber,
        config.stationNumber,
        token
      );
      setStationQueue(response.competitors.map(mapRosterItem));
      return { success: true, message: response.message || 'Roster refreshed.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to refresh roster.' };
    }
  }, [token]);

  const verifyCompetitorInRoster = useCallback(async (
    qrToken: string,
    config: JudgeLaneConfig,
    authToken: string
  ): Promise<{ success: boolean; message: string; competitor?: JudgeStationCompetitor; errorCode?: string }> => {
    try {
      const res = await verifyJudgeStation({
        qrToken,
        eventId: config.eventId,
        roundNumber: config.roundNumber,
        groupNumber: config.groupNumber,
        stationNumber: config.stationNumber,
      }, authToken);

      if (!res.success || !res.groupCompetitorId) {
        return { success: false, message: res.message || 'Verification failed.' };
      }

      const rosterCompetitor = getStationQueue().find(item => item.groupCompetitorId === res.groupCompetitorId);
      if (!rosterCompetitor) {
        return {
          success: false,
          errorCode: 'NOT_IN_ROSTER',
          message: 'Competitor khong thuoc Group/Station hien tai.',
        };
      }

      const nextSolveNumber = res.nextSolveNumber ?? rosterCompetitor.nextSolveNumber ?? 1;
      const verifiedCompetitor: JudgeStationCompetitor = {
        ...rosterCompetitor,
        nextSolveNumber,
        currentSolveNumber: nextSolveNumber,
        solveProgress: buildSolveProgress(nextSolveNumber, res.solveCount || rosterCompetitor.totalSolveCount, rosterCompetitor.submittedSolveCount),
        totalSolveCount: res.solveCount || rosterCompetitor.totalSolveCount,
        canSubmit: res.canSubmit,
        lastScannedAt: new Date().toISOString(),
        sessionState: 'VERIFIED',
      };

      replaceStationCompetitor(verifiedCompetitor);
      markCompetitorVerified(verifiedCompetitor.groupCompetitorId);
      return { success: true, message: 'Competitor verified.', competitor: verifiedCompetitor };
    } catch (err: any) {
      return {
        success: false,
        errorCode: err.errorCode || '',
        message: err.message || 'Verification error.',
      };
    }
  }, []);

  return {
    queue,
    verifyCompetitorInRoster,
    refreshRoster,
  };
}

export function useCheckInDesk(token: string | null) {
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    record?: CheckInRecord;
  } | null>(null);
  const [recentHistory, setRecentHistory] = useState<CheckInRecord[]>(getLocalCheckInHistory());

  const performCheckIn = async (rawScannedData: string): Promise<void> => {
    if (!token) {
      setLastResult({ success: false, message: 'Authorization required. Please log in again.' });
      return;
    }
    setIsScanning(true);
    setLastResult(null);

    let qrToken = rawScannedData;
    try {
      if (rawScannedData.startsWith('%7B') || rawScannedData.startsWith('%22')) {
        qrToken = decodeURIComponent(rawScannedData);
      }
      JSON.parse(qrToken);
    } catch {
      // Keep raw token as-is
    }

    try {
      const res = await checkInRegistration(qrToken, token);
      const record: CheckInRecord = {
        registrationId: res.registrationId,
        competitorName: res.playerName || '-',
        checkedInAt: res.checkedInAt || new Date().toISOString(),
        statusCode: res.alreadyCheckedIn ? 'ALREADY_CHECKED_IN' : 'CHECKED_IN',
        qrToken,
      };
      addCheckInRecord(record);
      setRecentHistory([...getLocalCheckInHistory()]);
      setLastResult({
        success: true,
        message: res.alreadyCheckedIn
          ? `${res.playerName || 'Competitor'} was already checked in.`
          : res.message || 'Check-in successful.',
        record,
      });
    } catch (err: any) {
      setLastResult({ success: false, message: err.message || 'Check-in failed.' });
    } finally {
      setIsScanning(false);
    }
  };

  return {
    isScanning,
    lastResult,
    recentHistory,
    performCheckIn,
    clearResult: () => setLastResult(null),
  };
}

export function useJudgeScoring(
  groupCompetitorId: string,
  token: string | null,
  formatType: string
) {
  const [activeSolveNumber, setActiveSolveNumber] = useState(1);
  const [totalSolveCount, setTotalSolveCount] = useState(5);
  const [currentScramble, setCurrentScramble] = useState({ scrambleId: '', sequence: '' });
  const [submittedSolveCount, setSubmittedSolveCount] = useState(0);

  const [stackmat, setStackmat] = useState('');
  const [penalty, setPenalty] = useState<PenaltyMode>('None');
  const [signName, setSignName] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<any[]>([]);
  const [medleySolves, setMedleySolves] = useState<any[]>([]);
  const [penaltyTypes, setPenaltyTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadProgress = useCallback(async () => {
    if (!groupCompetitorId || !token) return;
    setIsLoading(true);
    try {
      const [progress, penalties] = await Promise.all([
        getSolveProgress(groupCompetitorId, token),
        getPenaltyTypes(token),
      ]);

      setPenaltyTypes(penalties);
      setActiveSolveNumber(progress.nextSolveNumber || progress.solveCount || 1);
      setTotalSolveCount(progress.solveCount || 5);
      setSubmittedSolveCount(progress.submittedCount || 0);
      setCurrentScramble(progress.currentScramble
        ? {
          scrambleId: progress.currentScramble.scrambleId,
          sequence: progress.currentScramble.sequence,
        }
        : { scrambleId: '', sequence: '' });

      updateCompetitor(groupCompetitorId, competitor => applyProgressToCompetitor(
        competitor,
        {
          solveCount: progress.solveCount || competitor.totalSolveCount,
          submittedCount: progress.submittedCount || 0,
          nextSolveNumber: progress.nextSolveNumber ?? null,
          canSubmit: progress.canSubmit,
        },
        progress.canSubmit ? 'SCORING' : competitor.sessionState
      ));

      if (formatType === 'MEDLEY') {
        const event = getActiveEvent();
        if (event?.medleyPuzzles?.length) {
          setMedleySolves(event.medleyPuzzles.map((puzzle: any) => ({
            medleyPuzzleId: puzzle.id,
            puzzleName: puzzle.puzzleTypeName || 'Puzzle',
            scrambleId: progress.currentScramble?.scrambleId || '00000000-0000-0000-0000-000000000000',
            time: '',
            penalty: 'None',
          })));
        }
      }
    } catch (err) {
      console.error('Failed to load progress details:', err);
    } finally {
      setIsLoading(false);
    }
  }, [formatType, groupCompetitorId, token]);

  useEffect(() => {
    if (!groupCompetitorId) return;
    setActiveScoringSession({ groupCompetitorId, solveNumber: activeSolveNumber });
  }, [activeSolveNumber, groupCompetitorId]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const resetDraft = () => {
    setStackmat('');
    setPenalty('None');
    setDrawingPoints([]);
    setSignName('');
  };

  const submitScore = async (): Promise<{ success: boolean; hasNextSolve: boolean; message?: string }> => {
    if (!token) return { success: false, hasNextSolve: false, message: 'Session expired.' };

    setIsSubmitting(true);
    try {
      const esignature = signName.trim() || `SIGN_${drawingPoints.length}_POINTS`;
      const competitor = getStationQueue().find(item => item.groupCompetitorId === groupCompetitorId);
      const laneConfig = getLaneConfig();

      if (formatType === 'MEDLEY') {
        const detailsPayload = medleySolves.map((solve: any) => {
          const penaltyCode = solve.penalty === '+2' ? 'PLUS_2' : solve.penalty === 'DNF' ? 'DNF' : 'OK';
          const matchedPenalty = penaltyTypes.find((item: any) => item.code === penaltyCode);
          return {
            medleyPuzzleId: solve.medleyPuzzleId,
            rawTimeMs: parseFloat(solve.time) * 1000,
            penaltyTypeId: matchedPenalty?.id || null,
            scrambleId: solve.scrambleId || '00000000-0000-0000-0000-000000000000',
          };
        });

        await submitMedleyResult({
          groupCompetitorId,
          solveNumber: activeSolveNumber,
          esignatureData: esignature,
          details: detailsPayload,
        }, token);
      } else {
        const penaltyCode = penalty === '+2' ? 'PLUS_2' : penalty === 'DNF' ? 'DNF' : 'OK';
        const matchedPenalty = penaltyTypes.find((item: any) => item.code === penaltyCode);
        const rawTimeMs = penalty === 'DNF' ? 0 : Math.round(parseFloat(stackmat) * 1000);

        if (!currentScramble.scrambleId) {
          throw new Error('Scramble reference missing.');
        }

        await submitTraditionalResult({
          groupCompetitorId,
          solveNumber: activeSolveNumber,
          rawTimeMs,
          penaltyTypeId: matchedPenalty?.id || null,
          scrambleId: currentScramble.scrambleId,
          esignatureData: esignature,
        }, token);
      }

      addJudgeHistoryRecord({
        groupCompetitorId,
        competitorName: competitor?.competitorName || 'Competitor',
        eventName: competitor?.eventName || '',
        groupName: competitor?.groupName || '',
        stationNumber: laneConfig?.stationNumber || 0,
        solveNumber: activeSolveNumber,
        finalTimeMs: formatType === 'MEDLEY' ? null : Math.round((parseFloat(stackmat || '0') || 0) * 1000),
        isDnf: penalty === 'DNF',
        submittedAt: new Date().toISOString(),
      });

      await loadProgress();
      resetDraft();
      setIsSubmitted(true);

      const current = getStationQueue().find(item => item.groupCompetitorId === groupCompetitorId);
      const hasNextSolve = Boolean(current?.canSubmit && current?.nextSolveNumber);
      return { success: true, hasNextSolve };
    } catch (err: any) {
      updateCompetitor(groupCompetitorId, competitor => ({
        ...competitor,
        sessionState: 'ISSUE',
      }));
      return { success: false, hasNextSolve: false, message: err.message || 'Submission error.' };
    } finally {
      setIsSubmitting(false);
    }
  };

  const prepareNextSolve = async () => {
    setIsSubmitted(false);
    await loadProgress();
  };

  const leaveScoreScreen = () => {
    setIsSubmitted(false);
    setSelectedCompetitorId(groupCompetitorId || getSelectedCompetitorId());
    setActiveScoringSession(null);
  };

  return {
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
    setIsSubmitted,
    isSubmitting,
    drawingPoints,
    setDrawingPoints,
    medleySolves,
    setMedleySolves,
    penaltyTypes,
    isLoading,
    submitScore,
    loadProgress,
    prepareNextSolve,
    leaveScoreScreen,
  };
}
