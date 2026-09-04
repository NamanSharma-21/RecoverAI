/**
 * RecoverAI - Core Domain Types
 * Authoritative definitions matching PRD, Technical Design Document, and Revenue Recovery Loop specifications.
 */

export type ApprovedAction =
  | 'RETRY_NOW'
  | 'RETRY_LATER'
  | 'CREATE_OR_REUSE_PAYMENT_LINK'
  | 'OFFER_ALTERNATE_METHOD'
  | 'WAIT'
  | 'ESCALATE'
  | 'STOP'
  // Backward compatibility aliases:
  | 'RETRY'
  | 'SEND_RECOVERY_LINK'
  | 'OFFER_ALTERNATE_PAYMENT_METHOD';

export const APPROVED_ACTIONS: ApprovedAction[] = [
  'RETRY_NOW',
  'RETRY_LATER',
  'CREATE_OR_REUSE_PAYMENT_LINK',
  'OFFER_ALTERNATE_METHOD',
  'WAIT',
  'ESCALATE',
  'STOP',
  'RETRY',
  'SEND_RECOVERY_LINK',
  'OFFER_ALTERNATE_PAYMENT_METHOD',
];

export type CaseStatus =
  // Product state machine:
  | 'FAILED'
  | 'ANALYZING'
  | 'DECISION_READY'
  | 'POLICY_CHECK'
  | 'ACTION_PENDING'
  | 'ACTION_EXECUTED'
  | 'OUTCOME_MONITORED'
  | 'RECOVERED'
  | 'STOPPED'
  | 'ESCALATED'
  | 'HUMAN_REVIEW'
  | 'EXPIRED'
  | 'FAILED_RECOVERY'
  // Legacy aliases:
  | 'EVENT_RECEIVED'
  | 'VERIFIED'
  | 'DEDUPLICATED'
  | 'RECOVERY_CASE_CREATED'
  | 'DIAGNOSED'
  | 'PRIORITIZED'
  | 'ACTION_SELECTED'
  | 'POLICY_CHECKED';

export type ObligationStatus =
  | 'OPEN'
  | 'PARTIALLY_SATISFIED'
  | 'SATISFIED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface PaymentObligation {
  id: string;
  merchant_id: string;
  order_id: string;
  amount_minor: number; // safe integer minor units (paise)
  currency: string;
  status: ObligationStatus;
  satisfied_at?: string | null;
  satisfied_by_payment_id?: string | null;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
}

export type ActionLifecycleStatus =
  | 'PROPOSED'
  | 'POLICY_ALLOWED'
  | 'CLAIMED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'OUTCOME_PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export interface RecoveryAction {
  id: string;
  case_id: string;
  obligation_id: string;
  action_type: ApprovedAction;
  generation: number; // generation/attempt index for deterministic idempotency
  idempotency_key: string;
  status: ActionLifecycleStatus;
  valid_until: string; // ISO timestamp for staleness prevention
  claim_worker_id?: string | null;
  claim_expires_at?: string | null;
  arguments: Record<string, any>;
  result: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CommunicationAttempt {
  id: string;
  obligation_id: string;
  case_id: string;
  customer_id?: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PAYMENT_LINK_PAGE';
  template: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SUPPRESSED';
  sent_at: string;
  delivered_at?: string | null;
  failed_at?: string | null;
  error_reason?: string | null;
  simulated: boolean;
}

export type PolicyResult = 'ALLOW' | 'BLOCK' | 'ESCALATE';

export type ConsentStatus = 'CONSENTED' | 'OPTED_OUT' | 'UNKNOWN';

export type CustomerFriction = 'LOW' | 'MEDIUM' | 'HIGH';

export type PaymentMethod = 'card' | 'upi' | 'netbanking' | 'wallet' | 'emi' | 'unknown';

export interface CustomerContext {
  customer_id?: string;
  email?: string;
  contact?: string;
  name?: string;
  historical_success_rate?: number;
  total_prior_transactions?: number;
  prior_failed_transactions?: number;
  lifetime_value?: number;
  is_returning_customer?: boolean;
}

export interface PaymentFailureContext {
  error_code?: string;
  error_description?: string;
  error_source?: string;
  error_step?: string;
  error_reason?: string;
  gateway_name?: string;
  issuer_name?: string;
  is_international?: boolean;
}

export interface RecoveryCase {
  id: string;
  merchant_id: string;
  obligation_id?: string | null;
  event_id: string;
  payment_id: string;
  order_id?: string | null;
  payment_link_id?: string | null;
  recovery_url?: string | null;
  amount: number; // in smallest currency unit (e.g. paise for INR)
  currency: string;
  failure_code: string;
  failure_description: string;
  payment_method: PaymentMethod;
  customer_context: CustomerContext;
  attempt_count: number;
  status: CaseStatus;
  recoverability_score: number; // 0.0 - 1.0
  expected_recovery_value: number; // in smallest currency unit
  consent_status: ConsentStatus;
  policy_version: string;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface Decision {
  id: string;
  case_id: string;
  model_provider: string;
  model_version: string;
  prompt_version: string;
  diagnosis: string;
  failure_category: string;
  recoverability: number; // 0.0 - 1.0
  expected_recovery_value: number;
  recommended_action: ApprovedAction;
  timing: string;
  confidence: number; // 0.0 - 1.0
  reason: string;
  customer_friction: CustomerFriction;
  expected_value: number; // in smallest currency unit
  evidence: string[];
  rationale: string;
  created_at: string;
}

export interface PolicyCheck {
  id: string;
  decision_id: string;
  case_id: string;
  allowed: boolean;
  policy_result: PolicyResult;
  reasons: string[];
  policy_version: string;
  created_at: string;
}

export interface ToolExecution {
  id: string;
  case_id: string;
  decision_id?: string | null;
  tool_name: string;
  idempotency_key: string;
  arguments: Record<string, any>;
  result: Record<string, any>;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  created_at: string;
}

export type AuditEventType =
  | 'WEBHOOK_RECEIVED'
  | 'WEBHOOK_VERIFIED'
  | 'WEBHOOK_DUPLICATE_SUPPRESSED'
  | 'CASE_CREATED'
  | 'STATE_TRANSITION'
  | 'CONTEXT_BUILT'
  | 'AI_DECISION_PRODUCED'
  | 'POLICY_EVALUATED'
  | 'TOOL_EXECUTION_ATTEMPTED'
  | 'TOOL_EXECUTION_COMPLETED'
  | 'TOOL_EXECUTION_FAILED'
  | 'CUSTOMER_LINK_OPENED'
  | 'OUTCOME_VERIFIED'
  | 'CASE_RECOVERED'
  | 'CASE_CLOSED'
  | 'HUMAN_REVIEW_TRIGGERED'
  | 'HUMAN_ACTION_TAKEN'
  | 'PAYMENT_SUCCESS_INTERRUPT'
  | 'OBLIGATION_CREATED'
  | 'OBLIGATION_SATISFIED'
  | 'ACTION_PROPOSED'
  | 'ACTION_CLAIMED'
  | 'ACTION_CANCELLED'
  | 'COMMUNICATION_SUPPRESSED'
  | 'COMMUNICATION_DISPATCHED';

export interface AuditEvent {
  id: string;
  case_id: string;
  obligation_id?: string | null;
  correlation_id?: string | null;
  event_type: AuditEventType;
  actor: 'SYSTEM' | 'LLM' | 'POLICY' | 'TOOL' | 'MERCHANT_OPERATOR' | 'PAYMENT_GATEWAY';
  source: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export function toMinorUnits(amountRupees: number): number {
  if (!Number.isFinite(amountRupees) || amountRupees < 0) {
    throw new Error(`Invalid financial amount: ${amountRupees}. Must be non-negative finite number.`);
  }
  return Math.round(amountRupees * 100);
}

export function toDisplayCurrency(amountMinor: number, currency: string = 'INR'): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error(`Invalid minor currency units: ${amountMinor}. Must be a non-negative integer.`);
  }
  const formatted = (amountMinor / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === 'INR' ? `₹${formatted}` : `${currency} ${formatted}`;
}

export interface WebhookEventRecord {
  event_id: string;
  event_type: string;
  payload: string;
  received_at: string;
  processed: boolean;
}

export interface MerchantPolicyConfig {
  autonomous_limit_inr: number; // In paise. Under ₹5,000 (500,000 paise): autonomous recovery
  bounded_limit_inr: number; // In paise. ₹5,000–₹25,000 (2,500,000 paise): 1 bounded intervention
  human_approval_above_inr: number; // Above ₹25,000: human approval required
  max_retry_attempts: number; // Max total interventions per case (default: 2)
  max_interventions_per_case: number; // Default: 2
  autonomous_amount_threshold: number; // For compatibility (= human_approval_above_inr)
  recovery_cooldown_minutes: number; // Default: 15 mins between retries
  max_contact_frequency_hours: number; // Max contact frequency (e.g. 12 hrs)
  policy_version: string;
  require_human_review_above_amount: number;
  min_confidence_for_autonomous_action: number;
  allowed_actions: ApprovedAction[];
  prohibited_failure_codes_for_retry: string[];
}

export const DEFAULT_MERCHANT_POLICY: MerchantPolicyConfig = {
  autonomous_limit_inr: 500000, // ₹5,000
  bounded_limit_inr: 2500000, // ₹25,000
  human_approval_above_inr: 2500000, // ₹25,000
  max_retry_attempts: 2,
  max_interventions_per_case: 2,
  autonomous_amount_threshold: 2500000, // ₹25,000
  recovery_cooldown_minutes: 15,
  max_contact_frequency_hours: 12,
  policy_version: '2.1.0',
  require_human_review_above_amount: 2500000,
  min_confidence_for_autonomous_action: 0.65,
  allowed_actions: [
    'RETRY_NOW',
    'RETRY_LATER',
    'CREATE_OR_REUSE_PAYMENT_LINK',
    'OFFER_ALTERNATE_METHOD',
    'WAIT',
    'ESCALATE',
    'STOP',
    'RETRY',
    'SEND_RECOVERY_LINK',
    'OFFER_ALTERNATE_PAYMENT_METHOD',
  ],
  prohibited_failure_codes_for_retry: [
    'BAD_REQUEST_ERROR',
    'EXPIRED_CARD',
    'STOLEN_CARD',
    'FRAUDULENT_TRANSACTION',
    'CARD_BLOCKED',
    'ACCOUNT_CLOSED',
    'TRANSACTION_NOT_ALLOWED',
    'HARD_DECLINE',
  ],
};
