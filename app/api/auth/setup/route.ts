import { env } from 'cloudflare:workers';
import {
  createInitialAdmin,
  createSession,
  isSameOrigin,
  sessionCookie,
} from '../../../../functions/_lib/auth.js';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const password = String(form.get('password') || '');
    if (password !== String(form.get('confirmPassword') || '')) {
      return Response.json(
        { error: 'Passwords do not match.' },
        { status: 400 },
      );
    }
    const userId = await createInitialAdmin(env, {
      username: form.get('username'),
      email: form.get('email'),
      password,
    });
    const token = await createSession(env, userId);
    return Response.json(
      { saved: true },
      {
        headers: {
          'set-cookie': sessionCookie(token, request.url),
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Setup failed.' },
      { status: 400 },
    );
  }
}
