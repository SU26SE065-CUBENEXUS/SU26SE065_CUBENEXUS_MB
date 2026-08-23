import { Platform } from 'react-native';

// Android Emulators resolve host localhost via 10.0.2.2.
// iOS Simulators and Web resolve host localhost via 127.0.0.1 / localhost.
export const API_BASE_URL = Platform.select({
  android: 'http://10.10.89.95:5212',
  default: 'http://10.10.89.95:5212',
});

// export const API_BASE_URL =
//   'https://cubenexus-api-production.up.railway.app';
