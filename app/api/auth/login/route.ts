import { env } from 'cloudflare:workers';
import {
  authenticate,
  createSession,
  isSameOrigin,
  sessionCookie,
} from '../../../../functions/_lib/auth.js';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const form = await request.formData();
  const user = await authenticate(
    request,
    env,
    String(form.get('identifier') || '').slice(0, 254),
    String(form.get('password') || '').slice(0, 128),
  );
  if (!user) {
    return Response.json(
      { error: 'Incorrect details, or this account is temporarily locked.' },
      { status: 401 },
    );
  }

  const token = await createSession(env, user.id);
  return Response.json(
    { saved: true, username: user.username },
    {
      headers: {
        'set-cookie': sessionCookie(token, request.url),
        'cache-control': 'no-store',
      },
    },
  );
}
