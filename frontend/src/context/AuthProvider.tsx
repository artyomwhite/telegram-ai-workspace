'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { authStorage } from '@/lib/auth-storage';
import type { User } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const profile = await api.getProfile();
      setUser(profile);
      const token = authStorage.getAccessToken();
      const refresh = authStorage.getRefreshToken();
      if (token && refresh) {
        authStorage.setTokens(token, refresh, profile);
      }
    } catch {
      authStorage.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const stored = authStorage.getUser() as User | null;
    const token = authStorage.getAccessToken();
    if (stored && token) {
      setUser(stored);
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    authStorage.setTokens(res.accessToken, res.refreshToken, res.user);
    setUser(res.user);
    router.push('/dashboard');
  };

  const register = async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => {
    const res = await api.register(data);
    authStorage.setTokens(res.accessToken, res.refreshToken, res.user);
    setUser(res.user);
    router.push('/dashboard');
  };

  const logout = () => {
    authStorage.clear();
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
