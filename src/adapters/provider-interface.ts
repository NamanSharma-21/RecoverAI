export interface PaymentProviderOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string | null;
  status: string;
  attempts: number;
}

export interface PaymentProviderPayment {
  id: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id?: string | null;
  method?: string;
  error_code?: string | null;
  error_description?: string | null;
  email?: string | null;
  contact?: string | null;
}

export interface PaymentProviderPaymentLink {
  id: string;
  amount: number;
  currency: string;
  status: 'created' | 'partially_paid' | 'paid' | 'cancelled' | 'expired';
  short_url: string;
  reference_id?: string | null;
}

export interface PaymentProvider {
  getProviderName(): string;
  getPayment(paymentId: string): Promise<PaymentProviderPayment | null>;
  getOrder(orderId: string): Promise<PaymentProviderOrder | null>;
  createPaymentLink(params: {
    amount: number;
    currency: string;
    description?: string;
    customer?: { name?: string; email?: string; contact?: string };
    reference_id?: string;
  }): Promise<PaymentProviderPaymentLink>;
  reusePaymentLink(paymentLinkId: string): Promise<PaymentProviderPaymentLink>;
  retryPayment(paymentId: string): Promise<{ success: boolean; new_payment_id?: string; message: string }>;
}
