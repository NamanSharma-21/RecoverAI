import { z } from 'zod';
import { APPROVED_ACTIONS } from './types';

export const ApprovedActionSchema = z.enum([
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
]);

export const CaseStatusSchema = z.enum([
  'FAILED',
  'ANALYZING',
  'DECISION_READY',
  'POLICY_CHECK',
  'ACTION_PENDING',
  'ACTION_EXECUTED',
  'OUTCOME_MONITORED',
  'RECOVERED',
  'STOPPED',
  'ESCALATED',
  'HUMAN_REVIEW',
  'EXPIRED',
  'FAILED_RECOVERY',
  // Legacy aliases:
  'EVENT_RECEIVED',
  'VERIFIED',
  'DEDUPLICATED',
  'RECOVERY_CASE_CREATED',
  'DIAGNOSED',
  'PRIORITIZED',
  'ACTION_SELECTED',
  'POLICY_CHECKED',
]);

export const ConsentStatusSchema = z.enum(['CONSENTED', 'OPTED_OUT', 'UNKNOWN']);

export const PaymentMethodSchema = z.enum(['card', 'upi', 'netbanking', 'wallet', 'emi', 'unknown']);

export const CustomerContextSchema = z.object({
  customer_id: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  contact: z.string().optional(),
  name: z.string().optional(),
  historical_success_rate: z.number().min(0).max(1).optional(),
  total_prior_transactions: z.number().int().nonnegative().optional(),
  prior_failed_transactions: z.number().int().nonnegative().optional(),
  lifetime_value: z.number().nonnegative().optional(),
  is_returning_customer: z.boolean().optional(),
});

export const PaymentFailureContextSchema = z.object({
  error_code: z.string().optional(),
  error_description: z.string().optional(),
  error_source: z.string().optional(),
  error_step: z.string().optional(),
  error_reason: z.string().optional(),
  gateway_name: z.string().optional(),
  issuer_name: z.string().optional(),
  is_international: z.boolean().optional(),
});

/**
 * Strict schema for the LLM structured JSON decision output.
 * Matches Product Definition requirement.
 */
export const AIDecisionOutputSchema = z.object({
  diagnosis: z.string().min(3, 'Diagnosis must be descriptive'),
  failure_category: z.string().default('TRANSIENT'),
  recoverability: z.number().min(0).max(1).default(0.7),
  expected_recovery_value: z.number().nonnegative('Expected recovery value must be non-negative').optional().default(0),
  recommended_action: ApprovedActionSchema,
  timing: z.string().default('IMMEDIATE'),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0.0 and 1.0'),
  reason: z.string().min(3, 'Reason must be provided'),
  customer_friction: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
  evidence: z.array(z.string()).default([]),
  rationale: z.string().optional(),
});

export type AIDecisionOutput = z.infer<typeof AIDecisionOutputSchema>;

export const RazorpayWebhookPayloadSchema = z.object({
  entity: z.string(),
  account_id: z.string().optional(),
  event: z.string(),
  contains: z.array(z.string()).optional(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        entity: z.literal('payment').optional(),
        amount: z.number(),
        currency: z.string(),
        status: z.string(),
        order_id: z.string().nullable().optional(),
        invoice_id: z.string().nullable().optional(),
        international: z.boolean().optional(),
        method: z.string().optional(),
        amount_refunded: z.number().optional(),
        refund_status: z.string().nullable().optional(),
        captured: z.boolean().optional(),
        description: z.string().nullable().optional(),
        card_id: z.string().nullable().optional(),
        bank: z.string().nullable().optional(),
        wallet: z.string().nullable().optional(),
        vpa: z.string().nullable().optional(),
        email: z.string().nullable().optional(),
        contact: z.string().nullable().optional(),
        notes: z.record(z.any()).optional(),
        fee: z.number().nullable().optional(),
        tax: z.number().nullable().optional(),
        error_code: z.string().nullable().optional(),
        error_description: z.string().nullable().optional(),
        error_source: z.string().nullable().optional(),
        error_step: z.string().nullable().optional(),
        error_reason: z.string().nullable().optional(),
        created_at: z.number().optional(),
      }),
    }).optional(),
    order: z.object({
      entity: z.object({
        id: z.string(),
        amount: z.number().optional(),
        amount_paid: z.number().optional(),
        amount_due: z.number().optional(),
        currency: z.string().optional(),
        receipt: z.string().nullable().optional(),
        status: z.string().optional(),
        attempts: z.number().optional(),
        notes: z.record(z.any()).optional(),
        created_at: z.number().optional(),
      }),
    }).optional(),
    payment_link: z.object({
      entity: z.object({
        id: z.string(),
        amount: z.number().optional(),
        amount_paid: z.number().optional(),
        currency: z.string().optional(),
        status: z.string().optional(),
        short_url: z.string().optional(),
        reference_id: z.string().nullable().optional(),
        customer: z.record(z.any()).optional(),
      }),
    }).optional(),
  }),
  created_at: z.number(),
});

export const HumanReviewActionRequestSchema = z.object({
  action: z.enum(['APPROVE', 'OVERRIDE', 'ESCALATE', 'STOP']),
  override_action: ApprovedActionSchema.optional(),
  operator_notes: z.string().min(2, 'Operator notes required'),
  operator_id: z.string().default('operator_admin'),
});

export type HumanReviewActionRequest = z.infer<typeof HumanReviewActionRequestSchema>;

export const MerchantSettingsUpdateSchema = z.object({
  autonomous_limit_inr: z.number().positive().optional(),
  bounded_limit_inr: z.number().positive().optional(),
  human_approval_above_inr: z.number().positive().optional(),
  max_interventions_per_case: z.number().int().min(1).max(10).optional(),
  recovery_cooldown_minutes: z.number().int().min(1).max(1440).optional(),
  max_contact_frequency_hours: z.number().int().min(1).max(72).optional(),
  min_confidence_for_autonomous_action: z.number().min(0).max(1).optional(),
});
