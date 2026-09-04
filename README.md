# RecoverAI 2.0 — Production-Hardened Payment Recovery Control Plane

> **Submission for the Razorpay AI Revenue Recovery Buildathon**  
> *Track: AI Revenue Recovery*  
> *Documentation*: See [PRODUCTION_READINESS_REPORT.md](docs/PRODUCTION_READINESS_REPORT.md) for full architecture audit & verification report.

---

## 1. Product Thesis

RecoverAI is a bounded payment recovery control plane that diagnoses failed payment attempts, determines whether recovery is safe and economically rational, and executes policy-compliant interventions across orders and payment links.

RecoverAI is **not** a generic dunning bot or an unconstrained LLM agent. It implements a closed, production-shaped control loop:

```
PAYMENT_FAILED → CONTEXT → DIAGNOSE → SCORE → DECIDE → POLICY CHECK → PRE-FLIGHT GUARD → LEASED EXECUTION → VERIFY → RECOVER / ESCALATE / STOP
```

### Core Architecture Law
> **AI proposes. Deterministic policy controls. Controlled tools execute. Verified payment events determine truth.**

The LLM is strictly constrained:
- The model receives structured, sanitized context (customer notes and raw failure descriptions are treated as **untrusted data evidence**, never system instructions).
- The model outputs typed JSON containing `{ diagnosis, evidence, recommended_action, confidence, expected_recovery_value, customer_friction, rationale }`.
- The **deterministic policy engine** executes *after* the model and *before* execution.
- Only policy `ALLOW` reaches a controlled tool.
- Verified Razorpay / Simulator payment events (`payment.captured`, `payment_link.paid`) determine authoritative truth. If a payment succeeds while an action is pending, further recovery is aborted immediately.

---

## 2. The 5 Laws of RecoverAI

| Law | Principle | Production Mechanism |
| :--- | :--- | :--- |
| **Law 1: Obligation vs Attempt** | *Lex Obligationis* | Commercial orders map to persistent `PaymentObligation` records. Payment attempts and links are ephemeral and replaceable. When an obligation is satisfied, all pending recovery actions are automatically cancelled. |
| **Law 2: Source Precedence of Truth** | *Lex Veritatis* | Payment truth strictly follows: `AUTHORITATIVE_EVENT (Razorpay Webhook) > PROVIDER_QUERY (API Poll) > PERSISTED_STATE (Local DB) > LLM (Ignored) > UI (Ignored)`. Cryptographic HMAC-SHA256 signatures are required. |
| **Law 3: AI Proposes, Policy Controls** | *Lex Moderationis* | Generative models have 0 payment API rights. Every recommendation must clear 9 deterministic checks. Even human operator actions follow `AI → HUMAN → POLICY → TOOL`. |
| **Law 4: Generated & Leased Idempotency** | *Lex Repetitionis* | Idempotency keys are computed deterministically: `idemp_${obligationId}_${action}_gen${generation}`. Background workers must acquire an atomic conditional SQLite lease before execution. |
| **Law 5: Pre-Flight Guard & Friction Boundaries** | *Lex Praeventionis* | PreFlightGuard evaluates live state at the millisecond of tool invocation. Rejects stale decisions (>5m) and enforces statutory customer cooling-off periods. |

---

## 3. Mathematical Money Representation & Financial Bounds

All monetary calculations in RecoverAI are strictly represented as **safe minor integer units** (paise for INR):
- **No Floating Point**: Amounts are stored and computed as integers (`paise: number = Math.round(inr * 100)`).
- **Negative Amount Rejection**: Schema and domain reject any amount ≤ 0.
- **Minimum Transaction Cap**: ₹1.00 minimum transaction floor (100 paise).
- **Autonomous Threshold Cap**: Maximum autonomous recovery cap at ₹25,000.00 (2,500,000 paise). Higher-value transactions require merchant human review (`ESCALATE`).
- **Absolute System Ceiling**: ₹50,000.00 (5,000,000 paise) absolute ceiling.

---

## 4. Approved Action Vocabulary

RecoverAI operates over a closed set of 6 approved recovery actions:

| Action | Description | Permitted Trigger |
| :--- | :--- | :--- |
| `RETRY` | Automated gateway retry with exponential backoff | Transient network timeouts, bank server downtime |
| `CREATE_OR_REUSE_PAYMENT_LINK` | Sends prefilled payment link directly to customer | 3DS OTP dropouts, customer session timeouts |
| `OFFER_ALTERNATE_PAYMENT_METHOD` | Generates multi-rail link (UPI, Netbanking, Alternate card) | Insufficient balance, card expired, card blocked |
| `WAIT` | Enters timed backoff window before re-verifying | Temporary outage resolution |
| `ESCALATE` | Routes transaction to human merchant operator | Transactions > ₹25,000 threshold, confidence < 65% |
| `STOP` | Halts recovery operations and closes case | Customer opted out, max retries reached, hard stop |

---

## 5. Execution Commands

### Prerequisites
- Node.js v20+ (Node v26 verified)
- npm / pnpm / yarn

### Run Full Test Pyramid (60 Tests across 13 Suites)
```bash
npm test
```
*Individual Test Suites:*
- `tests/unit/payment-obligation.test.ts` — Commercial obligation lifecycle & auto-cancellation
- `tests/unit/money-representation.test.ts` — Safe integer minor units & financial bounds
- `tests/unit/payment-truth.test.ts` — Source precedence hierarchy & webhook truth
- `tests/unit/action-idempotency.test.ts` — Deterministic generation keys & atomic worker leasing
- `tests/unit/human-review-guardrails.test.ts` — Policy enforcement on human operator overrides
- `tests/unit/races-and-failure-injection.test.ts` — Out-of-band payment races & tool failures
- `tests/unit/policy-engine.test.ts` — 9 deterministic policy guardrail checks
- `tests/unit/state-machine.test.ts` — Explicit case state machine transitions
- `tests/guardrails/guardrails.test.ts` — Hard invariant guardrails
- `tests/integration/webhook.test.ts` — HMAC-SHA256 signatures & duplicate webhook deduplication
- `tests/redteam/red-team.test.ts` — Prompt injection defense & hostile failure modes
- `tests/golden/golden-scenarios.test.ts` — 10 authoritative golden fixtures
- `tests/e2e/recovery-loop.test.ts` — Full closed control loop integration

### Run Seeded 5,000-Case Benchmark (CLI)
```bash
npm run benchmark
```

### Run 10 Golden Scenarios Demo (CLI)
```bash
npm run golden-demo
```

### Start Web Application (Merchant Dashboard)
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Empirical Benchmark Results (5,000 Cases)

Evaluated over 5,000 seeded synthetic cases with hidden latent ground truth (2,500 held-out test split, seed=42) using **Net Recovery Value (NRV)**:

$$\text{NRV} = \text{Recovered Revenue} - \text{Comm Cost} - \text{Retry Cost} - \text{Friction Cost} - \text{Review Cost} - \text{Safety Penalties}$$

| Strategy | Gross Recovered (₹) | Total Costs (₹) | Safety Fines (₹) | Net Recovered (₹) | Net Recovery % | Policy Violations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `naive_baseline` | ₹4,47,95,366 | ₹8,500 | ₹1,24,300 | ₹4,46,62,566 | 77.30% | 700 violations |
| `fixed_rule_baseline` | ₹4,67,08,250 | ₹11,211 | ₹0 | ₹4,66,97,039 | 80.82% | 0 violations |
| `llm_only` | ₹4,68,99,220 | ₹62,890 | **₹94,000** | ₹4,67,42,330 | 80.90% | **94 breaches** |
| `policy_only` | ₹15,47,467 | ₹1,548 | ₹0 | ₹15,45,919 | 2.68% | 0 violations |
| **`recoverai_hybrid`** | **₹4,68,99,220** | ₹1,24,248 | **₹0** | **₹4,67,74,972** | **80.95%** | **0 violations ✓** |

### Benchmark Finding:
- **LLM-Only (No Guardrails)** achieves high gross recovery but commits **94 critical safety violations** (retrying hard declines, contacting opted-out users), resulting in **₹94,000 in penalties** and lower Net Recovery Value than the hybrid system.
- **RecoverAI Hybrid** achieves **₹4,67,74,972 Net Recovery Value** (+₹77,932.21 incremental net gain over fixed rules) while maintaining **0 policy violations**.

---

## 7. Merchant Dashboard & Verification Studio

- **`/`**: Recovery Dashboard with live recovery opportunity queue, status filters, and one-click recovery triggers.
- **`/cases/[id]`**: Transparent Case Detail displaying:
  - Persistent `obligation_id` and generation counter.
  - Payment Truth source precedence hierarchy status.
  - **"Why Did We Act?"** / **"Why Did We NOT Act?"** explainability cards.
  - Controlled action worker lease table & customer communication ledger.
- **`/architecture`**: The 5 Laws of RecoverAI with interactive invariant explorer, code implementation snippets, and closed-loop execution diagrams.
- **`/demo`**: Golden Demo & Red Team Studio:
  - Story A: Autonomous recovery of transient gateway timeout (₹4,999).
  - Story B: Policy escalation of high-value order (₹1,20,000).
  - 4 interactive Red Team attacks (Prompt injection, expired card retry, opt-out bypass, out-of-band payment race).
  - 10 golden scenario fixtures with live control loop tracer.
- **`/benchmark`**: 5,000-case synthetic benchmark studio with Net Recovery Value comparisons and latent model transparency.

---

## 8. Definition of Done Checklist

- [x] Commercial `PaymentObligation` model separated from ephemeral attempts
- [x] Explicit `PaymentTruthResolver` with 5-tier source precedence hierarchy
- [x] Safe minor integer currency representation (paise, no floats, bounds checked)
- [x] Deterministic action idempotency keys with atomic SQLite worker leases
- [x] Human review guardrails (`AI → HUMAN → POLICY → TOOL`)
- [x] Action-sensitive latent customer simulation with Net Recovery Value
- [x] 100% duplicate webhook suppression guarantee (HMAC-SHA256 verified)
- [x] Pre-Flight Guard intercepting out-of-band payments at execution time
- [x] 60 passing tests across 13 test suites (100% pass rate)
- [x] Next.js production build passing without errors or warnings
- [x] Explainability views ("Why Did We Act?" / "Why Did We NOT Act?")
- [x] Red Team adversarial attack lab and interactive architecture explorer
- [x] Zero secrets committed; complete `.env.example` provided
- [x] Comprehensive documentation in `docs/PRODUCTION_READINESS_REPORT.md`
