import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { API_BASE_URL } from '@/constants/config';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------- Pure JS Base64 Decoder (compatible with all engines: Hermes, V8, JSC) ----------
function decodeBase64(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input.replace(/=+$/, '');
  let output = '';
  
  if (str.length % 4 === 1) {
    throw new Error('Invalid base64 string');
  }
  
  for (
    let bc = 0, bs = 0, rbuffer, idx = 0;
    (rbuffer = str.charAt(idx++));
    ~rbuffer && ((bs = bc % 4 ? bs * 64 + rbuffer : rbuffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    rbuffer = chars.indexOf(rbuffer);
  }
  return output;
}

function parseJwt(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = decodeBase64(base64);
    
    // Convert binary string to UTF-8
    const jsonPayload = decodeURIComponent(
      decoded
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding JWT token:', e);
    return null;
  }
}

// ---------- Build user profile from token claims ----------
function buildUserFromToken(token: string): AuthUser | null {
  const payload = parseJwt(token);
  if (!payload) return null;

  const id =
    (payload['sub'] as string) ||
    (payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] as string) ||
    '';

  const role =
    (payload['role'] as string) ||
    (payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] as string) ||
    '';

  const email = (payload['email'] as string) || '';
  const displayName = (payload['display_name'] as string) || '';

  return { id, email, displayName, role };
}

// ---------- Cross-Platform Persistent Storage Engine ----------
const memoryStorage: Record<string, string> = {};
const isWeb = Platform.OS === 'web';

const storage = {
  getItem: (key: string): string | null => {
    try {
      if (isWeb && typeof window !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('Storage not available', e);
    }
    return memoryStorage[key] || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (isWeb && typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('Storage not available', e);
    }
    memoryStorage[key] = value;
  },
  removeItem: (key: string): void => {
    try {
      if (isWeb && typeof window !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Storage not available', e);
    }
    delete memoryStorage[key];
  }
};

// ---------- Auth Provider Component ----------
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from storage on mount
  useEffect(() => {
    const savedToken = storage.getItem('mobile_access_token');
    if (savedToken) {
      const parsedUser = buildUserFromToken(savedToken);
      if (parsedUser) {
        setUser(parsedUser);
        setAccessToken(savedToken);
      } else {
        storage.removeItem('mobile_access_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || 'Login failed. Please check your credentials.');
    }

    const data = await res.json();
    const token = data.accessToken;
    
    const parsedUser = buildUserFromToken(token);
    if (!parsedUser) {
      throw new Error('Failed to parse user profile from JWT token.');
    }

    // Role Guarding - Only COMPETITOR and JUDGE (including related manager/admin roles)
    const upperRole = parsedUser.role.toUpperCase();
    const isCompetitor = upperRole === 'COMPETITOR';
    const isJudge = upperRole === 'JUDGE' || upperRole === 'ADMIN' || upperRole === 'MANAGER';
    
    if (!isCompetitor && !isJudge) {
      throw new Error('Access Denied. Only competitors and judges are authorized on mobile.');
    }

    storage.setItem('mobile_access_token', token);
    setUser(parsedUser);
    setAccessToken(token);
  }, []);

  const logout = useCallback(() => {
    storage.removeItem('mobile_access_token');
    setUser(null);
    setAccessToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
