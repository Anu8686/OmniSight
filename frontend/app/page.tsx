import Link from "next/link";
import { Camera, ClipboardCheck, GitPullRequest, Layers, Lock, Monitor, ScanSearch, ShieldCheck, Sparkles, UserCheck, Wand2, FolderLock, FileDiff } from "lucide-react";
import { Logo } from "@/components/logo";
import { HeroCtas, NavAuth } from "@/components/landing/cta";
import { DashboardPreview } from "@/components/landing/preview";

const features = [
  { icon: ScanSearch, title: "Visual AI Audits", body: "Headless Chromium captures the page and OmniSight inspects layout, overflow, clipping, contrast and alignment. A vision model can be plugged in; without one, deterministic rules run and are labelled as such." },
  { icon: Monitor, title: "Responsive Testing", body: "Every scan renders desktop, tablet and mobile viewports, then groups the same bug across sizes so you fix it once." },
  { icon: Wand2, title: "Self-Healing CSS", body: "Each finding can carry a scoped CSS change with an explanation and diff. You approve it, it is applied to a copy, and a re-scan proves it worked." },
  { icon: GitPullRequest, title: "GitHub Integration", body: "Export a patch, or open a pull request for an approved fix. Without credentials the flow is simulated and says so." },
];
const steps = [
  { n: "01", icon: Camera, title: "Scan", body: "Point OmniSight at an authorised URL. It captures screenshots, console errors, failed requests and element geometry at three viewports." },
  { n: "02", icon: Sparkles, title: "Analyze", body: "Findings are ranked by severity with a confidence score, the exact element, a highlighted bounding box and a plain-language explanation." },
  { n: "03", icon: ClipboardCheck, title: "Verify", body: "Approve a fix, apply it in an isolated workspace, re-scan, and compare before and after. Regressions are reported, not hidden." },
];
const tech = [
  ["Playwright + Chromium", "Browser automation and screenshots"], ["FastAPI", "Typed REST API and background scan jobs"],
  ["Next.js + TypeScript", "This interface, built on the App Router"], ["SQLAlchemy", "Projects, scans, issues and audit trail"],
  ["Optional vision model", "Configured by environment, never in the browser"], ["Unified diffs", "Reviewable patches you can download"],
];
const security = [
  { icon: UserCheck, title: "Explicit approval", body: "No fix is applied and no pull request is opened until a person approves it." },
  { icon: FolderLock, title: "Isolated workspace", body: "Changes are written to a temporary copy. Your original source files are never modified." },
  { icon: Lock, title: "Guarded scan targets", body: "Scans are limited to allowed hosts, and internal network addresses are rejected." },
  { icon: FileDiff, title: "Rollback and patches", body: "Every applied change can be rolled back, and every fix exports as a standard patch." },
];

export default function Landing() {
  return (
    <div className="bg-canvas">
      <header className="sticky top-0 z-40 border-b border-slate bg-graphite/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="OmniSight home"><Logo dark /></Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {[["Product", "#product"], ["Features", "#features"], ["Workflow", "#workflow"], ["Security", "#security"]].map(([l, h]) => (
              <a key={l} href={h} className="rounded-md px-3 py-1.5 text-sm font-medium text-mist/80 hover:text-white">{l}</a>
            ))}
          </nav>
          <div className="flex items-center gap-1"><NavAuth /></div>
        </div>
      </header>

      <section id="product" className="grid-bg bg-graphite text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:pt-20">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate bg-slate/40 px-3 py-1 text-xs text-mist/80"><span className="h-1.5 w-1.5 rounded-full bg-electric" />Visual QA with human-approved fixes</p>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">See the Bugs.<br />Fix the UI.<br /><span className="text-electric">Automatically.</span></h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-mist/75">OmniSight scans your site at desktop, tablet and mobile sizes, points to the exact element that is broken, and proposes a CSS fix. You approve it, it is verified in an isolated copy, and your source stays untouched.</p>
            <div className="mt-8"><HeroCtas /></div>
            <p className="mt-4 text-xs text-steel">Runs locally. Demo mode uses rule-based analysis; a vision model is optional.</p>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl"><p className="text-sm font-medium text-primary">Features</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">From a screenshot to a verified fix</h2><p className="mt-3 text-muted">The parts of visual QA that are tedious to do by hand, in one reviewable workflow.</p></div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <article key={f.title} className="rounded-xl border border-line bg-surface p-5 shadow-card">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><f.icon className="h-5 w-5" /></div>
              <h3 className="font-semibold">{f.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl"><p className="text-sm font-medium text-primary">Workflow</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Scan. Analyze. Verify.</h2></div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
              <li key={s.n} className="relative rounded-xl border border-line bg-canvas p-6">
                <div className="mb-4 flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-white"><s.icon className="h-5 w-5" /></span><span className="font-mono text-sm text-steel">{s.n}</span></div>
                <h3 className="text-lg font-semibold">{s.title}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted">Behind the scenes the self-healing loop runs: Plan, Analyze, Propose Fix, Request Approval, Apply in Isolated Workspace, Re-scan, Evaluate, Report.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6" aria-labelledby="tech-h">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
          <div><p className="text-sm font-medium text-primary">Technology</p><h2 id="tech-h" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Built on tools you already trust</h2><p className="mt-3 text-muted">No black box. Every finding includes the evidence it came from, and every fix is a plain CSS diff.</p></div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {tech.map(([t, d]) => (<li key={t} className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4"><Layers className="mt-0.5 h-4 w-4 shrink-0 text-steel" /><span><span className="block text-sm font-semibold">{t}</span><span className="text-sm text-muted">{d}</span></span></li>))}
          </ul>
        </div>
      </section>

      <section id="security" className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl"><p className="flex items-center gap-2 text-sm font-medium text-electric"><ShieldCheck className="h-4 w-4" />Security and human approval</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">AI proposes. You decide.</h2><p className="mt-3 text-mist/70">OmniSight never edits production sites or your original files. It prepares a change, shows you the diff, and waits.</p></div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {security.map((s) => (<div key={s.title} className="rounded-xl border border-white/10 bg-white/5 p-5"><s.icon className="mb-3 h-5 w-5 text-electric" /><h3 className="font-semibold">{s.title}</h3><p className="mt-1.5 text-sm text-mist/70">{s.body}</p></div>))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Run your first visual audit</h2>
        <p className="mx-auto mt-2 max-w-md text-muted">Create an account and scan the bundled demo site in about a minute.</p>
        <div className="mt-6 flex justify-center gap-3"><Link href="/register" className="inline-flex h-11 items-center rounded-md bg-primary px-6 text-[15px] font-medium text-white hover:bg-[#1d4fd0]">Start Visual Audit</Link></div>
      </section>

      <footer className="border-t border-slate bg-graphite text-mist/70">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
          <div><Logo dark /><p className="mt-3 max-w-sm text-sm">An academic Project-II build: AI-assisted visual QA with human-approved, verified UI fixes.</p></div>
          <nav aria-label="Footer product" className="space-y-2 text-sm"><p className="font-medium text-white">Product</p><a className="block hover:text-white" href="#features">Features</a><a className="block hover:text-white" href="#workflow">Workflow</a><a className="block hover:text-white" href="#security">Security</a></nav>
          <nav aria-label="Footer account" className="space-y-2 text-sm"><p className="font-medium text-white">Account</p><Link className="block hover:text-white" href="/login">Sign in</Link><Link className="block hover:text-white" href="/register">Create account</Link></nav>
        </div>
        <div className="border-t border-slate py-4 text-center text-xs text-steel">OmniSight. Demo-mode analysis is rule-based unless an AI provider is configured.</div>
      </footer>
    </div>
  );
}
