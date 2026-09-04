import { EvaluationStrategy, StrategyCaseOutcome } from './strategy-interface';
import { SimulatedObservableCase, LatentEngine } from '../../simulator/latent-engine';
import { PolicyEngine } from '../../policy/policy-engine';
import { RecoveryCase, Decision, ApprovedAction } from '../../domain/types';
import { ContextBuilder } from '../../context/context-builder';

/**
 * Policy-Only Strategy:
 * Deterministic policy rules and static heuristic mapping without LLM contextual diagnosis.
 */
export class PolicyOnlyStrategy implements EvaluationStrategy {
  private policyEngine: PolicyEngine = new PolicyEngine();

  getStrategyName(): string {
    return 'policy_only';
  }

  async evaluateCase(c: SimulatedObservableCase): Promise<StrategyCaseOutcome> {
    const start = performance.now();

    const mockRecoveryCase: RecoveryCase = {
      id: c.id,
      merchant_id: 'merchant_sim',
      event_id: `evt_${c.id}`,
      payment_id: c.payment_id,
      order_id: c.order_id,
      payment_link_id: null,
      recovery_url: null,
      amount: c.amount,
      currency: c.currency,
      failure_code: c.failure_code,
      failure_description: c.failure_description,
      payment_method: c.payment_method,
      customer_context: c.customer_context,
      attempt_count: c.attempt_count,
      status: 'DIAGNOSED',
      recoverability_score: 0.5,
      expected_recovery_value: 0,
      consent_status: c.consent_status,
      policy_version: '1.0.0',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const category = ContextBuilder.categorizeFailureCode(c.failure_code, c.failure_description);
    let ruleAction: ApprovedAction = 'STOP';

    if (category === 'TRANSIENT') {
      ruleAction = 'RETRY';
    } else if (category === 'AUTHENTICATION' || category === 'CUSTOMER_ACTION') {
      ruleAction = 'CREATE_OR_REUSE_PAYMENT_LINK';
    } else if (category === 'HARD_DECLINE') {
      ruleAction = 'OFFER_ALTERNATE_PAYMENT_METHOD';
    }

    const pseudoDecision: Decision = {
      id: `dec_pol_${c.id}`,
      case_id: c.id,
      model_provider: 'deterministic_rules',
      model_version: 'v1',
      prompt_version: 'none',
      diagnosis: `Static heuristic category: ${category}`,
      failure_category: category,
      recoverability: 0.5,
      expected_recovery_value: Math.round(c.amount * 0.5),
      evidence: [`Failure category: ${category}`],
      recommended_action: ruleAction,
      timing: 'IMMEDIATE',
      confidence: 0.75,
      reason: 'Rule-based heuristic assignment.',
      customer_friction: 'LOW',
      expected_value: Math.round(c.amount * 0.5),
      rationale: 'Rule-based assignment.',
      created_at: new Date().toISOString(),
    };

    const policyCheck = this.policyEngine.evaluate(mockRecoveryCase, pseudoDecision);
    let actionToExecute: ApprovedAction = 'STOP';
    if (policyCheck.allowed) {
      actionToExecute = ruleAction;
    } else if (policyCheck.policy_result === 'ESCALATE') {
      actionToExecute = 'ESCALATE';
    } else {
      actionToExecute = 'STOP';
    }

    const outcome = LatentEngine.evaluateActionOutcome(
      actionToExecute,
      c._hidden_latent,
      c.amount,
      { consent_status: c.consent_status }
    );
    const end = performance.now();

    return {
      caseId: c.id,
      amount: c.amount,
      actionTaken: actionToExecute,
      allowedByPolicy: policyCheck.allowed,
      policyResult: policyCheck.policy_result,
      recovered: outcome.recovered,
      recoveredAmount: outcome.recoveredAmount,
      netRecoveryValue: outcome.netRecoveryValue,
      isPolicyViolation: false,
      isUnnecessaryIntervention: outcome.isUnnecessaryIntervention,
      isHardDeclineRetry: outcome.isHardDeclineRetry,
      executionTimeMs: Number((end - start).toFixed(2)),
      costs: outcome.costs,
      diagnosis: pseudoDecision.diagnosis,
      rationale: pseudoDecision.rationale,
    };
  }
}
