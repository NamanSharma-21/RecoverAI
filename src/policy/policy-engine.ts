import {
  RecoveryCase,
  Decision,
  PolicyCheck,
  PolicyResult,
  MerchantPolicyConfig,
  DEFAULT_MERCHANT_POLICY,
} from '../domain/types';
import { PolicyRules } from './rules';

export class PolicyEngine {
  private config: MerchantPolicyConfig;

  constructor(config?: Partial<MerchantPolicyConfig>) {
    this.config = { ...DEFAULT_MERCHANT_POLICY, ...(config || {}) } as MerchantPolicyConfig;
  }

  evaluate(
    c: RecoveryCase,
    d: Decision,
    options?: { obligationStatus?: string; maxValidityMinutes?: number }
  ): PolicyCheck {
    const reasons: string[] = [];
    let shouldBlock = false;
    let shouldEscalate = false;

    // 1. Case open check
    const openCheck = PolicyRules.checkCaseIsOpen(c);
    if (!openCheck.ok) {
      shouldBlock = true;
      reasons.push(openCheck.reason!);
    }

    // 2. Already succeeded check (including commercial obligation check)
    const successCheck = PolicyRules.checkPaymentNotAlreadySucceeded(c, options?.obligationStatus);
    if (!successCheck.ok) {
      shouldBlock = true;
      reasons.push(successCheck.reason!);
    }

    // 2b. Decision staleness check
    const staleCheck = PolicyRules.checkDecisionNotStale(d, options?.maxValidityMinutes || 5);
    if (!staleCheck.ok) {
      shouldBlock = true;
      reasons.push(staleCheck.reason!);
    }

    // 3. Customer opt-out check
    const consentCheck = PolicyRules.checkCustomerConsent(c);
    if (!consentCheck.ok) {
      shouldBlock = true;
      reasons.push(consentCheck.reason!);
    }

    // 4. Action allowlist check
    const actionCheck = PolicyRules.checkActionApproved(d.recommended_action, this.config);
    if (!actionCheck.ok) {
      shouldBlock = true;
      reasons.push(actionCheck.reason!);
    }

    // 5. Evidence requirement check
    const evidenceCheck = PolicyRules.checkRequiredEvidence(d);
    if (!evidenceCheck.ok) {
      shouldBlock = true;
      reasons.push(evidenceCheck.reason!);
    }

    // 6. Hard decline category check
    const categoryCheck = PolicyRules.checkActionCategoryMatch(c, d, this.config);
    if (!categoryCheck.ok) {
      shouldBlock = true;
      reasons.push(categoryCheck.reason!);
    }

    // 7. Max intervention limit check
    const limitCheck = PolicyRules.checkInterventionLimits(c, d, this.config);
    if (!limitCheck.ok) {
      shouldBlock = true;
      reasons.push(limitCheck.reason!);
    }

    // 8. Tiered amount policy check
    const tieredCheck = PolicyRules.checkTieredAmountPolicy(c, d, this.config);
    if (!tieredCheck.ok) {
      if (tieredCheck.escalate) {
        shouldEscalate = true;
      } else {
        shouldBlock = true;
      }
      reasons.push(tieredCheck.reason!);
    }

    // 9. Confidence threshold check
    const confCheck = PolicyRules.checkConfidenceThreshold(d, this.config);
    if (!confCheck.ok) {
      if (confCheck.escalate) {
        shouldEscalate = true;
      } else {
        shouldBlock = true;
      }
      reasons.push(confCheck.reason!);
    }

    // Determine final policy result
    let policyResult: PolicyResult = 'ALLOW';
    let allowed = true;

    if (shouldBlock) {
      policyResult = 'BLOCK';
      allowed = false;
    } else if (shouldEscalate || d.recommended_action === 'ESCALATE') {
      policyResult = 'ESCALATE';
      allowed = false;
    } else if (d.recommended_action === 'STOP') {
      policyResult = 'ALLOW';
      allowed = true;
      reasons.push('Case stopped as per policy.');
    } else {
      reasons.push('All deterministic policy guardrails passed. Recovery execution approved.');
    }

    return {
      id: `pol_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      decision_id: d.id,
      case_id: c.id,
      allowed,
      policy_result: policyResult,
      reasons,
      policy_version: this.config.policy_version,
      created_at: new Date().toISOString(),
    };
  }
}
