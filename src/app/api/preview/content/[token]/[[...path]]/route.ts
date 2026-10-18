import { servePreview } from '../../../../../../server/preview/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  return servePreview(request, (await context.params).token);
}

export const HEAD = GET;
