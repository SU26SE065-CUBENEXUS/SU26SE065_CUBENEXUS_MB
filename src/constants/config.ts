import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const STORAGE_CUSTOM_API_URL_KEY = 'cubenexus_custom_api_base_url';

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

export const DEFAULT_API_BASE_URL = (configuredApiBaseUrl || getDevServerHostIp()).replace(/\/+$/, '');

/** Biến runtime có thể thay đổi động khi người dùng cấu hình qua UI */
export let API_BASE_URL = DEFAULT_API_BASE_URL;

/** Lấy URL API hiện tại */
export const getApiBaseUrl = (): string => API_BASE_URL;

/** Cập nhật URL trong bộ nhớ */
export const setRuntimeApiBaseUrl = (url: string) => {
  API_BASE_URL = url.trim().replace(/\/+$/, '');
};

/** Khởi tạo đọc URL từ AsyncStorage khi app mở */
export const initApiBaseUrl = async (): Promise<string> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_CUSTOM_API_URL_KEY);
    if (stored && stored.trim().startsWith('http')) {
      const cleaned = stored.trim().replace(/\/+$/, '');
      setRuntimeApiBaseUrl(cleaned);
      return cleaned;
    }
  } catch (e) {
    console.warn('[config] Failed to load custom API base url:', e);
  }
  return API_BASE_URL;
};

/** Lưu URL mới vào AsyncStorage và áp dụng ngay */
export const saveCustomApiBaseUrl = async (url: string): Promise<string> => {
  const cleaned = url.trim().replace(/\/+$/, '');
  setRuntimeApiBaseUrl(cleaned);
  await AsyncStorage.setItem(STORAGE_CUSTOM_API_URL_KEY, cleaned);
  return cleaned;
};

/** Đặt lại về URL mặc định ban đầu */
export const resetCustomApiBaseUrl = async (): Promise<string> => {
  await AsyncStorage.removeItem(STORAGE_CUSTOM_API_URL_KEY);
  setRuntimeApiBaseUrl(DEFAULT_API_BASE_URL);
  return DEFAULT_API_BASE_URL;
};
