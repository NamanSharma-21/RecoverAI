import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDatabase } from '../../src/db/database';
import { Repository } from '../../src/db/repository';
import { ToolExecutor } from '../../src/tools/tool-executor';
import { SimulatorAdapter } from '../../src/adapters/simulator-adapter';

describe('Action Idempotency & Worker Lease Integrity', () => {
  let repo: Repository;
  let toolExecutor: ToolExecutor;
  let simAdapter: SimulatorAdapter;

  beforeEach(() => {
    const db = createMemoryDatabase();
    repo = new Repository(db);
    simAdapter = new SimulatorAdapter();
    toolExecutor = new ToolExecutor(simAdapter, repo);
  });

  it('generates deterministic idempotency keys based on obligation, action, and generation', () => {
    const key1 = toolExecutor.generateDeterministicIdempotencyKey('ob_xyz_123', 'CREATE_OR_REUSE_PAYMENT_LINK', 1);
    const key2 = toolExecutor.generateDeterministicIdempotencyKey('ob_xyz_123', 'CREATE_OR_REUSE_PAYMENT_LINK', 1);
    const keyGen2 = toolExecutor.generateDeterministicIdempotencyKey('ob_xyz_123', 'CREATE_OR_REUSE_PAYMENT_LINK', 2);

    expect(key1).toBe('idemp_ob_xyz_123_CREATE_OR_REUSE_PAYMENT_LINK_gen1');
    expect(key1).toBe(key2); // Identical inputs produce identical keys
    expect(keyGen2).toBe('idemp_ob_xyz_123_CREATE_OR_REUSE_PAYMENT_LINK_gen2');
  });

  it('guarantees atomic worker leasing: duplicate worker cannot claim the same action', () => {
    const obligation = repo.getOrCreateObligation('order_lease_1', 'merchant_1', 199900, 'INR');
    const recoveryCase = repo.createCase({
      id: 'case_lease_1',
      merchant_id: 'merchant_1',
      event_id: 'evt_lease_1',
      payment_id: 'pay_lease_1',
      order_id: obligation.order_id,
      obligation_id: obligation.id,
      payment_link_id: null,
      amount: 199900,
      currency: 'INR',
      failure_code: 'BAD_REQUEST',
      failure_description: 'Failed attempt',
      payment_method: 'upi',
      customer_context: { name: 'Vikram' },
      attempt_count: 1,
      status: 'DIAGNOSED',
      recoverability_score: 0.7,
      expected_recovery_value: 139930,
      consent_status: 'CONSENTED',
      policy_version: '1.0.0',
    });

    const idempotencyKey = toolExecutor.generateDeterministicIdempotencyKey(obligation.id, 'CREATE_OR_REUSE_PAYMENT_LINK', 1);

    // Create action in POLICY_ALLOWED state
    const action = repo.createRecoveryAction({
      obligation_id: obligation.id,
      case_id: recoveryCase.id,
      action_type: 'CREATE_OR_REUSE_PAYMENT_LINK',
      generation: 1,
      idempotency_key: idempotencyKey,
      status: 'POLICY_ALLOWED',
    });

    // Worker 1 claims action
    const claim1 = repo.claimActionForExecution(action.id, 'worker_node_1');
    expect(claim1).toBe(true);

    const reloaded = repo.getRecoveryActionById(action.id);
    expect(reloaded?.status).toBe('CLAIMED');
    expect(reloaded?.claim_worker_id).toBe('worker_node_1');

    // Worker 2 attempts to claim the same action concurrently
    const claim2 = repo.claimActionForExecution(action.id, 'worker_node_2');
    // Worker 2 must be rejected
    expect(claim2).toBe(false);
  });

  it('returns cached successful result upon duplicate execute call (idempotent replay)', async () => {
    const obligation = repo.getOrCreateObligation('order_replay_1', 'merchant_1', 299900, 'INR');
    const recoveryCase = repo.createCase({
      id: 'case_replay_1',
      merchant_id: 'merchant_1',
      event_id: 'evt_replay_1',
      payment_id: 'pay_replay_1',
      order_id: obligation.order_id,
      obligation_id: obligation.id,
      payment_link_id: null,
      amount: 299900,
      currency: 'INR',
      failure_code: 'BAD_REQUEST',
      failure_description: 'Failed attempt',
      payment_method: 'card',
      customer_context: { name: 'Rohan' },
      attempt_count: 1,
      status: 'DIAGNOSED',
      recoverability_score: 0.85,
      expected_recovery_value: 254915,
      consent_status: 'CONSENTED',
      policy_version: '1.0.0',
    });

    const actionKey = toolExecutor.generateDeterministicIdempotencyKey(obligation.id, 'CREATE_OR_REUSE_PAYMENT_LINK', 1);

    const policyCheck = {
      case_id: recoveryCase.id,
      allowed: true,
      policy_result: 'ALLOW' as const,
      reasons: ['Valid test execution'],
      failed_checks: [],
      evaluated_at: new Date().toISOString(),
    };

    // First execution
    const result1 = await toolExecutor.execute(
      'CREATE_OR_REUSE_PAYMENT_LINK',
      recoveryCase,
      policyCheck,
      { customIdempotencyKey: actionKey }
    );

    expect(result1.success).toBe(true);

    // Duplicate execution with the exact same idempotency key
    const result2 = await toolExecutor.execute(
      'CREATE_OR_REUSE_PAYMENT_LINK',
      recoveryCase,
      policyCheck,
      { customIdempotencyKey: actionKey }
    );

    expect(result2.success).toBe(true);
    expect(result2.message).toContain('Idempotent replay');
  });
});
