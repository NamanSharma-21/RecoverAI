import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/db/database';
import { Repository } from '@/db/repository';
import { RecoveryControlLoop } from '@/orchestrator/recovery-loop';
import { ToolExecutor } from '@/tools/tool-executor';
import { SimulatorAdapter } from '@/adapters/simulator-adapter';
import { GOLDEN_SCENARIOS } from '@/simulator/scenarios';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const scenarioId = body.scenario_id;

    const db = getDatabase();
    const repo = new Repository(db);
    const provider = new SimulatorAdapter();
    const toolExecutor = new ToolExecutor(provider, repo);
    const loop = new RecoveryControlLoop(repo, toolExecutor);

    if (scenarioId) {
      const fixture = GOLDEN_SCENARIOS.find((s) => s.id === scenarioId);
      if (!fixture) {
        return NextResponse.json({ success: false, error: 'Scenario not found' }, { status: 404 });
      }

      const c = fixture.caseData;
      const result = await loop.handlePaymentFailure({
        eventId: `evt_${Date.now()}_${fixture.id}`,
        paymentId: `pay_${Date.now()}_${c.payment_id}`,
        orderId: `order_${Date.now()}`,
        amount: c.amount,
        currency: c.currency,
        failureCode: c.failure_code,
        failureDescription: c.failure_description,
        paymentMethod: c.payment_method,
        customerContext: c.customer_context,
        consentStatus: c.consent_status,
      });

      return NextResponse.json({
        success: true,
        scenario: fixture.name,
        result,
      });
    }

    // Default custom simulated failure
    const amount = body.amount || 249900;
    const failureCode = body.failure_code || 'GATEWAY_ERROR';
    const failureDescription = body.failure_description || 'Simulated gateway timeout error';
    const paymentMethod = body.payment_method || 'card';

    const result = await loop.handlePaymentFailure({
      eventId: `evt_sim_${Date.now()}`,
      paymentId: `pay_sim_${Date.now()}`,
      orderId: `order_sim_${Date.now()}`,
      amount,
      currency: 'INR',
      failureCode,
      failureDescription,
      paymentMethod,
      customerContext: {
        email: body.email || 'customer@example.com',
        contact: body.contact || '+919876543210',
        name: body.name || 'Demo Customer',
      },
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
