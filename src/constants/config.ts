import Constants from 'expo-constants';

const configuredApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

/**
 * Tự động trích xuất IP LAN của máy tính dev chạy Expo server (vd: 192.168.1.x:8088 -> 192.168.1.x:5212).
 * Giúp điện thoại thật scan Expo Go kết nối ngay tới Backend mà không cần sửa tay địa chỉ IP mỗi khi đổi Wi-Fi.
 */
const getDevServerHostIp = (): string => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.developer?.manifestHost ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5212`;
    }
  }
  return 'http://localhost:5212';
};

export const API_BASE_URL = (configuredApiBaseUrl || getDevServerHostIp()).replace(/\/+$/, '');
