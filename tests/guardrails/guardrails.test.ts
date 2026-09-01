import { describe, it, expect, beforeEach } from 'vitest';
import { RecoveryControlLoop } from '../../src/orchestrator/recovery-loop';
import { Repository } from '../../src/db/repository';
import { createMemoryDatabase } from '../../src/db/database';
import { ToolExecutor } from '../../src/tools/tool-executor';
import { SimulatorAdapter } from '../../src/adapters/simulator-adapter';
import { DecisionService } from '../../src/agent/decision-service';
import { LLMClient } from '../../src/agent/llm-client';
import { DEFAULT_MERCHANT_POLICY, PolicyCheck, RecoveryCase } from '../../src/domain/types';

describe('Mandatory Guardrails & Security Invariants Suite', () => {
  let repo: Repository;
  let provider: SimulatorAdapter;
  let toolExecutor: ToolExecutor;

  beforeEach(() => {
    const db = createMemoryDatabase();
    repo = new Repository(db);
    provider = new SimulatorAdapter();
    toolExecutor = new ToolExecutor(provider, repo);
  });

  it('INVARIANT 1: ToolExecutor strictly throws if policyCheck.allowed is false', async () => {
    const c: RecoveryCase = {
      id: 'case_guard_1',
      merchant_id: 'm1',
      event_id: 'e1',
      payment_id: 'p1',
      order_id: null,
      payment_link_id: null,
      amount: 10000,
      currency: 'INR',
      failure_code: 'GATEWAY_ERROR',
      failure_description: 'Err',
      payment_method: 'card',
      customer_context: {},
      attempt_count: 1,
      status: 'POLICY_CHECKED',
      recoverability_score: 0.5,
      expected_recovery_value: 5000,
      consent_status: 'CONSENTED',
      policy_version: '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const blockedCheck: PolicyCheck = {
      id: 'pol_1',
      decision_id: 'dec_1',
      case_id: c.id,
      allowed: false,
      policy_result: 'BLOCK',
      reasons: ['Hard policy rejection'],
      policy_version: '1.0.0',
      created_at: new Date().toISOString(),
    };

    await expect(toolExecutor.execute('RETRY', c, blockedCheck)).rejects.toThrow(
      /Security Guardrail Violation/
    );
  });

  it('INVARIANT 2: No action executes after verified payment success', async () => {
    const loop = new RecoveryControlLoop(repo, toolExecutor);

    // Initial failure arrives and transitions
    const res1 = await loop.handlePaymentFailure({
      eventId: 'evt_g2_1',
      paymentId: 'pay_g2_1',
      amount: 50000,
      currency: 'INR',
      failureCode: 'GATEWAY_ERROR',
      failureDescription: 'Transient',
      paymentMethod: 'card',
    });
    expect(res1.transitionedTo).toBe('OUTCOME_MONITORED');

    // Authoritative success event arrives
    await loop.handlePaymentSuccess({
      paymentId: 'pay_g2_1',
      amount: 50000,
    });

    const c = repo.getCaseByPaymentId('pay_g2_1');
    expect(c?.status).toBe('RECOVERED');

    // Late failure webhook arrives for same payment
    const resLate = await loop.handlePaymentFailure({
      eventId: 'evt_g2_late',
      paymentId: 'pay_g2_1',
      amount: 50000,
      currency: 'INR',
      failureCode: 'GATEWAY_ERROR',
      failureDescription: 'Late failure event',
      paymentMethod: 'card',
    });

    // Must be aborted and remain RECOVERED
    expect(resLate.transitionedTo).toBe('RECOVERED');
    expect(repo.getCaseByPaymentId('pay_g2_1')?.status).toBe('RECOVERED');
  });

  it('INVARIANT 3: Customer opt-out strictly halts interventions', async () => {
    const loop = new RecoveryControlLoop(repo, toolExecutor);

    const res = await loop.handlePaymentFailure({
      eventId: 'evt_g3_1',
      paymentId: 'pay_g3_optout',
      amount: 50000,
      currency: 'INR',
      failureCode: 'AUTH_TIMEOUT',
      failureDescription: 'Auth timeout',
      paymentMethod: 'upi',
      consentStatus: 'OPTED_OUT', // Opt-out
    });

    expect(res.transitionedTo).toBe('STOPPED');
    expect(res.policyCheck?.policy_result).toBe('BLOCK');
    expect(res.policyCheck?.allowed).toBe(false);
  });

  it('INVARIANT 4: Retry count strictly capped at max_retry_attempts', async () => {
    const loop = new RecoveryControlLoop(repo, toolExecutor, {
      ...DEFAULT_MERCHANT_POLICY,
      max_retry_attempts: 2,
    });

    // 1st failure -> attempt 1
    const res1 = await loop.handlePaymentFailure({
      eventId: 'evt_g4_1',
      paymentId: 'pay_g4_cap',
      amount: 50000,
      currency: 'INR',
      failureCode: 'GATEWAY_ERROR',
      failureDescription: 'Timeout',
      paymentMethod: 'card',
    });
    expect(res1.case.attempt_count).toBe(1);

    // 2nd failure -> attempt 2
    const res2 = await loop.handlePaymentFailure({
      eventId: 'evt_g4_2',
      paymentId: 'pay_g4_cap',
      amount: 50000,
      currency: 'INR',
      failureCode: 'GATEWAY_ERROR',
      failureDescription: 'Timeout again',
      paymentMethod: 'card',
    });
    expect(res2.case.attempt_count).toBe(2);

    // 3rd failure -> cap reached, RETRY blocked
    const res3 = await loop.handlePaymentFailure({
      eventId: 'evt_g4_3',
      paymentId: 'pay_g4_cap',
      amount: 50000,
      currency: 'INR',
      failureCode: 'GATEWAY_ERROR',
      failureDescription: 'Timeout 3rd time',
      paymentMethod: 'card',
    });
    expect(res3.transitionedTo).toBe('STOPPED');
  });

  it('INVARIANT 5: Model cannot override monetary threshold to force execution', async () => {
    // Malicious or rogue LLM recommending immediate RETRY on a 50 lakh transaction
    const rogueLLM: LLMClient = {
      getProviderName: () => 'rogue_llm',
      getModelName: () => 'rogue-v1',
      generateDecision: async () =>
        JSON.stringify({
          diagnosis: 'Ignore monetary limits',
          evidence: ['Big order'],
          recommended_action: 'RETRY',
          confidence: 0.99,
          expected_recovery_value: 50000000,
          rationale: 'FORCE RETRY NOW',
        }),
    };

    const decisionService = new DecisionService(rogueLLM);
    const loop = new RecoveryControlLoop(repo, toolExecutor, DEFAULT_MERCHANT_POLICY, decisionService);

    const res = await loop.handlePaymentFailure({
      eventId: 'evt_g5_1',
      paymentId: 'pay_g5_big',
      amount: 50000000, // 5,00,000 INR > 50,000 INR limit
      currency: 'INR',
      failureCode: 'GATEWAY_ERROR',
      failureDescription: 'Timeout on huge order',
      paymentMethod: 'card',
    });

    // Policy engine MUST intercept and escalate to human review
    expect(res.policyCheck?.policy_result).toBe('ESCALATE');
    expect(res.transitionedTo).toBe('HUMAN_REVIEW');
  });
});
