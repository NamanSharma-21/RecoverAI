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

    return NextResponse.json({
      success: true,
      case: c,
      decisions,
      policyChecks,
      toolExecutions,
      auditEvents,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
