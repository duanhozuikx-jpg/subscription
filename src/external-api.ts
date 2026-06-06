import { addMihomoSubscription, addSingBoxSubscription } from './subscriptions';
import type { AppState, Env } from './types';
import { jsonResponse } from './utils';

export async function handleExternalApi(request: Request, env: Env, state: AppState): Promise<Response> {
  if (!state.settings.apiToken) return jsonResponse({ error: 'External API token is not configured' }, 403);
  if (!isAuthorized(request, state.settings.apiToken)) return jsonResponse({ error: 'Unauthorized' }, 401);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = (await request.json().catch(() => ({}))) as any;
  if (!body.name || !body.url) return jsonResponse({ error: 'Missing name or url' }, 400);

  const type = String(body.type || body.format || 'mihomo').toLowerCase();
  if (['sing-box', 'singbox', 'json'].includes(type)) {
    const result = await addSingBoxSubscription(env, state, { id: body.id, name: String(body.name), url: String(body.url) });
    return jsonResponse({ ok: true, type: 'sing-box', ...result });
  }

  if (['mihomo', 'clash', 'clash-meta', 'yaml'].includes(type)) {
    const result = await addMihomoSubscription(env, state, {
      id: body.id,
      name: String(body.name),
      url: String(body.url),
      healthCheck: String(body.healthCheck || 'https://cp.cloudflare.com'),
      interval: Number(body.interval || 3600),
    });
    return jsonResponse({ ok: true, type: 'mihomo', ...result });
  }

  return jsonResponse({ error: 'Unsupported type' }, 400);
}

function isAuthorized(request: Request, token: string): boolean {
  const url = new URL(request.url);
  const auth = request.headers.get('Authorization') || '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer === token || url.searchParams.get('token') === token || request.headers.get('X-API-Token') === token;
}
