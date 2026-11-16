import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, clearTokens, getAccessToken, setTokens } from './api';

export interface CurrentUser {
  id: string;
  email: string;
  platformRole: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<CurrentUser>('/v1/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: CurrentUser }>('/v1/auth/login', {
      email,
      password,
    });
    setTokens(res.accessToken, res.refreshToken);
    await loadUser();
  }, [loadUser]);

  const signup = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; refreshToken: string; user: CurrentUser }>('/v1/auth/signup', {
      email,
      password,
    });
    setTokens(res.accessToken, res.refreshToken);
    await loadUser();
  }, [loadUser]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
