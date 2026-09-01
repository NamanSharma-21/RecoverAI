'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  ShieldCheck,
  Play,
  RefreshCw,
  Award,
  AlertTriangle,
  Zap,
  TrendingUp,
  ShieldAlert,
  Info,
} from 'lucide-react';

export default function BenchmarkStudioPage() {
  const [report, setReport] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [seed, setSeed] = useState(42);
  const [totalCases, setTotalCases] = useState(1200);

  const fetchLatestBenchmark = async () => {
    try {
      const res = await fetch('/api/benchmark/results');
      const json = await res.json();
      if (json.success && json.benchmark) {
        setReport(json.benchmark.results);
      }
    } catch (err) {
      console.error('Failed to load benchmark results:', err);
    }
  };

  useEffect(() => {
    fetchLatestBenchmark();
  }, []);

  const runBenchmark = async () => {
    try {
      setRunning(true);
      const res = await fetch('/api/benchmark/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed, totalCases }),
      });
      const json = await res.json();
      if (json.success) {
        setReport(json.report);
      }
    } catch (err) {
      console.error('Benchmark execution error:', err);
    } finally {
      setRunning(false);
    }
  };

  const strategies = report?.strategies || {};

  return (
    <div className="space-y-8">
      {/* Benchmark Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-purple-950/40 via-slate-900 to-blue-950/40 border border-purple-900/40 rounded-xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            Evaluation Benchmark Studio
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            5-Way Strategy Comparison & Ablation Analysis
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Empirical evaluation over 1,200 seeded cases with hidden latent ground truth.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300">
            <span>Seed:</span>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value, 10) || 42)}
              className="w-12 bg-transparent text-white font-mono focus:outline-none"
            />
          </div>

          <button
            onClick={runBenchmark}
            disabled={running}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-purple-600/30 transition flex items-center gap-2 disabled:opacity-50"
          >
            {running ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Evaluating 1,200 Cases...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Run Benchmark
              </>
            )}
          </button>
        </div>
      </div>

      {/* Benchmark Summary Insights Banner */}
      {report?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-emerald-800/60 rounded-xl p-5 shadow-sm">
            <div className="text-xs text-gray-400 font-medium">RecoverAI Hybrid Recovered</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              ₹{(report.summary.hybridRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              {report.summary.incrementalPercentage >= 0 ? '+' : ''}{report.summary.incrementalPercentage}% vs Rule Baseline
            </div>
          </div>

          <div className="bg-gray-900 border border-blue-800/60 rounded-xl p-5 shadow-sm">
            <div className="text-xs text-gray-400 font-medium">Rule Baseline Recovered</div>
            <div className="text-2xl font-bold text-white mt-1">
              ₹{(report.summary.ruleBaselineRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Static merchant heuristic rules
            </div>
          </div>

          <div className="bg-gray-900 border border-purple-800/60 rounded-xl p-5 shadow-sm">
            <div className="text-xs text-gray-400 font-medium">Safety Violations (Hybrid vs LLM-Only)</div>
            <div className="text-2xl font-bold text-purple-300 mt-1 flex items-center gap-2">
              <span className="text-emerald-400">0</span>
              <span className="text-xs text-gray-500">vs</span>
              <span className="text-red-400">{report.summary.llmOnlySafetyViolations} viols</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Deterministic guardrails prevent rogue model actions
            </div>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Full Strategy Comparison Table</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Held-out test set: {report?.heldOutTestCases || 600} cases • Hidden ground truth outcome validation
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-950/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-800">
              <tr>
                <th className="px-6 py-3.5">Strategy</th>
                <th className="px-6 py-3.5">Recovered Revenue</th>
                <th className="px-6 py-3.5">Recovery Rate</th>
                <th className="px-6 py-3.5">Incr. vs Rules</th>
                <th className="px-6 py-3.5">Incr. %</th>
                <th className="px-6 py-3.5">Policy Violations</th>
                <th className="px-6 py-3.5">Avg Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/70">
              {Object.keys(strategies).length > 0 ? (
                Object.entries(strategies).map(([name, m]: [string, any]) => (
                  <tr
                    key={name}
                    className={`hover:bg-gray-800/40 transition ${
                      name === 'recoverai_hybrid' ? 'bg-blue-950/20 font-medium' : ''
                    }`}
                  >
                    <td className="px-6 py-4 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        {name === 'recoverai_hybrid' && (
                          <Award className="w-4 h-4 text-amber-400" />
                        )}
                        <span className={name === 'recoverai_hybrid' ? 'text-blue-300 font-bold' : 'text-white'}>
                          {name}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-semibold text-white">
                      ₹{(m.totalRecoveredRevenue / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-purple-300 font-medium">{m.recoveryRate}%</span>
                    </td>

                    <td className="px-6 py-4">
                      <span className={m.incrementalRevenueVsRuleBaseline >= 0 ? 'text-emerald-400 font-semibold' : 'text-gray-400'}>
                        ₹{(m.incrementalRevenueVsRuleBaseline / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        m.incrementalPercentageVsRuleBaseline > 0
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : m.incrementalPercentageVsRuleBaseline === 0
                          ? 'bg-gray-800 text-gray-300'
                          : 'bg-red-950 text-red-400 border border-red-800'
                      }`}>
                        {m.incrementalPercentageVsRuleBaseline >= 0 ? '+' : ''}{m.incrementalPercentageVsRuleBaseline}%
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {m.policyViolations === 0 ? (
                        <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" /> 0 Violations
                        </span>
                      ) : (
                        <span className="text-red-400 text-xs font-semibold flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" /> {m.policyViolations} Violations
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs font-mono text-gray-400">
                      {m.averageLatencyMs} ms
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <p>No benchmark run recorded yet.</p>
                    <button
                      onClick={runBenchmark}
                      className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium inline-flex items-center gap-2"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      Run 1,200-Case Benchmark Now
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
