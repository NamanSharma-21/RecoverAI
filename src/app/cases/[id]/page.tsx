'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  Brain,
  Wrench,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserCheck,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [overrideAction, setOverrideAction] = useState('RETRY');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchCaseDetail = async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch case detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      fetchCaseDetail();
    }
  }, [caseId]);

  const handleReviewAction = async (action: 'APPROVE' | 'OVERRIDE' | 'STOP' | 'ESCALATE') => {
    try {
      setSubmittingReview(true);
      const res = await fetch(`/api/cases/${caseId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          override_action: action === 'OVERRIDE' ? overrideAction : undefined,
          operator_notes: reviewNotes || `Operator performed action: ${action}`,
          operator_id: 'merchant_ops_lead',
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchCaseDetail();
        setReviewNotes('');
      } else {
        alert(json.error || 'Failed to submit review');
      }
    } catch (err: any) {
      alert('Error submitting review: ' + err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading case details and audit history...
      </div>
    );
  }

  if (!data || !data.case) {
    return (
      <div className="py-24 text-center">
        <p className="text-lg text-gray-300">Case not found</p>
        <Link href="/" className="mt-4 inline-flex items-center gap-2 text-blue-400 hover:underline text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const c = data.case;
  const decision = data.decisions?.[data.decisions.length - 1];
  const policyCheck = data.policyChecks?.[data.policyChecks.length - 1];
  const toolExecutions = data.toolExecutions || [];
  const auditEvents = data.auditEvents || [];

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white mb-2 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Cases
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white font-mono">{c.id}</h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${
                c.status === 'RECOVERED'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : c.status === 'HUMAN_REVIEW'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                  : c.status === 'STOPPED'
                  ? 'bg-gray-800 text-gray-300 border border-gray-700'
                  : 'bg-blue-950 text-blue-400 border border-blue-800'
              }`}
            >
              {c.status}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            ₹{(c.amount / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-400 font-mono">Payment ID: {c.payment_id}</div>
        </div>
      </div>

      {/* Operator Human Review Action Banner (if case is in HUMAN_REVIEW) */}
      {c.status === 'HUMAN_REVIEW' && (
        <div className="bg-gradient-to-r from-amber-950/70 via-gray-900 to-amber-950/40 border border-amber-700/80 rounded-xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-amber-400 text-sm font-semibold">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Human Operator Intervention Required
          </div>
          <p className="text-sm text-gray-300">
            This case was escalated due to monetary threshold policies or low confidence. Inspect the AI diagnosis and policy findings below before taking action.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Operator Decision Notes</label>
              <input
                type="text"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Reasoning for approval, override, or stop..."
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Override Action (If Overriding)</label>
              <select
                value={overrideAction}
                onChange={(e) => setOverrideAction(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="RETRY">RETRY (Gateway Retry)</option>
                <option value="CREATE_OR_REUSE_PAYMENT_LINK">CREATE_OR_REUSE_PAYMENT_LINK</option>
                <option value="OFFER_ALTERNATE_PAYMENT_METHOD">OFFER_ALTERNATE_PAYMENT_METHOD</option>
                <option value="STOP">STOP</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => handleReviewAction('APPROVE')}
              disabled={submittingReview}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium shadow-md transition"
            >
              Approve AI Recommendation ({decision?.recommended_action || 'RETRY'})
            </button>
            <button
              onClick={() => handleReviewAction('OVERRIDE')}
              disabled={submittingReview}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium shadow-md transition"
            >
              Execute Override Action
            </button>
            <button
              onClick={() => handleReviewAction('STOP')}
              disabled={submittingReview}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium shadow-md transition"
            >
              Halt / Stop Case
            </button>
          </div>
        </div>
      )}

      {/* 3-Column Detailed Inspection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Transaction & Customer Details */}
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 border-b border-gray-800 pb-3">
              <UserCheck className="w-4 h-4 text-blue-400" />
              Transaction & Customer Context
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-gray-500">Order ID:</span>
                <div className="font-mono text-gray-200 mt-0.5">{c.order_id || 'N/A'}</div>
              </div>
              <div>
                <span className="text-gray-500">Payment ID:</span>
                <div className="font-mono text-gray-200 mt-0.5">{c.payment_id}</div>
              </div>
              <div>
                <span className="text-gray-500">Payment Method:</span>
                <div className="font-medium text-white capitalize mt-0.5">{c.payment_method}</div>
              </div>
              <div>
                <span className="text-gray-500">Customer Contact:</span>
                <div className="text-gray-300 mt-0.5">{c.customer_context?.email || c.customer_context?.contact || 'N/A'}</div>
              </div>
              <div>
                <span className="text-gray-500">Consent Status:</span>
                <div className="mt-0.5">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    c.consent_status === 'CONSENTED'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-red-950 text-red-400 border border-red-800'
                  }`}>
                    {c.consent_status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 border-b border-gray-800 pb-3">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Failure Telemetry
            </h2>
            <div>
              <span className="text-xs text-gray-500">Gateway Error Code:</span>
              <div className="text-xs font-mono text-amber-300 bg-amber-950/40 p-2 rounded border border-amber-800/50 mt-1">
                {c.failure_code}
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Description:</span>
              <div className="text-xs text-gray-300 bg-gray-950 p-2.5 rounded border border-gray-800 mt-1 leading-relaxed">
                {c.failure_description}
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: AI Diagnosis, Policy Check & Controlled Tools */}
        <div className="space-y-6">
          {/* AI Decision Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                AI Structured Decision
              </h2>
              <span className="text-[11px] font-mono text-gray-400">{decision?.model_provider}</span>
            </div>

            {decision ? (
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-gray-500">Diagnosis:</span>
                  <div className="text-sm font-medium text-white mt-0.5">{decision.diagnosis}</div>
                </div>

                <div className="flex items-center gap-4 py-1">
                  <div>
                    <span className="text-gray-500">Recommendation:</span>
                    <div className="text-sm font-bold text-blue-400 font-mono mt-0.5">
                      {decision.recommended_action}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Confidence:</span>
                    <div className="text-sm font-semibold text-purple-300 mt-0.5">
                      {(decision.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Expected Value:</span>
                    <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                      ₹{(decision.expected_value / 100).toFixed(0)}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-gray-500">Rationale:</span>
                  <div className="text-gray-300 bg-gray-950 p-2.5 rounded border border-gray-800 mt-1">
                    {decision.rationale}
                  </div>
                </div>

                <div>
                  <span className="text-gray-500">Evidence Extracted:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {decision.evidence?.map((e: string, idx: number) => (
                      <span key={idx} className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-[11px] border border-gray-700">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic">No AI decision generated yet.</div>
            )}
          </div>

          {/* Deterministic Policy Check Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Deterministic Policy Guardrails
              </h2>
              <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                policyCheck?.policy_result === 'ALLOW'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : policyCheck?.policy_result === 'ESCALATE'
                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                  : 'bg-red-950 text-red-400 border border-red-800'
              }`}>
                {policyCheck?.policy_result || 'PENDING'}
              </span>
            </div>

            {policyCheck ? (
              <div className="space-y-2 text-xs">
                <div className="text-gray-400 mb-1">Policy Rules Evaluated:</div>
                <ul className="space-y-1.5">
                  {policyCheck.reasons?.map((r: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-gray-300 bg-gray-950 p-2 rounded border border-gray-800/80">
                      {policyCheck.allowed ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic">No policy checks recorded.</div>
            )}
          </div>

          {/* Controlled Tool Executions Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2 border-b border-gray-800 pb-3">
              <Wrench className="w-4 h-4 text-blue-400" />
              Controlled Tool Executions ({toolExecutions.length})
            </h2>

            {toolExecutions.length > 0 ? (
              <div className="space-y-3">
                {toolExecutions.map((t: any) => (
                  <div key={t.id} className="bg-gray-950 p-3 rounded-lg border border-gray-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-mono font-medium">
                      <span className="text-blue-400">{t.tool_name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        t.status === 'SUCCESS' ? 'text-emerald-400 bg-emerald-950/60' : 'text-red-400 bg-red-950/60'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 font-mono">Key: {t.idempotency_key}</div>
                    <pre className="bg-gray-900 p-2 rounded text-[11px] text-gray-300 overflow-x-auto border border-gray-800">
                      {JSON.stringify(t.result, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500 italic">No tool executions recorded.</div>
            )}
          </div>
        </div>

        {/* Right Column: Append-Only Audit Trail Timeline */}
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-400" />
                Append-Only Audit Trail
              </h2>
              <span className="text-xs text-gray-500">{auditEvents.length} events</span>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-800">
              {auditEvents.map((a: any, idx: number) => (
                <div key={a.id || idx} className="relative">
                  <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-gray-900" />
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <span>{a.event_type}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-gray-800 text-gray-400 rounded">
                      {a.actor}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">{a.source}</div>
                  <div className="text-[10px] text-gray-500 font-mono mt-1">
                    {new Date(a.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
