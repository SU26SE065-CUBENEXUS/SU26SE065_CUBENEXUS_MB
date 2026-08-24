import { API_BASE_URL } from '@/constants/config';
import { RegistrationDto, TournamentDetailDto } from '@/types/competitor';

export async function fetchCompetitorRegistrations(token: string): Promise<RegistrationDto[]> {
  try {
    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/me/registrations`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'bypass-tunnel-reminder': 'true',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data: RegistrationDto[] = await res.json();
    return data.map(reg => enrichRegistration(reg));
  } catch (error) {
    console.warn('Failed to fetch real registrations, using empty fallback:', error);
    return [];
  }
}

export async function fetchPublicTournaments(): Promise<TournamentDetailDto[]> {
  try {
    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/tournaments`, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'bypass-tunnel-reminder': 'true',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.warn('Failed to fetch public tournaments:', error);
    return [];
  }
}

export async function fetchTournamentById(id: string): Promise<TournamentDetailDto | null> {
  try {
    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const res = await fetch(`${baseUrl}/api/tournaments/${id}`, {
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'bypass-tunnel-reminder': 'true',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.warn(`Failed to fetch tournament ${id}:`, error);
    return null;
  }
}

export async function registerTournament(
  tournamentId: string,
  token: string,
  eventIds: string[]
): Promise<any> {
  const baseUrl = API_BASE_URL.replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/api/tournament-registration/tournaments/${tournamentId}/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      'bypass-tunnel-reminder': 'true',
    },
    body: JSON.stringify({
      events: eventIds.map((id) => ({ eventId: id })),
      selectedEventIds: eventIds,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Registration failed with HTTP ${res.status}`);
  }

  return await res.json();
}

export async function cancelRegistration(
  token: string,
  registrationId: string,
): Promise<RegistrationDto> {
  const res = await fetch(`${API_BASE_URL}/api/tournament-registration/registrations/${registrationId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Cancellation failed with HTTP ${res.status}`);
  }

  return await res.json();
}

function enrichRegistration(reg: RegistrationDto): RegistrationDto {
  const today = new Date();

  // Only fill in missing dates, never overwrite server-provided data
  const startDate = reg.tournamentStartDate
    ? new Date(reg.tournamentStartDate).toISOString()
    : new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2, 9, 0).toISOString();

  const endDate = reg.tournamentEndDate
    ? new Date(reg.tournamentEndDate).toISOString()
    : new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3, 18, 0).toISOString();

  // Trust the server-returned tournamentStatusCode — never override it with client-side guesses.
  // The backend is the source of truth for tournament status (DRAFT|PUBLISHED|ONGOING|COMPLETED|CANCELLED).
  return {
    ...reg,
    tournamentStartDate: reg.tournamentStartDate || startDate,
    tournamentEndDate: reg.tournamentEndDate || endDate,
  };
}
