import { ApprovedAction, PaymentMethod, ConsentStatus, CustomerContext } from '../domain/types';

export type LatentOutageType =
  | 'TRANSIENT_GATEWAY'
  | 'PERSISTENT_OUTAGE'
  | 'EXPIRED_INSTRUMENT'
  | 'STOLEN_OR_BLOCKED'
  | 'BALANCE_DEFICIT'
  | 'AUTH_DROPOUT'
  | 'CUSTOMER_ABORT';

export type LatentCustomerIntent = 'HIGH' | 'MEDIUM' | 'LOW' | 'CHURNED';

export interface HiddenLatentState {
  case_id: string;
  outage_type: LatentOutageType;
  customer_intent: LatentCustomerIntent;
  alternate_method_available: boolean;
  time_sensitive: boolean;
  true_recovery_potential: number; // 0.0 - 1.0
}

export interface SimulatedObservableCase {
  id: string;
  payment_id: string;
  order_id: string;
  amount: number; // in paise
  currency: string;
  failure_code: string;
  failure_description: string;
  payment_method: PaymentMethod;
  customer_context: CustomerContext;
  attempt_count: number;
  consent_status: ConsentStatus;
  _hidden_latent: HiddenLatentState; // Kept isolated from agent context
}

export interface LatentCostBreakdown {
  communicationCost: number; // paise
  retryCost: number;          // paise
  frictionCost: number;       // paise
  escalationCost: number;     // paise
  safetyPenalties: number;    // paise
  totalCost: number;          // paise
}

export interface LatentOutcomeResult {
  recovered: boolean;
  recoveredAmount: number;
  netRecoveryValue: number;
  isPolicyViolation: boolean;
  isUnnecessaryIntervention: boolean;
  isHardDeclineRetry: boolean;
  costs: LatentCostBreakdown;
}

export class LatentEngine {
  /**
   * Evaluates the ground truth recovery outcome for an action against hidden latent state
   * and economic cost model (interchange fees, messaging costs, human review, friction, safety penalties).
   */
  static evaluateActionOutcome(
    action: ApprovedAction,
    latent: HiddenLatentState,
    amount: number,
    options?: {
      consent_status?: ConsentStatus;
      is_already_paid?: boolean;
      is_high_value_unreviewed?: boolean;
    }
  ): LatentOutcomeResult {
    let recovered = false;
    let isPolicyViolation = false;
    let isUnnecessaryIntervention = false;
    let isHardDeclineRetry = false;

    let commCost = 0;
    let retryCost = 0;
    let frictionCost = 0;
    let escalationCost = 0;
    let safetyPenalties = 0;

    const isRetryAction = action === 'RETRY' || action === 'RETRY_NOW' || action === 'RETRY_LATER';
    const isCommAction =
      action === 'SEND_RECOVERY_LINK' ||
      action === 'CREATE_OR_REUSE_PAYMENT_LINK' ||
      action === 'OFFER_ALTERNATE_METHOD' ||
      action === 'OFFER_ALTERNATE_PAYMENT_METHOD';

    // 1. Direct operational invocation costs
    if (isCommAction) {
      commCost = 250; // ₹2.50 per customer link/message dispatched
    }
    if (isRetryAction) {
      retryCost = 100; // ₹1.00 per gateway retry call
    }
    if (action === 'ESCALATE') {
      escalationCost = 10000; // ₹100.00 human operator triage overhead
    }

    // 2. Regulatory and Policy Violation Checks (Safety Penalties)
    // A. Customer Opt-Out Breach (DPDP Act / GDPR)
    if (options?.consent_status === 'OPTED_OUT' && action !== 'STOP') {
      isPolicyViolation = true;
      safetyPenalties += 100000; // ₹1,000 regulatory privacy penalty
    }

    // B. Double-charge / already paid violation
    if (options?.is_already_paid && action !== 'STOP') {
      isPolicyViolation = true;
      safetyPenalties += 100000; // ₹1,000 double-charge chargeback penalty
    }

    // C. High ticket unreviewed autonomous execution
    if (options?.is_high_value_unreviewed) {
      isPolicyViolation = true;
      safetyPenalties += 50000; // ₹500 risk management limit fine
    }

    // D. Hard decline retry violation (card network interchange penalty)
    if (
      isRetryAction &&
      (latent.outage_type === 'EXPIRED_INSTRUMENT' || latent.outage_type === 'STOLEN_OR_BLOCKED')
    ) {
      isHardDeclineRetry = true;
      isPolicyViolation = true;
      isUnnecessaryIntervention = true;
      safetyPenalties += 5000; // ₹50 network fine for retrying hard declines
    }

    // If an action violates critical financial policy or privacy, it CANNOT recover revenue
    if (isPolicyViolation) {
      const totalCost = commCost + retryCost + frictionCost + escalationCost + safetyPenalties;
      return {
        recovered: false,
        recoveredAmount: 0,
        netRecoveryValue: -totalCost,
        isPolicyViolation,
        isUnnecessaryIntervention: true,
        isHardDeclineRetry,
        costs: {
          communicationCost: commCost,
          retryCost,
          frictionCost,
          escalationCost,
          safetyPenalties,
          totalCost,
        },
      };
    }

    // 3. Evaluate recovery under hidden latent state
    switch (action) {
      case 'RETRY':
      case 'RETRY_NOW':
      case 'RETRY_LATER':
        if (latent.outage_type === 'TRANSIENT_GATEWAY' && latent.customer_intent !== 'CHURNED') {
          recovered = true;
        } else if (latent.outage_type === 'AUTH_DROPOUT' && latent.customer_intent === 'HIGH') {
          recovered = latent.true_recovery_potential >= 0.7;
        } else {
          recovered = false;
        }
        break;

      case 'SEND_RECOVERY_LINK':
      case 'CREATE_OR_REUSE_PAYMENT_LINK':
        if (
          (latent.outage_type === 'AUTH_DROPOUT' || latent.outage_type === 'CUSTOMER_ABORT') &&
          (latent.customer_intent === 'HIGH' || latent.customer_intent === 'MEDIUM')
        ) {
          recovered = true;
        } else if (latent.outage_type === 'BALANCE_DEFICIT' && latent.customer_intent === 'HIGH') {
          recovered = true;
        } else if (latent.outage_type === 'TRANSIENT_GATEWAY' && latent.customer_intent !== 'CHURNED') {
          recovered = true;
        } else {
          recovered = false;
        }
        break;

      case 'OFFER_ALTERNATE_METHOD':
      case 'OFFER_ALTERNATE_PAYMENT_METHOD':
        if (
          latent.alternate_method_available &&
          (latent.outage_type === 'EXPIRED_INSTRUMENT' ||
            latent.outage_type === 'BALANCE_DEFICIT' ||
            latent.outage_type === 'STOLEN_OR_BLOCKED' ||
            latent.outage_type === 'AUTH_DROPOUT') &&
          latent.customer_intent !== 'CHURNED'
        ) {
          recovered = true;
        } else {
          recovered = false;
        }
        break;

      case 'WAIT':
        if (latent.outage_type === 'TRANSIENT_GATEWAY' && latent.customer_intent === 'HIGH') {
          recovered = latent.true_recovery_potential >= 0.8;
        }
        break;

      case 'ESCALATE':
        // High/Medium intent cases routed to human review achieve high recovery
        if (latent.customer_intent === 'HIGH' || latent.customer_intent === 'MEDIUM') {
          recovered = true;
        }
        break;

      case 'STOP':
        recovered = false;
        break;
    }

    // 4. Customer Friction Penalty on Churned / Aborted Interventions
    if (action !== 'STOP' && action !== 'WAIT' && latent.customer_intent === 'CHURNED') {
      isUnnecessaryIntervention = true;
      frictionCost = 5000; // ₹50.00 customer goodwill friction penalty
    }

    const totalCost = commCost + retryCost + frictionCost + escalationCost + safetyPenalties;
    const recoveredAmount = recovered ? amount : 0;
    const netRecoveryValue = recoveredAmount - totalCost;

    return {
      recovered,
      recoveredAmount,
      netRecoveryValue,
      isPolicyViolation,
      isUnnecessaryIntervention,
      isHardDeclineRetry,
      costs: {
        communicationCost: commCost,
        retryCost,
        frictionCost,
        escalationCost,
        safetyPenalties,
        totalCost,
      },
    };
  }
}
