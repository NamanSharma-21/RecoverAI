import { EvaluationStrategy, StrategyCaseOutcome } from './strategy-interface';
import { SimulatedObservableCase, LatentEngine } from '../../simulator/latent-engine';
import { ApprovedAction } from '../../domain/types';

/**
 * Fixed-Rule Baseline:
 * Standard merchant rule heuristics:
 * - If failure code is GATEWAY_ERROR / SERVER_DOWN -> RETRY
 * - If failure code is AUTH_TIMEOUT / CANCELLED -> CREATE_OR_REUSE_PAYMENT_LINK
 * - If failure code is EXPIRED_CARD / INSUFFICIENT_FUNDS -> STOP or OFFER_ALTERNATE_PAYMENT_METHOD
 * - If attempt >= 3 -> STOP
 */
export class FixedRuleBaselineStrategy implements EvaluationStrategy {
  getStrategyName(): string {
    return 'fixed_rule_baseline';
  }

  async evaluateCase(c: SimulatedObservableCase): Promise<StrategyCaseOutcome> {
    const start = performance.now();

    let action: ApprovedAction = 'STOP';
    const code = c.failure_code.toUpperCase();

    if (c.attempt_count > 3 || c.consent_status === 'OPTED_OUT') {
      action = 'STOP';
    } else if (code.includes('GATEWAY') || code.includes('SERVER')) {
      action = 'RETRY';
    } else if (code.includes('AUTH') || code.includes('CANCEL')) {
      action = 'CREATE_OR_REUSE_PAYMENT_LINK';
    } else if (code.includes('INSUFFICIENT')) {
      action = 'CREATE_OR_REUSE_PAYMENT_LINK';
    } else if (code.includes('EXPIRED') || code.includes('BLOCKED')) {
      action = 'OFFER_ALTERNATE_PAYMENT_METHOD';
    }

    const outcome = LatentEngine.evaluateActionOutcome(action, c._hidden_latent, c.amount);
    const end = performance.now();

    const isPolicyViolation = c.consent_status === 'OPTED_OUT' && action !== 'STOP';

    return {
      caseId: c.id,
      amount: c.amount,
      actionTaken: action,
      allowedByPolicy: true,
      policyResult: 'RULE_BASED',
      recovered: outcome.recovered,
      recoveredAmount: outcome.recoveredAmount,
      isPolicyViolation,
      isUnnecessaryIntervention: outcome.isUnnecessaryIntervention,
      isHardDeclineRetry: outcome.isHardDeclineRetry,
      executionTimeMs: Number((end - start).toFixed(2)),
      diagnosis: `Static rule mapping for ${c.failure_code}`,
      rationale: 'Executed deterministic merchant routing rule.',
    };
  }
}
