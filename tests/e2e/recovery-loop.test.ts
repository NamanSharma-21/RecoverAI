import { describe, it, expect, beforeEach } from 'vitest';
import { RecoveryControlLoop } from '../../src/orchestrator/recovery-loop';
import { Repository } from '../../src/db/repository';
import { createMemoryDatabase } from '../../src/db/database';
import { ToolExecutor } from '../../src/tools/tool-executor';
import { SimulatorAdapter } from '../../src/adapters/simulator-adapter';

describe('End-to-End Complete Recovery Control Loop Tests', () => {
  let repo: Repository;
  let loop: RecoveryControlLoop;

  beforeEach(() => {
    const db = createMemoryDatabase();
    repo = new Repository(db);
    const provider = new SimulatorAdapter();
    const toolExecutor = new ToolExecutor(provider, repo);
    loop = new RecoveryControlLoop(repo, toolExecutor);
  });

  it('runs complete loop: failure -> diagnosis -> policy -> tool -> success event -> recovered', async () => {
    // 1. Ingest initial failure
    const failureRes = await loop.handlePaymentFailure({
      eventId: 'evt_e2e_01',
      paymentId: 'pay_e2e_01',
      orderId: 'order_e2e_01',
      amount: 499900, // ₹4,999.00
      currency: 'INR',
      failureCode: 'GATEWAY_ERROR',
      failureDescription: 'Transient connection timeout at acquiring gateway',
      paymentMethod: 'card',
      customerContext: {
        customer_id: 'cust_e2e_01',
        email: 'riya.sen@example.com',
        historical_success_rate: 0.92,
        total_prior_transactions: 14,
      },
    });

    expect(failureRes.case.status).toBe('OUTCOME_MONITORED');
    expect(failureRes.decision?.recommended_action).toBe('RETRY');
    expect(failureRes.policyCheck?.allowed).toBe(true);

    const initialAudit = repo.getAuditEventsByCaseId(failureRes.case.id);
    expect(initialAudit.map((a) => a.event_type)).toEqual([
      'CASE_CREATED',
      'CONTEXT_BUILT',
      'AI_DECISION_PRODUCED',
      'POLICY_EVALUATED',
      'TOOL_EXECUTION_ATTEMPTED',
      'TOOL_EXECUTION_COMPLETED',
    ]);

    // 2. Verified success arrives from webhook
    const successRes = await loop.handlePaymentSuccess({
      paymentId: 'pay_e2e_01',
      orderId: 'order_e2e_01',
      amount: 499900,
    });

    expect(successRes.recovered).toBe(true);
    expect(successRes.case?.status).toBe('RECOVERED');

    // 3. Verify final audit trail
    const finalAudit = repo.getAuditEventsByCaseId(failureRes.case.id);
    expect(finalAudit.some((a) => a.event_type === 'CASE_RECOVERED')).toBe(true);
  });

  it('handles operator human review: escalate -> human approve -> action execute -> outcome', async () => {
    // 1. High value failure arrives
    const failureRes = await loop.handlePaymentFailure({
      eventId: 'evt_e2e_highval',
      paymentId: 'pay_e2e_highval',
      orderId: 'order_e2e_highval',
      amount: 9500000, // ₹95,000.00 > ₹50,000 threshold
      currency: 'INR',
      failureCode: 'GATEWAY_ERROR',
      failureDescription: 'High value corporate payment timeout',
      paymentMethod: 'netbanking',
    });

    expect(failureRes.transitionedTo).toBe('HUMAN_REVIEW');
    expect(failureRes.case.status).toBe('HUMAN_REVIEW');

    // 2. Human operator inspects and approves
    const reviewRes = await loop.handleHumanReview(failureRes.case.id, {
      action: 'APPROVE',
      operator_notes: 'Verified enterprise account balance with client manager. Approved retry.',
      operator_id: 'ops_senior_naman',
    });

    expect(reviewRes.transitionedTo).toBe('OUTCOME_MONITORED');
    expect(reviewRes.case.status).toBe('OUTCOME_MONITORED');

    const auditTrail = repo.getAuditEventsByCaseId(failureRes.case.id);
    expect(auditTrail.some((a) => a.event_type === 'HUMAN_ACTION_TAKEN')).toBe(true);
  });
});
