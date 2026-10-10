/** Static illustration of a scan report. Not live data. */
export function DashboardPreview() {
  const rows = [
    { sev: "Critical", c: "bg-crimson", t: "Checkout button clipped by container", v: "mobile" },
    { sev: "High", c: "bg-crimson-dark", t: "Horizontal overflow at 390px", v: "mobile" },
    { sev: "Medium", c: "bg-[#B45309]", t: "Navigation wraps onto 2 rows", v: "desktop" },
    { sev: "Medium", c: "bg-[#B45309]", t: "Card misaligned with its row by 28px", v: "desktop" },
  ];
  return (
    <figure className="relative" aria-label="Illustration of an OmniSight scan report">
      <div className="overflow-hidden rounded-xl border border-slate bg-[#181B22] shadow-pop">
        <div className="flex items-center gap-2 border-b border-slate bg-graphite px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-steel/60" /><span className="h-2.5 w-2.5 rounded-full bg-steel/60" /><span className="h-2.5 w-2.5 rounded-full bg-steel/60" />
          <span className="ml-3 truncate rounded-md bg-slate/60 px-3 py-0.5 font-mono text-[11px] text-mist/70">omnisight / scans / report</span>
        </div>
        <div className="grid gap-px bg-slate md:grid-cols-[1.05fr_1fr]">
          <div className="bg-[#1B1F27] p-4">
            <div className="mb-3 flex items-center justify-between text-[11px] text-mist/60">
              <div className="flex gap-1.5">{["Desktop", "Tablet", "Mobile"].map((t, i) => <span key={t} className={`rounded px-2 py-0.5 ${i === 0 ? "bg-primary text-white" : "bg-slate/60"}`}>{t}</span>)}</div>
              <span>1440 × 900</span>
            </div>
            <svg viewBox="0 0 320 220" className="w-full rounded-lg border border-slate bg-[#F5F7FA]" role="img" aria-label="Wireframe of a page with a highlighted element">
              <rect width="320" height="26" fill="#E8ECF2" /><rect x="12" y="9" width="34" height="8" rx="3" fill="#687386" />
              <rect x="150" y="9" width="30" height="8" rx="3" fill="#B8C0CD" /><rect x="188" y="9" width="30" height="8" rx="3" fill="#B8C0CD" /><rect x="226" y="9" width="30" height="8" rx="3" fill="#B8C0CD" />
              <rect x="12" y="40" width="150" height="12" rx="3" fill="#343A46" /><rect x="12" y="60" width="120" height="6" rx="3" fill="#B8C0CD" /><rect x="12" y="72" width="100" height="6" rx="3" fill="#B8C0CD" />
              <rect x="12" y="90" width="64" height="20" rx="6" fill="#2563EB" />
              <rect x="180" y="38" width="128" height="72" rx="8" fill="#E8ECF2" />
              <rect x="12" y="130" width="92" height="74" rx="8" fill="#fff" stroke="#E0E5ED" /><rect x="114" y="146" width="92" height="74" rx="8" fill="#fff" stroke="#E0E5ED" /><rect x="216" y="130" width="92" height="74" rx="8" fill="#fff" stroke="#E0E5ED" />
              <rect x="110" y="140" width="100" height="84" rx="4" fill="rgba(220,20,60,0.12)" stroke="#DC143C" strokeWidth="2" />
              <rect x="110" y="126" width="62" height="13" rx="3" fill="#DC143C" /><text x="115" y="136" fontSize="7" fill="#fff" fontFamily="monospace">card · +28px</text>
            </svg>
          </div>
          <div className="bg-[#1B1F27] p-4">
            <div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium text-white">Findings</span><span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-[#93b4fb]">Rule-based demo analysis</span></div>
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.t} className="flex items-start gap-2.5 rounded-lg border border-slate bg-graphite/70 p-2.5">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${r.c}`} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs text-white">{r.t}</span><span className="text-[10px] text-mist/50">{r.sev} · {r.v}</span></span>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg border border-slate p-2.5">
              <div className="mb-1.5 flex justify-between text-[10px] text-mist/60"><span>Proposed fix · styles.css</span><span className="text-[#93b4fb]">awaiting approval</span></div>
              <div className="space-y-0.5 font-mono text-[10px] leading-4"><div className="bg-crimson/20 px-1 text-[#fecdd3]">- margin-top: 28px;</div><div className="bg-electric/20 px-1 text-[#bfdbfe]">+ margin-top: 0;</div></div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs text-mist/50">Illustration of the scan report view. Not live data.</figcaption>
    </figure>
  );
}
