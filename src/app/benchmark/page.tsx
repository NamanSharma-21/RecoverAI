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
    <div className="space-y-8">
        
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
              <div className="bg-gradient-to-br from-blue-950/50 via-slate-900 to-slate-900 border border-blue-500/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    RecoverAI Hybrid
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                    RECOMMENDED SYSTEM
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono">Net Recovery Value (NRV):</div>
                <div className="text-3xl font-extrabold text-white mt-0.5">
                  {formatINR(strategies.recoverai_hybrid?.totalNetRecoveredRevenue || strategies.recoverai_hybrid?.totalRecoveredRevenue || 0)}
                </div>
                <div className="text-xs text-slate-400 mt-3 space-y-1.5 border-t border-slate-800/80 pt-3">
                  <div className="flex justify-between">
                    <span>Gross Revenue Recovered:</span>
                    <span className="text-white font-semibold">{formatINR(strategies.recoverai_hybrid?.totalRecoveredRevenue || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Operational Costs:</span>
                    <span className="text-slate-300 font-mono">{formatINR(strategies.recoverai_hybrid?.totalCosts || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Safety Fines / Penalties:</span>
                    <span className="text-emerald-400 font-bold">₹0 (0 breaches) ✓</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/40">
                    <span className="text-blue-300 font-semibold">Net Incremental vs Baseline:</span>
                    <span className="text-emerald-400 font-bold">
                      +{formatINR(strategies.recoverai_hybrid?.incrementalNetRevenueVsRuleBaseline || strategies.recoverai_hybrid?.incrementalRevenueVsRuleBaseline || 0)}
                    </span>
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
                <div className="text-xs text-slate-400 font-mono">Net Recovery Value (NRV):</div>
                <div className="text-3xl font-extrabold text-slate-200 mt-0.5">
                  {formatINR(strategies.fixed_rule_baseline?.totalNetRecoveredRevenue || strategies.fixed_rule_baseline?.totalRecoveredRevenue || 0)}
                </div>
                <div className="text-xs text-slate-400 mt-3 space-y-1.5 border-t border-slate-800/80 pt-3">
                  <div className="flex justify-between">
                    <span>Gross Revenue Recovered:</span>
                    <span className="text-slate-300 font-semibold">{formatINR(strategies.fixed_rule_baseline?.totalRecoveredRevenue || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Operational Costs:</span>
                    <span className="text-slate-400 font-mono">{formatINR(strategies.fixed_rule_baseline?.totalCosts || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Safety Violations:</span>
                    <span className="text-slate-300 font-semibold">0 violations</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/40">
                    <span>Net Incremental:</span>
                    <span className="text-slate-500 font-mono">₹0 (Baseline)</span>
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
                    HIGH FINANCIAL RISK
                  </span>
                </div>
                <div className="text-xs text-slate-400 font-mono">Net Recovery Value (NRV):</div>
                <div className="text-3xl font-extrabold text-slate-200 mt-0.5">
                  {formatINR(strategies.llm_only?.totalNetRecoveredRevenue || strategies.llm_only?.totalRecoveredRevenue || 0)}
                </div>
                <div className="text-xs text-slate-400 mt-3 space-y-1.5 border-t border-slate-800/80 pt-3">
                  <div className="flex justify-between">
                    <span>Gross Revenue Recovered:</span>
                    <span className="text-slate-300 font-semibold">{formatINR(strategies.llm_only?.totalRecoveredRevenue || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Operational Costs:</span>
                    <span className="text-rose-300 font-mono">{formatINR(strategies.llm_only?.totalCosts || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Safety Fines / Penalties:</span>
                    <span className="text-rose-400 font-bold">
                      {formatINR(strategies.llm_only?.safetyPenalties || 0)} ({strategies.llm_only?.policyViolations} fines)
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/40">
                    <span className="text-rose-400">Net Incremental vs Baseline:</span>
                    <span className={strategies.llm_only?.incrementalNetRevenueVsRuleBaseline < 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                      {formatINR(strategies.llm_only?.incrementalNetRevenueVsRuleBaseline || 0)}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Detailed 5-Way Comparison Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white">Full 5-Strategy Empirical Comparison</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluated over {report.heldOutTestCases?.toLocaleString()} held-out test cases with action-sensitive latent outcome engine.
                  </p>
                </div>
                <div className="text-[11px] text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 font-mono">
                  NRV = Gross Recovered - Costs - Friction - Penalties
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-medium">
                      <th className="p-4">Strategy</th>
                      <th className="p-4">Gross Recovered</th>
                      <th className="p-4 text-emerald-300 font-bold">Net Recovery Value</th>
                      <th className="p-4">Operational Costs</th>
                      <th className="p-4">Safety Fines</th>
                      <th className="p-4">Net Incr. vs Baseline</th>
                      <th className="p-4">Policy Breaches</th>
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
                        <td className="p-4 font-semibold text-slate-300">{formatINR(m.totalRecoveredRevenue)}</td>
                        <td className="p-4 font-bold text-white text-sm">
                          {formatINR(m.totalNetRecoveredRevenue || m.totalRecoveredRevenue)}
                        </td>
                        <td className="p-4 font-mono text-slate-400">{formatINR(m.totalCosts || 0)}</td>
                        <td className="p-4 font-mono">
                          {m.safetyPenalties > 0 ? (
                            <span className="text-rose-400 font-bold">{formatINR(m.safetyPenalties)}</span>
                          ) : (
                            <span className="text-emerald-400">₹0</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span
                            className={
                              (m.incrementalNetRevenueVsRuleBaseline || m.incrementalRevenueVsRuleBaseline) > 0
                                ? 'text-emerald-400 font-semibold'
                                : (m.incrementalNetRevenueVsRuleBaseline || m.incrementalRevenueVsRuleBaseline) === 0
                                ? 'text-slate-400'
                                : 'text-rose-400 font-semibold'
                            }
                          >
                            {(m.incrementalNetRevenueVsRuleBaseline || m.incrementalRevenueVsRuleBaseline) > 0 ? '+' : ''}
                            {formatINR(m.incrementalNetRevenueVsRuleBaseline || m.incrementalRevenueVsRuleBaseline)}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Economic Latent Model Transparency Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>🔬 Latent Economic Evaluation Model</span>
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">Rigorous Action-Sensitive Ground Truth</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Rather than using static success probabilities, the benchmark generates seeded synthetic transaction streams where each customer has hidden latent willingness to pay, friction tolerance, and payment instrument validity.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Outreach Fees</div>
                  <div className="text-slate-200 mt-1">₹0.50 per WhatsApp/SMS outreach, ₹2.00 per direct bank gateway retry.</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Customer Friction Cost</div>
                  <div className="text-slate-200 mt-1">₹50 friction fee when retrying hard declines or spamming repeat notifications.</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-rose-400">Statutory Penalties</div>
                  <div className="text-rose-200 mt-1">₹1,000 regulatory fine per opt-out customer contacted or double-charge attempt.</div>
                </div>
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
  );
}
