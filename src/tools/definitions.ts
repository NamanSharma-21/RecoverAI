import { RecoveryCase } from '../domain/types';
import { PaymentProvider } from '../adapters/provider-interface';

export interface ToolResult {
  success: boolean;
  action: string;
  data: Record<string, any>;
  message: string;
}

export async function executeRetryPayment(
  c: RecoveryCase,
  provider: PaymentProvider
): Promise<ToolResult> {
  const res = await provider.retryPayment(c.payment_id);
  return {
    success: res.success,
    action: 'RETRY',
    data: {
      original_payment_id: c.payment_id,
      new_payment_id: res.new_payment_id,
      attempt: c.attempt_count + 1,
    },
    message: res.message,
  };
}

export async function executeCreateOrReusePaymentLink(
  c: RecoveryCase,
  provider: PaymentProvider
): Promise<ToolResult> {
  if (c.payment_link_id) {
    const existing = await provider.reusePaymentLink(c.payment_link_id);
    return {
      success: true,
      action: 'CREATE_OR_REUSE_PAYMENT_LINK',
      data: {
        payment_link_id: existing.id,
        short_url: existing.short_url,
        reused: true,
      },
      message: `Reused existing payment link: ${existing.short_url}`,
    };
  }

  const link = await provider.createPaymentLink({
    amount: c.amount,
    currency: c.currency,
    description: `Recovery link for order ${c.order_id || c.payment_id}`,
    customer: {
      name: c.customer_context.name,
      email: c.customer_context.email,
      contact: c.customer_context.contact,
    },
    reference_id: c.order_id || c.id,
  });

  return {
    success: true,
    action: 'CREATE_OR_REUSE_PAYMENT_LINK',
    data: {
      payment_link_id: link.id,
      short_url: link.short_url,
      reused: false,
    },
    message: `Created recovery payment link: ${link.short_url}`,
  };
}

export async function executeOfferAlternatePaymentMethod(
  c: RecoveryCase,
  provider: PaymentProvider
): Promise<ToolResult> {
  // Generates a multi-method payment recovery link emphasizing UPI / alternate cards
  const link = await provider.createPaymentLink({
    amount: c.amount,
    currency: c.currency,
    description: `Alternate payment method for order ${c.order_id || c.payment_id}`,
    customer: {
      name: c.customer_context.name,
      email: c.customer_context.email,
      contact: c.customer_context.contact,
    },
    reference_id: c.order_id || c.id,
  });

  return {
    success: true,
    action: 'OFFER_ALTERNATE_PAYMENT_METHOD',
    data: {
      payment_link_id: link.id,
      short_url: link.short_url,
      recommended_alternatives: ['upi', 'netbanking', 'alternate_card'],
    },
    message: `Generated multi-rail checkout link: ${link.short_url}`,
  };
}

export async function executeWaitCase(c: RecoveryCase): Promise<ToolResult> {
  return {
    success: true,
    action: 'WAIT',
    data: {
      backoff_seconds: 300,
      next_check_at: new Date(Date.now() + 300000).toISOString(),
    },
    message: 'Case placed in backoff wait state before subsequent verification.',
  };
}

export async function executeStopCase(c: RecoveryCase, reason?: string): Promise<ToolResult> {
  return {
    success: true,
    action: 'STOP',
    data: {
      reason: reason || 'Stopped by policy or operator decision',
      terminal: true,
    },
    message: `Recovery operations halted for case ${c.id}.`,
  };
}

export async function executeEscalateCase(c: RecoveryCase, reason?: string): Promise<ToolResult> {
  return {
    success: true,
    action: 'ESCALATE',
    data: {
      reason: reason || 'Escalated to human review queue',
      queued_at: new Date().toISOString(),
    },
    message: `Case ${c.id} successfully queued for human operator review.`,
  };
}
