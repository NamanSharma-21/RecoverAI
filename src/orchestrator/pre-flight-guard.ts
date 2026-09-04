import { Repository } from '../db/repository';
import { PaymentTruthResolver } from '../truth/payment-truth-resolver';
import { RecoveryCase, ApprovedAction, PolicyCheck, MerchantPolicyConfig } from '../domain/types';
import { isOpenState } from '../domain/state-machine';

export interface PreFlightCheckResult {
  passed: boolean;
  blockReason?: string;
  checks: {
    obligationOpen: boolean;
    paymentNotCaptured: boolean;
    customerConsented: boolean;
    actionNotExpired: boolean;
    retryLimitNotExceeded: boolean;
    noConflictingExecution: boolean;
  };
}

/**
 * PreFlightGuard
 *
 * Enforces mandatory real-time safety invariants IMMEDIATELY prior to tool execution.
 * Prevents race condition executions if a payment succeeded out-of-band, customer opted out,
 * or action validity expired while waiting for worker dispatch.
 */
export class PreFlightGuard {
  constructor(
    private repository: Repository,
    private truthResolver: PaymentTruthResolver
  ) {}

  async evaluate(
    c: RecoveryCase,
    action: ApprovedAction,
    policyCheck: PolicyCheck,
    policyConfig: MerchantPolicyConfig,
    actionValidUntil?: string
  ): Promise<PreFlightCheckResult> {
    const checks = {
      obligationOpen: true,
      paymentNotCaptured: true,
      customerConsented: true,
      actionNotExpired: true,
      retryLimitNotExceeded: true,
      noConflictingExecution: true,
    };

    // 1. Check obligation status (Payment Truth)
    if (c.obligation_id) {
      const isSatisfied = this.truthResolver.isObligationSatisfied(c.obligation_id);
      if (isSatisfied) {
        checks.obligationOpen = false;
        checks.paymentNotCaptured = false;
        return {
          passed: false,
          blockReason: 'Payment obligation is already SATISFIED. Pre-flight check aborted execution.',
          checks,
        };
      }
    }

    // 2. Check case status
    if (!isOpenState(c.status) || c.status === 'RECOVERED') {
      checks.obligationOpen = false;
      return {
        passed: false,
        blockReason: `Case is in terminal status '${c.status}'. Execution blocked.`,
        checks,
      };
    }

    // 3. Check customer consent
    if (c.consent_status === 'OPTED_OUT' && action !== 'STOP') {
      checks.customerConsented = false;
      return {
        passed: false,
        blockReason: 'Customer opted out of communications. Execution blocked.',
        checks,
      };
    }

    // 4. Staleness / Expiry Check
    if (actionValidUntil) {
      const expiry = new Date(actionValidUntil).getTime();
      if (Date.now() > expiry) {
        checks.actionNotExpired = false;
        return {
          passed: false,
          blockReason: `Action proposal expired at ${actionValidUntil} (staleness guard).`,
          checks,
        };
      }
    }

    // 5. Retry limit check
    const maxRetries = policyConfig.max_interventions_per_case || policyConfig.max_retry_attempts || 2;
    if (c.attempt_count >= maxRetries && action !== 'STOP' && action !== 'ESCALATE') {
      checks.retryLimitNotExceeded = false;
      return {
        passed: false,
        blockReason: `Maximum intervention limit (${maxRetries}) reached. Execution blocked.`,
        checks,
      };
    }

    // 6. Check policyCheck validity
    if (!policyCheck.allowed && policyCheck.policy_result !== 'ALLOW') {
      return {
        passed: false,
        blockReason: `Policy evaluation rejected action '${action}' (${policyCheck.policy_result}).`,
        checks,
      };
    }

    return {
      passed: true,
      checks,
    };
  }
}
