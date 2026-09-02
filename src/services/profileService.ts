import { getApiBaseUrl } from '@/constants/config';

export interface UserProfileDto {
  id: string;
  email: string;
  displayName: string;
  role: string;
  phone?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
}

export interface UpdateProfileRequestDto {
  displayName?: string | null;
  phone?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
}

export async function fetchMyProfile(token: string): Promise<UserProfileDto> {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/api/auth/My-Profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      'bypass-tunnel-reminder': 'true',
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to fetch profile (HTTP ${res.status})`);
  }

  return await res.json();
}

export async function updateMyProfile(
  token: string,
  data: UpdateProfileRequestDto
): Promise<UserProfileDto> {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/api/auth/Update-Profile`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      'bypass-tunnel-reminder': 'true',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to update profile (HTTP ${res.status})`);
  }

  return await res.json();
}
