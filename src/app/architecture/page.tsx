'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Cpu, 
  KeyRound, 
  Layers, 
  Database, 
  Terminal,
  Check
} from 'lucide-react';

export default function ArchitecturePage() {
  const [selectedLaw, setSelectedLaw] = useState<number>(1);

  const laws = [
    {
      id: 1,
      name: 'Separation of Obligation & Attempt',
      latin: 'Lex Obligationis',
      icon: Layers,
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
    <div className="space-y-8 pb-16">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between border-b border-[#ebe8e4] pb-4">
        <div className="flex items-center space-x-3 text-xs">
          <Link href="/" className="text-[#777169] hover:text-[#000000] transition-colors">
            ← Back to Dashboard
          </Link>
          <span className="text-[#ebe8e4]">/</span>
          <span className="text-[#000000] font-normal">Control Architecture</span>
        </div>

        <div className="text-xs text-[#777169]">
          5 Constitutional Principles
        </div>
      </div>

      {/* Header Banner */}
      <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 sm:p-8">
        <h1 className="text-2xl md:text-3xl font-light text-[#000000] tracking-tight">
          Production control architecture
        </h1>
        <p className="text-xs md:text-sm text-[#44403b] mt-1.5 max-w-3xl font-normal leading-relaxed">
          RecoverAI is a bounded, fail-closed financial decision engine designed to operate safely in real payment environments where customer friction, statutory opt-outs, and payment races occur simultaneously.
        </p>
      </div>

      {/* Interactive 5 Laws Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Law Buttons Navigation */}
        <div className="lg:col-span-4 space-y-2.5">
          <h3 className="text-xs font-normal text-[#777169] uppercase tracking-wider px-1">
            Constitutional Principles
          </h3>
          {laws.map((law) => {
            const isSelected = selectedLaw === law.id;
            return (
              <button
                key={law.id}
                onClick={() => setSelectedLaw(law.id)}
                className={`w-full text-left p-4 rounded-[16px] transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#000000] text-[#fdfcfc]'
                    : 'bg-[#f5f3f1] border border-[#ebe8e4] text-[#44403b] hover:bg-[#ebe8e4]'
                }`}
              >
                <div>
                  <div className={`text-[10px] font-mono uppercase ${isSelected ? 'text-[#a59f97]' : 'text-[#777169]'}`}>
                    Law {law.id} • {law.latin}
                  </div>
                  <div className={`text-xs font-medium mt-1 ${isSelected ? 'text-[#fdfcfc]' : 'text-[#000000]'}`}>
                    {law.name}
                  </div>
                  <p className={`text-[11px] mt-1 line-clamp-2 ${isSelected ? 'text-[#ebe8e4]' : 'text-[#777169]'}`}>
                    {law.summary}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Law Details & Code Display */}
        <div className="lg:col-span-8">
          {(() => {
            const law = laws.find((l) => l.id === selectedLaw)!;
            return (
              <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 sm:p-8 space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="border-b border-[#ebe8e4] pb-4">
                    <div className="text-xs font-mono text-[#777169] uppercase tracking-wider">
                      Law #{law.id} • {law.latin}
                    </div>
                    <h2 className="text-xl md:text-2xl font-normal text-[#000000] mt-1">{law.name}</h2>
                  </div>

                  <p className="text-xs md:text-sm text-[#44403b] leading-relaxed font-normal">
                    {law.detail}
                  </p>

                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-normal text-[#777169] uppercase tracking-wider">
                      Enforced System Invariants
                    </h4>
                    <div className="space-y-2">
                      {law.invariants.map((inv, idx) => (
                        <div key={idx} className="flex items-start space-x-2.5 bg-[#fdfcfc] p-3.5 rounded-[12px] border border-[#ebe8e4] text-xs">
                          <Check className="w-3.5 h-3.5 text-[#000000] shrink-0 mt-0.5" />
                          <span className="text-[#44403b]">{inv}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Code Snippet Box */}
                <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-[16px] p-4 mt-6">
                  <div className="flex items-center justify-between text-[11px] text-[#777169] font-mono mb-2 border-b border-[#ebe8e4] pb-2">
                    <span className="flex items-center space-x-1.5">
                      <Terminal className="w-3.5 h-3.5 text-[#000000]" />
                      <span>Implementation Enforcement</span>
                    </span>
                    <span className="text-[10px] text-[#000000] uppercase font-mono">Active in core</span>
                  </div>
                  <pre className="text-xs font-mono text-[#000000] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {law.codeSnippet}
                  </pre>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* End-to-End Control Flow Diagram */}
      <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 sm:p-8 space-y-5">
        <div className="border-b border-[#ebe8e4] pb-4">
          <h2 className="text-lg font-normal text-[#000000] tracking-tight">
            The closed-loop execution pipeline
          </h2>
          <p className="text-xs text-[#777169] mt-0.5">
            Every payment failure traverses a non-bypassable sequence of safety verification gates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Gate 1 */}
          <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-[16px] p-5 space-y-2">
            <div className="text-[10px] font-mono text-[#777169] uppercase">Gate 1: Ingestion</div>
            <div className="text-xs font-medium text-[#000000]">Webhook Cryptographic Verification</div>
            <p className="text-[#777169] text-xs leading-relaxed">
              Raw body signature verification with HMAC-SHA256. Webhooks with invalid signatures are rejected with 401 Unauthorized before database writes.
            </p>
            <div className="text-[10px] text-[#a59f97] font-mono pt-2">Deduplication by event_id</div>
          </div>

          {/* Gate 2 */}
          <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-[16px] p-5 space-y-2">
            <div className="text-[10px] font-mono text-[#777169] uppercase">Gate 2: Bounded AI</div>
            <div className="text-xs font-medium text-[#000000]">Diagnostic Inference & ERV</div>
            <p className="text-[#777169] text-xs leading-relaxed">
              LLM receives structured case context (failure codes, metadata, attempt history). Returns structured JSON diagnosis and recommended action.
            </p>
            <div className="text-[10px] text-[#a59f97] font-mono pt-2">Zero Payment API Privileges</div>
          </div>

          {/* Gate 3 */}
          <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-[16px] p-5 space-y-2">
            <div className="text-[10px] font-mono text-[#777169] uppercase">Gate 3: Policy Guard</div>
            <div className="text-xs font-medium text-[#000000]">Deterministic Guardrail Engine</div>
            <p className="text-[#777169] text-xs leading-relaxed">
              Verifies transaction limits (≤₹25k), opt-out consent status, hard decline codes, and retry caps. Emits strictly ALLOW, BLOCK, or ESCALATE.
            </p>
            <div className="text-[10px] text-[#a59f97] font-mono pt-2">Fail-Closed Safety Contract</div>
          </div>

          {/* Gate 4 */}
          <div className="bg-[#fdfcfc] border border-[#ebe8e4] rounded-[16px] p-5 space-y-2">
            <div className="text-[10px] font-mono text-[#777169] uppercase">Gate 4: Execution</div>
            <div className="text-xs font-medium text-[#000000]">Pre-Flight & Leased Tool Execution</div>
            <p className="text-[#777169] text-xs leading-relaxed">
              PreFlightGuard checks obligation status at millisecond of call. Worker atomically leases action with deterministic key, preventing races.
            </p>
            <div className="text-[10px] text-[#a59f97] font-mono pt-2">Append-Only Audit Log</div>
          </div>
        </div>
      </div>

      {/* Safety Matrix Table: AI vs Policy Engine */}
      <div className="rounded-[20px] bg-[#f5f3f1] border border-[#ebe8e4] p-6 sm:p-8 space-y-5">
        <div className="border-b border-[#ebe8e4] pb-4">
          <h2 className="text-lg font-normal text-[#000000] tracking-tight">
            Security matrix: Bounded AI vs. Deterministic Policy
          </h2>
          <p className="text-xs text-[#777169] mt-0.5">
            Explicit demarcation of responsibilities between generative reasoning and financial safety.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#ebe8e4] text-[#777169] text-[11px] font-normal uppercase tracking-wider">
                <th className="py-3 px-4 font-normal">Dimension</th>
                <th className="py-3 px-4 font-normal">Generative AI Role (Advisory)</th>
                <th className="py-3 px-4 font-normal">Deterministic Policy Engine (Authoritative)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebe8e4]/60 text-[#44403b]">
              <tr className="hover:bg-[#ebe8e4]/30 transition-colors">
                <td className="py-3.5 px-4 font-medium text-[#000000]">Failure Diagnosis</td>
                <td className="py-3.5 px-4">
                  Synthesizes error message, issuer codes, and step into human-readable diagnosis.
                </td>
                <td className="py-3.5 px-4">
                  Maps raw failure code against hard-decline blacklist (e.g. EXPIRED_CARD, STOLEN_CARD).
                </td>
              </tr>
              <tr className="hover:bg-[#ebe8e4]/30 transition-colors">
                <td className="py-3.5 px-4 font-medium text-[#000000]">Action Recommendation</td>
                <td className="py-3.5 px-4">
                  Proposes candidate action (RETRY, CREATE_LINK, ALTERNATE_PAYMENT, ESCALATE, STOP).
                </td>
                <td className="py-3.5 px-4">
                  Enforces allowed action vocabulary and merchant policy whitelists.
                </td>
              </tr>
              <tr className="hover:bg-[#ebe8e4]/30 transition-colors">
                <td className="py-3.5 px-4 font-medium text-[#000000]">Financial Authority</td>
                <td className="py-3.5 px-4 text-[#777169]">
                  Zero authority. Never provided payment API credentials.
                </td>
                <td className="py-3.5 px-4 font-medium text-[#000000]">
                  Sole authority to approve tool execution or force human operator escalation.
                </td>
              </tr>
              <tr className="hover:bg-[#ebe8e4]/30 transition-colors">
                <td className="py-3.5 px-4 font-medium text-[#000000]">Amount Thresholds</td>
                <td className="py-3.5 px-4">
                  Estimates Expected Recovery Value (Amount × Recoverability).
                </td>
                <td className="py-3.5 px-4">
                  Hard cap: Auto-escalates any transaction &gt;₹25,000 to human merchant review.
                </td>
              </tr>
              <tr className="hover:bg-[#ebe8e4]/30 transition-colors">
                <td className="py-3.5 px-4 font-medium text-[#000000]">Customer Protection</td>
                <td className="py-3.5 px-4">
                  Estimates customer friction score (LOW / MEDIUM / HIGH).
                </td>
                <td className="py-3.5 px-4">
                  Hard block on opted-out customers; strictly enforces maximum intervention limits.
                </td>
              </tr>
              <tr className="hover:bg-[#ebe8e4]/30 transition-colors">
                <td className="py-3.5 px-4 font-medium text-[#000000]">Prompt Injection Defense</td>
                <td className="py-3.5 px-4">
                  Trained to ignore customer instruction strings in metadata notes.
                </td>
                <td className="py-3.5 px-4 font-medium text-[#000000]">
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
