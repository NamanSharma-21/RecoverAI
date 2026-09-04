import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDatabase } from '../../src/db/database';
import { Repository } from '../../src/db/repository';
import { CommunicationLedgerManager } from '../../src/communication/communication-ledger';
import { RecoveryControlLoop } from '../../src/orchestrator/recovery-loop';
import { ToolExecutor } from '../../src/tools/tool-executor';
import { SimulatorAdapter } from '../../src/adapters/simulator-adapter';
import { MerchantPolicyConfig, RecoveryCase, DEFAULT_MERCHANT_POLICY } from '../../src/domain/types';

describe('CommunicationLedger & Real Recovery Path Integration Tests', () => {
  let repo: Repository;
  let commLedger: CommunicationLedgerManager;
  let loop: RecoveryControlLoop;
  const policyConfig: MerchantPolicyConfig = {
    ...DEFAULT_MERCHANT_POLICY,
  };

  beforeEach(() => {
    const db = createMemoryDatabase();
    repo = new Repository(db);
    commLedger = new CommunicationLedgerManager(repo);
    const toolExecutor = new ToolExecutor(repo, new SimulatorAdapter());
    loop = new RecoveryControlLoop(repo, toolExecutor, policyConfig);
  });

  it('allows communication when within policy bounds', () => {
    const mockCase: RecoveryCase = {
      id: 'case_comm_1',
      merchant_id: 'merchant_default',
      obligation_id: 'obl_1',
      event_id: 'evt_1',
      payment_id: 'pay_1',
      amount: 500000,
      currency: 'INR',
      failure_code: 'BAD_REQUEST_ERROR',
      failure_description: 'Card expired',
      payment_method: 'card',
      customer_context: { customer_id: 'cust_1' },
      attempt_count: 0,
      status: 'DECISION_READY',
      recoverability_score: 0.8,
      expected_recovery_value: 400000,
      consent_status: 'CONSENTED',
      policy_version: 'v2.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const check = commLedger.canContactCustomer(mockCase, 'PAYMENT_LINK_PAGE', policyConfig);
    expect(check.canContact).toBe(true);
    expect(check.contactCount).toBe(0);
  });

  it('blocks communication if customer has opted out', () => {
    const mockCase: RecoveryCase = {
      id: 'case_comm_optout',
      merchant_id: 'merchant_default',
      obligation_id: 'obl_optout',
      event_id: 'evt_optout',
      payment_id: 'pay_optout',
      amount: 500000,
      currency: 'INR',
      failure_code: 'BAD_REQUEST_ERROR',
      failure_description: 'Customer opted out',
      payment_method: 'card',
      customer_context: { customer_id: 'cust_optout' },
      attempt_count: 0,
      status: 'DECISION_READY',
      recoverability_score: 0.8,
      expected_recovery_value: 400000,
      consent_status: 'OPTED_OUT',
      policy_version: 'v2.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const check = commLedger.canContactCustomer(mockCase, 'PAYMENT_LINK_PAGE', policyConfig);
    expect(check.canContact).toBe(false);
    expect(check.reason).toContain('opted out');
  });

  it('enforces communication cooldown period (WAIT)', async () => {
    // 1. Ingest initial failure that creates a payment link and dispatches communication
    const result1 = await loop.handlePaymentFailure({
      eventId: 'evt_cool_1',
      paymentId: 'pay_cool_1',
      orderId: 'order_cool_1',
      amount: 150000,
      currency: 'INR',
      failureCode: 'EXPIRED_CARD',
      failureDescription: 'Expired card details',
      paymentMethod: 'card',
      customerContext: { customer_id: 'cust_cool_1', email: 'cool@test.com' },
    });

    expect(result1.case.status).toBe('OUTCOME_MONITORED');
    const commsAfterFirst = repo.getCommunicationsByCaseId(result1.case.id);
    expect(commsAfterFirst.length).toBe(1);
    expect(commsAfterFirst[0].status).toBe('SENT');

    // 2. Immediate second failure on same order/obligation (within cooldown window)
    const result2 = await loop.handlePaymentFailure({
      eventId: 'evt_cool_2',
      paymentId: 'pay_cool_2',
      orderId: 'order_cool_1',
      amount: 150000,
      currency: 'INR',
      failureCode: 'EXPIRED_CARD',
      failureDescription: 'Expired card details',
      paymentMethod: 'card',
      customerContext: { customer_id: 'cust_cool_1', email: 'cool@test.com' },
    });

    // Verify cooldown was enforced: communication was suppressed and WAIT was executed
    expect(result2.message).toContain('cooldown');
    expect(result2.toolResult?.action).toBe('WAIT');

    // Verify audit trail contains COMMUNICATION_SUPPRESSED
    const audits = repo.getAuditEventsByCaseId(result2.case.id);
    const suppressedAudit = audits.find(a => a.event_type === 'COMMUNICATION_SUPPRESSED');
    expect(suppressedAudit).toBeDefined();
    expect((suppressedAudit?.metadata as any).remaining_cooldown_seconds).toBeGreaterThan(0);

    // Verify communication ledger recorded SUPPRESSED
    const allComms = repo.getCommunicationsByCaseId(result2.case.id);
    const suppressedComm = allComms.find(c => c.status === 'SUPPRESSED');
    expect(suppressedComm).toBeDefined();
    expect(suppressedComm?.error_reason).toContain('cooldown');
  });

  it('enforces max contact limit and escalates high-value transactions', async () => {
    // ₹10,000 is within autonomous threshold for initial policy check (< ₹25,000)
    // but above autonomous_limit_inr (₹5,000), so exhausting contact attempts triggers human review escalation.
    const orderAmount = 1000000;
    const orderId = 'order_limit_high_1';

    // Directly seed 2 prior communications to hit the max limit of 2
    repo.getOrCreateObligation(orderId, orderAmount, 'INR');
    const obl = repo.getObligationByOrderId(orderId)!;
    
    // Seed 2 sent comms beyond cooldown
    repo.recordCommunicationAttempt({
      id: 'comm_past_1',
      obligation_id: obl.id,
      case_id: 'case_prior_1',
      channel: 'PAYMENT_LINK_PAGE',
      template: 'STANDARD',
      status: 'SENT',
      sent_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      delivered_at: new Date(Date.now() - 3600000).toISOString(),
      simulated: true,
    });
    repo.recordCommunicationAttempt({
      id: 'comm_past_2',
      obligation_id: obl.id,
      case_id: 'case_prior_2',
      channel: 'PAYMENT_LINK_PAGE',
      template: 'STANDARD',
      status: 'SENT',
      sent_at: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
      delivered_at: new Date(Date.now() - 1800000).toISOString(),
      simulated: true,
    });

    const res = await loop.handlePaymentFailure({
      eventId: 'evt_high_lim_1',
      paymentId: 'pay_high_lim_1',
      orderId,
      amount: orderAmount,
      currency: 'INR',
      failureCode: 'EXPIRED_CARD',
      failureDescription: 'Customer card expired',
      paymentMethod: 'card',
      customerContext: { customer_id: 'cust_vip' },
    });

    // Should be escalated to HUMAN_REVIEW due to contact limit + high value
    expect(res.transitionedTo).toBe('HUMAN_REVIEW');
    expect(res.case.status).toBe('HUMAN_REVIEW');

    const audits = repo.getAuditEventsByCaseId(res.case.id);
    const commSuppressed = audits.find(a => a.event_type === 'COMMUNICATION_SUPPRESSED');
    expect(commSuppressed).toBeDefined();

    const humanReviewTriggered = audits.find(a => a.event_type === 'HUMAN_REVIEW_TRIGGERED');
    expect(humanReviewTriggered).toBeDefined();
  });

  it('enforces max contact limit and stops standard-value transactions', async () => {
    // ₹2,000 is standard value (< ₹5,000)
    const orderAmount = 200000;
    const orderId = 'order_limit_std_1';

    repo.getOrCreateObligation(orderId, orderAmount, 'INR');
    const obl = repo.getObligationByOrderId(orderId)!;
    
    // Seed 2 sent comms beyond cooldown
    repo.recordCommunicationAttempt({
      id: 'comm_past_std_1',
      obligation_id: obl.id,
      case_id: 'case_prior_std_1',
      channel: 'PAYMENT_LINK_PAGE',
      template: 'STANDARD',
      status: 'SENT',
      sent_at: new Date(Date.now() - 3600000).toISOString(),
      delivered_at: new Date(Date.now() - 3600000).toISOString(),
      simulated: true,
    });
    repo.recordCommunicationAttempt({
      id: 'comm_past_std_2',
      obligation_id: obl.id,
      case_id: 'case_prior_std_2',
      channel: 'PAYMENT_LINK_PAGE',
      template: 'STANDARD',
      status: 'SENT',
      sent_at: new Date(Date.now() - 1800000).toISOString(),
      delivered_at: new Date(Date.now() - 1800000).toISOString(),
      simulated: true,
    });

    const res = await loop.handlePaymentFailure({
      eventId: 'evt_std_lim_1',
      paymentId: 'pay_std_lim_1',
      orderId,
      amount: orderAmount,
      currency: 'INR',
      failureCode: 'EXPIRED_CARD',
      failureDescription: 'Customer card expired',
      paymentMethod: 'card',
      customerContext: { customer_id: 'cust_std' },
    });

    // Should transition to STOPPED due to contact limit
    expect(res.transitionedTo).toBe('STOPPED');
    expect(res.case.status).toBe('STOPPED');

    const audits = repo.getAuditEventsByCaseId(res.case.id);
    const commSuppressed = audits.find(a => a.event_type === 'COMMUNICATION_SUPPRESSED');
    expect(commSuppressed).toBeDefined();
  });
});
