'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface CaseDetail {
  id: string;
  merchant_id: string;
  event_id: string;
  payment_id: string;
  order_id?: string;
  obligation_id?: string | null;
  payment_link_id?: string;
  recovery_url?: string;
  amount: number;
  currency: string;
  failure_code: string;
  failure_description: string;
  payment_method: string;
  attempt_count: number;
  status: string;
  recoverability_score: number;
  expected_recovery_value: number;
  consent_status: string;
  created_at: string;
}

interface DecisionDetail {
  id: string;
  diagnosis: string;
  failure_category: string;
  recoverability: number;
  recommended_action: string;
  confidence: number;
  reason: string;
  customer_friction: string;
  evidence: string[];
  rationale: string;
  created_at: string;
}

interface PolicyCheckDetail {
  id: string;
  allowed: boolean;
  policy_result: 'ALLOW' | 'BLOCK' | 'ESCALATE';
  reasons: string[];
  created_at: string;
}

interface ToolExecutionDetail {
  id: string;
  tool_name: string;
  idempotency_key: string;
  status: string;
  result: Record<string, any>;
  created_at: string;
}

interface AuditEventDetail {
  id: string;
  event_type: string;
  actor: string;
  source: string;
  metadata: Record<string, any>;
  timestamp: string;
}

interface ObligationDetail {
  id: string;
  order_id: string;
  merchant_id: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SATISFIED' | 'TERMINATED';
  satisfied_by_payment_id?: string | null;
  generation: number;
  created_at: string;
}

interface RecoveryActionDetail {
  id: string;
  obligation_id: string;
  case_id: string;
  action_name: string;
  idempotency_key: string;
  generation: number;
  status: 'PENDING' | 'CLAIMED' | 'EXECUTED' | 'FAILED' | 'CANCELLED';
  claimed_by?: string | null;
  lease_expires_at?: string | null;
  created_at: string;
}

interface CommunicationDetail {
  id: string;
  obligation_id: string;
  case_id: string;
  channel: string;
  template: string;
  status: string;
  sent_at: string;
  delivered_at?: string | null;
  simulated: boolean;
}

export default function CaseDetailPage({ params }: { params: { id: string } }) {
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [obligation, setObligation] = useState<ObligationDetail | null>(null);
  const [decisions, setDecisions] = useState<DecisionDetail[]>([]);
  const [policyChecks, setPolicyChecks] = useState<PolicyCheckDetail[]>([]);
  const [toolExecutions, setToolExecutions] = useState<ToolExecutionDetail[]>([]);
  const [recoveryActions, setRecoveryActions] = useState<RecoveryActionDetail[]>([]);
  const [communications, setCommunications] = useState<CommunicationDetail[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [operatorNotes, setOperatorNotes] = useState('');
  const [completingPayment, setCompletingPayment] = useState(false);

  useEffect(() => {
    fetchCaseDetails();
  }, [params.id]);

  const fetchCaseDetails = async () => {
    try {
      const res = await fetch(`/api/cases/${params.id}`);
      const data = await res.json();
      if (data.success) {
        setCaseData(data.data.case || data.case);
        setObligation(data.data.obligation || data.obligation || null);
        setDecisions(data.data.decisions || data.decisions || []);
        setPolicyChecks(data.data.policyChecks || data.policyChecks || []);
        setToolExecutions(data.data.toolExecutions || data.toolExecutions || []);
        setRecoveryActions(data.data.recoveryActions || data.recoveryActions || []);
        setCommunications(data.data.communications || data.communications || []);
        setAuditEvents(data.data.auditEvents || data.auditEvents || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleHumanReviewAction = async (action: 'APPROVE' | 'OVERRIDE' | 'STOP' | 'ESCALATE', overrideAction?: string) => {
    setReviewing(true);
    try {
      const res = await fetch(`/api/cases/${params.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          override_action: overrideAction,
          operator_notes: operatorNotes || `Operator performed action ${action}`,
          operator_id: 'merchant_admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchCaseDetails();
        setOperatorNotes('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setReviewing(false);
    }
  };

  const handleSimulatePaymentSuccess = async () => {
    setCompletingPayment(true);
    try {
      const res = await fetch(`/api/cases/${params.id}/complete-payment`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        await fetchCaseDetails();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCompletingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading recovery journey...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Case Not Found</h2>
          <Link href="/" className="text-blue-400 text-sm hover:underline">Return to Dashboard</Link>
        </div>
      </div>
    );
  }

  const latestDecision = decisions[decisions.length - 1];
  const latestPolicy = policyChecks[policyChecks.length - 1];
  const latestTool = toolExecutions[toolExecutions.length - 1];
  const formattedAmount = `₹${(caseData.amount / 100).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-8">
        
        {/* Header Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <Link href="/" className="text-slate-400 hover:text-white text-xs flex items-center space-x-1">
              <span>← Back to Opportunities</span>
            </Link>
            <span className="text-slate-400">/</span>
            <span className="text-xs font-mono text-slate-300">{caseData.id}</span>
          </div>

          <div className="flex items-center space-x-3">
            {caseData.status !== 'RECOVERED' && (
              <>
                <Link
                  href={`/recover/${caseData.id}`}
                  target="_blank"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition flex items-center space-x-1"
                >
                  <span>Open Consumer Payment Page ↗</span>
                </Link>
                <button
                  onClick={handleSimulatePaymentSuccess}
                  disabled={completingPayment}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
                >
                  {completingPayment ? 'Verifying...' : '⚡ Trigger Razorpay Success Webhook'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Case Header Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-3xl font-extrabold text-white tracking-tight">{formattedAmount}</span>
              <span className="text-xs px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold uppercase">
                {caseData.failure_code}
              </span>
              <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono uppercase">
                {caseData.payment_method}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Payment ID: <span className="text-slate-300 font-mono">{caseData.payment_id}</span> | Order ID: <span className="text-slate-300 font-mono">{caseData.order_id || 'N/A'}</span>
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase tracking-wider">Current State</div>
              <div className="text-sm font-bold text-emerald-400 mt-0.5">{caseData.status}</div>
            </div>
            <div className="text-right border-l border-slate-800 pl-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider">Recoverability</div>
              <div className="text-sm font-bold text-white mt-0.5">{(caseData.recoverability_score * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>

        {/* Commercial Obligation & Payment Truth Precedence Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Commercial Obligation & Payment Truth</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                  obligation?.status === 'SATISFIED' || caseData.status === 'RECOVERED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : obligation?.status === 'TERMINATED'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  Obligation: {obligation?.status || (caseData.status === 'RECOVERED' ? 'SATISFIED' : 'PENDING')}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  Gen {obligation?.generation ?? 1}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Law 1 & Law 2: An obligation represents the merchant's commercial claim to payment. Attempts and links are ephemeral.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="text-slate-400">Obligation ID:</span>
              <span className="text-blue-300 bg-blue-950/40 px-2 py-1 rounded border border-blue-800/40">
                {obligation?.id || caseData.obligation_id || `obl_${caseData.order_id || 'synthetic'}`}
              </span>
            </div>
          </div>

          {/* Source Precedence Hierarchy Indicator */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-xs">
            <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
              caseData.status === 'RECOVERED'
                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider">Tier 1: Provider Webhook</div>
              <div className="font-semibold text-[11px] mt-1">AUTHORITATIVE_EVENT</div>
              <div className="text-[9px] text-slate-400 mt-1">Razorpay HMAC-SHA256 verified</div>
              <div className="mt-2 text-[10px] font-bold">
                {caseData.status === 'RECOVERED' ? '✓ Truth Source' : 'Pending Capture'}
              </div>
            </div>

            <div className="p-2.5 rounded-lg border bg-slate-950 border-slate-800 text-slate-400 flex flex-col justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider">Tier 2: Direct API Query</div>
              <div className="font-semibold text-[11px] mt-1">PROVIDER_QUERY</div>
              <div className="text-[9px] text-slate-400 mt-1">Synchronous Razorpay polling</div>
              <div className="mt-2 text-[10px] text-slate-400">Secondary fallback</div>
            </div>

            <div className={`p-2.5 rounded-lg border flex flex-col justify-between ${
              caseData.status !== 'RECOVERED'
                ? 'bg-blue-950/30 border-blue-500/40 text-blue-200'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <div className="text-[10px] font-bold uppercase tracking-wider">Tier 3: Database Ledger</div>
              <div className="font-semibold text-[11px] mt-1">PERSISTED_STATE</div>
              <div className="text-[9px] text-slate-400 mt-1">Immutable SQLite store</div>
              <div className="mt-2 text-[10px] font-bold">
                {caseData.status !== 'RECOVERED' ? '● Active State' : 'Audited'}
              </div>
            </div>

            <div className="p-2.5 rounded-lg border bg-rose-950/20 border-rose-800/30 text-rose-300/80 flex flex-col justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider">Tier 4: LLM Proposals</div>
              <div className="font-semibold text-[11px] mt-1 line-through">LLM_DECISION</div>
              <div className="text-[9px] text-rose-400/80 mt-1">Advisory diagnosis only</div>
              <div className="mt-2 text-[10px] font-bold text-rose-400">✗ Zero Authority</div>
            </div>

            <div className="p-2.5 rounded-lg border bg-rose-950/20 border-rose-800/30 text-rose-300/80 flex flex-col justify-between">
              <div className="text-[10px] font-bold uppercase tracking-wider">Tier 5: Merchant UI</div>
              <div className="font-semibold text-[11px] mt-1 line-through">CLIENT_INPUT</div>
              <div className="text-[9px] text-rose-400/80 mt-1">Subject to policy checks</div>
              <div className="mt-2 text-[10px] font-bold text-rose-400">✗ Zero Authority</div>
            </div>
          </div>
        </div>

        {/* Explainability Cards: "Why Did We Act?" vs "Why Did We NOT Act?" */}
        {latestPolicy && (
          <div className="grid grid-cols-1 gap-4">
            {latestPolicy.allowed ? (
              <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm mb-2">
                  <span className="text-base">✓</span>
                  <span>Explainability: Why Did We Act?</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mt-3">
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 uppercase text-[10px] font-bold">1. Diagnostic Signal</div>
                    <p className="text-slate-200 mt-1">
                      Identified as <strong className="text-emerald-300">{latestDecision?.failure_category}</strong> failure.
                      Error code <code className="text-xs text-blue-300 font-mono">{caseData.failure_code}</code> has proven recoverable via alternate rail/link.
                    </p>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 uppercase text-[10px] font-bold">2. Economic Justification</div>
                    <p className="text-slate-200 mt-1">
                      Recoverability: <strong className="text-white">{(caseData.recoverability_score * 100).toFixed(0)}%</strong>. Expected Recovery Value: <strong className="text-emerald-300">₹{(caseData.expected_recovery_value / 100).toLocaleString('en-IN')}</strong> exceeds estimated delivery cost of ₹0.50.
                    </p>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                    <div className="text-slate-400 uppercase text-[10px] font-bold">3. Guardrails Passed</div>
                    <ul className="text-slate-300 mt-1 space-y-0.5 list-disc list-inside text-[11px]">
                      <li>Amount (₹{(caseData.amount / 100).toLocaleString('en-IN')}) within autonomous limit</li>
                      <li>Customer consent status: CONSENTED</li>
                      <li>Deterministic idempotency key leased</li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-rose-950/20 border border-rose-500/40 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm mb-2">
                  <span className="text-base">🛡️</span>
                  <span>Explainability: Why Did We NOT Act? (Fail-Closed Safety Defense)</span>
                </div>
                <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs">
                  <div className="text-slate-400 uppercase text-[10px] font-bold mb-1">Triggered Hard Policy Guardrail</div>
                  <div className="space-y-1.5 mt-2">
                    {latestPolicy.reasons.map((reason, rIdx) => (
                      <div key={rIdx} className="flex items-start space-x-2 text-rose-200">
                        <span className="text-rose-400 font-bold">✗</span>
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>Policy Result: <strong className="text-white uppercase font-mono">{latestPolicy.policy_result}</strong></span>
                    <span>Policy Engine: <strong className="text-slate-300 font-mono">v1.0.0 (Deterministic)</strong></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VISUAL RECOVERY JOURNEY STORYBOARD (CORE REQUIREMENT) */}
        {/* ========================================================================= */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4 mb-6">
            <h2 className="text-lg font-bold text-white tracking-tight">Autonomous Recovery Journey</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Closed control loop execution narrative from failure to verified capture
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs relative">
            
            {/* Step 1: Payment Failed */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Step 1</div>
                <div className="text-xs font-bold text-rose-400">PAYMENT FAILED</div>
                <div className="text-base font-extrabold text-white mt-2">{formattedAmount}</div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">{caseData.failure_code}</div>
              </div>
              <div className="mt-3 text-[10px] text-slate-400 font-mono">Webhook Ingested</div>
            </div>

            {/* Step 2: Failure Diagnosis */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Step 2</div>
                <div className="text-xs font-bold text-blue-400">DIAGNOSIS</div>
                <div className="text-[11px] font-semibold text-slate-200 mt-2">
                  {latestDecision?.diagnosis || 'Analyzing failure...'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Category: <span className="text-slate-300 font-mono">{latestDecision?.failure_category || 'TRANSIENT'}</span>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-blue-400 font-medium">
                {latestDecision ? `${(latestDecision.confidence * 100).toFixed(0)}% Confidence` : 'Pending'}
              </div>
            </div>

            {/* Step 3: AI Recommendation */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Step 3</div>
                <div className="text-xs font-bold text-purple-400">AI DECISION</div>
                <div className="text-xs font-bold text-purple-300 mt-2">
                  {latestDecision?.recommended_action || 'Pending'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Friction: <span className="text-slate-300 font-medium">{latestDecision?.customer_friction || 'LOW'}</span>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-slate-400 font-mono">Structured JSON</div>
            </div>

            {/* Step 4: Merchant Policy */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Step 4</div>
                <div className="text-xs font-bold text-amber-400">MERCHANT POLICY</div>
                <div className="text-xs font-bold mt-2">
                  {latestPolicy?.allowed ? (
                    <span className="text-emerald-400">✓ APPROVED</span>
                  ) : latestPolicy?.policy_result === 'ESCALATE' ? (
                    <span className="text-purple-400">⚡ ESCALATED</span>
                  ) : (
                    <span className="text-rose-400">✗ BLOCKED</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {caseData.amount > 2500000 ? 'Threshold > ₹25k' : 'Within Autonomous Cap'}
                </div>
              </div>
              <div className="mt-3 text-[10px] text-slate-400">Attempt {caseData.attempt_count} of 2</div>
            </div>

            {/* Step 5: Controlled Action */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Step 5</div>
                <div className="text-xs font-bold text-cyan-400">ACTION EXECUTED</div>
                <div className="text-[11px] font-semibold text-slate-200 mt-2">
                  {latestTool ? `✓ ${latestTool.tool_name}` : 'Action Pending'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono truncate">
                  {caseData.payment_link_id || caseData.recovery_url ? 'Link active' : 'Idempotent call'}
                </div>
              </div>
              <div className="mt-3 text-[10px] text-cyan-400">Verified Tool</div>
            </div>

            {/* Step 6: Customer Interaction */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-1">Step 6</div>
                <div className="text-xs font-bold text-amber-300">CUSTOMER CHECKOUT</div>
                <div className="text-[11px] text-slate-300 mt-2">
                  {caseData.status === 'RECOVERED' ? (
                    <span className="text-emerald-400">✓ Checkout completed</span>
                  ) : (
                    <span>Waiting for customer payment</span>
                  )}
                </div>
              </div>
              <div className="mt-3 text-[10px] text-slate-400">Low-Friction UI</div>
            </div>

            {/* Step 7: Outcome Verified */}
            <div className={`border rounded-xl p-4 flex flex-col justify-between ${
              caseData.status === 'RECOVERED'
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}>
              <div>
                <div className="text-[10px] font-bold tracking-wider uppercase mb-1">Step 7</div>
                <div className="text-xs font-bold">
                  {caseData.status === 'RECOVERED' ? 'RECOVERED' : 'AWAITING OUTCOME'}
                </div>
                <div className="text-base font-extrabold mt-2 text-white">
                  {caseData.status === 'RECOVERED' ? formattedAmount : '₹0'}
                </div>
              </div>
              <div className="mt-3 text-[10px] font-mono">
                {caseData.status === 'RECOVERED' ? '✓ Authoritative Capture' : 'Pending Event'}
              </div>
            </div>

          </div>
        </div>

        {/* Human Operator Panel if in HUMAN_REVIEW */}
        {caseData.status === 'HUMAN_REVIEW' && (
          <div className="bg-purple-950/30 border border-purple-500/40 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm mb-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping"></span>
              <span>Operator Human Review Queue</span>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              This case exceeded automated threshold limits or required operator approval. Choose an action:
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                value={operatorNotes}
                onChange={(e) => setOperatorNotes(e.target.value)}
                placeholder="Enter operator rationale..."
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white flex-1 w-full"
              />
              <button
                onClick={() => handleHumanReviewAction('APPROVE')}
                disabled={reviewing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition whitespace-nowrap"
              >
                Approve Recommendation
              </button>
              <button
                onClick={() => handleHumanReviewAction('STOP')}
                disabled={reviewing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition whitespace-nowrap"
              >
                Stop Recovery
              </button>
            </div>
          </div>
        )}

        {/* Bottom Details Grid: AI Reasoning & Append-Only Audit Trail */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* AI Structured Diagnosis & Rationale */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center space-x-2">
              <span>🤖 AI Diagnostic Intelligence</span>
            </h3>

            {latestDecision ? (
              <div className="space-y-4 text-xs">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="text-slate-400 uppercase font-semibold text-[10px]">Diagnosis</div>
                  <div className="text-slate-200 font-medium text-sm">{latestDecision.diagnosis}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 uppercase font-semibold text-[10px]">Recommended Action</div>
                    <div className="text-purple-400 font-bold text-sm mt-1">{latestDecision.recommended_action}</div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3">
                    <div className="text-slate-400 uppercase font-semibold text-[10px]">Customer Friction</div>
                    <div className="text-slate-200 font-bold text-sm mt-1">{latestDecision.customer_friction}</div>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="text-slate-400 uppercase font-semibold text-[10px] mb-1">Decision Rationale</div>
                  <p className="text-slate-300 leading-relaxed">{latestDecision.reason || latestDecision.rationale}</p>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 text-xs py-8 text-center">No diagnosis record available</div>
            )}
          </div>

          {/* Chronological Append-Only Audit Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center space-x-2">
              <span>📜 Immutable Audit Timeline</span>
              <span className="text-[10px] text-slate-400 font-normal">({auditEvents.length} events logged)</span>
            </h3>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {auditEvents.map((evt, idx) => (
                <div key={evt.id || idx} className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs flex items-start space-x-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5"></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200">{evt.event_type}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Actor: <span className="text-slate-300 uppercase font-mono text-[10px]">{evt.actor}</span> | Source: <span className="text-slate-300">{evt.source}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Recovery Actions Ledger & Deterministic Idempotency */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>🔐 Controlled Actions & Worker Leases</span>
                <span className="text-xs text-slate-400 font-normal">({recoveryActions.length} planned / executed)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Law 4 & Law 5: Every action has a deterministic generation key and requires an atomic worker lease.
              </p>
            </div>
            <span className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-300 font-mono">
              Generation: {obligation?.generation ?? 1}
            </span>
          </div>

          {recoveryActions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Idempotency Key</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Worker Lease</th>
                    <th className="py-2.5 px-3">Scheduled At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {recoveryActions.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{act.action_name}</td>
                      <td className="py-2.5 px-3 text-blue-300 truncate max-w-xs">{act.idempotency_key}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          act.status === 'EXECUTED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : act.status === 'CLAIMED'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            : act.status === 'CANCELLED'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {act.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {act.claimed_by ? `${act.claimed_by} (active lease)` : 'Unleased'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {new Date(act.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-slate-500 text-xs py-4 text-center">
              No worker leases active for this case.
            </div>
          )}

          {/* Communications Sub-ledger */}
          {communications.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="text-xs font-bold text-slate-300 mb-2">Customer Outreach Ledger</div>
              <div className="space-y-2">
                {communications.map((comm) => (
                  <div key={comm.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                        {comm.channel}
                      </span>
                      <span className="text-slate-200 font-medium">{comm.template}</span>
                      {comm.simulated && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">simulated</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-slate-400 font-mono text-[10px]">
                      <span>Status: <strong className="text-emerald-400">{comm.status}</strong></span>
                      <span>Sent: {new Date(comm.sent_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
