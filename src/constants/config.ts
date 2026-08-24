const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

// Keep machine-specific LAN addresses out of source control. Expo inlines
// EXPO_PUBLIC_* variables from .env files into the application bundle.
export const API_BASE_URL = (configuredApiBaseUrl || 'http://localhost:5212').replace(/\/+$/, '');
