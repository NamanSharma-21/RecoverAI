import {
  PaymentProvider,
  PaymentProviderPayment,
  PaymentProviderOrder,
  PaymentProviderPaymentLink,
} from './provider-interface';

export class SimulatorAdapter implements PaymentProvider {
  private payments = new Map<string, PaymentProviderPayment>();
  private orders = new Map<string, PaymentProviderOrder>();
  private paymentLinks = new Map<string, PaymentProviderPaymentLink>();

  getProviderName(): string {
    return 'simulator';
  }

  async getPayment(paymentId: string): Promise<PaymentProviderPayment | null> {
    return (
      this.payments.get(paymentId) || {
        id: paymentId,
        amount: 250000,
        currency: 'INR',
        status: 'failed',
        method: 'card',
        error_code: 'GATEWAY_ERROR',
        error_description: 'Simulated gateway error',
      }
    );
  }

  async getOrder(orderId: string): Promise<PaymentProviderOrder | null> {
    return (
      this.orders.get(orderId) || {
        id: orderId,
        amount: 250000,
        currency: 'INR',
        status: 'attempted',
        attempts: 1,
      }
    );
  }

  async createPaymentLink(params: {
    amount: number;
    currency: string;
    description?: string;
    customer?: { name?: string; email?: string; contact?: string };
    reference_id?: string;
  }): Promise<PaymentProviderPaymentLink> {
    const linkId = `plink_sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const link: PaymentProviderPaymentLink = {
      id: linkId,
      amount: params.amount,
      currency: params.currency,
      status: 'created',
      short_url: `https://rzp.io/i/sim_${linkId}`,
      reference_id: params.reference_id,
    };
    this.paymentLinks.set(linkId, link);
    return link;
  }

  async reusePaymentLink(paymentLinkId: string): Promise<PaymentProviderPaymentLink> {
    const existing = this.paymentLinks.get(paymentLinkId);
    if (existing) {
      return existing;
    }
    const link: PaymentProviderPaymentLink = {
      id: paymentLinkId,
      amount: 250000,
      currency: 'INR',
      status: 'created',
      short_url: `https://rzp.io/i/sim_${paymentLinkId}`,
    };
    this.paymentLinks.set(paymentLinkId, link);
    return link;
  }

  async retryPayment(paymentId: string): Promise<{ success: boolean; new_payment_id?: string; message: string }> {
    const newPaymentId = `pay_retry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return {
      success: true,
      new_payment_id: newPaymentId,
      message: `Simulated retry dispatched for payment ${paymentId}. New payment attempt: ${newPaymentId}`,
    };
  }
}
