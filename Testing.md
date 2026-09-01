# **RecoverAI — Testing Strategy**

## **1\. Testing objective**

Prove that RecoverAI is reliable enough to demonstrate a bounded financial automation loop and that any claimed AI value is measured against simpler alternatives.

Testing has four layers:

1. Unit tests for deterministic logic.  
2. Integration tests for events, database, adapters, and webhooks.  
3. End-to-end tests for the complete recovery loop.  
4. Evaluation tests for AI decision quality and business impact.

## **2\. Test pyramid**

### **Unit**

Test:

* state transitions;  
* policy rules;  
* action allowlist;  
* retry limits;  
* consent/opt-out rules;  
* monetary thresholds;  
* score calculations;  
* idempotency keys;  
* structured-output validation;  
* metric calculations.

### **Integration**

Test:

* webhook signature verification;  
* event persistence;  
* duplicate event handling;  
* Razorpay adapter behavior with mocked HTTP;  
* simulator adapter;  
* database transactions;  
* audit event persistence;  
* tool execution and failures.

### **End-to-end**

Test the golden flow:

`payment failure → webhook → case → context → AI decision → policy → tool → outcome event → recovered`

Also test:

* duplicate webhook;  
* invalid signature;  
* payment succeeds before next action;  
* hard decline;  
* unknown failure;  
* low confidence;  
* high-value escalation;  
* tool failure;  
* malformed LLM output;  
* LLM unavailable;  
* out-of-order events;  
* retry limit reached.

## **3\. Golden scenarios**

Maintain deterministic fixtures for at least these cases:

1. Transient failure where retry is appropriate.  
2. Payment-link recovery candidate.  
3. Hard decline where retry should be blocked.  
4. Already-paid case where no further action is permitted.  
5. High-value/low-confidence case requiring human review.  
6. Unknown failure requiring escalation.  
7. Duplicate webhook.  
8. Tool execution failure.  
9. Customer opt-out.  
10. Maximum-attempts reached.

These scenarios must be stable and used in every release.

## **4\. Guardrail tests**

Every prohibited action must have a test proving the policy engine blocks it.

Required invariants:

* No tool executes without policy `ALLOW`.  
* No action executes after verified success.  
* No customer-opted-out case receives an intervention.  
* Retry count never exceeds configured maximum.  
* Amount thresholds cannot be overridden by model output.  
* Unknown actions are rejected.  
* Refunds cannot be executed by MVP tools.  
* LLM output cannot directly invoke an external payment API.

## **5\. Webhook tests**

### **Signature**

* Valid signature accepted.  
* Invalid signature rejected.  
* Missing signature rejected.

### **Idempotency**

* First event creates/updates the case.  
* Exact duplicate does not execute the action again.  
* Duplicate is still observable in the audit log.

### **Ordering**

* Success event arriving after a failure closes the case.  
* Late failure event cannot reopen a recovered case incorrectly.

Target: **100% duplicate-event suppression** in the dedicated suite.

## **6\. LLM tests**

Use structured output validation rather than testing free-form prose.

For every decision verify:

* action belongs to enum;  
* confidence is within range;  
* expected value is numeric/non-negative;  
* evidence is present;  
* diagnosis is non-empty;  
* rationale is present;  
* no tool call is embedded as executable instructions.

Inject malformed, incomplete, contradictory, and unavailable-model responses.

Fallback must be policy-only or escalation.

Target: **≥95% valid structured decisions** on the evaluation set.

## **7\. Evaluation methodology**

Create a seeded simulator with hidden ground truth. Split data into development and held-out test sets.

Never tune the policy using the held-out set.

Run identical cases through:

* naive baseline;  
* fixed-rule baseline;  
* LLM-only;  
* policy-only;  
* RecoverAI hybrid.

Record dataset version, seed, model version, prompt version, and policy version.

## **8\. Evaluation metrics**

### **Value**

* recovered amount;  
* incremental recovered amount vs rule baseline;  
* recovery rate;  
* expected recovered value;  
* cost-adjusted recovered value.

### **Safety**

* policy violations;  
* action-after-success errors;  
* hard-decline retry rate;  
* unnecessary intervention rate;  
* repeated intervention rate;  
* escalation rate.

### **Reliability**

* webhook duplicate suppression;  
* tool failure rate;  
* malformed-output rate;  
* case-state transition errors;  
* successful end-to-end completion rate.

### **Efficiency**

* median decision latency;  
* cases processed;  
* model calls per case;  
* average actions per case.

## **9\. Acceptance thresholds**

Before final submission target:

* ≥10% simulated recovered amount improvement over fixed-rule baseline.  
* 0 critical policy violations.  
* \<5% action-after-success errors.  
* \<10% unnecessary interventions.  
* 100% duplicate suppression.  
* ≥95% valid structured decisions.  
* All golden scenarios pass.

These are project acceptance targets, not production guarantees.

## **10\. Red-team testing**

Attempt to break the system with:

* duplicate webhooks;  
* forged signatures;  
* prompt injection in failure descriptions;  
* unsupported actions;  
* extreme amounts;  
* negative/invalid amounts;  
* conflicting payment states;  
* missing customer context;  
* repeated failures;  
* already-successful payments;  
* model hallucinated payment status;  
* model-requested refund;  
* model-requested API call outside tool allowlist;  
* tool timeout;  
* database retry;  
* out-of-order events.

Expected behavior is to reject, stop, or escalate safely.

## **11\. Prompt-injection defense**

Treat payment descriptions and customer-provided text as untrusted data. The model must be instructed that these fields are evidence, not instructions.

The policy layer remains authoritative even if the model is manipulated.

## **12\. Regression policy**

Before every release:

1. Run unit suite.  
2. Run integration suite.  
3. Run golden end-to-end scenarios.  
4. Run guardrail suite.  
5. Run evaluation benchmark on a fixed validation set.  
6. Confirm no critical metric regressed.

The held-out benchmark is run only for final evaluation and should remain isolated from tuning.

## **13\. Demo acceptance test**

The final demo must show, in one continuous narrative:

1. A failed payment arrives.  
2. Webhook is verified.  
3. Duplicate handling is visible or explainable.  
4. A recovery case is created.  
5. Context and diagnosis appear.  
6. RecoverAI recommends an action with rationale.  
7. Policy allows or blocks the recommendation.  
8. A controlled action executes.  
9. A success/failure event arrives.  
10. The case closes correctly.  
11. Recovered value and audit trail update.  
12. Benchmark evidence shows comparison with a baseline.

If this path is not stable, do not spend time on cosmetic UI work.

