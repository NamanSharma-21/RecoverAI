import { NextResponse } from 'next/server';
import { RazorpayAdapter } from '@/adapters/razorpay-adapter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const adapter = new RazorpayAdapter();
    const status = await adapter.testConnection();

    return NextResponse.json({
      success: true,
      data: {
        provider: status.provider,
        connected: status.connected,
        keyIdPrefix: status.keyIdPrefix,
        message: status.message,
        hasLiveCredentials: adapter.hasCredentials(),
        webhookUrl: '/api/webhooks/razorpay',
        instructions: {
          step1: 'Configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env',
          step2: 'Configure Webhook in Razorpay Dashboard -> Webhooks pointing to your endpoint with secret RAZORPAY_WEBHOOK_SECRET',
          step3: 'Select events: payment.failed, payment.captured, payment.authorized, payment_link.paid',
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
