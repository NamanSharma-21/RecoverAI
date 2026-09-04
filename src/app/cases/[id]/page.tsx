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
      <div className="py-24 text-center">
        <div className="text-xs font-mono text-[#777169] animate-pulse">Loading recovery journey...</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="py-24 text-center">
        <h2 className="text-xl font-normal text-[#000000] mb-2">Case Not Found</h2>
        <p className="text-xs text-[#777169] mb-4">The requested recovery case could not be located.</p>
        <Link href="/" className="inline-block px-4 py-1.5 rounded-full bg-[#000000] text-[#fdfcfc] text-xs hover:bg-[#44403b] transition-all">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const latestDecision = decisions[decisions.length - 1];
  const latestPolicy = policyChecks[policyChecks.length - 1];
  const latestTool = toolExecutions[toolExecutions.length - 1];
  const formattedAmount = `₹${(caseData.amount / 100).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-8">
      {/* Header Breadcrumb & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#ebe8e4] pb-4">
        <div className="flex items-center space-x-2 text-xs">
          <Link href="/" className="text-[#777169] hover:text-[#000000] transition-colors">
            ← Dashboard
          </Link>
          <span className="text-[#a59f97]">/</span>
          <span className="font-mono text-[#44403b]">{caseData.id}</span>
        </div>

        <div className="flex items-center space-x-2">
          {caseData.status !== 'RECOVERED' && (
            <>
              <Link
                href={`/recover/${caseData.id}`}
                target="_blank"
                className="px-4 py-1.5 bg-[#fdfcfc] border border-[#ebe8e4] hover:bg-[#ebe8e4] text-[#44403b] hover:text-[#000000] rounded-full text-xs font-medium transition-all inline-flex items-center space-x-1"
              >
                <span>Checkout Page</span>
                <span className="text-[11px] text-[#777169]">↗</span>
              </Link>
              <button
                onClick={handleSimulatePaymentSuccess}
                disabled={completingPayment}
                className="px-4 py-1.5 bg-[#000000] hover:bg-[#44403b] disabled:opacity-50 text-[#fdfcfc] rounded-full text-xs font-medium transition-all inline-flex items-center space-x-1"
              >
                <span>{completingPayment ? 'Verifying...' : 'Simulate Razorpay Webhook'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Case Header Banner */}
      <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-3xl font-light tracking-tight text-[#000000]">{formattedAmount}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[#ff4704] font-medium uppercase">
              {caseData.failure_code}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#fdfcfc] border border-[#ebe8e4] text-[#777169] font-mono uppercase">
              {caseData.payment_method}
            </span>
          </div>
          <p className="text-xs text-[#777169] mt-2">
            Payment ID: <span className="text-[#44403b] font-mono">{caseData.payment_id}</span> · Order ID: <span className="text-[#44403b] font-mono">{caseData.order_id || 'N/A'}</span>
          </p>
        </div>

        <div className="flex items-center space-x-6">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-[#777169]">Status</div>
            <div className="text-sm font-medium text-[#000000] mt-0.5 flex items-center justify-end space-x-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${
                caseData.status === 'RECOVERED' ? 'bg-[#0447ff]' : caseData.status === 'HUMAN_REVIEW' ? 'bg-[#ff4704]' : 'bg-[#a59f97]'
              }`} />
              <span>{caseData.status}</span>
            </div>
          </div>
          <div className="text-right border-l border-[#ebe8e4] pl-6">
            <div className="text-[10px] uppercase tracking-wider text-[#777169]">Recoverability</div>
            <div className="text-sm font-medium text-[#000000] mt-0.5 font-mono">{(caseData.recoverability_score * 100).toFixed(0)}%</div>
          </div>
        </div>
      </div>

      {/* Commercial Obligation & Payment Truth Precedence Panel */}
      <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#ebe8e4] pb-4 mb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[#000000]">Commercial Obligation & Payment Truth</span>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium uppercase border ${
                obligation?.status === 'SATISFIED' || caseData.status === 'RECOVERED'
                  ? 'bg-[#fdfcfc] border-[#ebe8e4] text-[#000000]'
                  : 'bg-[#fdfcfc] border-[#ebe8e4] text-[#44403b]'
              }`}>
                Obligation: {obligation?.status || (caseData.status === 'RECOVERED' ? 'SATISFIED' : 'PENDING')}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ebe8e4] text-[#777169] font-mono">
                Gen {obligation?.generation ?? 1}
              </span>
            </div>
            <p className="text-xs text-[#777169] mt-1">
              Law 1 & Law 2: An obligation represents the merchant's commercial claim to payment. Attempts and links are ephemeral.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="text-[#777169]">Obligation ID:</span>
            <span className="text-[#44403b] bg-[#fdfcfc] px-3 py-1 rounded-full border border-[#ebe8e4]">
              {obligation?.id || caseData.obligation_id || `obl_${caseData.order_id || 'synthetic'}`}
            </span>
          </div>
        </div>

        {/* Source Precedence Hierarchy Indicator */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
            caseData.status === 'RECOVERED'
              ? 'bg-[#fdfcfc] border-[#000000] text-[#000000]'
              : 'bg-[#fdfcfc] border-[#ebe8e4] text-[#777169]'
          }`}>
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#777169]">Tier 1: Provider Webhook</div>
            <div className="font-medium text-xs text-[#000000] mt-1.5">AUTHORITATIVE_EVENT</div>
            <div className="text-[11px] text-[#777169] mt-1">Razorpay HMAC-SHA256 verified</div>
            <div className="mt-3 text-[11px] font-medium flex items-center space-x-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${caseData.status === 'RECOVERED' ? 'bg-[#0447ff]' : 'bg-[#a59f97]'}`} />
              <span className="text-[#000000]">{caseData.status === 'RECOVERED' ? 'Truth Source' : 'Pending Capture'}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-[#fdfcfc] border-[#ebe8e4] text-[#777169] flex flex-col justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#777169]">Tier 2: Direct API Query</div>
            <div className="font-medium text-xs text-[#000000] mt-1.5">PROVIDER_QUERY</div>
            <div className="text-[11px] text-[#777169] mt-1">Synchronous Razorpay polling</div>
            <div className="mt-3 text-[11px] text-[#a59f97]">Secondary fallback</div>
          </div>

          <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
            caseData.status !== 'RECOVERED'
              ? 'bg-[#fdfcfc] border-[#ebe8e4] text-[#000000]'
              : 'bg-[#fdfcfc] border-[#ebe8e4] text-[#777169]'
          }`}>
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#777169]">Tier 3: Database Ledger</div>
            <div className="font-medium text-xs text-[#000000] mt-1.5">PERSISTED_STATE</div>
            <div className="text-[11px] text-[#777169] mt-1">Immutable SQLite store</div>
            <div className="mt-3 text-[11px] font-medium flex items-center space-x-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${caseData.status !== 'RECOVERED' ? 'bg-[#0447ff]' : 'bg-[#a59f97]'}`} />
              <span className="text-[#000000]">{caseData.status !== 'RECOVERED' ? 'Active State' : 'Audited'}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-[#fdfcfc] border-[#ebe8e4] text-[#777169] flex flex-col justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#a59f97]">Tier 4: LLM Proposals</div>
            <div className="font-medium text-xs text-[#777169] mt-1.5 line-through">LLM_DECISION</div>
            <div className="text-[11px] text-[#a59f97] mt-1">Advisory diagnosis only</div>
            <div className="mt-3 text-[11px] text-[#ff4704] font-medium">Zero Authority</div>
          </div>

          <div className="p-3.5 rounded-xl border bg-[#fdfcfc] border-[#ebe8e4] text-[#777169] flex flex-col justify-between">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#a59f97]">Tier 5: Merchant UI</div>
            <div className="font-medium text-xs text-[#777169] mt-1.5 line-through">CLIENT_INPUT</div>
            <div className="text-[11px] text-[#a59f97] mt-1">Subject to policy checks</div>
            <div className="mt-3 text-[11px] text-[#ff4704] font-medium">Zero Authority</div>
          </div>
        </div>
      </div>

      {/* Explainability Cards: "Why Did We Act?" vs "Why Did We NOT Act?" */}
      {latestPolicy && (
        <div>
          {latestPolicy.allowed ? (
            <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6">
              <div className="flex items-center space-x-2 text-[#000000] font-medium text-xs uppercase tracking-wider mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0447ff]" />
                <span>Explainability: Why Did We Act?</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mt-3">
                <div className="bg-[#fdfcfc] p-4 rounded-xl border border-[#ebe8e4]">
                  <div className="text-[#777169] uppercase text-[10px] font-medium">1. Diagnostic Signal</div>
                  <p className="text-[#44403b] mt-1.5 leading-relaxed">
                    Identified as <strong className="text-[#000000] font-medium">{latestDecision?.failure_category}</strong> failure.
                    Error code <code className="text-xs text-[#000000] font-mono">{caseData.failure_code}</code> has proven recoverable via alternate rail/link.
                  </p>
                </div>
                <div className="bg-[#fdfcfc] p-4 rounded-xl border border-[#ebe8e4]">
                  <div className="text-[#777169] uppercase text-[10px] font-medium">2. Economic Justification</div>
                  <p className="text-[#44403b] mt-1.5 leading-relaxed">
                    Recoverability: <strong className="text-[#000000] font-medium">{(caseData.recoverability_score * 100).toFixed(0)}%</strong>. Expected Recovery Value: <strong className="text-[#000000] font-medium">₹{(caseData.expected_recovery_value / 100).toLocaleString('en-IN')}</strong> exceeds estimated delivery cost.
                  </p>
                </div>
                <div className="bg-[#fdfcfc] p-4 rounded-xl border border-[#ebe8e4]">
                  <div className="text-[#777169] uppercase text-[10px] font-medium">3. Guardrails Passed</div>
                  <ul className="text-[#44403b] mt-1.5 space-y-1 text-[11px]">
                    <li>· Amount within autonomous limit</li>
                    <li>· Customer consent status: CONSENTED</li>
                    <li>· Deterministic idempotency key leased</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6">
              <div className="flex items-center space-x-2 text-[#ff4704] font-medium text-xs uppercase tracking-wider mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff4704]" />
                <span>Explainability: Why Did We NOT Act? (Fail-Closed Safety Defense)</span>
              </div>
              <div className="bg-[#fdfcfc] p-4 rounded-xl border border-[#ebe8e4] text-xs">
                <div className="text-[#777169] uppercase text-[10px] font-medium mb-1">Triggered Hard Policy Guardrail</div>
                <div className="space-y-1.5 mt-2">
                  {latestPolicy.reasons.map((reason, rIdx) => (
                    <div key={rIdx} className="flex items-start space-x-2 text-[#ff4704]">
                      <span className="font-bold">✗</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-[#ebe8e4] text-[11px] text-[#777169] flex items-center justify-between">
                  <span>Policy Result: <strong className="text-[#000000] uppercase font-mono">{latestPolicy.policy_result}</strong></span>
                  <span>Policy Engine: <strong className="text-[#44403b] font-mono">v1.0.0 (Deterministic)</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Autonomous Recovery Journey Storyboard */}
      <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6">
        <div className="border-b border-[#ebe8e4] pb-4 mb-5">
          <h2 className="text-base font-normal text-[#000000] tracking-tight">Autonomous Recovery Journey</h2>
          <p className="text-xs text-[#777169] mt-0.5">
            Closed control loop execution narrative from failure to verified capture
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          {/* Step 1: Payment Failed */}
          <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-medium text-[#777169] uppercase mb-1">Step 1</div>
              <div className="text-xs font-medium text-[#ff4704]">Payment Failed</div>
              <div className="text-base font-light text-[#000000] mt-1.5">{formattedAmount}</div>
              <div className="text-[11px] text-[#777169] mt-1 truncate">{caseData.failure_code}</div>
            </div>
            <div className="mt-3 text-[10px] text-[#a59f97] font-mono">Webhook Ingested</div>
          </div>

          {/* Step 2: Diagnosis */}
          <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-medium text-[#777169] uppercase mb-1">Step 2</div>
              <div className="text-xs font-medium text-[#000000]">Diagnosis</div>
              <div className="text-[11px] text-[#44403b] mt-1.5 line-clamp-2">
                {latestDecision?.diagnosis || 'Analyzing failure...'}
              </div>
              <div className="text-[10px] text-[#777169] mt-1">
                <span className="font-mono">{latestDecision?.failure_category || 'TRANSIENT'}</span>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-[#777169]">
              {latestDecision ? `${(latestDecision.confidence * 100).toFixed(0)}% Confidence` : 'Pending'}
            </div>
          </div>

          {/* Step 3: AI Decision */}
          <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-medium text-[#777169] uppercase mb-1">Step 3</div>
              <div className="text-xs font-medium text-[#000000]">AI Decision</div>
              <div className="text-xs font-medium text-[#000000] mt-1.5">
                {latestDecision?.recommended_action || 'Pending'}
              </div>
              <div className="text-[11px] text-[#777169] mt-1">
                Friction: <span className="text-[#44403b]">{latestDecision?.customer_friction || 'LOW'}</span>
              </div>
            </div>
            <div className="mt-3 text-[10px] text-[#a59f97] font-mono">Structured JSON</div>
          </div>

          {/* Step 4: Merchant Policy */}
          <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-medium text-[#777169] uppercase mb-1">Step 4</div>
              <div className="text-xs font-medium text-[#000000]">Merchant Policy</div>
              <div className="text-xs font-medium mt-1.5">
                {latestPolicy?.allowed ? (
                  <span className="text-[#000000]">✓ Approved</span>
                ) : latestPolicy?.policy_result === 'ESCALATE' ? (
                  <span className="text-[#ff4704]">⚡ Escalated</span>
                ) : (
                  <span className="text-[#ff4704]">✗ Blocked</span>
                )}
              </div>
              <div className="text-[11px] text-[#777169] mt-1">
                {caseData.amount > 2500000 ? '> ₹25k Threshold' : 'Autonomous Cap'}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-[#777169]">Attempt {caseData.attempt_count} of 2</div>
          </div>

          {/* Step 5: Controlled Action */}
          <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-medium text-[#777169] uppercase mb-1">Step 5</div>
              <div className="text-xs font-medium text-[#000000]">Action Executed</div>
              <div className="text-[11px] text-[#44403b] mt-1.5 font-mono truncate">
                {latestTool ? latestTool.tool_name : 'Action Pending'}
              </div>
              <div className="text-[10px] text-[#777169] mt-1">
                {caseData.payment_link_id || caseData.recovery_url ? 'Link active' : 'Idempotent call'}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-[#777169]">Verified Tool</div>
          </div>

          {/* Step 6: Customer Checkout */}
          <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-medium text-[#777169] uppercase mb-1">Step 6</div>
              <div className="text-xs font-medium text-[#000000]">Customer Checkout</div>
              <div className="text-[11px] text-[#44403b] mt-1.5">
                {caseData.status === 'RECOVERED' ? (
                  <span className="text-[#000000]">Completed</span>
                ) : (
                  <span>Awaiting payment</span>
                )}
              </div>
            </div>
            <div className="mt-3 text-[10px] text-[#777169]">Direct Portal</div>
          </div>

          {/* Step 7: Outcome Verified */}
          <div className={`rounded-xl p-3.5 flex flex-col justify-between border ${
            caseData.status === 'RECOVERED'
              ? 'bg-[#fdfcfc] border-[#000000] text-[#000000]'
              : 'bg-[#fdfcfc] border-[#ebe8e4] text-[#777169]'
          }`}>
            <div>
              <div className="text-[10px] font-medium text-[#777169] uppercase mb-1">Step 7</div>
              <div className="text-xs font-medium text-[#000000]">
                {caseData.status === 'RECOVERED' ? 'Recovered' : 'Awaiting Outcome'}
              </div>
              <div className="text-base font-light mt-1.5 text-[#000000]">
                {caseData.status === 'RECOVERED' ? formattedAmount : '₹0'}
              </div>
            </div>
            <div className="mt-3 text-[10px] font-mono text-[#777169]">
              {caseData.status === 'RECOVERED' ? '✓ Authoritative' : 'Pending Event'}
            </div>
          </div>
        </div>
      </div>

      {/* Human Operator Panel if in HUMAN_REVIEW */}
      {caseData.status === 'HUMAN_REVIEW' && (
        <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6">
          <div className="flex items-center space-x-2 text-[#ff4704] font-medium text-xs uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-[#ff4704] animate-ping" />
            <span>Operator Human Review Queue</span>
          </div>
          <p className="text-xs text-[#777169] mb-4">
            This case exceeded automated threshold limits or required operator approval. Choose an action:
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              placeholder="Enter operator rationale..."
              className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-full px-4 py-2 text-xs text-[#000000] placeholder:text-[#a59f97] focus:outline-none focus:border-[#000000] flex-1 w-full"
            />
            <button
              onClick={() => handleHumanReviewAction('APPROVE')}
              disabled={reviewing}
              className="px-5 py-2 bg-[#000000] hover:bg-[#44403b] text-[#fdfcfc] rounded-full text-xs font-medium transition-all whitespace-nowrap"
            >
              Approve Recommendation
            </button>
            <button
              onClick={() => handleHumanReviewAction('STOP')}
              disabled={reviewing}
              className="px-5 py-2 bg-[#fdfcfc] border border-[#ebe8e4] hover:bg-[#ebe8e4] text-[#ff4704] rounded-full text-xs font-medium transition-all whitespace-nowrap"
            >
              Stop Recovery
            </button>
          </div>
        </div>
      )}

      {/* Bottom Details Grid: AI Reasoning & Append-Only Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Structured Diagnosis & Rationale */}
        <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#000000] mb-4">
            AI Diagnostic Intelligence
          </h3>

          {latestDecision ? (
            <div className="space-y-4 text-xs">
              <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-4 space-y-1">
                <div className="text-[#777169] uppercase font-medium text-[10px]">Diagnosis</div>
                <div className="text-[#000000] font-normal text-sm leading-relaxed">{latestDecision.diagnosis}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-3">
                  <div className="text-[#777169] uppercase font-medium text-[10px]">Recommended Action</div>
                  <div className="text-[#000000] font-medium text-xs mt-1">{latestDecision.recommended_action}</div>
                </div>
                <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-3">
                  <div className="text-[#777169] uppercase font-medium text-[10px]">Customer Friction</div>
                  <div className="text-[#000000] font-medium text-xs mt-1">{latestDecision.customer_friction}</div>
                </div>
              </div>

              <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-4">
                <div className="text-[#777169] uppercase font-medium text-[10px] mb-1">Decision Rationale</div>
                <p className="text-[#44403b] leading-relaxed">{latestDecision.reason || latestDecision.rationale}</p>
              </div>
            </div>
          ) : (
            <div className="text-[#777169] text-xs py-8 text-center">No diagnosis record available</div>
          )}
        </div>

        {/* Chronological Append-Only Audit Log */}
        <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#000000]">
              Immutable Audit Timeline
            </h3>
            <span className="text-[10px] text-[#777169] font-mono">({auditEvents.length} events logged)</span>
          </div>

          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-2">
            {auditEvents.map((evt, idx) => (
              <div key={evt.id || idx} className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-xl p-3 text-xs flex items-start space-x-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#0447ff] mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-[#000000] truncate">{evt.event_type}</span>
                    <span className="text-[10px] text-[#777169] font-mono">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#777169] mt-0.5">
                    Actor: <span className="text-[#44403b] uppercase font-mono text-[10px]">{evt.actor}</span> · Source: <span className="text-[#44403b]">{evt.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recovery Actions Ledger & Deterministic Idempotency */}
      <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#ebe8e4] pb-3">
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wider text-[#000000] flex items-center space-x-2">
              <span>Controlled Actions & Worker Leases</span>
              <span className="text-xs text-[#777169] font-normal">({recoveryActions.length} planned / executed)</span>
            </h3>
            <p className="text-xs text-[#777169] mt-0.5">
              Law 4 & Law 5: Every action has a deterministic generation key and requires an atomic worker lease.
            </p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ebe8e4] text-[#44403b] font-mono">
            Generation: {obligation?.generation ?? 1}
          </span>
        </div>

        {recoveryActions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#ebe8e4] text-[#777169] text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Idempotency Key</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Worker Lease</th>
                  <th className="py-2.5 px-3">Scheduled At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebe8e4] font-mono text-[11px]">
                {recoveryActions.map((act) => (
                  <tr key={act.id} className="hover:bg-[#ebe8e4]/40 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[#000000]">{act.action_name}</td>
                    <td className="py-2.5 px-3 text-[#777169] truncate max-w-xs">{act.idempotency_key}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        act.status === 'EXECUTED'
                          ? 'bg-[#fdfcfc] border-[#ebe8e4] text-[#000000]'
                          : act.status === 'CLAIMED'
                          ? 'bg-[#fdfcfc] border-[#ebe8e4] text-[#0447ff]'
                          : act.status === 'CANCELLED'
                          ? 'bg-[#fdfcfc] border-[#ebe8e4] text-[#ff4704]'
                          : 'bg-[#fdfcfc] border-[#ebe8e4] text-[#777169]'
                      }`}>
                        {act.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#777169]">
                      {act.claimed_by ? `${act.claimed_by} (leased)` : 'Unleased'}
                    </td>
                    <td className="py-2.5 px-3 text-[#777169]">
                      {new Date(act.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-[#777169] text-xs py-4 text-center">
            No worker leases active for this case.
          </div>
        )}

        {/* Communications Sub-ledger */}
        {communications.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#ebe8e4]">
            <div className="text-xs font-medium text-[#000000] uppercase tracking-wider mb-2">Customer Outreach Ledger</div>
            <div className="space-y-2">
              {communications.map((comm) => (
                <div key={comm.id} className="bg-[#fdfcfc] p-3 rounded-xl border border-[#ebe8e4] text-xs flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-[#ebe8e4] text-[#44403b] font-medium">
                      {comm.channel}
                    </span>
                    <span className="text-[#000000] font-normal">{comm.template}</span>
                    {comm.simulated && (
                      <span className="text-[10px] bg-[#f5f3f1] text-[#777169] px-1.5 py-0.5 rounded-full">simulated</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-[#777169] font-mono text-[10px]">
                    <span>Status: <strong className="text-[#000000]">{comm.status}</strong></span>
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
