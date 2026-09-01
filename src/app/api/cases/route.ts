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

    return NextResponse.json({
      success: true,
      stats,
      cases,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
