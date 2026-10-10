import Link from "next/link";
import { Eye, GitPullRequest, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="grid-bg relative hidden flex-col justify-between bg-graphite p-10 text-mist lg:flex">
        <Link href="/" aria-label="OmniSight home"><Logo dark /></Link>
        <div className="max-w-md">
          <h2 className="text-2xl font-semibold leading-snug text-white">See the bugs. Fix the UI. Automatically.</h2>
          <p className="mt-3 text-sm text-mist/70">Scan a page at three viewport sizes, review what OmniSight found, and approve CSS fixes that are verified in an isolated copy of your code.</p>
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex gap-3"><Eye className="mt-0.5 h-4 w-4 text-electric" /><span>Screenshots and element evidence for every finding.</span></li>
            <li className="flex gap-3"><ShieldCheck className="mt-0.5 h-4 w-4 text-electric" /><span>Nothing is written without explicit human approval.</span></li>
            <li className="flex gap-3"><GitPullRequest className="mt-0.5 h-4 w-4 text-electric" /><span>Export a patch or open a pull request when you are ready.</span></li>
          </ul>
        </div>
        <p className="text-xs text-steel">Project-II build. Demo-mode analysis is rule-based unless an AI provider is configured.</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-8 inline-block lg:hidden" aria-label="OmniSight home"><Logo /></Link>
          {children}
        </div>
      </main>
    </div>
  );
}
