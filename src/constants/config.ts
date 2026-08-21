import { Platform } from 'react-native';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Platform.select({
    android: 'https://perfectly-detail-gory.ngrok-free.dev',
    default: 'https://perfectly-detail-gory.ngrok-free.dev',
  });

