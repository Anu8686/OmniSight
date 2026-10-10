"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setUnauthorizedHandler } from "@/lib/api";
import type { User } from "@/types";

interface AuthCtx { user: User | null; checking: boolean; refresh: () => Promise<User | null>; setUser: (u: User | null) => void; logout: () => Promise<void> }
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    try { const u = await api.auth.me(); setUser(u); return u; }
    catch { setUser(null); return null; }
    finally { setChecking(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => { setUser(null); router.replace("/login"); });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  const logout = useCallback(async () => {
    try { await api.auth.logout(); } catch { /* cookie may already be gone */ }
    setUser(null); router.replace("/login");
  }, [router]);

  const value = useMemo(() => ({ user, checking, refresh, setUser, logout }), [user, checking, refresh, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAuth() { const c = useContext(Ctx); if (!c) throw new Error("useAuth outside AuthProvider"); return c; }
