import { SimCompetitor } from './types';

export const MOCK_SIM_COMPETITORS: SimCompetitor[] = [
  {
    groupCompetitorId: "169818e9-ec3e-419b-a6ff-df519767ce6c",
    competitorName: "Nguyen Hoang Nam",
    userCode: "WCA-2024NAM01",
    groupName: "Group A",
    stationNumber: 4,
    qrToken: JSON.stringify({
      RegistrationId: "169818e9-ec3e-419b-a6ff-df519767ce6c",
      Token: "0915b6b8e58b425a884fd2413e706f41",
      ExpiresAt: "2026-07-07T18:00:00Z"
    }),
    competitorStatus: "Checked-in"
  },
  {
    groupCompetitorId: "2b5f38a9-da2e-4b2e-9d22-df389088cb11",
    competitorName: "Tran Minh Tu",
    userCode: "WCA-2023TU02",
    groupName: "Group A",
    stationNumber: 4,
    qrToken: JSON.stringify({
      RegistrationId: "2b5f38a9-da2e-4b2e-9d22-df389088cb11",
      Token: "51c09930beba43e49e2182098d5cbb81",
      ExpiresAt: "2026-07-07T18:00:00Z"
    }),
    competitorStatus: "Checked-in"
  },
  {
    groupCompetitorId: "3c6628b0-ea11-419b-a6ff-df38927aa88d",
    competitorName: "Le Hoang Bach",
    userCode: "WCA-2025BACH03",
    groupName: "Group B",
    stationNumber: 4,
    qrToken: JSON.stringify({
      RegistrationId: "3c6628b0-ea11-419b-a6ff-df38927aa88d",
      Token: "71b09930beba43e49e2182098d5cbb92",
      ExpiresAt: "2026-07-07T18:00:00Z"
    }),
    competitorStatus: "Checked-in"
  }
];

export const MOCK_PENALTY_TYPES = [
  { id: 'ok-uuid', code: 'OK', label: 'OK', timeAdditionMs: 0 },
  { id: 'plus2-uuid', code: 'PLUS_2', label: '+2s', timeAdditionMs: 2000 },
  { id: 'dnf-uuid', code: 'DNF', label: 'DNF', timeAdditionMs: 0 },
];
