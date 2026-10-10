"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import type { Scan } from "@/types";

const DONE = ["completed", "failed", "cancelled"];

/** Starts a scan and polls it every 1.5s until it finishes. */
export function useScanRunner(onFinished?: (s: Scan) => void) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const cb = useRef(onFinished); cb.current = onFinished;

  useEffect(() => { alive.current = true; return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);

  const poll = useCallback((id: number) => {
    timer.current = setTimeout(async () => {
      try {
        const s = await api.scans.get(id);
        if (!alive.current) return;
        setScan(s);
        if (DONE.includes(s.status)) { cb.current?.(s); return; }
      } catch (e) { if (!alive.current) return; toast.error(errMsg(e)); }
      poll(id);
    }, 1500);
  }, []);

  const start = useCallback(async (projectId: number, viewports?: string[]) => {
    setStarting(true);
    try {
      const s = await api.scans.start(projectId, viewports);
      setScan(s); poll(s.id); return s;
    } catch (e) { toast.error(errMsg(e)); return null; }
    finally { setStarting(false); }
  }, [poll]);

  const cancel = useCallback(async () => {
    if (!scan) return;
    try { setScan(await api.scans.cancel(scan.id)); toast.success("Cancellation requested."); }
    catch (e) { toast.error(errMsg(e)); }
  }, [scan]);

  const reset = useCallback(() => { if (timer.current) clearTimeout(timer.current); setScan(null); }, []);
  const running = !!scan && !DONE.includes(scan.status);
  return { scan, starting, running, start, cancel, reset };
}
