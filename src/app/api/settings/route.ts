import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/db/database';
import { Repository } from '@/db/repository';
import { DEFAULT_MERCHANT_POLICY } from '@/domain/types';
import { MerchantSettingsUpdateSchema } from '@/domain/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getDatabase();
    const repo = new Repository(db);
    const settings = repo.getMerchantSettings('merchant_default') || DEFAULT_MERCHANT_POLICY;

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = MerchantSettingsUpdateSchema.parse(body);

    const db = getDatabase();
    const repo = new Repository(db);
    const current = repo.getMerchantSettings('merchant_default') || DEFAULT_MERCHANT_POLICY;

    const updated = {
      ...current,
      ...parsed,
      updated_at: new Date().toISOString(),
    };

    repo.saveMerchantSettings('merchant_default', updated);

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Merchant recovery policy configuration updated successfully.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
