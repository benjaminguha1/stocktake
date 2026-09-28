import { env } from 'cloudflare:workers';
import { getUserForRequest, isSameOrigin } from '../../../functions/_lib/auth.js';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const user = await getUserForRequest(request, env);
    if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.type.startsWith('image/')) return Response.json({ error: 'Choose an image file.' }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return Response.json({ error: 'Image must be smaller than 6 MB.' }, { status: 413 });
    const bucket = (env as unknown as { FILES?: R2Bucket }).FILES;
    if (!bucket) throw new Error('Photo storage is unavailable.');
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const id = `${crypto.randomUUID()}.${extension}`;
    await bucket.put(`attachments/${id}`, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type, cacheControl: 'private, max-age=3600' },
      customMetadata: { uploadedBy: String(user.id), uploadedAt: new Date().toISOString(), originalName: file.name.slice(0, 120) },
    });
    return Response.json({ id, url: `/api/attachments/${encodeURIComponent(id)}`, name: file.name, type: file.type });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Photo upload failed.' }, { status: 500 });
  }
}

