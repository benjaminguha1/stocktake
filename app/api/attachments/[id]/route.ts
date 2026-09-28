import { env } from 'cloudflare:workers';
import { getUserForRequest } from '../../../../functions/_lib/auth.js';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!(await getUserForRequest(request, env))) return new Response('Unauthorised', { status: 401 });
    const bucket = (env as unknown as { FILES?: R2Bucket }).FILES;
    if (!bucket) throw new Error('Photo storage is unavailable.');
    const { id } = await context.params;
    if (!/^[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(id)) return new Response('Not found', { status: 404 });
    const object = await bucket.get(`attachments/${id}`);
    if (!object) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('x-content-type-options', 'nosniff');
    headers.set('cache-control', 'private, max-age=3600');
    return new Response(object.body, { headers });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Photo unavailable.', { status: 500 });
  }
}

