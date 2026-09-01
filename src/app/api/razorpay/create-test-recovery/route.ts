import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/db/database';
import { Repository } from '@/db/repository';
import { ToolExecutor } from '@/tools/tool-executor';
import { RecoveryControlLoop } from '@/orchestrator/recovery-loop';
import { RazorpayAdapter } from '@/adapters/razorpay-adapter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const amount = body.amount || 1200000; // Default ₹12,000 in paise
    const failureCode = body.failureCode || 'GATEWAY_TIMEOUT';
    const failureDescription = body.failureDescription || 'Bank gateway did not respond within timeout threshold';
    const paymentMethod = body.paymentMethod || 'card';
    const customerEmail = body.customerEmail || 'demo.customer@example.com';
    const customerName = body.customerName || 'Naman Sharma';

    const db = getDatabase();
    const repo = new Repository(db);
    const adapter = new RazorpayAdapter();
    const toolExecutor = new ToolExecutor(repo, adapter);
    const recoveryLoop = new RecoveryControlLoop(repo, toolExecutor);

    // 1. Create real order if in Test Mode
    const order = await adapter.createOrder({
      amount,
      currency: 'INR',
      notes: { source: 'RecoverAI Test Mode' },
    });

    const paymentId = `pay_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const eventId = `evt_failed_${Date.now()}`;

    // 2. Trigger Recovery Control Loop
    const result = await recoveryLoop.handlePaymentFailure({
      eventId,
      paymentId,
      orderId: order.id,
      amount,
      currency: 'INR',
      failureCode,
      failureDescription,
      paymentMethod,
      customerContext: {
        name: customerName,
        email: customerEmail,
        contact: '+919876543210',
        historical_success_rate: 0.9,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        case: result.case,
        decision: result.decision,
        policyCheck: result.policyCheck,
        toolResult: result.toolResult,
        recoveryUrl: result.case.recovery_url || `/recover/${result.case.id}`,
        message: 'Test payment failure ingested and recovery action initiated.',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
