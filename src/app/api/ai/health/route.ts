import { handleHealth } from '../../../../server/ai/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handleHealth();
}
