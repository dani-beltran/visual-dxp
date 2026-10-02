import { after } from 'next/server';
import { handleChat } from '../../../../server/ai/http';
import { flushTelemetry } from '../../../../server/observability/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  // after() keeps serverless invocations alive after streamed responses finish.
  try {
    after(flushTelemetry);
  } catch {
    /* Direct invocation outside Next (tests). */
  }
  return handleChat(request);
}
