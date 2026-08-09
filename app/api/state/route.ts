import { env } from 'cloudflare:workers';
import {
  ensureSchema,
  getDatabase,
  getUserForRequest,
  isSameOrigin,
} from '../../../functions/_lib/auth.js';

const STATE_ID = 'cafe';
const MAX_STATE_BYTES = 950_000;

function validState(value: unknown) {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    Array.isArray((value as { products?: unknown[] }).products) &&
    Array.isArray((value as { suppliers?: unknown[] }).suppliers) &&
    Array.isArray((value as { usageRecords?: unknown[] }).usageRecords) &&
    Array.isArray((value as { stocktakes?: unknown[] }).stocktakes)
  );
}

export async function GET(request: Request) {
  try {
    if (!(await getUserForRequest(request, env))) {
      return Response.json({ error: 'Unauthorised' }, { status: 401 });
    }
    await ensureSchema(env);
    const row = await getDatabase(env)
      .prepare(
        'SELECT payload, updated_at FROM stocktake_states WHERE id = ?',
      )
      .bind(STATE_ID)
      .first<{ payload: string; updated_at: string }>();
    return Response.json(
      row
        ? { state: JSON.parse(row.payload), updatedAt: row.updated_at }
        : { state: null, updatedAt: null },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Online storage failed.',
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!(await getUserForRequest(request, env))) {
      return Response.json({ error: 'Unauthorised' }, { status: 401 });
    }
    const body = (await request.json()) as { state?: unknown };
    if (!validState(body.state)) {
      return Response.json(
        { error: 'A valid Stocktake state is required.' },
        { status: 400 },
      );
    }
    const payload = JSON.stringify(body.state);
    if (new TextEncoder().encode(payload).byteLength > MAX_STATE_BYTES) {
      return Response.json(
        { error: 'Stocktake data is too large to save.' },
        { status: 413 },
      );
    }
    await ensureSchema(env);
    await getDatabase(env)
      .prepare(
        `INSERT INTO stocktake_states (id, payload, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET
           payload = excluded.payload,
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(STATE_ID, payload)
      .run();
    return Response.json({ saved: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Online storage failed.',
      },
      { status: 500 },
    );
  }
}
