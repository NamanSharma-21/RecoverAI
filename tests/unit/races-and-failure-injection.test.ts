import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDatabase } from '../../src/db/database';
import { Repository } from '../../src/db/repository';
import { RecoveryControlLoop } from '../../src/orchestrator/recovery-loop';
import { SimulatorAdapter } from '../../src/adapters/simulator-adapter';
import { WebhookHandler } from '../../src/webhooks/handler';
import { WebhookSignatureVerifier } from '../../src/webhooks/signature';
import { PaymentTruthResolver } from '../../src/truth/payment-truth-resolver';
import { ToolExecutor } from '../../src/tools/tool-executor';

describe('Race Conditions, Concurrency, and Failure Injection', () => {
  let repo: Repository;
  let loop: RecoveryControlLoop;
  let simAdapter: SimulatorAdapter;
  let toolExecutor: ToolExecutor;
  let webhookHandler: WebhookHandler;
  let truthResolver: PaymentTruthResolver;
  const webhookSecret = 'secret_test_race_123';

  beforeEach(() => {
    const db = createMemoryDatabase();
    repo = new Repository(db);
    simAdapter = new SimulatorAdapter();
    toolExecutor = new ToolExecutor(simAdapter, repo);
    loop = new RecoveryControlLoop(repo, toolExecutor);
    truthResolver = new PaymentTruthResolver(repo);
    webhookHandler = new WebhookHandler(repo, loop, webhookSecret);
  });

  it('Race Scenario A: Out-of-band payment capture cancels pending recovery action', async () => {
    const orderId = 'order_race_desktop_1';
    const amount = 349900; // ₹3,499.00
    const obligation = repo.getOrCreateObligation(orderId, 'merchant_test', amount, 'INR');

    // 1. Initial payment failure webhook
    const rawFailPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.failed',
      event_id: 'evt_fail_race_1',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_init',
            order_id: orderId,
            amount: amount,
            currency: 'INR',
            status: 'failed',
            method: 'upi',
            error_code: 'BAD_REQUEST_ERROR',
            error_description: 'Payment failed at bank gateway',
            notes: { customer_name: 'Aditi Rao', consent_status: 'CONSENTED' },
          },
        },
      },
    });

    const failSignature = WebhookSignatureVerifier.generateSignature(rawFailPayload, webhookSecret);
    const failResult = await webhookHandler.handleWebhook(rawFailPayload, failSignature);

    expect(failResult.statusCode).toBe(200);
    expect(failResult.body.status).toBe('ACCEPTED');

    const createdCases = repo.listCases();
    const createdCase = createdCases.find(c => c.order_id === orderId);
    expect(createdCase).toBeDefined();
    const caseId = createdCase!.id;

    // 2. Simulate customer completing payment on desktop before link action is completed
    await truthResolver.resolveFromWebhookCapture(
      obligation.id,
      'pay_success_desktop_99',
      'evt_captured_desktop_99',
      amount,
      'INR'
    );

    // Verify obligation is marked SATISFIED
    const updatedObligation = repo.getObligationById(obligation.id);
    expect(updatedObligation?.status).toBe('SATISFIED');

    // 3. Attempt to run recovery action on the satisfied obligation
    const preFlight = loop.getPreFlightGuard();
    const mockCase = repo.getCaseById(caseId)!;
    const dummyPolicyCheck = {
      case_id: caseId,
      allowed: true,
      policy_result: 'ALLOW' as const,
      reasons: ['Initial allow'],
      failed_checks: [],
      evaluated_at: new Date().toISOString(),
    };
    const guardCheck = await preFlight.evaluate(
      mockCase,
      'SEND_RECOVERY_LINK',
      dummyPolicyCheck,
      { max_retries: 3, max_autonomous_amount: 5000000, cooldown_period_hours: 24, allow_auto_retries: true, hard_declines_never_retry: true }
    );
    expect(guardCheck.passed).toBe(false);
    expect(guardCheck.blockReason).toContain('already SATISFIED');
    expect(guardCheck.checks.obligationOpen).toBe(false);
  });

  it('Race Scenario B: Duplicate webhook replay triggers 0 duplicate financial actions', async () => {
    const orderId = 'order_replay_race';
    const rawPayload = JSON.stringify({
      entity: 'event',
      event: 'payment.failed',
      event_id: 'evt_duplicate_replay_100',
      payload: {
        payment: {
          entity: {
            id: 'pay_replay_test',
            order_id: orderId,
            amount: 149900,
            currency: 'INR',
            status: 'failed',
            method: 'card',
            error_code: 'GATEWAY_ERROR',
            error_description: 'Gateway unavailable',
            notes: { customer_name: 'Deepak' },
          },
        },
      },
    });

    const signature = WebhookSignatureVerifier.generateSignature(rawPayload, webhookSecret);

    // Dispatch identical webhook 5 times sequentially/concurrently
    const results = await Promise.all([
      webhookHandler.handleWebhook(rawPayload, signature),
      webhookHandler.handleWebhook(rawPayload, signature),
      webhookHandler.handleWebhook(rawPayload, signature),
      webhookHandler.handleWebhook(rawPayload, signature),
      webhookHandler.handleWebhook(rawPayload, signature),
    ]);

    // Exactly 1 must be ACCEPTED, the remaining 4 must be DUPLICATE
    const accepted = results.filter(r => r.body.status === 'ACCEPTED');
    const duplicates = results.filter(r => r.body.status === 'DUPLICATE');

    expect(accepted.length).toBe(1);
    expect(duplicates.length).toBe(4);

    // Exactly 1 case should exist in repo
    const cases = repo.listCases();
    const matchingCases = cases.filter(c => c.order_id === orderId);
    expect(matchingCases.length).toBe(1);
  });

  it('Race Scenario C: Concurrent worker leasing prevents double execution', () => {
    const obligation = repo.getOrCreateObligation('order_race_workers', 'merchant_1', 100000, 'INR');
    const parentCase = repo.createCase({
      id: 'case_race_c',
      merchant_id: 'merchant_1',
      event_id: 'evt_race_c',
      payment_id: 'pay_race_c',
      order_id: obligation.order_id,
      obligation_id: obligation.id,
      payment_link_id: null,
      amount: 100000,
      currency: 'INR',
      failure_code: 'GATEWAY_ERROR',
      failure_description: 'Gateway unavailable',
      payment_method: 'card',
      customer_context: { name: 'Test User' },
      attempt_count: 1,
      status: 'DIAGNOSED',
      recoverability_score: 0.8,
      expected_recovery_value: 80000,
      consent_status: 'CONSENTED',
      policy_version: '1.0.0',
    });

    const action = repo.createRecoveryAction({
      obligation_id: obligation.id,
      case_id: parentCase.id,
      action_type: 'RETRY',
      generation: 1,
      idempotency_key: `idemp_${obligation.id}_RETRY_gen1`,
      status: 'POLICY_ALLOWED',
    });

    // 3 parallel worker threads attempt to claim simultaneously
    const claimWorkerA = repo.claimActionForExecution(action.id, 'worker_A');
    const claimWorkerB = repo.claimActionForExecution(action.id, 'worker_B');
    const claimWorkerC = repo.claimActionForExecution(action.id, 'worker_C');

    const successfulClaims = [claimWorkerA, claimWorkerB, claimWorkerC].filter(Boolean);
    expect(successfulClaims.length).toBe(1);

    const reloaded = repo.getRecoveryActionById(action.id);
    expect(reloaded?.status).toBe('CLAIMED');
  });
});
