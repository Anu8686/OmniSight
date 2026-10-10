"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import type { Scan } from "@/types";

/** Loads a scan and, while it is queued/running, polls it every 1.5s. */
export function useScanRunnerForExisting(id: string) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const s = await api.scans.get(id);
      if (!alive.current) return;
      setScan(s); setError(null);
      if (s.status === "queued" || s.status === "running") timer.current = setTimeout(load, 1500);
    } catch (e) { if (alive.current) setError(errMsg(e)); }
  }, [id]);

  useEffect(() => { alive.current = true; setScan(null); load(); return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }; }, [load]);

  const cancel = useCallback(async () => {
    try { setScan(await api.scans.cancel(Number(id))); toast.success("Cancellation requested."); if (timer.current) clearTimeout(timer.current); load(); }
    catch (e) { toast.error(errMsg(e)); }
  }, [id, load]);

  return { scan, error, reload: load, cancel, active: !!scan && (scan.status === "queued" || scan.status === "running") };
}
