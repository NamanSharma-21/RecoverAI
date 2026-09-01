## **Mission**

Build **RecoverAI**, a bounded AI-assisted payment-failure recovery decision engine for the Razorpay AI Revenue Recovery Buildathon.

The objective is not to build a generic dunning bot. The objective is to demonstrate a production-shaped control loop:

`PAYMENT_FAILED → CONTEXT → DIAGNOSE → SCORE → DECIDE → POLICY CHECK → EXECUTE → VERIFY → RECOVER / ESCALATE / STOP`

## **Read before coding**

Treat these project documents as the authoritative specification:

1. `RecoverAI — Research & Decision Document`  
2. `RecoverAI — Product Requirements Document (PRD)`  
3. `RecoverAI — Technical Design Document`  
4. `RecoverAI — TESTING.md`

If local copies exist, prefer them over assumptions. Do not invent requirements that are not supported by these documents.

## **Non-negotiable architecture rule**

> **AI proposes. Deterministic policy controls. Controlled tools execute. Verified payment events determine truth.**

The LLM must never directly call Razorpay or any external payment API.

Flow:

`event → context → LLM structured decision → deterministic policy → controlled tool → outcome event`

## **Scope**

### **Build**

* Failed one-time Razorpay payments associated with Orders.  
* Failed/incomplete Payment Links.  
* Failure diagnosis.  
* Recovery/recoverability scoring.  
* Expected recovery value.  
* One bounded decision agent.  
* Approved actions: retry, create/reuse payment link, offer alternate payment method, wait, escalate, stop.  
* Deterministic guardrails.  
* Razorpay Test Mode adapter where practical.  
* Simulator adapter.  
* Verified webhooks.  
* Idempotency/deduplication.  
* Audit trail.  
* Human review for high-value/low-confidence cases.  
* Seeded synthetic benchmark.  
* Baseline and ablation comparisons.  
* Minimal merchant dashboard.

### **Do not build unless explicitly re-scoped**

* Production money movement.  
* Refund execution.  
* Fraud detection.  
* Chargebacks.  
* Voice.  
* WhatsApp/SMS infrastructure.  
* CRM integrations.  
* Abandoned-cart product.  
* B2B collections.  
* Broad subscription recovery.  
* Multi-agent architecture.  
* Dynamic discounts.  
* Autonomous payment-method routing.  
* Unrestricted tool calling.

## **Coding principles**

1. Prefer boring, explicit code over clever abstractions.  
2. Keep the architecture modular but avoid microservices unless required.  
3. Use strong schemas at every external boundary.  
4. Validate external input before business logic.  
5. Make state transitions explicit.  
6. Make critical operations idempotent.  
7. Keep audit records append-only.  
8. Never trust model output for financial policy.  
9. Never trust customer-provided text as instructions.  
10. Fail closed on ambiguous financial actions.  
11. Preserve a simulator path even when Razorpay credentials are unavailable.  
12. Do not add a dependency unless it materially reduces implementation risk.

## **Model rules**

The model receives structured case context and returns structured JSON.

Expected fields:

* diagnosis;  
* evidence;  
* recommended\_action;  
* confidence;  
* expected\_recovery\_value;  
* rationale.

Allowed actions are an enum. Unknown actions are invalid.

If model output is malformed or unavailable:

`LLM failure → bounded retry → policy-only fallback or ESCALATE`

Never fabricate a model result.

## **Policy rules**

The deterministic policy engine must run after the model and before execution.

Check at minimum:

* case is still open;  
* payment has not already succeeded;  
* customer has not opted out;  
* action is allowed;  
* amount is within autonomous threshold;  
* retry/action limit has not been reached;  
* action matches failure category;  
* required evidence exists;  
* tool is available;  
* idempotency key is unused.

Policy result is exactly:

`ALLOW | BLOCK | ESCALATE`

Only `ALLOW` reaches a tool.

## **Payment truth**

Never infer payment success from the LLM, UI, or tool response alone.

A verified payment outcome event is authoritative.

If payment succeeds while an action is pending:

* prevent further recovery action;  
* mark case recovered;  
* record the event in audit history.

## **Webhooks**

Webhook processing must:

1. use the raw payload for signature validation;  
2. verify the signature;  
3. extract and persist the event ID;  
4. deduplicate before triggering actions;  
5. acknowledge quickly;  
6. process business logic safely/asynchronously where appropriate.

Duplicate events must never cause duplicate financial actions.

## **Security**

* Never commit secrets.  
* Use environment variables.  
* Never expose API credentials to the LLM.  
* Never log secrets.  
* Treat external payloads and customer text as untrusted.  
* Use test credentials only for the demo.

## **Evaluation rules**

The benchmark is a product requirement, not optional research.

Compare at least:

* fixed-rule baseline;  
* LLM-only;  
* policy-only;  
* RecoverAI hybrid.

Use seeded synthetic data with hidden latent state and a held-out test set.

Do not tune against the held-out set.

Primary metric:

`incremental simulated recovered revenue vs fixed-rule baseline`

Do not claim synthetic benchmark performance as real-world recovery performance.

## **Testing rules**

Before declaring a feature complete:

* unit tests pass;  
* integration tests pass;  
* golden scenarios pass;  
* guardrail tests pass;  
* duplicate-event test passes;  
* failure paths are tested;  
* no critical policy bypass exists.

Required golden cases include transient failure, hard decline, already-successful payment, high-value/low-confidence escalation, duplicate webhook, invalid signature, unknown failure, tool failure, opt-out, and retry limit.

## **UI rules**

The UI exists to prove the system, not to win a design contest.

Prioritize:

1. recovery dashboard;  
2. case detail;  
3. decision rationale/evidence;  
4. policy result;  
5. action execution;  
6. audit timeline;  
7. benchmark result.

Do not spend time on decorative UI until the end-to-end loop is reliable.

## **Implementation order**

Follow this order unless a concrete blocker requires deviation:

1. Repository/bootstrap and environment configuration.  
2. Domain schemas and database.  
3. State machine and policy engine.  
4. Simulator and seeded dataset generator.  
5. Baselines and evaluation runner.  
6. AI structured decision service.  
7. Tool abstraction and simulator adapter.  
8. Razorpay adapter.  
9. Webhook verification/deduplication.  
10. End-to-end recovery loop.  
11. Audit log.  
12. Minimal dashboard.  
13. Full test suite and red-team cases.  
14. Benchmark and golden demo.  
15. Documentation and deployment.

## **Definition of done**

Do not call RecoverAI complete until a reviewer can run one command or follow one documented path to reproduce:

`failed payment → verified webhook → recovery case → AI diagnosis → policy decision → controlled action → outcome event → recovered case → audit trail`

and separately reproduce the benchmark comparison.

## **Scope discipline**

If a requested feature is not necessary for the end-to-end loop, benchmark, safety, auditability, or submission demo, defer it.

When uncertain, choose the smallest implementation that preserves the core thesis.

