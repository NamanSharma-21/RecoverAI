import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/db/database';
import { Repository } from '@/db/repository';
import { RecoveryControlLoop } from '@/orchestrator/recovery-loop';
import { ToolExecutor } from '@/tools/tool-executor';
import { createPaymentProvider } from '@/adapters/razorpay-adapter';
import { HumanReviewActionRequestSchema } from '@/domain/schemas';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const validated = HumanReviewActionRequestSchema.parse(body);

    const db = getDatabase();
    const repo = new Repository(db);
    const provider = createPaymentProvider();
    const toolExecutor = new ToolExecutor(provider, repo);
    const loop = new RecoveryControlLoop(repo, toolExecutor);

    const result = await loop.handleHumanReview(params.id, validated);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 400 }
    );
  }
}
