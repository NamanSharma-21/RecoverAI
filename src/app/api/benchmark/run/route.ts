import { NextRequest, NextResponse } from 'next/server';
import { BenchmarkRunner } from '@/evaluation/runner';
import { getDatabase } from '@/db/database';
import { Repository } from '@/db/repository';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const seed = body.seed ? parseInt(body.seed, 10) : 42;
    const totalCases = body.totalCases ? parseInt(body.totalCases, 10) : 1200;

    const db = getDatabase();
    const repo = new Repository(db);
    const runner = new BenchmarkRunner(repo);

    const report = await runner.runBenchmark(totalCases, seed);

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
