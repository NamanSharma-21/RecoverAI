'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardStats {
  totalCases: number;
  recoveredCases: number;
  failedCases: number;
  stoppedCases: number;
  escalatedCases: number;
  humanReviewCases: number;
  activeRecoveriesCount: number;
  totalAtRiskAmount: number;
  totalRecoveredAmount: number;
  recoveryRate: number;
}

interface CaseItem {
  id: string;
  payment_id: string;
  order_id?: string;
  amount: number;
  currency: string;
  failure_code: string;
  failure_description: string;
  payment_method: string;
  status: string;
  recoverability_score: number;
  expected_recovery_value: number;
  consent_status: string;
  recovery_url?: string;
  created_at: string;
}

interface RazorpayStatus {
  connected: boolean;
  provider: string;
  keyIdPrefix?: string;
  message: string;
  hasLiveCredentials: boolean;
  webhookUrl: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [rzpStatus, setRzpStatus] = useState<RazorpayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingTest, setCreatingTest] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    fetchDashboardData();
    fetchRzpStatus();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/cases');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setCases(data.cases);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRzpStatus = async () => {
    try {
      const res = await fetch('/api/razorpay/status');
      const data = await res.json();
      if (data.success) {
        setRzpStatus(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch razorpay status:', err);
    }
  };

  const handleCreateTestRecovery = async (amount: number = 1200000, failureCode: string = 'GATEWAY_TIMEOUT') => {
    setCreatingTest(true);
    try {
      const res = await fetch('/api/razorpay/create-test-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          failureCode,
          paymentMethod: 'card',
          failureDescription: 'Bank 3DS gateway timeout during transaction processing',
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to trigger test recovery:', err);
    } finally {
      setCreatingTest(false);
    }
  };

  const filteredCases = cases.filter((c) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'ACTIVE') {
      return ['ACTION_EXECUTED', 'OUTCOME_MONITORED', 'ACTION_PENDING', 'ANALYZING', 'DECISION_READY', 'POLICY_CHECK'].includes(c.status);
    }
    if (filterStatus === 'RECOVERED') return c.status === 'RECOVERED';
    if (filterStatus === 'HUMAN_REVIEW') return c.status === 'HUMAN_REVIEW';
    if (filterStatus === 'STOPPED') return c.status === 'STOPPED';
    return true;
  });

  const formatINR = (paise: number) => {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
  };

  const getRecoverabilityBadge = (score: number) => {
    if (score >= 0.7) {
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">HIGH ({(score * 100).toFixed(0)}%)</span>;
    }
    if (score >= 0.4) {
      return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">MED ({(score * 100).toFixed(0)}%)</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">LOW ({(score * 100).toFixed(0)}%)</span>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECOVERED':
        return <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">✓ RECOVERED</span>;
      case 'OUTCOME_MONITORED':
        return <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">MONITORING</span>;
      case 'HUMAN_REVIEW':
        return <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30">HUMAN REVIEW</span>;
      case 'STOPPED':
        return <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">STOPPED</span>;
      case 'ESCALATED':
        return <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">ESCALATED</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-700 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-black text-sm tracking-wider text-white shadow-lg shadow-blue-500/20">
                RA
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">RecoverAI</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">
                Decision Engine
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Autonomous payment failure recovery orchestrator for Razorpay merchants
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/demo"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition"
            >
              Golden Demo Studio
            </Link>
            <Link
              href="/benchmark"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 transition"
            >
              Benchmark Suite
            </Link>
            <button
              onClick={() => handleCreateTestRecovery(1200000, 'GATEWAY_TIMEOUT')}
              disabled={creatingTest}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-600/25 transition flex items-center space-x-1.5"
            >
              {creatingTest ? (
                <span>Ingesting Failure...</span>
              ) : (
                <>
                  <span>⚡ Create Test Recovery (₹12,000)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Integration Status Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300 font-medium">
              Mode: <span className="text-white font-semibold">{rzpStatus?.hasLiveCredentials ? 'Razorpay Test Mode (Live Keys Active)' : 'High-Fidelity Simulator Mode'}</span>
            </span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-400">
              Webhook: <code className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300">{rzpStatus?.webhookUrl || '/api/webhooks/razorpay'}</code>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleCreateTestRecovery(450000, 'AUTH_DROPOUT')}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
            >
              + ₹4,500 Auth Dropout
            </button>
            <button
              onClick={() => handleCreateTestRecovery(7500000, 'GATEWAY_ERROR')}
              className="px-2.5 py-1 bg-purple-900/40 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 rounded text-xs transition"
            >
              + ₹75,000 High-Value (Escalate)
            </button>
          </div>
        </div>

        {/* Primary Economic Outcome KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-lg">
            <div className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">Revenue Recovered</div>
            <div className="text-2xl md:text-3xl font-bold text-white mt-2">
              {formatINR(stats?.totalRecoveredAmount || 0)}
            </div>
            <div className="text-xs text-emerald-400/80 mt-1 flex items-center space-x-1">
              <span>✓ Verified Razorpay captures</span>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Revenue at Risk</div>
            <div className="text-2xl md:text-3xl font-bold text-slate-200 mt-2">
              {formatINR(stats?.totalAtRiskAmount || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Total volume across all failed payments
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Recovery Rate</div>
            <div className="text-2xl md:text-3xl font-bold text-blue-400 mt-2">
              {(stats?.recoveryRate || 0).toFixed(1)}%
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {stats?.recoveredCases || 0} of {stats?.totalCases || 0} cases recovered
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Active Recoveries</div>
            <div className="text-2xl md:text-3xl font-bold text-amber-400 mt-2">
              {stats?.activeRecoveriesCount || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Monitoring recovery links / retries
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
            <div className="text-xs font-semibold text-purple-400 tracking-wider uppercase">Human Reviews</div>
            <div className="text-2xl md:text-3xl font-bold text-purple-300 mt-2">
              {stats?.humanReviewCases || 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Escalated tickets &gt; ₹25,000 threshold
            </div>
          </div>
        </div>

        {/* Recovery Opportunities Table Header & Filter */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Recovery Opportunities</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Ranked by Economic Priority: Amount at Risk → Recoverability → Urgency
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {['ALL', 'ACTIVE', 'RECOVERED', 'HUMAN_REVIEW', 'STOPPED'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className={`px-3 py-1.5 rounded-md font-medium transition ${
                    filterStatus === f
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm animate-pulse">
              Loading recovery telemetry...
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="text-sm font-medium text-slate-300 mb-1">No recovery cases found</div>
              <p className="text-xs text-slate-400 mb-4">Click "Create Test Recovery" above to ingest a failure event.</p>
              <button
                onClick={() => handleCreateTestRecovery(1200000, 'GATEWAY_TIMEOUT')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
              >
                ⚡ Trigger Test Recovery Flow
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-medium">
                    <th className="p-4">Amount at Risk</th>
                    <th className="p-4">Failure Context</th>
                    <th className="p-4">Recoverability</th>
                    <th className="p-4">Recovery Action Narrative</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredCases.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-4">
                        <div className="font-bold text-sm text-white">{formatINR(c.amount)}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{c.order_id || c.payment_id}</div>
                      </td>

                      <td className="p-4">
                        <div className="font-medium text-slate-200">{c.failure_code}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{c.failure_description}</div>
                        <div className="text-[10px] text-slate-400 uppercase mt-0.5 font-mono">{c.payment_method}</div>
                      </td>

                      <td className="p-4">
                        {getRecoverabilityBadge(c.recoverability_score)}
                        <div className="text-[10px] text-slate-400 mt-1">
                          Exp: {formatINR(c.expected_recovery_value)}
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="text-[11px] font-mono text-slate-300 max-w-md">
                          {c.status === 'RECOVERED' ? (
                            <span className="text-emerald-400 font-semibold">✓ {formatINR(c.amount)} captured & verified on Razorpay</span>
                          ) : c.status === 'HUMAN_REVIEW' ? (
                            <span className="text-purple-300">Escalated to human operator review (Amount &gt; ₹25,000 threshold)</span>
                          ) : c.status === 'STOPPED' ? (
                            <span className="text-slate-400">Recovery halted (Opt-out or max interventions reached)</span>
                          ) : (
                            <span>Recovery Link active → Waiting for customer checkout</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        {getStatusBadge(c.status)}
                      </td>

                      <td className="p-4 text-right space-x-2 whitespace-nowrap">
                        {c.status !== 'RECOVERED' && (
                          <Link
                            href={`/recover/${c.id}`}
                            target="_blank"
                            className="inline-block px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium transition"
                          >
                            Pay Link ↗
                          </Link>
                        )}
                        <Link
                          href={`/cases/${c.id}`}
                          className="inline-block px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition"
                        >
                          View Journey →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
