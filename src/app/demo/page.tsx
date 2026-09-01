'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { GOLDEN_SCENARIOS } from '@/simulator/scenarios';

export default function GoldenDemoPage() {
  const [activeResult, setActiveResult] = useState<any>(null);
  const [runningScenario, setRunningScenario] = useState<string | null>(null);

  const runScenario = async (scenarioId: string) => {
    try {
      setRunningScenario(scenarioId);
      const res = await fetch('/api/simulator/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: scenarioId }),
      });
      const json = await res.json();
      if (json.success) {
        setActiveResult(json);
      } else {
        alert(json.error || 'Failed to execute scenario');
      }
    } catch (err: any) {
      alert('Error executing scenario: ' + err.message);
    } finally {
      setRunningScenario(null);
    }
  };

  const flagshipScenarios = GOLDEN_SCENARIOS.filter(
    (s) => s.id === 'golden_01_transient_retry' || s.id === 'golden_05_high_value_escalation'
  );

  const otherScenarios = GOLDEN_SCENARIOS.filter(
    (s) => s.id !== 'golden_01_transient_retry' && s.id !== 'golden_05_high_value_escalation'
  );

  return (
    <div className="space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <Link href="/" className="text-slate-400 hover:text-white text-xs">
              ← Back to Recovery Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-semibold text-slate-200">Golden Demo Studio</span>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
              10 Verifiable Fixtures
            </span>
          </div>
        </div>

        {/* Page Header */}
        <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-purple-950/40 border border-blue-900/40 rounded-2xl p-6 md:p-8 shadow-xl">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Golden Demo & Verification Studio
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-2 max-w-3xl">
            Execute deterministic closed control loop scenarios. Evaluates real state transitions, AI structured diagnosis, tiered policy guardrails, controlled action execution, and authoritative capture verification.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* FLAGSHIP 5-MINUTE PRODUCT DEMOS */}
        {/* ========================================================================= */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
            <h2 className="text-base font-bold text-white">Flagship 5-Minute Product Stories</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Story 1: ₹5,000 Normal Autonomous Flow */}
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                    STORY A: AUTONOMOUS RECOVERY
                  </span>
                  <span className="text-xs font-bold text-emerald-400">₹4,999.00</span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">Transient Failure → Auto-Recovery → Captured</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Payment fails with temporary bank gateway timeout. AI diagnoses transient drop (92% confidence), Policy approves within ₹5,000 limit, controlled action executes, and authoritative success verifies ₹4,999 recovered revenue.
                </p>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1 mb-4">
                  <div>1. Failure: GATEWAY_ERROR (card)</div>
                  <div>2. AI Recommendation: RETRY (Cooldown: 15m)</div>
                  <div>3. Policy Result: ALLOW (Autonomous)</div>
                  <div>4. Outcome: Verified Captured ✓</div>
                </div>
              </div>

              <button
                onClick={() => runScenario('golden_01_transient_retry')}
                disabled={runningScenario === 'golden_01_transient_retry'}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition"
              >
                {runningScenario === 'golden_01_transient_retry' ? 'Executing Control Loop...' : '⚡ Run Autonomous Recovery Story'}
              </button>
            </div>

            {/* Story 2: ₹120,000 High-Value Guardrail Escalation */}
            <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px] font-semibold">
                    STORY B: SAFETY GUARDRAIL
                  </span>
                  <span className="text-xs font-bold text-purple-300">₹1,20,000.00</span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">High-Ticket Order → Policy Blocks → Human Review</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Even if AI recommends autonomous recovery, deterministic policy intercepts transactions &gt; ₹25,000 threshold. Strictly blocks unauthorized money movement and routes to merchant operator review queue.
                </p>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1 mb-4">
                  <div>1. Failure: GATEWAY_ERROR (netbanking)</div>
                  <div>2. AI Recommendation: ESCALATE / HIGH VALUE</div>
                  <div>3. Policy Result: ESCALATE (Amount &gt; Limit)</div>
                  <div>4. State: HUMAN_REVIEW (Safe) ✓</div>
                </div>
              </div>

              <button
                onClick={() => runScenario('golden_05_high_value_escalation')}
                disabled={runningScenario === 'golden_05_high_value_escalation'}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/20 transition"
              >
                {runningScenario === 'golden_05_high_value_escalation' ? 'Executing Control Loop...' : '⚡ Run Policy Block Story'}
              </button>
            </div>

          </div>
        </div>

        {/* Live Execution Visualizer */}
        {activeResult && activeResult.result && (
          <div className="bg-slate-900 border border-blue-500/40 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
                  Live Control Loop Tracer
                </span>
                <h3 className="text-base font-bold text-white font-mono mt-0.5">
                  {activeResult.scenario || activeResult.result.case.id}
                </h3>
              </div>
              <Link
                href={`/cases/${activeResult.result.case.id}`}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition"
              >
                Inspect Full Journey →
              </Link>
            </div>

            {/* 4-Step Pipeline Visualizer */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">1. Failure Ingestion</span>
                <div className="text-xs font-bold text-white truncate">
                  {activeResult.result.case.failure_code}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  ₹{(activeResult.result.case.amount / 100).toFixed(2)} • {activeResult.result.case.payment_method}
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-purple-400 uppercase font-semibold">2. AI Diagnosis</span>
                <div className="text-xs font-bold text-purple-300 truncate">
                  {activeResult.result.decision?.recommended_action || 'N/A'}
                </div>
                <div className="text-[11px] text-slate-400">
                  Confidence: {activeResult.result.decision ? `${(activeResult.result.decision.confidence * 100).toFixed(0)}%` : 'N/A'}
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-amber-400 uppercase font-semibold">3. Deterministic Policy</span>
                <div className="text-xs font-bold truncate">
                  {activeResult.result.policyCheck?.allowed ? (
                    <span className="text-emerald-400">✓ ALLOWED</span>
                  ) : activeResult.result.policyCheck?.policy_result === 'ESCALATE' ? (
                    <span className="text-purple-400">⚡ ESCALATED</span>
                  ) : (
                    <span className="text-rose-400">✗ BLOCKED</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {activeResult.result.policyCheck?.reasons?.[0] || 'Guardrails checked'}
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold">4. Control Outcome</span>
                <div className="text-xs font-bold text-emerald-400 truncate">
                  {activeResult.result.transitionedTo}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {activeResult.result.message}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Remaining 8 Golden Fixtures */}
        <div>
          <h2 className="text-base font-bold text-white mb-4">Complete 10-Scenario Golden Fixture Matrix</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {GOLDEN_SCENARIOS.map((s, idx) => (
              <div
                key={s.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Fixture #{idx + 1}</span>
                    <span className="font-mono">₹{(s.caseData.amount / 100).toFixed(0)}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 mb-1">{s.name}</h4>
                  <p className="text-[11px] text-slate-400 mb-3">{s.description}</p>
                </div>

                <button
                  onClick={() => runScenario(s.id)}
                  disabled={runningScenario === s.id}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-medium transition"
                >
                  {runningScenario === s.id ? 'Running...' : 'Run Scenario'}
                </button>
              </div>
            ))}
          </div>
        </div>

    </div>
  );
}
