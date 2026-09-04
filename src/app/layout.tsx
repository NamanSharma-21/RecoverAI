import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Activity, ShieldCheck, BarChart3, PlayCircle, Sliders, ArrowUpRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'RecoverAI — Bounded Payment Failure Recovery Engine',
  description: 'AI-assisted, deterministic policy-controlled payment recovery decision engine for Razorpay.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
        {/* Navigation Bar */}
        <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform font-black text-xs text-white tracking-wider">
                  RA
                </div>
                <div>
                  <span className="font-bold text-base text-white tracking-tight">
                    Recover<span className="text-blue-500">AI</span>
                  </span>
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 font-mono">
                    PROD-CONTROL
                  </span>
                </div>
              </Link>

              <nav className="hidden md:flex items-center space-x-1 text-xs font-semibold">
                <Link
                  href="/"
                  className="px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                  Recovery Dashboard
                </Link>
                <Link
                  href="/demo"
                  className="px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-purple-400" />
                  Golden Demo Studio
                </Link>
                <Link
                  href="/benchmark"
                  className="px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                  5k Synthetic Benchmark
                </Link>
                <Link
                  href="/architecture"
                  className="px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  Control Architecture
                </Link>
                <Link
                  href="/settings"
                  className="px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Policy Guardrails
                </Link>
              </nav>
            </div>

            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                Deterministic Guardrails Active (v2.1.0)
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800/60 bg-slate-950 py-6 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p>RecoverAI — Bounded AI-assisted payment recovery orchestrator for Razorpay merchants.</p>
            <p className="font-mono text-slate-400">
              Control Loop: FAILURE → DIAGNOSIS → POLICY → CONTROLLED TOOL → AUTHORITATIVE CAPTURE → RECOVERED
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
