import {
  RecoveryCase,
  Decision,
  MerchantPolicyConfig,
  DEFAULT_MERCHANT_POLICY,
  PolicyResult,
  APPROVED_ACTIONS,
} from '../domain/types';
import { isOpenState } from '../domain/state-machine';

export interface PolicyEvaluation {
  result: PolicyResult;
  allowed: boolean;
  reasons: string[];
}

export class PolicyRules {
  /**
   * Check 1: Is the case still open?
   */
  static checkCaseIsOpen(c: RecoveryCase): { ok: boolean; reason?: string } {
    if (!isOpenState(c.status)) {
      return { ok: false, reason: `Case is closed in terminal status '${c.status}'. No further action allowed.` };
    }
    return { ok: true };
  }

  /**
   * Check 2: Has payment already succeeded?
   */
  static checkPaymentNotAlreadySucceeded(c: RecoveryCase): { ok: boolean; reason?: string } {
    if (c.status === 'RECOVERED') {
      return { ok: false, reason: 'Payment has already been marked RECOVERED. Action blocked.' };
    }
    return { ok: true };
  }

  /**
   * Check 3: Has customer opted out?
   */
  static checkCustomerConsent(c: RecoveryCase): { ok: boolean; reason?: string } {
    if (c.consent_status === 'OPTED_OUT') {
      return { ok: false, reason: 'Customer has explicitly opted out of recovery communications. Action blocked.' };
    }
    return { ok: true };
  }

  /**
   * Check 4: Is recommended action in approved enum?
   */
  static checkActionApproved(action: string, config: MerchantPolicyConfig): { ok: boolean; reason?: string } {
    if (!APPROVED_ACTIONS.includes(action as any)) {
      return { ok: false, reason: `Action '${action}' is not in approved action enum.` };
    }
    if (!config.allowed_actions.includes(action as any)) {
      return { ok: false, reason: `Action '${action}' is disallowed by merchant policy config.` };
    }
    return { ok: true };
  }

  /**
   * Check 5: Is amount within autonomous threshold?
   */
  static checkAutonomousAmountThreshold(
    c: RecoveryCase,
    d: Decision,
    config: MerchantPolicyConfig
  ): { ok: boolean; escalate?: boolean; reason?: string } {
    if (c.amount > config.autonomous_amount_threshold) {
      if (d.recommended_action !== 'ESCALATE' && d.recommended_action !== 'STOP') {
        return {
          ok: false,
          escalate: true,
          reason: `Transaction amount (${(c.amount / 100).toFixed(2)} ${c.currency}) exceeds autonomous threshold (${(config.autonomous_amount_threshold / 100).toFixed(2)} ${c.currency}). Requires human review.`,
        };
      }
    }
    return { ok: true };
  }

  /**
   * Check 6: Has retry limit been reached?
   */
  static checkRetryLimits(
    c: RecoveryCase,
    d: Decision,
    config: MerchantPolicyConfig
  ): { ok: boolean; reason?: string } {
    if (d.recommended_action === 'RETRY' && c.attempt_count >= config.max_retry_attempts) {
      return {
        ok: false,
        reason: `Maximum retry limit (${config.max_retry_attempts}) reached for this case (current attempts: ${c.attempt_count}). RETRY blocked.`,
      };
    }
    return { ok: true };
  }

  /**
   * Check 7: Does action match failure category?
   */
  static checkActionCategoryMatch(
    c: RecoveryCase,
    d: Decision,
    config: MerchantPolicyConfig
  ): { ok: boolean; reason?: string } {
    const isProhibitedForRetry = config.prohibited_failure_codes_for_retry.some(
      (code) => c.failure_code.toUpperCase().includes(code)
    );

    if (d.recommended_action === 'RETRY' && isProhibitedForRetry) {
      return {
        ok: false,
        reason: `Failure code '${c.failure_code}' is a hard decline/prohibited for automated RETRY on same payment instrument.`,
      };
    }

    return { ok: true };
  }

  /**
   * Check 8: Is required evidence present?
   */
  static checkRequiredEvidence(d: Decision): { ok: boolean; reason?: string } {
    if (!d.evidence || d.evidence.length === 0) {
      return { ok: false, reason: 'No supporting evidence provided in AI decision.' };
    }
    if (!d.diagnosis || d.diagnosis.trim().length === 0) {
      return { ok: false, reason: 'Empty diagnosis provided in AI decision.' };
    }
    return { ok: true };
  }

  /**
   * Check 9: Confidence threshold check.
   */
  static checkConfidenceThreshold(
    d: Decision,
    config: MerchantPolicyConfig
  ): { ok: boolean; escalate?: boolean; reason?: string } {
    if (d.recommended_action !== 'ESCALATE' && d.recommended_action !== 'STOP') {
      if (d.confidence < config.min_confidence_for_autonomous_action) {
        return {
          ok: false,
          escalate: true,
          reason: `Decision confidence (${(d.confidence * 100).toFixed(0)}%) is below autonomous threshold (${(config.min_confidence_for_autonomous_action * 100).toFixed(0)}%). Requires human escalation.`,
        };
      }
    }
    return { ok: true };
  }
}
