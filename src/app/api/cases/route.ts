import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/db/database';
import { Repository } from '@/db/repository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as any;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const db = getDatabase();
    const repo = new Repository(db);

    const cases = repo.listCases({ status: status || undefined, limit });
    const stats = repo.getDashboardStats();

    const enrichedCases = cases.map((c) => ({
      ...c,
      latest_decision: repo.getLatestDecisionByCaseId(c.id),
      latest_policy_check: repo.getLatestPolicyCheckByCaseId(c.id),
    }));

    return NextResponse.json({
      success: true,
      stats,
      cases: enrichedCases,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
