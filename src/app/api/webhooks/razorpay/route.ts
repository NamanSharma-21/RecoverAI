import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/db/database';
import { Repository } from '@/db/repository';
import { RecoveryControlLoop } from '@/orchestrator/recovery-loop';
import { ToolExecutor } from '@/tools/tool-executor';
import { createPaymentProvider } from '@/adapters/razorpay-adapter';
import { WebhookHandler } from '@/webhooks/handler';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');

    const db = getDatabase();
    const repo = new Repository(db);
    const provider = createPaymentProvider();
    const toolExecutor = new ToolExecutor(provider, repo);
    const loop = new RecoveryControlLoop(repo, toolExecutor);
    const handler = new WebhookHandler(repo, loop);

    const result = await handler.handleWebhook(rawBody, signature);
    return NextResponse.json(result.body, { status: result.statusCode });
  } catch (err: any) {
    console.error('Webhook route error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
