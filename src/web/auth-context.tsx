import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "./types";
import { api } from "./api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!api.getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.getMe();
      setUser(res.user);
    } catch {
      api.logout();
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const handler = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener("az:unauthorized", handler);
    return () => window.removeEventListener("az:unauthorized", handler);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    api.setToken(res.token);
    setUser(res.user);
  };

  const register = async (username: string, password: string, email?: string) => {
    const res = await api.register(username, password, email);
    api.setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
