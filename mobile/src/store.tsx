import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, emptyData, Data } from './logic';

type Store = {
  booted: boolean;
  token: string | null;
  data: Data;
  meId: string | null;
  register: (username: string, password: string, name: string, emoji: string, color: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  mutate: (type: string, payload?: any) => Promise<void>;
};

const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [booted, setBooted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<Data>(emptyData());
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const t = await AsyncStorage.getItem('pp_token');
        if (t) {
          const r = await api('/api/state', 'GET', null, t);
          setData(r.data); setMeId(r.meId); setToken(t);
        }
      } catch {}
      setBooted(true);
    })();
  }, []);

  const register = useCallback(async (username: string, password: string, name: string, emoji: string, color: string) => {
    const r = await api('/api/register', 'POST', { username, password, name, emoji, color });
    await AsyncStorage.setItem('pp_token', r.token);
    setToken(r.token); setData(r.data); setMeId(r.meId);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await api('/api/login', 'POST', { username, password });
    await AsyncStorage.setItem('pp_token', r.token);
    setToken(r.token); setData(r.data); setMeId(r.meId);
  }, []);

  const logout = useCallback(async () => {
    try { await api('/api/logout', 'POST', null, token); } catch {}
    await AsyncStorage.removeItem('pp_token');
    setToken(null); setData(emptyData()); setMeId(null);
  }, [token]);

  const mutate = useCallback(async (type: string, payload?: any) => {
    const r = await api('/api/mutate', 'POST', { type, payload }, token);
    setData(r.data); setMeId(r.meId);
  }, [token]);

  return <Ctx.Provider value={{ booted, token, data, meId, register, login, logout, mutate }}>{children}</Ctx.Provider>;
}
