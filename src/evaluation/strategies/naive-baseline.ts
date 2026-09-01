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

    const outcome = LatentEngine.evaluateActionOutcome(action, c._hidden_latent, c.amount);
    const end = performance.now();

    // Naive strategy has policy violations because it ignores opt-outs, hard declines, and high amounts
    const isPolicyViolation =
      c.consent_status === 'OPTED_OUT' ||
      (action === 'RETRY' && (c.failure_code.includes('EXPIRED') || c.failure_code.includes('BLOCKED')));

    return {
      caseId: c.id,
      amount: c.amount,
      actionTaken: action,
      allowedByPolicy: true, // No policy check ran
      policyResult: 'NO_POLICY',
      recovered: outcome.recovered,
      recoveredAmount: outcome.recoveredAmount,
      isPolicyViolation,
      isUnnecessaryIntervention: outcome.isUnnecessaryIntervention || c.consent_status === 'OPTED_OUT',
      isHardDeclineRetry: outcome.isHardDeclineRetry,
      executionTimeMs: Number((end - start).toFixed(2)),
      diagnosis: 'Naive blanket retry heuristic',
      rationale: 'Always attempts gateway retry without contextual diagnosis.',
    };
  }
}
