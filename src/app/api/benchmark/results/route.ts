import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/db/database';
import { Repository } from '@/db/repository';
import { ensureCanonicalSeeded } from '@/db/seed';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const db = getDatabase();
    const repo = new Repository(db);

    ensureCanonicalSeeded(repo);

    const latest = repo.getLatestBenchmarkRun();
    return NextResponse.json({
      success: true,
      benchmark: latest,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
