import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

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
    <html lang="en">
      <body className="bg-[#fdfcfc] text-[#000000] min-h-screen flex flex-col font-sans antialiased selection:bg-[#000000] selection:text-[#fdfcfc]">
        {/* Minimal Dashboard Header */}
        <header className="border-b border-[#ebe8e4] bg-[#fdfcfc]/90 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/" className="flex items-center space-x-2.5 group">
                <span className="font-medium text-sm tracking-tight text-[#000000]">
                  RecoverAI
                </span>
                <span className="text-xs text-[#777169] pl-2.5 border-l border-[#ebe8e4] font-normal">
                  Revenue Recovery
                </span>
              </Link>

              <nav className="hidden md:flex items-center space-x-1 text-xs text-[#777169]">
                <Link
                  href="/"
                  className="px-2.5 py-1 rounded-full hover:text-[#000000] hover:bg-[#f5f3f1] transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/benchmark"
                  className="px-2.5 py-1 rounded-full hover:text-[#000000] hover:bg-[#f5f3f1] transition-colors"
                >
                  Benchmark
                </Link>
                <Link
                  href="/demo"
                  className="px-2.5 py-1 rounded-full hover:text-[#000000] hover:bg-[#f5f3f1] transition-colors"
                >
                  Studio
                </Link>
                <Link
                  href="/architecture"
                  className="px-2.5 py-1 rounded-full hover:text-[#000000] hover:bg-[#f5f3f1] transition-colors"
                >
                  Architecture
                </Link>
                <Link
                  href="/settings"
                  className="px-2.5 py-1 rounded-full hover:text-[#000000] hover:bg-[#f5f3f1] transition-colors"
                >
                  Guardrails
                </Link>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center gap-1.5 text-xs text-[#44403b]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]"></span>
                <span className="font-normal">Simulator connected</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Minimal Footer */}
        <footer className="border-t border-[#ebe8e4] bg-[#fdfcfc] py-6 text-xs text-[#777169]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p>RecoverAI — Bounded AI-assisted payment recovery for Razorpay merchants.</p>
            <p className="font-mono text-[11px] text-[#a59f97]">
              PAYMENT FAILED → AI DIAGNOSED → POLICY CHECKED → EXECUTED → VERIFIED
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
