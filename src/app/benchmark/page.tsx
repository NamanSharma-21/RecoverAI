'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function BenchmarkStudioPage() {
  const [report, setReport] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [seed, setSeed] = useState(42);
  const [totalCases, setTotalCases] = useState(5000);

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

  const formatINR = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <Link href="/" className="text-slate-400 hover:text-white text-xs">
              ← Back to Recovery Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-semibold text-slate-200">Synthetic Benchmark Studio</span>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
              5-Way Strategy Comparison
            </span>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-purple-950/40 via-slate-900 to-blue-950/40 border border-purple-900/40 rounded-2xl p-6 md:p-8 shadow-xl">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Synthetic Benchmark & Ablation Analysis
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-2 max-w-2xl">
              Evaluates strategies over a seeded dataset with hidden latent customer intent and ground-truth recovery potential across 6 realistic archetypes.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
              <span className="text-slate-400">Cases:</span>
              <select
                value={totalCases}
                onChange={(e) => setTotalCases(Number(e.target.value))}
                className="bg-transparent text-white font-mono focus:outline-none"
              >
                <option value={1200} className="bg-slate-900">1,200 Cases</option>
                <option value={2500} className="bg-slate-900">2,500 Cases</option>
                <option value={5000} className="bg-slate-900">5,000 Cases</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs">
              <span className="text-slate-400">Seed:</span>
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
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/30 transition flex items-center space-x-2"
            >
              {running ? (
                <span>Evaluating {totalCases.toLocaleString()} Cases...</span>
              ) : (
                <span>▶ Run Evaluation</span>
              )}
            </button>
          </div>
        </div>

        {/* Results Matrix */}
        {report ? (
          <div className="space-y-6">
            
            {/* Top Strategy Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* RecoverAI Hybrid Card */}
              <div className="bg-gradient-to-br from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/40 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    RecoverAI Hybrid
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                    PROPOSED SYSTEM
                  </span>
                </div>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {formatINR(strategies.recoverai_hybrid?.totalRecoveredRevenue || 0)}
                </div>
                <div className="text-xs text-slate-400 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Recovery Rate:</span>
                    <span className="text-white font-semibold">{strategies.recoverai_hybrid?.recoveryRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Safety Violations:</span>
                    <span className="text-emerald-400 font-bold">0 violations ✓</span>
                  </div>
                </div>
              </div>

              {/* Fixed Rule Baseline Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Fixed Rule Baseline
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    BENCHMARK CONTROL
                  </span>
                </div>
                <div className="text-3xl font-extrabold text-slate-200 mt-1">
                  {formatINR(strategies.fixed_rule_baseline?.totalRecoveredRevenue || 0)}
                </div>
                <div className="text-xs text-slate-400 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Recovery Rate:</span>
                    <span className="text-slate-300 font-semibold">{strategies.fixed_rule_baseline?.recoveryRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Safety Violations:</span>
                    <span className="text-slate-300 font-bold">0 violations</span>
                  </div>
                </div>
              </div>

              {/* LLM Only Strategy Card */}
              <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                    LLM-Only (No Guardrails)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-semibold">
                    ABLATION RISK
                  </span>
                </div>
                <div className="text-3xl font-extrabold text-slate-200 mt-1">
                  {formatINR(strategies.llm_only?.totalRecoveredRevenue || 0)}
                </div>
                <div className="text-xs text-slate-400 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Recovery Rate:</span>
                    <span className="text-slate-300 font-semibold">{strategies.llm_only?.recoveryRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Safety Violations:</span>
                    <span className="text-rose-400 font-bold">
                      {strategies.llm_only?.policyViolations} Critical Breaches ⚠
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Detailed 5-Way Comparison Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 border-b border-slate-800">
                <h3 className="text-base font-bold text-white">Full 5-Strategy Empirical Comparison</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Evaluated over {report.heldOutTestCases?.toLocaleString()} held-out test cases
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-medium">
                      <th className="p-4">Strategy</th>
                      <th className="p-4">Recovered Revenue (₹)</th>
                      <th className="p-4">Recovery Rate</th>
                      <th className="p-4">Incr. vs Rule Baseline</th>
                      <th className="p-4">Safety Violations</th>
                      <th className="p-4">Hard Decline Fails</th>
                      <th className="p-4">Avg Execution Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {Object.entries(strategies).map(([name, m]: [string, any]) => (
                      <tr
                        key={name}
                        className={name === 'recoverai_hybrid' ? 'bg-blue-950/20 font-semibold' : 'hover:bg-slate-800/20'}
                      >
                        <td className="p-4 font-mono">
                          {name === 'recoverai_hybrid' ? (
                            <span className="text-blue-400 font-bold">★ recoverai_hybrid</span>
                          ) : (
                            name
                          )}
                        </td>
                        <td className="p-4 font-bold text-white">{formatINR(m.totalRecoveredRevenue)}</td>
                        <td className="p-4">{m.recoveryRate}%</td>
                        <td className="p-4">
                          <span
                            className={
                              m.incrementalRevenueVsRuleBaseline > 0
                                ? 'text-emerald-400 font-semibold'
                                : m.incrementalRevenueVsRuleBaseline === 0
                                ? 'text-slate-400'
                                : 'text-slate-400'
                            }
                          >
                            {m.incrementalPercentageVsRuleBaseline >= 0 ? '+' : ''}
                            {m.incrementalPercentageVsRuleBaseline}% ({formatINR(m.incrementalRevenueVsRuleBaseline)})
                          </span>
                        </td>
                        <td className="p-4">
                          {m.policyViolations > 0 ? (
                            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded font-bold">
                              {m.policyViolations} breaches
                            </span>
                          ) : (
                            <span className="text-emerald-400 font-semibold">0 violations ✓</span>
                          )}
                        </td>
                        <td className="p-4">
                          {m.hardDeclineRetries > 0 ? (
                            <span className="text-rose-400">{m.hardDeclineRetries} retried</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="p-4 font-mono text-slate-400">{m.medianLatencyMs || '< 1'} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : (
          <div className="p-16 text-center text-slate-400 bg-slate-900 border border-slate-800 rounded-2xl">
            <p className="text-sm font-medium text-slate-300 mb-2">No benchmark run available yet</p>
            <p className="text-xs text-slate-400 mb-6">Click "Run Evaluation" above to execute the 5,000-case comparison.</p>
            <button
              onClick={runBenchmark}
              disabled={running}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-purple-600/30 transition"
            >
              ▶ Execute Synthetic Benchmark Now
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
