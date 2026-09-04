import { Repository } from '../db/repository';
import { PaymentProvider } from '../adapters/provider-interface';
import { ObligationStatus, PaymentObligation } from '../domain/types';

export type TruthSourceTier =
  | 'AUTHORITATIVE_EVENT'
  | 'PROVIDER_QUERY'
  | 'PERSISTED_STATE'
  | 'LLM_PROPOSAL'
  | 'UI_STATE';

export const TRUTH_PRECEDENCE_RANK: Record<TruthSourceTier, number> = {
  AUTHORITATIVE_EVENT: 5,
  PROVIDER_QUERY: 4,
  PERSISTED_STATE: 3,
  LLM_PROPOSAL: 2,
  UI_STATE: 1,
};

export interface PaymentTruthCandidate {
  source: TruthSourceTier;
  status: 'PAID' | 'UNPAID' | 'PARTIALLY_PAID';
  captured: boolean;
  amount_captured_minor: number;
  currency: string;
  confidence: number;
  observed_at: string;
  payment_id?: string;
}

export interface ResolvedTruthDecision {
  obligation_id: string;
  source: TruthSourceTier;
  status: 'PAID' | 'UNPAID' | 'PARTIALLY_PAID';
  captured: boolean;
  is_authoritative: boolean;
  amount_captured_minor: number;
  currency: string;
  payment_id?: string;
  resolved_at: string;
}

export type TruthPrecedenceSource =
  | 'AUTHORITATIVE_EVENT'
  | 'PROVIDER_RECONCILIATION'
  | 'PERSISTED_DATABASE'
  | 'AMBIGUOUS_FALLBACK';

export interface ObligationTruthResult {
  obligationId: string;
  orderId: string;
  status: ObligationStatus;
  isSatisfied: boolean;
  source: TruthPrecedenceSource;
  satisfiedByPaymentId?: string | null;
  amountMinor: number;
  currency: string;
  reconciledAt: string;
}

/**
 * PaymentTruthResolver
 *
 * Enforces the core architectural law:
 *   AUTHORITATIVE PAYMENT EVENT > PROVIDER RECONCILIATION QUERY > PERSISTED STATE > LLM / UI
 *
 * Prevents recovery actions on already-satisfied obligations even when asynchronous
 * race conditions or out-of-order events occur.
 */
export class PaymentTruthResolver {
  constructor(
    private repository: Repository,
    private paymentProvider?: PaymentProvider
  ) {}

  /**
   * Resolves the authoritative state of a payment obligation.
   * If persisted state is ambiguous (e.g. UNKNOWN or OPEN with pending check),
   * queries provider directly to reconcile ground truth.
   */
  async resolveObligationTruth(obligationId: string): Promise<ObligationTruthResult> {
    const now = new Date().toISOString();
    const obligation = this.repository.getObligationById(obligationId);

    if (!obligation) {
      throw new Error(`Obligation not found: ${obligationId}`);
    }

    // 1. If already marked SATISFIED by an authoritative event, that is final truth.
    if (obligation.status === 'SATISFIED') {
      return {
        obligationId: obligation.id,
        orderId: obligation.order_id,
        status: 'SATISFIED',
        isSatisfied: true,
        source: 'AUTHORITATIVE_EVENT',
        satisfiedByPaymentId: obligation.satisfied_by_payment_id,
        amountMinor: obligation.amount_minor,
        currency: obligation.currency,
        reconciledAt: now,
      };
    }

    // 2. Query provider to reconcile order/payment truth if provider adapter is available
    if (this.paymentProvider && obligation.order_id) {
      try {
        const orderStatus = await this.paymentProvider.getOrder(obligation.order_id);
        if (orderStatus) {
          if (orderStatus.status === 'paid') {
            this.repository.updateObligationStatus(obligation.id, 'SATISFIED');
            this.repository.cancelPendingActionsForObligation(
              obligation.id,
              'Obligation satisfied in provider reconciliation'
            );
            return {
              obligationId: obligation.id,
              orderId: obligation.order_id,
              status: 'SATISFIED',
              isSatisfied: true,
              source: 'PROVIDER_RECONCILIATION',
              satisfiedByPaymentId: obligation.satisfied_by_payment_id,
              amountMinor: obligation.amount_minor,
              currency: obligation.currency,
              reconciledAt: now,
            };
          }
        }
      } catch (err) {
        // Fall through to persisted state if provider call fails or times out
      }
    }

    // 3. Fall back to persisted database state
    return {
      obligationId: obligation.id,
      orderId: obligation.order_id,
      status: obligation.status,
      isSatisfied: false,
      source: 'PERSISTED_DATABASE',
      satisfiedByPaymentId: obligation.satisfied_by_payment_id,
      amountMinor: obligation.amount_minor,
      currency: obligation.currency,
      reconciledAt: now,
    };
  }

  /**
   * Fast sync check for hot-path guards (e.g. pre-flight checks).
   */
  isObligationSatisfied(obligationId: string): boolean {
    const obligation = this.repository.getObligationById(obligationId);
    return obligation ? obligation.status === 'SATISFIED' : false;
  }

  /**
   * Authoritatively mark an obligation satisfied by payment event.
   * Cancels all pending recovery actions immediately.
   */
  markObligationSatisfied(
    obligationId: string,
    paymentId: string,
    amountMinor: number,
    source: string = 'payment.captured'
  ): void {
    this.repository.updateObligationStatus(obligationId, 'SATISFIED', paymentId);
    this.repository.cancelPendingActionsForObligation(
      obligationId,
      `Payment satisfied via ${paymentId} (${source})`
    );
  }

  /**
   * Adjudicates conflicting payment state candidates using strict authority tier precedence.
   */
  resolveTruth(obligationId: string, candidates: PaymentTruthCandidate[]): ResolvedTruthDecision {
    if (!candidates || candidates.length === 0) {
      throw new Error('Cannot resolve truth without candidates');
    }

    const sorted = [...candidates].sort((a, b) => {
      const rankA = TRUTH_PRECEDENCE_RANK[a.source] || 0;
      const rankB = TRUTH_PRECEDENCE_RANK[b.source] || 0;
      if (rankB !== rankA) return rankB - rankA;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime();
    });

    const chosen = sorted[0];
    return {
      obligation_id: obligationId,
      source: chosen.source,
      status: chosen.status,
      captured: chosen.captured,
      is_authoritative: chosen.source === 'AUTHORITATIVE_EVENT' || chosen.source === 'PROVIDER_QUERY',
      amount_captured_minor: chosen.amount_captured_minor,
      currency: chosen.currency,
      payment_id: chosen.payment_id,
      resolved_at: new Date().toISOString(),
    };
  }

  /**
   * Handles authoritative webhook capture event, marks obligation satisfied, cancels actions, and updates case.
   */
  async resolveFromWebhookCapture(
    obligationId: string,
    paymentId: string,
    eventId: string,
    amountMinor: number,
    currency: string
  ): Promise<ResolvedTruthDecision> {
    this.markObligationSatisfied(obligationId, paymentId, amountMinor, `webhook:${eventId}`);

    // Update case if one is linked to this obligation
    const obligation = this.repository.getObligationById(obligationId);
    if (obligation) {
      const cases = this.repository.listCases();
      const matchingCase = cases.find(
        (c) => c.obligation_id === obligationId || c.order_id === obligation.order_id
      );
      if (matchingCase) {
        this.repository.updateCase({ id: matchingCase.id, status: 'RECOVERED' });
        this.repository.createAuditEvent({
          id: `aud_${Date.now()}_truth`,
          case_id: matchingCase.id,
          obligation_id: obligationId,
          event_type: 'OBLIGATION_SATISFIED',
          actor: 'PAYMENT_GATEWAY',
          source: 'WEBHOOK_CAPTURE',
          metadata: { payment_id: paymentId, event_id: eventId, amountMinor, currency },
          timestamp: new Date().toISOString(),
        });
      }
    }

    return {
      obligation_id: obligationId,
      source: 'AUTHORITATIVE_EVENT',
      status: 'PAID',
      captured: true,
      is_authoritative: true,
      amount_captured_minor: amountMinor,
      currency,
      payment_id: paymentId,
      resolved_at: new Date().toISOString(),
    };
  }
}
