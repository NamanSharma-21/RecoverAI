import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDatabase } from '../../src/db/database';
import { Repository } from '../../src/db/repository';
import { PaymentTruthResolver, PaymentTruthCandidate } from '../../src/truth/payment-truth-resolver';
import { RecoveryCase } from '../../src/domain/types';

describe('PaymentTruthResolver & Authority Precedence', () => {
  let repo: Repository;
  let resolver: PaymentTruthResolver;

  beforeEach(() => {
    const db = createMemoryDatabase();
    repo = new Repository(db);
    resolver = new PaymentTruthResolver(repo);
  });

  it('strictly enforces source authority precedence hierarchy', () => {
    // 5 candidates from different sources
    const candidates: PaymentTruthCandidate[] = [
      {
        source: 'UI_STATE',
        status: 'UNPAID',
        captured: false,
        amount_captured_minor: 0,
        currency: 'INR',
        confidence: 0.1,
        observed_at: new Date().toISOString(),
      },
      {
        source: 'LLM_PROPOSAL',
        status: 'PAID',
        captured: true,
        amount_captured_minor: 50000,
        currency: 'INR',
        confidence: 0.99, // High LLM confidence should NEVER override lower-tier authority
        observed_at: new Date().toISOString(),
      },
      {
        source: 'PERSISTED_STATE',
        status: 'PARTIALLY_PAID',
        captured: false,
        amount_captured_minor: 25000,
        currency: 'INR',
        confidence: 0.8,
        observed_at: new Date().toISOString(),
      },
      {
        source: 'PROVIDER_QUERY',
        status: 'PAID',
        captured: true,
        amount_captured_minor: 50000,
        currency: 'INR',
        confidence: 0.95,
        observed_at: new Date().toISOString(),
      },
      {
        source: 'AUTHORITATIVE_EVENT',
        status: 'PAID',
        captured: true,
        amount_captured_minor: 50000,
        currency: 'INR',
        confidence: 1.0,
        observed_at: new Date().toISOString(),
      },
    ];

    const result = resolver.resolveTruth('ob_test', candidates);
    // AUTHORITATIVE_EVENT has precedence rank 5 (highest)
    expect(result.source).toBe('AUTHORITATIVE_EVENT');
    expect(result.is_authoritative).toBe(true);
    expect(result.status).toBe('PAID');
    expect(result.captured).toBe(true);
  });

  it('rejects LLM or UI claims when provider or persisted evidence conflicts', () => {
    // LLM claims user paid, but persisted state says UNPAID
    const candidates: PaymentTruthCandidate[] = [
      {
        source: 'LLM_PROPOSAL',
        status: 'PAID',
        captured: true,
        amount_captured_minor: 10000,
        currency: 'INR',
        confidence: 0.95,
        observed_at: new Date().toISOString(),
      },
      {
        source: 'PERSISTED_STATE',
        status: 'UNPAID',
        captured: false,
        amount_captured_minor: 0,
        currency: 'INR',
        confidence: 0.8,
        observed_at: new Date().toISOString(),
      },
    ];

    const result = resolver.resolveTruth('ob_test', candidates);
    // PERSISTED_STATE has higher rank than LLM_PROPOSAL
    expect(result.source).toBe('PERSISTED_STATE');
    expect(result.status).toBe('UNPAID');
    expect(result.captured).toBe(false);
  });

  it('resolveFromWebhookCapture satisfies obligation and cancels pending recovery actions', async () => {
    const obligation = repo.getOrCreateObligation('order_capture_1', 'merchant_1', 49900, 'INR');

    const recoveryCase: RecoveryCase = repo.createCase({
      id: 'case_truth_1',
      merchant_id: 'merchant_1',
      event_id: 'evt_fail_1',
      payment_id: 'pay_fail_1',
      order_id: obligation.order_id,
      obligation_id: obligation.id,
      payment_link_id: null,
      amount: 49900,
      currency: 'INR',
      failure_code: 'BAD_REQUEST',
      failure_description: 'Transient drop',
      payment_method: 'upi',
      customer_context: { name: 'Aarav Patel' },
      attempt_count: 1,
      status: 'DIAGNOSED',
      recoverability_score: 0.8,
      expected_recovery_value: 39920,
      consent_status: 'CONSENTED',
      policy_version: '1.0.0',
    });

    // An automated recovery action was allowed and scheduled
    const action = repo.createRecoveryAction({
      obligation_id: obligation.id,
      case_id: recoveryCase.id,
      action_type: 'SEND_RECOVERY_LINK',
      generation: 1,
      idempotency_key: `idemp_${obligation.id}_SEND_RECOVERY_LINK_gen1`,
      status: 'POLICY_ALLOWED',
    });

    // Customer completes payment on their own or via alternate link!
    const resolution = await resolver.resolveFromWebhookCapture(
      obligation.id,
      'pay_success_999',
      'evt_captured_999',
      49900,
      'INR'
    );

    expect(resolution.is_authoritative).toBe(true);
    expect(resolution.status).toBe('PAID');
    expect(resolution.captured).toBe(true);
    expect(resolution.payment_id).toBe('pay_success_999');

    // Verify obligation transitioned to SATISFIED
    const updatedObligation = repo.getObligationById(obligation.id);
    expect(updatedObligation?.status).toBe('SATISFIED');
    expect(updatedObligation?.amount_minor).toBe(49900);

    // Verify pending action was automatically cancelled
    const updatedAction = repo.getRecoveryActionByIdempotencyKey(action.idempotency_key);
    expect(updatedAction?.status).toBe('CANCELLED');
    expect(updatedAction?.result?.cancellation_reason).toContain('Payment satisfied via pay_success_999');

    // Verify audit event recorded
    const auditEvents = repo.getAuditEventsByCaseId(recoveryCase.id);
    const satisfiedEvent = auditEvents.find(e => e.event_type === 'OBLIGATION_SATISFIED');
    expect(satisfiedEvent).toBeDefined();
    expect(satisfiedEvent?.actor).toBe('PAYMENT_GATEWAY');
  });
});
