import { EvaluationStrategy, StrategyCaseOutcome } from './strategy-interface';
import { SimulatedObservableCase, LatentEngine } from '../../simulator/latent-engine';
import { ApprovedAction } from '../../domain/types';

/**
 * Naive Baseline:
 * Blindly retries (RETRY) every failure up to attempt 3, regardless of failure reason, opt-out status, or amount.
 */
export class NaiveBaselineStrategy implements EvaluationStrategy {
  getStrategyName(): string {
    return 'naive_baseline';
  }

  async evaluateCase(c: SimulatedObservableCase): Promise<StrategyCaseOutcome> {
    const start = performance.now();
    const action: ApprovedAction = c.attempt_count <= 3 ? 'RETRY' : 'STOP';

    const outcome = LatentEngine.evaluateActionOutcome(action, c._hidden_latent, c.amount, {
      consent_status: c.consent_status,
    });
    const end = performance.now();

    const isPolicyViolation = outcome.isPolicyViolation;

    return {
      caseId: c.id,
      amount: c.amount,
      actionTaken: action,
      allowedByPolicy: true, // No policy check ran
      policyResult: 'NO_POLICY',
      recovered: outcome.recovered,
      recoveredAmount: outcome.recoveredAmount,
      netRecoveryValue: outcome.netRecoveryValue,
      isPolicyViolation,
      isUnnecessaryIntervention: outcome.isUnnecessaryIntervention,
      isHardDeclineRetry: outcome.isHardDeclineRetry,
      executionTimeMs: Number((end - start).toFixed(2)),
      costs: outcome.costs,
      diagnosis: 'Naive blanket retry heuristic',
      rationale: 'Always attempts gateway retry without contextual diagnosis.',
    };
  }
}
