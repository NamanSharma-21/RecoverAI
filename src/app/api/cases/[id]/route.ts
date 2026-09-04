import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/db/database';
import { Repository } from '@/db/repository';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDatabase();
    const repo = new Repository(db);

    const c = repo.getCaseById(params.id);
    if (!c) {
      return NextResponse.json({ success: false, error: 'Case not found' }, { status: 404 });
    }

    const decisions = repo.getDecisionsByCaseId(c.id);
    const policyChecks = repo.getPolicyChecksByCaseId(c.id);
    const toolExecutions = repo.getToolExecutionsByCaseId(c.id);
    const auditEvents = repo.getAuditEventsByCaseId(c.id);
    const recoveryActions = repo.getRecoveryActionsByCaseId(c.id);
    const communications = repo.getCommunicationsByCaseId(c.id);
    const obligation = c.obligation_id
      ? repo.getObligationById(c.obligation_id)
      : (c.order_id ? repo.getObligationByOrderId(c.order_id) : null);

    const payload = {
      case: c,
      obligation,
      decisions,
      policyChecks,
      toolExecutions,
      recoveryActions,
      communications,
      auditEvents,
    };

    return NextResponse.json({
      success: true,
      data: payload,
      ...payload,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
