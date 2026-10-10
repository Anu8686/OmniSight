"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { errMsg } from "@/lib/api";

export interface AsyncState<T> { data: T | null; error: string | null; loading: boolean; reload: () => Promise<void>; setData: (d: T | null) => void }

/** Fetch on mount/dependency change with loading + error + retry. Keeps stale data while reloading. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn); fnRef.current = fn;
  const seq = useRef(0);
  const run = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true); setError(null);
    try { const d = await fnRef.current(); if (my === seq.current) setData(d); }
    catch (e) { if (my === seq.current) setError(errMsg(e)); }
    finally { if (my === seq.current) setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, deps);
  return { data, error, loading, reload: run, setData };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
