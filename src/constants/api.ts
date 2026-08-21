import { API_BASE_URL } from './config';

export interface VerifyJudgeStationByStationDto {
  qrToken: string;
  eventId: string;
  roundNumber: number;
  groupNumber: number;
  stationNumber: number;
}

export interface ScrambleInfoDto {
  scrambleId: string;
  solveNumber: number;
  sequence: string;
}

export interface VerifyJudgeStationResponseDto {
  success: boolean;
  message: string;
  errorCode?: string;
  groupCompetitorId?: string;
  eventId?: string;
  eventName: string;
  roundNumber?: number;
  groupId?: string;
  groupName: string;
  competitorName?: string;
  stationNumber?: number;
  nextSolveNumber?: number;
  solveCount?: number;
  canSubmit: boolean;
  currentScramble?: ScrambleInfoDto;
}

export interface JudgeStationRosterItemDto {
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
}

export interface JudgeStationRosterResponseDto {
  success: boolean;
  message?: string | null;
  competitors: JudgeStationRosterItemDto[];
}

export interface SubmitTraditionalResultDto {
  groupCompetitorId: string;
  solveNumber: number;
  rawTimeMs?: number;
  penaltyTypeId?: string | null;
  scrambleId: string;
  esignatureData?: string | null;
  evidencePhotoData?: string | null;
  evidencePhotoUrl?: string | null;
}

export interface MedleyDetailSubmissionDto {
  medleyPuzzleId: string;
  rawTimeMs?: number;
  penaltyTypeId?: string | null;
  scrambleId: string;
}

export interface SubmitMedleyResultDto {
  groupCompetitorId: string;
  solveNumber: number;
  esignatureData?: string | null;
  evidencePhotoData?: string | null;
  evidencePhotoUrl?: string | null;
  details: MedleyDetailSubmissionDto[];
}

export interface SubmitProgressDto {
  submittedCount: number;
  solveCount: number;
  nextSolveNumber?: number | null;
  canSubmitNext: boolean;
}

export interface SubmitResultResponseDto {
  resultId: string;
  finalTimeMs?: number | null;
  isDnf: boolean;
  submittedSolveNumber?: number | null;
  progress?: SubmitProgressDto | null;
  nextScramble?: ScrambleInfoDto | null;
}

export interface SolveProgressDto {
  groupCompetitorId: string;
  eventId?: string | null;
  eventName: string;
  roundNumber?: number | null;
  groupId?: string | null;
  groupName: string;
  stationNumber?: number | null;
  solveCount: number;
  submittedSolveNumbers: number[];
  submittedCount: number;
  nextSolveNumber?: number | null;
  canSubmit: boolean;
  reason?: string | null;
  currentScramble?: ScrambleInfoDto | null;
}

export interface PenaltyTypeDto {
  id: string;
  code: string;
  label: string;
  timeAdditionMs: number;
  isDisqualified: boolean;
}

export interface CheckInResponseDto {
  success: boolean;
  message: string;
  alreadyCheckedIn: boolean;
  registrationId: string;
  playerName: string;
  tournamentName: string;
  checkedInAt: string | null;
  events: string[];
  assignments: any[];
}

// ---------- API Fetch Helper ----------
async function apiFetch<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    'bypass-tunnel-reminder': 'true',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as Record<string, string>;

  const baseUrl = API_BASE_URL.replace(/\/+$/, '');
  const url = path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.message || `HTTP ${response.status}: ${response.statusText}`;
    const error = new Error(message) as Error & { errorCode?: string; status?: number };
    error.errorCode = errorBody.errorCode || errorBody.code;
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ---------- Tournament Endpoints ----------
export async function getPublicTournaments(): Promise<any[]> {
  return apiFetch<any[]>('/api/tournaments');
}

export async function getTournamentById(id: string): Promise<any> {
  return apiFetch<any>(`/api/tournaments/${id}`);
}

export async function getTournamentCheckInRoster(tournamentId: string, token: string): Promise<any[]> {
  return apiFetch<any[]>(`/api/tournament-operation/judge/check-in-roster?tournamentId=${tournamentId}`, token);
}

// ---------- Operation Endpoints ----------
export async function verifyJudgeStation(dto: VerifyJudgeStationByStationDto, token: string): Promise<VerifyJudgeStationResponseDto> {
  return apiFetch<VerifyJudgeStationResponseDto>('/api/tournament-operation/judge/verify-by-station', token, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function getJudgeStationRoster(
  eventId: string,
  roundNumber: number,
  groupNumber: number,
  stationNumber: number,
  token: string
): Promise<JudgeStationRosterResponseDto> {
  const query = new URLSearchParams({
    eventId,
    roundNumber: String(roundNumber),
    stationNumber: String(stationNumber),
    groupNumber: String(groupNumber || 0),
  });

  return apiFetch<JudgeStationRosterResponseDto>(
    `/api/tournament-operation/judge/station-roster?${query.toString()}`,
    token
  );
}

export async function submitTraditionalResult(dto: SubmitTraditionalResultDto, token: string): Promise<SubmitResultResponseDto> {
  return apiFetch<SubmitResultResponseDto>('/api/tournament-operation/results/traditional', token, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function submitMedleyResult(dto: SubmitMedleyResultDto, token: string): Promise<SubmitResultResponseDto> {
  return apiFetch<SubmitResultResponseDto>('/api/tournament-operation/results/medley', token, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function getSolveProgress(groupCompetitorId: string, token: string): Promise<SolveProgressDto> {
  return apiFetch<SolveProgressDto>(`/api/tournament-operation/competitors/${groupCompetitorId}/solve-progress`, token);
}

export async function getPenaltyTypes(token: string): Promise<PenaltyTypeDto[]> {
  return apiFetch<PenaltyTypeDto[]>('/api/tournament-operation/penalty-types', token);
}


// ---------- Check-in Endpoint ----------
// POST /api/tournament-operation/check-in
// Role: JUDGE, MANAGER, ADMIN
// Used by Check-in Desk mode to perform reception check-in via QR scan.
export async function checkInRegistration(qrToken: string, token: string): Promise<CheckInResponseDto> {
  return apiFetch<CheckInResponseDto>('/api/tournament-operation/check-in', token, {
    method: 'POST',
    body: JSON.stringify({ qrToken }),
  });
}

// ---------- Mobile Timer (Online Arena Match) Endpoints ----------
export interface ConnectMobileTimerRequest {
  qrSessionCode: string;
  deviceInfo: string;
}

export interface ConnectMobileTimerResponse {
  message: string;
  matchId: string;
  statusCode: string;
  playerId: string;
  sessionId: string;
  player1TimerReady: boolean;
  player2TimerReady: boolean;
  deviceInfo: string | null;
}

export interface SubmitSolveTimeRequest {
  matchId: string;
  mobileTimerSessionId: string;
  deviceSessionToken: string;
  timeMs: number | null;
  isDnf: boolean;
  stoppedAt: string;
}

export async function connectMobileTimer(dto: ConnectMobileTimerRequest, token: string): Promise<ConnectMobileTimerResponse> {
  return apiFetch<ConnectMobileTimerResponse>('/api/online/mobile-timer/connect', token, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function submitMobileTimerTime(dto: SubmitSolveTimeRequest, token: string): Promise<any> {
  return apiFetch<any>('/api/online/mobile-timer/submit-time', token, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// ---------- Practice Session Endpoints ----------
export interface FinalizeAttemptRequest {
  timeMs: number;
  penalty?: 'OK' | 'PLUS_2' | 'DNF' | string;
}

export async function connectPracticeSession(sessionId: string, token: string): Promise<any> {
  return apiFetch<any>(`/api/practice/sessions/${sessionId}/connect`, token, {
    method: 'POST',
  });
}

export async function getCurrentPracticeAttempt(sessionId: string, token: string): Promise<any> {
  return apiFetch<any>(`/api/practice/sessions/${sessionId}/current-attempt`, token);
}

export async function finalizePracticeAttempt(attemptId: string, dto: FinalizeAttemptRequest, token: string): Promise<any> {
  return apiFetch<any>(`/api/practice/attempts/${attemptId}/finalize`, token, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export async function createPracticeAttempt(sessionId: string, token: string): Promise<any> {
  return apiFetch<any>(`/api/practice/sessions/${sessionId}/attempts`, token, {
    method: 'POST',
  });
}

export async function handsOnPracticeAttempt(attemptId: string, token: string): Promise<any> {
  return apiFetch<any>(`/api/practice/attempts/${attemptId}/hands-on`, token, {
    method: 'POST',
  });
}

export async function readyPracticeAttempt(attemptId: string, token: string): Promise<any> {
  return apiFetch<any>(`/api/practice/attempts/${attemptId}/ready`, token, {
    method: 'POST',
  });
}

export async function handsOffPracticeAttempt(attemptId: string, token: string): Promise<any> {
  return apiFetch<any>(`/api/practice/attempts/${attemptId}/hands-off`, token, {
    method: 'POST',
  });
}

export async function abortPracticeAttempt(attemptId: string, token: string): Promise<any> {
  return apiFetch<any>(`/api/practice/attempts/${attemptId}/abort`, token, {
    method: 'POST',
  });
}

export async function getPracticeSessionDetail(sessionId: string, token: string): Promise<any> {
  return apiFetch<any>(`/api/practice/sessions/${sessionId}`, token);
}
