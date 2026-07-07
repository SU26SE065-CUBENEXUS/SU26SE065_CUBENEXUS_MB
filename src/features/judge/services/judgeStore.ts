import {
  CheckInRecord,
  JudgeDutyMode,
  JudgeHistoryRecord,
  JudgeLaneConfig,
  JudgeScoringSession,
  JudgeStationCompetitor,
} from '../types';

interface JudgeStoreState {
  dutyMode: JudgeDutyMode | null;
  selectedCompetitorId: string | null;
  stationRoster: JudgeStationCompetitor[];
  activeLaneConfig: JudgeLaneConfig | null;
  activeTournament: any;
  activeEvent: any;
  localCheckInHistory: CheckInRecord[];
  judgeSessionHistory: JudgeHistoryRecord[];
  verifiedCompetitorIds: string[];
  activeScoringSession: JudgeScoringSession | null;
}

const listeners = new Set<() => void>();

const state: JudgeStoreState = {
  dutyMode: null,
  selectedCompetitorId: null,
  stationRoster: [],
  activeLaneConfig: null,
  activeTournament: null,
  activeEvent: null,
  localCheckInHistory: [],
  judgeSessionHistory: [],
  verifiedCompetitorIds: [],
  activeScoringSession: null,
};

const notify = (): void => {
  listeners.forEach(listener => listener());
};

export const subscribeJudgeStore = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getDutyMode = (): JudgeDutyMode | null => state.dutyMode;
export const setDutyMode = (mode: JudgeDutyMode | null): void => {
  state.dutyMode = mode;
  notify();
};

export const getSelectedCompetitorId = (): string | null => state.selectedCompetitorId;
export const setSelectedCompetitorId = (id: string | null): void => {
  state.selectedCompetitorId = id;
  notify();
};

export const getStationQueue = (): JudgeStationCompetitor[] => state.stationRoster;
export const setStationQueue = (queue: JudgeStationCompetitor[]): void => {
  state.stationRoster = queue;
  notify();
};

export const replaceStationCompetitor = (competitor: JudgeStationCompetitor): void => {
  const existing = state.stationRoster.find(item => item.groupCompetitorId === competitor.groupCompetitorId);
  state.stationRoster = existing
    ? state.stationRoster.map(item => item.groupCompetitorId === competitor.groupCompetitorId ? competitor : item)
    : [...state.stationRoster, competitor];
  notify();
};

export const updateCompetitor = (
  groupCompetitorId: string,
  updater: (competitor: JudgeStationCompetitor) => JudgeStationCompetitor
): void => {
  state.stationRoster = state.stationRoster.map(competitor =>
    competitor.groupCompetitorId === groupCompetitorId ? updater(competitor) : competitor
  );
  notify();
};

export const clearQueue = (): void => {
  state.stationRoster = [];
  state.verifiedCompetitorIds = [];
  state.activeScoringSession = null;
  state.selectedCompetitorId = null;
  notify();
};

export const getLaneConfig = (): JudgeLaneConfig | null => state.activeLaneConfig;
export const setLaneConfig = (config: JudgeLaneConfig | null): void => {
  state.activeLaneConfig = config;
  notify();
};
export const clearLaneConfig = (): void => {
  state.activeLaneConfig = null;
  notify();
};

export const getActiveTournament = (): any => state.activeTournament;
export const setActiveTournament = (tournament: any): void => {
  state.activeTournament = tournament;
  notify();
};

export const getActiveEvent = (): any => state.activeEvent;
export const setActiveEvent = (event: any): void => {
  state.activeEvent = event;
  notify();
};

export const getLocalCheckInHistory = (): CheckInRecord[] => state.localCheckInHistory;
export const addCheckInRecord = (record: CheckInRecord): void => {
  const exists = state.localCheckInHistory.some(item => item.registrationId === record.registrationId);
  if (!exists) {
    state.localCheckInHistory = [record, ...state.localCheckInHistory];
    notify();
  }
};
export const clearCheckInHistory = (): void => {
  state.localCheckInHistory = [];
  notify();
};

export const getJudgeSessionHistory = (): JudgeHistoryRecord[] => state.judgeSessionHistory;
export const addJudgeHistoryRecord = (record: JudgeHistoryRecord): void => {
  state.judgeSessionHistory = [record, ...state.judgeSessionHistory];
  notify();
};
export const clearJudgeSessionHistory = (): void => {
  state.judgeSessionHistory = [];
  notify();
};

export const getVerifiedCompetitorIds = (): string[] => state.verifiedCompetitorIds;
export const markCompetitorVerified = (groupCompetitorId: string): void => {
  if (!state.verifiedCompetitorIds.includes(groupCompetitorId)) {
    state.verifiedCompetitorIds = [...state.verifiedCompetitorIds, groupCompetitorId];
  }
  notify();
};

export const clearVerifiedCompetitors = (): void => {
  state.verifiedCompetitorIds = [];
  notify();
};

export const getActiveScoringSession = (): JudgeScoringSession | null => state.activeScoringSession;
export const setActiveScoringSession = (session: JudgeScoringSession | null): void => {
  state.activeScoringSession = session;
  notify();
};

export const clearLaneConnection = (): void => {
  state.selectedCompetitorId = null;
  state.stationRoster = [];
  state.activeLaneConfig = null;
  state.verifiedCompetitorIds = [];
  state.activeScoringSession = null;
  notify();
};

export const clearJudgeStore = (): void => {
  state.dutyMode = null;
  state.selectedCompetitorId = null;
  state.stationRoster = [];
  state.activeLaneConfig = null;
  state.activeTournament = null;
  state.activeEvent = null;
  state.localCheckInHistory = [];
  state.judgeSessionHistory = [];
  state.verifiedCompetitorIds = [];
  state.activeScoringSession = null;
  notify();
};
