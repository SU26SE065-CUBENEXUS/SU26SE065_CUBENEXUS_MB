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

function parseJwtClaims(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = base64.replace(/=+$/, '');
    let output = '';
    for (
      let bc = 0, bs = 0, rbuffer, idx = 0;
      (rbuffer = str.charAt(idx++));
      ~rbuffer && ((bs = bc % 4 ? bs * 64 + rbuffer : rbuffer), bc++ % 4)
        ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
        : 0
    ) {
      rbuffer = chars.indexOf(rbuffer);
    }
    const jsonPayload = decodeURIComponent(
      output
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function deriveBackendStatus(
  submittedCount: number,
  solveCount: number,
  explicitStatus?: string | null,
  canSubmit: boolean = true,
  isCutoffReached: boolean = false
): JudgeRosterBackendStatus {
  const normalized = explicitStatus?.toUpperCase();
  if (normalized === 'ABSENT' || normalized === 'DNS') {
    return normalized;
  }
  if ((submittedCount >= solveCount && solveCount > 0) || isCutoffReached || (!canSubmit && submittedCount > 0)) {
    return 'DONE';
  }
  if (submittedCount > 0) {
    return 'PARTIAL';
  }
  return 'WAITING';
}

function buildSolveProgress(
  nextSolveNumber: number | null,
  solveCount: number,
  submittedCount: number,
  isCutoffReached: boolean = false
): string {
  if (solveCount <= 0) {
    return 'Solve 0/0';
  }
  if (isCutoffReached || (nextSolveNumber === null && submittedCount < solveCount)) {
    return `Solve ${submittedCount}/${solveCount} (CUTOFF)`;
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
  isCutoffReached?: boolean;
  status?: string | null;
}): JudgeStationCompetitor {
  const isCutoff = Boolean(dto.isCutoffReached || (!dto.canSubmit && dto.submittedCount > 0 && dto.submittedCount < dto.solveCount));
  const backendStatus = deriveBackendStatus(dto.submittedCount, dto.solveCount, dto.status, dto.canSubmit, isCutoff);
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
    isCutoffReached: isCutoff,
    backendStatus,
    currentSolveNumber: dto.nextSolveNumber ?? dto.solveCount,
    solveProgress: buildSolveProgress(dto.nextSolveNumber ?? null, dto.solveCount, dto.submittedCount, isCutoff),
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
    isCutoffReached?: boolean;
  },
  sessionState?: JudgeCompetitorSessionState
): JudgeStationCompetitor {
  const isCutoff = Boolean(progress.isCutoffReached || (!progress.canSubmit && progress.submittedCount > 0 && progress.submittedCount < progress.solveCount));
  const backendStatus = deriveBackendStatus(progress.submittedCount, progress.solveCount, null, progress.canSubmit, isCutoff);
  return {
    ...competitor,
    totalSolveCount: progress.solveCount,
    submittedSolveCount: progress.submittedCount,
    nextSolveNumber: progress.nextSolveNumber ?? null,
    canSubmit: progress.canSubmit,
    isCutoffReached: isCutoff,
    backendStatus,
    currentSolveNumber: progress.nextSolveNumber ?? progress.solveCount,
    solveProgress: buildSolveProgress(progress.nextSolveNumber ?? null, progress.solveCount, progress.submittedCount, isCutoff),
    sessionState: sessionState ?? competitor.sessionState,
  };
}

export function useJudgeLaneConfig(token: string | null) {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [roundNumber, setRoundNumber] = useState('1');
  const [groupNumber, setGroupNumber] = useState('0'); // Default to 0 (ALL GROUPS)
  const [stationNumber, setStationNumber] = useState('1');

  const [activeTournament, setActiveTournamentState] = useState<any | null>(null);
  const [activeEvent, setActiveEventState] = useState<any | null>(null);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(false);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);

  const [hubConnection, setHubConnection] = useState<signalR.HubConnection | null>(null);
  const [isHubConnected, setIsHubConnected] = useState(false);
  const [hubStatus, setHubStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Failed'>('Disconnected');
  const [statusMessage, setStatusMessage] = useState('Vui lòng chọn Vòng thi và bấm Kết Nối Vòng.');

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
    if (!token) return;
    const payload = parseJwtClaims(token);
    if (payload) {
      if (payload.station_number) {
        setStationNumber(String(payload.station_number));
      }
      if (payload.tournament_id && tournaments.some(t => t.id === payload.tournament_id)) {
        setSelectedTournamentId(payload.tournament_id);
      }
    }
  }, [token, tournaments]);

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
      setStatusMessage('Thông tin vòng thi thay đổi. Vui lòng bấm Kết Nối lại.');
    }
  }, [selectedTournamentId, selectedEventId, roundNumber, groupNumber, stationNumber, hubConnection]);

  const loadStationRoster = useCallback(async (config: JudgeLaneConfig) => {
    if (!token) {
      throw new Error('Yêu cầu đăng nhập lại.');
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
          ? `Đã kết nối thành công! Đã tải danh sách ${roster.length} đấu thủ tại Trạm ${config.stationNumber}.`
          : `Đã kết nối thành công. Hiện chưa có đấu thủ thi đấu tại Trạm ${config.stationNumber}.`
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

    if (!selectedEventId || !roundNumber || !stationNumber) {
      setStatusMessage('Chưa chọn đầy đủ thông tin Vòng thi.');
      return;
    }

    const config = {
      tournamentId: selectedTournamentId,
      eventId: selectedEventId,
      roundNumber: Number(roundNumber),
      groupNumber: Number(groupNumber || 0),
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
          ? 'Đã kết nối tín hiệu nhưng server chưa trả về danh sách thí sinh.'
          : `Kết nối không thành công: ${err.message || err}`
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
    setStatusMessage('Đã ngắt kết nối. Vui lòng chọn Vòng thi và bấm Kết Nối lại.');
    clearLaneConnection();
    setLaneConfigState(null);
  }, [hubConnection]);

  const isConfigComplete = Boolean(selectedTournamentId && selectedEventId && roundNumber && stationNumber);

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
        groupNumber: config.groupNumber || 0,
        stationNumber: config.stationNumber,
      }, authToken);

      if (!res.success || !res.groupCompetitorId) {
        return {
          success: false,
          errorCode: res.errorCode || '',
          message: res.message?.includes('Group')
            ? 'Không tìm thấy nhóm thi đấu của thí sinh trong vòng này.'
            : res.message || 'Xác nhận không thành công.',
        };
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

  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);

  const resetDraft = () => {
    setStackmat('');
    setPenalty('None');
    setDrawingPoints([]);
    setSignName('');
    setEvidencePhotos([]);
  };

  const addEvidencePhoto = (photoDataUri: string) => {
    if (!photoDataUri) return;
    const trimmed = photoDataUri.trim();
    if (trimmed.startsWith('file://') || trimmed.startsWith('content://') || trimmed.startsWith('ph://')) {
      console.warn('[judgeService] Rejected local file URI in addEvidencePhoto:', trimmed.substring(0, 50));
      return;
    }
    setEvidencePhotos(prev => [...prev, trimmed]);
  };

  const removeEvidencePhoto = (index: number) => {
    setEvidencePhotos(prev => prev.filter((_, i) => i !== index));
  };


  const submitScore = async (): Promise<{ success: boolean; hasNextSolve: boolean; message?: string }> => {
    if (!token) return { success: false, hasNextSolve: false, message: 'Session expired.' };

    console.log('[Mobile SubmitScore] evidencePhotos count:', evidencePhotos.length, evidencePhotos.length > 0 ? evidencePhotos[0].substring(0, 60) : 'NULL');

    setIsSubmitting(true);
    try {
      const esignature = signName.trim() || `SIGN_${drawingPoints.length}_POINTS`;
      const competitor = getStationQueue().find(item => item.groupCompetitorId === groupCompetitorId);
      const laneConfig = getLaneConfig();

      if (formatType === 'MEDLEY') {
        const activeEv = getActiveEvent();
        const subPuzzles = activeEv?.medleyPuzzles && activeEv.medleyPuzzles.length > 0 ? activeEv.medleyPuzzles : medleySolves;
        const rawTimeMs = penalty === 'DNF' ? 0 : Math.round(parseFloat(stackmat || '0') * 1000);
        const penaltyCode = penalty === '+2' ? 'PLUS_2' : penalty === 'DNF' ? 'DNF' : 'OK';
        const matchedPenalty = penaltyTypes.find((item: any) => item.code === penaltyCode);

        const detailsPayload = (subPuzzles.length > 0 ? subPuzzles : [{ id: '00000000-0000-0000-0000-000000000000' }]).map((p: any, idx: number) => {
          return {
            medleyPuzzleId: p.id || p.medleyPuzzleId || '00000000-0000-0000-0000-000000000000',
            rawTimeMs: idx === 0 ? rawTimeMs : 0,
            penaltyTypeId: idx === 0 ? (matchedPenalty?.id || null) : null,
            scrambleId: currentScramble.scrambleId || '00000000-0000-0000-0000-000000000000',
          };
        });

        await submitMedleyResult({
          groupCompetitorId,
          solveNumber: activeSolveNumber,
          esignatureData: esignature,
          evidencePhotoData: evidencePhotos.length > 0 ? evidencePhotos[0] : null,
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
          evidencePhotoData: evidencePhotos.length > 0 ? evidencePhotos[0] : null,
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
        evidencePhotoUrl: evidencePhotos.length > 0 ? evidencePhotos[0] : null,
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
    evidencePhotos,
    setEvidencePhotos,
    addEvidencePhoto,
    removeEvidencePhoto,
    submitScore,
    loadProgress,
    prepareNextSolve,
    leaveScoreScreen,
  };
}
