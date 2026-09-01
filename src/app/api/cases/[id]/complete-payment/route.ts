import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/db/database';
import { Repository } from '@/db/repository';
import { ToolExecutor } from '@/tools/tool-executor';
import { RecoveryControlLoop } from '@/orchestrator/recovery-loop';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caseId = params.id;
    const db = getDatabase();
    const repo = new Repository(db);
    const recoveryCase = repo.getCaseById(caseId);

    if (!recoveryCase) {
      return NextResponse.json(
        { success: false, error: `Case ${caseId} not found` },
        { status: 404 }
      );
    }

    const toolExecutor = new ToolExecutor(repo);
    const recoveryLoop = new RecoveryControlLoop(repo, toolExecutor);

    // Ingest authoritative payment success event
    const successResult = await recoveryLoop.handlePaymentSuccess({
      paymentId: `pay_recov_${Date.now()}`,
      orderId: recoveryCase.order_id,
      paymentLinkId: recoveryCase.payment_link_id,
      amount: recoveryCase.amount,
    });

    const updatedCase = repo.getCaseById(caseId);

    return NextResponse.json({
      success: true,
      data: {
        recovered: successResult.recovered,
        case: updatedCase,
        recoveredAmount: recoveryCase.amount,
        recoveredAmountFormatted: `₹${(recoveryCase.amount / 100).toLocaleString('en-IN')}`,
        message: 'Payment verified successfully. Recovery complete.',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
