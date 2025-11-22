import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import VCAuthProvider from "./VCAuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Proof of Eligibility",
  description: "Privacy-first clinical screening with confidential compute.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-50`}
      >
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <nav className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between text-sm text-slate-100">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-sky-500 flex items-center justify-center text-[11px] font-semibold text-slate-950 shadow-[0_0_18px_rgba(56,189,248,0.8)]">
                P
              </span>
              <div className="flex flex-col leading-tight">
                <span className="font-semibold text-slate-50 text-sm tracking-tight">
                  Proof of Eligibility
                </span>
                <span className="text-[11px] text-slate-400">
                  Farma-grade patient screening · Confidential compute
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-full border border-sky-500/60 bg-sky-500/10 text-slate-50 hover:bg-sky-500/25 hover:border-sky-400 transition-colors shadow-[0_0_18px_rgba(56,189,248,0.35)]"
              >
                Patient mode
              </Link>
              <Link
                href="/explore"
                className="px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:border-sky-500/70 hover:text-slate-50 transition-colors"
              >
                Sponsor / CRO mode (Explore)
              </Link>
            </div>
          </nav>
        </header>

        <main className="min-h-screen bg-slate-950">
          <VCAuthProvider>{children}</VCAuthProvider>
        </main>
      </body>
    </html>
  );
}
