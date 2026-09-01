/**
 * RecoverAI - Core Domain Types
 * Authoritative definitions matching PRD and Technical Design Document specifications.
 */

export type ApprovedAction =
  | 'RETRY'
  | 'CREATE_OR_REUSE_PAYMENT_LINK'
  | 'OFFER_ALTERNATE_PAYMENT_METHOD'
  | 'WAIT'
  | 'ESCALATE'
  | 'STOP';

export const APPROVED_ACTIONS: ApprovedAction[] = [
  'RETRY',
  'CREATE_OR_REUSE_PAYMENT_LINK',
  'OFFER_ALTERNATE_PAYMENT_METHOD',
  'WAIT',
  'ESCALATE',
  'STOP',
];

export type CaseStatus =
  | 'EVENT_RECEIVED'
  | 'VERIFIED'
  | 'DEDUPLICATED'
  | 'RECOVERY_CASE_CREATED'
  | 'DIAGNOSED'
  | 'PRIORITIZED'
  | 'ACTION_SELECTED'
  | 'POLICY_CHECKED'
  | 'HUMAN_REVIEW'
  | 'ACTION_EXECUTED'
  | 'OUTCOME_MONITORED'
  | 'RECOVERED'
  | 'FAILED'
  | 'STOPPED'
  | 'ESCALATED';

export type PolicyResult = 'ALLOW' | 'BLOCK' | 'ESCALATE';

export type ConsentStatus = 'CONSENTED' | 'OPTED_OUT' | 'UNKNOWN';

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
  event_id: string;
  payment_id: string;
  order_id?: string | null;
  payment_link_id?: string | null;
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
  evidence: string[];
  recommended_action: ApprovedAction;
  confidence: number; // 0.0 - 1.0
  expected_value: number;
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
  | 'OUTCOME_VERIFIED'
  | 'CASE_RECOVERED'
  | 'CASE_CLOSED'
  | 'HUMAN_REVIEW_TRIGGERED'
  | 'HUMAN_ACTION_TAKEN'
  | 'PAYMENT_SUCCESS_INTERRUPT';

export interface AuditEvent {
  id: string;
  case_id: string;
  event_type: AuditEventType;
  actor: 'SYSTEM' | 'LLM' | 'POLICY' | 'TOOL' | 'MERCHANT_OPERATOR' | 'PAYMENT_GATEWAY';
  source: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export interface WebhookEventRecord {
  event_id: string;
  event_type: string;
  payload: string;
  received_at: string;
  processed: boolean;
}

export interface MerchantPolicyConfig {
  max_retry_attempts: number;
  autonomous_amount_threshold: number; // in smallest currency unit (e.g. 50,000 INR = 5,000,000 paise)
  policy_version: string;
  require_human_review_above_amount: number;
  min_confidence_for_autonomous_action: number;
  allowed_actions: ApprovedAction[];
  prohibited_failure_codes_for_retry: string[];
}

export const DEFAULT_MERCHANT_POLICY: MerchantPolicyConfig = {
  max_retry_attempts: 3,
  autonomous_amount_threshold: 5000000, // 50,000 INR
  policy_version: '1.0.0',
  require_human_review_above_amount: 5000000,
  min_confidence_for_autonomous_action: 0.65,
  allowed_actions: ['RETRY', 'CREATE_OR_REUSE_PAYMENT_LINK', 'OFFER_ALTERNATE_PAYMENT_METHOD', 'WAIT', 'ESCALATE', 'STOP'],
  prohibited_failure_codes_for_retry: [
    'BAD_REQUEST_ERROR',
    'EXPIRED_CARD',
    'STOLEN_CARD',
    'FRAUDULENT_TRANSACTION',
    'CARD_BLOCKED',
    'ACCOUNT_CLOSED',
    'TRANSACTION_NOT_ALLOWED',
    'HARD_DECLINE'
  ],
};
