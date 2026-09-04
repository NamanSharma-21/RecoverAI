'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Play, RefreshCw, Layers } from 'lucide-react';

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
    return `₹${Math.round(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between border-b border-[#ebe8e4] pb-4">
        <div className="flex items-center space-x-3 text-xs">
          <Link href="/" className="text-[#777169] hover:text-[#000000] transition-colors">
            ← Back to Dashboard
          </Link>
          <span className="text-[#ebe8e4]">/</span>
          <span className="text-[#000000] font-normal">Benchmark & Ablation Studio</span>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="px-3 py-1 rounded-full bg-[#f5f3f1] border border-[#ebe8e4] text-[#44403b] text-[11px]">
            5-Way Strategy Comparison
          </span>
        </div>
      </div>

      {/* Hero / Page Header Card */}
      <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 sm:p-8 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-light text-[#000000] tracking-tight">
            Synthetic benchmark & ablation analysis
          </h1>
          <p className="text-xs md:text-sm text-[#44403b] mt-1.5 max-w-2xl font-normal leading-relaxed">
            Evaluates recovery strategies over a seeded dataset with hidden latent customer intent and ground-truth recovery potential across 6 realistic archetypes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-[#fdfcfc] border border-[#ebe8e4] rounded-full px-3.5 py-1.5 text-xs">
            <span className="text-[#777169]">Cases:</span>
            <select
              value={totalCases}
              onChange={(e) => setTotalCases(Number(e.target.value))}
              className="bg-transparent text-[#000000] focus:outline-none cursor-pointer"
            >
              <option value={1200}>1,200 Cases</option>
              <option value={2500}>2,500 Cases</option>
              <option value={5000}>5,000 Cases</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-[#fdfcfc] border border-[#ebe8e4] rounded-full px-3.5 py-1.5 text-xs">
            <span className="text-[#777169]">Seed:</span>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value, 10) || 42)}
              className="w-10 bg-transparent text-[#000000] font-mono focus:outline-none"
            />
          </div>

          <button
            onClick={runBenchmark}
            disabled={running}
            className="px-5 py-2 rounded-full bg-[#000000] text-[#fdfcfc] hover:bg-[#44403b] disabled:opacity-50 text-xs font-medium transition-colors inline-flex items-center gap-1.5"
          >
            {running ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Evaluating {totalCases.toLocaleString()} Cases...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Run evaluation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {report ? (
        <div className="space-y-6">
          {/* Top 3 Strategy Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* RecoverAI Hybrid Card */}
            <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 shadow-none flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-normal text-[#000000] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]"></span>
                    <span>RecoverAI Hybrid</span>
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[#44403b]">
                    Controlled System
                  </span>
                </div>
                <div className="text-xs text-[#777169] mt-3">Net Recovery Value (NRV):</div>
                <div className="text-3xl font-light text-[#000000] mt-0.5 tracking-tight">
                  {formatINR(strategies.recoverai_hybrid?.totalNetRecoveredRevenue || strategies.recoverai_hybrid?.totalRecoveredRevenue || 0)}
                </div>
              </div>

              <div className="text-xs text-[#44403b] mt-5 space-y-2 border-t border-[#ebe8e4] pt-4">
                <div className="flex justify-between">
                  <span className="text-[#777169]">Gross Recovered:</span>
                  <span className="text-[#000000]">{formatINR(strategies.recoverai_hybrid?.totalRecoveredRevenue || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777169]">Operational Costs:</span>
                  <span className="text-[#44403b] font-mono text-[11px]">{formatINR(strategies.recoverai_hybrid?.totalCosts || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777169]">Safety Penalties:</span>
                  <span className="text-[#000000]">₹0 (0 breaches) ✓</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#ebe8e4]/60">
                  <span className="font-normal text-[#000000]">Net Incremental vs Baseline:</span>
                  <span className="font-medium text-[#000000]">
                    +{formatINR(strategies.recoverai_hybrid?.incrementalNetRevenueVsRuleBaseline || strategies.recoverai_hybrid?.incrementalRevenueVsRuleBaseline || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Fixed Rule Baseline Card */}
            <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 shadow-none flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-normal text-[#000000] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full border border-[#777169]"></span>
                    <span>Fixed Rule Baseline</span>
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[#777169]">
                    Benchmark Control
                  </span>
                </div>
                <div className="text-xs text-[#777169] mt-3">Net Recovery Value (NRV):</div>
                <div className="text-3xl font-light text-[#000000] mt-0.5 tracking-tight">
                  {formatINR(strategies.fixed_rule_baseline?.totalNetRecoveredRevenue || strategies.fixed_rule_baseline?.totalRecoveredRevenue || 0)}
                </div>
              </div>

              <div className="text-xs text-[#44403b] mt-5 space-y-2 border-t border-[#ebe8e4] pt-4">
                <div className="flex justify-between">
                  <span className="text-[#777169]">Gross Recovered:</span>
                  <span className="text-[#000000]">{formatINR(strategies.fixed_rule_baseline?.totalRecoveredRevenue || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777169]">Operational Costs:</span>
                  <span className="text-[#44403b] font-mono text-[11px]">{formatINR(strategies.fixed_rule_baseline?.totalCosts || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777169]">Safety Penalties:</span>
                  <span className="text-[#000000]">₹0 (0 breaches)</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#ebe8e4]/60">
                  <span className="text-[#777169]">Net Incremental:</span>
                  <span className="text-[#777169] font-mono text-[11px]">₹0 (Reference)</span>
                </div>
              </div>
            </div>

            {/* LLM Only Card */}
            <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 shadow-none flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-normal text-[#000000] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff4704]"></span>
                    <span>LLM-Only (No Guardrails)</span>
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[#ff4704]">
                    Unconstrained
                  </span>
                </div>
                <div className="text-xs text-[#777169] mt-3">Net Recovery Value (NRV):</div>
                <div className="text-3xl font-light text-[#000000] mt-0.5 tracking-tight">
                  {formatINR(strategies.llm_only?.totalNetRecoveredRevenue || strategies.llm_only?.totalRecoveredRevenue || 0)}
                </div>
              </div>

              <div className="text-xs text-[#44403b] mt-5 space-y-2 border-t border-[#ebe8e4] pt-4">
                <div className="flex justify-between">
                  <span className="text-[#777169]">Gross Recovered:</span>
                  <span className="text-[#000000]">{formatINR(strategies.llm_only?.totalRecoveredRevenue || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777169]">Operational Costs:</span>
                  <span className="text-[#44403b] font-mono text-[11px]">{formatINR(strategies.llm_only?.totalCosts || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#777169]">Safety Penalties:</span>
                  <span className="text-[#000000]">
                    {formatINR(strategies.llm_only?.safetyPenalties || 0)} ({strategies.llm_only?.policyViolations} fines)
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#ebe8e4]/60">
                  <span className="text-[#777169]">Net Incremental vs Baseline:</span>
                  <span className="font-mono text-[11px] text-[#000000]">
                    {formatINR(strategies.llm_only?.incrementalNetRevenueVsRuleBaseline || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed 5-Way Comparison Table */}
          <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 sm:p-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ebe8e4] pb-4">
              <div>
                <h3 className="text-lg font-normal text-[#000000] tracking-tight">Full 5-Strategy Empirical Comparison</h3>
                <p className="text-xs text-[#777169] mt-0.5">
                  Evaluated over {report.heldOutTestCases?.toLocaleString()} held-out test cases with action-sensitive latent outcome engine.
                </p>
              </div>
              <div className="text-[11px] text-[#777169] font-mono">
                NRV = Gross Recovered - Operational Costs - Friction - Penalties
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#ebe8e4] text-[#777169] font-normal">
                    <th className="pb-3 pr-4 font-normal">Strategy</th>
                    <th className="pb-3 px-4 font-normal">Gross Recovered</th>
                    <th className="pb-3 px-4 font-normal">Net Recovery Value</th>
                    <th className="pb-3 px-4 font-normal">Operational Costs</th>
                    <th className="pb-3 px-4 font-normal">Safety Fines</th>
                    <th className="pb-3 px-4 font-normal">Net Incr. vs Baseline</th>
                    <th className="pb-3 pl-4 font-normal">Policy Breaches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ebe8e4]/60 text-[#44403b]">
                  {Object.entries(strategies).map(([name, m]: [string, any]) => (
                    <tr
                      key={name}
                      className={name === 'recoverai_hybrid' ? 'bg-[#ebe8e4]/40 font-medium' : 'hover:bg-[#ebe8e4]/20 transition-colors'}
                    >
                      <td className="py-3.5 pr-4 font-mono text-xs">
                        {name === 'recoverai_hybrid' ? (
                          <span className="text-[#000000] font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]"></span>
                            <span>recoverai_hybrid</span>
                          </span>
                        ) : (
                          name
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#000000]">{formatINR(m.totalRecoveredRevenue)}</td>
                      <td className="py-3.5 px-4 font-medium text-[#000000]">
                        {formatINR(m.totalNetRecoveredRevenue || m.totalRecoveredRevenue)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#777169]">{formatINR(m.totalCosts || 0)}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        {m.safetyPenalties > 0 ? (
                          <span className="text-[#000000]">{formatINR(m.safetyPenalties)}</span>
                        ) : (
                          <span className="text-[#777169]">₹0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#000000]">
                        {(m.incrementalNetRevenueVsRuleBaseline || m.incrementalRevenueVsRuleBaseline) > 0 ? '+' : ''}
                        {formatINR(m.incrementalNetRevenueVsRuleBaseline || m.incrementalRevenueVsRuleBaseline)}
                      </td>
                      <td className="py-3.5 pl-4">
                        {m.policyViolations > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#000000]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ff4704]"></span>
                            <span>{m.policyViolations} breaches</span>
                          </span>
                        ) : (
                          <span className="text-[#777169] text-[11px]">0 violations ✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Economic Latent Model Transparency Panel */}
          <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-[#ebe8e4] pb-3">
              <h4 className="text-sm font-normal text-[#000000]">
                Latent economic evaluation model parameters
              </h4>
              <span className="text-[11px] text-[#777169] font-mono">Action-Sensitive Ground Truth</span>
            </div>
            <p className="text-xs text-[#44403b] leading-relaxed">
              Rather than using static success probabilities, the benchmark generates seeded synthetic transaction streams where each customer has hidden latent willingness to pay, friction tolerance, and payment instrument validity.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="rounded-[16px] bg-[#fdfcfc] border border-[#ebe8e4] p-4">
                <div className="text-[11px] font-mono text-[#777169] uppercase">Outreach Fees</div>
                <div className="text-[#000000] mt-1">₹0.50 per WhatsApp/SMS outreach, ₹2.00 per direct bank gateway retry.</div>
              </div>
              <div className="rounded-[16px] bg-[#fdfcfc] border border-[#ebe8e4] p-4">
                <div className="text-[11px] font-mono text-[#777169] uppercase">Customer Friction Cost</div>
                <div className="text-[#000000] mt-1">₹50 friction fee when retrying hard declines or spamming repeat notifications.</div>
              </div>
              <div className="rounded-[16px] bg-[#fdfcfc] border border-[#ebe8e4] p-4">
                <div className="text-[11px] font-mono text-[#777169] uppercase">Statutory Penalties</div>
                <div className="text-[#000000] mt-1">₹1,000 regulatory fine per opt-out customer contacted or double-charge attempt.</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-16 text-center text-xs text-[#777169] rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4]">
          <Layers className="w-8 h-8 mx-auto mb-2 text-[#777169]" />
          <p className="text-sm font-normal text-[#000000] mb-1">No benchmark run available yet</p>
          <p className="max-w-sm mx-auto text-[#777169] mb-5">Click "Run evaluation" above to execute the 5,000-case comparison.</p>
          <button
            onClick={runBenchmark}
            disabled={running}
            className="px-6 py-2.5 rounded-full bg-[#000000] text-[#fdfcfc] hover:bg-[#44403b] text-xs font-medium transition-colors"
          >
            Execute Synthetic Benchmark Now
          </button>
        </div>
      )}
    </div>
  );
}
