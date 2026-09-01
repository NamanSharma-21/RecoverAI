import { z } from 'zod';
import { APPROVED_ACTIONS } from './types';

export const ApprovedActionSchema = z.enum([
  'RETRY',
  'CREATE_OR_REUSE_PAYMENT_LINK',
  'OFFER_ALTERNATE_PAYMENT_METHOD',
  'WAIT',
  'ESCALATE',
  'STOP',
]);

export const CaseStatusSchema = z.enum([
  'EVENT_RECEIVED',
  'VERIFIED',
  'DEDUPLICATED',
  'RECOVERY_CASE_CREATED',
  'DIAGNOSED',
  'PRIORITIZED',
  'ACTION_SELECTED',
  'POLICY_CHECKED',
  'HUMAN_REVIEW',
  'ACTION_EXECUTED',
  'OUTCOME_MONITORED',
  'RECOVERED',
  'FAILED',
  'STOPPED',
  'ESCALATED',
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
 * Any model output that violates this schema is rejected by the application boundary.
 */
export const AIDecisionOutputSchema = z.object({
  diagnosis: z.string().min(3, 'Diagnosis must be descriptive'),
  evidence: z.array(z.string()).min(1, 'At least one piece of evidence is required'),
  recommended_action: ApprovedActionSchema,
  confidence: z.number().min(0).max(1, 'Confidence must be between 0.0 and 1.0'),
  expected_recovery_value: z.number().nonnegative('Expected recovery value must be non-negative'),
  rationale: z.string().min(5, 'Rationale must be descriptive'),
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
