export type PenaltyMode = 'None' | '+2' | 'DNF';

export type JudgeDutyMode = 'CHECK_IN' | 'STATION';

export type JudgeRosterBackendStatus = 'WAITING' | 'PARTIAL' | 'DONE' | 'ABSENT' | 'DNS';
export type JudgeCompetitorSessionState = 'IDLE' | 'VERIFIED' | 'SCORING' | 'ISSUE';

export interface JudgeTournamentContext {
  tournamentId: string;
  tournamentName: string;
  tournamentDate?: string;
  tournamentStatus?: string;
}

export interface JudgeLaneConfig {
  tournamentId: string;
  eventId: string;
  roundNumber: number;
  groupNumber: number;
  stationNumber: number;
}

export interface JudgeStationConnection {
  isConnected: boolean;
  status: 'Disconnected' | 'Connecting' | 'Connected' | 'Failed';
}

export interface CompetitorQrPayload {
  RegistrationId: string;
  Token: string;
  ExpiresAt: string;
}

export interface JudgeStationCompetitor {
  groupCompetitorId: string;
  groupId: string;
  groupName: string;
  roundNumber: number;
  stationNumber: number;
  eventId: string;
  eventName: string;
  competitorName: string;
  totalSolveCount: number;
  submittedSolveCount: number;
  nextSolveNumber: number | null;
  canSubmit: boolean;
  backendStatus: JudgeRosterBackendStatus;
  currentSolveNumber: number;
  solveProgress: string;
  lastScannedAt: string | null;
  sessionState: JudgeCompetitorSessionState;
}

export interface CompetitorSolveProgress {
  groupCompetitorId: string;
  eventId: string;
  eventName: string;
  roundNumber: number;
  groupId: string;
  groupName: string;
  stationNumber: number;
  solveCount: number;
  submittedSolveNumbers: number[];
  submittedCount: number;
  nextSolveNumber?: number | null;
  canSubmit: boolean;
  reason?: string | null;
  currentScramble?: {
    scrambleId: string;
    solveNumber: number;
    sequence: string;
  } | null;
}

export interface JudgeScoringSession {
  groupCompetitorId: string;
  solveNumber: number;
}

export interface PenaltyType {
  id: string;
  code: 'OK' | 'PLUS_2' | 'DNF';
  label: string;
  timeAdditionMs: number;
}

export interface SimCompetitor {
  groupCompetitorId: string;
  competitorName: string;
  userCode: string;
  groupName: string;
  stationNumber: number;
  qrToken: string;
  competitorStatus: string;
}

export interface VerifiedCompetitor {
  success: boolean;
  message: string;
  groupCompetitorId: string;
  eventId: string;
  eventName: string;
  roundNumber: number;
  groupId: string;
  groupName: string;
  stationNumber: number;
  nextSolveNumber: number;
  solveCount: number;
  canSubmit: boolean;
  currentScramble?: {
    scrambleId: string;
    solveNumber: number;
    sequence: string;
  } | null;
  competitorName?: string;
}

export interface CheckInRecord {
  registrationId: string;
  competitorName: string;
  checkedInAt: string;
  statusCode: string;
  qrToken: string;
}

export interface JudgeHistoryRecord {
  groupCompetitorId: string;
  competitorName: string;
  eventName: string;
  groupName: string;
  stationNumber: number;
  solveNumber: number;
  finalTimeMs: number | null;
  isDnf: boolean;
  submittedAt: string;
}
