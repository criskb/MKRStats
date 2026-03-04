import { NextResponse } from 'next/server';
import { getOverviewPayload } from '../_lib/overview.js';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await getOverviewPayload(searchParams);
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    return NextResponse.json({ message: 'Unexpected server error', details: error.message }, { status: 500 });
  }
}
