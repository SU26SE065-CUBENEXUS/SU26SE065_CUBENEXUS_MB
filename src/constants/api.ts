import { API_BASE_URL } from './config';

export interface VerifyJudgeStationByStationDto {
  qrToken: string;
  eventId: string;
  roundNumber: number;
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
  groupCompetitorId?: string;
  eventId?: string;
  eventName: string;
  roundNumber?: number;
  groupId?: string;
  groupName: string;
  stationNumber?: number;
  nextSolveNumber?: number;
  solveCount?: number;
  canSubmit: boolean;
  currentScramble?: ScrambleInfoDto;
}

export interface SubmitTraditionalResultDto {
  groupCompetitorId: string;
  solveNumber: number;
  rawTimeMs?: number;
  penaltyTypeId?: string | null;
  scrambleId: string;
  esignatureData?: string | null;
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

// ---------- API Fetch Helper ----------
async function apiFetch<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as Record<string, string>;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
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

// ---------- Operation Endpoints ----------
export async function verifyJudgeStation(dto: VerifyJudgeStationByStationDto, token: string): Promise<VerifyJudgeStationResponseDto> {
  return apiFetch<VerifyJudgeStationResponseDto>('/api/tournament-operation/judge/verify-by-station', token, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
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
