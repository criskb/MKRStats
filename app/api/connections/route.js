import { NextResponse } from 'next/server';
import { getConnectionStatuses, upsertConnectionConfig } from '../../../src/services/connectors/connectionConfigStore.js';

export async function GET() {
  try {
    const connections = await getConnectionStatuses();
    return NextResponse.json({ connections });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to load connections', details: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const payload = await req.json();

    if (payload?.connections && typeof payload.connections === 'object') {
      const entries = Object.entries(payload.connections);
      const configured = [];

      for (const [platformId, value] of entries) {
        const accountId = String(value?.handle ?? '').trim();
        const token = String(value?.apiKey ?? '').trim();
        if (!accountId) continue;

        const saved = await upsertConnectionConfig({
          platformId,
          accountId,
          authType: 'api_key',
          credential: token ? { apiToken: token, sessionId: token } : { handle: accountId },
          status: 'active'
        });
        configured.push(saved.platformId);
      }

      return NextResponse.json({
        message: 'Connections saved',
        configuredPlatforms: configured,
        configuredCount: configured.length
      });
    }

    const saved = await upsertConnectionConfig(payload);
    return NextResponse.json({ connection: saved });
  } catch (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
}
