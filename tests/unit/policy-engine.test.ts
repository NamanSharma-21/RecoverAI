import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '../../src/policy/policy-engine';
import { DEFAULT_MERCHANT_POLICY, RecoveryCase, Decision } from '../../src/domain/types';

describe('PolicyEngine Unit Tests', () => {
  const engine = new PolicyEngine(DEFAULT_MERCHANT_POLICY);

  const createBaseCase = (overrides?: Partial<RecoveryCase>): RecoveryCase => ({
    id: 'case_test_01',
    merchant_id: 'merchant_1',
    event_id: 'evt_1',
    payment_id: 'pay_1',
    order_id: 'order_1',
    payment_link_id: null,
    amount: 250000,
    currency: 'INR',
    failure_code: 'GATEWAY_ERROR',
    failure_description: 'Gateway timeout',
    payment_method: 'card',
    customer_context: { historical_success_rate: 0.9 },
    attempt_count: 1,
    status: 'DIAGNOSED',
    recoverability_score: 0.85,
    expected_recovery_value: 212500,
    consent_status: 'CONSENTED',
    policy_version: '1.0.0',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  const createBaseDecision = (overrides?: Partial<Decision>): Decision => ({
    id: 'dec_test_01',
    case_id: 'case_test_01',
    model_provider: 'mock',
    model_version: 'v1',
    prompt_version: '1.0.0',
    diagnosis: 'Transient gateway error',
    evidence: ['Gateway timeout error code observed'],
    recommended_action: 'RETRY',
    confidence: 0.90,
    expected_value: 212500,
    rationale: 'Safe for retry with backoff',
    created_at: new Date().toISOString(),
    ...overrides,
  });

  it('ALLOWS valid transient retry within limits', () => {
    const c = createBaseCase();
    const d = createBaseDecision();
    const result = engine.evaluate(c, d);

    expect(result.allowed).toBe(true);
    expect(result.policy_result).toBe('ALLOW');
  });

  it('BLOCKS action if case is already RECOVERED', () => {
    const c = createBaseCase({ status: 'RECOVERED' });
    const d = createBaseDecision();
    const result = engine.evaluate(c, d);

    expect(result.allowed).toBe(false);
    expect(result.policy_result).toBe('BLOCK');
    expect(result.reasons.some((r) => r.includes('already been marked RECOVERED') || r.includes('terminal status'))).toBe(true);
  });

  it('BLOCKS action if customer is OPTED_OUT', () => {
    const c = createBaseCase({ consent_status: 'OPTED_OUT' });
    const d = createBaseDecision({ recommended_action: 'CREATE_OR_REUSE_PAYMENT_LINK' });
    const result = engine.evaluate(c, d);

    expect(result.allowed).toBe(false);
    expect(result.policy_result).toBe('BLOCK');
    expect(result.reasons.some((r) => r.includes('opted out'))).toBe(true);
  });

  it('BLOCKS RETRY on hard declines (e.g. EXPIRED_CARD)', () => {
    const c = createBaseCase({ failure_code: 'EXPIRED_CARD' });
    const d = createBaseDecision({ recommended_action: 'RETRY' });
    const result = engine.evaluate(c, d);

    expect(result.allowed).toBe(false);
    expect(result.policy_result).toBe('BLOCK');
    expect(result.reasons.some((r) => r.includes('hard decline'))).toBe(true);
  });

  it('BLOCKS RETRY when attempt_count reaches max_retry_attempts', () => {
    const c = createBaseCase({ attempt_count: 3 });
    const d = createBaseDecision({ recommended_action: 'RETRY' });
    const result = engine.evaluate(c, d);

    expect(result.allowed).toBe(false);
    expect(result.policy_result).toBe('BLOCK');
    expect(result.reasons.some((r) => r.includes('Maximum retry limit'))).toBe(true);
  });

  it('ESCALATES high value transactions exceeding autonomous threshold', () => {
    const c = createBaseCase({ amount: 10000000 }); // 1,00,000 INR > 50,000 threshold
    const d = createBaseDecision({ recommended_action: 'RETRY' });
    const result = engine.evaluate(c, d);

    expect(result.allowed).toBe(false);
    expect(result.policy_result).toBe('ESCALATE');
    expect(result.reasons.some((r) => r.includes('autonomous threshold'))).toBe(true);
  });

  it('ESCALATES when confidence is below minimum threshold', () => {
    const c = createBaseCase();
    const d = createBaseDecision({ confidence: 0.40 });
    const result = engine.evaluate(c, d);

    expect(result.allowed).toBe(false);
    expect(result.policy_result).toBe('ESCALATE');
    expect(result.reasons.some((r) => r.includes('below autonomous threshold'))).toBe(true);
  });

  it('BLOCKS if model provides empty evidence', () => {
    const c = createBaseCase();
    const d = createBaseDecision({ evidence: [] });
    const result = engine.evaluate(c, d);

    expect(result.allowed).toBe(false);
    expect(result.policy_result).toBe('BLOCK');
    expect(result.reasons.some((r) => r.includes('No supporting evidence'))).toBe(true);
  });
});
