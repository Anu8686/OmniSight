import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";
import { AuthProvider } from "@/hooks/use-auth";

const sans = localFont({ src: "./fonts/Inter.woff2", variable: "--font-sans", display: "swap", weight: "100 900" });
const mono = localFont({ src: "./fonts/JetBrainsMono.woff2", variable: "--font-mono", display: "swap", weight: "100 800" });

export const metadata: Metadata = {
  title: { default: "OmniSight — Visual QA and human-approved UI self-healing", template: "%s · OmniSight" },
  description: "OmniSight scans your UI at desktop, tablet and mobile sizes, finds visual bugs, and proposes CSS fixes you approve and verify.",
  icons: { icon: "/favicon.svg" },
};

const themeScript = `try{var t=localStorage.getItem('omnisight-theme');if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Toaster position="top-right" richColors closeButton toastOptions={{ classNames: { toast: "rounded-lg" } }} />
      </body>
    </html>
  );
}
