import { SESSION_TTL_SECONDS } from './defaults';
import { createSession, getAdminPassword, getAdminUser, requireAuth } from './auth';
import { renderLogin } from './panel';
import { saveSettings, saveMihomo } from './state';
import { rebuildSingCaches } from './sing-box';
import { addMihomoSubscription, addSingBoxSubscription, importMihomoProxies } from './subscriptions';
import type { AppState, Env } from './types';
import { fetchText, jsonResponse, normalizePath, parseConfigText, parseJsonObject } from './utils';

export async function handleApi(request: Request, env: Env, state: AppState): Promise<Response> {
  const url = new URL(request.url);
  const action = url.pathname.replace(/^\/api\/?/, '');

  if (action === 'login' && request.method === 'POST') {
    const body = await request.formData();
    if (body.get('username') === getAdminUser(env) && body.get('password') === getAdminPassword(env)) {
      const session = await createSession(env);
      return new Response(null, {
        status: 303,
        headers: { Location: state.settings.panelPath || '/', 'Set-Cookie': `session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}` },
      });
    }
    return renderLogin('登录失败');
  }

  const authError = await requireAuth(request, env);
  if (authError) return authError;

  if (action === 'state') return renderState(state);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const body = await readBody(request);

  if (action === 'settings') {
    state.settings.publicPath = normalizePath(body.publicPath, '/sub');
    state.settings.panelPath = normalizePath(body.panelPath, '/');
    state.settings.apiPath = normalizePath(body.apiPath, '/external-api');
    state.settings.apiToken = String(body.apiToken || '');
    state.settings.updatedAt = new Date().toISOString();
    await saveSettings(env, state);
    return jsonResponse({ ok: true, settings: state.settings });
  }

  if (action === 'sing/template') {
    const templateUrl = String(body.url || state.singTemplateUrl || '').trim();
    const shouldFetch = body.mode === 'fetch' || (!body.template && templateUrl);
    if (templateUrl) state.singTemplateUrl = templateUrl;
    if (shouldFetch) {
      if (!templateUrl) return jsonResponse({ error: 'Missing template URL' }, 400);
      body.template = parseJsonObject(await fetchText(templateUrl, env));
    }
    if (!body.template) return jsonResponse({ error: 'Missing template' }, 400);
    state.singTemplate = typeof body.template === 'string' ? parseJsonObject(body.template) : body.template;
    await rebuildSingCaches(env, state);
    return jsonResponse({ ok: true, templateUrl: state.singTemplateUrl, updatedAt: state.singCache.updatedAt });
  }

  if (action === 'sing/sub/add') {
    if (!body.name || !body.url) return jsonResponse({ error: 'Missing name or url' }, 400);
    const result = await addSingBoxSubscription(env, state, { id: body.id, name: String(body.name), url: String(body.url) });
    return jsonResponse({ ok: true, ...result });
  }

  if (action === 'sing/sub/update') {
    const ids = body.id ? [String(body.id)] : state.singSubs.map((sub) => sub.id);
    for (const id of ids) {
      const item = state.singSubs.find((sub) => sub.id === id);
      if (!item) continue;
      const config = parseJsonObject(await fetchText(item.url, env));
      item.updatedAt = new Date().toISOString();
      item.size = JSON.stringify(config).length;
      state.singSubConfigs[id] = config;
    }
    await rebuildSingCaches(env, state);
    return jsonResponse({ ok: true, updatedAt: state.singCache.updatedAt });
  }

  if (action === 'sing/sub/delete') {
    const id = String(body.id || '');
    state.singSubs = state.singSubs.filter((sub) => sub.id !== id);
    delete state.singSubConfigs[id];
    await rebuildSingCaches(env, state);
    return jsonResponse({ ok: true });
  }

  if (action === 'sing/import-mihomo') {
    if (!body.name) return jsonResponse({ error: 'Missing name' }, 400);
    const result = await importMihomoProxies(env, state, { id: body.id, name: String(body.name), url: body.url ? String(body.url) : undefined, content: String(body.content || '') });
    return jsonResponse({ ok: true, ...result });
  }

  if (action === 'sing/patches') {
    state.singPatches = {
      android: typeof body.android === 'string' ? parseJsonObject(body.android) : body.android || {},
      other: typeof body.other === 'string' ? parseJsonObject(body.other) : body.other || {},
    };
    await rebuildSingCaches(env, state);
    return jsonResponse({ ok: true, updatedAt: state.singCache.updatedAt });
  }

  if (action === 'sing/group-rules') {
    const parsed = typeof body.rules === 'string' ? parseConfigText(body.rules) : body.rules;
    state.singGroupRules = Array.isArray(parsed) ? parsed : parsed?.rules || [];
    await rebuildSingCaches(env, state);
    return jsonResponse({ ok: true, updatedAt: state.singCache.updatedAt });
  }

  if (action === 'mihomo/template') {
    const templateUrl = String(body.url || state.mihomoTemplateUrl || '').trim();
    const shouldFetch = body.mode === 'fetch' || (!body.template && templateUrl);
    if (templateUrl) state.mihomoTemplateUrl = templateUrl;
    if (shouldFetch) {
      if (!templateUrl) return jsonResponse({ error: 'Missing template URL' }, 400);
      body.template = parseConfigText(await fetchText(templateUrl, env));
    }
    if (!body.template) return jsonResponse({ error: 'Missing template' }, 400);
    const template = typeof body.template === 'string' ? parseJsonObject(body.template) : body.template;
    const providers = template['proxy-providers'] || {};
    delete template['proxy-providers'];
    state.mihomoTemplate = template;
    state.mihomoProviders = { ...providers, ...state.mihomoProviders };
    await saveMihomo(env, state);
    return jsonResponse({ ok: true, templateUrl: state.mihomoTemplateUrl });
  }

  if (action === 'mihomo/provider/add') {
    if (!body.name || !body.url) return jsonResponse({ error: 'Missing name or url' }, 400);
    const result = await addMihomoSubscription(env, state, {
      id: body.id,
      name: String(body.name),
      url: String(body.url),
      healthCheck: String(body.healthCheck || 'https://cp.cloudflare.com'),
      interval: Number(body.interval || 3600),
    });
    return jsonResponse({ ok: true, ...result });
  }

  if (action === 'mihomo/provider/delete') {
    delete state.mihomoProviders[String(body.name || '')];
    await saveMihomo(env, state);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

function renderState(state: AppState): Response {
  return jsonResponse({
    settings: state.settings,
    singSubs: state.singSubs,
    singCacheUpdatedAt: state.singCache.updatedAt,
    singTemplate: state.singTemplate,
    singPatches: state.singPatches,
    mihomoTemplate: state.mihomoTemplate,
    mihomoProviders: state.mihomoProviders,
    publicUrls: {
      auto: state.settings.publicPath,
      singBox: `${state.settings.publicPath}?target=sing-box`,
      singBoxAndroid: `${state.settings.publicPath}?target=sing-box-android`,
      mihomo: `${state.settings.publicPath}?target=mihomo`,
    },
  });
}

async function readBody(request: Request): Promise<any> {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}
