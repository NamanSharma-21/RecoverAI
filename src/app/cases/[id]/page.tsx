'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface CaseDetail {
  id: string;
  merchant_id: string;
  event_id: string;
  payment_id: string;
  order_id?: string;
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

export default function CaseDetailPage({ params }: { params: { id: string } }) {
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [decisions, setDecisions] = useState<DecisionDetail[]>([]);
  const [policyChecks, setPolicyChecks] = useState<PolicyCheckDetail[]>([]);
  const [toolExecutions, setToolExecutions] = useState<ToolExecutionDetail[]>([]);
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
        setCaseData(data.data.case);
        setDecisions(data.data.decisions);
        setPolicyChecks(data.data.policyChecks);
        setToolExecutions(data.data.toolExecutions);
        setAuditEvents(data.data.auditEvents);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
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

      </div>
    </div>
  );
}
