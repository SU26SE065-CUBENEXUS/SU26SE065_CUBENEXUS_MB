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
export async function checkInRegistration(
  qrToken: string,
  token: string,
  faceVerificationSessionId?: string | null
): Promise<CheckInResponseDto> {
  return apiFetch<CheckInResponseDto>('/api/tournament-operation/check-in', token, {
    method: 'POST',
    body: JSON.stringify({
      qrToken,
      ...(faceVerificationSessionId ? { faceVerificationSessionId } : {}),
    }),
  });
}

// ---------- Face Verification (offline check-in) ----------
export interface FaceChallengeDto {
  challengeId: string;
  actions: string[];
}

export interface FaceSessionStartDto {
  sessionId: string;
  externalSessionId: string;
  uploadToken: string;
  challenge: FaceChallengeDto;
  expiresAt: string;
  state: string;
  purpose: string;
  contextType: string;
  userId: string;
  playerName?: string | null;
  registrationId?: string | null;
  tournamentId?: string | null;
  faceEnrolled: boolean;
}

export interface FaceSessionStatusDto {
  sessionId: string;
  externalSessionId: string;
  state: string;
  purpose: string;
  contextType: string;
  userId: string;
  registrationId?: string | null;
  challenge?: FaceChallengeDto | null;
  expiresAt: string;
  result?: any;
  failureReason?: string | null;
  livenessPassed?: boolean | null;
  faceMatched?: boolean | null;
  similarity?: number | null;
}

async function apiFormFetch<T>(path: string, token: string, form: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.message || `HTTP ${response.status}: ${response.statusText}`;
    const error = new Error(message) as Error & { errorCode?: string; status?: number };
    error.errorCode = errorBody.errorCode || errorBody.code;
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function startCheckInFaceSession(qrToken: string, token: string): Promise<FaceSessionStartDto> {
  return apiFetch<FaceSessionStartDto>('/api/face-verification/check-in/sessions', token, {
    method: 'POST',
    body: JSON.stringify({ qrToken }),
  });
}

/** Competitor self-test: match live face against enrolled Face ID template. */
export async function startFaceSelfTestSession(token: string): Promise<FaceSessionStartDto> {
  return apiFetch<FaceSessionStartDto>('/api/face-verification/self-test/sessions', token, {
    method: 'POST',
  });
}

export async function submitFacePassiveEvidence(
  sessionId: string,
  token: string,
  frameUris: string[]
): Promise<FaceSessionStatusDto> {
  const form = new FormData();
  frameUris.forEach((uri, index) => {
    form.append('finalFrames', {
      uri,
      name: `frame_${index + 1}.jpg`,
      type: 'image/jpeg',
    } as any);
  });
  return apiFormFetch<FaceSessionStatusDto>(
    `/api/face-verification/sessions/${sessionId}/passive-evidence`,
    token,
    form
  );
}

export async function submitFaceActiveEvidence(
  sessionId: string,
  token: string,
  frameUris: string[],
  videoUri?: string | null
): Promise<FaceSessionStatusDto> {
  const form = new FormData();
  form.append('metadata', JSON.stringify({ cameraMirror: true }));
  frameUris.forEach((uri, index) => {
    form.append('finalFrames', {
      uri,
      name: `final_${index + 1}.jpg`,
      type: 'image/jpeg',
    } as any);
  });
  if (videoUri) {
    form.append('evidenceVideo', {
      uri: videoUri,
      name: 'challenge.mp4',
      type: 'video/mp4',
    } as any);
  }
  return apiFormFetch<FaceSessionStatusDto>(
    `/api/face-verification/sessions/${sessionId}/evidence`,
    token,
    form
  );
}

export interface FaceEnrollmentStatusDto {
  userId: string;
  isEnrolled: boolean;
  status?: string | null;
  modelVersion?: string | null;
  qualityScore?: number | null;
  templatesCount?: number;
  enrolledAt?: string | null;
}

export async function getFaceEnrollmentMe(token: string): Promise<FaceEnrollmentStatusDto> {
  return apiFetch<FaceEnrollmentStatusDto>('/api/face-verification/enrollment/me', token);
}

export async function startFaceEnrollmentSession(token: string): Promise<FaceSessionStartDto> {
  return apiFetch<FaceSessionStartDto>('/api/face-verification/enrollment/sessions', token, {
    method: 'POST',
  });
}

export async function submitFaceEnrollmentEvidence(
  sessionId: string,
  token: string,
  imageUris: string[],
  videoUri?: string | null
): Promise<FaceSessionStatusDto> {
  const form = new FormData();
  form.append('metadata', JSON.stringify({ cameraMirror: true, source: 'expo-profile-fast' }));
  if (videoUri) {
    form.append('evidenceVideo', {
      uri: videoUri,
      name: 'enrollment.mp4',
      type: 'video/mp4',
    } as any);
  }
  imageUris.forEach((uri, index) => {
    form.append('images', {
      uri,
      name: `enrollment_${index + 1}.jpg`,
      type: 'image/jpeg',
    } as any);
  });
  return apiFormFetch<FaceSessionStatusDto>(
    `/api/face-verification/enrollment/sessions/${sessionId}/evidence`,
    token,
    form
  );
}

export interface FaceLandmarkDto {
  label: string;
  x: number;
  y: number;
}

export interface FaceDensePointDto {
  x: number;
  y: number;
}

export interface FaceAnalyzeFrameDto {
  status: string;
  reason?: string | null;
  faceCount?: number;
  bbox?: number[] | null;
  landmarks?: FaceLandmarkDto[];
  landmarksDense?: FaceDensePointDto[];
  imageWidth?: number;
  imageHeight?: number;
  faceRatio?: number;
  brightness?: number;
  sharpness?: number;
  passiveLiveness?: number;
}

export async function analyzeFaceFrame(token: string, frameUri: string): Promise<FaceAnalyzeFrameDto> {
  const form = new FormData();
  form.append('frame', {
    uri: frameUri,
    name: 'frame.jpg',
    type: 'image/jpeg',
  } as any);
  return apiFormFetch<FaceAnalyzeFrameDto>('/api/face-verification/analyze-frame', token, form);
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
