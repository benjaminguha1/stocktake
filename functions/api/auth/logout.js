import { clearSessionCookie, deleteSession, isSameOrigin } from '../../_lib/auth.js';

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  await deleteSession(request, env);
  return Response.json({ saved: true }, { headers: { 'set-cookie': clearSessionCookie(request.url), 'cache-control': 'no-store' } });
}
