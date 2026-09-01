import { ApprovedAction, PaymentMethod, ConsentStatus } from '../domain/types';

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
  customer_context: {
    customer_id: string;
    email: string;
    contact: string;
    historical_success_rate: number;
    total_prior_transactions: number;
    prior_failed_transactions: number;
    lifetime_value: number;
  };
  attempt_count: number;
  consent_status: ConsentStatus;
  _hidden_latent: HiddenLatentState; // Kept isolated from agent context
}

export class LatentEngine {
  /**
   * Evaluates the ground truth recovery outcome for an action against hidden latent state.
   */
  static evaluateActionOutcome(
    action: ApprovedAction,
    latent: HiddenLatentState,
    amount: number
  ): {
    recovered: boolean;
    recoveredAmount: number;
    isPolicyViolation: boolean;
    isUnnecessaryIntervention: boolean;
    isHardDeclineRetry: boolean;
  } {
    let recovered = false;
    let isPolicyViolation = false;
    let isUnnecessaryIntervention = false;
    let isHardDeclineRetry = false;

    // Hard decline violation check
    if (
      action === 'RETRY' &&
      (latent.outage_type === 'EXPIRED_INSTRUMENT' || latent.outage_type === 'STOLEN_OR_BLOCKED')
    ) {
      isHardDeclineRetry = true;
      return {
        recovered: false,
        recoveredAmount: 0,
        isPolicyViolation: false,
        isUnnecessaryIntervention: true,
        isHardDeclineRetry: true,
      };
    }

    switch (action) {
      case 'RETRY':
        if (latent.outage_type === 'TRANSIENT_GATEWAY' && latent.customer_intent !== 'CHURNED') {
          recovered = true;
        } else if (latent.outage_type === 'AUTH_DROPOUT' && latent.customer_intent === 'HIGH') {
          recovered = latent.true_recovery_potential >= 0.7;
        } else {
          recovered = false;
        }
        break;

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

    if (action !== 'STOP' && action !== 'WAIT' && latent.customer_intent === 'CHURNED') {
      isUnnecessaryIntervention = true;
    }

    return {
      recovered,
      recoveredAmount: recovered ? amount : 0,
      isPolicyViolation,
      isUnnecessaryIntervention,
      isHardDeclineRetry,
    };
  }
}
