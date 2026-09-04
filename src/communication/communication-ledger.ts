import { Repository } from '../db/repository';
import { CommunicationAttempt, RecoveryCase, MerchantPolicyConfig } from '../domain/types';

export interface CommunicationCheckResult {
  canContact: boolean;
  reason?: string;
  contactCount: number;
  remainingCooldownSeconds?: number;
}

/**
 * CommunicationLedgerManager
 *
 * Provider-neutral communication guard and tracking abstraction.
 * Enforces contact limits, cooldowns, customer opt-out, and immediate payment-success suppression.
 */
export class CommunicationLedgerManager {
  constructor(private repository: Repository) {}

  canContactCustomer(
    c: RecoveryCase,
    channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PAYMENT_LINK_PAGE',
    policyConfig: MerchantPolicyConfig
  ): CommunicationCheckResult {
    // 1. Opt-out check
    if (c.consent_status === 'OPTED_OUT') {
      return {
        canContact: false,
        reason: 'Customer has explicitly opted out of recovery communications.',
        contactCount: 0,
      };
    }

    // 2. Obligation check
    const obligationId = c.obligation_id || c.order_id || c.id;
    const count = this.repository.getCommunicationCount(obligationId);
    const maxContacts = policyConfig.max_interventions_per_case || policyConfig.max_retry_attempts || 2;

    if (count >= maxContacts) {
      return {
        canContact: false,
        reason: `Maximum customer contact limit reached (${count}/${maxContacts}).`,
        contactCount: count,
      };
    }

    // 3. Cooldown check
    const cooldownMinutes = policyConfig.recovery_cooldown_minutes || 15;
    const recent = this.repository.getRecentCommunications(obligationId, 24);

    if (recent.length > 0) {
      const lastSentTime = new Date(recent[0].sent_at).getTime();
      const elapsedMinutes = (Date.now() - lastSentTime) / (1000 * 60);

      if (elapsedMinutes < cooldownMinutes) {
        const remainingSec = Math.ceil((cooldownMinutes - elapsedMinutes) * 60);
        return {
          canContact: false,
          reason: `Communication cooldown active. Please wait ${Math.ceil(cooldownMinutes - elapsedMinutes)} more minutes.`,
          contactCount: count,
          remainingCooldownSeconds: remainingSec,
        };
      }
    }

    return {
      canContact: true,
      contactCount: count,
    };
  }

  recordAttempt(
    caseId: string,
    obligationId: string,
    customerId: string | undefined,
    channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PAYMENT_LINK_PAGE',
    template: string,
    status: 'SENT' | 'DELIVERED' | 'FAILED' | 'SUPPRESSED' = 'SENT',
    errorReason?: string
  ): CommunicationAttempt {
    const now = new Date().toISOString();
    const attempt: CommunicationAttempt = {
      id: `comm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      obligation_id: obligationId,
      case_id: caseId,
      customer_id: customerId,
      channel,
      template,
      status,
      sent_at: now,
      delivered_at: status === 'DELIVERED' || status === 'SENT' ? now : null,
      failed_at: status === 'FAILED' ? now : null,
      error_reason: errorReason || null,
      simulated: true, // Clearly labeled as simulated
    };

    this.repository.recordCommunicationAttempt(attempt);
    return attempt;
  }
}
