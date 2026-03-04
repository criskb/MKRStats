import { NextResponse } from 'next/server';
import { platformsPayload } from '../_lib/overview.js';

export async function GET() {
  return NextResponse.json(platformsPayload());
}
