'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Cpu, 
  KeyRound, 
  Scale, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Lock, 
  AlertTriangle,
  RefreshCw,
  Layers,
  Database,
  Terminal
} from 'lucide-react';

export default function ArchitecturePage() {
  const [selectedLaw, setSelectedLaw] = useState<number>(1);

  const laws = [
    {
      id: 1,
      name: 'Separation of Obligation & Attempt',
      latin: 'Lex Obligationis',
      icon: Layers,
      color: 'from-blue-500 to-indigo-600',
      summary: 'The commercial obligation to pay outlives individual payment attempts, links, and sessions.',
      detail:
        'A failed payment is merely an unfulfilled attempt, not a cancelled order. Payment attempts, session tokens, and payment links are ephemeral and disposable. RecoverAI anchors all recovery state to the persistent Commercial Payment Obligation (order_id), preventing orphan links, duplicate debits, and state drift across channels.',
      invariants: [
        'One commercial order maps to exactly one PaymentObligation.',
        'Generation counters increment monotonically whenever recovery actions change.',
        'When an obligation is marked SATISFIED, all active and pending recovery actions are immediately revoked.',
      ],
      codeSnippet: `// Domain Invariant: Obligation vs Attempt
const obligation = repo.getOrCreateObligation(orderId, merchantId, amountPaise, 'INR');
// Multiple attempts and links reference the same persistent obligation
assert(obligation.status !== 'SATISFIED', 'Cannot act on satisfied obligation');`,
    },
    {
      id: 2,
      name: 'Source Precedence of Payment Truth',
      latin: 'Lex Veritatis',
      icon: Database,
      color: 'from-emerald-500 to-teal-600',
      summary: 'Payment truth is strictly hierarchical. LLM and UI inputs have zero authority over money movement.',
      detail:
        'Truth is determined strictly by authoritative external proof. A model hallucination, client-side webhook spoof, or operator click can never mark an obligation satisfied without cryptographic signature verification.',
      invariants: [
        'Tier 1 (AUTHORITATIVE_EVENT): HMAC-SHA256 verified Razorpay payment.captured webhook (Highest).',
        'Tier 2 (PROVIDER_QUERY): Direct synchronous polling of Razorpay /payments API.',
        'Tier 3 (PERSISTED_STATE): Local SQLite WAL database transaction ledger.',
        'Tier 4 (LLM_DECISION): Structured advisory model output (0% authority on payment truth).',
        'Tier 5 (CLIENT_INPUT): UI requests & operator clicks (0% authority without policy clearance).',
      ],
      codeSnippet: `// Payment Truth Resolver Precedence
export const TRUTH_SOURCE_PRECEDENCE = [
  'AUTHORITATIVE_EVENT', // Verified Razorpay Webhook
  'PROVIDER_QUERY',      // Direct Razorpay API Polling
  'PERSISTED_STATE',     // Local DB State
  'LLM_DECISION',        // Ignored for truth
  'CLIENT_INPUT',        // Ignored for truth
];`,
    },
    {
      id: 3,
      name: 'AI Proposes, Deterministic Policy Controls',
      latin: 'Lex Moderationis',
      icon: Cpu,
      color: 'from-purple-500 to-pink-600',
      summary: 'The LLM never directly touches payment APIs. Every recommendation must pass 9 hard deterministic checks.',
      detail:
        'The model acts solely as a specialized diagnostic classifier, returning structured JSON containing failure diagnosis, recoverability probability, and customer friction score. The deterministic PolicyEngine runs unconditionally before any action dispatch.',
      invariants: [
        'Deterministic checks evaluate: case open, obligation open, consent consented, amount ≤ threshold, attempt limit, hard decline blacklist, stale decision rejection (<5m).',
        'If any policy check fails, result is strictly BLOCK or ESCALATE.',
        'Even Human Operator actions (AI → HUMAN → POLICY → TOOL) are evaluated by PolicyEngine before execution.',
      ],
      codeSnippet: `// AI proposes, Policy strictly controls
const decision = await decisionService.evaluate(caseContext);
const policyResult = policyEngine.evaluate(recoveryCase, decision, obligation.status);
if (!policyResult.allowed) {
  // Execution impossible: fail-closed safety
  return recordBlockedAttempt(policyResult.reasons);
}`,
    },
    {
      id: 4,
      name: 'Generated & Leased Idempotency',
      latin: 'Lex Repetitionis',
      icon: KeyRound,
      color: 'from-amber-500 to-orange-600',
      summary: 'Idempotency keys are computed deterministically from obligation state, preventing duplicate charges.',
      detail:
        'Instead of random UUIDs, idempotency keys are mathematically bound to the obligation ID, action name, and generation count. Workers must atomically claim actions using SQLite conditional updates (SET status="CLAIMED" WHERE status="PENDING") with leasing timeouts.',
      invariants: [
        'Key format: idemp_{obligationKey}_{action}_gen{generation}.',
        'Duplicate webhooks or replayed network calls resolve to the identical idempotency key and return existing results.',
        'Worker leases prevent concurrent background workers from double-firing payment links or customer notifications.',
      ],
      codeSnippet: `// Deterministic Idempotency Key
const idempotencyKey = \`idemp_\${obligation.id}_\${action}_gen\${obligation.generation}\`;
// Atomic Worker Lease
const leased = repo.claimActionForExecution(actionId, workerId, leaseDurationMs);
if (!leased) return; // Another worker claimed this action`,
    },
    {
      id: 5,
      name: 'Pre-Flight Guard & Friction Boundaries',
      latin: 'Lex Praeventionis',
      icon: ShieldCheck,
      color: 'from-cyan-500 to-blue-600',
      summary: 'A final pre-flight barrier verifies truth immediately before money movement or customer outreach.',
      detail:
        'Between the moment a policy approves an action and the moment a tool executes, external state may change (e.g. customer paid in another browser tab, or revoked WhatsApp consent). PreFlightGuard queries live state at the millisecond of tool dispatch to prevent unrecoverable mistakes.',
      invariants: [
        'Double-Check Obligation: Verifies obligation is still open and payment has not arrived.',
        'Freshness Verification: Rejects decisions older than 5 minutes to prevent stale retry loops.',
        'Friction Boundary: Enforces communication cooling-off periods (max 2 touches per obligation).',
      ],
      codeSnippet: `// Pre-Flight Guard at Millisecond of Execution
const preFlight = preFlightGuard.evaluate(recoveryCase, action, policyCheck, config);
if (!preFlight.allowed) {
  throw new Error(\`PreFlight Guard Abort: \${preFlight.reason}\`);
}`,
    },
  ];

  return (
    <div className="space-y-10">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5" />
            <span>Production Control Architecture</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            The 5 Laws of RecoverAI
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            RecoverAI is not a simple generative chat bot or dunning automation. It is a bounded, fail-closed financial decision engine designed to operate safely in real payment environments where customer friction, statutory opt-outs, and payment races occur simultaneously.
          </p>
        </div>
      </div>

      {/* Interactive 5 Laws Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Law Buttons Navigation */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Constitutional Principles
          </h3>
          {laws.map((law) => {
            const Icon = law.icon;
            const isSelected = selectedLaw === law.id;
            return (
              <button
                key={law.id}
                onClick={() => setSelectedLaw(law.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start space-x-3.5 ${
                  isSelected
                    ? 'bg-slate-900 border-blue-500/60 shadow-lg shadow-blue-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                }`}
              >
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${law.color} text-white shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-mono text-blue-400 font-bold uppercase">
                    Law {law.id} • {law.latin}
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">{law.name}</div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{law.summary}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Law Details & Code Display */}
        <div className="lg:col-span-8">
          {(() => {
            const law = laws.find((l) => l.id === selectedLaw)!;
            const Icon = law.icon;
            return (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-xl h-full flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
                    <div className={`p-3 rounded-2xl bg-gradient-to-br ${law.color} text-white`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-mono text-blue-400 font-bold uppercase tracking-wider">
                        Law #{law.id} • {law.latin}
                      </div>
                      <h2 className="text-2xl font-black text-white">{law.name}</h2>
                    </div>
                  </div>

                  <p className="text-slate-300 text-sm leading-relaxed">{law.detail}</p>

                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Enforced System Invariants
                    </h4>
                    <div className="space-y-2">
                      {law.invariants.map((inv, idx) => (
                        <div key={idx} className="flex items-start space-x-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800/80 text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="text-slate-200">{inv}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Code Snippet Box */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mt-6">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-2 border-b border-slate-800 pb-2">
                    <span className="flex items-center space-x-1.5">
                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                      <span>Implementation Enforcement</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase">Active In Core</span>
                  </div>
                  <pre className="text-xs font-mono text-blue-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {law.codeSnippet}
                  </pre>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* End-to-End Control Flow Diagram */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-xl">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">
            The Closed-Loop Execution Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Every payment failure traverses a non-bypassable sequence of safety verification gates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Node 1 */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-2 relative">
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Gate 1: Ingestion</div>
            <div className="text-sm font-bold text-white">Webhook Cryptographic Verification</div>
            <p className="text-slate-400 text-xs">
              Raw body signature verification with HMAC-SHA256. Webhooks with invalid signatures are rejected with 401 Unauthorized before any database writes.
            </p>
            <div className="text-[10px] text-slate-500 font-mono pt-2">Deduplication by event_id</div>
          </div>

          {/* Node 2 */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-2 relative">
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Gate 2: Bounded AI</div>
            <div className="text-sm font-bold text-white">Diagnostic Inference & ERV</div>
            <p className="text-slate-400 text-xs">
              LLM receives structured case context (failure codes, metadata, attempt history). Returns structured JSON diagnosis and recommended action.
            </p>
            <div className="text-[10px] text-purple-400 font-mono pt-2">Zero Payment API Privileges</div>
          </div>

          {/* Node 3 */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-2 relative">
            <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Gate 3: Policy Guard</div>
            <div className="text-sm font-bold text-white">Deterministic Guardrail Engine</div>
            <p className="text-slate-400 text-xs">
              Verifies transaction limits (≤₹25k), opt-out consent status, hard decline codes, and retry caps. Emits strictly ALLOW, BLOCK, or ESCALATE.
            </p>
            <div className="text-[10px] text-amber-400 font-mono pt-2">Fail-Closed Safety Contract</div>
          </div>

          {/* Node 4 */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-2 relative">
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Gate 4: Execution</div>
            <div className="text-sm font-bold text-white">Pre-Flight & Leased Tool Execution</div>
            <p className="text-slate-400 text-xs">
              PreFlightGuard checks obligation status at millisecond of call. Worker atomically leases action with deterministic key, preventing races.
            </p>
            <div className="text-[10px] text-emerald-400 font-mono pt-2">Append-Only Audit Log</div>
          </div>
        </div>
      </div>

      {/* Safety Matrix Table: AI vs Policy Engine */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-xl">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Security Matrix: Bounded AI vs. Deterministic Policy
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Explicit demarcation of responsibilities between generative reasoning and financial safety.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Dimension</th>
                <th className="py-3 px-4 text-purple-400">Generative AI Role (Advisory)</th>
                <th className="py-3 px-4 text-amber-400">Deterministic Policy Engine (Authoritative)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr className="hover:bg-slate-800/20">
                <td className="py-3.5 px-4 font-bold text-white">Failure Diagnosis</td>
                <td className="py-3.5 px-4 text-purple-200">
                  Synthesizes error message, issuer codes, and step into human-readable diagnosis.
                </td>
                <td className="py-3.5 px-4 text-slate-400">
                  Maps raw failure code against hard-decline blacklist (e.g. EXPIRED_CARD, STOLEN_CARD).
                </td>
              </tr>
              <tr className="hover:bg-slate-800/20">
                <td className="py-3.5 px-4 font-bold text-white">Action Recommendation</td>
                <td className="py-3.5 px-4 text-purple-200">
                  Proposes candidate action (RETRY, CREATE_LINK, ALTERNATE_PAYMENT, ESCALATE, STOP).
                </td>
                <td className="py-3.5 px-4 text-slate-400">
                  Enforces allowed action vocabulary and merchant policy whitelists.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/20">
                <td className="py-3.5 px-4 font-bold text-white">Financial Authority</td>
                <td className="py-3.5 px-4 text-rose-400 font-semibold">
                  Zero authority. Never provided payment API credentials.
                </td>
                <td className="py-3.5 px-4 text-emerald-400 font-semibold">
                  Sole authority to approve tool execution or force human operator escalation.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/20">
                <td className="py-3.5 px-4 font-bold text-white">Amount Thresholds</td>
                <td className="py-3.5 px-4 text-purple-200">
                  Estimates Expected Recovery Value (Amount × Recoverability).
                </td>
                <td className="py-3.5 px-4 text-slate-400">
                  Hard cap: Auto-escalates any transaction &gt;₹25,000 to human merchant review.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/20">
                <td className="py-3.5 px-4 font-bold text-white">Customer Protection</td>
                <td className="py-3.5 px-4 text-purple-200">
                  Estimates customer friction score (LOW / MEDIUM / HIGH).
                </td>
                <td className="py-3.5 px-4 text-slate-400">
                  Hard block on opted-out customers; strictly enforces maximum intervention limits.
                </td>
              </tr>
              <tr className="hover:bg-slate-800/20">
                <td className="py-3.5 px-4 font-bold text-white">Prompt Injection Defense</td>
                <td className="py-3.5 px-4 text-purple-200">
                  Trained to ignore customer instruction strings in metadata notes.
                </td>
                <td className="py-3.5 px-4 text-emerald-400 font-semibold">
                  100% immune: Policy engine evaluates rules deterministically in compiled TypeScript.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
