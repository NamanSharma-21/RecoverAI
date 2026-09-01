import {
  RecoveryCase,
  CustomerContext,
  PaymentFailureContext,
  MerchantPolicyConfig,
  DEFAULT_MERCHANT_POLICY,
} from '../domain/types';

export interface CaseStructuredContext {
  case_id: string;
  payment_id: string;
  order_id?: string | null;
  amount: number;
  amount_formatted: string;
  currency: string;
  failure_code: string;
  failure_description: string;
  failure_category: 'TRANSIENT' | 'HARD_DECLINE' | 'CUSTOMER_ACTION' | 'AUTHENTICATION' | 'UNKNOWN';
  payment_method: string;
  attempt_count: number;
  customer_summary: {
    historical_success_rate: number;
    total_prior_transactions: number;
    prior_failed_transactions: number;
    lifetime_value: number;
  };
  recoverability_score: number;
  expected_recovery_value: number;
  policy_constraints: {
    max_retries: number;
    autonomous_amount_threshold: number;
    is_high_value: boolean;
    remaining_retries: number;
  };
  observable_evidence: string[];
}

export class ContextBuilder {
  /**
   * Categorizes failure code into high-level categories.
   */
  static categorizeFailureCode(code: string, description?: string): 'TRANSIENT' | 'HARD_DECLINE' | 'CUSTOMER_ACTION' | 'AUTHENTICATION' | 'UNKNOWN' {
    const upperCode = (code || '').toUpperCase();
    const upperDesc = (description || '').toUpperCase();

    if (
      upperCode.includes('GATEWAY_ERROR') ||
      upperCode.includes('SERVER_ERROR') ||
      upperCode.includes('TIMEOUT') ||
      upperCode.includes('NETWORK') ||
      upperCode.includes('TEMPORARY') ||
      upperCode.includes('BANK_DOWN')
    ) {
      return 'TRANSIENT';
    }

    if (
      upperCode.includes('EXPIRED_CARD') ||
      upperCode.includes('STOLEN_CARD') ||
      upperCode.includes('FRAUD') ||
      upperCode.includes('CARD_BLOCKED') ||
      upperCode.includes('ACCOUNT_CLOSED') ||
      upperCode.includes('NOT_ALLOWED') ||
      upperCode.includes('HARD_DECLINE') ||
      upperCode.includes('INSUFFICIENT_FUNDS')
    ) {
      return 'HARD_DECLINE';
    }

    if (
      upperCode.includes('OTP_EXPIRED') ||
      upperCode.includes('AUTH_FAILED') ||
      upperCode.includes('3DS') ||
      upperCode.includes('PIN')
    ) {
      return 'AUTHENTICATION';
    }

    if (
      upperCode.includes('CANCELLED') ||
      upperCode.includes('DROPPED') ||
      upperCode.includes('TIMED_OUT_BY_USER') ||
      upperCode.includes('USER_ABORTED') ||
      upperDesc.includes('CANCELLED BY USER')
    ) {
      return 'CUSTOMER_ACTION';
    }

    return 'UNKNOWN';
  }

  /**
   * Computes a deterministic recoverability score between 0.0 and 1.0.
   */
  static calculateRecoverabilityScore(
    failureCategory: string,
    attemptCount: number,
    customer: CustomerContext,
    amountPaise: number
  ): number {
    let baseScore = 0.5;

    // 1. Failure category weighting
    switch (failureCategory) {
      case 'TRANSIENT':
        baseScore = 0.85;
        break;
      case 'AUTHENTICATION':
        baseScore = 0.70;
        break;
      case 'CUSTOMER_ACTION':
        baseScore = 0.60;
        break;
      case 'UNKNOWN':
        baseScore = 0.35;
        break;
      case 'HARD_DECLINE':
        baseScore = 0.15;
        break;
    }

    // 2. Customer history modifier
    if (customer.historical_success_rate !== undefined) {
      const historyDelta = (customer.historical_success_rate - 0.7) * 0.2;
      baseScore += historyDelta;
    }

    // 3. Attempt count penalty (diminishing probability per attempt)
    baseScore -= (attemptCount - 1) * 0.20;

    // 4. Amount bracket adjustment (very large amounts have slightly lower spontaneous recovery)
    if (amountPaise > 10000000) { // > 1,00,000 INR
      baseScore -= 0.05;
    }

    return Math.max(0.01, Math.min(0.99, Number(baseScore.toFixed(3))));
  }

  /**
   * Assembles the complete sanitized case context for AI decisioning and policy validation.
   */
  static buildContext(
    c: RecoveryCase,
    policyConfig: MerchantPolicyConfig = DEFAULT_MERCHANT_POLICY
  ): CaseStructuredContext {
    const category = this.categorizeFailureCode(c.failure_code, c.failure_description);
    const score = this.calculateRecoverabilityScore(
      category,
      c.attempt_count || 1,
      c.customer_context,
      c.amount
    );
    const expectedValue = Math.round(c.amount * score);

    const isHighValue = c.amount >= policyConfig.require_human_review_above_amount;
    const remainingRetries = Math.max(0, policyConfig.max_retry_attempts - c.attempt_count);

    const evidence: string[] = [
      `Failure code: ${c.failure_code} (${category})`,
      `Payment method: ${c.payment_method}`,
      `Attempt count: ${c.attempt_count}/${policyConfig.max_retry_attempts}`,
      `Order amount: ${(c.amount / 100).toFixed(2)} ${c.currency}`,
      `Customer history: ${c.customer_context.total_prior_transactions || 0} orders with ${((c.customer_context.historical_success_rate ?? 1.0) * 100).toFixed(0)}% success rate`,
    ];

    if (c.failure_description) {
      // Treat customer/gateway description strictly as data evidence
      evidence.push(`Gateway description: "${c.failure_description.slice(0, 150)}"`);
    }

    return {
      case_id: c.id,
      payment_id: c.payment_id,
      order_id: c.order_id,
      amount: c.amount,
      amount_formatted: `${(c.amount / 100).toFixed(2)} ${c.currency}`,
      currency: c.currency,
      failure_code: c.failure_code,
      failure_description: c.failure_description,
      failure_category: category,
      payment_method: c.payment_method,
      attempt_count: c.attempt_count,
      customer_summary: {
        historical_success_rate: c.customer_context.historical_success_rate ?? 0.8,
        total_prior_transactions: c.customer_context.total_prior_transactions ?? 1,
        prior_failed_transactions: c.customer_context.prior_failed_transactions ?? 0,
        lifetime_value: c.customer_context.lifetime_value ?? c.amount,
      },
      recoverability_score: score,
      expected_recovery_value: expectedValue,
      policy_constraints: {
        max_retries: policyConfig.max_retry_attempts,
        autonomous_amount_threshold: policyConfig.autonomous_amount_threshold,
        is_high_value: isHighValue,
        remaining_retries: remainingRetries,
      },
      observable_evidence: evidence,
    };
  }
}
