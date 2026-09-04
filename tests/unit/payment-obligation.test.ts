import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDatabase } from '../../src/db/database';
import { Repository } from '../../src/db/repository';

describe('PaymentObligation Domain Entity & Lifecycle', () => {
  let repo: Repository;

  beforeEach(() => {
    const db = createMemoryDatabase();
    repo = new Repository(db);
  });

  it('creates and persists a new PaymentObligation with integer minor units', () => {
    const obligation = repo.getOrCreateObligation(
      'order_test_1001',
      'merchant_test_1',
      149900, // ₹1,499.00 in paise
      'INR'
    );

    expect(obligation.id).toMatch(/^obl_/);
    expect(obligation.order_id).toBe('order_test_1001');
    expect(obligation.merchant_id).toBe('merchant_test_1');
    expect(obligation.amount_minor).toBe(149900);
    expect(obligation.currency).toBe('INR');
    expect(obligation.status).toBe('OPEN');

    // Retrieve via repository
    const fetched = repo.getObligationById(obligation.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.amount_minor).toBe(149900);
    expect(fetched?.status).toBe('OPEN');
  });

  it('is idempotent: getOrCreateObligation returns existing record for same order_id', () => {
    const first = repo.getOrCreateObligation('order_dup_1', 'merchant_1', 250000, 'INR');
    const second = repo.getOrCreateObligation('order_dup_1', 'merchant_1', 250000, 'INR');

    expect(first.id).toBe(second.id);
    expect(first.created_at).toBe(second.created_at);
  });

  it('transitions status from OPEN to SATISFIED upon full payment', () => {
    const obligation = repo.getOrCreateObligation('order_trans_1', 'merchant_1', 500000, 'INR');
    expect(obligation.status).toBe('OPEN');

    const updated = repo.updateObligationStatus(obligation.id, 'SATISFIED', 'pay_full_1');
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('SATISFIED');
    expect(updated?.satisfied_by_payment_id).toBe('pay_full_1');
    expect(updated?.satisfied_at).not.toBeNull();
  });

  it('transitions status to PARTIALLY_SATISFIED', () => {
    const obligation = repo.getOrCreateObligation('order_partial_1', 'merchant_1', 1000000, 'INR');

    const updated = repo.updateObligationStatus(obligation.id, 'PARTIALLY_SATISFIED', 'pay_part_1');
    expect(updated?.status).toBe('PARTIALLY_SATISFIED');
    expect(updated?.satisfied_by_payment_id).toBe('pay_part_1');
  });

  it('cancels pending recovery actions when obligation is marked SATISFIED', () => {
    const obligation = repo.getOrCreateObligation('order_cancel_actions', 'merchant_1', 300000, 'INR');

    // Create a recovery case
    const recoveryCase = repo.createCase({
      id: 'case_ob_1',
      merchant_id: 'merchant_1',
      event_id: 'evt_1',
      payment_id: 'pay_1',
      order_id: obligation.order_id,
      obligation_id: obligation.id,
      payment_link_id: null,
      amount: 300000,
      currency: 'INR',
      failure_code: 'BAD_REQUEST',
      failure_description: 'Failed attempt',
      payment_method: 'card',
      customer_context: { name: 'Priya Sharma' },
      attempt_count: 1,
      status: 'DIAGNOSED',
      recoverability_score: 0.8,
      expected_recovery_value: 240000,
      consent_status: 'CONSENTED',
      policy_version: '1.0.0',
    });

    // Create a pending recovery action for this obligation
    const action = repo.createRecoveryAction({
      obligation_id: obligation.id,
      case_id: recoveryCase.id,
      action_type: 'CREATE_OR_REUSE_PAYMENT_LINK',
      generation: 1,
      idempotency_key: `idemp_${obligation.id}_CREATE_OR_REUSE_PAYMENT_LINK_gen1`,
      status: 'POLICY_ALLOWED',
    });

    expect(action.status).toBe('POLICY_ALLOWED');

    // Obligation is satisfied out of band
    const cancelledCount = repo.cancelPendingActionsForObligation(
      obligation.id,
      'Obligation satisfied by verified payment'
    );

    expect(cancelledCount).toBe(1);

    const reloadedAction = repo.getRecoveryActionByIdempotencyKey(action.idempotency_key);
    expect(reloadedAction?.status).toBe('CANCELLED');
    expect(reloadedAction?.result?.cancellation_reason).toContain('Obligation satisfied by verified payment');
  });
});
