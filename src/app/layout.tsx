import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { Activity, ShieldCheck, BarChart3, PlayCircle, RefreshCw } from 'lucide-react';

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
      <body className="bg-[#0B0F19] text-gray-100 min-h-screen flex flex-col">
        {/* Navigation Bar */}
        <header className="border-b border-gray-800 bg-[#0F172A]/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-bold text-lg text-white tracking-tight">Recover<span className="text-blue-500">AI</span></span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800 font-mono">MVP</span>
                </div>
              </Link>

              <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
                <Link
                  href="/"
                  className="px-3 py-2 rounded-md hover:bg-gray-800 text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Activity className="w-4 h-4 text-blue-400" />
                  Dashboard
                </Link>
                <Link
                  href="/benchmark"
                  className="px-3 py-2 rounded-md hover:bg-gray-800 text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  Benchmark Studio
                </Link>
                <Link
                  href="/demo"
                  className="px-3 py-2 rounded-md hover:bg-gray-800 text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <PlayCircle className="w-4 h-4 text-purple-400" />
                  Golden Demo
                </Link>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                Guardrails Active (Policy v1.0.0)
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800/60 bg-[#090D16] py-6 text-xs text-gray-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p>RecoverAI — Submission for Razorpay AI Revenue Recovery Buildathon.</p>
            <p className="font-mono text-gray-400">Core Loop: DIAGNOSE → SCORE → DECIDE → POLICY CHECK → EXECUTE → VERIFY</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
