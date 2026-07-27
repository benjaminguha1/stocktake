import { getUserForRequest, hasUsers } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const [usersExist, user] = await Promise.all([hasUsers(env), getUserForRequest(request, env)]);
    return Response.json({ hasUsers: usersExist, user: user ? { username: user.username, role: user.role } : null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Authentication is unavailable.' }, { status: 503 });
  }
}
