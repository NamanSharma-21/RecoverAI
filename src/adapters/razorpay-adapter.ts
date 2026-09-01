import {
  PaymentProvider,
  PaymentProviderPayment,
  PaymentProviderOrder,
  PaymentProviderPaymentLink,
} from './provider-interface';
import { SimulatorAdapter } from './simulator-adapter';

export class RazorpayAdapter implements PaymentProvider {
  private keyId: string;
  private keySecret: string;
  private fallbackSimulator: SimulatorAdapter;
  private baseUrl = 'https://api.razorpay.com/v1';

  constructor(keyId?: string, keySecret?: string) {
    this.keyId = keyId || process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = keySecret || process.env.RAZORPAY_KEY_SECRET || '';
    this.fallbackSimulator = new SimulatorAdapter();
  }

  getProviderName(): string {
    return this.hasCredentials() ? 'razorpay-test-mode' : 'simulator-fallback';
  }

  hasCredentials(): boolean {
    return (
      !!this.keyId &&
      !!this.keySecret &&
      !this.keyId.includes('your_key') &&
      this.keyId.startsWith('rzp_test_')
    );
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  async getPayment(paymentId: string): Promise<PaymentProviderPayment | null> {
    if (!this.hasCredentials()) {
      return this.fallbackSimulator.getPayment(paymentId);
    }

    try {
      const res = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
        headers: { Authorization: this.getAuthHeader() },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        id: data.id,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        order_id: data.order_id,
        method: data.method,
        error_code: data.error_code,
        error_description: data.error_description,
        email: data.email,
        contact: data.contact,
      };
    } catch {
      return this.fallbackSimulator.getPayment(paymentId);
    }
  }

  async getOrder(orderId: string): Promise<PaymentProviderOrder | null> {
    if (!this.hasCredentials()) {
      return this.fallbackSimulator.getOrder(orderId);
    }

    try {
      const res = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        headers: { Authorization: this.getAuthHeader() },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        id: data.id,
        amount: data.amount,
        currency: data.currency,
        receipt: data.receipt,
        status: data.status,
        attempts: data.attempts,
      };
    } catch {
      return this.fallbackSimulator.getOrder(orderId);
    }
  }

  async createPaymentLink(params: {
    amount: number;
    currency: string;
    description?: string;
    customer?: { name?: string; email?: string; contact?: string };
    reference_id?: string;
  }): Promise<PaymentProviderPaymentLink> {
    if (!this.hasCredentials()) {
      return this.fallbackSimulator.createPaymentLink(params);
    }

    try {
      const body: Record<string, any> = {
        amount: params.amount,
        currency: params.currency,
        description: params.description || 'Payment Recovery Link',
        reference_id: params.reference_id,
      };

      if (params.customer) {
        body.customer = params.customer;
      }

      const res = await fetch(`${this.baseUrl}/payment_links`, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        return this.fallbackSimulator.createPaymentLink(params);
      }

      const data = await res.json();
      return {
        id: data.id,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        short_url: data.short_url,
        reference_id: data.reference_id,
      };
    } catch {
      return this.fallbackSimulator.createPaymentLink(params);
    }
  }

  async reusePaymentLink(paymentLinkId: string): Promise<PaymentProviderPaymentLink> {
    if (!this.hasCredentials()) {
      return this.fallbackSimulator.reusePaymentLink(paymentLinkId);
    }

    try {
      const res = await fetch(`${this.baseUrl}/payment_links/${paymentLinkId}`, {
        headers: { Authorization: this.getAuthHeader() },
      });
      if (!res.ok) {
        return this.fallbackSimulator.reusePaymentLink(paymentLinkId);
      }
      const data = await res.json();
      return {
        id: data.id,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        short_url: data.short_url,
        reference_id: data.reference_id,
      };
    } catch {
      return this.fallbackSimulator.reusePaymentLink(paymentLinkId);
    }
  }

  async retryPayment(paymentId: string): Promise<{ success: boolean; new_payment_id?: string; message: string }> {
    // Razorpay standard REST does not have a single direct retry payment API for customer-initiated card transactions;
    // in test mode / production, retries occur via order re-checkout or recurring tokens.
    // We provide simulator execution or order-level retry logic.
    return this.fallbackSimulator.retryPayment(paymentId);
  }
}

export function createPaymentProvider(): PaymentProvider {
  return new RazorpayAdapter();
}
