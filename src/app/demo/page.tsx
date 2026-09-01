'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  PlayCircle,
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Brain,
  RefreshCw,
  History,
  FileCheck,
  Zap,
} from 'lucide-react';
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

  return (
    <div className="space-y-8">
      {/* Golden Demo Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-slate-900 to-purple-950/40 border border-blue-900/40 rounded-xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <PlayCircle className="w-4 h-4 text-blue-400" />
            Golden Scenario Test & Demo Suite
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            10 Authoritative Golden Verification Scenarios
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Trigger individual end-to-end recovery scenarios to verify deterministic guardrails and closed-loop behavior.
          </p>
        </div>
      </div>

      {/* Active Execution Inspector (if scenario was run) */}
      {activeResult && activeResult.result && (
        <div className="bg-gray-900 border border-blue-800/80 rounded-xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <div>
              <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider">
                Live Control Loop Execution Result
              </div>
              <h2 className="text-xl font-bold text-white font-mono mt-0.5">
                {activeResult.scenario || activeResult.result.case.id}
              </h2>
            </div>

            <Link
              href={`/cases/${activeResult.result.case.id}`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              Inspect Case Detail <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* 4-Step Pipeline Visualizer */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-1">
              <span className="text-[11px] text-gray-500 uppercase font-semibold">1. Webhook Ingested</span>
              <div className="text-sm font-semibold text-white truncate">
                {activeResult.result.case.failure_code}
              </div>
              <div className="text-xs text-gray-400 font-mono">
                ₹{(activeResult.result.case.amount / 100).toFixed(2)} • {activeResult.result.case.payment_method}
              </div>
            </div>

            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-1">
              <span className="text-[11px] text-purple-400 uppercase font-semibold">2. AI Diagnosis</span>
              <div className="text-sm font-semibold text-purple-300 truncate">
                {activeResult.result.decision?.recommended_action || 'N/A'}
              </div>
              <div className="text-xs text-gray-400">
                Confidence: {Math.round((activeResult.result.decision?.confidence || 0) * 100)}%
              </div>
            </div>

            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-1">
              <span className="text-[11px] text-emerald-400 uppercase font-semibold">3. Policy Check</span>
              <div className="text-sm font-semibold text-emerald-300">
                {activeResult.result.policyCheck?.policy_result || 'N/A'}
              </div>
              <div className="text-xs text-gray-400 truncate">
                Allowed: {activeResult.result.policyCheck?.allowed ? 'Yes' : 'No'}
              </div>
            </div>

            <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-1">
              <span className="text-[11px] text-blue-400 uppercase font-semibold">4. Final State</span>
              <div className="text-sm font-semibold text-blue-300">
                {activeResult.result.transitionedTo}
              </div>
              <div className="text-xs text-gray-400">
                Attempt {activeResult.result.case.attempt_count}
              </div>
            </div>
          </div>

          <div className="bg-gray-950 p-3.5 rounded-lg border border-gray-800/80 text-xs text-gray-300">
            <span className="font-semibold text-gray-200">Execution Summary: </span>
            {activeResult.result.message}
          </div>
        </div>
      )}

      {/* Grid of 10 Golden Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {GOLDEN_SCENARIOS.map((s, idx) => (
          <div
            key={s.id}
            className="bg-gray-900/90 border border-gray-800 hover:border-gray-700 rounded-xl p-5 shadow-sm flex flex-col justify-between space-y-4 transition"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-400">Scenario #{idx + 1}</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  s.expectedPolicyResult === 'ALLOW'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : s.expectedPolicyResult === 'ESCALATE'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : 'bg-red-950 text-red-400 border border-red-800'
                }`}>
                  Expected: {s.expectedPolicyResult}
                </span>
              </div>

              <h3 className="text-base font-semibold text-white">{s.name}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{s.description}</p>

              <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-mono">
                <span className="bg-gray-950 text-amber-300 px-2 py-0.5 rounded border border-gray-800">
                  {s.caseData.failure_code}
                </span>
                <span className="bg-gray-950 text-gray-300 px-2 py-0.5 rounded border border-gray-800">
                  ₹{(s.caseData.amount / 100).toFixed(2)}
                </span>
                <span className="bg-gray-950 text-blue-400 px-2 py-0.5 rounded border border-gray-800">
                  Action: {s.expectedAction}
                </span>
              </div>
            </div>

            <button
              onClick={() => runScenario(s.id)}
              disabled={runningScenario === s.id}
              className="w-full mt-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-white rounded-lg text-xs font-semibold border border-gray-700 transition flex items-center justify-center gap-2"
            >
              {runningScenario === s.id ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Executing Closed Loop...
                </>
              ) : (
                <>
                  <PlayCircle className="w-3.5 h-3.5" />
                  Execute Scenario
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
