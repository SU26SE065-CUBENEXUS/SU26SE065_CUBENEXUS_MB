export type TournamentStatus = 'DRAFT' | 'PUBLISHED' | 'REGISTRATION_OPEN' | 'ONGOING' | 'COMPLETED';

export type RegistrationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'CHECKED_IN';

export type OfflineRegistrationEventStatus = 'REGISTERED' | 'WITHDRAWN';

export interface CompetitorAssignmentDto {
  roundNumber: number;
  groupId: string;
  groupName: string;
  stationNumber?: number | null;
  groupStatusCode: string;
  scheduledAt?: string | null;
  isPublished: boolean;
}

export interface RegisteredEventDetailDto {
  registrationEventId: string;
  eventId: string;
  puzzleTypeName: string;
  eventFormatCode: string;
  statusCode: OfflineRegistrationEventStatus;
  seedTimeMs?: number | null;
  seedSourceCode?: string | null;
  seedGeneratedAt?: string | null;
  assignments?: CompetitorAssignmentDto[] | null;
}

export interface RegistrationDto {
  registrationId: string;
  tournamentId: string;
  tournamentName: string;
  userId: string;
  statusCode: RegistrationStatus;
  registeredAt: string;
  qrToken: string;
  tournamentStartDate?: string | null;
  tournamentEndDate?: string | null;
  tournamentStatusCode?: TournamentStatus | null;
  registeredEvents: RegisteredEventDetailDto[];
}

export interface TournamentDetailDto {
  id: string;
  name: string;
  description?: string | null;
  location?: string | null;
  maxParticipants?: number | null;
  currentParticipants?: number | null;
  bannerUrl?: string | null;
  startDate: string;
  endDate: string;
  registrationOpenAt: string;
  registrationCloseAt: string;
  statusCode: TournamentStatus;
  createdBy: string;
  createdByUserName: string;
  createdAt: string;
  events: EventDetailDto[];
}

export interface EventDetailDto {
  id: string;
  puzzleTypeId: string;
  puzzleTypeName: string;
  puzzleTypeCode: string;
  eventFormatCode: string;
  timeLimitMs?: number | null;
  cutoffTimeMs?: number | null;
  solveCount: number;
  sortOrder?: number | null;
  maxCapacity?: number | null;
  medleyPuzzles: MedleyPuzzleDetailDto[];
}

export interface MedleyPuzzleDetailDto {
  id: string;
  puzzleTypeId: string;
  puzzleTypeName: string;
  puzzleTypeCode: string;
  sortOrder: number;
}
