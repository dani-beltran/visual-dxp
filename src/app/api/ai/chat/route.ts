import { handleChat } from '../../../../server/ai/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request) {
  return handleChat(request);
}
