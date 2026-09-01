'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Play,
  ArrowRight,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<{ stats: any; cases: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const fetchCases = async () => {
    try {
      setRefreshing(true);
      const url = statusFilter === 'ALL' ? '/api/cases' : `/api/cases?status=${statusFilter}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [statusFilter]);

  const triggerQuickDemo = async () => {
    try {
      setRefreshing(true);
      await fetch('/api/simulator/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: 'golden_01_transient_retry' }),
      });
      await fetchCases();
    } catch (err) {
      console.error('Demo trigger error:', err);
    }
  };

  const stats = data?.stats || {
    totalCases: 0,
    recoveredCases: 0,
    failedCases: 0,
    stoppedCases: 0,
    escalatedCases: 0,
    humanReviewCases: 0,
    totalAtRiskAmount: 0,
    totalRecoveredAmount: 0,
    recoveryRate: 0,
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/30 border border-blue-900/40 rounded-xl p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            Bounded Decision Engine Control Loop
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Razorpay Payment Failure Recovery Operations
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Deterministic merchant policy controls execution while AI contextualizes failure diagnosis and recovery value.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchCases}
            disabled={refreshing}
            className="px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm font-medium transition flex items-center gap-1.5 border border-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={triggerQuickDemo}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-white" />
            Simulate Failure Event
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Recovered Revenue</span>
            <span className="p-1.5 bg-emerald-950/70 border border-emerald-800/80 rounded-lg text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-2">
            ₹{(stats.totalRecoveredAmount / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            <span className="text-emerald-400 font-semibold">{stats.recoveredCases}</span> cases recovered out of {stats.totalCases}
          </div>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Amount at Risk</span>
            <span className="p-1.5 bg-blue-950/70 border border-blue-800/80 rounded-lg text-blue-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            ₹{(stats.totalAtRiskAmount / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Total gross volume across failed transactions
          </div>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Recovery Rate</span>
            <span className="p-1.5 bg-purple-950/70 border border-purple-800/80 rounded-lg text-purple-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-300 mt-2">
            {stats.recoveryRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Verified closed-loop conversion
          </div>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium">
            <span>Pending Human Review</span>
            <span className="p-1.5 bg-amber-950/70 border border-amber-800/80 rounded-lg text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-2">
            {stats.humanReviewCases}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            High-value or low-confidence escalations
          </div>
        </div>
      </div>

      {/* Main Table & Filter Controls */}
      <div className="bg-gray-900/90 border border-gray-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-900/40">
          <div>
            <h2 className="text-lg font-semibold text-white">Payment Recovery Cases</h2>
            <p className="text-xs text-gray-400 mt-0.5">Live case state machine and AI decision audit trail</p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'HUMAN_REVIEW', 'OUTCOME_MONITORED', 'RECOVERED', 'STOPPED'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  statusFilter === filter
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {filter.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-950/80 text-xs uppercase text-gray-400 font-semibold border-b border-gray-800">
              <tr>
                <th className="px-6 py-3.5">Case & Payment</th>
                <th className="px-6 py-3.5">Amount</th>
                <th className="px-6 py-3.5">Failure Reason</th>
                <th className="px-6 py-3.5">Recoverability</th>
                <th className="px-6 py-3.5">AI Recommendation</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/70">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading recovery cases...
                  </td>
                </tr>
              ) : data?.cases && data.cases.length > 0 ? (
                data.cases.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-mono font-medium text-white text-xs">{c.id}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{c.payment_id} • {c.payment_method}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">
                        ₹{(c.amount / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-xs text-gray-500">{c.currency}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-xs font-mono text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded inline-block border border-amber-800/50">
                        {c.failure_code}
                      </div>
                      <div className="text-xs text-gray-400 truncate max-w-xs mt-1">
                        {c.failure_description}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-800 rounded-full h-1.5">
                          <div
                            className="bg-blue-500 h-1.5 rounded-full"
                            style={{ width: `${Math.round(c.recoverability_score * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-300">
                          {(c.recoverability_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Exp: ₹{(c.expected_recovery_value / 100).toFixed(0)}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-indigo-300">
                        {c.consent_status === 'OPTED_OUT' ? (
                          <span className="text-red-400 flex items-center gap-1 font-semibold">
                            <ShieldAlert className="w-3.5 h-3.5" /> OPTED OUT
                          </span>
                        ) : (
                          'Contextual Diagnosis'
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Attempt {c.attempt_count}/3
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          c.status === 'RECOVERED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : c.status === 'HUMAN_REVIEW'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                            : c.status === 'STOPPED'
                            ? 'bg-gray-800 text-gray-300 border border-gray-700'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/cases/${c.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-blue-300 text-xs font-medium rounded-lg border border-gray-700 transition"
                      >
                        Inspect
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <p className="text-base font-medium text-gray-300">No recovery cases found</p>
                    <p className="text-xs text-gray-500 mt-1">Simulate a failure event or run the golden scenario demo to populate cases.</p>
                    <button
                      onClick={triggerQuickDemo}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition inline-flex items-center gap-2"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      Trigger Demo Failure
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
