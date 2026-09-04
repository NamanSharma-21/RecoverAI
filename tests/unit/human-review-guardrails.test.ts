import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDatabase } from '../../src/db/database';
import { Repository } from '../../src/db/repository';
import { RecoveryControlLoop } from '../../src/orchestrator/recovery-loop';
import { SimulatorAdapter } from '../../src/adapters/simulator-adapter';
import { ToolExecutor } from '../../src/tools/tool-executor';

describe('Human Review Guardrails & Policy Enforcement', () => {
  let repo: Repository;
  let loop: RecoveryControlLoop;

  beforeEach(() => {
    const db = createMemoryDatabase();
    repo = new Repository(db);
    const simAdapter = new SimulatorAdapter();
    const toolExecutor = new ToolExecutor(simAdapter, repo);
    loop = new RecoveryControlLoop(repo, toolExecutor);
  });

  it('blocks human operator from executing action on an OPTED_OUT customer (AI -> HUMAN -> POLICY -> TOOL)', async () => {
    const obligation = repo.getOrCreateObligation('order_optout_human', 'merchant_1', 150000, 'INR');
    const recoveryCase = repo.createCase({
      id: 'case_optout_human',
      merchant_id: 'merchant_1',
      event_id: 'evt_optout_1',
      payment_id: 'pay_optout_1',
      order_id: obligation.order_id,
      obligation_id: obligation.id,
      payment_link_id: null,
      amount: 150000,
      currency: 'INR',
      failure_code: 'BAD_REQUEST',
      failure_description: 'Failed attempt',
      payment_method: 'card',
      customer_context: { name: 'Customer X' },
      attempt_count: 1,
      status: 'HUMAN_REVIEW', // Case was escalated for operator review
      recoverability_score: 0.9,
      expected_recovery_value: 135000,
      consent_status: 'OPTED_OUT', // Customer revoked consent!
      policy_version: '1.0.0',
    });

    // Human operator attempts to override and approve sending a recovery link
    await expect(
      loop.handleHumanReview(recoveryCase.id, {
        action: 'OVERRIDE',
        override_action: 'CREATE_OR_REUSE_PAYMENT_LINK',
        operator_notes: 'Operator overriding to recover payment',
        operator_id: 'op_naman',
      })
    ).rejects.toThrow(/Policy Guardrail Rejection.*Customer has opted out/);

    // Verify policy check record logged with allowed=false
    const policyChecks = repo.getPolicyChecksByCaseId(recoveryCase.id);
    expect(policyChecks.length).toBeGreaterThan(0);
    const lastCheck = policyChecks[policyChecks.length - 1];
    expect(lastCheck.allowed).toBe(false);
    expect(lastCheck.policy_result).toBe('BLOCK');
    expect(lastCheck.reasons.some((r) => r.toLowerCase().includes('opted out'))).toBe(true);
  });

  it('blocks human operator from retrying a hard-declined payment instrument', async () => {
    const obligation = repo.getOrCreateObligation('order_hard_human', 'merchant_1', 250000, 'INR');
    const recoveryCase = repo.createCase({
      id: 'case_hard_human',
      merchant_id: 'merchant_1',
      event_id: 'evt_hard_1',
      payment_id: 'pay_hard_1',
      order_id: obligation.order_id,
      obligation_id: obligation.id,
      payment_link_id: null,
      amount: 250000,
      currency: 'INR',
      failure_code: 'EXPIRED_CARD',
      failure_description: 'Card has expired',
      payment_method: 'card',
      customer_context: { name: 'Customer Y' },
      attempt_count: 1,
      status: 'HUMAN_REVIEW',
      recoverability_score: 0.5,
      expected_recovery_value: 125000,
      consent_status: 'CONSENTED',
      policy_version: '1.0.0',
    });

    // Operator mistakenly tries to execute a direct RETRY on an expired card
    await expect(
      loop.handleHumanReview(recoveryCase.id, {
        action: 'OVERRIDE',
        override_action: 'RETRY',
        operator_notes: 'Operator tried direct retry',
        operator_id: 'op_naman',
      })
    ).rejects.toThrow(/Policy Guardrail Rejection.*hard decline/);

    const policyChecks = repo.getPolicyChecksByCaseId(recoveryCase.id);
    const lastCheck = policyChecks[policyChecks.length - 1];
    expect(lastCheck.allowed).toBe(false);
    expect(lastCheck.reasons.some((r) => r.toLowerCase().includes('hard decline'))).toBe(true);
  });

  it('blocks human operator action if obligation was already satisfied out of band', async () => {
    const obligation = repo.getOrCreateObligation('order_sat_human', 'merchant_1', 350000, 'INR');
    const recoveryCase = repo.createCase({
      id: 'case_sat_human',
      merchant_id: 'merchant_1',
      event_id: 'evt_sat_1',
      payment_id: 'pay_sat_1',
      order_id: obligation.order_id,
      obligation_id: obligation.id,
      payment_link_id: null,
      amount: 350000,
      currency: 'INR',
      failure_code: 'GATEWAY_ERROR',
      failure_description: 'Gateway error',
      payment_method: 'upi',
      customer_context: { name: 'Customer Z' },
      attempt_count: 1,
      status: 'HUMAN_REVIEW',
      recoverability_score: 0.9,
      expected_recovery_value: 315000,
      consent_status: 'CONSENTED',
      policy_version: '1.0.0',
    });

    // Obligation is satisfied out of band before operator review finishes
    repo.updateObligationStatus(obligation.id, 'SATISFIED', 'pay_oob_success');

    await expect(
      loop.handleHumanReview(recoveryCase.id, {
        action: 'OVERRIDE',
        override_action: 'CREATE_OR_REUSE_PAYMENT_LINK',
        operator_notes: 'Operator approving link',
        operator_id: 'op_naman',
      })
    ).rejects.toThrow(/Policy Guardrail Rejection.*already satisfied/i);

    const policyChecks = repo.getPolicyChecksByCaseId(recoveryCase.id);
    const lastCheck = policyChecks[policyChecks.length - 1];
    expect(lastCheck.allowed).toBe(false);
    expect(lastCheck.reasons.some((r) => r.toLowerCase().includes('already satisfied'))).toBe(true);
  });
});
