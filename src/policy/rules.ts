import {
  RecoveryCase,
  Decision,
  MerchantPolicyConfig,
  DEFAULT_MERCHANT_POLICY,
  PolicyResult,
  APPROVED_ACTIONS,
} from '../domain/types';
import { isOpenState } from '../domain/state-machine';

export class PolicyRules {
  /**
   * Check 1: Is the case still open?
   */
  static checkCaseIsOpen(c: RecoveryCase): { ok: boolean; reason?: string } {
    if (!isOpenState(c.status)) {
      return { ok: false, reason: `Case is in terminal state '${c.status}'. No further recovery action permitted.` };
    }
    return { ok: true };
  }

  /**
   * Check 2: Has payment already succeeded?
   */
  static checkPaymentNotAlreadySucceeded(c: RecoveryCase): { ok: boolean; reason?: string } {
    if (c.status === 'RECOVERED') {
      return { ok: false, reason: 'Case has already been marked RECOVERED. Action blocked.' };
    }
    return { ok: true };
  }

  /**
   * Check 3: Has customer opted out?
   */
  static checkCustomerConsent(c: RecoveryCase): { ok: boolean; reason?: string } {
    if (c.consent_status === 'OPTED_OUT') {
      return { ok: false, reason: 'Customer has opted out of recovery communications. All interventions halted.' };
    }
    return { ok: true };
  }

  /**
   * Check 4: Is recommended action in approved enum?
   */
  static checkActionApproved(action: string, config: MerchantPolicyConfig): { ok: boolean; reason?: string } {
    if (!APPROVED_ACTIONS.includes(action as any)) {
      return { ok: false, reason: `Action '${action}' is not in approved recovery action vocabulary.` };
    }
    if (!config.allowed_actions.includes(action as any)) {
      return { ok: false, reason: `Action '${action}' is prohibited by merchant policy configuration.` };
    }
    return { ok: true };
  }

  /**
   * Check 5: Evidence existence check
   */
  static checkRequiredEvidence(d: Decision): { ok: boolean; reason?: string } {
    if (d.recommended_action !== 'STOP' && d.recommended_action !== 'ESCALATE') {
      if (!d.evidence || d.evidence.length === 0) {
        return { ok: false, reason: 'No supporting evidence provided in model decision. Action blocked.' };
      }
    }
    return { ok: true };
  }

  /**
   * Check 6: Tiered Amount Thresholds
   * - Under ₹5,000: autonomous recovery permitted
   * - ₹5,000–₹25,000: one bounded recovery intervention
   * - Above ₹25,000: human approval required (ESCALATE)
   */
  static checkTieredAmountPolicy(
    c: RecoveryCase,
    d: Decision,
    config: MerchantPolicyConfig
  ): { ok: boolean; escalate?: boolean; reason?: string } {
    const threshold = config.human_approval_above_inr || config.autonomous_amount_threshold || 2500000;
    if (c.amount > threshold) {
      if (d.recommended_action !== 'ESCALATE' && d.recommended_action !== 'STOP') {
        return {
          ok: false,
          escalate: true,
          reason: `Transaction value (₹${(c.amount / 100).toFixed(2)}) exceeds autonomous threshold (₹${(threshold / 100).toFixed(2)}). Escalated for merchant human approval.`,
        };
      }
    }

    // Medium tier: > ₹5,000 and <= ₹25,000
    if (c.amount > config.autonomous_limit_inr && c.amount <= threshold) {
      if (c.attempt_count >= 1 && d.recommended_action !== 'STOP' && d.recommended_action !== 'ESCALATE') {
        return {
          ok: false,
          escalate: true,
          reason: `Medium-tier amount (₹${(c.amount / 100).toFixed(2)}) allows exactly one autonomous intervention (attempt count: ${c.attempt_count}). Subsequent attempt requires human review.`,
        };
      }
    }

    return { ok: true };
  }

  /**
   * Check 7: Maximum intervention limit
   */
  static checkInterventionLimits(
    c: RecoveryCase,
    d: Decision,
    config: MerchantPolicyConfig
  ): { ok: boolean; reason?: string } {
    const maxInterventions = config.max_interventions_per_case || config.max_retry_attempts || 2;
    if (c.attempt_count >= maxInterventions && d.recommended_action !== 'STOP' && d.recommended_action !== 'ESCALATE') {
      return {
        ok: false,
        reason: `Maximum retry limit / intervention limit (${maxInterventions}) reached for case (current attempts: ${c.attempt_count}). Action blocked.`,
      };
    }
    return { ok: true };
  }

  /**
   * Check 8: Hard decline check on payment instrument
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
        reason: `Failure code '${c.failure_code}' is a hard decline/permanent instrument error. RETRY on same payment instrument is blocked.`,
      };
    }

    return { ok: true };
  }

  /**
   * Check 9: Confidence threshold check
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
          reason: `AI diagnostic confidence (${(d.confidence * 100).toFixed(0)}%) is below autonomous threshold (${(config.min_confidence_for_autonomous_action * 100).toFixed(0)}%). Escalated for human review.`,
        };
      }
    }
    return { ok: true };
  }
}
